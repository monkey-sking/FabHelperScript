/**
 * Fab Helper - Task Runner Module
 * 
 * This module handles:
 * - Task execution and batch processing
 * - Card status checking and filtering
 * - Worker tab management
 * - Detail page processing
 * - DOM observation for infinite scroll
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';
import { DataCache } from './data-cache.js';
import { Database } from './database.js';
import { API } from './api.js';
import { RateLimitManager } from './rate-limit-manager.js';
import { PageDiagnostics } from './page-diagnostics.js';
import { PagePatcher } from './page-patcher.js';
import { InstanceManager } from './instance-manager.js';

// Forward declaration for UI (will be set via dependency injection)
let UI = null;

export function setUIReference(uiModule) {
    UI = uiModule;
}

export const TaskRunner = {
    // Check if a card is finished (owned, done, or failed)
    isCardFinished: (card) => {
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const url = link ? link.href.split('?')[0] : null;

        if (!link) {
            const icons = card.querySelectorAll('i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled');
            if (icons.length > 0) return true;

            const text = card.textContent || '';
            return text.includes("已保存在我的库中") ||
                text.includes("已保存") ||
                text.includes("Saved to My Library") ||
                text.includes("In your library");
        }

        const uidMatch = link.href.match(/listings\/([a-f0-9-]+)/);
        if (!uidMatch || !uidMatch[1]) return false;

        const uid = uidMatch[1];

        if (DataCache.ownedStatus.has(uid)) {
            const status = DataCache.ownedStatus.get(uid);
            if (status && status.acquired) return true;
        }

        if (card.querySelector(Config.SELECTORS.ownedStatus) !== null) {
            if (uid) {
                DataCache.saveOwnedStatus([{
                    uid: uid,
                    acquired: true,
                    lastUpdatedAt: new Date().toISOString()
                }]);
            }
            return true;
        }

        if (url) {
            if (Database.isDone(url)) return true;
            if (Database.isFailed(url)) return true;
            if (State.sessionCompleted.has(url)) return true;
        }

        return false;
    },

    // Check if a card represents a free item
    isFreeCard: (card) => {
        const cardText = card.textContent || '';
        const hasFreeKeyword = [...Config.FREE_TEXT_SET].some(freeWord => cardText.includes(freeWord));
        const has100PercentDiscount = cardText.includes('-100%');

        const priceMatch = cardText.match(/\$(\d+(?:\.\d{2})?)/g);
        if (priceMatch) {
            const hasNonZeroPrice = priceMatch.some(price => {
                const numValue = parseFloat(price.replace('$', ''));
                return numValue > 0;
            });

            if (hasNonZeroPrice && !hasFreeKeyword) return false;

            if (hasNonZeroPrice && hasFreeKeyword) {
                if (cardText.includes('起始价格 免费') || cardText.includes('Starting at Free')) return true;
                if (cardText.match(/起始价格\s*\$[1-9]/) || cardText.match(/Starting at\s*\$[1-9]/i)) return false;
            }
        }

        return hasFreeKeyword || has100PercentDiscount;
    },

    // Toggle execution state
    toggleExecution: () => {
        if (!Utils.checkAuthentication()) return;

        if (State.isExecuting) {
            State.isExecuting = false;
            Database.saveExecutingState();
            State.runningWorkers = {};
            State.activeWorkers = 0;
            State.executionTotalTasks = 0;
            State.executionCompletedTasks = 0;
            State.executionFailedTasks = 0;
            Utils.logger('info', Utils.getText('log_execution_stopped'));
            if (UI) UI.update();
            return;
        }

        if (State.autoAddOnScroll) {
            Utils.logger('info', Utils.getText('log_auto_add_enabled'));
            TaskRunner.checkVisibleCardsStatus().then(() => {
                TaskRunner.startExecution();
            });
            return;
        }

        State.db.todo = [];
        Utils.logger('info', Utils.getText('log_todo_cleared'));

        Utils.logger('debug', Utils.getText('log_scanning_items'));
        const cards = document.querySelectorAll(Config.SELECTORS.card);
        const newlyAddedList = [];
        let alreadyInQueueCount = 0;
        let ownedCount = 0;
        let skippedCount = 0;

        const isCardSettled = (card) => {
            return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
        };

        cards.forEach(card => {
            if (card.style.display === 'none') return;
            if (!isCardSettled(card)) {
                skippedCount++;
                return;
            }

            if (TaskRunner.isCardFinished(card)) {
                ownedCount++;
                return;
            }

            const link = card.querySelector(Config.SELECTORS.cardLink);
            const url = link ? link.href.split('?')[0] : null;
            if (!url) return;

            if (Database.isTodo(url)) {
                alreadyInQueueCount++;
                return;
            }

            if (!TaskRunner.isFreeCard(card)) return;

            const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() ||
                card.querySelector('a[href*="/listings/"]')?.textContent.trim() ||
                Utils.getText('untitled');
            newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
        });

        if (skippedCount > 0) {
            Utils.logger('debug', Utils.getText('log_skipped_unsettled', skippedCount));
        }

        if (newlyAddedList.length > 0) {
            State.db.todo.push(...newlyAddedList);
            Utils.logger('info', Utils.getText('log_added_to_queue', newlyAddedList.length));
        }

        const actionableCount = State.db.todo.length;
        if (actionableCount > 0) {
            if (newlyAddedList.length === 0 && alreadyInQueueCount > 0) {
                Utils.logger('info', Utils.getText('log_all_in_queue', alreadyInQueueCount));
            }
            TaskRunner.checkVisibleCardsStatus().then(() => {
                TaskRunner.startExecution();
            });
        } else {
            Utils.logger('info', Utils.getText('log_no_new_items', ownedCount, skippedCount));
            if (UI) UI.update();
        }
    },

    // Start execution without scanning
    startExecution: () => {
        if (State.isExecuting) {
            const newTotal = State.db.todo.length;
            if (newTotal > State.executionTotalTasks) {
                Utils.logger('info', Utils.getText('log_new_tasks_added', newTotal));
                State.executionTotalTasks = newTotal;
                if (UI) UI.update();
            } else {
                Utils.logger('info', Utils.getText('log_executor_running'));
            }
            return;
        }

        if (State.db.todo.length === 0) {
            Utils.logger('debug', Utils.getText('log_exec_no_tasks'));
            return;
        }

        Utils.logger('info', Utils.getText('log_starting_execution', State.db.todo.length));
        State.isExecuting = true;
        Database.saveExecutingState();
        State.executionTotalTasks = State.db.todo.length;
        State.executionCompletedTasks = 0;
        State.executionFailedTasks = 0;

        if (UI) UI.update();
        TaskRunner.executeBatch();
    },

    // Toggle hide saved items
    toggleHideSaved: async () => {
        State.hideSaved = !State.hideSaved;
        await Database.saveHidePref();
        TaskRunner.runHideOrShow();

        if (!State.hideSaved) {
            const actualVisibleCount = document.querySelectorAll(`${Config.SELECTORS.card}:not([style*="display: none"])`).length;
            Utils.logger('info', Utils.getText('log_display_mode_switched', actualVisibleCount));
        }

        if (UI) UI.update();
    },

    toggleAutoAdd: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.autoAddOnScroll = !State.autoAddOnScroll;
        await Database.saveAutoAddPref();
        Utils.logger('info', Utils.getText('log_auto_add_toggle', State.autoAddOnScroll ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    toggleAutoResume: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.autoResumeAfter429 = !State.autoResumeAfter429;
        await Database.saveAutoResumePref();
        Utils.logger('info', Utils.getText('log_auto_resume_toggle', State.autoResumeAfter429 ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    toggleRememberPosition: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.rememberScrollPosition = !State.rememberScrollPosition;
        await Database.saveRememberPosPref();
        Utils.logger('info', Utils.getText('log_remember_pos_toggle', State.rememberScrollPosition ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));

        if (!State.rememberScrollPosition) {
            await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
            PagePatcher._patchHasBeenApplied = false;
            PagePatcher._lastSeenCursor = null;
            State.savedCursor = null;
            Utils.logger('info', Utils.getText('log_position_cleared'));
            if (State.UI && State.UI.savedPositionDisplay) {
                State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(null);
            }
        } else if (State.UI && State.UI.savedPositionDisplay) {
            State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(State.savedCursor);
        }

        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    toggleAutoRefreshEmpty: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.autoRefreshEmptyPage = !State.autoRefreshEmptyPage;
        await Database.saveAutoRefreshEmptyPref();
        Utils.logger('info', Utils.getText('log_auto_refresh_toggle', State.autoRefreshEmptyPage ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    stop: () => {
        if (!State.isExecuting) return;
        State.isExecuting = false;
        Database.saveExecutingState();
        Database.saveTodo();
        GM_deleteValue(Config.DB_KEYS.TASK);
        State.runningWorkers = {};
        State.activeWorkers = 0;
        State.executionTotalTasks = 0;
        State.executionCompletedTasks = 0;
        State.executionFailedTasks = 0;
        Utils.logger('info', Utils.getText('log_execution_stopped'));
        if (UI) UI.update();
    },

    runRecoveryProbe: async () => {
        const randomDelay = Math.floor(Math.random() * (30000 - 15000 + 1) + 15000);
        Utils.logger('info', Utils.getText('log_recovery_probe', (randomDelay / 1000).toFixed(1)));

        setTimeout(async () => {
            Utils.logger('info', Utils.getText('log_probing_connection'));
            try {
                const csrfToken = Utils.getCookie('fab_csrftoken');
                if (!csrfToken) {
                    Utils.checkAuthentication();
                    throw new Error("CSRF token not found for probe.");
                }
                const probeResponse = await API.gmFetch({
                    method: 'GET',
                    url: 'https://www.fab.com/i/users/context',
                    headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                });

                if (probeResponse.status === 429) {
                    throw new Error("Probe failed with 429. Still rate-limited.");
                } else if (probeResponse.status >= 200 && probeResponse.status < 300) {
                    await PagePatcher.handleSearchResponse({ status: 200 });
                    Utils.logger('info', Utils.getText('log_connection_restored'));
                    TaskRunner.toggleExecution();
                } else {
                    throw new Error(`Probe failed with unexpected status: ${probeResponse.status}`);
                }
            } catch (e) {
                Utils.logger('error', Utils.getText('log_recovery_failed', e.message));
                setTimeout(() => location.reload(), 2000);
            }
        }, randomDelay);
    },

    refreshVisibleStates: async () => {
        const API_ENDPOINT = 'https://www.fab.com/i/users/me/listings-states';
        const API_CHUNK_SIZE = 24;

        const isElementInViewport = (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
        };

        try {
            const csrfToken = Utils.getCookie('fab_csrftoken');
            if (!csrfToken) {
                Utils.checkAuthentication();
                throw new Error('CSRF token not found. Are you logged in?');
            }

            const uidsFromVisibleCards = new Set([...document.querySelectorAll(Config.SELECTORS.card)]
                .filter(isElementInViewport)
                .filter(card => {
                    const link = card.querySelector(Config.SELECTORS.cardLink);
                    if (!link) return false;
                    const url = link.href.split('?')[0];
                    return !Database.isDone(url);
                })
                .map(card => card.querySelector(Config.SELECTORS.cardLink)?.href.match(/listings\/([a-f0-9-]+)/)?.[1])
                .filter(Boolean));

            const uidsFromFailedList = new Set(State.db.failed.map(task => task.uid));
            const allUidsToCheck = Array.from(new Set([...uidsFromVisibleCards, ...uidsFromFailedList]));

            if (allUidsToCheck.length === 0) {
                Utils.logger('info', Utils.getText('log_no_items_to_check'));
                return;
            }

            Utils.logger('debug', Utils.getText('log_checking_items', uidsFromVisibleCards.size, uidsFromFailedList.size));

            const ownedUids = new Set();
            for (let i = 0; i < allUidsToCheck.length; i += API_CHUNK_SIZE) {
                const chunk = allUidsToCheck.slice(i, i + API_CHUNK_SIZE);
                const apiUrl = new URL(API_ENDPOINT);
                chunk.forEach(uid => apiUrl.searchParams.append('listing_ids', uid));

                Utils.logger('debug', Utils.getText('log_processing_batch', Math.floor(i / API_CHUNK_SIZE) + 1, chunk.length));

                const response = await fetch(apiUrl.href, {
                    headers: { 'accept': 'application/json, text/plain, */*', 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                });

                if (!response.ok) {
                    Utils.logger('warn', Utils.getText('log_batch_failed', response.status));
                    continue;
                }

                const rawData = await response.json();
                const data = API.extractStateData(rawData, 'RefreshStates');

                if (!data || !Array.isArray(data)) {
                    Utils.logger('warn', Utils.getText('log_unexpected_data_format'));
                    continue;
                }

                data.filter(item => item.acquired).forEach(item => ownedUids.add(item.uid));

                if (allUidsToCheck.length > i + API_CHUNK_SIZE) {
                    await new Promise(r => setTimeout(r, 250));
                }
            }

            Utils.logger('info', Utils.getText('fab_dom_api_complete', ownedUids.size));

            let dbUpdated = false;
            const langPath = State.lang === 'zh' ? '/zh-cn' : '';

            if (ownedUids.size > 0) {
                const initialFailedCount = State.db.failed.length;
                State.db.failed = State.db.failed.filter(failedTask => !ownedUids.has(failedTask.uid));

                if (State.db.failed.length < initialFailedCount) {
                    dbUpdated = true;
                    ownedUids.forEach(uid => {
                        const url = `${window.location.origin}${langPath}/listings/${uid}`;
                        if (!Database.isDone(url)) {
                            State.db.done.push(url);
                        }
                    });
                    Utils.logger('info', Utils.getText('log_cleared_from_failed', initialFailedCount - State.db.failed.length));
                }
            }

            if (dbUpdated) {
                await Database.saveFailed();
                await Database.saveDone();
            }

            TaskRunner.runHideOrShow();

        } catch (e) {
            Utils.logger('error', Utils.getText('log_refresh_error'), e);
        }
    },

    retryFailedTasks: async () => {
        if (State.db.failed.length === 0) {
            Utils.logger('info', Utils.getText('log_no_failed_tasks'));
            return;
        }
        const count = State.db.failed.length;
        Utils.logger('info', Utils.getText('log_requeuing_tasks', count));
        State.db.todo.push(...State.db.failed);
        State.db.failed = [];
        await Database.saveFailed();
        Utils.logger('info', Utils.getText('log_tasks_moved', count));
        if (UI) UI.update();
    },

    runWatchdog: () => {
        if (State.watchdogTimer) clearInterval(State.watchdogTimer);

        State.watchdogTimer = setInterval(async () => {
            if (!InstanceManager.isActive) return;

            if (!State.isExecuting || Object.keys(State.runningWorkers).length === 0) {
                clearInterval(State.watchdogTimer);
                State.watchdogTimer = null;
                return;
            }

            const now = Date.now();
            const STALL_TIMEOUT = Config.WORKER_TIMEOUT;
            const stalledWorkers = [];

            for (const workerId in State.runningWorkers) {
                const workerInfo = State.runningWorkers[workerId];
                if (workerInfo.instanceId !== Config.INSTANCE_ID) continue;
                if (now - workerInfo.startTime > STALL_TIMEOUT) {
                    stalledWorkers.push({ workerId, task: workerInfo.task });
                }
            }

            if (stalledWorkers.length > 0) {
                Utils.logger('warn', Utils.getText('log_stalled_workers', stalledWorkers.length));

                for (const stalledWorker of stalledWorkers) {
                    const { workerId, task } = stalledWorker;
                    const workerInfo = State.runningWorkers[workerId];
                    const stallDuration = workerInfo ? ((Date.now() - workerInfo.startTime) / 1000).toFixed(2) : '未知';

                    Utils.logger('error', Utils.getText('log_watchdog_stalled', workerId.substring(0, 12)));

                    // 使用增强的 markAsFailed 记录详细信息
                    await Database.markAsFailed(task, {
                        reason: '工作线程超时 (Watchdog)',
                        logs: [`Worker ${workerId.substring(0, 12)} 超时`, `超时时长: ${stallDuration}s`],
                        details: {
                            workerId: workerId,
                            stallDuration: `${stallDuration}s`,
                            timeout: `${Config.WORKER_TIMEOUT / 1000}s`
                        }
                    });
                    State.executionFailedTasks++;

                    delete State.runningWorkers[workerId];
                    State.activeWorkers--;
                    await GM_deleteValue(workerId);
                }

                Utils.logger('info', Utils.getText('log_cleaned_workers', stalledWorkers.length, State.activeWorkers));
                if (UI) UI.update();

                setTimeout(() => {
                    if (State.isExecuting && State.activeWorkers < Config.MAX_CONCURRENT_WORKERS && State.db.todo.length > 0) {
                        TaskRunner.executeBatch();
                    }
                }, 2000);
            }
        }, 5000);
    },

    executeBatch: async () => {
        if (!Utils.checkAuthentication()) return;

        if (!State.isWorkerTab && !InstanceManager.isActive) {
            Utils.logger('warn', Utils.getText('log_not_active_instance'));
            return;
        }

        if (!State.isExecuting) return;

        if (State.isDispatchingTasks) {
            Utils.logger('info', Utils.getText('log_dispatching_in_progress'));
            return;
        }

        State.isDispatchingTasks = true;

        try {
            if (State.db.todo.length === 0 && State.activeWorkers === 0) {
                Utils.logger('info', Utils.getText('log_all_tasks_completed'));
                State.isExecuting = false;
                Database.saveExecutingState();
                Database.saveTodo();
                if (State.watchdogTimer) {
                    clearInterval(State.watchdogTimer);
                    State.watchdogTimer = null;
                }
                TaskRunner.closeAllWorkerTabs();
                if (UI) UI.update();
                State.isDispatchingTasks = false;
                return;
            }

            if (State.appStatus === 'RATE_LIMITED') {
                Utils.logger('info', Utils.getText('log_rate_limited_continue'));
            }

            if (State.activeWorkers >= Config.MAX_CONCURRENT_WORKERS) {
                Utils.logger('info', Utils.getText('log_max_workers_reached', Config.MAX_CONCURRENT_WORKERS));
                State.isDispatchingTasks = false;
                return;
            }

            const inFlightUIDs = new Set(Object.values(State.runningWorkers).map(w => w.task.uid));
            const todoList = [...State.db.todo];
            let dispatchedCount = 0;
            const dispatchedUIDs = new Set();

            for (const task of todoList) {
                if (State.activeWorkers >= Config.MAX_CONCURRENT_WORKERS) break;

                if (inFlightUIDs.has(task.uid) || dispatchedUIDs.has(task.uid)) {
                    Utils.logger('debug', Utils.getText('log_task_already_running', task.name));
                    continue;
                }

                if (Database.isDone(task.url)) {
                    Utils.logger('debug', Utils.getText('log_task_already_done', task.name));
                    State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
                    Database.saveTodo();
                    continue;
                }

                dispatchedUIDs.add(task.uid);
                State.activeWorkers++;
                dispatchedCount++;

                const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                State.runningWorkers[workerId] = {
                    task,
                    startTime: Date.now(),
                    instanceId: Config.INSTANCE_ID
                };

                Utils.logger('debug', Utils.getText('log_dispatching_worker', workerId.substring(0, 12), task.name));

                await GM_setValue(workerId, {
                    task,
                    instanceId: Config.INSTANCE_ID
                });

                const workerUrl = new URL(task.url);
                workerUrl.searchParams.set('workerId', workerId);

                GM_openInTab(workerUrl.href, { active: false, insert: true });
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (dispatchedCount > 0) {
                Utils.logger('debug', Utils.getText('log_batch_dispatched', dispatchedCount));
            }

            if (!State.watchdogTimer && State.activeWorkers > 0) {
                TaskRunner.runWatchdog();
            }

            if (UI) UI.update();
        } finally {
            State.isDispatchingTasks = false;
        }
    },

    closeAllWorkerTabs: () => {
        const workerIds = Object.keys(State.runningWorkers);
        if (workerIds.length > 0) {
            Utils.logger('debug', Utils.getText('log_cleaning_workers_state', workerIds.length));
            for (const workerId of workerIds) {
                GM_deleteValue(workerId);
            }
            State.runningWorkers = {};
            State.activeWorkers = 0;
            Utils.logger('info', Utils.getText('log_workers_cleaned'));
        }
    },

    processDetailPage: async () => {
        if (!Utils.checkAuthentication()) return;

        const urlParams = new URLSearchParams(window.location.search);
        const workerId = urlParams.get('workerId');

        if (!workerId) return;

        State.isWorkerTab = true;
        State.workerTaskId = workerId;

        const startTime = Date.now();
        let hasReported = false;
        let closeAttempted = false;
        let payload = null;

        const forceCloseTimer = setTimeout(() => {
            if (!closeAttempted) {
                console.log('强制关闭工作标签页');
                try { window.close(); } catch (e) { console.error('关闭工作标签页失败:', e); }
            }
        }, 60000);

        function closeWorkerTab() {
            closeAttempted = true;
            clearTimeout(forceCloseTimer);

            if (!hasReported && workerId) {
                try {
                    GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                        workerId: workerId,
                        success: false,
                        logs: [Utils.getText('worker_closed')],
                        task: payload?.task,
                        instanceId: payload?.instanceId,
                        executionTime: Date.now() - startTime
                    });
                } catch (e) { /* ignore */ }
            }

            try {
                window.close();
            } catch (error) {
                Utils.logger('error', Utils.getText('log_close_worker_failed', error.message));
                try { window.location.href = 'about:blank'; } catch (e) { /* ignore */ }
            }
        }

        try {
            payload = await GM_getValue(workerId);
            if (!payload || !payload.task) {
                Utils.logger('info', Utils.getText('log_task_data_cleaned'));
                closeWorkerTab();
                return;
            }

            const activeInstance = await GM_getValue('fab_active_instance', null);
            if (activeInstance && activeInstance.id !== payload.instanceId) {
                Utils.logger('warn', Utils.getText('log_instance_mismatch', payload.instanceId, activeInstance.id));
                await GM_deleteValue(workerId);
                closeWorkerTab();
                return;
            }

            const currentTask = payload.task;
            const logBuffer = [`[${workerId.substring(0, 12)}] Started: ${currentTask.name}`];
            let success = false;

            try {
                // 等待页面完全加载，使用多重检测机制
                const waitForPageReady = async () => {
                    const maxWait = 15000;
                    const startTime = Date.now();
                    let lastState = '';

                    while (Date.now() - startTime < maxWait) {
                        const currentState = document.readyState;
                        const hasMainContent = document.querySelector('main, .product-detail, [class*="listing"], [class*="detail"]');
                        const hasButtons = document.querySelectorAll('button').length > 0;
                        const hasTitle = document.querySelector('h1, .fabkit-Heading--xl');

                        if (currentState !== lastState) {
                            logBuffer.push(`页面状态: ${currentState}`);
                            lastState = currentState;
                        }

                        if (currentState === 'complete' && hasMainContent && (hasButtons || hasTitle)) {
                            logBuffer.push(`页面就绪检测通过: readyState=${currentState}, hasContent=true`);
                            return true;
                        }

                        await new Promise(r => setTimeout(r, 500));
                    }

                    logBuffer.push(`页面就绪检测超时 (${maxWait}ms)，继续尝试操作`);
                    return false;
                };

                const pageReady = await waitForPageReady();
                if (!pageReady) {
                    logBuffer.push(`⚠️ 警告: 页面可能未完全加载，这可能导致操作失败`);
                }

                // 额外等待以确保动态内容加载完成
                await new Promise(resolve => setTimeout(resolve, 2000));


                // Check for adult content warning
                const adultContentWarning = document.querySelector('.fabkit-Heading--xl');
                if (adultContentWarning && (adultContentWarning.textContent.includes('成人内容') ||
                    adultContentWarning.textContent.includes('Adult Content') ||
                    adultContentWarning.textContent.includes('Mature Content'))) {
                    logBuffer.push(`检测到成人内容警告对话框，自动点击"继续"按钮...`);
                    const continueButton = [...document.querySelectorAll('button.fabkit-Button--primary')].find(btn =>
                        btn.textContent.includes('继续') || btn.textContent.includes('Continue')
                    );
                    if (continueButton) {
                        Utils.deepClick(continueButton);
                        logBuffer.push(`已点击"继续"按钮，等待页面加载...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                // Page diagnostics
                logBuffer.push(`=== 页面状态诊断开始 ===`);
                const diagnosticReport = PageDiagnostics.diagnoseDetailPage();
                logBuffer.push(`页面标题: ${diagnosticReport.pageTitle}`);
                logBuffer.push(`可见按钮数量: ${diagnosticReport.buttons.filter(btn => btn.isVisible).length}`);
                logBuffer.push(`=== 页面状态诊断结束 ===`);

                // API-First Ownership Check
                try {
                    const csrfToken = Utils.getCookie('fab_csrftoken');
                    if (!csrfToken) throw new Error("CSRF token not found for API check.");

                    const statesUrl = new URL('https://www.fab.com/i/users/me/listings-states');
                    statesUrl.searchParams.append('listing_ids', currentTask.uid);

                    const response = await API.gmFetch({
                        method: 'GET',
                        url: statesUrl.href,
                        headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                    });

                    let statesData;
                    try {
                        statesData = JSON.parse(response.responseText);
                        if (!Array.isArray(statesData)) {
                            statesData = API.extractStateData(statesData, 'SingleItemCheck');
                        }
                    } catch (e) {
                        logBuffer.push(`解析API响应失败: ${e.message}`);
                        statesData = [];
                    }

                    const isOwned = Array.isArray(statesData) && statesData.some(s => s && s.uid === currentTask.uid && s.acquired);
                    if (isOwned) {
                        logBuffer.push(`API check confirms item is already owned.`);
                        success = true;
                    } else {
                        logBuffer.push(`API check confirms item is not owned. Proceeding to UI interaction.`);
                    }
                } catch (apiError) {
                    logBuffer.push(`API ownership check failed: ${apiError.message}. Falling back to UI-based check.`);
                }

                // UI-based acquisition if API check didn't confirm ownership
                if (!success) {
                    const isItemOwned = () => {
                        const criteria = Config.OWNED_SUCCESS_CRITERIA;
                        const snackbar = document.querySelector('.fabkit-Snackbar-root, div[class*="Toast-root"]');
                        if (snackbar && criteria.snackbarText.some(text => snackbar.textContent.includes(text))) {
                            return { owned: true, reason: `Snackbar text "${snackbar.textContent}"` };
                        }
                        const successHeader = document.querySelector('h2');
                        if (successHeader && criteria.h2Text.some(text => successHeader.textContent.includes(text))) {
                            return { owned: true, reason: `H2 text "${successHeader.textContent}"` };
                        }
                        const allButtons = [...document.querySelectorAll('button, a.fabkit-Button-root')];
                        const ownedButton = allButtons.find(btn => criteria.buttonTexts.some(keyword => btn.textContent.includes(keyword)));
                        if (ownedButton) return { owned: true, reason: `Button text "${ownedButton.textContent}"` };
                        return { owned: false };
                    };

                    const initialState = isItemOwned();
                    if (initialState.owned) {
                        logBuffer.push(`Item already owned on page load (UI Fallback PASS: ${initialState.reason}).`);
                        success = true;
                    } else {
                        // 记录所有可见按钮的文本，用于调试
                        const allVisibleButtons = [...document.querySelectorAll('button')].filter(btn => {
                            const rect = btn.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0;
                        });

                        logBuffer.push(`=== 按钮检测开始 (共 ${allVisibleButtons.length} 个可见按钮) ===`);
                        allVisibleButtons.slice(0, 15).forEach((btn, i) => {
                            const text = btn.textContent.trim().substring(0, 60);
                            logBuffer.push(`  按钮${i + 1}: "${text}"`);
                        });

                        // 检查是否需要选择许可证（多许可证商品）
                        const licenseButton = allVisibleButtons.find(btn =>
                            btn.textContent.includes('选择许可') ||
                            btn.textContent.includes('Select license')
                        );

                        if (licenseButton) {
                            logBuffer.push(`Multi-license item detected. Setting up observer for dropdown.`);
                            try {
                                await new Promise((resolve, reject) => {
                                    const observer = new MutationObserver((mutationsList) => {
                                        for (const mutation of mutationsList) {
                                            if (mutation.addedNodes.length > 0) {
                                                for (const node of mutation.addedNodes) {
                                                    if (node.nodeType !== 1) continue;
                                                    // 查找"免费"或"个人"选项
                                                    const freeTextElement = Array.from(node.querySelectorAll('span, div')).find(el =>
                                                        Array.from(el.childNodes).some(cn => {
                                                            if (cn.nodeType !== 3) return false;
                                                            const text = cn.textContent.trim();
                                                            return [...Config.FREE_TEXT_SET].some(freeWord => text === freeWord) ||
                                                                text === '个人' || text === 'Personal';
                                                        })
                                                    );

                                                    if (freeTextElement) {
                                                        const clickableParent = freeTextElement.closest('[role="option"], button, label, input[type="radio"]');
                                                        if (clickableParent) {
                                                            logBuffer.push(`Found free/personal license option, clicking it.`);
                                                            Utils.deepClick(clickableParent);
                                                            observer.disconnect();
                                                            resolve();
                                                            return;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    });

                                    observer.observe(document.body, { childList: true, subtree: true });
                                    logBuffer.push(`Clicking license button to open dropdown.`);
                                    Utils.deepClick(licenseButton);

                                    // 有时第一次点击可能不成功，1.5秒后再试一次
                                    setTimeout(() => {
                                        logBuffer.push(`Second attempt to click license button.`);
                                        Utils.deepClick(licenseButton);
                                    }, 1500);

                                    // 如果5秒内没有出现下拉菜单，则超时
                                    setTimeout(() => {
                                        observer.disconnect();
                                        reject(new Error('Timeout (5s): The free/personal option did not appear.'));
                                    }, 5000);
                                });

                                // 许可选择后等待UI更新
                                logBuffer.push(`License selected, waiting for UI update.`);
                                await new Promise(r => setTimeout(r, 2000)); // 增加等待时间

                                // 重新检查是否已拥有
                                if (isItemOwned().owned) {
                                    logBuffer.push(`Item became owned after license selection.`);
                                    success = true;
                                }
                            } catch (licenseError) {
                                logBuffer.push(`License selection failed: ${licenseError.message}`);
                            }
                        }

                        // 如果许可选择后仍未成功，或者不需要选择许可，尝试点击添加按钮
                        if (!success) {
                            // 重新查询页面按钮（许可选择后按钮可能已更新）
                            const freshButtons = [...document.querySelectorAll('button')].filter(btn => {
                                const rect = btn.getBoundingClientRect();
                                return rect.width > 0 && rect.height > 0;
                            });

                            logBuffer.push(`=== 重新检测按钮 (共 ${freshButtons.length} 个可见按钮) ===`);
                            freshButtons.slice(0, 10).forEach((btn, i) => {
                                const text = btn.textContent.trim().substring(0, 60);
                                logBuffer.push(`  按钮${i + 1}: "${text}"`);
                            });

                            // 首先尝试找标准的添加按钮 (大小写不敏感)
                            let actionButton = freshButtons.find(btn => {
                                const text = btn.textContent.toLowerCase();
                                return [...Config.ACQUISITION_TEXT_SET].some(keyword =>
                                    text.includes(keyword.toLowerCase())
                                );
                            });

                            // 如果没有标准添加按钮，检查是否是限时免费商品
                            if (!actionButton) {
                                // 查找包含"免费/Free"和"-100%"的按钮（限时免费商品的许可按钮）
                                actionButton = freshButtons.find(btn => {
                                    const text = btn.textContent;
                                    const hasFreeText = [...Config.FREE_TEXT_SET].some(freeWord => text.includes(freeWord));
                                    const hasDiscount = text.includes('-100%');
                                    const hasPersonal = text.includes('个人') || text.includes('Personal');
                                    return hasFreeText && hasDiscount && hasPersonal;
                                });

                                if (actionButton) {
                                    logBuffer.push(`Found limited-time free license button: "${actionButton.textContent.trim().substring(0, 50)}"`);
                                }
                            }

                            // 备用方案：查找包含 "add" 和 "library" 的按钮
                            if (!actionButton) {
                                actionButton = freshButtons.find(btn => {
                                    const text = btn.textContent.toLowerCase();
                                    return (text.includes('add') && text.includes('library')) ||
                                        (text.includes('添加') && text.includes('库'));
                                });
                                if (actionButton) {
                                    logBuffer.push(`通过备用方案找到按钮: "${actionButton.textContent.trim().substring(0, 50)}"`);
                                }
                            }

                            if (actionButton) {
                                logBuffer.push(`Found add button, clicking it.`);
                                Utils.deepClick(actionButton);

                                // 等待添加操作完成
                                try {
                                    await new Promise((resolve, reject) => {
                                        const timeout = 25000; // 25秒超时
                                        const interval = setInterval(() => {
                                            const currentState = isItemOwned();
                                            if (currentState.owned) {
                                                logBuffer.push(`Item became owned after clicking add button: ${currentState.reason}`);
                                                success = true;
                                                clearInterval(interval);
                                                resolve();
                                            }
                                        }, 500); // 每500ms检查一次

                                        setTimeout(() => {
                                            clearInterval(interval);
                                            reject(new Error(`Timeout waiting for page to enter an 'owned' state.`));
                                        }, timeout);
                                    });
                                } catch (timeoutError) {
                                    logBuffer.push(`Timeout waiting for ownership: ${timeoutError.message}`);
                                }
                            } else {
                                logBuffer.push(`Could not find an add button.`);
                            }
                        }
                    }
                }
            } catch (error) {
                logBuffer.push(`A critical error occurred: ${error.message}`);
                success = false;
            } finally {
                try {
                    hasReported = true;
                    await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                        workerId: workerId,
                        success: success,
                        logs: logBuffer,
                        task: currentTask,
                        instanceId: payload.instanceId,
                        executionTime: Date.now() - startTime
                    });
                } catch (error) {
                    console.error('Error setting worker done value:', error);
                }

                try {
                    await GM_deleteValue(workerId);
                } catch (error) {
                    console.error('Error deleting worker value:', error);
                }

                closeWorkerTab();
            }
        } catch (error) {
            Utils.logger('error', `Worker tab error: ${error.message}`);
            closeWorkerTab();
        }
    },

    runHideOrShow: () => {
        State.hiddenThisPageCount = 0;
        const cards = document.querySelectorAll(Config.SELECTORS.card);

        let actuallyHidden = 0;
        let hasUnsettledCards = false;
        const unsettledCards = [];

        const isCardSettled = (card) => {
            return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
        };

        cards.forEach(card => {
            if (!isCardSettled(card)) {
                hasUnsettledCards = true;
                unsettledCards.push(card);
            }
        });

        if (hasUnsettledCards && unsettledCards.length > 0) {
            Utils.logger('info', Utils.getText('log_unsettled_cards', unsettledCards.length));
            setTimeout(() => TaskRunner.runHideOrShow(), 2000);
            return;
        }

        const cardsToHide = [];

        cards.forEach(card => {
            const isProcessed = card.getAttribute('data-fab-processed') === 'true';

            if (isProcessed && card.style.display === 'none') {
                State.hiddenThisPageCount++;
                return;
            }

            const isFinished = TaskRunner.isCardFinished(card);
            if (State.hideSaved && isFinished) {
                cardsToHide.push(card);
                State.hiddenThisPageCount++;
                card.setAttribute('data-fab-processed', 'true');
            } else {
                card.setAttribute('data-fab-processed', 'true');
            }
        });

        if (cardsToHide.length > 0) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_prepare_hide', cardsToHide.length));
            }

            cardsToHide.sort(() => Math.random() - 0.5);

            const batchSize = 10;
            const batches = Math.ceil(cardsToHide.length / batchSize);
            const initialDelay = 1000;

            for (let i = 0; i < batches; i++) {
                const start = i * batchSize;
                const end = Math.min(start + batchSize, cardsToHide.length);
                const currentBatch = cardsToHide.slice(start, end);
                const batchDelay = initialDelay + i * 300 + Math.random() * 300;

                setTimeout(() => {
                    currentBatch.forEach((card, index) => {
                        const cardDelay = index * 50 + Math.random() * 100;
                        setTimeout(() => {
                            card.style.display = 'none';
                            actuallyHidden++;
                            if (actuallyHidden === cardsToHide.length) {
                                if (State.debugMode) {
                                    Utils.logger('debug', Utils.getText('debug_hide_completed', actuallyHidden));
                                }
                                setTimeout(() => {
                                    if (UI) UI.update();
                                    TaskRunner.checkVisibilityAndRefresh();
                                }, 300);
                            }
                        }, cardDelay);
                    });
                }, batchDelay);
            }
        }

        if (State.hideSaved) {
            const visibleCards = Array.from(cards).filter(card => !TaskRunner.isCardFinished(card));
            visibleCards.forEach(card => { card.style.display = ''; });

            if (cardsToHide.length === 0) {
                if (UI) UI.update();
                TaskRunner.checkVisibilityAndRefresh();
            }
        } else {
            cards.forEach(card => { card.style.display = ''; });
            if (UI) UI.update();
        }
    },

    checkVisibilityAndRefresh: () => {
        const cards = document.querySelectorAll(Config.SELECTORS.card);

        let needsReprocessing = false;
        cards.forEach(card => {
            const isProcessed = card.getAttribute('data-fab-processed') === 'true';
            if (!isProcessed) needsReprocessing = true;
        });

        if (needsReprocessing) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_unprocessed_cards_simple'));
            }
            setTimeout(() => TaskRunner.runHideOrShow(), 100);
            return;
        }

        const visibleCards = Array.from(cards).filter(card => {
            if (card.style.display === 'none') return false;
            const computedStyle = window.getComputedStyle(card);
            return computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
        }).length;

        if (State.debugMode) {
            Utils.logger('debug', Utils.getText('debug_visible_after_hide', visibleCards, State.hiddenThisPageCount));
        }

        const visibleCountElement = document.getElementById('fab-status-visible');
        if (visibleCountElement) {
            visibleCountElement.textContent = visibleCards.toString();
        }

        if (visibleCards === 0) {
            if (State.appStatus === 'RATE_LIMITED' && State.autoRefreshEmptyPage) {
                if (State.isRefreshScheduled) {
                    Utils.logger('info', Utils.getText('refresh_plan_exists'));
                    return;
                }
                Utils.logger('info', Utils.getText('log_all_hidden_rate_limited'));
                State.isRefreshScheduled = true;

                setTimeout(() => {
                    const currentVisibleCards = Array.from(document.querySelectorAll(Config.SELECTORS.card))
                        .filter(card => card.style.display !== 'none').length;

                    if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                        Utils.logger('info', Utils.getText('log_refresh_cancelled_tasks', State.db.todo.length, State.activeWorkers));
                        State.isRefreshScheduled = false;
                        return;
                    }

                    if (currentVisibleCards === 0 && State.appStatus === 'RATE_LIMITED' && State.autoRefreshEmptyPage) {
                        Utils.logger('info', Utils.getText('log_refreshing'));
                        window.location.href = window.location.href;
                    } else {
                        Utils.logger('info', Utils.getText('log_refresh_cancelled_visible', currentVisibleCards));
                        State.isRefreshScheduled = false;
                    }
                }, 2000);
            } else if (State.appStatus === 'NORMAL' && State.hiddenThisPageCount > 0) {
                Utils.logger('debug', Utils.getText('page_status_hidden_no_visible', State.hiddenThisPageCount));
            }
        }
    },

    ensureTasksAreExecuted: () => {
        if (State.db.todo.length === 0) return;

        if (State.isExecuting) {
            if (State.activeWorkers === 0) {
                Utils.logger('info', Utils.getText('log_ensure_tasks'));
                TaskRunner.executeBatch();
            }
            return;
        }

        Utils.logger('info', Utils.getText('log_auto_start_execution', State.db.todo.length));
        TaskRunner.startExecution();
    },

    checkVisibleCardsStatus: async () => {
        try {
            const visibleCards = [...document.querySelectorAll(Config.SELECTORS.card)];

            if (visibleCards.length === 0) {
                Utils.logger('info', Utils.getText('log_no_visible_cards'));
                return;
            }

            let hasUnsettledCards = false;
            const unsettledCards = [];

            const isCardSettled = (card) => {
                return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
            };

            visibleCards.forEach(card => {
                if (!isCardSettled(card)) {
                    hasUnsettledCards = true;
                    unsettledCards.push(card);
                }
            });

            if (hasUnsettledCards && unsettledCards.length > 0) {
                Utils.logger('info', Utils.getText('log_waiting_for_cards', unsettledCards.length));
                await new Promise(resolve => setTimeout(resolve, 3000));
                return TaskRunner.checkVisibleCardsStatus();
            }

            const allItems = [];
            let confirmedOwned = 0;

            visibleCards.forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const uidMatch = link?.href.match(/listings\/([a-f0-9-]+)/);

                if (uidMatch && uidMatch[1]) {
                    const uid = uidMatch[1];
                    const url = link.href.split('?')[0];

                    if (State.db.done.includes(url)) return;
                    allItems.push({ uid, url, element: card });
                }
            });

            if (allItems.length === 0) {
                Utils.logger('debug', Utils.getText('debug_no_cards_to_check'));
                return;
            }

            Utils.logger('info', Utils.getText('fab_dom_checking_status', allItems.length));

            const uids = allItems.map(item => item.uid);
            const statesData = await API.checkItemsOwnership(uids);

            const ownedUids = new Set(
                statesData
                    .filter(state => state && state.acquired)
                    .map(state => state.uid)
            );

            for (const item of allItems) {
                if (ownedUids.has(item.uid)) {
                    if (!State.db.done.includes(item.url)) {
                        State.db.done.push(item.url);
                        confirmedOwned++;
                    }
                    State.db.failed = State.db.failed.filter(f => f.uid !== item.uid);
                    State.db.todo = State.db.todo.filter(t => t.uid !== item.uid);
                }
            }

            if (confirmedOwned > 0) {
                await Database.saveDone();
                await Database.saveFailed();
                Utils.logger('info', Utils.getText('fab_dom_api_complete', confirmedOwned));
                Utils.logger('info', Utils.getText('fab_dom_refresh_complete', confirmedOwned));
            } else {
                Utils.logger('debug', Utils.getText('fab_dom_no_new_owned'));
            }
        } catch (error) {
            Utils.logger('error', Utils.getText('log_check_status_error', error.message));
            if (error.message && error.message.includes('429')) {
                RateLimitManager.enterRateLimitedState('[Fab DOM Refresh] 429错误');
            }
        }
    },

    scanAndAddTasks: async (cards) => {
        if (!State.autoAddOnScroll) return;

        // 防止并发调用
        if (State.isScanningTasks) {
            Utils.logger('debug', `已有扫描任务进行中，跳过本次调用 (${cards.length} 张卡片)`);
            return;
        }

        State.isScanningTasks = true;

        try {
            if (!window._apiWaitStatus) {
                window._apiWaitStatus = {
                    isWaiting: false,
                    pendingCards: [],
                    lastApiActivity: 0,
                    apiCheckInterval: null
                };
            }

            if (window._apiWaitStatus.isWaiting) {
                window._apiWaitStatus.pendingCards = [...window._apiWaitStatus.pendingCards, ...cards];
                Utils.logger('info', Utils.getText('debug_api_wait_in_progress', cards.length));
                return;
            }

            window._apiWaitStatus.isWaiting = true;
            window._apiWaitStatus.pendingCards = [...cards];
            window._apiWaitStatus.lastApiActivity = Date.now();

            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_wait_api_response', cards.length));
            }

            const waitForApiCompletion = () => {
                return new Promise((resolve) => {
                    if (window._apiWaitStatus.apiCheckInterval) {
                        clearInterval(window._apiWaitStatus.apiCheckInterval);
                    }

                    const maxWaitTime = 10000;
                    const startTime = Date.now();

                    const originalFetch = window.fetch;
                    window.fetch = function (...args) {
                        const url = args[0]?.toString() || '';
                        if (url.includes('/listings-states') || url.includes('/listings/search')) {
                            window._apiWaitStatus.lastApiActivity = Date.now();
                        }
                        return originalFetch.apply(this, args);
                    };

                    window._apiWaitStatus.apiCheckInterval = setInterval(() => {
                        const now = Date.now();
                        const timeSinceLastActivity = now - window._apiWaitStatus.lastApiActivity;
                        const totalWaitTime = now - startTime;

                        if (totalWaitTime > maxWaitTime || timeSinceLastActivity > 2000) {
                            clearInterval(window._apiWaitStatus.apiCheckInterval);
                            window.fetch = originalFetch;
                            resolve();
                        }
                    }, 200);
                });
            };

            try {
                await waitForApiCompletion();
            } catch (error) {
                Utils.logger('error', Utils.getText('auto_add_api_error', error.message));
            }

            const cardsToProcess = [...window._apiWaitStatus.pendingCards];
            window._apiWaitStatus.pendingCards = [];
            window._apiWaitStatus.isWaiting = false;

            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_api_wait_complete', cardsToProcess.length));
            }

            const newlyAddedList = [];
            let skippedAlreadyOwned = 0;
            let skippedInTodo = 0;

            cardsToProcess.forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const url = link ? link.href.split('?')[0] : null;
                if (!url) return;

                if (Database.isDone(url)) {
                    skippedAlreadyOwned++;
                    return;
                }

                if (Database.isTodo(url)) {
                    skippedInTodo++;
                    return;
                }

                const text = card.textContent || '';
                if (text.includes("已保存在我的库中") ||
                    text.includes("已保存") ||
                    text.includes("Saved to My Library") ||
                    text.includes("In your library")) {
                    skippedAlreadyOwned++;
                    return;
                }

                const icons = card.querySelectorAll('i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled');
                if (icons.length > 0) {
                    skippedAlreadyOwned++;
                    return;
                }

                const uidMatch = url.match(/listings\/([a-f0-9-]+)/);
                if (uidMatch && uidMatch[1]) {
                    const uid = uidMatch[1];
                    if (DataCache.ownedStatus.has(uid)) {
                        const status = DataCache.ownedStatus.get(uid);
                        if (status && status.acquired) {
                            skippedAlreadyOwned++;
                            return;
                        }
                    }
                }

                if (!TaskRunner.isFreeCard(card)) return;

                const name = card.querySelector('a[aria-label*="创作的"], a[aria-label*="by "]')?.textContent.trim() ||
                    card.querySelector('a[href*="/listings/"]')?.textContent.trim() ||
                    Utils.getText('untitled');
                newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
            });

            if (newlyAddedList.length > 0 || skippedAlreadyOwned > 0 || skippedInTodo > 0) {
                if (newlyAddedList.length > 0) {
                    // 严格去重：使用 uid 和 url 双重检查，防止重复添加
                    const existingUids = new Set(State.db.todo.map(t => t.uid));
                    const existingUrls = new Set(State.db.todo.map(t => t.url.split('?')[0]));

                    const uniqueNewTasks = newlyAddedList.filter(task => {
                        const cleanUrl = task.url.split('?')[0];
                        const isDuplicate = existingUids.has(task.uid) || existingUrls.has(cleanUrl);
                        if (isDuplicate) {
                            Utils.logger('debug', `跳过重复任务: ${task.name} (uid: ${task.uid})`);
                        }
                        return !isDuplicate;
                    });

                    if (uniqueNewTasks.length > 0) {
                        State.db.todo.push(...uniqueNewTasks);
                        Utils.logger('info', Utils.getText('auto_add_new_tasks', uniqueNewTasks.length));
                        if (uniqueNewTasks.length < newlyAddedList.length) {
                            Utils.logger('debug', `过滤了 ${newlyAddedList.length - uniqueNewTasks.length} 个重复任务`);
                        }
                        Database.saveTodo();
                    } else {
                        Utils.logger('debug', `所有 ${newlyAddedList.length} 个任务都是重复的，已跳过`);
                    }
                }

                if (skippedAlreadyOwned > 0 || skippedInTodo > 0) {
                    Utils.logger('debug', Utils.getText('debug_filter_owned', skippedAlreadyOwned, skippedInTodo));
                }

                if (State.isExecuting) {
                    State.executionTotalTasks = State.db.todo.length;
                    TaskRunner.executeBatch();
                } else if (State.autoAddOnScroll) {
                    TaskRunner.startExecution();
                }

                if (UI) UI.update();
            }
        } finally {
            // 确保扫描锁被释放
            State.isScanningTasks = false;
        }
    },

    handleRateLimit: async (url) => {
        await RateLimitManager.enterRateLimitedState(url || '网络请求');
    },

    reportTaskDone: async (task, success) => {
        try {
            await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                workerId: `worker_task_${task.uid}`,
                success: success,
                logs: [Utils.getText('task_report', success ? Utils.getText('task_success') : Utils.getText('task_failed'), task.name || task.uid)],
                task: task,
                instanceId: Config.INSTANCE_ID,
                executionTime: 0
            });
            Utils.logger('info', Utils.getText('task_report', success ? Utils.getText('task_success') : Utils.getText('task_failed'), task.name || task.uid));
        } catch (error) {
            Utils.logger('error', Utils.getText('log_report_error', error.message));
        }
    }
};
