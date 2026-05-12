/**
 * Fab Helper - Main Entry Point
 * 
 * This is the main entry file that imports all modules and initializes the script.
 * Build with: npm run build
 */

// Core modules
import { Config } from './config.js';
import { State } from './state.js';

// Feature modules
import { Utils, setUIReference as setUtilsUIRef } from './modules/utils.js';
import { PageDiagnostics } from './modules/page-diagnostics.js';
import { DataCache } from './modules/data-cache.js';
import { API } from './modules/api.js';
import { Database, setUIReference as setDbUIRef } from './modules/database.js';
import { RateLimitManager, setDependencies as setRateLimitDeps } from './modules/rate-limit-manager.js';
import { PagePatcher } from './modules/page-patcher.js';
import { TaskRunner, setUIReference as setTaskRunnerUIRef } from './modules/task-runner.js';
import { UI, setTaskRunnerReference as setUITaskRunnerRef } from './modules/ui.js';
import { InstanceManager } from './modules/instance-manager.js';

// Global countdown variables
let currentCountdownInterval = null;
let currentRefreshTimeout = null;

// Helper function for countdown refresh
function countdownRefresh(delay, reason = '备选方案') {
    if (State.isRefreshScheduled) {
        Utils.logger('info', Utils.getText('refresh_plan_exists').replace('(429自动恢复)', `(${reason})`));
        return;
    }

    State.isRefreshScheduled = true;

    if (currentCountdownInterval) {
        clearInterval(currentCountdownInterval);
        currentCountdownInterval = null;
    }
    if (currentRefreshTimeout) {
        clearTimeout(currentRefreshTimeout);
        currentRefreshTimeout = null;
    }

    const seconds = delay ? (delay / 1000).toFixed(1) : '未知';
    Utils.logger('debug', `🔄 ${reason}启动！将在 ${seconds} 秒后刷新页面尝试恢复...`);

    let remainingSeconds = Math.ceil(delay / 1000);
    currentCountdownInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            clearInterval(currentCountdownInterval);
            currentCountdownInterval = null;
            Utils.logger('debug', `⏱️ 倒计时结束，正在刷新页面...`);
        } else {
            Utils.logger('debug', Utils.getText('auto_refresh_countdown', remainingSeconds));

            if (!State.isRefreshScheduled) {
                Utils.logger('debug', `⏹️ 检测到刷新已被取消，停止倒计时`);
                clearInterval(currentCountdownInterval);
                currentCountdownInterval = null;
                if (currentRefreshTimeout) {
                    clearTimeout(currentRefreshTimeout);
                    currentRefreshTimeout = null;
                }
                return;
            }

            // Check conditions every 3 seconds
            if (remainingSeconds % 3 === 0) {
                checkRateLimitStatus().then(isNotLimited => {
                    if (isNotLimited) {
                        Utils.logger('debug', `⏱️ 检测到API限速已解除，取消刷新...`);
                        clearInterval(currentCountdownInterval);
                        currentCountdownInterval = null;
                        if (currentRefreshTimeout) {
                            clearTimeout(currentRefreshTimeout);
                            currentRefreshTimeout = null;
                        }
                        State.isRefreshScheduled = false;
                        if (State.appStatus === 'RATE_LIMITED') {
                            RateLimitManager.exitRateLimitedState();
                        }
                        return;
                    }

                    if (State.appStatus === 'RATE_LIMITED') {
                        const actualVisibleCount = parseInt(document.getElementById('fab-status-visible')?.textContent || '0');
                        if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                            clearInterval(currentCountdownInterval);
                            clearTimeout(currentRefreshTimeout);
                            currentCountdownInterval = null;
                            currentRefreshTimeout = null;
                            State.isRefreshScheduled = false;
                            Utils.logger('info', `⏹️ 检测到有 ${State.db.todo.length} 个待办任务和 ${State.activeWorkers} 个活动工作线程，已取消自动刷新。`);
                            return;
                        }
                    } else {
                        const visibleCount = parseInt(document.getElementById('fab-status-visible')?.textContent || '0');
                        if (State.db.todo.length > 0 || State.activeWorkers > 0 || visibleCount > 0) {
                            clearInterval(currentCountdownInterval);
                            clearTimeout(currentRefreshTimeout);
                            currentCountdownInterval = null;
                            currentRefreshTimeout = null;
                            State.isRefreshScheduled = false;
                            Utils.logger('warn', '⚠️ 刷新条件已变化，自动刷新已取消。');
                            return;
                        }
                    }
                }).catch(() => { });
            }
        }
    }, 1000);

    currentRefreshTimeout = setTimeout(() => {
        const visibleCount = parseInt(document.getElementById('fab-status-visible')?.textContent || '0');

        if (State.appStatus === 'RATE_LIMITED') {
            if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                Utils.logger('warn', '⚠️ 最后一刻检查：刷新条件不满足，自动刷新已取消。');
                State.isRefreshScheduled = false;
                return;
            }
            if (visibleCount === 0) {
                Utils.logger('info', `🔄 页面上没有可见商品且处于限速状态，将执行自动刷新。`);
                window.location.href = window.location.href;
            } else {
                State.isRefreshScheduled = false;
                return;
            }
        } else {
            if (State.db.todo.length > 0 || State.activeWorkers > 0 || visibleCount > 0) {
                Utils.logger('warn', '⚠️ 最后一刻检查：刷新条件不满足，自动刷新已取消。');
                State.isRefreshScheduled = false;
            } else {
                window.location.href = window.location.href;
            }
        }
    }, delay);
}

// Check rate limit status using Performance API
async function checkRateLimitStatus() {
    try {
        const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;
        const hiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`).length;
        const actualVisibleCards = totalCards - hiddenCards;

        const visibleCountElement = document.getElementById('fab-status-visible');
        if (visibleCountElement) {
            visibleCountElement.textContent = actualVisibleCards.toString();
        }
        State.hiddenThisPageCount = hiddenCards;

        if (State.appStatus === 'RATE_LIMITED' && actualVisibleCards === 0) {
            return false;
        }

        if (actualVisibleCards === 0 && hiddenCards > 25) {
            return false;
        }

        if (window.performance && window.performance.getEntriesByType) {
            const recentRequests = window.performance.getEntriesByType('resource')
                .filter(r => r.name.includes('/i/listings/search') || r.name.includes('/i/users/me/listings-states'))
                .filter(r => Date.now() - r.startTime < 10000);

            if (recentRequests.length > 0) {
                const has429 = recentRequests.some(r => r.responseStatus === 429);
                if (has429) return false;

                const hasSuccess = recentRequests.some(r => r.responseStatus >= 200 && r.responseStatus < 300);
                if (hasSuccess) return true;
            }
            return State.appStatus === 'NORMAL';
        }
        return State.appStatus === 'NORMAL';
    } catch (error) {
        Utils.logger('error', `检查限速状态出错: ${error.message}`);
        return false;
    }
}

// Set up circular dependencies
setUtilsUIRef(UI);
setDbUIRef(UI);
setTaskRunnerUIRef(UI);
setUITaskRunnerRef(TaskRunner);
setRateLimitDeps({
    UI,
    TaskRunner,
    countdownRefresh
});

// Setup XHR interceptor for caching
function setupXHRInterceptor() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (...args) {
        this._url = args[1];
        return originalOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const xhr = this;

        if (xhr._url && typeof xhr._url === 'string') {
            xhr.addEventListener('load', function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        const responseData = JSON.parse(xhr.responseText);

                        if (xhr._url.includes('/i/listings/search') && responseData.results && Array.isArray(responseData.results)) {
                            DataCache.saveListings(responseData.results);
                        } else if (xhr._url.includes('/i/users/me/listings-states')) {
                            if (Array.isArray(responseData)) {
                                DataCache.saveOwnedStatus(responseData);
                            } else {
                                const extractedData = API.extractStateData(responseData, 'XHRInterceptor');
                                if (Array.isArray(extractedData) && extractedData.length > 0) {
                                    DataCache.saveOwnedStatus(extractedData);
                                }
                            }
                        } else if (xhr._url.includes('/i/listings/prices-infos') && responseData.offers && Array.isArray(responseData.offers)) {
                            DataCache.savePrices(responseData.offers);
                        }
                    } catch (e) { }
                }

                // Rate limit detection
                if (xhr._url && xhr._url.includes('/i/listings/search')) {
                    if (xhr.status === 429) {
                        Utils.logger('warn', Utils.getText('detected_api_429_status', xhr._url));
                        if (typeof window.enterRateLimitedState === 'function') {
                            window.enterRateLimitedState();
                        }
                    }
                }
            });
        }

        return originalSend.apply(this, args);
    };
}

// Setup Fetch interceptor for caching
function setupFetchInterceptor() {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const url = args[0]?.toString() || '';

        if (url.includes('/i/listings/search') ||
            url.includes('/i/users/me/listings-states') ||
            url.includes('/i/listings/prices-infos')) {

            try {
                const response = await originalFetch.apply(this, args);

                if (response.ok) {
                    const clonedResponse = response.clone();
                    clonedResponse.json().then(data => {
                        if (url.includes('/i/listings/search') && data.results && Array.isArray(data.results)) {
                            DataCache.saveListings(data.results);
                        } else if (url.includes('/i/users/me/listings-states')) {
                            if (Array.isArray(data)) {
                                DataCache.saveOwnedStatus(data);
                            } else {
                                const extractedData = API.extractStateData(data, 'FetchInterceptor');
                                if (Array.isArray(extractedData) && extractedData.length > 0) {
                                    DataCache.saveOwnedStatus(extractedData);
                                }
                            }
                        } else if (url.includes('/i/listings/prices-infos') && data.offers && Array.isArray(data.offers)) {
                            DataCache.savePrices(data.offers);
                        }
                    }).catch(() => { });
                }

                return response;
            } catch (e) {
                return originalFetch.apply(this, args);
            }
        }

        return originalFetch.apply(this, args);
    };
}

// Setup request interceptors
function setupRequestInterceptors() {
    try {
        setupXHRInterceptor();
        setupFetchInterceptor();
        setInterval(() => DataCache.cleanupExpired(), 60000);
        Utils.logger('debug', '请求拦截和缓存系统已初始化');
    } catch (e) {
        Utils.logger('error', `初始化请求拦截器失败: ${e.message}`);
    }
}

// Run DOM dependent part
async function runDomDependentPart() {
    if (State.hasRunDomPart) return;

    if (State.isWorkerTab) {
        State.hasRunDomPart = true;
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('workerId')) {
        Utils.logger('debug', `工作标签页DOM部分初始化，跳过UI创建`);
        State.hasRunDomPart = true;
        return;
    }

    const uiCreated = UI.create();

    if (!uiCreated) {
        Utils.logger('info', Utils.getText('log_detail_page'));
        State.hasRunDomPart = true;
        return;
    }

    UI.update();
    UI.updateDebugTab();
    UI.switchTab('dashboard');

    State.hasRunDomPart = true;

    // Global functions
    window.enterRateLimitedState = function (source = Utils.getText('rate_limit_source_global_call')) {
        RateLimitManager.enterRateLimitedState(source);
    };

    window.recordNetworkRequest = function (source = '网络请求', hasResults = true) {
        if (hasResults) {
            RateLimitManager.recordSuccessfulRequest(source, hasResults);
        }
    };

    // Rate limit page content detection
    setInterval(() => {
        if (State.appStatus === 'NORMAL') {
            const pageText = document.body.innerText || '';
            if (pageText.includes('Too many requests') ||
                pageText.includes('rate limit') ||
                pageText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                Utils.logger('warn', Utils.getText('page_content_rate_limit_detected'));
                RateLimitManager.enterRateLimitedState(Utils.getText('rate_limit_source_page_content'));
            }
        }
    }, 5000);

    // Check for 429 error page
    const checkIsErrorPage = (title, text) => {
        const isCloudflareTitle = title.includes('Cloudflare') || title.includes('Attention Required');
        const is429Text = text.includes('429') || text.includes('Too Many Requests') || text.includes('Too many requests');
        if (isCloudflareTitle || is429Text) {
            Utils.logger('warn', `[页面加载] 检测到429错误页面`);
            window.enterRateLimitedState('页面内容429检测');
            return true;
        }
        return false;
    };

    checkIsErrorPage(document.title, document.body.innerText || '');

    // Auto-resume from rate limit
    if (State.appStatus === 'RATE_LIMITED') {
        Utils.logger('debug', Utils.getText('log_auto_resume_page_loading'));
        const isRecovered = await RateLimitManager.checkRateLimitStatus();

        if (isRecovered) {
            Utils.logger('info', Utils.getText('log_recovery_probe_success'));
            if (State.db.todo.length > 0 && !State.isExecuting) {
                Utils.logger('info', Utils.getText('log_found_todo_auto_resume', State.db.todo.length));
                State.isExecuting = true;
                Database.saveExecutingState();
                TaskRunner.executeBatch();
            }
        } else {
            Utils.logger('warn', Utils.getText('log_recovery_probe_failed'));
            if (State.activeWorkers === 0 && State.db.todo.length === 0) {
                const randomDelay = 5000 + Math.random() * 10000;
                countdownRefresh(randomDelay, Utils.getText('countdown_refresh_source'));
            }
        }
    }

    // DOM Observer setup
    const containerSelectors = ['main', '#main', '.AssetGrid-root', '.fabkit-responsive-grid-container'];
    let targetNode = null;
    for (const selector of containerSelectors) {
        targetNode = document.querySelector(selector);
        if (targetNode) break;
    }
    if (!targetNode) targetNode = document.body;

    const observer = new MutationObserver((mutationsList) => {
        const hasNewContent = mutationsList.some(mutation =>
            [...mutation.addedNodes].some(node =>
                node.nodeType === 1 && (node.matches(Config.SELECTORS.card) || node.querySelector(Config.SELECTORS.card))
            )
        );
        if (hasNewContent) {
            clearTimeout(State.observerDebounceTimer);
            State.observerDebounceTimer = setTimeout(() => {
                if (State.debugMode) {
                    Utils.logger('debug', `[Observer] ${Utils.getText('debug_new_content_loading')}`);
                }

                setTimeout(() => {
                    TaskRunner.checkVisibleCardsStatus().then(() => {
                        setTimeout(() => {
                            if (State.hideSaved) {
                                TaskRunner.runHideOrShow();
                            }
                        }, 1000);

                        if (State.appStatus === 'NORMAL' || State.autoAddOnScroll) {
                            setTimeout(() => {
                                TaskRunner.scanAndAddTasks(document.querySelectorAll(Config.SELECTORS.card))
                                    .catch(error => Utils.logger('error', `自动添加任务失败: ${error.message}`));
                            }, 500);
                        }
                    }).catch(() => {
                        setTimeout(() => {
                            if (State.hideSaved) {
                                TaskRunner.runHideOrShow();
                            }
                        }, 1500);
                    });
                }, 2000);
            }, 500);
        }
    });

    observer.observe(targetNode, { childList: true, subtree: true });
    Utils.logger('debug', `✅ Core DOM observer is now active on <${targetNode.tagName.toLowerCase()}>.`);

    // Initial hide/show
    TaskRunner.runHideOrShow();

    // 初始加载时，如果开启了自动添加，则扫描一次现有商品
    if (State.autoAddOnScroll) {
        setTimeout(() => {
            Utils.logger('debug', '页面加载完成，正在执行初始商品扫描...');
            TaskRunner.scanAndAddTasks(document.querySelectorAll(Config.SELECTORS.card))
                .catch(error => Utils.logger('error', `初始扫描任务失败: ${error.message}`));
        }, 3000); // 给页面一点渲染时间
    }

    // Periodic card processing check
    setInterval(() => {
        if (!State.hideSaved) return;
        const cards = document.querySelectorAll(Config.SELECTORS.card);
        let unprocessedCount = 0;

        cards.forEach(card => {
            const isProcessed = card.getAttribute('data-fab-processed') === 'true';
            if (!isProcessed) {
                unprocessedCount++;
            } else {
                const isFinished = TaskRunner.isCardFinished(card);
                const shouldBeHidden = isFinished && State.hideSaved;
                const isHidden = card.style.display === 'none';

                if (shouldBeHidden !== isHidden) {
                    card.removeAttribute('data-fab-processed');
                    unprocessedCount++;
                }
            }
        });

        if (unprocessedCount > 0) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_unprocessed_cards', unprocessedCount));
            }
            TaskRunner.runHideOrShow();
        }
    }, Config.STATUS_CHECK_INTERVAL);

    // Clean completed tasks from todo
    setInterval(() => {
        if (State.db.todo.length === 0) return;
        const initialTodoCount = State.db.todo.length;
        State.db.todo = State.db.todo.filter(task => {
            const url = task.url.split('?')[0];
            return !Database.isDone(url);
        });

        if (State.db.todo.length < initialTodoCount) {
            Utils.logger('info', `[自动清理] 从待办列表中移除了 ${initialTodoCount - State.db.todo.length} 个已完成的任务。`);
            UI.update();
        }
    }, 10000);

    // Implicit rate limit detection (no new cards on scroll)
    let lastCardCount = document.querySelectorAll(Config.SELECTORS.card).length;
    let noNewCardsCounter = 0;
    let lastScrollY = window.scrollY;

    setInterval(() => {
        if (State.appStatus !== 'NORMAL') return;

        const currentCardCount = document.querySelectorAll(Config.SELECTORS.card).length;

        if (window.scrollY > lastScrollY + 100 && currentCardCount === lastCardCount) {
            noNewCardsCounter++;
            if (noNewCardsCounter >= 3) {
                Utils.logger('warn', `${Utils.getText('implicit_rate_limit_detection')}`);
                RateLimitManager.enterRateLimitedState(Utils.getText('source_implicit_rate_limit'));
                noNewCardsCounter = 0;
            }
        } else if (currentCardCount > lastCardCount) {
            noNewCardsCounter = 0;
        }

        lastCardCount = currentCardCount;
        lastScrollY = window.scrollY;
    }, 5000);

    // Page status monitoring
    setInterval(async () => {
        try {
            const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;
            const visibleCards = Array.from(document.querySelectorAll(Config.SELECTORS.card)).filter(card => {
                if (card.style.display === 'none') return false;
                const computedStyle = window.getComputedStyle(card);
                return computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
            });

            const actualVisibleCards = visibleCards.length;
            const hiddenCards = totalCards - actualVisibleCards;

            const visibleCountElement = document.getElementById('fab-status-visible');
            if (visibleCountElement) {
                visibleCountElement.textContent = actualVisibleCards.toString();
            }
            State.hiddenThisPageCount = hiddenCards;

            if (State.appStatus === 'RATE_LIMITED' && actualVisibleCards === 0 && State.autoRefreshEmptyPage) {
                if (!window._pendingZeroVisibleRefresh && !currentCountdownInterval && !currentRefreshTimeout) {
                    Utils.logger('info', `[状态监控] 检测到限速状态下没有可见商品且自动刷新已开启，准备刷新页面`);
                    const randomDelay = 3000 + Math.random() * 2000;
                    countdownRefresh(randomDelay, '限速状态无可见商品');
                }
            }
        } catch (error) {
            Utils.logger('error', `页面状态检查出错: ${error.message}`);
        }
    }, 10000);

    // Ensure tasks are executed
    setInterval(() => {
        if (State.db.todo.length === 0) return;
        TaskRunner.ensureTasksAreExecuted();
    }, 5000);

    // HTTP status check
    setInterval(async () => {
        try {
            if (State.appStatus !== 'NORMAL') return;

            if (window.performance && window.performance.getEntriesByType) {
                const navigationEntries = window.performance.getEntriesByType('navigation');
                if (navigationEntries && navigationEntries.length > 0) {
                    const lastNavigation = navigationEntries[0];
                    if (lastNavigation.responseStatus === 429) {
                        Utils.logger('warn', `[HTTP状态检测] 检测到导航请求状态码为429！`);
                        if (typeof window.enterRateLimitedState === 'function') {
                            window.enterRateLimitedState();
                        }
                    }
                }
            }
        } catch (error) { }
    }, 10000);
}

// Ensure UI is loaded
function ensureUILoaded() {
    if (!document.getElementById(Config.UI_CONTAINER_ID)) {
        Utils.logger('warn', '检测到UI未加载，尝试重新初始化...');
        setTimeout(() => {
            try {
                runDomDependentPart();
            } catch (error) {
                Utils.logger('error', `UI重新初始化失败: ${error.message}`);
            }
        }, 1000);
    }
}

// Main initialization function
async function main() {
    window.pageLoadTime = Date.now();

    Utils.logger('info', Utils.getText('log_script_starting'));
    Utils.detectLanguage();

    // Check auth but don't block - UI should still show
    const isLoggedIn = Utils.checkAuthentication(true); // silent mode
    if (!isLoggedIn) {
        Utils.logger('warn', '账号未登录，部分功能可能受限');
    }

    // Check if worker tab
    const urlParams = new URLSearchParams(window.location.search);
    const workerId = urlParams.get('workerId');
    if (workerId) {
        State.isWorkerTab = true;
        State.workerTaskId = workerId;

        await InstanceManager.init();
        Utils.logger('info', `工作标签页初始化完成，开始处理任务...`);
        await TaskRunner.processDetailPage();
        return;
    }

    await InstanceManager.init();
    await Database.load();

    const storedExecutingState = await GM_getValue(Config.DB_KEYS.IS_EXECUTING, false);
    if (State.isExecuting !== storedExecutingState) {
        Utils.logger('info', Utils.getText('log_execution_state_inconsistent', storedExecutingState ? '执行中' : '已停止'));
        State.isExecuting = storedExecutingState;
    }

    const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
    if (persistedStatus && persistedStatus.status === 'RATE_LIMITED') {
        State.appStatus = 'RATE_LIMITED';
        State.rateLimitStartTime = persistedStatus.startTime;
        const previousDuration = persistedStatus && persistedStatus.startTime ?
            ((Date.now() - persistedStatus.startTime) / 1000).toFixed(2) : '0.00';
        Utils.logger('warn', Utils.getText('startup_rate_limited', previousDuration, persistedStatus.source || Utils.getText('status_unknown_source')));
    }

    // Initialize request interceptors
    setupRequestInterceptors();

    await PagePatcher.init();

    // Check for temp tasks from 429 recovery
    const tempTasks = await GM_getValue('temp_todo_tasks', null);
    if (tempTasks && tempTasks.length > 0) {
        Utils.logger('info', `从429恢复：找到 ${tempTasks.length} 个临时保存的待办任务，正在恢复...`);
        State.db.todo = tempTasks;
        await GM_deleteValue('temp_todo_tasks');
    }

    // Worker done listener
    State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.WORKER_DONE, async (key, oldValue, newValue) => {
        if (!newValue) return;

        try {
            await GM_deleteValue(Config.DB_KEYS.WORKER_DONE);

            const { workerId, success, task, logs, instanceId, executionTime } = newValue;

            if (instanceId !== Config.INSTANCE_ID) {
                Utils.logger('info', `收到来自其他实例 [${instanceId}] 的工作报告，当前实例 [${Config.INSTANCE_ID}] 将忽略。`);
                return;
            }

            if (!workerId || !task) {
                Utils.logger('error', '收到无效的工作报告。缺少workerId或task。');
                return;
            }

            if (executionTime) {
                Utils.logger('info', Utils.getText('task_execution_time', executionTime ? (executionTime / 1000).toFixed(2) : Utils.getText('status_unknown_duration')));
            }

            if (State.runningWorkers[workerId]) {
                delete State.runningWorkers[workerId];
                State.activeWorkers--;
            }

            if (logs && logs.length) {
                logs.forEach(log => Utils.logger('info', log));
            }

            if (success) {
                Utils.logger('info', `✅ 任务完成: ${task.name}`);
                await Database.markAsDone(task);
                State.sessionCompleted.add(Database.normalizeListingUrl(task.url));
                State.executionCompletedTasks++;
            } else {
                Utils.logger('warn', `❌ 任务失败: ${task.name}`);
                await Database.markAsFailed(task, {
                    reason: '工作标签页报告失败',
                    logs: logs || [],
                    details: {
                        executionTime: executionTime ? `${(executionTime / 1000).toFixed(2)}s` : '未知',
                        workerId: workerId,
                        instanceId: instanceId
                    }
                });
                State.executionFailedTasks++;
            }

            UI.update();

            if (State.isExecuting && State.activeWorkers < Config.MAX_CONCURRENT_WORKERS && State.db.todo.length > 0) {
                setTimeout(() => TaskRunner.executeBatch(), 1000);
            }

            if (State.isExecuting && State.db.todo.length === 0 && State.activeWorkers === 0) {
                Utils.logger('info', '所有任务已完成。');
                State.isExecuting = false;
                Database.saveExecutingState();
                await Database.saveTodo();

                if (State.appStatus === 'RATE_LIMITED') {
                    Utils.logger('info', '所有任务已完成，且处于限速状态，将刷新页面尝试恢复...');
                    const randomDelay = 3000 + Math.random() * 5000;
                    countdownRefresh(randomDelay, '任务完成后限速恢复');
                }

                UI.update();
            }

            TaskRunner.runHideOrShow();
        } catch (error) {
            Utils.logger('error', `处理工作报告时出错: ${error.message}`);
        }
    }));

    // Execution state listener
    State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.IS_EXECUTING, (key, oldValue, newValue) => {
        if (!State.isWorkerTab && State.isExecuting !== newValue) {
            Utils.logger('info', Utils.getText('execution_status_changed', newValue ? Utils.getText('status_executing') : Utils.getText('status_stopped')));
            State.isExecuting = newValue;
            UI.update();
        }
    }));

    // Robust launcher
    window._fabHelperLauncherActive = window._fabHelperLauncherActive || false;

    if (!window._fabHelperLauncherActive) {
        window._fabHelperLauncherActive = true;

        const launcherInterval = setInterval(() => {
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                if (!State.hasRunDomPart) {
                    Utils.logger('info', '[Launcher] DOM is ready. Running main script logic...');
                    // Wrap in async IIFE with error handling to prevent infinite loop
                    (async () => {
                        try {
                            await runDomDependentPart();
                        } catch (e) {
                            Utils.logger('error', `[Launcher] Error in runDomDependentPart: ${e.message}`);
                            console.error('[Fab Helper] runDomDependentPart error:', e);
                            // Set hasRunDomPart even on error to prevent infinite loop
                            State.hasRunDomPart = true;
                        }
                    })();
                }
                if (State.hasRunDomPart) {
                    clearInterval(launcherInterval);
                    window._fabHelperLauncherActive = false;
                    Utils.logger('debug', '[Launcher] Main logic has been launched or skipped. Launcher is now idle.');
                }
            }
        }, 500);
    }

    // Network inactivity refresh
    let lastNetworkActivityTime = Date.now();

    window.recordNetworkActivity = function () {
        lastNetworkActivityTime = Date.now();
    };

    setInterval(() => {
        if (State.appStatus === 'RATE_LIMITED') {
            const inactiveTime = Date.now() - lastNetworkActivityTime;
            if (inactiveTime > 30000) {
                Utils.logger('warn', `⚠️ 检测到在限速状态下 ${Math.floor(inactiveTime / 1000)} 秒无网络活动，即将强制刷新页面...`);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        }
    }, 5000);

    Utils.logger('info', Utils.getText('log_init'));
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    InstanceManager.cleanup();
    Utils.cleanup();
});

// Ensure UI is loaded after page load
window.addEventListener('load', () => {
    setTimeout(ensureUILoaded, 2000);
});

// Check UI on visibility change
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        setTimeout(ensureUILoaded, 500);
    }
});

// Run main function
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
