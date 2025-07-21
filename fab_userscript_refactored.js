// ==UserScript==
// @name         Fab API-Driven Helper
// @name:en      Fab API-Driven Helper
// @name:zh      Fab API 驱动助手
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  A heavily refactored and stabilized version for automating asset acquisition from Fab.com.
// @description:en A heavily refactored and stabilized version for automating asset acquisition from Fab.com.
// @description:zh 通过调用内部API，自动化获取Fab.com上的免费资源，并配有现代化的UI和健壮的错误处理机制。
// @author       gpt-4 & user & Gemini
// @match        https://www.fab.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_webRequest
// @grant        GM_openInTab
// @grant        unsafeWindow
// @grant        window.close
// @connect      api.fab.com
// @connect      www.fab.com
// @downloadURL  https://update.greasyfork.org/scripts/541307/Fab%20%E9%9A%90%E8%97%8F%E5%B7%B2%E4%BF%9D%E5%AD%98%E9%A1%B9%E7%9B%AE.user.js
// @updateURL    https://update.greasyfork.org/scripts/541307/Fab%20%E9%9A%90%E8%97%8F%E5%B7%B2%E4%BF%9D%E5%AD%98%E9%A1%B9%E7%9B%AE.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // --- 模块一: 配置与常量 (Config & Constants) ---
    const Config = {
        SCRIPT_NAME: '[Fab API-Driven Helper v1.4.0]',
        DB_VERSION: 3,
        DB_NAME: 'fab_helper_db',
        MAX_WORKERS: 5, // Maximum number of concurrent worker tabs
        SMART_PURSUIT_THRESHOLD: 5, // Trigger a new scan after every 5 tasks are completed
        UI_CONTAINER_ID: 'fab-helper-container-v8',
        UI_LOG_ID: 'fab-helper-log-v8',
        DB_KEYS: {
            DONE: 'fab_doneList_v8',
            FAILED: 'fab_failedList_v8', // For items that failed processing
            HIDE: 'fab_hideSaved_v8',
            WORKER_DONE: 'fab_worker_done_v8', // This is the ONLY key workers use to report back.
            SAVED_CURSOR: 'fab_saved_cursor_v8', // For Page Patcher
            PATCH_ENABLED: 'fab_patch_enabled_v8', // For Page Patcher
            PEAK_RPS: 'fab_peak_rps_v8', // NEW: For persisting peak RPS
            THROTTLE_INFO: 'fab_throttle_info_v2', // NEW: For Graceful Degradation
            // All other keys are either session-based or for main-tab persistence.
        },
        SELECTORS: {
            CONTENT_CONTAINER: '#root div.AssetGrid-root', // More specific container
            card: 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root',
            cardLink: 'a[href*="/listings/"]',
            addButton: 'button[aria-label*="Add to"], button[aria-label*="添加至"], button[aria-label*="cart"]',
            rootElement: '#root',
            successBanner: 'div[class*="Toast-root"]'
        },
        TEXTS: {
            en: { hide: 'Hide', show: 'Show', recon: 'Recon', reconning: 'Reconning...', execute: 'Start Tasks', executing: 'Executing...', stopExecute: 'Stop', added: 'Added', failed: 'Failed', todo: 'To-Do', clearLog: 'Clear Log', copyLog: 'Copy Log', copied: 'Copied!', refresh: 'Refresh State', resetRecon: 'Reset Recon', log_init: 'Assistant is online!', log_db_loaded: 'Reading archive...', log_exec_no_tasks: 'To-Do list is empty.', log_recon_start: 'Starting scan for new items...', log_recon_end: 'Scan complete!', log_task_added: 'Found new item:', log_api_request: 'Requesting page data (Page: %page%). Scanned: %scanned%, Owned: %owned%...', log_api_owned_check: 'Checking ownership for %count% items...', log_api_owned_done: 'Ownership check complete. Found %newCount% new items.', log_verify_success: 'Verified and added to library!', log_verify_fail: "Couldn't add. Will retry later.", log_429_error: 'Request limit hit! Taking a 15s break...', log_recon_error: 'An error occurred during recon cycle:', goto_page_label: 'Page:', goto_page_btn: 'Go', retry_failed: 'Retry Failed' },
            zh: { hide: '隐藏', show: '显示', recon: '侦察', reconning: '侦察中...', execute: '一键开刷', executing: '执行中...', stopExecute: '停止', added: '已入库', failed: '失败', todo: '待办', clearLog: '清空日志', copyLog: '复制日志', copied: '已复制!', refresh: '同步状态', resetRecon: '重置进度', log_init: '助手已上线！', log_db_loaded: '正在读取存档...', log_exec_no_tasks: '"待办"清单是空的。', log_recon_start: '开始扫描新宝贝...', log_recon_end: '扫描完成！', log_task_added: '发现一个新宝贝:', log_api_request: '正在请求页面数据 (页码: %page%)。已扫描: %scanned%，已拥有: %owned%...', log_api_owned_check: '正在批量验证 %count% 个项目的所有权...', log_api_owned_done: '所有权验证完毕，发现 %newCount% 个全新项目！', log_verify_success: '搞定！已成功入库。', log_verify_fail: '哎呀，这个没加上。稍后会自动重试！', log_429_error: '请求太快被服务器限速了！休息15秒后自动重试...', log_recon_error: '侦察周期中发生严重错误：', goto_page_label: '页码:', goto_page_btn: '跳转', retry_failed: '重试失败' }
        },
        // Centralized keyword sets, based STRICTLY on the rules in FAB_HELPER_RULES.md
        OWNED_SUCCESS_CRITERIA: {
            // Check for an H2 tag with the specific success text.
            h2Text: ['已保存在我的库中', 'Saved in My Library'],
            // Check for buttons/links with these texts.
            buttonTexts: ['在我的库中查看', 'View in My Library'],
            // Check for the temporary success popup (snackbar).
            snackbarText: ['产品已添加至您的库中', 'Product added to your library'],
        },
        ACQUISITION_TEXT_SET: new Set(['添加到我的库', 'Add to my library']),

        // Kept for backward compatibility with recon logic.
        SAVED_TEXT_SET: new Set(['已保存在我的库中', 'Saved in My Library', '在我的库中', 'In My Library']),
        FREE_TEXT_SET: new Set(['免费', 'Free', '起始价格 免费']),
    };

    // --- 模块二: 全局状态管理 (Global State) ---
    const State = {
        db: {},
        isExecuting: false,
        isReconning: false,
        isScanning: false, // NEW: Lock to prevent concurrent scans in Smart Pursuit
        isCoolingDown: false, // NEW: Global cooldown state
        wasExecutingBeforeCooldown: false, // NEW: State memory for Phoenix Protocol
        hideSaved: false,
        showAdvanced: false,
        patchHasBeenApplied: false, // For "One-and-Done" Page Patcher
        isPagePatchingEnabled: false, // For Page Patcher
        isSmartPursuitEnabled: localStorage.getItem('fab_smart_pursuit_enabled') === 'true', // FIX: Initialize from localStorage
        savedCursor: null, // For Page Patcher
        activeWorkers: 0,
        runningWorkers: {}, // NEW: To track active workers for the watchdog { workerId: { task, startTime } }
        lastKnownHref: null, // To detect SPA navigation
        hiddenThisPageCount: 0,
        // --- NEW v1.1.0: Unified Status System ---
        scriptStatus: 'IDLE', // IDLE, ACTIVE, THROTTLED, UNSTABLE
        networkErrorCount: 0, // Counter for consecutive network errors
        // --- End of new status system ---
        totalTasks: 0, // Used for Recon
        completedTasks: 0, // Used for Recon
        executionTotalTasks: 0,
        executionCompletedTasks: 0, // For execution progress
        executionFailedTasks: 0, // For execution progress
        sessionPursuitCompletedCount: 0, // NEW: Counter for Smart Pursuit trigger
        watchdogTimer: null,
        // UI-related state
        UI: {
            container: null,
            logPanel: null,
            progressContainer: null, // NEW
            progressText: null, // NEW
            progressBarFill: null, // NEW
            progressBar: null,
            statusTodo: null,
            statusDone: null,
            statusFailed: null,
            execBtn: null,
            hideBtn: null,
            reconBtn: null,
            retryBtn: null,
            refreshBtn: null,
            resetReconBtn: null,
            reconProgressDisplay: null,
            lastHiddenCount: 0,
            rpsDisplay: null,
            peakRpsDisplay: null,
            last429Display: null,
            cumulativeWeightDisplay: null,
            cooldownStatus: null, // NEW: Cooldown status bar
            hiddenCountDisplay: null, // New: Dedicated display for hidden count
            statusMonitorDisplay: null, // NEW: For the uptime/downtime monitor
        },
        valueChangeListeners: [],
        sessionCompleted: new Set(), // Phase15: URLs completed this session
        isLogCollapsed: localStorage.getItem('fab_helper_log_collapsed') === 'true' || false, // 日志面板折叠状态
        networkAnalyzerTimer: null, // For network analyzer heartbeat
        isThrottled: false, // NEW: Is the script currently in a globally throttled state?
        serverState: 'OK', // NEW: 'OK', 'THROTTLED'
        lastOKTimestamp: null, // NEW
        last429Timestamp: null, // NEW
        statusMonitorTimer: null, // NEW
    };

    // --- 模块三: 日志与工具函数 (Logger & Utilities) ---
    const Utils = {
        logger: (type, ...args) => {
            console[type](`${Config.SCRIPT_NAME}`, ...args);
            // The actual logging to screen will be handled by the UI module
            // to keep modules decoupled.
            if (State.UI.logPanel) {
                const logEntry = document.createElement('div');
                logEntry.style.cssText = 'padding: 2px 4px; border-bottom: 1px solid #444; font-size: 11px;';
                const timestamp = new Date().toLocaleTimeString();
                // DIAGNOSTIC UPGRADE: Properly stringify objects for detailed logging.
                logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`;
                State.UI.logPanel.prepend(logEntry);
                while (State.UI.logPanel.children.length > 100) {
                    State.UI.logPanel.removeChild(State.UI.logPanel.lastChild);
                }
            }
        },
        getText: (key, replacements = {}) => {
            let text = (Config.TEXTS[State.lang]?.[key]) || (Config.TEXTS['en']?.[key]) || '';
            for (const placeholder in replacements) {
                text = text.replace(`%${placeholder}%`, replacements[placeholder]);
            }
            return text;
        },
        detectLanguage: () => {
            State.lang = window.location.href.includes('/zh-cn/') ? 'zh' : 'en';
        },
        waitForElement: (selector, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    const element = document.querySelector(selector);
                    if (element) {
                        clearInterval(interval);
                        resolve(element);
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error(`Timeout waiting for selector: ${selector}`));
                }, timeout);
            });
        },
        waitForButtonEnabled: (button, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    if (button && !button.disabled) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error('Timeout waiting for button to be enabled.'));
                }, timeout);
            });
        },
        isElementInViewport: (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        },
        // This function is now for UI display purposes only.
        getDisplayPageFromUrl: (url) => {
            if (!url) return '1';
            try {
                const urlParams = new URLSearchParams(new URL(url).search);
                const cursor = urlParams.get('cursor');
                if (!cursor) return '1';

                // Try to decode offset-based cursors for a nice page number display.
                if (cursor.startsWith('bz')) {
                    const decoded = atob(cursor);
                    const offsetMatch = decoded.match(/o=(\d+)/);
                    if (offsetMatch && offsetMatch[1]) {
                        const offset = parseInt(offsetMatch[1], 10);
                        const pageSize = 24;
                        const pageNum = Math.round((offset / pageSize) + 1);
                        return pageNum.toString();
                    }
                }
                // For timestamp-based cursors, we can't calculate a page number.
                return 'Cursor Mode';
            } catch (e) {
                return '...';
            }
        },
        getCookie: (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        },
        // Simulates a more forceful click by dispatching mouse events, which can succeed
        // where a simple .click() is ignored by a framework's event handling.
        deepClick: (element) => {
            if (!element) return;
            // A small delay to ensure the browser's event loop is clear and any framework
            // event listeners on the element have had a chance to attach.
            setTimeout(() => {
            const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

            Utils.logger('info', `Performing deep click on element: <${element.tagName.toLowerCase()} class="${element.className}">`);

                // Add pointerdown for modern frameworks
                const pointerDownEvent = new PointerEvent('pointerdown', { view: pageWindow, bubbles: true, cancelable: true });
            const mouseDownEvent = new MouseEvent('mousedown', { view: pageWindow, bubbles: true, cancelable: true });
            const mouseUpEvent = new MouseEvent('mouseup', { view: pageWindow, bubbles: true, cancelable: true });

                element.dispatchEvent(pointerDownEvent);
            element.dispatchEvent(mouseDownEvent);
            element.dispatchEvent(mouseUpEvent);
            // Also trigger the standard click for maximum compatibility.
            element.click();
            }, 50); // 50ms delay
        },
        cleanup: () => {
            if (State.watchdogTimer) {
                clearInterval(State.watchdogTimer);
                State.watchdogTimer = null;
            }
            State.valueChangeListeners.forEach(id => {
                try {
                    GM_removeValueChangeListener(id);
                } catch (e) { /* Ignore errors */ }
            });
            State.valueChangeListeners = [];

            // --- NEW: Expanded & More Robust Cleanup for Hot-Reload ---
            // 1. Remove UI - Forcefully find and remove by ID, don't rely on state.
            const oldContainer = document.getElementById(Config.UI_CONTAINER_ID);
            if (oldContainer) {
                oldContainer.remove();
                Utils.logger('info', 'Old UI container found and removed by ID during cleanup.');
            }
            State.UI = {}; // Reset UI state object

            // 2. Remove Stylesheet
            const styleSheet = document.querySelector('style[data-fab-helper-style]');
            if (styleSheet) styleSheet.remove();

            // 3. Disconnect main observer
            if (State.mainObserver) {
                State.mainObserver.disconnect();
                State.mainObserver = null;
            }

            // Clear the network analyzer heartbeat timer
            if (State.networkAnalyzerTimer) {
                clearInterval(State.networkAnalyzerTimer);
                State.networkAnalyzerTimer = null;
            }

            // Restore the original XHR function to prevent stacking wrappers on hot-reload
            if (unsafeWindow.originalXHRSend) {
                XMLHttpRequest.prototype.send = unsafeWindow.originalXHRSend;
                delete unsafeWindow.originalXHRSend;
                Utils.logger('info', 'Original XHR function has been restored.');
            }

            // Restore the original XHR open function
            if (unsafeWindow.originalXHROpen) {
                XMLHttpRequest.prototype.open = unsafeWindow.originalXHROpen;
                delete unsafeWindow.originalXHROpen;
                Utils.logger('info', 'Original XHR open function has been restored.');
            }

            // NEW: Restore the original fetch function for hot-reload safety
            if (unsafeWindow.originalFetch) {
                unsafeWindow.fetch = unsafeWindow.originalFetch;
                delete unsafeWindow.originalFetch;
                Utils.logger('info', 'Original fetch function has been restored.');
            }

            // 4. Remove sessionCompleted set to clear session state on reload
            State.sessionCompleted = new Set();

            // 5. Clean up window properties
            try {
                delete unsafeWindow.FabHelperShowAdvanced;
                delete unsafeWindow.FabHelperHideAdvanced;
                delete unsafeWindow.FabHelperResetData;
            } catch (e) {
                Utils.logger('warn', 'Could not clean up unsafeWindow properties.', e);
            }

            // NEW: Reset the one-time patch flag on cleanup
            State.patchHasBeenApplied = false;
        }
    };

    // --- 模块四: 异步网络请求 (Promisified GM_xmlhttpRequest) ---
    const API = {
        gmFetch: (options) => {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    anonymous: false,
                    ...options,
                    onload: (response) => {
                        // Success case: clear network error counter
                        State.networkErrorCount = 0;
                        // Handle 429 specifically for throttling
                        if (response.status === 429) {
                            StatusManager.enterThrottledState();
                        }
                        resolve(response);
                    },
                    onerror: (error) => {
                        Utils.logger('error', `[API] Network Error: ${error.error || 'Unknown'}`);
                        State.networkErrorCount++;
                        StatusManager.checkForNetworkInstability();
                        reject(new Error(`Network Error: ${error.error || 'Request failed'}`));
                    },
                    ontimeout: () => {
                        Utils.logger('error', `[API] Request Timed Out: ${options.url}`);
                        State.networkErrorCount++;
                        StatusManager.checkForNetworkInstability();
                        reject(new Error('Request timed out.'));
                    },
                    onabort: () => {
                        Utils.logger('warn', `[API] Request Aborted: ${options.url}`);
                        // Aborts are usually intentional, so don't count as errors
                        reject(new Error('Request aborted.'));
                    }
                });
            });
        },
        // Function to check ownership of multiple listing IDs via the API.
        checkOwnership: async (listingIds) => {
             const csrfToken = Utils.getCookie('fab_csrftoken');
             if (!csrfToken) throw new Error("CSRF token not found.");

             const statesUrl = new URL('https://www.fab.com/i/users/me/listings-states');
             listingIds.forEach(uid => statesUrl.searchParams.append('listing_ids', uid));

             const response = await API.gmFetch({
                 method: 'GET',
                 url: statesUrl.href,
                 headers: {
                    'x-csrftoken': csrfToken,
                    'x-requested-with': 'XMLHttpRequest'
                 }
             });

             const statesData = JSON.parse(response.responseText);
             const ownedMap = {};
             statesData.forEach(s => {
                 if (s.acquired) {
                     ownedMap[s.uid] = true;
                 }
             });
             return ownedMap;
        },
    };


    // --- 模块五: 数据库交互 (Database Interaction) ---
    const Database = {
        load: async () => {
            // "To-Do" list is now session-only and starts empty on each full page load.
            State.db.todo = [];
            State.db.done = await GM_getValue(Config.DB_KEYS.DONE, []);
            State.db.failed = await GM_getValue(Config.DB_KEYS.FAILED, []);
            State.hideSaved = await GM_getValue(Config.DB_KEYS.HIDE, false);
            // Load Page Patcher settings into state
            State.isPagePatchingEnabled = await GM_getValue(Config.DB_KEYS.PATCH_ENABLED, false);
            State.savedCursor = await GM_getValue(Config.DB_KEYS.SAVED_CURSOR, null);

            Utils.logger('info', Utils.getText('log_db_loaded'), `(Session) To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
        },
        // saveTodo is no longer needed as the todo list is not persisted across sessions.
        saveDone: () => GM_setValue(Config.DB_KEYS.DONE, State.db.done),
        saveFailed: () => GM_setValue(Config.DB_KEYS.FAILED, State.db.failed),
        saveHidePref: () => GM_setValue(Config.DB_KEYS.HIDE, State.hideSaved),

        resetAllData: async () => {
            if (window.confirm('您确定要清空所有本地存储的脚本数据（已完成、失败列表）吗？待办列表也会被清空。此操作不可逆！')) {
                // No need to delete TODO, it's session-based. Just clear the state.
                State.db.todo = [];
                await GM_deleteValue(Config.DB_KEYS.DONE);
                await GM_deleteValue(Config.DB_KEYS.FAILED);
                State.db.done = [];
                State.db.failed = [];
                Utils.logger('info', '所有脚本数据已重置。');
                UI.removeAllOverlays();
                UI.update();
            }
        },

        isDone: (url) => {
            if (!url) return false;
            return State.db.done.includes(url.split('?')[0]);
        },
        isTodo: (url) => {
             if (!url) return false;
            const cleanUrl = url.split('?')[0];
            return State.db.todo.some(task => task.url === cleanUrl);
        },
        markAsDone: async (task) => {
            if (!task || !task.url) {
                Utils.logger('error', 'Critical Error: markAsDone received invalid task:', JSON.stringify(task));
                return;
            }

            const cleanUrl = task.url.split('?')[0];
            // The task is already removed from the 'todo' list by the dispatcher.
            // This function's only responsibility is to add it to the 'done' list.
            if (!Database.isDone(cleanUrl)) {
                State.db.done.push(cleanUrl);
                await Database.saveDone();
            }
        },
        markAsFailed: async (task) => {
            if (!task || !task.uid) {
                Utils.logger('error', 'Critical Error: markAsFailed received invalid task:', JSON.stringify(task));
                return;
            }

            // The task is already removed from the 'todo' list by the dispatcher.
            // This function's only responsibility is to add it to the 'failed' list for later retry.
            if (!State.db.failed.some(f => f.uid === task.uid)) {
                State.db.failed.push(task);
                await Database.saveFailed();
            }
        },
    };

    // --- NEW v1.1.0: Unified Status Manager ---
    const StatusManager = {
        init: () => {
            // This listener persists throttle state across tabs
            GM_addValueChangeListener(Config.DB_KEYS.THROTTLE_INFO, (key, oldVal, newVal) => {
                if (newVal && newVal.isThrottled) {
                    State.scriptStatus = 'THROTTLED';
                    Utils.logger('warn', '[跨页面同步] 检测到节流状态，已同步。');
                } else {
                    // Only switch to IDLE if not actively doing something else
                    if (State.scriptStatus === 'THROTTLED') {
                        State.scriptStatus = 'IDLE';
                    }
                }
                UI.update();
            });
            // Periodically update the UI
            setInterval(UI.update, 1000);
            // Load initial state
            StatusManager.loadThrottleState();
        },

        isThrottled: () => State.scriptStatus === 'THROTTLED',
        isUnstable: () => State.scriptStatus === 'UNSTABLE',

        loadThrottleState: async () => {
            const info = await GM_getValue(Config.DB_KEYS.THROTTLE_INFO, { isThrottled: false, startTime: 0 });
            if (info.isThrottled) {
                const now = Date.now();
                const cooldownEnd = info.startTime + 65000; // 65s cooldown
                if (now < cooldownEnd) {
                    State.scriptStatus = 'THROTTLED';
                    Utils.logger('info', '加载时恢复节流状态。');
                    // Set a timer to automatically end throttling
                    setTimeout(StatusManager.exitThrottledState, cooldownEnd - now);
                } else {
                    // Cooldown has expired
                    StatusManager.exitThrottledState();
                }
            }
        },

        enterThrottledState: () => {
            if (StatusManager.isThrottled()) return; // Already throttled
            Utils.logger('error', '🚨 [状态变更] => 服务器节流中 (THROTTLED)');
            State.scriptStatus = 'THROTTLED';
            const throttleInfo = { isThrottled: true, startTime: Date.now() };
            GM_setValue(Config.DB_KEYS.THROTTLE_INFO, throttleInfo);
            // Set a timer to automatically end throttling after 65 seconds
            setTimeout(StatusManager.exitThrottledState, 65000);
            UI.update();
        },

        exitThrottledState: () => {
            Utils.logger('info', '✅ [状态变更] => 节流冷却结束，恢复至 空闲 (IDLE)');
            State.scriptStatus = 'IDLE';
            GM_setValue(Config.DB_KEYS.THROTTLE_INFO, { isThrottled: false, startTime: 0 });
            UI.update();
        },

        checkForNetworkInstability: () => {
            const MAX_ERRORS = 3;
            if (State.networkErrorCount >= MAX_ERRORS && !StatusManager.isUnstable()) {
                Utils.logger('error', `🚨 [状态变更] => ${MAX_ERRORS} 次连续网络错误，网络不稳定 (UNSTABLE)`);
                State.scriptStatus = 'UNSTABLE';
                // When unstable, stop all execution.
                if (State.isExecuting) {
                    TaskRunner.toggleExecution(); // This will stop it
                }
                UI.update();
            }
        },

        setStatus: (newStatus) => {
            if (State.scriptStatus === newStatus) return;
            // Never override a more severe state with a less severe one
            if ((StatusManager.isThrottled() || StatusManager.isUnstable()) && (newStatus === 'IDLE' || newStatus === 'ACTIVE')) {
                return;
            }
            State.scriptStatus = newStatus;
            Utils.logger('info', `[状态变更] => ${newStatus}`);
            UI.update();
        }
    };

    // --- 模块六: 网络请求过滤器 (Network Filter) ---
    const NetworkFilter = {
        init: () => {
            // This feature requires Tampermonkey v4.12+ or a manager supporting GM_webRequest.
            if (typeof GM_webRequest === 'undefined') {
                Utils.logger('warn', 'Resource blocking is disabled (GM_webRequest API not found).');
                return;
            }

            Utils.logger('info', 'Initializing domain-specific network filter for fab.com.');

            const resourceTypesToBlock = new Set(['image', 'media', 'font']);

            try {
                GM_webRequest(
                    [
                        // Rule #6: This selector is now domain-specific. It will only match requests
                        // to fab.com and its subdomains (like www.fab.com, cdn.fab.com, etc.).
                        { selector: '*://*.fab.com/*', action: 'cancel' }
                    ],
                    (info, message, details) => {
                        // Because the selector already filtered by domain, we only need to check the type.
                        if (resourceTypesToBlock.has(details.type)) {
                            // Add logging for transparency, so the user knows the filter is working.
                            Utils.logger('info', `Blocking resource [${details.type}]: ${details.url}`);
                            // Cancel the request if its type is in our block set.
                            return { cancel: true };
                        }
                        // For any other request type to fab.com (like 'script', 'xhr'), we do nothing.
                    }
                );
            } catch (e) {
                 Utils.logger('error', 'Failed to initialize GM_webRequest filter:', e.message);
            }
        }
    };


    // --- 模块七: 任务运行器与事件处理 (Task Runner & Event Handlers) ---
    const TaskRunner = {
        // --- Initialization ---
        init: () => {
            // This is the single listener on the main tab that reacts to workers finishing.
            // It listens on ONE specific key. All workers report to this same key.
            GM_addValueChangeListener(Config.DB_KEYS.WORKER_DONE, async (key, oldValue, newValue, remote) => {
                // --- DIAGNOSTIC PROBE ---
                // Log every event this listener receives, BEFORE any filtering.
                Utils.logger('debug', `[Listener Probe] Received event for key "${key}"`, { hasNewValue: !!newValue, isRemote: remote });

                // We only care about new values being set. The `!remote` check was removed as it was suspected to be faulty.
                if (!newValue) return;

                // IMPORTANT: Immediately delete the value to act like a queue,
                // making it ready for the next worker to report.
                await GM_deleteValue(Config.DB_KEYS.WORKER_DONE);

                const { workerId, success, logs, task, errorType } = newValue;

                // It's possible we receive a report for a worker we don't know about
                // (e.g., after a script hot-reload). We should still process it.
                if (!task) {
                    Utils.logger('warn', 'Received a worker report with no task data. Ignoring.');
                    return;
                }

                // Log the report from the worker
                Utils.logger('info', '--- Log Report from Worker [%s] ---', workerId.substring(0, 12));
                logs.forEach(log => Utils.logger('info', log));
                Utils.logger('info', '--- End Log Report ---');

                // FIX: Centralized state management in the main tab.
                // The main tab is now responsible for updating the database.
                if (success) {
                    await Database.markAsDone(task);
                    // CRITICAL FIX: After a task is marked as done, immediately
                    // call runHideOrShow to update the UI (apply overlays or hide).
                    TaskRunner.runHideOrShow();
                } else {
                    // Only mark as failed if it was a real failure, not an "already owned" case.
                    if (errorType) {
                        await Database.markAsFailed(task);
                    }
                }

                // --- DIAGNOSTIC PROBE & CRITICAL FIX ---
                // This is the most likely failure point. We MUST know if the worker is being tracked.
                if (State.runningWorkers[workerId]) {
                    delete State.runningWorkers[workerId];
                    State.activeWorkers--;
                    Utils.logger('debug', `[Listener] Worker ${workerId.substring(0, 4)} was tracked. Active workers now: ${State.activeWorkers}`);
                } else {
                    Utils.logger('error', `[Listener] CRITICAL: Received report from UNTRACKED worker: ${workerId}. The 'activeWorkers' count will NOT be decremented. This is the likely cause of the stall.`);
                    // As a fallback, we decrement the counter anyway if it's above zero,
                    // to prevent a permanent stall, although this indicates a state mismatch.
                    if (State.activeWorkers > 0) {
                        State.activeWorkers--;
                         Utils.logger('warn', `[Listener] Fallback activated. Decrementing active workers to ${State.activeWorkers} to prevent stall.`);
                    }
                }

                if (success) {
                    State.executionCompletedTasks++;
                    State.sessionPursuitCompletedCount++; // Increment session counter for Smart Pursuit

                    // Auto-hide the completed item if the feature is enabled
                    if (State.hideSaved) {
                        runHideOrShow();
                    }

                } else {
                    State.executionFailedTasks++;
                }

                // Check if Smart Pursuit should trigger a new scan
                if (State.isSmartPursuitEnabled && State.sessionPursuitCompletedCount >= Config.SMART_PURSUIT_THRESHOLD) {
                    if (StatusManager.isThrottled()) {
                        Utils.logger('warn', '[节流] 服务器节流中，"智能追击"自动扫描已跳过。');
                    } else {
                        Utils.logger('info', `[智能追击] 已完成 ${State.sessionPursuitCompletedCount} 个任务, 达到阈值! 自动触发新一轮扫描...`);
                        TaskRunner.processPageWithApi({ autoAdd: true });
                    }
                    State.sessionPursuitCompletedCount = 0; // Reset counter regardless
                }

                // If execution is still active, try to dispatch more tasks.
                if (State.isExecuting) {
                    TaskRunner.executeBatch();
                }
                UI.update(); // Update UI with progress
            });
            State.valueChangeListeners.push(Config.DB_KEYS.WORKER_DONE); // Keep track for cleanup
        },

        // --- Toggles ---
        toggleRecon: async () => {
            if (StatusManager.isThrottled() || StatusManager.isUnstable()) {
                Utils.logger('warn', '[状态异常] 侦察功能已禁用。');
                return;
            }
            State.isReconning = !State.isReconning;
            UI.update();
            if (State.isReconning) {
                State.totalTasks = 0;
                State.completedTasks = 0;
                Utils.logger('info', Utils.getText('log_recon_start'));
                const nextUrl = await GM_getValue(Config.DB_KEYS.NEXT_URL, null);
                if (nextUrl) {
                    Utils.logger('info', `Resuming recon from saved URL.`);
                }
                TaskRunner.reconWithApi(nextUrl);
            } else {
                Utils.logger('info', 'Reconnaissance stopped by user.');
            }
        },
        // This is now the dedicated function for starting the execution loop.
        // It ensures the main page never navigates away.
        startExecution: () => {
            if (State.isExecuting) {
                Utils.logger('info', '执行器已在运行中，新任务已加入队列等待处理。');
                if (State.db.todo.length > State.executionTotalTasks) {
                    State.executionTotalTasks = State.db.todo.length;
                }
                return;
            }
            if (State.db.todo.length === 0) {
                Utils.logger('info', '"待办"清单是空的，无需启动。');
                return;
            }
            if (StatusManager.isThrottled() || StatusManager.isUnstable()) {
                Utils.logger('warn', `[状态异常] 任务执行被阻止。当前状态: ${State.scriptStatus}`);
                return;
            }
            Utils.logger('info', `队列中有 ${State.db.todo.length} 个任务，即将开始执行...`);
            State.isExecuting = true;
            StatusManager.setStatus('ACTIVE');
            State.executionTotalTasks = State.db.todo.length;
            State.executionCompletedTasks = 0;
            State.executionFailedTasks = 0;
            TaskRunner.executeBatch();
            UI.update();
        },

        hotReloadScript: async () => {
            // --- Phase 1: Safety Lock ---
            if (State.isExecuting || State.isReconning || State.activeWorkers > 0) {
                alert(`[安全警告]\n\n检测到有任务正在后台运行，此时热更新可能会导致数据丢失或脚本崩溃。\n\n请先点击"停止"按钮，并等待所有任务完成后，再进行热更新操作。`);
                Utils.logger('warn', 'Hot-reload aborted by safety lock because tasks are running.');
                return;
            }

            // --- Phase 2: Core Reload Logic ---
            const executeReload = (newScriptCode) => {
                if (!newScriptCode || newScriptCode.trim() === '') {
                    Utils.logger('info', '热更新已取消，因为没有提供代码。');
                    return;
                }
                if (!window.confirm('代码已准备就绪。确定要清理旧脚本并执行新代码吗？')) {
                    Utils.logger('info', '用户取消了热更新操作。');
                    return;
                }
                Utils.logger('info', '开始热更新... 清理旧脚本实例...');
                try {
                    Utils.cleanup();
                    if (unsafeWindow.fabHelperEntryObserver) {
                        unsafeWindow.fabHelperEntryObserver.disconnect();
                        delete unsafeWindow.fabHelperEntryObserver;
                    }
                    Utils.logger('info', '清理完成。即将执行新脚本代码...');
                    setTimeout(() => {
                        try {
                            eval(newScriptCode);
                        } catch (e) {
                            console.error('【热更新失败】新脚本执行时发生致命错误:', e);
                            alert(`热更新失败！新脚本执行时发生错误，请检查控制台日志并刷新页面。\n\n错误信息: ${e.message}`);
                        }
                    }, 0);
                } catch (error) {
                    Utils.logger('error', '【热更新失败】清理旧脚本时发生错误:', error);
                    alert(`热更新失败！清理旧脚本时发生错误，请刷新页面。\n\n错误信息: ${error.message}`);
                }
            };

            // --- Phase 3: Get Code (Clipboard with Prompt Fallback) ---
            try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim().includes('// ==UserScript==')) {
                    Utils.logger('info', '成功从剪贴板读取代码。');
                    executeReload(text);
                } else {
                    Utils.logger('info', '剪贴板为空或内容不合法，回退到手动粘贴。');
                    const newCode = prompt('=== 脚本热更新 ===\n\n读取剪贴板失败或内容无效，请手动粘贴您的最新脚本代码。', '');
                    executeReload(newCode);
                }
            } catch (err) {
                Utils.logger('error', '读取剪贴板失败 (可能是权限问题)，回退到手动粘贴:', err.name, err.message);
                const newCode = prompt('=== 脚本热更新 ===\n\n读取剪贴板失败 (可能是权限问题)，请手动粘贴您的最新脚本代码。', '');
                executeReload(newCode);
            }
        },

        // This function is now obsolete and replaced by start/stopExecution.
        toggleExecution: undefined,

        toggleHideSaved: async () => {
            State.hideSaved = !State.hideSaved;
            await Database.saveHidePref();

            // 移除所有卡片的"已处理"标记，以强制全局刷新
            document.querySelectorAll('.fab-helper-processed').forEach(card => {
                card.classList.remove('fab-helper-processed');
            });
            Utils.logger('info', '强制全局刷新：所有卡片的"已处理"状态已被重置。');

            TaskRunner.runHideOrShow();
        },

        resetReconProgress: async () => {
            if (State.isReconning) {
                Utils.logger('warn', 'Cannot reset progress while recon is active.');
                return;
            }
            if (StatusManager.isThrottled() || StatusManager.isUnstable()) {
                 Utils.logger('warn', '[状态异常] 无法重置侦察进度。');
                 return;
            }
            await GM_deleteValue(Config.DB_KEYS.NEXT_URL);
            if (State.UI.reconProgressDisplay) {
                State.UI.reconProgressDisplay.textContent = 'Page: 1';
            }
            Utils.logger('info', 'Recon progress has been reset. Next scan will start from the beginning.');
        },

        refreshVisibleStates: async () => {
            if (StatusManager.isThrottled() || StatusManager.isUnstable()) {
                Utils.logger('warn', '[状态异常] "同步状态"操作已自动取消。');
                return;
            }
            Utils.logger('info', '[状态同步] 已触发。正在通过API获取可见项目的最新状态...');

            const cardSelector = Config.SELECTORS.card;
            const linkSelector = Config.SELECTORS.cardLink;

            const cards = Array.from(document.querySelectorAll(cardSelector)).filter(card => Utils.isElementInViewport(card));
            if (cards.length === 0) {
                Utils.logger('info', '在可视区域内没有发现可刷新的项目。');
                return;
            }

            const listingIds = cards.map(card => {
                const link = card.querySelector(linkSelector);
                return link ? link.href.split('/listings/')[1]?.split('?')[0] : null;
            }).filter(id => id);

            if (listingIds.length === 0) {
                Utils.logger('warn', '无法从可见卡片中提取任何有效的项目ID。');
                return;
            }

            try {
                Utils.logger('info', `正在通过API查询 ${listingIds.length} 个项目的最新所有权...`);
                const ownedMap = await API.checkOwnership(listingIds);

                let updatedCount = 0;
                cards.forEach(card => {
                    const link = card.querySelector(linkSelector);
                    if (!link) return;
                    const listingId = link.href.split('/listings/')[1]?.split('?')[0];
                    const cardText = card.textContent || '';
                    const isNativelyOwned = [...Config.SAVED_TEXT_SET].some(s => cardText.includes(s));

                    // If API says owned, but the card does not natively show it...
                    if (listingId && ownedMap[listingId] && !isNativelyOwned) {
                        // Find the container of the text elements.
                        const textContainer = card.querySelector('a[href*="/listings/"]').closest('div.fabkit-Stack--column');
                        if (textContainer && textContainer.lastElementChild) {
                            // The last element is likely the price or action button. Replace it.
                            const ownedBadge = document.createElement('div');
                            ownedBadge.className = 'fabkit-Typography-root fabkit-Typography--align-start fabkit-Typography--intent-success fabkit-Text--sm fabkit-Text--regular fabkit-Stack-root fabkit-Stack--align_center fabkit-scale--gapX-spacing-1 fabkit-scale--gapY-spacing-1';
                            const icon = document.createElement('i');
                            icon.className = 'fabkit-Icon-root fabkit-Icon--intent-success fabkit-Icon--xs edsicon edsicon-check-circle-filled';
                            icon.setAttribute('aria-hidden', 'true');
                            ownedBadge.appendChild(icon);
                            ownedBadge.appendChild(document.createTextNode('已保存在我的库中'));

                            textContainer.lastElementChild.replaceWith(ownedBadge);
                            updatedCount++;
                        }
                    }
                });

                if (updatedCount > 0) {
                    Utils.logger('info', `状态同步完成。${updatedCount} 个卡片的UI已更新为"已拥有"状态。`);
                    // Force re-evaluation by the hide/show logic.
                    document.querySelectorAll('.fab-helper-processed').forEach(card => {
                        card.classList.remove('fab-helper-processed');
                    });
                    TaskRunner.runHideOrShow();
                } else {
                    Utils.logger('info', '状态同步完成。未发现本地UI与服务器状态的差异。');
                }

            } catch (error) {
                Utils.logger('error', 'API状态同步期间发生错误:', error);
            }
        },

        processPageWithApi: async (options = {}) => {
            if (State.isScanning) {
                Utils.logger('warn', '扫描已在进行中，本次触发已忽略。');
                return 0;
            }
            State.isScanning = true;

            try {
                const {
                    autoAdd = false, // Automatically add to 'todo' list
                    onlyVisible = true, // Scan only visible cards on screen
                } = options;

                Utils.logger('info', Utils.getText('log_recon_start'));

                const cardSelector = Config.SELECTORS.card;
                const linkSelector = Config.SELECTORS.cardLink;
                let cards = Array.from(document.querySelectorAll(cardSelector));

                if (cards.length === 0) {
                    Utils.logger('warn', '在当前页面上没有发现任何项目卡片。');
                    return 0;
                }

                if (onlyVisible) {
                    cards = cards.filter(card => Utils.isElementInViewport(card));
                    if (cards.length === 0) {
                        Utils.logger('info', '在可视区域内没有发现新的项目卡片。');
                        return 0;
                    }
                }

                // API check is now removed. We scan against the local state only.
                Utils.logger('info', `[本地扫描] 正在检查 ${cards.length} 个可见项目...`);

                const newItems = [];
                cards.forEach(card => {
                    const link = card.querySelector(linkSelector);
                    if (!link) return;

                    const url = link.href.split('?')[0];
                    const listingId = url.split('/listings/')[1];

                    // NEW: Check if the task is already being processed by a worker
                    const isBeingProcessed = Object.values(State.runningWorkers).some(worker => worker.task.url === url);

                    // NEW: Check the card's text content for any "owned" keywords.
                    const cardText = card.textContent || '';
                    const isNativelyOwned = [...Config.SAVED_TEXT_SET].some(s => cardText.includes(s));

                    // Add to list ONLY IF it has an ID, is not in Done/To-Do/In-Progress lists, AND is not natively marked as owned.
                    if (listingId && !Database.isDone(url) && !Database.isTodo(url) && !isNativelyOwned && !isBeingProcessed) {
                        const titleElement = card.querySelector('a[href*="/listings/"] > div');
                        const name = titleElement ? titleElement.textContent.trim() : 'Unknown Task';
                        const task = {
                            name: name,
                            url: url,
                            type: 'detail',
                            uid: listingId
                        };
                        newItems.push(task);
                        Utils.logger('log', Utils.getText('log_task_added'), name);
                    }
                });

                if (autoAdd && newItems.length > 0) {
                    State.db.todo.push(...newItems);
                    Utils.logger('info', `已将 ${newItems.length} 个新任务添加到待办队列。`);
                    UI.update(); // Immediately update UI to reflect new to-do count
                }

                Utils.logger('info', `本地扫描完成。发现 ${newItems.length} 个新项目。`);
                return newItems.length;
            } catch (error) {
                Utils.logger('error', Utils.getText('log_recon_error'), error);
                return 0;
            } finally {
                State.isScanning = false;
            }
        },

        retryFailedTasks: async () => {
            if (State.db.failed.length === 0) {
                Utils.logger('info', 'No failed tasks to retry.');
                return;
            }
            const count = State.db.failed.length;
            Utils.logger('info', `Re-queuing ${count} failed tasks...`);
            State.db.todo.push(...State.db.failed); // Append failed tasks to the end of the todo list
            State.db.failed = []; // Clear the failed list
            await Database.saveFailed();
            Utils.logger('info', `${count} tasks moved from Failed to To-Do list.`);
            UI.update(); // Force immediate UI update
        },

        // --- Core Logic Functions ---
        reconWithApi: async (url = null) => {
            if (!State.isReconning) return;

            let searchResponse = null;

            // If no URL is provided, start from the beginning.
            const requestUrl = url || `https://www.fab.com/i/listings/search?is_free=1&sort_by=-relevance&page_size=24`;

            try {
                const csrfToken = Utils.getCookie('fab_csrftoken');
                if (!csrfToken) {
                    Utils.logger('error', "CSRF token not found. Please ensure you are logged in.");
                    State.isReconning = false;
                    UI.update();
                    return;
                }

                const langPath = State.lang === 'zh' ? '/zh-cn' : '';

                const apiHeaders = {
                    'accept': 'application/json, text/plain, */*',
                    'x-csrftoken': csrfToken,
                    'x-requested-with': 'XMLHttpRequest',
                    'Referer': window.location.href,
                    'User-Agent': navigator.userAgent
                };

                // --- Step 1: Initial Scan ---
                const displayPage = Utils.getDisplayPageFromUrl(requestUrl);
                // UX Improvement: Update the progress display.
                if (State.UI.reconProgressDisplay) {
                    State.UI.reconProgressDisplay.textContent = `Page: ${displayPage}`;
                }

                Utils.logger('info', "Step 1: " + Utils.getText('log_api_request', {
                    page: displayPage,
                    scanned: State.totalTasks,
                    owned: State.completedTasks
                }));
                searchResponse = await API.gmFetch({ method: 'GET', url: requestUrl, headers: apiHeaders });

                if (searchResponse.finalUrl && new URL(searchResponse.finalUrl).pathname !== new URL(requestUrl).pathname) {
                    Utils.logger('warn', `Request was redirected, which may indicate a login issue. Final URL: ${searchResponse.finalUrl}`);
                }

                if (searchResponse.status === 429) {
                    Utils.logger('error', Utils.getText('log_429_error'));
                    await new Promise(r => setTimeout(r, 15000));
                    TaskRunner.reconWithApi(requestUrl); // Retry with the same URL
                    return;
                }

                // --- NEW: Auto-save cursor for Page Patcher ---
                // After a successful request, save its cursor as the new starting point for the next page load.
                try {
                    const currentUrl = new URL(requestUrl);
                    const currentCursor = currentUrl.searchParams.get('cursor');
                    if (currentCursor) {
                        await GM_setValue(Config.DB_KEYS.SAVED_CURSOR, currentCursor);
                        Utils.logger('info', `[侦察联动] 页面起点已自动更新为: ${currentCursor.substring(0, 20)}...`);
                    }
                } catch (e) {
                    Utils.logger('warn', 'Could not parse current URL to save cursor for patcher.', e);
                }

                const searchData = JSON.parse(searchResponse.responseText);
                const initialResultsCount = searchData.results.length;
                State.totalTasks += initialResultsCount;

                if (!searchData.results || initialResultsCount === 0) {
                    State.isReconning = false;
                    await GM_deleteValue(Config.DB_KEYS.NEXT_URL); // Recon is complete, delete the key.
                    Utils.logger('info', Utils.getText('log_recon_end'));
                    UI.update();
                    return;
                }

                // A much stricter filter to ensure we only process valid, complete item data from the API.
                const validResults = searchData.results.filter(item => {
                    const hasUid = typeof item.uid === 'string' && item.uid.length > 5;
                    const hasTitle = typeof item.title === 'string' && item.title.length > 0;
                    const hasOffer = item.startingPrice && typeof item.startingPrice.offerId === 'string' && item.startingPrice.offerId.length > 0;
                    return hasUid && hasTitle && hasOffer;
                });

                const candidates = validResults.map(item => ({
                    uid: item.uid,
                    // The API structure changed. The offerId is now in startingPrice.
                    offerId: item.startingPrice?.offerId
                })).filter(item => {
                    // This secondary filter only checks against our local database.
                    const itemUrl = `${window.location.origin}${langPath}/listings/${item.uid}`;
                    const isFailed = State.db.failed.some(failedTask => failedTask.uid === item.uid);
                    return !Database.isDone(itemUrl) && !Database.isTodo(itemUrl) && !isFailed;
                });

                const initiallySkippedCount = initialResultsCount - candidates.length;
                State.completedTasks += initiallySkippedCount;

                if (candidates.length === 0) {
                    // No new candidates on this page, go to next page
                    const nextUrl = searchData.next;
                    if (nextUrl && State.isReconning) {
                        await GM_setValue(Config.DB_KEYS.NEXT_URL, nextUrl);
                        await new Promise(r => setTimeout(r, 300));
                        TaskRunner.reconWithApi(nextUrl);
                    } else {
                         State.isReconning = false;
                         await GM_deleteValue(Config.DB_KEYS.NEXT_URL); // Recon is complete, delete the key.
                         Utils.logger('info', Utils.getText('log_recon_end'));
                    }
                    UI.update();
                    return;
                }

                // --- Step 2: Ownership Check ---
                Utils.logger('info', `Step 2: Checking ownership for ${candidates.length} candidates...`);

                const allOwnedUids = new Set();
                const CHUNK_SIZE = 8;
                const DELAY_BETWEEN_CHUNKS = 250;

                for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
                    const chunk = candidates.slice(i, i + CHUNK_SIZE);
                    const chunkUids = chunk.map(item => item.uid);

                    const statesUrl = new URL('https://www.fab.com/i/users/me/listings-states');
                    chunkUids.forEach(uid => statesUrl.searchParams.append('listing_ids', uid));

                    Utils.logger('info', `[Recon] Querying ownership for chunk ${i / CHUNK_SIZE + 1}...`);
                    const statesResponse = await API.gmFetch({ method: 'GET', url: statesUrl.href, headers: apiHeaders });

                    if (statesResponse.status !== 200) {
                        Utils.logger('warn', `[Recon] Ownership check for a chunk failed with status ${statesResponse.status}. Skipping chunk.`);
                        continue;
                    }

                    const statesData = JSON.parse(statesResponse.responseText);
                    statesData.filter(s => s.acquired).forEach(s => allOwnedUids.add(s.uid));

                    if (i + CHUNK_SIZE < candidates.length) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
                    }
                }

                // API returns an array, convert it to a Set for efficient lookup.
                const notOwnedItems = [];
                candidates.forEach(item => {
                    if (!allOwnedUids.has(item.uid)) {
                        notOwnedItems.push(item);
                    } else {
                        // This item is already owned according to the API, so we increment the owned count.
                        State.completedTasks++;
                    }
                });

                if (notOwnedItems.length === 0) {
                    Utils.logger('info', "No unowned items found in this batch.");
                } else {
                    // --- Step 3: Price Verification ---
                    Utils.logger('info', `Step 3: Verifying prices for ${notOwnedItems.length} unowned items...`);
                    const pricesUrl = new URL('https://www.fab.com/i/listings/prices-infos');
                    notOwnedItems.forEach(item => pricesUrl.searchParams.append('offer_ids', item.offerId));
                    const pricesResponse = await API.gmFetch({ method: 'GET', url: pricesUrl.href, headers: apiHeaders });
                    const pricesData = JSON.parse(pricesResponse.responseText);

                    // API returns { offers: [...] }, convert it to a Map for efficient lookup.
                    const priceMap = new Map();
                    if (pricesData.offers && Array.isArray(pricesData.offers)) {
                         pricesData.offers.forEach(offer => priceMap.set(offer.offerId, offer));
                    }

                    const newTasks = [];
                    notOwnedItems.forEach(item => {
                        const priceInfo = priceMap.get(item.offerId);
                        const originalItem = validResults.find(r => r.uid === item.uid); // Find original item to get the title
                        if (priceInfo && priceInfo.price === 0 && originalItem) {
                            const task = {
                                name: originalItem.title, // Correctly get the title from the original API result
                                url: `${window.location.origin}${langPath}/listings/${item.uid}`,
                                type: 'detail',
                                uid: item.uid
                            };
                            newTasks.push(task);
                        }
                    });

                    if (newTasks.length > 0) {
                        Utils.logger('info', Utils.getText('log_api_owned_done', { newCount: newTasks.length }));
                        State.db.todo = State.db.todo.concat(newTasks);
                        // No need to save the todo list anymore.
                        // await Database.saveTodo();
                    } else {
                        Utils.logger('info', "Found unowned items, but none were truly free after price check.");
                    }
                }


                // --- Pagination ---
                const nextUrl = searchData.next;
                if (nextUrl && State.isReconning) {
                    await GM_setValue(Config.DB_KEYS.NEXT_URL, nextUrl);
                    await new Promise(r => setTimeout(r, 500)); // Rate limit
                    TaskRunner.reconWithApi(nextUrl);
                } else {
                    State.isReconning = false;
                    await GM_deleteValue(Config.DB_KEYS.NEXT_URL); // Recon is complete, delete the key.
                    Utils.logger('info', Utils.getText('log_recon_end'));
                }

            } catch (error) {
                Utils.logger('error', Utils.getText('log_recon_error'), error.message);

                if (error instanceof SyntaxError && searchResponse?.responseText.trim().startsWith('<')) {
                    const responseSample = searchResponse.responseText.replace(/</g, '&lt;').substring(0, 500);
                    Utils.logger('error', "侦察失败：API没有返回有效数据，可能您已退出登录或网站正在维护。请尝试刷新页面或重新登录。");
                    Utils.logger('error', "Recon failed: The API returned HTML instead of JSON. You might be logged out or the site could be under maintenance. Please try refreshing or logging in again.");
                    Utils.logger('info', "API Response HTML (sample): " + responseSample);
                }

                State.isReconning = false;
            } finally {
                UI.update();
            }
        },

        // This is the watchdog timer that patrols for stalled workers.
        // It's kept as a safety net but should be less critical with the new logic.
        runWatchdog: () => {
            if (State.watchdogTimer) clearInterval(State.watchdogTimer); // Clear any existing timer

            State.watchdogTimer = setInterval(() => {
                if (!State.isExecuting || Object.keys(State.runningWorkers).length === 0) {
                    clearInterval(State.watchdogTimer);
                    State.watchdogTimer = null;
                    return;
                }

                const now = Date.now();
                const STALL_TIMEOUT = 45000; // 45 seconds

                for (const workerId in State.runningWorkers) {
                    const workerInfo = State.runningWorkers[workerId];
                    if (now - workerInfo.startTime > STALL_TIMEOUT) {
                        Utils.logger('error', `🚨 WATCHDOG: Worker [${workerId.substring(0,12)}] has stalled!`);

                        Database.markAsFailed(workerInfo.task);

                        delete State.runningWorkers[workerId];
                        State.activeWorkers--;

                        Utils.logger('info', `Stalled worker cleaned up. Active: ${State.activeWorkers}. Resuming dispatch...`);

                        TaskRunner.executeBatch();
                    }
                }
            }, 5000); // Check every 5 seconds
        },

        // --- EXECUTION CORE (REWRITTEN v1.4.1) ---
        executeBatch: async () => {
            // Safety check: if execution was stopped, do nothing.
            if (!State.isExecuting) {
                return;
            }

            // --- I. DISPATCH PHASE ---
            // This loop is the heart of the dispatcher. It fills any empty worker slots.
            while (State.activeWorkers < Config.MAX_WORKERS && State.db.todo.length > 0) {
                const task = State.db.todo.shift();
                State.activeWorkers++;
                const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                State.runningWorkers[workerId] = { task, startTime: Date.now() };

                Utils.logger('info', `🚀 Dispatching Worker [${workerId.substring(0, 12)}...] for: ${task.name}`);

                const payloadKey = `payload_${workerId}`;
                await GM_setValue(payloadKey, { task });

                const workerUrl = new URL(task.url);
                workerUrl.searchParams.set('workerId', workerId);
                GM_openInTab(workerUrl.href, { active: false, setParent: true });
            }
            UI.update(); // Update UI after dispatching

            // --- II. COMPLETION & NEXT-STEP PHASE ---
            // This check runs AFTER every dispatch attempt.
            // If the queue is empty AND all workers have finished, we decide what to do next.
            if (State.db.todo.length === 0 && State.activeWorkers === 0) {
                 if (State.isSmartPursuitEnabled && !State.isScanning) {
                     Utils.logger('info', '[智能追击] 队列已空，自动扫描新任务...');
                     State.isScanning = true; // Set lock
                     UI.update();

                     TaskRunner.processPageWithApi({ autoAdd: true }).then(newTasksCount => {
                         State.isScanning = false; // Release lock
                         if (newTasksCount > 0) {
                             Utils.logger('info', `[智能追击] 发现 ${newTasksCount} 个新任务，继续执行。`);
                             // The key to the continuous loop after a pursuit scan.
                             TaskRunner.executeBatch();
                         } else {
                             Utils.logger('info', '[智能追击] 未发现新任务，执行周期结束。');
                             TaskRunner.stopExecution();
                         }
                     }).catch(error => {
                         State.isScanning = false; // Ensure lock is released
                         Utils.logger('error', '[智能追击] 扫描时发生错误:', error);
                         TaskRunner.stopExecution();
                     });
                 } else if (!State.isSmartPursuitEnabled && !State.isScanning) {
                     // Smart pursuit is off, and not scanning, so we are truly done.
                     Utils.logger('info', '✅ 🎉 所有任务已完成，且智能追击已关闭。执行结束。');
                     TaskRunner.stopExecution();
                 }
                 // If a scan is already in progress, we do nothing. The next call will happen
                 // when that scan completes and calls executeBatch.
            }
        },

        processDetailPage: async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const workerId = urlParams.get('workerId');
            if (!workerId) return;

            const payloadKey = `payload_${workerId}`;
            const payload = await GM_getValue(payloadKey);
            await GM_deleteValue(payloadKey); // Clean up payload immediately

            if (!payload || !payload.task) {
                // Stray worker, close immediately.
                window.close();
                return;
            }

            const currentTask = payload.task;
            const logBuffer = [`[Worker ${workerId.substring(0, 4)}] Started: ${currentTask.name}`];
            let success = false;
            let errorType = null;

            // --- Full UI Interaction Logic (Restored from Git History & Adapted for Worker Model) ---
            const isItemOwned = () => {
                const criteria = Config.OWNED_SUCCESS_CRITERIA;
                const successHeader = document.querySelector('h2');
                if (successHeader && criteria.h2Text.some(text => successHeader.textContent.includes(text))) {
                    return { owned: true, reason: `H2 text "${successHeader.textContent}"` };
                }
                const ownedButton = [...document.querySelectorAll('button, a.fabkit-Button-root')].find(btn =>
                    criteria.buttonTexts.some(keyword => btn.textContent.includes(keyword))
                );
                if (ownedButton) {
                    return { owned: true, reason: `Button text "${ownedButton.textContent}"` };
                }
                return { owned: false };
            };

            try {
                // Step 1: Initial Check. If already owned, report success and exit.
                const initialState = isItemOwned();
                if (initialState.owned) {
                    logBuffer.push(`Already owned on page load (Reason: ${initialState.reason}).`);
                    success = true;
                    throw new Error("ALREADY_OWNED"); // Use error for control flow to reach finally block
                }

                // Step 2: Handle Multi-License Items
                const licenseButton = [...document.querySelectorAll('button')].find(btn => btn.textContent.includes('选择许可'));
                if (licenseButton) {
                    logBuffer.push(`Multi-license item detected. Clicking '选择许可'.`);
                    Utils.deepClick(licenseButton);
                    await new Promise(r => setTimeout(r, 500)); // Wait for dropdown

                    const listbox = await Utils.waitForElement('div[role="listbox"]');
                    const freeOption = [...listbox.querySelectorAll('[role="option"]')].find(el => el.textContent.includes('免费'));

                    if (freeOption) {
                        logBuffer.push(`Found and clicking '免费' license option.`);
                        Utils.deepClick(freeOption);
                        await new Promise(r => setTimeout(r, 500)); // Wait for UI to update
                    } else {
                        throw new Error('Could not find a "免费" license option in the dropdown.');
                    }
                }

                // Step 3: Find and click the standard 'Add to my library' button
                const actionButton = [...document.querySelectorAll('button')].find(btn =>
                    [...Config.ACQUISITION_TEXT_SET].some(keyword => btn.textContent.trim() === keyword)
                );

                if (actionButton) {
                    logBuffer.push(`Found acquisition button: "${actionButton.textContent}". Clicking.`);
                    await Utils.waitForButtonEnabled(actionButton);
                    Utils.deepClick(actionButton);

                    // Step 4: Wait for the page state to change to "owned"
                    await new Promise((resolve, reject) => {
                        const timeout = 10000;
                        const interval = setInterval(() => {
                            const currentState = isItemOwned();
                            if (currentState.owned) {
                                logBuffer.push(`Acquisition confirmed by UI change (Reason: ${currentState.reason}).`);
                                clearInterval(interval);
                                resolve();
                            }
                        }, 200);
                        setTimeout(() => {
                            clearInterval(interval);
                            reject(new Error(`Timeout waiting for page to enter an 'owned' state after click.`));
                        }, timeout);
                    });
                    success = true;
                } else {
                    // If after all checks, no button is found, it's a failure.
                    throw new Error('Could not find any actionable acquisition button.');
                }

            } catch (error) {
                if (error.message !== "ALREADY_OWNED") {
                    logBuffer.push(`Acquisition FAILED: ${error.message}`);
                    success = false;
                    errorType = 'WORKER_UI_FAILURE';
                }
            } finally {
                if (success) {
                    logBuffer.push(`✅ Task reported as DONE.`);
                } else if (errorType) { // Only log failure if it wasn't an "already owned" case
                    logBuffer.push(`❌ Task reported as FAILED.`);
                }
                // ALL workers now report to the *exact same* key.
                await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                    workerId, success, logs: logBuffer, task: currentTask, errorType
                });

                // --- CRITICAL FIX ---
                // Add a small delay to ensure GM_setValue has time to propagate before the tab closes.
                await new Promise(resolve => setTimeout(resolve, 250));

                window.close();
            }
        },

        advanceDetailTask: async (batchId, taskPayload, success, logBuffer = []) => {
            // This function is now obsolete in the worker-per-task model
        },

        runHideOrShow: async () => {
            // This function now handles both hiding and applying overlays.
            const cards = document.querySelectorAll(Config.SELECTORS.card);
            let hiddenCount = 0;

            for (const card of cards) {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                if (!link) continue;

                const url = link.href.split('?')[0];
                const isDone = Database.isDone(url);
                const isNativelyOwned = [...Config.SAVED_TEXT_SET].some(s => (card.textContent || '').includes(s));
                const isOwned = isDone || isNativelyOwned;

                if (isOwned) {
                    if (State.hideSaved) {
                        card.style.display = 'none';
                        hiddenCount++;
                    } else {
                        card.style.display = ''; // Ensure it's visible
                        UI.applyOverlay(card, 'owned');
                    }
                } else {
                    // If not owned, ensure it's visible and has no overlay
                    card.style.display = '';
                    const overlay = card.querySelector('.fab-helper-overlay-v8');
                    if (overlay) overlay.remove();
                }
            }
            State.hiddenThisPageCount = hiddenCount;
            UI.update(); // Update the counter in the main UI
        },

        // --- NEW: Cooldown UI Logic ---
        // This entire function is now obsolete and replaced by StatusManager
        initiateCooldownSequence: async () => {},

        // NEW: Centralized Stop Execution Logic
        stopExecution: () => {
            if (!State.isExecuting && State.scriptStatus === 'IDLE') return; // Already stopped

            Utils.logger('info', '执行已停止。');
            State.isExecuting = false;
            StatusManager.setStatus('IDLE');
            State.runningWorkers = {}; // Clear any tracked workers
            // We don't reset activeWorkers here, as a final report might still come in.
            // The new logic is robust enough to handle this.
            State.executionTotalTasks = 0;
            State.executionCompletedTasks = 0;
            State.executionFailedTasks = 0;
            UI.update();
        }
    };


    // --- 模块八: 用户界面 (User Interface) ---
    const UI = {
        create: () => {
            // Do not create the main UI on worker tabs.
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('workerId')) {
                return;
            }

            if (document.getElementById(Config.UI_CONTAINER_ID)) return;

            // --- Style Injection ---
            const styles = `
                :root {
                    --bg-color: rgba(28, 28, 30, 0.9);
                    --bg-color-light: rgba(255, 255, 255, 0.08);
                    --bg-color-dark: rgba(0, 0, 0, 0.15);
                    --border-color: rgba(255, 255, 255, 0.15);
                    --text-color-primary: #f5f5f7;
                    --text-color-secondary: #a0a0a5;
                    --radius-l: 16px;
                    --radius-m: 10px;
                    --radius-s: 8px;
                    --blue: #0A84FF; --pink: #FF375F; --green: #30D158;
                    --orange: #FF9F0A; --gray: #8e8e93;
                }
                #${Config.UI_CONTAINER_ID} {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: var(--bg-color);
                    backdrop-filter: blur(16px) saturate(1.8);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-l);
                    color: var(--text-color-primary);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    width: 320px;
                    font-size: 14px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
                }
                .fab-helper-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px 8px;
                }
                .fab-helper-header h2 {
                    font-size: 18px; font-weight: 600; margin: 0;
                }
                .fab-helper-header .version {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--text-color-secondary);
                    background-color: var(--bg-color-light);
                    padding: 2px 6px;
                    border-radius: 6px;
                    margin-left: 8px;
                }
                .fab-helper-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--border-color);
                    padding: 0 16px;
                }
                .fab-helper-tabs button {
                    background: none;
                    border: none;
                    color: var(--text-color-secondary);
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    transition: color 0.2s, border-color 0.2s;
                }
                .fab-helper-tabs button.active {
                    color: var(--text-color-primary);
                    border-bottom-color: var(--blue);
                }
                .fab-helper-tab-content {
                    display: none;
                    padding: 12px 16px;
                }
                .fab-helper-tab-content.active {
                    display: block;
                }
                 .fab-helper-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px; /* Increased gap */
                }
                .fab-helper-section-title {
                    font-size: 13px; color: var(--text-color-secondary); font-weight: 600; margin: 8px 0 0px 0; padding-bottom: 4px; border-bottom: 1px solid var(--border-color);
                }
                 #${Config.UI_CONTAINER_ID} button.fab-helper-button {
                    border: none; border-radius: var(--radius-m); padding: 12px 16px;
                    font-size: 15px; font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s;
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }
                .fab-helper-button.primary {
                    background: linear-gradient(135deg, var(--blue), #0056b3);
                    box-shadow: 0 4px 15px rgba(0, 122, 255, 0.2);
                }
                .fab-helper-button.primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0, 122, 255, 0.3);
                }
                .fab-helper-button.secondary {
                    background-color: var(--bg-color-light);
                    color: var(--text-color-secondary);
                }
                 .fab-helper-button.secondary:hover {
                    background-color: rgba(255, 255, 255, 0.12);
                    color: var(--text-color-primary);
                }
                .fab-helper-button.danger {
                    background-color: var(--pink);
                    box-shadow: 0 4px 15px rgba(255, 55, 95, 0.2);
                }

                @keyframes fab-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(0, 122, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0); }
                }
                .fab-helper-pulse { animation: fab-pulse 2s infinite; }

                .fab-helper-status-bar {
                    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; /* Increased gap */
                }
                .fab-helper-status-item {
                    background: var(--bg-color-dark);
                    padding: 8px;
                    border-radius: var(--radius-m);
                    text-align: center;
                    color: var(--text-color-secondary);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    border-left: 3px solid transparent; /* For theme color */
                }
                .fab-helper-status-item .status-label {
                    font-size: 12px;
                    white-space: nowrap; /* Prevent label from breaking line */
                }
                .fab-helper-status-item .status-value { font-size: 20px; font-weight: 700; color: #fff; line-height: 1.2; }
                .fab-helper-status-item.todo { border-left-color: var(--blue); }
                .fab-helper-status-item.done { border-left-color: var(--green); }
                .fab-helper-status-item.failed { border-left-color: var(--pink); }
                .fab-helper-status-item.hidden { border-left-color: var(--gray); }

                .fab-helper-row {
                    display: flex; justify-content: space-between; align-items: center; gap: 8px;
                    background: var(--bg-color-dark); padding: 10px; border-radius: var(--radius-m);
                }
                .fab-helper-row label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
                .fab-helper-log-panel {
                    background: rgba(10,10,10,0.85); color: #eee; font-size: 12px; line-height: 1.5; padding: 8px;
                    border-radius: var(--radius-m); margin-top: 8px; max-height: 250px; overflow-y: auto;
                    display: flex; flex-direction: column-reverse;
                }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = styles;
            styleSheet.setAttribute('data-fab-helper-style', 'true');
            document.head.appendChild(styleSheet);

            const container = document.createElement('div');
            container.id = Config.UI_CONTAINER_ID;

            // --- Header ---
            const header = document.createElement('div');
            header.className = 'fab-helper-header';
            const title = document.createElement('h2');
            title.innerHTML = `Fab Helper <span class="version">${Config.SCRIPT_NAME.match(/v(\d+\.\d+\.\d+)/)[1]}</span>`;
            header.append(title);
            container.append(header);

            // --- Tabs ---
            const tabs = document.createElement('div');
            tabs.className = 'fab-helper-tabs';
            const createTab = (id, text, active = false) => {
                const btn = document.createElement('button');
                btn.dataset.tab = id;
                btn.textContent = text;
                if (active) btn.classList.add('active');
                btn.onclick = () => {
                    container.querySelectorAll('.fab-helper-tabs button').forEach(t => t.classList.remove('active'));
                    container.querySelectorAll('.fab-helper-tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    container.querySelector(`#tab-${id}`).classList.add('active');
                };
                return btn;
            };
            tabs.append(createTab('control', '仪表盘', true), createTab('settings', '设定'), createTab('debug', '调试'));
            container.append(tabs);

            // --- Tab Content Containers ---
            const controlTab = document.createElement('div');
            controlTab.id = 'tab-control';
            controlTab.className = 'fab-helper-tab-content active';

            const settingsTab = document.createElement('div');
            settingsTab.id = 'tab-settings';
            settingsTab.className = 'fab-helper-tab-content';

            const debugTab = document.createElement('div');
            debugTab.id = 'tab-debug';
            debugTab.className = 'fab-helper-tab-content';

            // --- Populate Control Tab ---
            const statusBar = document.createElement('div');
            statusBar.className = 'fab-helper-status-bar';
            const createStatusItem = (id, label, themeClass) => {
                const item = document.createElement('div');
                item.className = `fab-helper-status-item ${themeClass}`;
                item.innerHTML = `<div class="status-label">${label}</div><span id="${id}" class="status-value">0</span>`;
                return item;
            };
            State.UI.statusTodo = createStatusItem('fab-status-todo', `📥 ${Utils.getText('todo')}`, 'todo');
            State.UI.statusDone = createStatusItem('fab-status-done', `✅ ${Utils.getText('added')}`, 'done');
            State.UI.statusFailed = createStatusItem('fab-status-failed', `❌ ${Utils.getText('failed')}`, 'failed');
            const hiddenCountItem = createStatusItem('fab-hidden-count', '🙈 已隐藏', 'hidden');
            statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed, hiddenCountItem);
            State.UI.hiddenCountDisplay = hiddenCountItem.querySelector('#fab-hidden-count');

            // Re-adding Progress Bar
            const progressContainer = document.createElement('div');
            progressContainer.className = 'fab-helper-progress-container';
            // ... (rest of progress bar creation logic if it was removed)
            State.UI.progressContainer = progressContainer; // And other UI elements

            const controlSection = document.createElement('div');
            controlSection.className = 'fab-helper-section';

            // Combined "Add & Execute" Button
            State.UI.execBtn = document.createElement('button');
            State.UI.execBtn.className = 'fab-helper-button primary';
            // The initial text and onclick will be set by the first UI.update() call.
            // This avoids duplicating logic here.

            // Secondary Buttons
            const secondaryActions = document.createElement('div');
            secondaryActions.style.display = 'grid';
            secondaryActions.style.gridTemplateColumns = '1fr 1fr';
            secondaryActions.style.gap = '10px';

            State.UI.refreshBtn = document.createElement('button');
            State.UI.refreshBtn.className = 'fab-helper-button secondary';
            State.UI.refreshBtn.innerHTML = `🔄 ${Utils.getText('refresh')}`;
            State.UI.refreshBtn.onclick = TaskRunner.refreshVisibleStates;

            State.UI.hideBtn = document.createElement('button');
            State.UI.hideBtn.className = 'fab-helper-button secondary';
            State.UI.hideBtn.innerHTML = '🙈 隐藏已得';
            State.UI.hideBtn.onclick = TaskRunner.toggleHideSaved;

            secondaryActions.append(State.UI.refreshBtn, State.UI.hideBtn);
            controlSection.append(State.UI.execBtn, secondaryActions);
            controlTab.append(statusBar, State.UI.progressContainer, controlSection); // Add progress container here

            // --- Populate Settings Tab ---
            const settingsSection = document.createElement('div');
            settingsSection.className = 'fab-helper-section';
            settingsSection.innerHTML = `<div class="fab-helper-section-title">自动化选项 (Automation)</div>`;

            const createToggle = (labelText, storageKey, initialState, onChange) => {
                const row = document.createElement('div');
                row.className = 'fab-helper-row';
                const label = document.createElement('label');
                label.textContent = labelText;
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = initialState;
                checkbox.onchange = () => onChange(checkbox.checked);
                label.prepend(checkbox);
                row.append(label);
                return row;
            };

            const pursuitToggle = createToggle('执行时自动发现新任务', 'fab_smart_pursuit_enabled', State.isSmartPursuitEnabled, checked => {
                 State.isSmartPursuitEnabled = checked;
                 localStorage.setItem('fab_smart_pursuit_enabled', checked);
                 Utils.logger('info', `智能追击模式已 ${checked ? '开启' : '关闭'}.`);
            });

            const patcherToggle = createToggle('记忆列表浏览位置', Config.DB_KEYS.PATCH_ENABLED, State.isPagePatchingEnabled, async checked => {
                State.isPagePatchingEnabled = checked;
                await GM_setValue(Config.DB_KEYS.PATCH_ENABLED, checked);
                Utils.logger('info', `页面起点修改已 ${checked ? '启用' : '禁用'}.`);
            });
            const clearCursorBtn = document.createElement('button');
            clearCursorBtn.textContent = '清除记忆';
            clearCursorBtn.className = 'fab-helper-button secondary';
            clearCursorBtn.style.padding = '4px 8px';
            clearCursorBtn.style.fontSize = '12px';
            clearCursorBtn.onclick = async () => {
                await GM_deleteValue(Config.DB_KEYS.SAVED_CURSOR);
                State.savedCursor = null;
                Utils.logger('info', '已清除已保存的页面起点。');
            };
            patcherToggle.querySelector('label').after(clearCursorBtn);

            settingsSection.append(pursuitToggle, patcherToggle);
            settingsTab.append(settingsSection);


            // --- Populate Debug Tab ---
            const debugSection = document.createElement('div');
            debugSection.className = 'fab-helper-section';

            // Status Monitor Section (NEW)
            const statusMonitorSection = document.createElement('div');
            statusMonitorSection.className = 'fab-helper-section';
            const statusMonitorHeader = document.createElement('div');
            statusMonitorHeader.className = 'fab-helper-row';
            statusMonitorHeader.innerHTML = `<span>⏱️ 状态监视器</span>`;
            State.UI.statusMonitorDisplay = document.createElement('div');
            State.UI.statusMonitorDisplay.style.cssText = 'font-size: 13px; color: var(--text-color-primary); background: var(--bg-color-dark); padding: 10px; border-radius: var(--radius-m); margin-top: 8px; text-align: center;';
            statusMonitorSection.append(statusMonitorHeader, State.UI.statusMonitorDisplay);

            // Log Panel (FIX: Renamed variable to avoid conflict)
            const debugLogSection = document.createElement('div');
            const logHeader = document.createElement('div');
            logHeader.className = 'fab-helper-row';
            logHeader.innerHTML = `<span>📝 运行日志</span>`;
            const logButtons = document.createElement('div');
            logButtons.style.display = 'flex'; logButtons.style.gap = '8px';
            const copyLogBtn = document.createElement('button');
            copyLogBtn.textContent = '复制';
            copyLogBtn.className = 'fab-helper-button secondary';
            copyLogBtn.style.padding = '2px 8px'; copyLogBtn.style.fontSize = '12px';
            copyLogBtn.onclick = () => navigator.clipboard.writeText(State.UI.logPanel.innerText);
            const clearLogBtn = document.createElement('button');
            clearLogBtn.textContent = '清空';
            clearLogBtn.className = 'fab-helper-button secondary';
            clearLogBtn.style.padding = '2px 8px'; clearLogBtn.style.fontSize = '12px';
            clearLogBtn.onclick = () => { State.UI.logPanel.innerHTML = ''; };
            logButtons.append(copyLogBtn, clearLogBtn);
            logHeader.append(logButtons);
            State.UI.logPanel = document.createElement('div');
            State.UI.logPanel.className = 'fab-helper-log-panel';
            debugLogSection.append(logHeader, State.UI.logPanel);

            // Network Analysis (FIX: Renamed variable to avoid conflict)
            const debugNetworkSection = document.createElement('div');
            const networkHeader = document.createElement('div');
            networkHeader.className = 'fab-helper-row';
            networkHeader.innerHTML = `<span>📈 网络分析 (Network)</span>`;
            const clearNetworkBtn = document.createElement('button');
            clearNetworkBtn.textContent = '清空';
            clearNetworkBtn.className = 'fab-helper-button secondary';
            clearNetworkBtn.style.padding = '2px 8px'; clearNetworkBtn.style.fontSize = '12px';
            clearNetworkBtn.onclick = () => { NetworkRecorder.log = []; localStorage.removeItem(NetworkRecorder.DB_KEY); NetworkAnalyzer.peakRps = 0; GM_deleteValue(Config.DB_KEYS.PEAK_RPS); NetworkAnalyzer.updateUI(); };
            networkHeader.append(clearNetworkBtn);

            const networkContent = document.createElement('div');
            networkContent.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px;';
            const createMetricDisplay = (id, label, value) => {
                const item = document.createElement('div');
                item.className = 'fab-helper-status-item';
                item.style.borderLeft = 'none'; // No theme color needed here
                item.innerHTML = `<div class="status-label">${label}</div><span id="${id}" class="status-value">${value}</span>`;
                return item;
            };
            State.UI.rpsDisplay = createMetricDisplay('fab-rps-display', '实时RPS', '0');
            State.UI.peakRpsDisplay = createMetricDisplay('fab-peak-rps-display', '峰值RPS', '0');
            State.UI.cumulativeWeightDisplay = createMetricDisplay('fab-cumulative-weight', 'ID查询数(60s)', '0');

            State.UI.last429Display = document.createElement('div');
            State.UI.last429Display.innerHTML = '<b>最近429事件:</b><br>尚无记录';
            State.UI.last429Display.style.cssText = 'grid-column: 1 / -1; font-size: 11px; color: var(--text-color-secondary); background: var(--bg-color-dark); padding: 8px; border-radius: var(--radius-m); margin-top: 4px;';

            networkContent.append(State.UI.rpsDisplay, State.UI.peakRpsDisplay, State.UI.cumulativeWeightDisplay);
            debugNetworkSection.append(networkHeader, networkContent, State.UI.last429Display);

            // Danger Zone Buttons (FIX: Renamed variable to avoid conflict)
            const debugDangerSection = document.createElement('div');
            const dangerTitle = document.createElement('div');
            dangerTitle.className = 'fab-helper-section-title';
            dangerTitle.textContent = '危险区域 (Danger Zone)';
            dangerTitle.style.borderColor = 'var(--pink)';
            const dangerActions = document.createElement('div');
            dangerActions.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;';

            const hotReloadBtn = document.createElement('button');
            hotReloadBtn.className = 'fab-helper-button danger';
            hotReloadBtn.innerHTML = '🔥 脚本热重载';
            hotReloadBtn.onclick = TaskRunner.hotReloadScript;
            const resetDataBtn = document.createElement('button');
            resetDataBtn.className = 'fab-helper-button danger';
            resetDataBtn.innerHTML = '⚠️ 清空脚本数据';
            resetDataBtn.onclick = Database.resetAllData;

            dangerActions.append(hotReloadBtn, resetDataBtn);
            debugDangerSection.append(dangerTitle, dangerActions);

            debugSection.append(statusMonitorSection, debugLogSection, debugNetworkSection, debugDangerSection);
            debugTab.append(debugSection);

            // Assemble UI
            container.append(controlTab, settingsTab, debugTab);
            document.body.appendChild(container);
            State.UI.container = container;

            // --- Console Commands ---
            unsafeWindow.FabHelperResetData = Database.resetAllData;

            UI.update();
        },

        update: () => {
            if (!State.UI.container) return;

            // Status Bar
            State.UI.container.querySelector('#fab-status-todo').textContent = State.db.todo.length;
            State.UI.container.querySelector('#fab-status-done').textContent = State.db.done.length;
            State.UI.container.querySelector('#fab-status-failed').textContent = State.db.failed.length;
            if (State.UI.hiddenCountDisplay) {
                State.UI.hiddenCountDisplay.textContent = State.hiddenThisPageCount;
            }

            // Progress Bar (ensure this logic is present)
            if (State.isExecuting && State.executionTotalTasks > 0) {
                State.UI.progressContainer.style.display = 'flex';
                //... progress bar update logic
            } else {
                State.UI.progressContainer.style.display = 'none';
            }

            // Execute Button
            if (State.UI.execBtn) {
                const isUnhealthy = StatusManager.isThrottled() || StatusManager.isUnstable();
                State.UI.execBtn.disabled = isUnhealthy || State.isScanning;

                if (State.isExecuting) {
                    State.UI.execBtn.innerHTML = `🛑 停止挂机`;
                    State.UI.execBtn.className = 'fab-helper-button danger';
                    State.UI.execBtn.onclick = TaskRunner.stopExecution;
                } else {
                    State.UI.execBtn.className = 'fab-helper-button primary';
                    if (State.db.todo.length > 0) {
                        State.UI.execBtn.innerHTML = `🚀 继续任务 (${State.db.todo.length})`;
                    } else if (State.isScanning) {
                        State.UI.execBtn.innerHTML = `🔎 扫描中...`;
                    }
                    else {
                        State.UI.execBtn.innerHTML = `✨ ${Utils.getText('execute')}`;
                    }

                    // Centralized onclick handler for the "start" state
                    State.UI.execBtn.onclick = async () => {
                        if (State.db.todo.length === 0) {
                            Utils.logger('info', '待办队列为空，开始扫描页面...');
                            await TaskRunner.processPageWithApi({ autoAdd: true });
                            // startExecution will be called implicitly if tasks are found and added.
                            // The main loop will then pick them up.
                        }
                        // This single function now handles all start cases.
                        TaskRunner.startExecution();
                    };

                    if (State.db.todo.length > 0 && !isUnhealthy && !State.isScanning) {
                         State.UI.execBtn.classList.add('fab-helper-pulse');
                    } else {
                         State.UI.execBtn.classList.remove('fab-helper-pulse');
                    }
                }
            }

            // Other buttons
            if (State.UI.refreshBtn) {
                State.UI.refreshBtn.disabled = State.isExecuting || StatusManager.isThrottled() || StatusManager.isUnstable() || State.isScanning;
            }
            if (State.UI.hideBtn) {
                State.UI.hideBtn.innerHTML = `🙈 ${State.hideSaved ? '显示' : '隐藏'}已得`;
                State.UI.hideBtn.disabled = StatusManager.isThrottled() || StatusManager.isUnstable();
            }

            // Add visual cues for disabled state
            [State.UI.execBtn, State.UI.refreshBtn, State.UI.hideBtn].forEach(btn => {
                if (btn) {
                    btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
                    btn.style.opacity = btn.disabled ? 0.6 : 1;
                }
            });

            // Status Monitor Display
            if (State.UI.statusMonitorDisplay) {
                const getThrottleInfo = async () => GM_getValue(Config.DB_KEYS.THROTTLE_INFO, { startTime: 0 });
                switch (State.scriptStatus) {
                    case 'ACTIVE':
                        State.UI.statusMonitorDisplay.innerHTML = `<span style="color:var(--green);">✅ 任务执行中...</span>`;
                        break;
                    case 'THROTTLED':
                        getThrottleInfo().then(info => {
                            const now = Date.now();
                            const cooldownEnd = info.startTime + 65000;
                            const remaining = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
                            State.UI.statusMonitorDisplay.innerHTML = `<span style="color:var(--orange);">❄️ 服务器节流中 (冷却: ${remaining}s)</span>`;
                        });
                        break;
                    case 'UNSTABLE':
                        State.UI.statusMonitorDisplay.innerHTML = `<span style="color:var(--pink);">⚠️ 网络不稳定，操作已暂停</span>`;
                        break;
                    case 'IDLE':
                    default:
                        State.UI.statusMonitorDisplay.innerHTML = `<span style="color:var(--text-color-secondary);">💤 空闲</span>`;
                        break;
                }
            }
        },

        applyOverlay: (card, status) => {
            if (!card) return;
            let overlay = card.querySelector('.fab-helper-overlay-v8');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'fab-helper-overlay-v8';
                overlay.style.cssText = `
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(28, 28, 30, 0.7);
                    z-index: 10;
                    display: flex; justify-content: center; align-items: center;
                    font-size: 48px;
                    font-weight: bold;
                    backdrop-filter: blur(4px);
                    border-radius: inherit;
                    color: white;
                    text-shadow: 0 2px 8px rgba(0,0,0,0.5);
                    transition: opacity 0.3s;
                    opacity: 0;
                `;
                // Append to the card's root, assuming it's a stacking context
                card.style.position = 'relative';
                card.appendChild(overlay);
                // Trigger fade-in
                setTimeout(() => { overlay.style.opacity = '1'; }, 10);
            }

            let icon = '';
            switch (status) {
                case 'owned':
                    icon = '✅';
                    break;
                case 'failed':
                    icon = '❌';
                    break;
                case 'pending':
                    icon = '⏳';
                    break;
                default:
                    icon = '…';
            }
            overlay.innerHTML = icon;
        },

        removeAllOverlays: () => {
            document.querySelectorAll('.fab-helper-overlay-v8').forEach(o => o.remove());
        },

        applyOverlaysToPage: () => {
            document.querySelectorAll(Config.SELECTORS.card).forEach(card=>{
                const link=card.querySelector(Config.SELECTORS.cardLink);
                if (!link) return;
                const url=link.href.split('?')[0];
                const isNativelyOwned=[...Config.SAVED_TEXT_SET].some(s=>card.textContent.includes(s));
                if (isNativelyOwned) {const ex=card.querySelector('.fab-helper-overlay-v8'); if(ex)ex.remove(); return;}
                if (State.sessionCompleted.has(url)) UI.applyOverlay(card,'owned');
                else if (Database.isTodo(url)) UI.applyOverlay(card,'queued');
                else {const ex=card.querySelector('.fab-helper-overlay-v8'); if(ex)ex.remove();}
            });
        },

        toggleLogPanel: () => {
            // 切换折叠状态
            State.isLogCollapsed = !State.isLogCollapsed;

            // 保存状态到localStorage
            localStorage.setItem('fab_helper_log_collapsed', State.isLogCollapsed);

            // 找到切换按钮并更新图标和提示
            const logHeader = State.UI.logPanel.previousSibling;
            const toggleBtn = logHeader.querySelector('.fab-helper-icon-btn');
            if (toggleBtn) {
                toggleBtn.innerHTML = State.isLogCollapsed ? '📂' : '📁';
                toggleBtn.title = State.isLogCollapsed ? '展开日志' : '收起日志';
            }

            // 更新日志面板高度和滚动行为
            State.UI.logPanel.style.height = State.isLogCollapsed ? '42px' : '200px';
            State.UI.logPanel.style.overflowY = State.isLogCollapsed ? 'hidden' : 'auto';
        },

        setupOwnershipObserver: (card) => {
            // 获取卡片的 URL
            const link = card.querySelector(Config.SELECTORS.cardLink);
            if (!link) return;
            const url = link.href.split('?')[0];

            // 初始检查 - 如果卡片已经被标记为拥有，则隐藏它
            const initialCheck = () => {
                const text = card.textContent || '';
                const isNativelySaved = [...Config.SAVED_TEXT_SET].some(s => text.includes(s));

                if (State.hideSaved && isNativelySaved) {
                    card.style.display = 'none';
                    // 这里也不应该直接修改计数，runHideOrShow 会统一处理
                    return true; // 卡片已被隐藏
                }
                return false; // 卡片未被隐藏
            };

            // 进行初始检查，但无论结果如何，都继续设置观察器
            initialCheck();

            const obs = new MutationObserver((mutations) => {
                // 检查文本变化，判断是否商品已被拥有
                const text = card.textContent || '';
                const isNowSaved = [...Config.SAVED_TEXT_SET].some(s => text.includes(s));

                if (isNowSaved) {
                    // 如果检测到"已保存"文本，将该 URL 添加到会话完成集合中
                    State.sessionCompleted.add(url);

                    // 更新 UI 显示（隐藏卡片或应用覆盖层）
                    if (State.hideSaved) {
                        card.style.display = 'none';
                        // 不再手动递增，而是触发一次完整的重新计算
                        TaskRunner.runHideOrShow();
                    } else {
                        UI.applyOverlay(card, 'owned');
                    }

                    // 断开观察器连接，不再需要监听
                    obs.disconnect();
                }
            });

            // 监听卡片的文本变化，无论卡片当前是否被隐藏
            obs.observe(card, {childList: true, subtree: true, characterData: true});

            // 设置超时，确保不会无限期监听
            setTimeout(() => obs.disconnect(), 15000);
        },
    };


    // --- 模块九: 页面修补程序 (Page Patcher for SPA) ---
    const PagePatcher = {
        init: () => {
            Utils.logger('info', `[PagePatcher] Initializing...`);
            Utils.logger('info', `[PagePatcher] > Status: ${State.isPagePatchingEnabled ? 'ENABLED' : 'DISABLED'}`);
            Utils.logger('info', `[PagePatcher] > Saved Cursor: ${State.savedCursor ? State.savedCursor.substring(0, 30) + '...' : 'Not Found'}`);

            let patchHasBeenApplied = false; // "One-and-Done" flag, local to this init cycle.

            const shouldPatchUrl = (url) => {
                // Gate 0: Basic URL type check
                if (typeof url !== 'string') return false;

                // Log every potential candidate that isn't obviously wrong (like a local blob:)
                if (url.startsWith('http')) {
                    // This log is too spammy, let's only log real candidates
                    // Utils.logger('info', `[PagePatcher] Checking URL: ${url.substring(0, 120)}`);
                }

                // Gate 1: "One-and-Done" flag. If we've patched once, we're done.
                if (patchHasBeenApplied) {
                    // This log is too spammy, only log when it's a real candidate
                    if (url.includes('/i/listings/search')) Utils.logger('info', `[PagePatcher] -> SKIPPING: Patch already applied this session.`);
                    return false;
                }

                // Gate 2: The feature must be enabled by the user and have a cursor to use.
                if (!State.isPagePatchingEnabled || !State.savedCursor) {
                     if (url.includes('/i/listings/search')) Utils.logger('info', `[PagePatcher] -> SKIPPING: Feature disabled or no cursor saved.`);
                    return false;
                }

                // Gate 3: Basic URL content check. Must be a search request.
                if (!url.includes('/i/listings/search')) {
                    return false;
                }

                // Gate 4: Exclusion rules. These are requests for UI elements/metadata, not content.
                if (url.includes('aggregate_on=') || url.includes('count=0') || url.includes('in=wishlist')) {
                    Utils.logger('info', `[PagePatcher] -> SKIPPING: URL is for UI/metadata (aggregate/count/wishlist).`);
                    return false;
                }

                // If it passes all gates, it's the first real content request we've seen this session. Patch it.
                Utils.logger('info', `[PagePatcher] -> ✅ MATCH! This URL will be patched.`);
                return true;
            };

            const getPatchedUrl = (originalUrl) => {
                if (State.savedCursor) {
                    const urlObj = new URL(originalUrl, window.location.origin);
                    urlObj.searchParams.set('cursor', State.savedCursor);
                    const modifiedUrl = urlObj.href;
                    Utils.logger('info', `[PagePatcher] -> 🚀 PATCHING. Original: ${originalUrl}`);
                    Utils.logger('info', `[PagePatcher] -> 🚀 PATCHED. New URL: ${modifiedUrl}`);
                    patchHasBeenApplied = true;
                    return modifiedUrl;
                }
                return originalUrl; // Should not happen due to checks in shouldPatchUrl
            };

            let lastSeenCursor = State.savedCursor;
            let secondToLastSeenCursor = null;

            const saveLatestCursorFromUrl = (url) => {
                try {
                    if (typeof url === 'string' && url.includes('/i/listings/search') && url.includes('cursor=')) {
                        const urlObj = new URL(url, window.location.origin);
                        const newCursor = urlObj.searchParams.get('cursor');

                        if (newCursor && newCursor !== lastSeenCursor) {
                            secondToLastSeenCursor = lastSeenCursor;
                            lastSeenCursor = newCursor;

                            if (secondToLastSeenCursor) {
                                State.savedCursor = secondToLastSeenCursor;
                                GM_setValue(Config.DB_KEYS.SAVED_CURSOR, secondToLastSeenCursor);
                                Utils.logger('info', `[PagePatcher] 已自动保存 [上一页] 的起点: ${secondToLastSeenCursor.substring(0, 30)}...`);
                            }
                        }
                    }
                } catch (e) {
                    Utils.logger('warn', `[PagePatcher] Error while auto-saving cursor:`, e);
                }
            };

            // --- UNIFIED GLOBAL INTERCEPTOR ---

            // 1. Patch XMLHttpRequest
            if (!unsafeWindow.originalXHROpen) {
                unsafeWindow.originalXHROpen = XMLHttpRequest.prototype.open;
                const originalOpen = unsafeWindow.originalXHROpen;
                XMLHttpRequest.prototype.open = function(method, url, ...args) {
                    let modifiedUrl = url;
                    if (shouldPatchUrl(url)) {
                        modifiedUrl = getPatchedUrl(url);
                    } else {
                        saveLatestCursorFromUrl(url);
                    }
                    return originalOpen.apply(this, [method, modifiedUrl, ...args]);
                };
            }
            if (!unsafeWindow.originalXHRSend) {
                unsafeWindow.originalXHRSend = XMLHttpRequest.prototype.send;
                const originalSend = unsafeWindow.originalXHRSend;
                XMLHttpRequest.prototype.send = function(...args) {
                    this.addEventListener('loadend', () => {
                        if (this.responseURL && (this.responseURL.includes('/i/users/me/listings-states') || this.responseURL.includes('/i/listings/search'))) {
                           NetworkRecorder.recordRequest(this.responseURL, this.status, this.responseText);
                        }
                    });
                    return originalSend.apply(this, args);
                };
            }

            // 2. Patch Fetch
            if (!unsafeWindow.originalFetch) {
                unsafeWindow.originalFetch = unsafeWindow.fetch;
                const originalFetch = unsafeWindow.originalFetch;
                unsafeWindow.fetch = async function(input, init) {
                    // --- PagePatcher Logic (Modify request before sending) ---
                    let modifiedInput = input;
                    const url = (typeof input === 'string') ? input : (input ? input.url : '');

                    if (shouldPatchUrl(url)) {
                        const modifiedUrl = getPatchedUrl(url);
                        if (typeof input === 'string') {
                            modifiedInput = modifiedUrl;
                        } else if (input) {
                            modifiedInput = new Request(modifiedUrl, input);
                        }
                    } else {
                        saveLatestCursorFromUrl(url);
                    }

                    // --- Make the actual request ---
                    const response = await originalFetch.call(this, modifiedInput, init);

                    // --- NetworkRecorder Logic (Record response after receiving) ---
                    const finalUrl = (typeof modifiedInput === 'string') ? modifiedInput : (modifiedInput ? modifiedInput.url : '');
                    if (finalUrl && (finalUrl.includes('/i/users/me/listings-states') || finalUrl.includes('/i/listings/search'))) {
                        response.clone().text().then(text => {
                            NetworkRecorder.recordRequest(finalUrl, response.status, text);
                        });
                    }

                    return response;
                };
            }
        },
        applyPatch: () => {
             // No changes needed here, logic is sound.
        }
    };

    // --- 模块十: 核心初始化 (Core Initialization) ---
    const Initializer = {
        init: () => {
            Utils.cleanup(); // Clean up any old instances first
            Utils.detectLanguage();

            Database.load().then(() => {
                UI.create();
                TaskRunner.init();
                StatusManager.init(); // Initialize the new status system
                PagePatcher.init();

                // Start the main SPA navigation listener
                Initializer.startSpaNavigationListener();

                // Initial run of hide/show logic after a brief delay
                setTimeout(() => TaskRunner.runHideOrShow(), 500);
            });
        },

        startSpaNavigationListener: () => {
            // Disconnect old observer if it exists from a previous script instance
            if (unsafeWindow.fabHelperSpaObserver) {
                unsafeWindow.fabHelperSpaObserver.disconnect();
            }

            State.lastKnownHref = window.location.href;
            const observer = new MutationObserver(() => {
                if (window.location.href !== State.lastKnownHref) {
                    State.lastKnownHref = window.location.href;
                    Utils.logger('info', 'SPA navigation detected. Re-evaluating page content.');
                    // Give the new page content a moment to settle before processing.
                    setTimeout(() => {
                        // Reset processed flags to force re-evaluation
                        document.querySelectorAll('.fab-helper-processed').forEach(el => el.classList.remove('fab-helper-processed'));
                        TaskRunner.runHideOrShow();
                        PagePatcher.applyPatch();
                    }, 500);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            unsafeWindow.fabHelperSpaObserver = observer; // Store for potential cleanup
        }
    };

    // --- Main Execution ---
    function main() {
        Initializer.init();
    }

    // This handles the worker tab logic
    if (window.location.href.includes('workerId=')) {
        TaskRunner.processDetailPage();
    } else {
        // Main tab logic
        window.addEventListener('load', main);
    }

})();