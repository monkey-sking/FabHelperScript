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
import { KeepAlive } from './keepalive.js';

// Forward declaration for UI (will be set via dependency injection)
let UI = null;
let countdownRefresh = null;

export function setUIReference(uiModule) {
    UI = uiModule;
}

export function setDependencies(deps = {}) {
    countdownRefresh = deps.countdownRefresh || countdownRefresh;
}

export const TaskRunner = {
    findFreeLicenseOption: (root) => {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return null;
        }

        const candidates = Array.from(root.querySelectorAll('span, div'))
            .map(el => {
                const text = Utils.normalizeWhitespace(el.textContent || '');
                const clickTarget = el.closest('[role="option"], button, label, input[type="radio"]');
                return { text, clickTarget };
            })
            .filter(candidate => candidate.text && candidate.clickTarget);

        const hasExplicitFreeSignal = (text) => {
            const cleanText = text.replace(/royalty\s*-?\s*free/gi, '');
            return [...Config.FREE_TEXT_SET].some(freeWord => cleanText.includes(freeWord));
        };

        const explicitFree = candidates.find(candidate => hasExplicitFreeSignal(candidate.text));
        if (explicitFree) {
            return explicitFree.clickTarget;
        }

        const personalFree = candidates.find(candidate => {
            const isPersonal = candidate.text.includes('个人') || candidate.text.includes('Personal');
            return isPersonal && hasExplicitFreeSignal(candidate.text);
        });

        return personalFree ? personalFree.clickTarget : null;
    },

    getExternalProductState: (root = document) => {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return { handled: false };
        }

        const currentHref = (typeof window !== 'undefined' && window.location?.href)
            ? window.location.href
            : 'https://www.fab.com/';
        const currentHostname = (typeof window !== 'undefined' && window.location?.hostname)
            ? window.location.hostname
            : 'www.fab.com';
        const links = [...root.querySelectorAll('a[href]')];
        const externalLink = links.find(link => {
            const text = Utils.normalizeWhitespace(link.textContent || '');
            if (!text || ![...Config.EXTERNAL_CTA_TEXT_SET].some(label => text.includes(label))) {
                return false;
            }

            const rect = typeof link.getBoundingClientRect === 'function'
                ? link.getBoundingClientRect()
                : { width: 1, height: 1 };
            if (rect.width === 0 || rect.height === 0) {
                return false;
            }

            try {
                const href = link.href || link.getAttribute?.('href');
                if (!href) return false;
                const targetUrl = new URL(href, currentHref);
                return targetUrl.hostname !== currentHostname;
            } catch (error) {
                return false;
            }
        });

        if (!externalLink) {
            return { handled: false };
        }

        const text = Utils.normalizeWhitespace(externalLink.textContent || '');
        return {
            handled: true,
            reason: `External CTA "${text}"`,
            href: externalLink.href || externalLink.getAttribute?.('href') || ''
        };
    },

    hasSavedLibraryText: (card) => {
        const cardText = Utils.normalizeWhitespace(card.textContent || '');
        return [...Config.SAVED_TEXT_SET].some(savedText => cardText.includes(savedText));
    },

    hasPositivePriceText: (text) => {
        const priceMatches = Utils.normalizeWhitespace(text || '').match(/\$\s*(\d+(?:\.\d{2})?)/g);
        if (!priceMatches) return false;

        return priceMatches.some(priceStr => {
            const numValue = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
            return numValue > 0.00;
        });
    },

    isCardSettled: (card) => {
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const url = link ? link.href.split('?')[0] : null;

        return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null ||
            TaskRunner.hasSavedLibraryText(card) ||
            TaskRunner.isFreeCard(card) ||
            TaskRunner.hasPositivePriceText(card.textContent || '') ||
            (url && (Database.isDone(url) || Database.isFailed(url) || State.sessionCompleted.has(Database.normalizeListingUrl(url))));
    },

    // Check if a card is finished (owned, done, or failed)
    isCardFinished: (card) => {
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const url = link ? link.href.split('?')[0] : null;
        const hasSavedText = TaskRunner.hasSavedLibraryText(card);

        if (!link) {
            const icons = card.querySelectorAll('i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled');
            if (icons.length > 0) return true;

            return hasSavedText;
        }

        const uidMatch = link.href.match(/listings\/([a-f0-9-]+)/);
        if (!uidMatch || !uidMatch[1]) return false;

        const uid = uidMatch[1];

        if (DataCache.ownedStatus.has(uid)) {
            const status = DataCache.ownedStatus.get(uid);
            if (status && status.acquired) return true;
        }

        if (card.querySelector(Config.SELECTORS.ownedStatus) !== null || hasSavedText) {
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
            if (State.sessionCompleted.has(Database.normalizeListingUrl(url))) return true;
        }

        return false;
    },

    // Check if a card represents a free item
    isFreeCard: (card) => {
        const rawText = card.textContent || '';
        const cardText = Utils.normalizeWhitespace(rawText);

        const cleanText = cardText.replace(/royalty\s*-?\s*free/gi, '');

        // 1. Check for explicit keywords
        const hasFreeKeyword = [...Config.FREE_TEXT_SET].some(freeWord => cleanText.includes(freeWord));

        // 2. Check for -100% discount (handles various spacings like -100%, - 100%, -100 % etc.)
        const has100PercentDiscount = /-\s*100\s*%\s*(?:OFF|折扣)?/i.test(cleanText);

        // Extract all price-like strings (e.g. $1.99, $0.00)
        // Using a more robust regex that catches price formats
        const hasPositivePrice = TaskRunner.hasPositivePriceText(cardText);

        if (hasPositivePrice) {
            // STRICT RULE: If there is a price > 0, it is PAID, UNLESS:
            // 1. There is a -100% discount tag, OR
            // 2. There is also a "Free" keyword present (mixed license: e.g. Personal=$X, Professional=Free)
            // This overrides any non-license "Free" keyword (like "Royalty Free" or "Hassle Free").
            if (!has100PercentDiscount && !hasFreeKeyword) {
                return false;
            }
        }

        // If no positive price found (or it's discounted to free), check for keywords
        return hasFreeKeyword || has100PercentDiscount;
    },

    // Check if a card is a discounted paid item
    isDiscountedPaidCard: (card) => {
        if (TaskRunner.isFreeCard(card)) return false; // If it's free, it's not a "discounted paid" item

        const rawText = card.textContent || '';
        const cardText = Utils.normalizeWhitespace(rawText);
        // Look for -XX% pattern or "Save"/"Off" with percentage
        const hasDiscountTag = /-\d+%/.test(cardText) || cardText.includes('% off') || cardText.includes('% Off');

        // Also check simplified "Save $X" if need be, but percentage is standard on Fab
        // For now, stick to percentage to avoid false positives

        if (!hasDiscountTag) return false;

        // Double check positive price
        return TaskRunner.hasPositivePriceText(cardText);
    },

    // Toggle execution state
    toggleExecution: async () => {
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

        // 在启动任务之前再次硬校验服务端 session，避免 cookie 还在但 session 已过期时
        // 把所有商品当作免费空跑（未登录态卡片上拿不到价格信息）。
        const sessionOk = await Utils.verifyServerSession();
        if (!sessionOk) {
            Utils.notifyAuthFailure();
            return;
        }

        if (State.autoAddOnScroll) {
            Utils.logger('info', Utils.getText('log_auto_add_enabled'));
            // 启动前先强制扫描一次当前可见卡片
            Utils.logger('debug', '启动任务前正在确认当前页面商品识别状态...');
            TaskRunner.checkVisibleCardsStatus().then(() => {
                Utils.logger('debug', '正在扫描当前页面符合条件的商品...');
                TaskRunner.scanAndAddTasks(document.querySelectorAll(TaskRunner.getVisibleCardSelector())).then(() => {
                    TaskRunner.startExecution();
                });
            });
            return;
        }

        State.db.todo = [];
        Utils.logger('info', Utils.getText('log_todo_cleared'));

        Utils.logger('debug', Utils.getText('log_scanning_items'));
        const cards = document.querySelectorAll(TaskRunner.getVisibleCardSelector());
        const newlyAddedList = [];
        let alreadyInQueueCount = 0;
        let ownedCount = 0;
        let skippedCount = 0;

        cards.forEach(card => {
            if (TaskRunner.isCardHidden(card)) return;
            if (!TaskRunner.isCardSettled(card)) {
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

        // 强制激活当前实例，确保多标签页环境下由用户操作的标签页接管
        if (typeof InstanceManager !== 'undefined' && InstanceManager.activate) {
            InstanceManager.activate();
        }

        // 启动后台保活：让本标签页在最小化/锁屏/切后台时仍能持续派发任务
        KeepAlive.start();

        State.isExecuting = true;
        Database.saveExecutingState();
        State.executionTotalTasks = State.db.todo.length;
        State.executionCompletedTasks = 0;
        State.executionFailedTasks = 0;
        State.autoScrollAttempts = 0; // Reset scroll attempts

        if (UI) UI.update();
        TaskRunner.executeBatch();
    },

    // Toggle hide saved items
    toggleHideSaved: async () => {
        State.hideSaved = !State.hideSaved;
        await Database.saveHidePref();
        TaskRunner.runHideOrShow();

        if (!State.hideSaved) {
            const { visible: actualVisibleCount } = TaskRunner.getCardCounts(true);
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

    toggleHideDiscountedPaid: async () => {
        State.hideDiscountedPaid = !State.hideDiscountedPaid;
        await Database.saveHideDiscountedPref();
        TaskRunner.runHideOrShow();

        if (State.hideDiscountedPaid) {
            Utils.logger('info', '已开启隐藏打折付费商品');
        } else {
            Utils.logger('info', '已关闭隐藏打折付费商品');
        }

        if (UI) UI.update();
    },

    toggleHidePaid: async () => {
        State.hidePaid = !State.hidePaid;
        await Database.saveHidePaidPref();
        TaskRunner.runHideOrShow();

        if (State.hidePaid) {
            Utils.logger('info', '已开启隐藏付费商品');
        } else {
            Utils.logger('info', '已关闭隐藏付费商品');
        }

        if (UI) UI.update();
    },

    toggleBlockResources: async () => {
        State.blockLargeResources = !State.blockLargeResources;
        await Database.saveBlockResourcesPref();

        if (State.blockLargeResources) {
            Utils.logger('info', '已开启工作标签页大资源过滤');
        } else {
            Utils.logger('info', '已关闭工作标签页大资源过滤');
        }

        if (UI) UI.update();
    },

    stop: () => {
        if (!State.isExecuting) return;
        State.isExecuting = false;
        Database.saveExecutingState();
        Database.saveTodo();
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

            const uidsFromVisibleCards = new Set([...document.querySelectorAll(TaskRunner.getVisibleCardSelector())]
                .filter(isElementInViewport)
                .filter(card => {
                    const link = card.querySelector(Config.SELECTORS.cardLink);
                    if (!link) return false;
                    const url = link.href.split('?')[0];
                    // Only check status for items that are NOT done AND are detected as free.
                    // This prevents infinite looping on paid items like the $1.99 one.
                    // Also skip items that are already in the TODO queue to prevent redundant checks/logs while processing.
                    return !Database.isDone(url) && !Database.isTodo(url) && TaskRunner.isFreeCard(card);
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

            Utils.logger('debug', Utils.getText('fab_dom_api_complete', ownedUids.size));

            let dbUpdated = false;
            const langPath = State.lang === 'zh' ? '/zh-cn' : '';

            if (ownedUids.size > 0) {
                const initialFailedCount = State.db.failed.length;
                State.db.failed = State.db.failed.filter(failedTask => !ownedUids.has(failedTask.uid));

                if (State.db.failed.length < initialFailedCount) {
                    dbUpdated = true;
                    ownedUids.forEach(uid => {
                        const url = `${window.location.origin}${langPath}/listings/${uid}`;
                        Database.addDoneUrl(url);
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

    // 检查并清理超时(卡死)的 worker。被 watchdog 定时器与后台心跳(KeepAlive)共同调用。
    // 抽成独立方法，是为了让主线程定时器被后台节流时，心跳也能驱动这套清理。
    // 返回被清理的 worker 数量。
    checkStalledWorkers: async () => {
        if (!State.isExecuting) return 0;

        const now = Date.now();
        const STALL_TIMEOUT = Config.WORKER_TIMEOUT;
        const stalledWorkers = [];

        for (const workerId in State.runningWorkers) {
            const workerInfo = State.runningWorkers[workerId];
            if (!workerInfo) continue;
            if (workerInfo.instanceId !== Config.INSTANCE_ID) continue;
            if (now - workerInfo.startTime > STALL_TIMEOUT) {
                stalledWorkers.push({ workerId, task: workerInfo.task });
            }
        }

        if (stalledWorkers.length === 0) return 0;

        Utils.logger('warn', Utils.getText('log_stalled_workers', stalledWorkers.length));

        for (const stalledWorker of stalledWorkers) {
            const { workerId, task } = stalledWorker;
            const workerInfo = State.runningWorkers[workerId];
            const stallDuration = workerInfo ? ((Date.now() - workerInfo.startTime) / 1000).toFixed(2) : '未知';

            Utils.logger('error', Utils.getText('log_watchdog_stalled', workerId.substring(0, 12)));

            // 使用增强的 markAsFailed 记录详细信息
            const _failRes = await Database.markAsFailed(task, {
                reason: '工作线程超时 (Watchdog)',
                logs: [`Worker ${workerId.substring(0, 12)} 超时`, `超时时长: ${stallDuration}s`],
                details: {
                    workerId: workerId,
                    stallDuration: `${stallDuration}s`,
                    timeout: `${Config.WORKER_TIMEOUT / 1000}s`
                }
            });
            if (!_failRes || !_failRes.retried) State.executionFailedTasks++;

            delete State.runningWorkers[workerId];
            State.activeWorkers = Math.max(0, State.activeWorkers - 1);
            await GM_deleteValue(workerId);
        }

        Utils.logger('info', Utils.getText('log_cleaned_workers', stalledWorkers.length, State.activeWorkers));
        if (UI) UI.update();
        return stalledWorkers.length;
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

            const cleaned = await TaskRunner.checkStalledWorkers();
            if (cleaned > 0) {
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
            Utils.logger('debug', 'Task dispatching already in progress, skipping executeBatch.');
            return;
        }

        State.isDispatchingTasks = true;

        try {
            if (State.db.todo.length === 0 && State.activeWorkers === 0) {
                if (State.autoAddOnScroll) {
                    State.isDispatchingTasks = false;
                    TaskRunner.attemptAutoScroll();
                    return;
                }
                await TaskRunner.stopExecutionAndSettle();
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
            const slotsAvailable = Config.MAX_CONCURRENT_WORKERS - State.activeWorkers;

            const tasksToDispatch = [];
            for (const task of todoList) {
                if (tasksToDispatch.length >= slotsAvailable) break;

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

                tasksToDispatch.push(task);
            }

            for (const task of tasksToDispatch) {
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

                const workerUrl = new URL(task.url);
                workerUrl.searchParams.set('workerId', workerId);

                await GM_setValue(workerId, {
                    task,
                    instanceId: Config.INSTANCE_ID
                });

                GM_openInTab(workerUrl.href, { active: false, insert: true });
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

        // worker 自身的超时兜底：略早于 manager 的 watchdog(WORKER_TIMEOUT)触发，
        // 让 worker 先主动上报失败(带真实耗时)再关闭，而不是被 watchdog 远程判死。
        const forceCloseTimer = setTimeout(() => {
            if (!closeAttempted) {
                console.log('工作标签页超时，主动上报并关闭');
                closeWorkerTab();
            }
        }, Math.max(10000, Config.WORKER_TIMEOUT - 5000));

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

                // --- 404 / 商品已下架检测 ---
                // "Sorry, we couldn't find that page" 页面同样会通过 waitForPageReady，
                // 若不提前识别会白白等待超时（15s+）后再上报失败。
                // 检测到 404 后标记为 done（跳过）并立即关闭，不计入失败。
                const is404Page = (() => {
                    const bodyText = document.body ? document.body.textContent : '';
                    const title = document.title || '';
                    const h1 = document.querySelector('h1');
                    const h1Text = h1 ? h1.textContent : '';
                    const NOT_FOUND_PHRASES = [
                        "Sorry, we couldn't find that page",
                        "抱歉，找不到该页面",
                        "找不到该页面",
                        "Page not found",
                        "404",
                    ];
                    return NOT_FOUND_PHRASES.some(phrase =>
                        bodyText.includes(phrase) || title.includes(phrase) || h1Text.includes(phrase)
                    );
                })();

                if (is404Page) {
                    logBuffer.push(`⚠️ 检测到 404 页面（商品已下架或不存在），标记为已跳过并关闭。`);
                    success = true; // 不计入失败，加入 done 列表
                    hasReported = true;
                    GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                        workerId,
                        success: true,
                        logs: [...logBuffer, '商品不存在 (404)，已自动跳过'],
                        task: currentTask,
                        instanceId: payload.instanceId,
                        executionTime: Date.now() - startTime
                    });
                    closeWorkerTab();
                    return;
                }

                // 等待关键 UI 元素出现（领取按钮 / 已保存指示器 / 外部 CTA），
                // 最长 2000ms 保留旧行为上限；如果元素已经在 DOM 上则立即继续。
                // 之前这里是无条件 setTimeout(2000)，是单任务耗时的主要来源。
                await (function waitForKeyElement(maxWait = 2000) {
                    const matchKey = () => {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            const t = Utils.normalizeWhitespace(btn.textContent || '');
                            if (!t) continue;
                            if (Config.ACQUISITION_TEXT_SET.has(t)) return true;
                            if (Config.SAVED_TEXT_SET.has(t)) return true;
                            if (Config.EXTERNAL_CTA_TEXT_SET.has(t)) return true;
                        }
                        const bodyText = document.body && document.body.textContent;
                        if (bodyText) {
                            for (const phrase of Config.SAVED_TEXT_SET) {
                                if (bodyText.includes(phrase)) return true;
                            }
                        }
                        return false;
                    };
                    if (matchKey()) return Promise.resolve();
                    return new Promise(resolve => {
                        let done = false;
                        const finish = () => {
                            if (done) return;
                            done = true;
                            try { observer.disconnect(); } catch (e) { }
                            clearTimeout(timer);
                            resolve();
                        };
                        const observer = new MutationObserver(() => {
                            if (matchKey()) finish();
                        });
                        observer.observe(document.body, { childList: true, subtree: true });
                        const timer = setTimeout(finish, maxWait);
                    });
                })();


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
                        const externalState = TaskRunner.getExternalProductState(document);
                        if (externalState.handled) {
                            logBuffer.push(`Detected non-purchasable external listing (${externalState.reason}). Marking task as handled.`);
                            success = true;
                        }
                    }

                    if (!success) {
                        // 记录关键按钮的文本，减少噪音
                        const allVisibleButtons = [...document.querySelectorAll('button')].filter(btn => {
                            const rect = btn.getBoundingClientRect();
                            const text = btn.textContent.trim();
                            return rect.width > 0 && rect.height > 0 && text.length > 0;
                        });

                        const criticalKeywords = [...Config.ACQUISITION_TEXT_SET, ...Config.FREE_TEXT_SET, '许可', 'License', 'Select', '选择', 'Add', '添加', 'Library', '库'];
                        const criticalButtons = allVisibleButtons.filter(btn => {
                            const text = btn.textContent;
                            return criticalKeywords.some(key => text.includes(key));
                        });

                        logBuffer.push(`=== 按钮检测: 可见=${allVisibleButtons.length}, 关键=${criticalButtons.length} ===`);
                        if (criticalButtons.length > 0) {
                            criticalButtons.slice(0, 5).forEach((btn, i) => {
                                logBuffer.push(`  关键按钮${i + 1}: "${btn.textContent.trim().substring(0, 40)}"`);
                            });
                        } else if (allVisibleButtons.length > 0) {
                            allVisibleButtons.slice(0, 3).forEach((btn, i) => {
                                logBuffer.push(`  按钮${i + 1}: "${btn.textContent.trim().substring(0, 40)}"`);
                            });
                        }

                        // 检查是否需要选择许可证（多许可证商品）
                        const licenseButton = allVisibleButtons.find(btn => {
                            const text = Utils.normalizeWhitespace(btn.textContent);
                            return text.includes('选择许可') ||
                                text.includes('Select license') ||
                                (btn.getAttribute('aria-haspopup') === 'true' && TaskRunner.isFreeCard(btn));
                        });

                        if (licenseButton) {
                            logBuffer.push(`Multi-license item detected. Setting up observer for dropdown.`);
                            try {
                                await new Promise((resolve, reject) => {
                                    const observer = new MutationObserver((mutationsList) => {
                                        for (const mutation of mutationsList) {
                                            if (mutation.addedNodes.length > 0) {
                                                for (const node of mutation.addedNodes) {
                                                    if (node.nodeType !== 1) continue;
                                                    const clickableParent = TaskRunner.findFreeLicenseOption(node);
                                                    if (clickableParent) {
                                                        logBuffer.push(`Found explicit free license option, clicking it.`);
                                                        Utils.deepClick(clickableParent);
                                                        observer.disconnect();
                                                        resolve();
                                                        return;
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
                                const text = btn.textContent.trim();
                                return rect.width > 0 && rect.height > 0 && text.length > 0;
                            });

                            const freshCritical = freshButtons.filter(btn => {
                                const text = btn.textContent;
                                return criticalKeywords.some(key => text.includes(key));
                            });

                            logBuffer.push(`=== 重新检测: 可见=${freshButtons.length}, 关键=${freshCritical.length} ===`);
                            if (freshCritical.length > 0) {
                                freshCritical.slice(0, 3).forEach((btn, i) => {
                                    logBuffer.push(`  关键按钮${i + 1}: "${btn.textContent.trim().substring(0, 40)}"`);
                                });
                            }

                            // 寻找动作按钮的逻辑逻辑优化：
                            // 1. 优先寻找包含动作关键词且不是下拉弹出(aria-haspopup)的按钮
                            let actionButton = freshButtons.find(btn => {
                                const text = Utils.normalizeWhitespace(btn.textContent).toLowerCase();
                                const isPopup = btn.getAttribute('aria-haspopup') === 'true';
                                const matchesKeyword = [...Config.ACQUISITION_TEXT_SET].some(keyword =>
                                    text.includes(keyword.toLowerCase())
                                );

                                return !isPopup && matchesKeyword;
                            });

                            // 2. 如果没找到，再寻找只要包含关键词的按钮 (包含可能的弹出式选择器，虽然概率低)
                            if (!actionButton) {
                                actionButton = freshButtons.find(btn => {
                                    const text = Utils.normalizeWhitespace(btn.textContent).toLowerCase();
                                    return [...Config.ACQUISITION_TEXT_SET].some(keyword =>
                                        text.includes(keyword.toLowerCase())
                                    );
                                });
                            }

                            // 3. 兜底方案：如果是限时免费商品的价格/许可按钮 (排除掉 aria-haspopup="true" 的选择器，除非它是唯一的)
                            if (!actionButton) {
                                actionButton = freshButtons.find(btn => {
                                    const text = Utils.normalizeWhitespace(btn.textContent);
                                    const isPopup = btn.getAttribute('aria-haspopup') === 'true';
                                    const hasFreeText = [...Config.FREE_TEXT_SET].some(freeWord => text.includes(freeWord));
                                    const hasDiscount = /-\s*100\s*%\s*(?:OFF|折扣)?/i.test(text);
                                    const hasPersonal = text.includes('个人') || text.includes('Personal');
                                    return hasFreeText && hasDiscount && hasPersonal;
                                });

                                if (actionButton) {
                                    logBuffer.push(`Found limited-time free license button: "${actionButton.textContent.trim().substring(0, 50)}"`);
                                }
                            }

                            // 4. 备用方案：查找包含 "add" 和 "library" 的按钮
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
                                logBuffer.push(`Found add button [${actionButton.textContent.trim().substring(0, 30)}], clicking it.`);
                                Utils.deepClick(actionButton);

                                // 等待添加操作完成
                                try {
                                    await new Promise((resolve, reject) => {
                                        // 延长超时时间以适应较慢的结账流程 (60s)
                                        const timeout = 60000;
                                        const startTime = Date.now();

                                        const interval = setInterval(() => {
                                            // 1. 检查是否已经拥有
                                            const currentState = isItemOwned();
                                            if (currentState.owned) {
                                                logBuffer.push(`Successfully owned (UI Match: ${currentState.reason})`);
                                                success = true;
                                                clearInterval(interval);
                                                resolve();
                                                return;
                                            }

                                            // 2. 积极寻找并点击 "Place Order" 按钮
                                            const allButtonsWithShadow = Utils.findAllButtonsWithShadow();

                                            // A. 优先尝试直接通过 Class 查找
                                            let checkoutBtn = allButtonsWithShadow.find(btn =>
                                                btn.classList.contains('payment-order-confirm__btn')
                                            );

                                            // B. 备用：通过文本查找
                                            if (!checkoutBtn) {
                                                checkoutBtn = allButtonsWithShadow.find(btn => {
                                                    const rect = btn.getBoundingClientRect();
                                                    if (rect.width === 0 || rect.height === 0) return false;

                                                    const text = Utils.normalizeWhitespace(btn.textContent).toLowerCase();
                                                    // 排除掉主页面的 "Buy Now"
                                                    if (text.includes('buy now') || text.includes('立即购买')) return false;

                                                    // 如果处于支付/结账上下文中（例如在 iframe 内部，或 URL 包含 payment/purchase），
                                                    // “Add to library”/“添加到库” 按钮即为最终的确认结账按钮
                                                    const isCheckoutContext = (btn.ownerDocument !== document) || window.location.pathname.includes('/payment/');
                                                    if (isCheckoutContext) {
                                                        if (text.includes('add to library') || text.includes('添加到库') || text.includes('add to account') || text.includes('添加到账户')) {
                                                            return true;
                                                        }
                                                    }

                                                    return text.includes('place order') || text.includes('下单') ||
                                                        text.includes('checkout') || text.includes('结账') ||
                                                        text.includes('complete order') || text.includes('完成订单') ||
                                                        text.includes('confirm');
                                                });
                                            }

                                            if (checkoutBtn && !checkoutBtn.disabled) {
                                                // 仅仅在按钮未被点击过或距离上次点击超过2秒时点击
                                                const lastClickTime = parseInt(checkoutBtn.dataset.lastClickTime || '0');
                                                const now = Date.now();

                                                if (now - lastClickTime > 2000) {
                                                    logBuffer.push(`Found checkout/place order button [${checkoutBtn.textContent.trim()}], clicking it.`);
                                                    checkoutBtn.dataset.lastClickTime = now.toString();
                                                    Utils.deepClick(checkoutBtn);
                                                }
                                            }

                                            // 3. 超时检查
                                            if (Date.now() - startTime > timeout) {
                                                clearInterval(interval);
                                                // Extend timeout message to suggest manual intervention if needed
                                                reject(new Error(`Timeout waiting for page to enter an 'owned' state. (UI might be stuck)`));
                                            }
                                        }, 500); // 500ms check interval
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
                // 失败时检测是否撞上人机验证/安全校验，给出明确归因(而非笼统超时/关闭)，
                // 便于事后区分「该适配的失败」与「被风控拦截的失败」。
                if (!success) {
                    try {
                        const vIframe = document.querySelector('iframe[src*="hcaptcha"], iframe[src*="recaptcha"], iframe[src*="captcha"], iframe[src*="turnstile"], iframe[src*="challenges.cloudflare.com"], iframe[src*="arkoselabs"]');
                        const bodyText = (document.body && document.body.innerText) || '';
                        const vPhrases = ['人机验证', '确认您是真人', '请完成安全验证', '我不是机器人', 'Verify you are human', "I'm not a robot", 'Checking your browser', 'complete the security check', 'unusual traffic'];
                        if (vIframe || vPhrases.some(p => bodyText.includes(p))) {
                            logBuffer.push(Utils.getText('worker_captcha'));
                        }
                    } catch (e) { /* ignore */ }
                }
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

    // 节流标记：100ms 内多次调用只执行一次，消除 Observer/timer 风暴
    selectorWithSuffix: (selector, suffix) => {
        return selector
            .split(',')
            .map(part => `${part.trim()}${suffix}`)
            .join(', ');
    },

    getVisibleCardSelector: () => {
        return TaskRunner.selectorWithSuffix(Config.SELECTORS.card, ':not([data-fab-hidden="true"])');
    },

    isHideModeActive: () => {
        return State.hideSaved || State.hideDiscountedPaid || State.hidePaid;
    },

    getHideModeKey: () => {
        return [
            State.hideSaved ? 'saved' : '',
            State.hideDiscountedPaid ? 'discounted' : '',
            State.hidePaid ? 'paid' : ''
        ].join('|');
    },

    isCardHidden: (card) => {
        return card?.getAttribute?.('data-fab-hidden') === 'true' || card?.style?.display === 'none';
    },

    invalidateCardCountCache: () => {
        State.cardCountCache.dirty = true;
    },

    refreshCardCountCache: (cardsArg = null) => {
        if (typeof document === 'undefined') {
            State.cardCountCache.total = 0;
            State.cardCountCache.hidden = 0;
            State.cardCountCache.visible = 0;
            State.cardCountCache.dirty = false;
            State.cardCountCache.documentRef = null;
            State.cardCountCache.href = '';
            State.hiddenThisPageCount = 0;
            return { total: 0, hidden: 0, visible: 0 };
        }

        const cards = cardsArg ? Array.from(cardsArg) : Array.from(document.querySelectorAll(Config.SELECTORS.card));
        const hidden = cards.reduce((count, card) => count + (TaskRunner.isCardHidden(card) ? 1 : 0), 0);
        const total = cards.length;
        const visible = total - hidden;

        State.cardCountCache.total = total;
        State.cardCountCache.hidden = hidden;
        State.cardCountCache.visible = visible;
        State.cardCountCache.dirty = false;
        State.cardCountCache.documentRef = document;
        State.cardCountCache.href = typeof window !== 'undefined' ? (window.location?.href || '') : '';
        State.hiddenThisPageCount = hidden;

        return { total, hidden, visible };
    },

    getCardCounts: (forceRefresh = false) => {
        const cache = State.cardCountCache;
        const href = typeof window !== 'undefined' ? (window.location?.href || '') : '';
        const documentChanged = typeof document !== 'undefined' && cache.documentRef !== document;
        const hrefChanged = cache.href !== href;

        if (forceRefresh || cache.dirty || documentChanged || hrefChanged) {
            return TaskRunner.refreshCardCountCache();
        }

        return {
            total: cache.total,
            hidden: cache.hidden,
            visible: cache.visible
        };
    },

    adjustCardCountCacheHidden: (delta) => {
        const cache = State.cardCountCache;
        if (cache.dirty) return;

        cache.hidden = Math.max(0, Math.min(cache.total, cache.hidden + delta));
        cache.visible = Math.max(0, cache.total - cache.hidden);
        State.hiddenThisPageCount = cache.hidden;
    },

    setCardHidden: (card, hidden) => {
        if (!card) return;
        const wasHidden = TaskRunner.isCardHidden(card);

        if (hidden) {
            if (card.style) card.style.display = 'none';
            card.setAttribute?.('data-fab-hidden', 'true');
        } else {
            if (card.style) card.style.display = '';
            card.removeAttribute?.('data-fab-hidden');
        }

        const isHidden = TaskRunner.isCardHidden(card);
        if (wasHidden !== isHidden) {
            TaskRunner.adjustCardCountCacheHidden(isHidden ? 1 : -1);
        }
    },

    resetHiddenCardState: (cardsArg) => {
        Array.from(cardsArg || []).forEach(card => {
            card.removeAttribute?.('data-fab-processed');
            TaskRunner.setCardHidden(card, false);
        });
    },

    shouldHideCard: (card) => {
        const isFinished = State.hideSaved && TaskRunner.isCardFinished(card);
        const isDiscountedPaid = State.hideDiscountedPaid && TaskRunner.isDiscountedPaidCard(card);
        const isPaidAndHidden = State.hidePaid && !TaskRunner.isFreeCard(card);
        return isFinished || isDiscountedPaid || isPaidAndHidden;
    },

    _runHideOrShowTimer: null,

    scheduleHideOrShow: () => {
        if (TaskRunner._runHideOrShowTimer) return;
        TaskRunner._runHideOrShowTimer = setTimeout(() => {
            TaskRunner._runHideOrShowTimer = null;
            TaskRunner.runHideOrShow();
        }, 100);
    },

    runHideOrShow: () => {
        // 清除节流 timer（直接调用时也需清除，避免重入）
        if (TaskRunner._runHideOrShowTimer) {
            clearTimeout(TaskRunner._runHideOrShowTimer);
            TaskRunner._runHideOrShowTimer = null;
        }

        if (!TaskRunner.isHideModeActive()) {
            const allCards = document.querySelectorAll(Config.SELECTORS.card);
            TaskRunner.refreshCardCountCache(allCards);
            TaskRunner.resetHiddenCardState(allCards);
            State.lastHideModeKey = TaskRunner.getHideModeKey();
            if (UI) UI.update();
            return;
        }

        const hideModeKey = TaskRunner.getHideModeKey();
        if (State.lastHideModeKey !== hideModeKey) {
            State.lastHideModeKey = hideModeKey;
            TaskRunner.invalidateCardCountCache();
            const allCards = document.querySelectorAll(Config.SELECTORS.card);
            TaskRunner.refreshCardCountCache(allCards);
            TaskRunner.resetHiddenCardState(allCards);
        } else {
            TaskRunner.getCardCounts();
        }

        const cards = document.querySelectorAll(TaskRunner.getVisibleCardSelector());

        let actuallyHidden = 0;
        let hasUnsettledCards = false;
        const unsettledCards = [];

        cards.forEach(card => {
            // 已处理且已隐藏的卡片状态稳定，跳过昂贵的 isCardSettled 判断
            if (card.getAttribute('data-fab-processed') === 'true' && TaskRunner.isCardHidden(card)) {
                TaskRunner.setCardHidden(card, true);
                return;
            }
            if (!TaskRunner.isCardSettled(card)) {
                hasUnsettledCards = true;
                unsettledCards.push(card);
            }
        });

        if (hasUnsettledCards && unsettledCards.length > 0) {
            // 已有 timer 挂起时直接返回，避免重复 schedule 形成无限累积
            if (State.hideRetryTimer) return;
            Utils.logger('debug', Utils.getText('log_unsettled_cards', unsettledCards.length));
            State.hideRetryTimer = setTimeout(() => {
                State.hideRetryTimer = null;
                TaskRunner.runHideOrShow();
            }, 2000);
            // 有未就绪卡片时仍继续处理已就绪的，但本轮不再重入
        } else if (State.hideRetryTimer) {
            clearTimeout(State.hideRetryTimer);
            State.hideRetryTimer = null;
        }

        const cardsToHide = [];

        cards.forEach(card => {
            if (!TaskRunner.isCardSettled(card)) {
                return;
            }

            if (TaskRunner.isCardHidden(card)) {
                TaskRunner.setCardHidden(card, true);
                return;
            }

            card.setAttribute('data-fab-processed', 'true');

            if (TaskRunner.shouldHideCard(card)) {
                cardsToHide.push(card);
            }
        });

        if (cardsToHide.length > 0) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_prepare_hide', cardsToHide.length));
            }

            cardsToHide.sort(() => Math.random() - 0.5);

            if (cardsToHide.length > 30) {
                // 大批量：用 requestAnimationFrame 分帧同步隐藏，避免创建上百个 setTimeout
                const FRAME_BATCH = 20;
                let offset = 0;
                const hideNextFrame = () => {
                    const end = Math.min(offset + FRAME_BATCH, cardsToHide.length);
                    for (let i = offset; i < end; i++) {
                        TaskRunner.setCardHidden(cardsToHide[i], true);
                        actuallyHidden++;
                    }
                    offset = end;
                    if (offset < cardsToHide.length) {
                        requestAnimationFrame(hideNextFrame);
                    } else {
                        if (State.debugMode) {
                            Utils.logger('debug', Utils.getText('debug_hide_completed', actuallyHidden));
                        }
                        setTimeout(() => {
                            if (UI) UI.update();
                            TaskRunner.checkVisibilityAndRefresh();
                        }, 300);
                    }
                };
                requestAnimationFrame(hideNextFrame);
            } else {
                // 少量卡片：保留原有随机延迟动画（更自然）
                const batchSize = 10;
                const batches = Math.ceil(cardsToHide.length / batchSize);
                const initialDelay = 200; // 动画已由 cardDelay 提供，头部延迟缩短到 200ms

                for (let i = 0; i < batches; i++) {
                    const start = i * batchSize;
                    const end = Math.min(start + batchSize, cardsToHide.length);
                    const currentBatch = cardsToHide.slice(start, end);
                    const batchDelay = initialDelay + i * 300 + Math.random() * 300;
                    const isLastBatch = i === batches - 1;

                    setTimeout(() => {
                        let batchHidden = 0;
                        currentBatch.forEach((card, index) => {
                            const cardDelay = index * 50 + Math.random() * 100;
                            setTimeout(() => {
                                TaskRunner.setCardHidden(card, true);
                                actuallyHidden++;
                                batchHidden++;
                                // 每个 batch 最后一张卡片隐藏后即刻更新 UI，不再等到全部完成
                                if (batchHidden === currentBatch.length) {
                                    if (UI) UI.update();
                                    if (isLastBatch) {
                                        if (State.debugMode) {
                                            Utils.logger('debug', Utils.getText('debug_hide_completed', actuallyHidden));
                                        }
                                        setTimeout(() => {
                                            TaskRunner.checkVisibilityAndRefresh();
                                        }, 300);
                                    }
                                }
                            }, cardDelay);
                        });
                    }, batchDelay);
                }
            }
        }

        if (cardsToHide.length === 0) {
            if (UI) UI.update();
            TaskRunner.checkVisibilityAndRefresh();
        }
        return;
/*
        if (false) {
            const visibleCards = Array.from(cards).filter(card => {
                // 已处理且已隐藏→状态稳定，跳过重分类（这是最大的性能痑点）
                if (card.getAttribute('data-fab-processed') === 'true' && card.style.display === 'none') return false;
                if (State.hideSaved && TaskRunner.isCardFinished(card)) return false;
                if (State.hideDiscountedPaid && TaskRunner.isDiscountedPaidCard(card)) return false;
                if (State.hidePaid && !TaskRunner.isFreeCard(card)) return false;
                return true;
            });
            visibleCards.forEach(card => { card.style.display = ''; });

            if (cardsToHide.length === 0) {
                if (UI) UI.update();
                TaskRunner.checkVisibilityAndRefresh();
            }
        } else {
            cards.forEach(card => { card.style.display = ''; });
            if (UI) UI.update();
        }
*/
    },

    checkVisibilityAndRefresh: () => {
        const cards = document.querySelectorAll(TaskRunner.getVisibleCardSelector());

        let needsReprocessing = false;
        cards.forEach(card => {
            const isProcessed = card.getAttribute('data-fab-processed') === 'true';
            if (!isProcessed && TaskRunner.isCardSettled(card)) needsReprocessing = true;
        });

        if (needsReprocessing) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_unprocessed_cards_simple'));
            }
            setTimeout(() => TaskRunner.runHideOrShow(), 100);
            return;
        }

        // 只用 style.display 判断，避免 getComputedStyle 对每张卡片触发强制 reflow
        const { visible: visibleCards } = TaskRunner.getCardCounts();

        if (State.debugMode) {
            Utils.logger('debug', Utils.getText('debug_visible_after_hide', visibleCards, State.hiddenThisPageCount));
        }

        // Use UI.update() so both visible AND hidden counts are refreshed from real DOM state
        if (UI) UI.update();

        if (visibleCards === 0) {
            if (State.appStatus === 'RATE_LIMITED' && State.autoRefreshEmptyPage) {
                if (State.isRefreshScheduled) {
                    Utils.logger('debug', Utils.getText('refresh_plan_exists'));
                    return;
                }

                if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                    Utils.logger('debug', Utils.getText('log_refresh_cancelled_tasks', State.db.todo.length, State.activeWorkers));
                    return;
                }

                Utils.logger('info', Utils.getText('log_all_hidden_rate_limited'));
                const randomDelay = 3000 + Math.random() * 2000;
                if (countdownRefresh) {
                    countdownRefresh(randomDelay, Utils.getText('rate_limit_no_visible_reason'));
                }
            } else if (State.appStatus === 'NORMAL' && State.hiddenThisPageCount > 0) {
                Utils.logger('debug', Utils.getText('page_status_hidden_no_visible', State.hiddenThisPageCount));
                if (State.autoAddOnScroll) {
                    TaskRunner.attemptAutoScroll();
                }
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
        if (State.isCheckingStatus) {
            return;
        }
        State.isCheckingStatus = true;

        try {
            const visibleCards = [...document.querySelectorAll(TaskRunner.getVisibleCardSelector())];

            if (visibleCards.length === 0) {
                // Utils.logger('info', Utils.getText('log_no_visible_cards')); // Reduce noise
                return;
            }

            let hasUnsettledCards = false;
            const unsettledCards = [];

            visibleCards.forEach(card => {
                if (!TaskRunner.isCardSettled(card)) {
                    hasUnsettledCards = true;
                    unsettledCards.push(card);
                }
            });

            if (hasUnsettledCards && unsettledCards.length > 0) {
                // Found unsettled cards. We will proceed to check settled cards' ownership,
                // and rely on subsequent triggers (observer/interval) to re-check.
                // We do NOT return here, and we do NOT unlock prematurely.
            }
            // Re-implementing logic with the lock safely:

            // Filter only settled items for API check to avoiding checking "loading" items?
            // Or just proceed. The original logic waited.

            const allItems = [];
            let confirmedOwned = 0;

            visibleCards.forEach(card => {
                // If card is unsettled, maybe skip it this round?
                // But if we skip it, we might miss it if observer doesn't fire again.
                // Let's process valid links regardless.

                const link = card.querySelector(Config.SELECTORS.cardLink);
                const uidMatch = link?.href.match(/listings\/([a-f0-9-]+)/);

                if (uidMatch && uidMatch[1]) {
                    const uid = uidMatch[1];
                    const url = link.href.split('?')[0];

                    if (Database.isDone(url)) return;
                    allItems.push({ uid, url, element: card });
                }
            });

            if (allItems.length === 0) {
                // Utils.logger('debug', Utils.getText('debug_no_cards_to_check'));
                return;
            }

            Utils.logger('debug', Utils.getText('fab_dom_checking_status', allItems.length));

            const uids = allItems.map(item => item.uid);
            const statesData = await API.checkItemsOwnership(uids);

            const ownedUids = new Set(
                statesData
                    .filter(state => state && state.acquired)
                    .map(state => state.uid)
            );

            for (const item of allItems) {
                if (ownedUids.has(item.uid)) {
                    if (Database.addDoneUrl(item.url)) {
                        confirmedOwned++;
                    }
                    State.db.failed = State.db.failed.filter(f => f.uid !== item.uid);
                    State.db.todo = State.db.todo.filter(t => t.uid !== item.uid);
                }
            }

            if (confirmedOwned > 0) {
                await Database.saveDone();
                await Database.saveFailed();
                Utils.logger('debug', Utils.getText('fab_dom_api_complete', confirmedOwned));
                Utils.logger('debug', Utils.getText('fab_dom_refresh_complete', confirmedOwned));
                // 无论是否开启隐藏模式，都立即刷新状态栏（todo/done/failed 数字需同步）
                if (UI) UI.update();
                if (State.hideSaved || State.hideDiscountedPaid || State.hidePaid) {
                    TaskRunner.runHideOrShow();
                }
            } else {
                Utils.logger('debug', Utils.getText('fab_dom_no_new_owned'));
            }
        } catch (error) {
            Utils.logger('error', Utils.getText('log_check_status_error', error.message));
            if (error.message && error.message.includes('429')) {
                RateLimitManager.enterRateLimitedState('[Fab DOM Refresh] 429错误');
            }
        } finally {
            State.isCheckingStatus = false;
        }
    },

    scanAndAddTasks: async (cards) => {
        if (!State.autoAddOnScroll) return;

        // 未登录或 session 已过期时，卡片上拿不到价格信息，isFreeCard 会把所有商品
        // 误判为免费。直接跳过扫描，避免队列被付费商品塞满后 worker 空跑。
        if (!State.isAuthenticated) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('auth_scan_blocked'));
            }
            return;
        }

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
                        window._apiWaitStatus.apiCheckInterval = null;
                    }

                    const maxWaitTime = 10000;
                    const startTime = Date.now();

                    // 不再 wrap window.fetch（每次调用都嵌套一层会导致随时间推移越来越慢）。
                    // 改为仅靠 lastApiActivity 时间戳判断：页面发出 fetch 请求时
                    // 由下方已安装的全局拦截器（initFetchTracker）负责更新该时间戳。
                    window._apiWaitStatus.apiCheckInterval = setInterval(() => {
                        const now = Date.now();
                        const timeSinceLastActivity = now - window._apiWaitStatus.lastApiActivity;
                        const totalWaitTime = now - startTime;

                        if (totalWaitTime > maxWaitTime || timeSinceLastActivity > 2000) {
                            clearInterval(window._apiWaitStatus.apiCheckInterval);
                            window._apiWaitStatus.apiCheckInterval = null;
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
            let skippedUnsettled = 0;

            cardsToProcess.forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const url = link ? link.href.split('?')[0] : null;
                if (!url) return;

                if (!TaskRunner.isCardSettled(card)) {
                    skippedUnsettled++;
                    return;
                }

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

            if (skippedUnsettled > 0 && !State.autoAddRetryTimer) {
                State.autoAddRetryTimer = setTimeout(() => {
                    State.autoAddRetryTimer = null;
                    if (State.autoAddOnScroll) {
                        TaskRunner.scanAndAddTasks(document.querySelectorAll(TaskRunner.getVisibleCardSelector()))
                            .catch(error => Utils.logger('error', `自动添加重试失败: ${error.message}`));
                    }
                }, 2000);
            } else if (skippedUnsettled === 0 && State.autoAddRetryTimer) {
                clearTimeout(State.autoAddRetryTimer);
                State.autoAddRetryTimer = null;
            }

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
                        State.autoScrollAttempts = 0; // Reset scroll attempts
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
    },

    onQueueCompleted: null,

    stopExecutionAndSettle: async () => {
        if (State.watchdogTimer) {
            clearInterval(State.watchdogTimer);
            State.watchdogTimer = null;
        }
        KeepAlive.stop();
        TaskRunner.closeAllWorkerTabs();

        if (typeof TaskRunner.onQueueCompleted === 'function') {
            await TaskRunner.onQueueCompleted();
        } else {
            Utils.logger('info', Utils.getText('log_all_tasks_completed'));
            State.isExecuting = false;
            Database.saveExecutingState();
            Database.saveTodo();
            if (UI) UI.update();
        }
    },

    attemptAutoScroll: async () => {
        if (State.isAutoScrolling) return;
        State.isAutoScrolling = true;

        if (typeof State.autoScrollAttempts === 'undefined') {
            State.autoScrollAttempts = 0;
        }

        const maxScrollAttempts = 3;
        Utils.logger('info', Utils.getText('auto_scroll_attempt', State.autoScrollAttempts + 1, maxScrollAttempts));

        const getCurrentCardTotal = () => {
            try {
                return TaskRunner.getCardCounts().total;
            } catch (_error) {
                return 0;
            }
        };
        const previousCardTotal = getCurrentCardTotal();
        const previousScrollY = (typeof window !== 'undefined') ? window.scrollY : 0;

        // --- 关键修复：从页首开始时，隐藏卡片会使页面变矮，导致无法滚动触发无限加载 ---
        // 临时将隐藏的卡片设为 visibility:hidden（占位但不可见），恢复页面真实高度后再滚动
        const tempRestoredCards = [];
        if (typeof document !== 'undefined') {
            document.querySelectorAll('[data-fab-hidden="true"]').forEach(card => {
                if (card.style && card.style.display === 'none') {
                    card.style.display = '';
                    card.style.visibility = 'hidden';
                    tempRestoredCards.push(card);
                }
            });
        }

        const previousScrollHeight = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement.scrollHeight : 0;

        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo(0, previousScrollHeight);
        }

        // 滚动指令发出后，下一帧立即恢复 display:none，避免视觉闪烁
        if (tempRestoredCards.length > 0) {
            requestAnimationFrame(() => {
                tempRestoredCards.forEach(card => {
                    card.style.visibility = '';
                    card.style.display = 'none';
                });
            });
        }

        // Wait for potential content loading and scanning
        setTimeout(async () => {
            State.isAutoScrolling = false;

            const currentScrollHeight = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement.scrollHeight : 0;
            const currentScrollY = (typeof window !== 'undefined') ? window.scrollY : 0;
            const newTodoCount = State.db.todo.length;
            const currentCardTotal = getCurrentCardTotal();

            // 1. If we got new tasks, scanning will have reset State.autoScrollAttempts and executed.
            if (newTodoCount > 0) {
                Utils.logger('info', Utils.getText('auto_scroll_success', newTodoCount));
                if (!State.isExecuting) {
                    TaskRunner.startExecution();
                }
                return;
            }

            const newCardCount = currentCardTotal - previousCardTotal;
            if (newCardCount > 0) {
                State.autoScrollAttempts = 0;
                Utils.logger('debug', Utils.getText('auto_scroll_cards_loaded', newCardCount));
                TaskRunner.runHideOrShow();
                TaskRunner.attemptAutoScroll();
                return;
            }

            // 2. Check if we reached bottom
            // 注意：第二个条件加 previousScrollY > 0，防止页面因隐藏变矮时
            // (previousScrollY 和 currentScrollY 均为 0) 被误判为已到达底部
            const reachedBottom = (typeof window !== 'undefined' && window.innerHeight + currentScrollY >= currentScrollHeight - 50) ||
                                  (currentScrollHeight === previousScrollHeight && currentScrollY === previousScrollY && previousScrollY > 0);

            if (reachedBottom) {
                Utils.logger('info', Utils.getText('auto_scroll_reached_bottom'));
                await TaskRunner.stopExecutionAndSettle();
                return;
            }

            // 3. Increment attempts
            State.autoScrollAttempts++;

            if (State.autoScrollAttempts >= maxScrollAttempts) {
                Utils.logger('info', Utils.getText('auto_scroll_no_new_items', maxScrollAttempts));
                await TaskRunner.stopExecutionAndSettle();
                return;
            }

            // 4. Try again
            Utils.logger('debug', Utils.getText('auto_scroll_waiting'));
            TaskRunner.attemptAutoScroll();
        }, 3000);
    }
};
