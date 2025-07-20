// ==UserScript==
// @name         Fab API-Driven Helper
// @name:en      Fab API-Driven Helper
// @name:zh      Fab API 驱动助手
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Automates acquiring free assets from Fab.com using its internal API, with a modern UI.
// @description:en Automates acquiring free assets from Fab.com using its internal API, with a modern UI.
// @description:zh 通过调用内部API，自动化获取Fab.com上的免费资源，并配有现代化的UI。
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
        SCRIPT_NAME: '[Fab API-Driven Helper v1.0.1]',
        DB_VERSION: 3,
        DB_NAME: 'fab_helper_db',
        MAX_WORKERS: 5, // Maximum number of concurrent worker tabs
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
            // All other keys are either session-based or for main-tab persistence.
        },
        SELECTORS: {
            card: 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root',
            cardLink: 'a[href*="/listings/"]',
            addButton: 'button[aria-label*="Add to"], button[aria-label*="添加至"], button[aria-label*="cart"]',
            rootElement: '#root',
            successBanner: 'div[class*="Toast-root"]'
        },
        TEXTS: {
            en: { hide: 'Hide', show: 'Show', recon: 'Recon', reconning: 'Reconning...', execute: 'Start Tasks', executing: 'Executing...', stopExecute: 'Stop', added: 'Added', failed: 'Failed', todo: 'To-Do', clearLog: 'Clear Log', copyLog: 'Copy Log', copied: 'Copied!', refresh: 'Refresh State', resetRecon: 'Reset Recon', log_init: 'Assistant is online!', log_db_loaded: 'Reading archive...', log_exec_no_tasks: 'To-Do list is empty.', log_recon_start: 'Starting scan for new items...', log_recon_end: 'Scan complete!', log_task_added: 'Found new item:', log_api_request: 'Requesting page data (Page: %page%). Scanned: %scanned%, Owned: %owned%...', log_api_owned_check: 'Checking ownership for %count% items...', log_api_owned_done: 'Ownership check complete. Found %newCount% new items.', log_verify_success: 'Verified and added to library!', log_verify_fail: "Couldn't add. Will retry later.", log_429_error: 'Request limit hit! Taking a 15s break...', log_recon_error: 'An error occurred during recon cycle:', goto_page_label: 'Page:', goto_page_btn: 'Go', retry_failed: 'Retry Failed' },
            zh: { hide: '隐藏', show: '显示', recon: '侦察', reconning: '侦察中...', execute: '启动任务', executing: '执行中...', stopExecute: '停止', added: '已添加', failed: '失败', todo: '待办', clearLog: '清空日志', copyLog: '复制日志', copied: '已复制!', refresh: '刷新状态', resetRecon: '重置进度', log_init: '助手已上线！', log_db_loaded: '正在读取存档...', log_exec_no_tasks: '"待办"清单是空的。', log_recon_start: '开始扫描新宝贝...', log_recon_end: '扫描完成！', log_task_added: '发现一个新宝贝:', log_api_request: '正在请求页面数据 (页码: %page%)。已扫描: %scanned%，已拥有: %owned%...', log_api_owned_check: '正在批量验证 %count% 个项目的所有权...', log_api_owned_done: '所有权验证完毕，发现 %newCount% 个全新项目！', log_verify_success: '搞定！已成功入库。', log_verify_fail: '哎呀，这个没加上。稍后会自动重试！', log_429_error: '请求太快被服务器限速了！休息15秒后自动重试...', log_recon_error: '侦察周期中发生严重错误：', goto_page_label: '页码:', goto_page_btn: '跳转', retry_failed: '重试失败' }
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
        isCoolingDown: false, // NEW: Global cooldown state
        wasExecutingBeforeCooldown: false, // NEW: State memory for Phoenix Protocol
        hideSaved: false,
        showAdvanced: false,
        patchHasBeenApplied: false, // For "One-and-Done" Page Patcher
        isPagePatchingEnabled: false, // For Page Patcher
        isSmartPursuitEnabled: false, // NEW: For Smart Pursuit Mode
        savedCursor: null, // For Page Patcher
        activeWorkers: 0,
        runningWorkers: {}, // NEW: To track active workers for the watchdog { workerId: { task, startTime } }
        lastKnownHref: null, // To detect SPA navigation
        hiddenThisPageCount: 0,
        totalTasks: 0, // Used for Recon
        completedTasks: 0, // Used for Recon
        executionTotalTasks: 0, // For execution progress
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
        },
        valueChangeListeners: [],
        sessionCompleted: new Set(), // Phase15: URLs completed this session
        isLogCollapsed: localStorage.getItem('fab_helper_log_collapsed') === 'true' || false, // 日志面板折叠状态
        networkAnalyzerTimer: null, // For network analyzer heartbeat
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
                logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${args.join(' ')}`;
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
                    anonymous: false, // Default to false to ensure cookies are sent
                    ...options,
                    onload: (response) => {
                        // Manually record the successful request for our network analyzer
                        if (options.url.includes('/i/users/me/listings-states') || options.url.includes('/i/listings/search')) {
                            NetworkRecorder.recordRequest(options.url, response.status, response.responseText);
                        }
                        resolve(response);
                    },
                    onerror: (error) => {
                        // Manually record the failed request for our network analyzer
                        if (options.url.includes('/i/users/me/listings-states') || options.url.includes('/i/listings/search')) {
                             NetworkRecorder.recordRequest(options.url, error.status, error.responseText);
                        }
                        reject(new Error(`GM_xmlhttpRequest error: ${error.statusText || 'Unknown Error'}`));
                    },
                    ontimeout: () => reject(new Error('Request timed out.')),
                    onabort: () => reject(new Error('Request aborted.'))
                });
            });
        },
        // ... Other API-related functions will go here ...
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
            if (!task || !task.uid) {
                Utils.logger('error', 'Debug: markAsDone received invalid task:', JSON.stringify(task));
                return;
            }

            Utils.logger('info', `Debug: Task to remove: UID=${task.uid}`);
            const initialTodoCount = State.db.todo.length;
            Utils.logger('info', `Debug: To-Do count before: ${initialTodoCount}`);

            State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);

            if (State.db.todo.length === initialTodoCount && initialTodoCount > 0) {
                Utils.logger('warn', 'Debug: FILTER FAILED! UID not found in To-Do list.');
                const uidsInState = State.db.todo.map(t => t.uid).slice(0, 10).join(', '); // show first 10
                Utils.logger('info', `Debug: First 10 UIDs in To-Do list are: [${uidsInState}]`);
            }

            Utils.logger('info', `Debug: To-Do count after: ${State.db.todo.length}`);
            
            let changed = false;

            // The 'done' list can still use URLs for simplicity, as it's for display/hiding.
            const cleanUrl = task.url.split('?')[0];
            if (!Database.isDone(cleanUrl)) {
                State.db.done.push(cleanUrl);
                changed = true;
            }

            if (changed) {
                await Database.saveDone();
            }
        },
        markAsFailed: async (task) => {
            if (!task || !task.uid) {
                Utils.logger('error', 'Debug: markAsFailed received invalid task:', JSON.stringify(task));
                return;
            }

            // Remove from todo
            const initialTodoCount = State.db.todo.length;
            State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
            let changed = State.db.todo.length < initialTodoCount;

            // Add to failed, ensuring no duplicates by UID
            if (!State.db.failed.some(f => f.uid === task.uid)) {
                State.db.failed.push(task); // Store the whole task object for potential retry
                changed = true;
            }

            if (changed) {
                await Database.saveFailed();
            }
        },
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
        // --- Toggles ---
        toggleRecon: async () => {
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
            // Case 1: Execution is already running. We just need to update the total task count.
            if (State.isExecuting) {
                const newTotal = State.db.todo.length;
                if (newTotal > State.executionTotalTasks) {
                    Utils.logger('info', `任务执行中，新任务已添加。总任务数更新为: ${newTotal}`);
                    State.executionTotalTasks = newTotal;
                    UI.update(); // Update the UI to reflect the new total.
                } else {
                    Utils.logger('info', '执行器已在运行中，新任务已加入队列等待处理。');
                }
                // IMPORTANT: Do not start a new execution loop. The current one will pick up the new tasks.
                return;
            }

            // Case 2: Starting a new execution from an idle state.
            if (State.db.todo.length === 0) {
                Utils.logger('info', '"待办"清单是空的，无需启动。');
                return;
            }
            Utils.logger('info', `队列中有 ${State.db.todo.length} 个任务，即将开始执行...`);
            State.isExecuting = true;
            State.executionTotalTasks = State.db.todo.length;
            State.executionCompletedTasks = 0;
            State.executionFailedTasks = 0;
            UI.update();
            TaskRunner.executeBatch();
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

        // This function is for the main UI button to toggle start/stop.
        toggleExecution: () => {
            if (State.isExecuting) {
                State.isExecuting = false;
                // This will signal all active workers to stop, but relies on them checking the key.
                // A more robust stop would involve cleaning up workers directly.
                GM_deleteValue(Config.DB_KEYS.TASK); 
                // We also clear the running workers so the watchdog stops.
                State.runningWorkers = {};
                State.activeWorkers = 0;
                State.executionTotalTasks = 0;
                State.executionCompletedTasks = 0;
                State.executionFailedTasks = 0;
                Utils.logger('info', '执行已由用户手动停止。');
            } else {
                TaskRunner.startExecution();
            }
            UI.update();
        },
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
            await GM_deleteValue(Config.DB_KEYS.NEXT_URL);
            if (State.UI.reconProgressDisplay) {
                State.UI.reconProgressDisplay.textContent = 'Page: 1';
            }
            Utils.logger('info', 'Recon progress has been reset. Next scan will start from the beginning.');
        },

        refreshVisibleStates: async () => {
            Utils.logger('info', '[Fab DOM Refresh] Starting for VISIBLE items...');
            await TaskRunner.processPageWithApi({ autoAdd: false, onlyVisible: true });
        },

        processPageWithApi: async (options = {}) => {
            const { autoAdd = false, onlyVisible = false } = options;
            
            const API_ENDPOINT = 'https://www.fab.com/i/users/me/listings-states';
            const CARD_SELECTOR = 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root';
            const LINK_SELECTOR = 'a[href*="/listings/"]';
            const CSRF_COOKIE_NAME = 'fab_csrftoken';
            const CHUNK_SIZE = 8;
            const DELAY_BETWEEN_CHUNKS = 250;
            
            const FREE_STATUS_SELECTOR = '.csZFzinF'; 
            const OWNED_STATUS_SELECTOR = '.cUUvxo_s';

            const createOwnedElement = () => {
                const ownedDiv = document.createElement('div');
                ownedDiv.className = 'fabkit-Typography-root fabkit-Typography--align-start fabkit-Typography--intent-success fabkit-Text--sm fabkit-Text--regular fabkit-Stack-root fabkit-Stack--align_center fabkit-scale--gapX-spacing-1 fabkit-scale--gapY-spacing-1 cUUvxo_s';
                const icon = document.createElement('i');
                icon.className = 'fabkit-Icon-root fabkit-Icon--intent-success fabkit-Icon--xs edsicon edsicon-check-circle-filled';
                icon.setAttribute('aria-hidden', 'true');
                ownedDiv.appendChild(icon);
                ownedDiv.append('已保存在我的库中');
                return ownedDiv;
            };

            const createFreeElement = () => {
                const freeContainer = document.createElement('div');
                freeContainer.className = 'fabkit-Stack-root fabkit-Stack--align_center fabkit-scale--gapX-spacing-2 fabkit-scale--gapY-spacing-2 csZFzinF';
                const innerStack = document.createElement('div');
                innerStack.className = 'fabkit-Stack-root fabkit-scale--gapX-spacing-1 fabkit-scale--gapY-spacing-1 J9vFXlBh';
                const freeText = document.createElement('div');
                freeText.className = 'fabkit-Typography-root fabkit-Typography--align-start fabkit-Typography--intent-primary fabkit-Text--sm fabkit-Text--regular';
                freeText.textContent = '免费';
                innerStack.appendChild(freeText);
                freeContainer.appendChild(innerStack);
                return freeContainer;
            };
            
            const isElementInViewport = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
            };

            try {
                const csrfToken = Utils.getCookie(CSRF_COOKIE_NAME);
                if (!csrfToken) throw new Error('CSRF token not found. Are you logged in?');

                const allCards = [...document.querySelectorAll(CARD_SELECTOR)];
                const cardsToProcess = onlyVisible ? allCards.filter(isElementInViewport) : allCards;

                const uidToCardMap = new Map();
                cardsToProcess.forEach(card => {
                    const link = card.querySelector(LINK_SELECTOR);
                    if (link) {
                        const match = link.href.match(/listings\/([a-f0-9-]+)/);
                        if (match && match[1]) uidToCardMap.set(match[1], card);
                    }
                });

                const uidsToQuery = [...uidToCardMap.keys()];
                if (uidsToQuery.length === 0) {
                    Utils.logger('info', '[API Processor] No items found to process.');
                    return 0; // Return 0 tasks added
                }
                Utils.logger('info', `[API Processor] Found ${uidsToQuery.length} items. Querying API in chunks of ${CHUNK_SIZE}...`);

                const allOwnedUids = new Set();
                for (let i = 0; i < uidsToQuery.length; i += CHUNK_SIZE) {
                    const chunk = uidsToQuery.slice(i, i + CHUNK_SIZE);
                    const apiUrl = new URL(API_ENDPOINT);
                    chunk.forEach(uid => apiUrl.searchParams.append('listing_ids', uid));
                    const response = await fetch(apiUrl.href, { headers: { 'accept': 'application/json, text/plain, */*', 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' } });
                    if (!response.ok) { continue; }
                    let data;
                    try { data = await response.json(); } catch (jsonError) { continue; }
                    data.filter(item => item.acquired).forEach(item => allOwnedUids.add(item.uid));
                    if (i + CHUNK_SIZE < uidsToQuery.length) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
                    }
                }
                
                let updatedCount = 0;
                const newlyAddedTasks = [];

                uidToCardMap.forEach((card, uid) => {
                    const isOwned = allOwnedUids.has(uid);
                    if (isOwned) {
                        const freeElement = card.querySelector(FREE_STATUS_SELECTOR);
                        if (freeElement) {
                            freeElement.replaceWith(createOwnedElement());
                            updatedCount++;
                        }
                    } else { // Item is not owned
                        const ownedElement = card.querySelector(OWNED_STATUS_SELECTOR);
                        if (ownedElement) {
                            ownedElement.replaceWith(createFreeElement());
                            updatedCount++;
                        }
                        if (autoAdd) {
                            const url = `${window.location.origin}/listings/${uid}`;
                            const cleanUrl = url.split('?')[0];
                            
                            // --- NEW: More Robust "Three-Way Check" before adding a task ---
                            const isAlreadyInTodo = Database.isTodo(cleanUrl);
                            const isAlreadyInFailed = State.db.failed.some(t => t.url === cleanUrl);
                            const isAlreadyCompletedThisSession = State.sessionCompleted.has(cleanUrl);

                            if (!isAlreadyInTodo && !isAlreadyInFailed && !isAlreadyCompletedThisSession) {
                                const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || 'Untitled';
                                newlyAddedTasks.push({ name, url: cleanUrl, type: 'detail', uid });
                            }
                        }
                    }
                });

                if (autoAdd && newlyAddedTasks.length > 0) {
                    State.db.todo.push(...newlyAddedTasks);
                    Utils.logger('info', `[API Processor] 已通过 API 精确扫描, 自动添加了 ${newlyAddedTasks.length} 个新项目到待办队列。`);
                }

                Utils.logger('info', `[API Processor] Complete. Updated ${updatedCount} card states.`);
                TaskRunner.runHideOrShow(); // Ensure UI reflects hidden state correctly
                return newlyAddedTasks.length;

            } catch (e) {
                Utils.logger('error', '[API Processor] An error occurred:', e.message);
                return 0; // Return 0 on error
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

        executeBatch: async () => {
            if (!State.isExecuting) return;

            // Stop condition for the entire execution process
            if (State.db.todo.length === 0 && State.activeWorkers === 0) {
                Utils.logger('info', '✅ 🎉 All tasks have been completed!');
                State.isExecuting = false;
                if (State.watchdogTimer) {
                    clearInterval(State.watchdogTimer);
                    State.watchdogTimer = null;
                }
                UI.update();
                return;
            }
            
            // --- DISPATCHER FOR DETAIL TASKS ---
            while (State.activeWorkers < Config.MAX_WORKERS && State.db.todo.length > 0 && State.db.todo[0].type === 'detail') {
                const task = State.db.todo.shift();
                State.activeWorkers++;
                
                const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                State.runningWorkers[workerId] = { task, startTime: Date.now() };

                Utils.logger('info', `🚀 Dispatching Worker [${workerId.substring(0, 12)}...] for: ${task.name}`);
                
                await GM_setValue(workerId, { task });

                const workerUrl = new URL(task.url);
                workerUrl.searchParams.set('workerId', workerId);
                GM_openInTab(workerUrl.href, { active: false, setParent: true });

                if (!State.watchdogTimer) {
                    TaskRunner.runWatchdog();
                }
            }
            UI.update();
        },

        processDetailPage: async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const workerId = urlParams.get('workerId');

            // If there's no workerId, this is not a worker tab, so we do nothing.
            if (!workerId) return;

            // This is a safety check. If the main tab stops execution, it might delete the task.
            const payload = await GM_getValue(workerId);
            if (!payload || !payload.task) {
                window.close();
                return;
            }

            const currentTask = payload.task;
            const logBuffer = [`[${workerId.substring(0, 12)}] Started: ${currentTask.name}`];
            let success = false;

            try {
                // API-First Ownership Check...
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
                    const statesData = JSON.parse(response.responseText);
                    const isOwned = statesData.some(s => s.uid === currentTask.uid && s.acquired);
                    if (isOwned) {
                        logBuffer.push(`API check confirms item is already owned.`);
                        success = true;
                    } else {
                        logBuffer.push(`API check confirms item is not owned. Proceeding to UI interaction.`);
                    }
                } catch (apiError) {
                    logBuffer.push(`API ownership check failed: ${apiError.message}. Falling back to UI-based check.`);
                }

                if (!success) {
                    try {
                        const isItemOwned = () => {
                            const criteria = Config.OWNED_SUCCESS_CRITERIA;
                            const snackbar = document.querySelector('.fabkit-Snackbar-root, div[class*="Toast-root"]');
                            if (snackbar && criteria.snackbarText.some(text => snackbar.textContent.includes(text))) return { owned: true, reason: `Snackbar text "${snackbar.textContent}"` };
                            const successHeader = document.querySelector('h2');
                            if (successHeader && criteria.h2Text.some(text => successHeader.textContent.includes(text))) return { owned: true, reason: `H2 text "${successHeader.textContent}"` };
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
                            const licenseButton = [...document.querySelectorAll('button')].find(btn => btn.textContent.includes('选择许可'));
                            if (licenseButton) {
                                logBuffer.push(`Multi-license item detected. Setting up observer for dropdown.`);
                                await new Promise((resolve, reject) => {
                                    const observer = new MutationObserver((mutationsList, obs) => {
                                        for (const mutation of mutationsList) {
                                            if (mutation.addedNodes.length > 0) {
                                                for (const node of mutation.addedNodes) {
                                                    if (node.nodeType !== 1) continue;
                                                    const freeTextElement = Array.from(node.querySelectorAll('span, div')).find(el =>
                                                        Array.from(el.childNodes).some(cn => cn.nodeType === 3 && cn.textContent.trim() === '免费')
                                                    );
                                                    if (freeTextElement) {
                                                        const clickableParent = freeTextElement.closest('[role="option"], button');
                                                        if (clickableParent) {
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
                                    Utils.deepClick(licenseButton); // First click attempt
                                    setTimeout(() => Utils.deepClick(licenseButton), 1500); // Second attempt
                                    setTimeout(() => {
                                        observer.disconnect();
                                        reject(new Error('Timeout (5s): The "免费" option did not appear.'));
                                    }, 5000);
                                });
                                // After license selection, re-check ownership before trying the main button
                                await new Promise(r => setTimeout(r, 500)); // wait for UI update
                                if(isItemOwned().owned) success = true;
                            }
                            
                            // If not successful after license check, or if it wasn't a license item
                            if (!success) {
                                 const actionButton = [...document.querySelectorAll('button.fabkit-Button-root')].find(btn =>
                                    [...Config.ACQUISITION_TEXT_SET].some(keyword => btn.textContent.includes(keyword))
                                );

                                if (actionButton) {
                                    Utils.deepClick(actionButton);
                                    await new Promise((resolve, reject) => {
                                        const timeout = 25000;
                                        const interval = setInterval(() => {
                                            if (isItemOwned().owned) {
                                                success = true;
                                                clearInterval(interval);
                                                resolve();
                                            }
                                        }, 500);
                                        setTimeout(() => {
                                            clearInterval(interval);
                                            reject(new Error(`Timeout waiting for page to enter an 'owned' state.`));
                                        }, timeout);
                                    });
                                } else {
                                     throw new Error('Could not find a final acquisition button.');
                                }
                            }
                        }
                    } catch (uiError) {
                         logBuffer.push(`UI interaction failed: ${uiError.message}`);
                         success = false;
                    }
                }
            } catch (error) {
                logBuffer.push(`A critical error occurred: ${error.message}`);
                success = false;
            } finally {
                if (success) {
                    await Database.markAsDone(currentTask);
                    logBuffer.push(`✅ Task marked as DONE.`);
                } else {
                    await Database.markAsFailed(currentTask);
                    logBuffer.push(`❌ Task marked as FAILED.`);
                }
                
                // This is the one and only signal the worker sends back.
                // It contains its ID, its success status, and its full log.
                await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                    workerId: workerId,
                    success: success,
                    logs: logBuffer
                });
                await GM_deleteValue(workerId);
                window.close();
            }
        },

        // This function is now fully obsolete.
        advanceDetailTask: async () => {},

        runHideOrShow: async () => {
            // Optimization: Check if there are any unprocessed cards first. If not, exit early.
            const cards = document.querySelectorAll(`${Config.SELECTORS.card}:not(.fab-helper-processed)`);
            if (cards.length === 0) {
                // Still update the count in case it was changed elsewhere, but don't re-run logic.
                const allHiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`);
                if (State.hiddenThisPageCount !== allHiddenCards.length) {
                    State.hiddenThisPageCount = allHiddenCards.length;
                    UI.update();
                }
                return;
            }

            // 重置计数
            State.hiddenThisPageCount = 0;
            
            // 获取所有尚未处理的卡片
            const cardsArray = Array.from(cards);
            
            // 如果没有新卡片需要处理，直接更新UI并返回
            if (cardsArray.length === 0) {
                // 仍然需要更新UI以防计数在其他地方被改变
                const allHiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`);
                State.hiddenThisPageCount = allHiddenCards.length;
                UI.update();
                return;
            }
            
            // 预处理：找出所有需要隐藏的卡片
            const cardsToHide = [];
            const cardsToShow = [];
            
            for (const card of cardsArray) {
                const text = card.textContent || '';
                const link = card.querySelector(Config.SELECTORS.cardLink);
                if (!link) continue;
                
                const url = link.href.split('?')[0];
                const isNativelySaved = [...Config.SAVED_TEXT_SET].some(s => text.includes(s));
                const isSessionCompleted = State.sessionCompleted.has(url);
                
                // 确保将已保存但未记录的项目添加到会话完成集合
                if (isNativelySaved && !isSessionCompleted) {
                    State.sessionCompleted.add(url);
                }
                
                // 分类卡片
                if (State.hideSaved && (isNativelySaved || isSessionCompleted)) {
                    cardsToHide.push(card);
                } else {
                    cardsToShow.push({card, isOwned: isNativelySaved || isSessionCompleted});
                }
            }
            
            // 更新隐藏计数
            State.hiddenThisPageCount = cardsToHide.length;
            Utils.logger('info', `需要隐藏的卡片总数: ${cardsToHide.length}`);
            
            // 处理需要隐藏的卡片
            if (cardsToHide.length > 100) {
                // 对于大量卡片，只对最后100个添加延迟
                const directHideCards = cardsToHide.slice(0, cardsToHide.length - 100);
                const delayHideCards = cardsToHide.slice(cardsToHide.length - 100);
                
                // 直接隐藏大部分卡片
                directHideCards.forEach(card => {
                    card.style.display = 'none';
                });
                
                // 对最后100个卡片添加延迟
                for (let i = 0; i < delayHideCards.length; i++) {
                    delayHideCards[i].style.display = 'none';
                    delayHideCards[i].classList.add('fab-helper-processed'); // 标记为已处理
                    
                    // 添加小延迟
                    if (i < delayHideCards.length - 1) {
                        const delay = Math.floor(Math.random() * 50) + 20; // 更短的延迟(20-70ms)
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            } else {
                // 对于少量卡片，全部添加延迟
                for (let i = 0; i < cardsToHide.length; i++) {
                    cardsToHide[i].style.display = 'none';
                    cardsToHide[i].classList.add('fab-helper-processed'); // 标记为已处理
                    
                    // 添加小延迟
                    if (i < cardsToHide.length - 1) {
                        const delay = Math.floor(Math.random() * 100) + 50; // 50-150ms延迟
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            
            // 处理需要显示的卡片
            cardsToShow.forEach(({card, isOwned}) => {
                card.style.display = '';
                
                // 确保已拥有的项目在UI上有正确的标记
                if (isOwned) {
                    UI.applyOverlay(card, 'owned');
                } else {
                    // 移除任何现有的覆盖层
                    const existing = card.querySelector('.fab-helper-overlay-v8');
                    if (existing) existing.remove();
                }
                card.classList.add('fab-helper-processed'); // 标记为已处理
            });
            
            // 更新UI显示
            UI.update();
        },

        // --- NEW: Cooldown UI Logic ---
        initiateCooldownSequence: async () => {
            // 1. Memory: Remember current state
            State.wasExecutingBeforeCooldown = State.isExecuting;
            State.isCoolingDown = true;
            if (State.isExecuting) State.isExecuting = false; // Pause execution
            Utils.logger('error', 'PHOENIX PROTOCOL: Rate limit detected. Initiating cooldown sequence...');

            // 2. Initial Cooldown
            let countdown = 60;
            const updateTimer = () => {
                if (State.UI.cooldownStatus) {
                    State.UI.cooldownStatus.innerHTML = `服务器速率限制中... 正在冷却，${countdown}秒后尝试恢复。`;
                }
                UI.update();
            };
            updateTimer();
            const timerInterval = setInterval(() => {
                countdown--;
                updateTimer();
                if (countdown <= 0) clearInterval(timerInterval);
            }, 1000);
            await new Promise(resolve => setTimeout(resolve, 60000));

            // 3. Recovery Verification
            let isRecovered = false;
            let retryCount = 0;
            const MAX_RETRIES = 10; // To prevent infinite loops
            while (!isRecovered && retryCount < MAX_RETRIES) {
                retryCount++;
                Utils.logger('info', `PHOENIX PROTOCOL: Verification attempt #${retryCount}... Sending canary request.`);
                if (State.UI.cooldownStatus) State.UI.cooldownStatus.innerHTML = `正在发送探针请求以验证服务器状态... (尝试 ${retryCount}/${MAX_RETRIES})`;
                try {
                    const csrfToken = Utils.getCookie('fab_csrftoken');
                    const canaryUrl = 'https://www.fab.com/i/listings/search?count=1';
                    const response = await API.gmFetch({
                        method: 'GET',
                        url: canaryUrl,
                        headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                    });
                    if (response.status === 200) {
                        isRecovered = true;
                        Utils.logger('info', 'PHOENIX PROTOCOL: Verification successful! Server is responsive.');
                    } else {
                        Utils.logger('warn', `PHOENIX PROTOCOL: Verification failed. Server responded with ${response.status}. Retrying in 30s.`);
                        countdown = 30;
                        const retryTimerInterval = setInterval(() => {
                            countdown--;
                             if (State.UI.cooldownStatus) State.UI.cooldownStatus.innerHTML = `探针失败，服务器仍有限制。${countdown}秒后再次尝试...`;
                            if (countdown <= 0) clearInterval(retryTimerInterval);
                        }, 1000);
                        await new Promise(resolve => setTimeout(resolve, 30000));
                    }
                } catch (e) {
                     Utils.logger('error', 'PHOENIX PROTOCOL: Canary request failed critically.', e);
                     await new Promise(resolve => setTimeout(resolve, 30000));
                }
            }

            // 4. Resurrection & Resumption
            State.isCoolingDown = false;
            Utils.logger('info', 'PHOENIX PROTOCOL: Cooldown sequence complete.');
            if (isRecovered && State.wasExecutingBeforeCooldown) {
                Utils.logger('info', 'PHOENIX PROTOCOL: Resuming previously active tasks...');
                State.isExecuting = true; // Restore state
                TaskRunner.startExecution();
            } else if (!isRecovered) {
                Utils.logger('error', 'PHOENIX PROTOCOL: Max verification retries reached. Server still unresponsive. Aborting auto-resume.');
            }
            State.wasExecutingBeforeCooldown = false; // Clear memory
            UI.update();
        },
    };


    // --- 模块八: 用户界面 (User Interface) ---
    const UI = {
        create: () => {
            // New, more robust rule: A detail page is identified by the presence of a main "acquisition" button,
            // not by its URL, which can be inconsistent.
            const acquisitionButton = [...document.querySelectorAll('button')].find(btn =>
                [...Config.ACQUISITION_TEXT_SET].some(keyword => btn.textContent.includes(keyword))
            );
            
            // The "Download" button is another strong signal.
            const downloadButton = [...document.querySelectorAll('a[href*="/download/"], button')].find(btn =>
                btn.textContent.includes('下载') || btn.textContent.includes('Download')
            );

            if (acquisitionButton || downloadButton) {
                 const urlParams = new URLSearchParams(window.location.search);
                 if (urlParams.has('workerId')) return;

                Utils.logger('info', "On a detail page (detected by action buttons), skipping UI creation.");
                return;
            }

            if (document.getElementById(Config.UI_CONTAINER_ID)) return;

            // --- Style Injection ---
            const styles = `
                :root {
                    --bg-color: rgba(28, 28, 30, 0.7);
                    --border-color: rgba(255, 255, 255, 0.1);
                    --text-color-primary: #f5f5f7;
                    --text-color-secondary: #a0a0a5;
                    --radius-l: 16px;
                    --radius-m: 10px;
                    --radius-s: 8px;
                    --blue: #007aff; --pink: #ff2d55; --green: #34c759;
                    --orange: #ff9500; --gray: #8e8e93; --dark-gray: #555;
                }
                #${Config.UI_CONTAINER_ID} {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: var(--bg-color);
                    backdrop-filter: blur(12px) saturate(1.5);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-l);
                    color: var(--text-color-primary);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 12px;
                    width: 300px;
                    font-size: 14px;
                }
                .fab-helper-header, .fab-helper-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                }
                .fab-helper-header h2 {
                    font-size: 16px; font-weight: 600; margin: 0;
                }
                .fab-helper-icon-btn {
                    background: transparent; border: none; color: var(--text-color-secondary);
                    cursor: pointer; padding: 4px; font-size: 18px; line-height: 1;
                }
                .fab-helper-status-bar {
                    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
                }
                .fab-helper-status-item {
                    background: rgba(255, 255, 255, 0.1); padding: 6px;
                    border-radius: var(--radius-s); font-size: 11px; text-align: center;
                    color: var(--text-color-secondary);
                }
                .fab-helper-status-item span {
                    display: block; font-size: 16px; font-weight: 600; color: #fff;
                }
                #${Config.UI_CONTAINER_ID} button {
                    border: none; border-radius: var(--radius-m); padding: 10px 14px;
                    font-size: 14px; font-weight: 500; cursor: pointer;
                    transition: all 0.2s; color: #fff; flex-grow: 1;
                }
                .fab-helper-btn-section {
                    display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;
                }
                .fab-helper-section-title {
                    font-size: 13px; color: var(--text-color-secondary); font-weight: 600; margin: 8px 0 4px 0; letter-spacing: 1px;
                }
                .fab-helper-divider {
                    border: none; border-top: 1px solid var(--border-color); margin: 8px 0;
                }
                @keyframes fab-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 45, 85, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 45, 85, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 45, 85, 0); }
                }
                .fab-helper-pulse {
                    animation: fab-pulse 2s infinite;
                }
                .fab-helper-progress-container {
                    display: none; /* Hidden by default */
                    flex-direction: column;
                    gap: 4px;
                    margin-bottom: 8px;
                }
                .fab-helper-progress-bar {
                    width: 100%;
                    background-color: var(--dark-gray);
                    border-radius: var(--radius-s);
                    height: 10px;
                    overflow: hidden;
                }
                .fab-helper-progress-bar-fill {
                    height: 100%;
                    width: 0%;
                    background-color: var(--blue);
                    transition: width 0.3s ease-in-out;
                }
                .fab-helper-progress-text {
                    font-size: 11px;
                    color: var(--text-color-secondary);
                    text-align: center;
                }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = styles;
            styleSheet.setAttribute('data-fab-helper-style', 'true');
            document.head.appendChild(styleSheet);

            const container = document.createElement('div');
            container.id = Config.UI_CONTAINER_ID;

            // -- Header --
            const header = document.createElement('div');
            header.className = 'fab-helper-header';
            const title = document.createElement('h2');
            title.textContent = `Fab Helper ${Config.SCRIPT_NAME.match(/v(\d+\.\d+\.\d+)/)[1]}`;
            const headerControls = document.createElement('div');
            const copyLogBtn = document.createElement('button');
            copyLogBtn.className = 'fab-helper-icon-btn';
            copyLogBtn.innerHTML = '📄';
            copyLogBtn.title = Utils.getText('copyLog');
            copyLogBtn.onclick = () => {
                navigator.clipboard.writeText(State.UI.logPanel.innerText).then(() => {
                    const originalIcon = copyLogBtn.innerHTML;
                    copyLogBtn.innerHTML = '✅';
                    setTimeout(() => { copyLogBtn.innerHTML = originalIcon; }, 1500);
                }).catch(err => Utils.logger('error', 'Failed to copy log:', err));
            };
            const clearLogBtn = document.createElement('button');
            clearLogBtn.className = 'fab-helper-icon-btn';
            clearLogBtn.innerHTML = '🗑️';
            clearLogBtn.title = Utils.getText('clearLog');
            clearLogBtn.onclick = () => { State.UI.logPanel.innerHTML = ''; };
            headerControls.append(copyLogBtn, clearLogBtn);
            header.append(title, headerControls);

            // -- Status Bar --
            const statusBar = document.createElement('div');
            statusBar.className = 'fab-helper-status-bar';
            const createStatusItem = (id, label) => {
                const item = document.createElement('div');
                item.className = 'fab-helper-status-item';
                item.innerHTML = `${label} <span id="${id}">0</span>`;
                return item;
            };
            State.UI.statusTodo = createStatusItem('fab-status-todo', `📥 ${Utils.getText('todo')}`);
            State.UI.statusDone = createStatusItem('fab-status-done', `✅ ${Utils.getText('added')}`);
            State.UI.statusFailed = createStatusItem('fab-status-failed', `❌ ${Utils.getText('failed')}`);
            statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed);

            // -- NEW: Progress Bar --
            const progressContainer = document.createElement('div');
            progressContainer.className = 'fab-helper-progress-container';

            const progressText = document.createElement('div');
            progressText.className = 'fab-helper-progress-text';
            progressText.textContent = 'Progress: (0/0)';

            const progressBar = document.createElement('div');
            progressBar.className = 'fab-helper-progress-bar';
            const progressBarFill = document.createElement('div');
            progressBarFill.className = 'fab-helper-progress-bar-fill';
            progressBar.appendChild(progressBarFill);

            progressContainer.append(progressText, progressBar);

            // Store references in State.UI
            State.UI.progressContainer = progressContainer;
            State.UI.progressText = progressText;
            State.UI.progressBarFill = progressBarFill;

            // -- Log Panel --
            // 创建日志面板标题行
            const logHeader = document.createElement('div');
            logHeader.className = 'fab-helper-header';
            
            const logTitle = document.createElement('span');
            logTitle.textContent = '📝 操作日志';
            logTitle.style.fontWeight = '500';
            
            const toggleLogBtn = document.createElement('button');
            toggleLogBtn.className = 'fab-helper-icon-btn';
            toggleLogBtn.innerHTML = State.isLogCollapsed ? '📂' : '📁';
            toggleLogBtn.title = State.isLogCollapsed ? '展开日志' : '收起日志';
            toggleLogBtn.onclick = () => UI.toggleLogPanel();
            
            logHeader.append(logTitle, toggleLogBtn);
            
            // 创建日志内容面板
            State.UI.logPanel = document.createElement('div');
            State.UI.logPanel.id = 'fab-log-panel';
            State.UI.logPanel.style.cssText = `
  background: rgba(30,30,30,0.85);
  color: #eee;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px 6px 8px 8px;
  border-radius: 8px;
  margin: 4px 0;
  max-height: 40vh;
  overflow-y: auto;
  min-height: 40px;
  height: ${State.isLogCollapsed ? '42px' : '200px'};
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column-reverse;
  transition: height 0.3s ease;
`;
            // 如果日志面板处于折叠状态，设置overflow为hidden
            if (State.isLogCollapsed) {
                State.UI.logPanel.style.overflowY = 'hidden';
            }

            // -- Basic Section --
            const basicSection = document.createElement('div');
            basicSection.className = 'fab-helper-btn-section';
            const basicTitle = document.createElement('div');
            basicTitle.className = 'fab-helper-section-title';
            basicTitle.textContent = '🧩 基础功能 (Basic)';
            // 本页一键领取
            const addAllBtn = document.createElement('button');
            addAllBtn.innerHTML = '✨ 本页智能添加';
            addAllBtn.id = 'fab-smart-add-btn'; // NEW: Add ID for disabling
            addAllBtn.style.background = 'var(--green)';
            addAllBtn.onclick = async () => {
                Utils.logger('info', 'Starting API-based scan for all items on this page...');
                const newTasksCount = await TaskRunner.processPageWithApi({ autoAdd: true, onlyVisible: false });
                if (newTasksCount > 0) {
                    TaskRunner.startExecution();
                } else {
                    Utils.logger('info', 'API scan complete. No new unowned items found on this page.');
                }
            };
            // 启动任务
            State.UI.execBtn = document.createElement('button');
            State.UI.execBtn.innerHTML = '🚀 启动任务';
            State.UI.execBtn.style.background = 'var(--pink)';
            State.UI.execBtn.onclick = TaskRunner.toggleExecution;
            // 本页刷新状态
            const refreshPageBtn = document.createElement('button');
            refreshPageBtn.innerHTML = '🔄 本页刷新状态';
            refreshPageBtn.style.background = 'var(--blue)';
            refreshPageBtn.onclick = TaskRunner.refreshVisibleStates;
            // 本页隐藏/显示已拥有
            State.UI.hideBtn = document.createElement('button');
            State.UI.hideBtn.innerHTML = '🙈 隐藏已拥有';
            State.UI.hideBtn.style.background = 'var(--blue)';
            State.UI.hideBtn.onclick = TaskRunner.toggleHideSaved;
            
            // 热更新脚本按钮
            const hotReloadBtn = document.createElement('button');
            hotReloadBtn.innerHTML = '🔥 剪贴板热更新';
            hotReloadBtn.style.background = 'var(--orange)';
            hotReloadBtn.onclick = TaskRunner.hotReloadScript;

            // NEW: Smart Pursuit Toggle
            const pursuitRow = document.createElement('div');
            pursuitRow.className = 'fab-helper-row';
            pursuitRow.style.cssText = 'padding: 6px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-top: 8px;';
            const pursuitLabel = document.createElement('label');
            pursuitLabel.textContent = '开启智能追击模式';
            pursuitLabel.style.cursor = 'pointer';
            const pursuitCheckbox = document.createElement('input');
            pursuitCheckbox.type = 'checkbox';
            pursuitCheckbox.style.cursor = 'pointer';
            pursuitCheckbox.checked = localStorage.getItem('fab_smart_pursuit_enabled') === 'true';
            State.isSmartPursuitEnabled = pursuitCheckbox.checked;
            pursuitCheckbox.onchange = () => {
                State.isSmartPursuitEnabled = pursuitCheckbox.checked;
                localStorage.setItem('fab_smart_pursuit_enabled', State.isSmartPursuitEnabled);
                Utils.logger('info', `智能追击模式已 ${State.isSmartPursuitEnabled ? '开启' : '关闭'}.`);
            };
            pursuitLabel.prepend(pursuitCheckbox);
            pursuitRow.appendChild(pursuitLabel);


            basicSection.append(basicTitle, addAllBtn, State.UI.execBtn, refreshPageBtn, State.UI.hideBtn, hotReloadBtn, pursuitRow);

            // --- NEW: Page Patcher Section ---
            const pageModSection = document.createElement('div');
            pageModSection.className = 'fab-helper-btn-section';
            const modTitle = document.createElement('div');
            modTitle.className = 'fab-helper-section-title';
            modTitle.textContent = '🔧 页面魔改 (Page Mod)';

            const patcherRow = document.createElement('div');
            patcherRow.className = 'fab-helper-row';
            patcherRow.style.cssText = 'padding: 6px; background: rgba(0,0,0,0.2); border-radius: 8px;';
            
            const patcherLabel = document.createElement('label');
            patcherLabel.textContent = '启用搜索起点修改';
            patcherLabel.style.cursor = 'pointer';
            
            const patcherCheckbox = document.createElement('input');
            patcherCheckbox.type = 'checkbox';
            patcherCheckbox.style.cursor = 'pointer';
            patcherCheckbox.checked = State.isPagePatchingEnabled;
            patcherCheckbox.onchange = async () => {
                State.isPagePatchingEnabled = patcherCheckbox.checked;
                await GM_setValue(Config.DB_KEYS.PATCH_ENABLED, State.isPagePatchingEnabled);
                Utils.logger('info', `页面起点修改已 ${State.isPagePatchingEnabled ? '启用' : '禁用'}.`);
            };
            patcherLabel.prepend(patcherCheckbox);

            const resetCursorBtn = document.createElement('button');
            resetCursorBtn.innerHTML = '清除起点';
            resetCursorBtn.style.cssText = 'padding: 4px 8px; font-size: 12px; flex-grow: 0; background: var(--gray);';
            resetCursorBtn.onclick = async () => {
                await GM_deleteValue(Config.DB_KEYS.SAVED_CURSOR);
                State.savedCursor = null;
                Utils.logger('info', '已清除已保存的页面起点。下次将从头开始加载。');
                alert('已清除已保存的页面起点。');
            };

            patcherRow.append(patcherLabel, resetCursorBtn);
            pageModSection.append(modTitle, patcherRow);


            const networkAnalysisSection = document.createElement('div');
            networkAnalysisSection.className = 'fab-helper-network-analysis';
            networkAnalysisSection.style.display = 'block'; // 默认显示

            const networkTitle = document.createElement('div');
            networkTitle.className = 'fab-helper-section-title';
            networkTitle.textContent = '📈 网络分析 (Network Analysis)';
            networkTitle.style.cursor = 'pointer';
            networkTitle.onclick = () => {
                const content = networkAnalysisSection.querySelector('.fab-helper-network-content');
                content.style.display = content.style.display === 'none' ? 'grid' : 'none';
            };

            const networkContent = document.createElement('div');
            networkContent.className = 'fab-helper-network-content';
            networkContent.style.cssText = `
                display: grid; /* 默认内容显示 */
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                background: rgba(0,0,0,0.2);
                padding: 8px;
                border-radius: var(--radius-m);
                margin-top: 4px;
            `;

            const createMetricDisplay = (id, label, value) => {
                const item = document.createElement('div');
                item.className = 'fab-helper-status-item';
                item.innerHTML = `${label}<span id="${id}">${value}</span>`;
                return item;
            };

            State.UI.rpsDisplay = createMetricDisplay('fab-rps-display', '实时RPS', '0');
            State.UI.peakRpsDisplay = createMetricDisplay('fab-peak-rps-display', '峰值RPS', '0');
            networkContent.append(State.UI.rpsDisplay, State.UI.peakRpsDisplay);

            // NEW: Cumulative Weight Display
            const cumulativeWeightDisplay = createMetricDisplay('fab-cumulative-weight', 'ID查询数 (60s)', '0');
            cumulativeWeightDisplay.style.gridColumn = '1 / -1';
            networkContent.appendChild(cumulativeWeightDisplay);
            State.UI.cumulativeWeightDisplay = cumulativeWeightDisplay;

            const last429Info = document.createElement('div');
            last429Info.id = 'fab-last-429-info';
            last429Info.style.cssText = `
                grid-column: 1 / -1;
                font-size: 11px;
                color: var(--text-color-secondary);
                background: rgba(0,0,0,0.2);
                padding: 6px;
                border-radius: var(--radius-s);
                line-height: 1.4;
            `;
            last429Info.innerHTML = '<b>最近429事件:</b><br>尚无记录';
            State.UI.last429Display = last429Info;
            networkContent.appendChild(last429Info);
            
            // NEW: Button to clear the persistent network log
            const clearNetworkLogBtn = document.createElement('button');
            clearNetworkLogBtn.innerHTML = '🗑️ 清空网络日志';
            clearNetworkLogBtn.style.cssText = `
                grid-column: 1 / -1;
                background: var(--dark-gray);
                padding: 6px 10px;
                font-size: 12px;
                margin-top: 4px;
            `;
            clearNetworkLogBtn.onclick = () => {
                if (window.confirm('您确定要清空所有已记录的网络日志（RPS, 429事件）吗？此操作不可逆。')) {
                    NetworkRecorder.log = [];
                    localStorage.removeItem(NetworkRecorder.DB_KEY);
                    NetworkAnalyzer.peakRps = 0; // Also reset peak RPS
                    GM_deleteValue(Config.DB_KEYS.PEAK_RPS); // NEW: And clear the persisted value
                    NetworkAnalyzer.updateUI(); // Force UI to reflect the change
                    Utils.logger('info', 'Network log has been cleared.');
                }
            };
            networkContent.appendChild(clearNetworkLogBtn);

            networkAnalysisSection.append(networkTitle, networkContent);

            // NEW: Cooldown status bar
            const cooldownStatus = document.createElement('div');
            cooldownStatus.id = 'fab-cooldown-status';
            cooldownStatus.style.cssText = `
                display: none; /* Hidden by default */
                background: var(--orange); color: white; text-align: center;
                padding: 8px; border-radius: var(--radius-m); font-weight: 500; font-size: 13px;
                margin-top: 8px;
            `;
            networkAnalysisSection.insertAdjacentElement('beforebegin', cooldownStatus);
            State.UI.cooldownStatus = cooldownStatus;

            basicSection.appendChild(networkAnalysisSection);

            // -- Advanced Wrapper (状态栏+高级区) --
            const advancedWrapper = document.createElement('div');
            advancedWrapper.style.display = 'none'; 
            const divider = document.createElement('hr');
            divider.className = 'fab-helper-divider';
            const advSection = document.createElement('div');
            advSection.className = 'fab-helper-btn-section';
            advSection.style.display = '';
            const advTitle = document.createElement('div');
            advTitle.className = 'fab-helper-section-title';
            advTitle.textContent = '⚡ 高级功能 (Advanced/API)';
            // 批量侦察
            State.UI.reconBtn = document.createElement('button');
            State.UI.reconBtn.innerHTML = '🔍 批量侦察';
            State.UI.reconBtn.style.background = 'var(--green)';
            State.UI.reconBtn.onclick = TaskRunner.toggleRecon;
            // 批量领取
            // State.UI.execBtn = document.createElement('button');
            // State.UI.execBtn.innerHTML = '🚀 批量领取';
            // State.UI.execBtn.style.background = 'var(--pink)';
            // State.UI.execBtn.onclick = TaskRunner.toggleExecution;
            // 批量重试失败
            State.UI.retryBtn = document.createElement('button');
            State.UI.retryBtn.innerHTML = '🔁 批量重试失败';
            State.UI.retryBtn.style.background = 'var(--orange)';
            State.UI.retryBtn.onclick = TaskRunner.retryFailedTasks;
            // 批量刷新所有状态
            State.UI.refreshBtn = document.createElement('button');
            State.UI.refreshBtn.innerHTML = '🔄 批量刷新所有状态';
            State.UI.refreshBtn.style.background = 'var(--blue)';
            State.UI.refreshBtn.onclick = TaskRunner.refreshVisibleStates;
            // 重置侦察进度
            State.UI.resetReconBtn = document.createElement('button');
            State.UI.resetReconBtn.innerHTML = '⏮️ 重置侦察进度';
            State.UI.resetReconBtn.style.background = 'var(--gray)';
            State.UI.resetReconBtn.onclick = TaskRunner.resetReconProgress;
            // 新增：重置所有数据
            const resetDataBtn = document.createElement('button');
            resetDataBtn.innerHTML = '⚠️ 重置所有数据';
            resetDataBtn.style.background = 'var(--pink)'; // Use a "danger" color
            resetDataBtn.onclick = Database.resetAllData;
            advSection.append(advTitle, State.UI.reconBtn, State.UI.retryBtn, State.UI.refreshBtn, State.UI.resetReconBtn, resetDataBtn);
            advancedWrapper.append(statusBar, State.UI.progressContainer, divider, advSection);
            
            // 将其添加到基础功能区
            // basicSection.appendChild(networkAnalysisSection); // 暂时禁用
            
            // 组装 advancedWrapper
            advancedWrapper.append(statusBar, State.UI.progressContainer, divider, advSection);
            
            // -- Assemble UI --
            container.append(header, logHeader, State.UI.logPanel, basicSection, pageModSection, advancedWrapper);
            document.body.appendChild(container);
            State.UI.container = container;

            // --- Console Commands (Fix using unsafeWindow) ---
            // These commands are now less critical but kept for power users.
            unsafeWindow.FabHelperShowAdvanced = function() {
                advancedWrapper.style.display = '';
                console.log('Fab Helper Advanced UI is now visible.');
            };
            unsafeWindow.FabHelperHideAdvanced = function() {
                advancedWrapper.style.display = 'none';
                console.log('Fab Helper Advanced UI is now hidden.');
            };
            unsafeWindow.FabHelperResetData = Database.resetAllData;

            UI.update();
        },

        update: () => {
            if (!State.UI.container) return;
            
            // Status Bar
            State.UI.container.querySelector('#fab-status-todo').textContent = State.db.todo.length;
            State.UI.container.querySelector('#fab-status-done').textContent = State.db.done.length;
            State.UI.container.querySelector('#fab-status-failed').textContent = State.db.failed.length;
            
            // NEW: Progress Bar
            if (State.isExecuting && State.executionTotalTasks > 0) {
                State.UI.progressContainer.style.display = 'flex';
                const totalProcessed = State.executionCompletedTasks + State.executionFailedTasks;
                const percentage = (totalProcessed / State.executionTotalTasks) * 100;
                State.UI.progressBarFill.style.width = `${percentage}%`;
                State.UI.progressText.innerHTML = `
                    ✅ ${State.executionCompletedTasks} &nbsp;&nbsp; ❌ ${State.executionFailedTasks} &nbsp;&nbsp; / &nbsp;&nbsp; 📥 ${State.executionTotalTasks}
                `;
            } else {
                State.UI.progressContainer.style.display = 'none';
            }
            
            // Execute Button
            State.UI.execBtn.innerHTML = State.isExecuting ? `🛑 ${Utils.getText('stopExecute')}` : `🚀 ${Utils.getText('execute')}`;
            State.UI.execBtn.style.background = State.isExecuting ? 'var(--pink)' : 'var(--pink)';
            State.UI.execBtn.classList.remove('fab-helper-pulse');
            if (!State.isExecuting && State.db.todo.length > 0) {
                State.UI.execBtn.classList.add('fab-helper-pulse');
            }
            
            // Recon Button
            if (State.isReconning) {
                const displayPage = Utils.getDisplayPageFromUrl(GM_getValue(Config.DB_KEYS.NEXT_URL, ''));
                State.UI.reconBtn.innerHTML = `🔍 ${Utils.getText('reconning')} (${displayPage})`;
            } else {
                State.UI.reconBtn.innerHTML = `🔍 ${Utils.getText('recon')}`;
            }
            State.UI.reconBtn.disabled = State.isExecuting;
            State.UI.reconBtn.style.background = State.isReconning ? 'var(--orange)' : 'var(--green)';

            // Retry Button
            const hasFailedTasks = State.db.failed.length > 0;
            State.UI.retryBtn.innerHTML = `🔁 ${Utils.getText('retry_failed')} (${State.db.failed.length})`;
            State.UI.retryBtn.disabled = !hasFailedTasks || State.isExecuting;
            State.UI.retryBtn.style.background = 'var(--orange)';
            
            // Refresh Button
            State.UI.refreshBtn.innerHTML = `🔄 ${Utils.getText('refresh')}`;
            State.UI.refreshBtn.disabled = State.isExecuting || State.isReconning;
            State.UI.refreshBtn.style.background = 'var(--blue)';

            // Hide/Show Button
            const hideText = State.hideSaved ? Utils.getText('show') : Utils.getText('hide');
            State.UI.hideBtn.innerHTML = `${State.hideSaved ? '👀' : '🙈'} ${hideText} (${State.hiddenThisPageCount})`;
            State.UI.hideBtn.style.background = 'var(--blue)';
            
            // 添加计数变更时的动画效果
            if (State.UI.lastHiddenCount !== State.hiddenThisPageCount) {
                State.UI.hideBtn.classList.add('fab-helper-count-change');
                setTimeout(() => {
                    State.UI.hideBtn.classList.remove('fab-helper-count-change');
                }, 1000);
                State.UI.lastHiddenCount = State.hiddenThisPageCount;
            }

            // Reset Recon Button
            State.UI.resetReconBtn.innerHTML = `⏮️ ${Utils.getText('resetRecon')}`;
            State.UI.resetReconBtn.disabled = State.isExecuting || State.isReconning;
            State.UI.resetReconBtn.style.background = 'var(--gray)';

            // --- NEW: Cooldown UI Logic ---
            const buttonsToDisable = [State.UI.execBtn, State.UI.reconBtn, State.UI.retryBtn, State.UI.refreshBtn, document.querySelector('#fab-smart-add-btn')];
            if (State.isCoolingDown) {
                buttonsToDisable.forEach(btn => {
                    if (btn) {
                        btn.disabled = true;
                        btn.style.filter = 'grayscale(80%)';
                        btn.style.cursor = 'not-allowed';
                    }
                });
                if (State.UI.cooldownStatus.style.display !== 'block') {
                    State.UI.cooldownStatus.style.display = 'block';
                }
            } else {
                buttonsToDisable.forEach(btn => {
                    if (btn) {
                        btn.disabled = false;
                        btn.style.filter = '';
                        btn.style.cursor = 'pointer';
                    }
                });
                if (State.UI.cooldownStatus.style.display !== 'none') {
                    State.UI.cooldownStatus.style.display = 'none';
                }
            }
        },

        applyOverlay: (card, type='owned') => {
            const existing = card.querySelector('.fab-helper-overlay-v8');
            if (existing) existing.remove();
            const isNativelyOwned = card.textContent.includes('已保存在我的库中') || card.textContent.includes('Saved in My Library');
            if (isNativelyOwned) return;
            const link = card.querySelector(Config.SELECTORS.cardLink);
            const url = link && link.href.split('?')[0];
            if (!url) return;
            const overlay = document.createElement('div'); overlay.className='fab-helper-overlay-v8';
            const styles={position:'absolute',top:'0',left:'0',width:'100%',height:'100%',background:'rgba(25,25,25,0.6)',zIndex:'10',display:'flex',justifyContent:'center',alignItems:'center',fontSize:'24px',fontWeight:'bold',backdropFilter:'blur(2px)',borderRadius:'inherit'};
            
            // 改进基于会话的标记显示逻辑
            if (type==='owned' || State.sessionCompleted.has(url)) {
                styles.color='#4caf50';  // 绿色
                overlay.innerHTML='✅';   // 勾选标记
            }
            else if (type==='queued' && Database.isTodo(url)) {
                styles.color='#ff9800';  // 橙色
                overlay.innerHTML='⏳';   // 等待标记
            }
            else return;
            
            Object.assign(overlay.style,styles);
            const thumb=card.querySelector('.fabkit-Thumbnail-root, .AssetCard-thumbnail');
            if (thumb) {if(getComputedStyle(thumb).position==='static')thumb.style.position='relative';thumb.appendChild(overlay);}
        },

        removeAllOverlays: () => {
            document.querySelectorAll('.fab-helper-overlay-v8').forEach(overlay => overlay.remove());
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


    // --- 模块九: 主程序与初始化 (Main & Initialization) ---
    async function main() {
        // NEW: "Emergency Brake" system. Detect if the page is a hard-blocked JSON error.
        if (document.body && document.body.textContent) {
            const bodyContent = document.body.textContent.trim();
            if (bodyContent.startsWith('{') && bodyContent.endsWith('}')) {
                try {
                    const pageContent = JSON.parse(bodyContent);
                    if (pageContent.detail && pageContent.detail.toLowerCase().includes('too many requests')) {
                        const errorBox = document.createElement('div');
                        errorBox.style.cssText = `
                            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                            background: #d93025; color: white; padding: 20px; border-radius: 12px;
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            font-size: 18px; font-weight: 600; z-index: 10000;
                            box-shadow: 0 5px 15px rgba(0,0,0,0.3); text-align: center; line-height: 1.6;
                        `;
                        
                        let countdown = 30;
                        const updateErrorBox = () => {
                            errorBox.innerHTML = `
                                服务器硬性速率限制！<br>
                                页面加载失败, 返回: "Too many requests"<br><br>
                                这比普通的429错误更严重。脚本已暂停所有功能。<br>
                                <b>页面将在 ${countdown} 秒后自动刷新...</b>
                            `;
                        };
                        
                        updateErrorBox();
                        document.body.innerHTML = ''; // Clear the error JSON
                        document.body.appendChild(errorBox);

                        const countdownInterval = setInterval(() => {
                            countdown--;
                            updateErrorBox();
                            if (countdown <= 0) {
                                clearInterval(countdownInterval);
                            }
                        }, 1000);

                        setTimeout(() => {
                            window.location.reload();
                        }, 30000);

                        Utils.logger('error', 'Hard rate limit detected. Page is a JSON error. Initiating auto-refresh in 30s.');
                        return; // Abort all further script execution for this page load
                    }
                } catch (e) {
                    // Not a JSON page, proceed as normal.
                }
            }
        }

        if (State.isInitialized) return;
        State.isInitialized = true;

        Utils.detectLanguage();
        
        // 这些模块不依赖UI，可以先初始化
        NetworkFilter.init();
        await Database.load();

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('workerId')) {
            TaskRunner.processDetailPage();
            return; 
        }

        // 必须先创建UI
        UI.create();

        // 必须在创建UI后检查容器是否存在
        if (!State.UI.container) {
             Utils.logger('info', 'UI container not found, skipping remaining setup for this page.');
             return;
        }

        // 现在UI元素已存在，可以安全地初始化网络分析模块了
        NetworkRecorder.init();
        NetworkAnalyzer.init();

        const savedNextUrl = await GM_getValue(Config.DB_KEYS.NEXT_URL, null);
        if (savedNextUrl && State.UI.reconProgressDisplay) {
            const displayPage = Utils.getDisplayPageFromUrl(savedNextUrl);
            State.UI.reconProgressDisplay.textContent = `Page: ${displayPage}`;
            Utils.logger('info', `Found saved recon progress. Ready to resume.`);
        }

        UI.applyOverlaysToPage();
        TaskRunner.runHideOrShow(); // Initial run

        Utils.logger('info', Utils.getText('log_init'));

        // Attach listeners and observers
        const mainObserver = new MutationObserver((mutations) => {
            let hasNewCards = false;
            let newCardsFound = [];
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        // We only care about element nodes
                        if (node.nodeType === 1) {
                            // Check if the added node itself is a card and not yet processed
                            if (node.matches(Config.SELECTORS.card) && !node.classList.contains('fab-helper-processed')) {
                                hasNewCards = true;
                                newCardsFound.push(node);
                                UI.setupOwnershipObserver(node);
                            }
                            
                            // Check if the added node contains new cards (e.g., a container was added)
                            const containedCards = node.querySelectorAll(`${Config.SELECTORS.card}:not(.fab-helper-processed)`);
                            if (containedCards.length > 0) {
                                hasNewCards = true;
                                Array.from(containedCards).forEach(card => {
                                    newCardsFound.push(card);
                                    UI.setupOwnershipObserver(card);
                                });
                            }
                        }
                    });
                }
            }
            
            // This is the new, robust logic to prevent self-triggering loops.
            if (hasNewCards) {
                // 1. Disconnect the observer so our own DOM changes don't trigger it again.
                mainObserver.disconnect();
                Utils.logger('info', `检测到 ${newCardsFound.length} 个新卡片, 暂停监视器进行处理...`);
                
                // 2. Run all our DOM-modifying logic.
                UI.applyOverlaysToPage();
                
                // 3. Since runHideOrShow is async, we must wait for it to fully complete.
                TaskRunner.runHideOrShow().then(() => {
                    // 4. Once complete, reconnect the observer to watch for new external changes.
                    Utils.logger('info', `处理完成, 恢复监视器.`);
                    mainObserver.observe(document.body, { childList: true, subtree: true });
                });
            }
        });
        
        mainObserver.observe(document.body, { childList: true, subtree: true });

        // Listen for changes from other tabs
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.DONE, (name, old_value, new_value) => {
            State.db.done = new_value;
            UI.update();
            UI.applyOverlaysToPage();
        }));
        // TODO list is now session-based, so listening for its changes across tabs is no longer needed.
        /*
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.TODO, (name, old_value, new_value) => {
            State.db.todo = new_value;
            UI.applyOverlaysToPage();
            UI.update();
        }));
        */
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.FAILED, (name, old_value, new_value) => {
            State.db.failed = new_value;
            UI.update();
        }));
        // NEW LISTENER: This now exclusively handles the execution flow continuation.
        // It triggers when a worker tab finishes its batch and deletes the TASK key.
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.TASK, (name, old_value, new_value) => {
            if (!State.isExecuting) return;

            // Any activity from the worker (update or deletion) means it's alive. Clear the current watchdog.
            if (State.watchdogTimer) clearTimeout(State.watchdogTimer);
            State.watchdogTimer = null; // Clear the timer ID

            if (new_value) { // This is a "heartbeat" from the worker (task was updated).
                const payload = new_value; // GM listener passes the direct object
                // Update button with real-time progress
                const progressText = `(${payload.currentIndex + 1} / ${payload.batch.length})`;
                State.UI.execBtn.innerHTML = `🛑 ${Utils.getText('stopExecute')} ${progressText}`;

                // Set a new watchdog for the next step.
                State.watchdogTimer = setTimeout(() => {
                    Utils.logger('error', 'Watchdog: Worker tab seems to have stalled. Resetting executor state.');
                    State.isExecuting = false;
                    GM_deleteValue(Config.DB_KEYS.TASK); // Prevent a zombie worker from resuming later.
                    UI.update(); // Reset button text to default.
                }, 30000); // 30-second timeout for the next action.

            } else { // Batch is complete (new_value is null).
                Utils.logger('info', 'Batch completed. Checking for more tasks...');
                // The main UI button will be reset to its default state by UI.update() if we stop.
                if (State.db.todo.length > 0) {
                    Utils.logger('info', `Found ${State.db.todo.length} more tasks. Starting next batch in 1 second.`);
                    setTimeout(TaskRunner.executeBatch, 1000); // This will set its own watchdog via the listener.
                } else {
                    Utils.logger('info', 'All tasks are completed. Execution stopped.');
                    State.isExecuting = false;
                    UI.update();
                }
            }
        }));
        // RESTORED LISTENER: For receiving and printing logs from worker tabs.
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.WORKER_DONE, (key, oldValue, newValue) => {
            if (!newValue || !newValue.workerId) return;
            const { workerId, success, logs } = newValue;

            // --- Log printing first ---
            if (logs && Array.isArray(logs)) {
                Utils.logger('info', `--- Log Report from Worker [${workerId.substring(0,12)}] ---`);
                logs.forEach(logMsg => {
                    const logType = logMsg.includes('FAIL') ? 'error' : 'info';
                    Utils.logger(logType, logMsg);
                });
                Utils.logger('info', '--- End Log Report ---');
            }

            // --- Then, process the result ---
            if (State.runningWorkers[workerId]) {
                const task = State.runningWorkers[workerId].task;  // Get the task from runningWorkers
                if (success) {
                    State.executionCompletedTasks++;
                    State.sessionPursuitCompletedCount++; // Increment session counter for Smart Pursuit
                    
                    if (task && task.url) {
                        State.sessionCompleted.add(task.url.split('?')[0]); 
                        UI.applyOverlaysToPage(); 
                    }

                    // --- Smart Pursuit Trigger ---
                    const SMART_PURSUIT_THRESHOLD = 5;
                    if (State.isSmartPursuitEnabled && State.sessionPursuitCompletedCount >= SMART_PURSUIT_THRESHOLD) {
                        Utils.logger('info', `[智能追击] 已完成 ${State.sessionPursuitCompletedCount} 个任务, 达到阈值! 自动触发新一轮扫描...`);
                        State.sessionPursuitCompletedCount = 0; // Reset counter for the next cycle
                        
                        // Use a small timeout to allow the UI to update before starting the heavy task
                        setTimeout(async () => {
                            const newTasksCount = await TaskRunner.processPageWithApi({ autoAdd: true, onlyVisible: false });
                            if (newTasksCount > 0) {
                                // NEW: If execution is running, update the total task count for the progress bar.
                                if (State.isExecuting) {
                                    State.executionTotalTasks += newTasksCount;
                                }
                                Utils.logger('info', `[智能追击] 扫描完成, ${newTasksCount} 个新任务已添加。执行器将自动处理。`);
                            } else {
                                Utils.logger('info', `[智能追击] 扫描完成, 未发现新任务。`);
                            }
                        }, 500);
                    }

                } else {
                    State.executionFailedTasks++;
                }

                State.activeWorkers--;
                delete State.runningWorkers[workerId];
                // This log now makes more sense as it comes AFTER the detailed log report.
                Utils.logger('info', `Worker [${workerId.substring(0,12)}] has finished. Active: ${State.activeWorkers}. Progress: ${State.executionCompletedTasks + State.executionFailedTasks}/${State.executionTotalTasks}`);
                
                // Explicitly update UI to show progress immediately
                UI.update();
                
                TaskRunner.executeBatch();
            }
        }));
        
        // The old TASK listener is now obsolete and will be removed.
        const oldTaskListener = State.valueChangeListeners.find(l => l.key === Config.DB_KEYS.TASK);
        if (oldTaskListener) {
            GM_removeValueChangeListener(oldTaskListener.id);
            State.valueChangeListeners = State.valueChangeListeners.filter(l => l.key !== Config.DB_KEYS.TASK);
        }

        // UI创建后，可以安全地初始化页面补丁了 (因为它依赖于从DB加载到State的数据)
        PagePatcher.init();
    }

    // --- Script Entry Point ---
    // This is the final, robust, SPA-and-infinite-scroll-aware entry point.
    const entryObserver = new MutationObserver(() => {
        // We only re-initialize if the URL has actually changed.
        if (window.location.href !== State.lastKnownHref) {
            // A short debounce to handle rapid URL changes.
            setTimeout(() => {
                if (window.location.href !== State.lastKnownHref) {
                    State.lastKnownHref = window.location.href;
                    Utils.cleanup();
                    main();
                }
            }, 250);
        }
    });

    entryObserver.observe(document.body, { childList: true, subtree: true });
    
    // Store the observer on a globally accessible object so we can disconnect it during hot-reload
    unsafeWindow.fabHelperEntryObserver = entryObserver;
    entryObserver.observe(document.body, { childList: true, subtree: true });
    
    // Initial run when the script is first injected.
    State.lastKnownHref = window.location.href;
    // The initial cleanup function is minimal. `main` will define a more comprehensive one.
    Utils.cleanup = () => {
        if (State.watchdogTimer) clearInterval(State.watchdogTimer);
        State.valueChangeListeners.forEach(id => GM_removeValueChangeListener(id));
        State.valueChangeListeners = [];
    };
    main();

    const NetworkRecorder = {
        DB_KEY: 'fab_network_log_v1', // Re-instated for persistence
        MAX_RECORDS: 500,
        log: [],
        lastRequestTimestamp: null, // NEW: For calculating request intervals

        init: () => {
            // Re-instated: Load persistent log from localStorage
            const savedLog = localStorage.getItem(NetworkRecorder.DB_KEY);
            if (savedLog) {
                try {
                    NetworkRecorder.log = JSON.parse(savedLog);
                } catch (e) {
                    NetworkRecorder.log = [];
                }
            }
            
            // The global interceptor is now handled by PagePatcher to avoid conflicts.
            // NetworkRecorder is now a purely passive service.
            Utils.logger('info', 'Network flight recorder is active (passive mode).');
        },

        recordRequest: (url, status, responseText = '') => {
            const now = Date.now();
            
            const interval = NetworkRecorder.lastRequestTimestamp ? now - NetworkRecorder.lastRequestTimestamp : null;
            const tenSecondWindow = now - 10000;
            const density = NetworkRecorder.log.filter(r => r.timestamp > tenSecondWindow).length + 1;
            
            NetworkRecorder.lastRequestTimestamp = now;

            let finalStatus = status;
            let isSoft429 = false;

            if (url.includes('/i/listings/search') && status === 200) {
                 try {
                    if (typeof responseText === 'string' && responseText.includes('Too many requests')) {
                        const responseJson = JSON.parse(responseText);
                        if (responseJson.detail) {
                            isSoft429 = true;
                            finalStatus = 429;
                        }
                    }
                } catch(e) {/* Can ignore parse errors for non-JSON responses */}
            }
            
            const weight = url.match(/listing_ids/g)?.length || (url.includes('/i/listings/search') ? 24 : 0); // Search requests have an implicit weight

            const record = {
                timestamp: now,
                url: url,
                status: finalStatus,
                weight: weight,
                interval: interval,
                density: density,
                cumulativeWeight: null // This will be calculated and added only for 429 events
            };

            NetworkRecorder.log.push(record);
            if (NetworkRecorder.log.length > NetworkRecorder.MAX_RECORDS) {
                NetworkRecorder.log.shift();
            }
            localStorage.setItem(NetworkRecorder.DB_KEY, JSON.stringify(NetworkRecorder.log));
            
            document.dispatchEvent(new CustomEvent('fab-network-update'));

            if (finalStatus === 429) {
                // Trigger cooldown ONLY if not already in cooldown, to prevent multiple triggers.
                if (!State.isCoolingDown) {
                    TaskRunner.initiateCooldownSequence();
                }

                const sixtySecondWindow = now - 60000;
                const recentRequests = NetworkRecorder.log.filter(r => r.timestamp > sixtySecondWindow);
                const cumulativeWeight = recentRequests.reduce((sum, r) => sum + r.weight, 0);
                record.cumulativeWeight = cumulativeWeight; // Add it to the record for UI display

                Utils.logger('error', `
                    ==================== [429 Flight Data Recorder] ====================
                    [事件]: 服务器速率限制 (Too Many Requests)
                    [URL]: ${url}
                    [请求权重]: ${record.weight} 个ID
                    [距上次请求间隔]: ${interval ? interval + ' ms' : 'N/A'}
                    [10秒内请求密度]: ${density} 次
                    [60秒内累计ID查询数]: ${cumulativeWeight}
                    ====================================================================
                `);

                if (isSoft429) {
                    Utils.logger('error', `[NetworkRecorder] Detected "Too many requests" in SEARCH API response.`);
                }
                 if (State.isReconning) {
                    Utils.logger('warn', 'Stopping Recon due to API rate limit error.');
                    TaskRunner.toggleRecon();
                }
            }
        }
    };

    const NetworkAnalyzer = {
        peakRps: 0,
        updateUI: () => {
            if (!State.UI.rpsDisplay) return; // 如果UI还没创建，则不执行

            const now = Date.now();
            const lastSecondLog = NetworkRecorder.log.filter(r => now - r.timestamp <= 1000);
            const rps = lastSecondLog.length;

            if (rps > NetworkAnalyzer.peakRps) {
                NetworkAnalyzer.peakRps = rps;
                // NEW: Persist the new peak RPS
                GM_setValue(Config.DB_KEYS.PEAK_RPS, NetworkAnalyzer.peakRps);
            }

            State.UI.rpsDisplay.querySelector('span').textContent = rps;
            State.UI.peakRpsDisplay.querySelector('span').textContent = NetworkAnalyzer.peakRps;

            // NEW: Calculate and display cumulative weight
            const sixtySecondWindow = now - 60000;
            const recentRequests = NetworkRecorder.log.filter(r => r.timestamp > sixtySecondWindow);
            const cumulativeWeight = recentRequests.reduce((sum, r) => sum + r.weight, 0);
            if (State.UI.cumulativeWeightDisplay) {
                State.UI.cumulativeWeightDisplay.querySelector('span').textContent = cumulativeWeight;
            }

            const lastThree429s = [...NetworkRecorder.log].reverse().filter(r => r.status === 429).slice(0, 3);
            if (lastThree429s.length > 0) {
                let listHtml = '<b>最近429事件:</b><ul style="margin: 4px 0 0 16px; padding: 0; list-style-type: square;">';
                lastThree429s.forEach(event => {
                    const eventTime = new Date(event.timestamp).toLocaleTimeString();
                    listHtml += `<li style="margin-bottom: 4px;">${eventTime} (累计ID: ${event.cumulativeWeight || 'N/A'}, 密度: ${event.density})</li>`;
                });
                listHtml += '</ul>';
                State.UI.last429Display.innerHTML = listHtml;
            } else {
                 State.UI.last429Display.innerHTML = '<b>最近429事件:</b><br>尚无记录';
            }
        },
        init: async () => {
            // NEW: Load persistent peak RPS value on initialization
            NetworkAnalyzer.peakRps = await GM_getValue(Config.DB_KEYS.PEAK_RPS, 0);

            // 监听自定义事件，实时更新UI
            document.addEventListener('fab-network-update', NetworkAnalyzer.updateUI);
            // 也设置一个定时器，作为"心跳"来保证UI的持续刷新。
            if (State.networkAnalyzerTimer) clearInterval(State.networkAnalyzerTimer);
            State.networkAnalyzerTimer = setInterval(NetworkAnalyzer.updateUI, 1000);
            
            // Initial load: Force UI to update with data loaded from persistence
            NetworkAnalyzer.updateUI();
        }
    };

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
        }
    };

})(); 