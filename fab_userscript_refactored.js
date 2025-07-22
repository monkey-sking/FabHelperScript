// ==UserScript==
// @name         Fab API-Driven Helper
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Automate tasks on Fab.com based on API responses, with enhanced UI and controls.
// @author       Your Name
// @match        https://www.fab.com/*
// @run-at       document-start
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
// @downloadURL https://update.greasyfork.org/scripts/541307/Fab%20API-Driven%20Helper.user.js
// @updateURL https://update.greasyfork.org/scripts/541307/Fab%20API-Driven%20Helper.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // --- 模块一: 配置与常量 (Config & Constants) ---
    const Config = {
        SCRIPT_NAME: 'Fab API-Driven Helper',
        DB_VERSION: 3,
        DB_NAME: 'fab_helper_db',
        MAX_WORKERS: 5, // Maximum number of concurrent worker tabs
        MAX_CONCURRENT_WORKERS: 7, // 最大并发工作标签页数量
        UI_CONTAINER_ID: 'fab-helper-container',
        UI_LOG_ID: 'fab-helper-log',
        DB_KEYS: {
            DONE: 'fab_done_v8',
            FAILED: 'fab_failed_v8',
            HIDE: 'fab_hide_v8',
            AUTO_ADD: 'fab_autoAdd_v8', // Key for the new setting
            REMEMBER_POS: 'fab_rememberPos_v8',
            LAST_CURSOR: 'fab_lastCursor_v8', // Store only the cursor string
            WORKER_DONE: 'fab_worker_done_v8', // This is the ONLY key workers use to report back.
            APP_STATUS: 'fab_app_status_v1', // For tracking 429 rate limiting
            STATUS_HISTORY: 'fab_status_history_v1', // For persisting the history log
            AUTO_RESUME: 'fab_auto_resume_v1', // For the new auto-recovery feature
            // All other keys are either session-based or for main-tab persistence.
        },
        SELECTORS: {
            card: 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root',
            cardLink: 'a[href*="/listings/"]',
            addButton: 'button[aria-label*="Add to"], button[aria-label*="添加至"], button[aria-label*="cart"]',
            rootElement: '#root',
            successBanner: 'div[class*="Toast-root"]',
            freeStatus: '.csZFzinF',
            ownedStatus: '.cUUvxo_s'
        },
        TEXTS: {
            en: { hide: 'Hide Done', show: 'Show Done', sync: 'Sync State', execute: 'Start Tasks', executing: 'Executing...', stopExecute: 'Stop', added: 'Done', failed: 'Failed', todo: 'To-Do', hidden: 'Hidden', clearLog: 'Clear Log', copyLog: 'Copy Log', copied: 'Copied!', log_init: 'Assistant is online!', log_db_loaded: 'Reading archive...', log_exec_no_tasks: 'To-Do list is empty.', log_verify_success: 'Verified and added to library!', log_verify_fail: "Couldn't add. Will retry later.", log_429_error: 'Request limit hit! Taking a 15s break...', goto_page_label: 'Page:', goto_page_btn: 'Go', tab_dashboard: 'Dashboard', tab_settings: 'Settings', tab_debug: 'Debug' },
            zh: { hide: '隐藏已得', show: '显示已得', sync: '同步状态', execute: '一键开刷', executing: '执行中...', stopExecute: '停止', added: '已入库', failed: '失败', todo: '待办', hidden: '已隐藏', clearLog: '清空日志', copyLog: '复制日志', copied: '已复制!', log_init: '助手已上线！', log_db_loaded: '正在读取存档...', log_exec_no_tasks: '"待办"清单是空的。', log_verify_success: '搞定！已成功入库。', log_verify_fail: '哎呀，这个没加上。稍后会自动重试！', log_429_error: '请求太快被服务器限速了！休息15秒后自动重试...', goto_page_label: '页码:', goto_page_btn: '跳转', tab_dashboard: '仪表盘', tab_settings: '设定', tab_debug: '调试' }
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
        hideSaved: false,
        autoAddOnScroll: false, // New state for the setting
        rememberScrollPosition: false, // New state for scroll position
        isTogglingSetting: false, // Debounce flag for settings toggles
        savedCursor: null, // Holds the loaded cursor for hijacking
        // --- NEW: State for 429 monitoring ---
        appStatus: 'NORMAL', // 'NORMAL' or 'RATE_LIMITED'
        rateLimitStartTime: null,
        normalStartTime: Date.now(),
        successfulSearchCount: 0,
        statusHistory: [], // Holds the history of NORMAL/RATE_LIMITED periods
        autoResumeAfter429: false, // The new setting for the feature
        // --- End New State ---
        showAdvanced: false,
        activeWorkers: 0,
        runningWorkers: {}, // NEW: To track active workers for the watchdog { workerId: { task, startTime } }
        lastKnownHref: null, // To detect SPA navigation
        hiddenThisPageCount: 0,
        totalTasks: 0, // Used for Recon
        completedTasks: 0, // Used for Recon
        executionTotalTasks: 0, // For execution progress
        executionCompletedTasks: 0, // For execution progress
        executionFailedTasks: 0, // For execution progress
        watchdogTimer: null,
        // UI-related state
        UI: {
            container: null,
            logPanel: null,
            tabs: {}, // For tab buttons
            tabContents: {}, // For tab content panels
            progressContainer: null,
            progressText: null,
            progressBarFill: null,
            progressBar: null,
            statusTodo: null,
            statusDone: null,
            statusFailed: null,
            statusHidden: null,
            execBtn: null,
            hideBtn: null,
            syncBtn: null,
            statusVisible: null,
            debugContent: null,
        },
        valueChangeListeners: [],
        sessionCompleted: new Set(), // Phase15: URLs completed this session
        isLogCollapsed: localStorage.getItem('fab_helper_log_collapsed') === 'true' || false, // 日志面板折叠状态
        hasRunDomPart: false,
        observerDebounceTimer: null,
        isObserverRunning: false, // New flag for the robust launcher
        lastKnownCardCount: 0,
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
        }
    };

    // --- DOM Creation Helpers (moved outside for broader scope) ---
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

    // --- 模块四: 异步网络请求 (Promisified GM_xmlhttpRequest) ---
    const API = {
        gmFetch: (options) => {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    anonymous: false, // Default to false to ensure cookies are sent
                    ...options,
                    onload: (response) => resolve(response),
                    onerror: (error) => reject(new Error(`GM_xmlhttpRequest error: ${error.statusText || 'Unknown Error'}`)),
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
            State.autoAddOnScroll = await GM_getValue(Config.DB_KEYS.AUTO_ADD, false); // Load the setting
            State.rememberScrollPosition = await GM_getValue(Config.DB_KEYS.REMEMBER_POS, false);
            State.autoResumeAfter429 = await GM_getValue(Config.DB_KEYS.AUTO_RESUME, false);

            const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
            if (persistedStatus && persistedStatus.status === 'RATE_LIMITED') {
                State.appStatus = 'RATE_LIMITED';
                State.rateLimitStartTime = persistedStatus.startTime;
                const previousDuration = ((Date.now() - persistedStatus.startTime) / 1000).toFixed(2);
                Utils.logger('warn', `Script starting in RATE_LIMITED state. 429 period has lasted at least ${previousDuration}s.`);
            }
            State.statusHistory = await GM_getValue(Config.DB_KEYS.STATUS_HISTORY, []);

            Utils.logger('info', Utils.getText('log_db_loaded'), `(Session) To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
        },
        // saveTodo is no longer needed as the todo list is not persisted across sessions.
        saveDone: () => GM_setValue(Config.DB_KEYS.DONE, State.db.done),
        saveFailed: () => GM_setValue(Config.DB_KEYS.FAILED, State.db.failed),
        saveHidePref: () => GM_setValue(Config.DB_KEYS.HIDE, State.hideSaved),
        saveAutoAddPref: () => GM_setValue(Config.DB_KEYS.AUTO_ADD, State.autoAddOnScroll), // Save the setting
        saveRememberPosPref: () => GM_setValue(Config.DB_KEYS.REMEMBER_POS, State.rememberScrollPosition),
        saveAutoResumePref: () => GM_setValue(Config.DB_KEYS.AUTO_RESUME, State.autoResumeAfter429),

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
        isFailed: (url) => {
            if (!url) return false;
            const cleanUrl = url.split('?')[0];
            return State.db.failed.some(task => task.url === cleanUrl);
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
            // 此模块的功能已完全被 MonkeyPatcher 取代，以确保在 document-start 时能立即生效。
            Utils.logger('info', '网络过滤器(NetworkFilter)模块已弃用，功能由补丁程序(PagePatcher)处理。');
        }
    };

    const PagePatcher = {
        _patchHasBeenApplied: false,
        _lastSeenCursor: null,
        // REMOVED: This state variable was the source of the bug.
        // _secondToLastSeenCursor: null,

        // --- NEW: State for request debouncing ---
        _debounceXhrTimer: null,
        _pendingXhr: null,

        async init() {
            try {
                // NEW: Use the unified Config key
                const cursor = await GM_getValue(Config.DB_KEYS.LAST_CURSOR, null);

                if (cursor) {
                    State.savedCursor = cursor;
                    this._lastSeenCursor = cursor;
                    // NEW: More descriptive log
                    Utils.logger('info', `[Cursor] Initialized. Loaded saved cursor: ${cursor.substring(0, 30)}...`);
                        } else {
                    Utils.logger('info', `[Cursor] Initialized. No saved cursor found.`);
                    }
            } catch (e) {
                 Utils.logger('warn', '[Cursor] Failed to restore cursor state:', e);
            }
            this.applyPatches();
            Utils.logger('info', '[Cursor] Network interceptors applied.');
        },

        async handleSearchResponse(request) {
            if (request.status === 429) {
                // 使用通用的handleRateLimit函数处理限速情况
                await this.handleRateLimit(request._url);
            } else if (request.status >= 200 && request.status < 300) {
                if (State.appStatus === 'RATE_LIMITED') {
                    const rateLimitDuration = ((Date.now() - State.rateLimitStartTime) / 1000).toFixed(2);
                    const logEntry = {
                        type: 'RATE_LIMITED',
                        duration: parseFloat(rateLimitDuration),
                        endTime: new Date().toISOString()
                    };
                    State.statusHistory.push(logEntry);
                    await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
                    UI.updateDebugTab();

                    Utils.logger('info', `✅ Rate limit appears to be lifted. The 429 period lasted ${rateLimitDuration}s.`);

                    State.appStatus = 'NORMAL';
                    State.rateLimitStartTime = null;
                    State.normalStartTime = Date.now();
                    State.successfulSearchCount = 0;
                    GM_deleteValue(Config.DB_KEYS.APP_STATUS);
                }
                
                // 移除这里的计数逻辑，因为我们已经在listenerAwareSend中处理了
                // if (State.appStatus === 'NORMAL') {
                //     State.successfulSearchCount++;
                // }
            }
        },

        isDebounceableSearch(url) {
            return typeof url === 'string' && url.includes('/i/listings/search') && !url.includes('aggregate_on=') && !url.includes('count=0');
        },

        shouldPatchUrl(url) {
            if (typeof url !== 'string') return false;
            if (this._patchHasBeenApplied) return false;
            if (!State.rememberScrollPosition || !State.savedCursor) return false;
            if (!url.includes('/i/listings/search')) return false;
            if (url.includes('aggregate_on=') || url.includes('count=0') || url.includes('in=wishlist')) return false;
            Utils.logger('info', `[PagePatcher] -> ✅ MATCH! URL will be patched: ${url}`);
            return true;
        },

        getPatchedUrl(originalUrl) {
            if (State.savedCursor) {
                const urlObj = new URL(originalUrl, window.location.origin);
                urlObj.searchParams.set('cursor', State.savedCursor);
                const modifiedUrl = urlObj.pathname + urlObj.search;
                // NEW: Logging for injection
                Utils.logger('info', `[Cursor] Injecting cursor. Original: ${originalUrl}`);
                Utils.logger('info', `[Cursor] Patched URL: ${modifiedUrl}`);
                this._patchHasBeenApplied = true; // This should be set here
                return modifiedUrl;
            }
                    return originalUrl;
        },

        saveLatestCursorFromUrl(url) {
            // REWRITTEN: A simpler, more robust implementation.
            try {
                if (typeof url !== 'string' || !url.includes('/i/listings/search') || !url.includes('cursor=')) return;
                const urlObj = new URL(url, window.location.origin);
                const newCursor = urlObj.searchParams.get('cursor');

                // If we have a new, valid cursor that's different from the last one we processed...
                if (newCursor && newCursor !== this._lastSeenCursor) {
                    this._lastSeenCursor = newCursor;
                    State.savedCursor = newCursor; // Update state immediately

                    // Persist the new cursor for the next page load.
                    GM_setValue(Config.DB_KEYS.LAST_CURSOR, newCursor);
                    
                    // NEW: Logging for saving
                    Utils.logger('info', `[Cursor] New restore point saved: ${newCursor.substring(0, 30)}...`);
                }
            } catch (e) {
                Utils.logger('warn', `[Cursor] Error while saving cursor:`, e);
            }
        },

        applyPatches() {
            const self = this;
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            const originalXhrSend = XMLHttpRequest.prototype.send;
            const DEBOUNCE_DELAY_MS = 350; // Centralize debounce delay

            const listenerAwareSend = function(...args) {
                const request = this;
                // 为所有请求添加监听器
                const onLoad = () => {
                    request.removeEventListener("load", onLoad);
                    
                    // 对所有请求检查429错误
                    if (request.status === 429 || request.status === '429' || request.status.toString() === '429') {
                        Utils.logger('warn', `[XHR] 检测到429状态码: ${request.responseURL || request._url}`);
                        // 调用handleRateLimit函数处理限速情况
                        self.handleRateLimit(request.responseURL || request._url);
                        return;
                    }
                    
                                    // 检查其他可能的限速情况（返回空结果或错误信息）
                if (request.status >= 200 && request.status < 300) {
                    try {
                        const responseText = request.responseText;
                        if (responseText) {
                            // 先检查原始文本是否包含限速相关的关键词
                            if (responseText.includes("Too many requests") || 
                                responseText.includes("rate limit") ||
                                responseText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                                Utils.logger('warn', `[XHR限速检测] 检测到限速情况，原始响应: ${responseText}`);
                                self.handleRateLimit(request.responseURL || request._url);
                                return;
                            }
                            
                            // 尝试解析JSON
                            try {
                                const data = JSON.parse(responseText);
                                
                                // 检查是否返回了空结果或错误信息
                                if ((data.results && data.results.length === 0 && self.isDebounceableSearch(request._url)) || 
                                    (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit")))) {
                                    Utils.logger('warn', `[隐性限速检测] 检测到可能的限速情况: ${JSON.stringify(data)}`);
                                    self.handleRateLimit(request.responseURL || request._url);
                                    return;
                                }
                            } catch (jsonError) {
                                // JSON解析错误，忽略
                            }
                        }
                    } catch (e) {
                        // 解析错误，忽略
                    }
                }
                    
                    // 处理搜索请求的特殊逻辑（429检测等）
                    if (self.isDebounceableSearch(request._url)) {
                        self.handleSearchResponse(request);
                        
                        // 只对商品卡片的搜索请求进行计数
                        if (request.status >= 200 && request.status < 300 && State.appStatus === 'NORMAL') {
                            State.successfulSearchCount++;
                            // 每次相关请求都更新调试标签页
                            UI.updateDebugTab();
                            Utils.logger('info', `[请求统计] 商品卡片搜索请求 +1，当前总数: ${State.successfulSearchCount}`);
                            
                            // 如果历史记录为空，添加一个新的会话记录
                            if (State.statusHistory.length === 0) {
                                const newSessionEntry = {
                                    type: 'STARTUP',
                                    duration: 0,
                                    endTime: new Date().toISOString(),
                                    message: '新会话开始'
                                };
                                State.statusHistory.push(newSessionEntry);
                                GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
                                UI.updateDebugTab();
                            }
                        }
                    }
                };
                request.addEventListener("load", onLoad);
                
                return originalXhrSend.apply(request, args);
            };
            
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                let modifiedUrl = url;
                // Priority 1: Handle the "remember position" patch, which should not be debounced.
                if (self.shouldPatchUrl(url)) {
                    modifiedUrl = self.getPatchedUrl(url);
                    this._isDebouncedSearch = false; // Explicitly mark it as NOT debounced
                }
                // Priority 2: Tag all other infinite scroll requests to be debounced.
                else if (self.isDebounceableSearch(url)) {
                    self.saveLatestCursorFromUrl(url); // FIX: Ensure we save the cursor before debouncing.
                    this._isDebouncedSearch = true;
                }
                // Priority 3: All other requests just save the cursor.
                else {
                    self.saveLatestCursorFromUrl(url);
                }
                this._url = modifiedUrl;
                // We still call the original open, but the send will be intercepted.
                return originalXhrOpen.apply(this, [method, modifiedUrl, ...args]);
            };

            XMLHttpRequest.prototype.send = function(...args) {
                // If this is not a request we need to debounce, send it immediately.
                if (!this._isDebouncedSearch) {
                    // Still use the wrapper to catch responses for non-debounced search requests
                    return listenerAwareSend.apply(this, args);
                }

                // NEW: Use [Debounce] tag for clarity
                Utils.logger('info', `[Debounce] 🚦 Intercepted scroll request. Applying ${DEBOUNCE_DELAY_MS}ms delay...`);

                // If there's a previously pending request, abort it.
                if (self._pendingXhr) {
                    self._pendingXhr.abort();
                    Utils.logger('info', `[Debounce] 🗑️ Discarded previous pending request.`);
                }
                // Clear any existing timer.
                clearTimeout(self._debounceXhrTimer);

                // Store the current request as the latest one.
                self._pendingXhr = this;

                // Set a timer to send the latest request after a period of inactivity.
                self._debounceXhrTimer = setTimeout(() => {
                    Utils.logger('info', `[Debounce] ▶️ Sending latest scroll request: ${this._url}`);
                    listenerAwareSend.apply(self._pendingXhr, args);
                    self._pendingXhr = null; // Clear after sending
                }, DEBOUNCE_DELAY_MS);
            };

            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
                let url = (typeof input === 'string') ? input : input.url;
                let modifiedInput = input;
                if (self.shouldPatchUrl(url)) {
                    const modifiedUrl = self.getPatchedUrl(url);
                        if (typeof input === 'string') {
                            modifiedInput = modifiedUrl;
                        } else {
                            modifiedInput = new Request(modifiedUrl, input);
                        }
                    } else {
                    self.saveLatestCursorFromUrl(url);
                }
                
                // 拦截响应以检测429错误
                return originalFetch.apply(this, [modifiedInput, init])
                    .then(async response => {
                        // 检查429错误
                        if (response.status === 429 || response.status === '429' || response.status.toString() === '429') {
                            // 克隆响应以避免"已消费"错误
                            const clonedResponse = response.clone();
                            Utils.logger('warn', `[Fetch] 检测到429状态码: ${response.url}`);
                            // 异步处理限速情况
                            self.handleRateLimit(response.url).catch(e => 
                                Utils.logger('error', '处理限速时出错:', e)
                            );
                        }
                        
                        // 检查其他可能的限速情况（返回空结果或错误信息）
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                // 克隆响应以避免"已消费"错误
                                const clonedResponse = response.clone();
                                
                                // 先检查原始文本
                                const text = await clonedResponse.text();
                                if (text.includes("Too many requests") || 
                                    text.includes("rate limit") ||
                                    text.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                                    Utils.logger('warn', `[Fetch限速检测] 检测到限速情况，原始响应: ${text.substring(0, 100)}...`);
                                    self.handleRateLimit(response.url).catch(e => 
                                        Utils.logger('error', '处理限速时出错:', e)
                                    );
                                    return response;
                                }
                                
                                // 尝试解析JSON
                                try {
                                    const data = JSON.parse(text);
                                    
                                    // 检查是否返回了空结果或错误信息
                                    if ((data.results && data.results.length === 0 && 
                                         typeof url === 'string' && url.includes('/i/listings/search')) || 
                                        (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit")))) {
                                        Utils.logger('warn', `[隐性限速检测] Fetch请求检测到可能的限速情况: ${JSON.stringify(data)}`);
                                        self.handleRateLimit(response.url).catch(e => 
                                            Utils.logger('error', '处理限速时出错:', e)
                                        );
                                    }
                                } catch (jsonError) {
                                    // JSON解析错误，忽略
                                }
                            } catch (e) {
                                // 解析错误，忽略
                            }
                        }
                        
                        return response;
                });
            };
        }
    };


    // --- 模块七: 任务运行器与事件处理 (Task Runner & Event Handlers) ---
    const TaskRunner = {
        isCardFinished: (card) => {
            const link = card.querySelector(Config.SELECTORS.cardLink);
            // If there's no link, we can't get a URL to check against the DB.
            // In this case, rely only on visual cues.
            const url = link ? link.href.split('?')[0] : null;

            // Priority 1: Check for the specific 'owned' status element. This is the most reliable.
            if (card.querySelector(Config.SELECTORS.ownedStatus) !== null) return true;

            // Priority 2: Check our databases and session state if we have a URL.
            if (url) {
                if (Database.isDone(url)) return true;
                if (Database.isFailed(url)) return true; // A failed item is also considered "finished" for skipping/hiding purposes.
                if (State.sessionCompleted.has(url)) return true;
            }

            // Priority 3 (Fallback): Check for broad text content. Less reliable but catches edge cases.
            const text = card.textContent || '';
            if ([...Config.SAVED_TEXT_SET].some(s => text.includes(s))) return true;

            return false;
        },
        // --- Toggles ---
        // This is the new main execution function, triggered by the "一键开刷" button.
        toggleExecution: () => {
            if (State.isExecuting) {
                // If it's running, stop it.
                State.isExecuting = false;
                State.runningWorkers = {};
                State.activeWorkers = 0;
                State.executionTotalTasks = 0;
                State.executionCompletedTasks = 0;
                State.executionFailedTasks = 0;
                Utils.logger('info', '执行已由用户手动停止。');
                UI.update();
                return;
            }

            // NEW: Divert logic if auto-add is on. The observer populates the list,
            // so the button should just act as a "start" signal.
            if (State.autoAddOnScroll) {
                Utils.logger('info', '"自动添加"已开启。将直接处理当前"待办"队列中的所有任务。');
                TaskRunner.startExecution(); // This will use the existing todo list
                return;
            }


            // --- BEHAVIOR CHANGE: From Accumulate to Overwrite Mode ---
            // As per user request for waterfall pages, clear the existing To-Do list before every scan.
            // This part now only runs when auto-add is OFF.
            State.db.todo = [];
            Utils.logger('info', '待办列表已清空。现在将扫描并仅添加当前可见的项目。');

            Utils.logger('info', '正在扫描已加载完成的商品...');
                const cards = document.querySelectorAll(Config.SELECTORS.card);
                const newlyAddedList = [];
                let alreadyInQueueCount = 0;
                let ownedCount = 0;
            let skippedCount = 0;

            const isCardSettled = (card) => {
                return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
            };

                cards.forEach(card => {
                // 正确的修复：直接检查元素的 display 样式。如果它是 'none'，就意味着它被隐藏了，应该跳过。
                if (card.style.display === 'none') {
                    return;
                }

                if (!isCardSettled(card)) {
                    skippedCount++;
                    return; // Skip unsettled cards
                }

                // UNIFIED LOGIC: Use the new single source of truth to check if the card is finished.
                if (TaskRunner.isCardFinished(card)) {
                        ownedCount++;
                        return;
                    }

                const link = card.querySelector(Config.SELECTORS.cardLink);
                const url = link ? link.href.split('?')[0] : null;
                if (!url) return; // Should be caught by isCardFinished, but good for safety.

                // The only check unique to adding is whether it's already in the 'todo' queue.
                    const isTodo = Database.isTodo(url);
                if (isTodo) {
                        alreadyInQueueCount++;
                        return;
                    }

                    const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || 'Untitled';
                    newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
                });

            if (skippedCount > 0) {
                Utils.logger('info', `已跳过 ${skippedCount} 个状态未加载的商品。`);
            }

                if (newlyAddedList.length > 0) {
                    State.db.todo.push(...newlyAddedList);
                    Utils.logger('info', `已将 ${newlyAddedList.length} 个新商品加入待办队列。`);
                }

                const actionableCount = State.db.todo.length;
                if (actionableCount > 0) {
                    if (newlyAddedList.length === 0 && alreadyInQueueCount > 0) {
                         Utils.logger('info', `本页的 ${alreadyInQueueCount} 个可领取商品已全部在待办或失败队列中。`);
                }
                    TaskRunner.startExecution();
            } else {
                 Utils.logger('info', `本页没有可领取的新商品 (已拥有: ${ownedCount} 个, 已跳过: ${skippedCount} 个)。`);
            }
            UI.update();
        },

        // This function starts the execution loop without scanning.
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
                Utils.logger('info', Utils.getText('log_exec_no_tasks'));
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

        // This function is for the main UI button to toggle start/stop.
        // OBSOLETE - merged into toggleExecution
        /*
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
        */
        toggleHideSaved: async () => {
            State.hideSaved = !State.hideSaved;
            await Database.saveHidePref();
            TaskRunner.runHideOrShow();
        },

        toggleAutoAdd: async () => {
            if (State.isTogglingSetting) return;
            State.isTogglingSetting = true;

            State.autoAddOnScroll = !State.autoAddOnScroll;
            await Database.saveAutoAddPref();
            Utils.logger('info', `无限滚动自动添加任务已 ${State.autoAddOnScroll ? '开启' : '关闭'}.`);
            // No need to call UI.update() as the visual state is handled by the component itself.

            setTimeout(() => { State.isTogglingSetting = false; }, 200);
        },

        toggleAutoResume: async () => {
            if (State.isTogglingSetting) return;
            State.isTogglingSetting = true;

            State.autoResumeAfter429 = !State.autoResumeAfter429;
            await Database.saveAutoResumePref();
            Utils.logger('info', `429后自动恢复功能已 ${State.autoResumeAfter429 ? '开启' : '关闭'}.`);

            setTimeout(() => { State.isTogglingSetting = false; }, 200);
        },

        toggleRememberPosition: async () => {
            if (State.isTogglingSetting) return;
            State.isTogglingSetting = true;

            State.rememberScrollPosition = !State.rememberScrollPosition;
            await Database.saveRememberPosPref();
            Utils.logger('info', `记住瀑布流浏览位置功能已 ${State.rememberScrollPosition ? '开启' : '关闭'}.`);

            if (!State.rememberScrollPosition) {
                await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
                Utils.logger('info', '已清除已保存的浏览位置。');
            }
            setTimeout(() => { State.isTogglingSetting = false; }, 200);
        },

        runRecoveryProbe: async () => {
            const randomDelay = Math.floor(Math.random() * (30000 - 15000 + 1) + 15000); // 15-30 seconds
            Utils.logger('info', `[Auto-Recovery] In recovery mode. Probing connection in ${(randomDelay / 1000).toFixed(1)} seconds...`);

            setTimeout(async () => {
                Utils.logger('info', `[Auto-Recovery] Probing connection...`);
                try {
                    const csrfToken = Utils.getCookie('fab_csrftoken');
                    if (!csrfToken) throw new Error("CSRF token not found for probe.");
                    // Use a lightweight, known-good endpoint for the probe
                    const probeResponse = await API.gmFetch({
                        method: 'GET',
                        url: 'https://www.fab.com/i/users/context',
                        headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                    });

                    if (probeResponse.status === 429) {
                        throw new Error("Probe failed with 429. Still rate-limited.");
                    } else if (probeResponse.status >= 200 && probeResponse.status < 300) {
                        // SUCCESS!
                        // Manually create a fake request object to reuse the recovery logic in handleSearchResponse
                        await PagePatcher.handleSearchResponse({ status: 200 });
                        Utils.logger('info', `[Auto-Recovery] ✅ Connection restored! Auto-resuming operations...`);
                        TaskRunner.toggleExecution(); // Auto-start the process!
                    } else {
                        throw new Error(`Probe failed with unexpected status: ${probeResponse.status}`);
                    }
                } catch (e) {
                    Utils.logger('error', `[Auto-Recovery] ❌ ${e.message}. Scheduling next refresh...`);
                    setTimeout(() => location.reload(), 2000); // Wait 2s before next refresh
                }
            }, randomDelay);
        },

        resetReconProgress: async () => {
            if (State.isReconquening) {
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
            const API_ENDPOINT = 'https://www.fab.com/i/users/me/listings-states';
            const API_CHUNK_SIZE = 24; // Server-side limit

            const isElementInViewport = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
            };

            try {
                const csrfToken = Utils.getCookie('fab_csrftoken');
                if (!csrfToken) throw new Error('CSRF token not found. Are you logged in?');

                // Step 1: Gather all unique UIDs to check
                const uidsFromVisibleCards = new Set([...document.querySelectorAll(Config.SELECTORS.card)]
                    .filter(isElementInViewport)
                    .map(card => card.querySelector(Config.SELECTORS.cardLink)?.href.match(/listings\/([a-f0-9-]+)/)?.[1])
                    .filter(Boolean));

                const uidsFromFailedList = new Set(State.db.failed.map(task => task.uid));
                const allUidsToCheck = Array.from(new Set([...uidsFromVisibleCards, ...uidsFromFailedList]));

                if (allUidsToCheck.length === 0) {
                    Utils.logger('info', '[Fab DOM Refresh] 没有可见或失败的项目需要检查。');
                    return;
                }
                Utils.logger('info', `[Fab DOM Refresh] 正在分批检查 ${allUidsToCheck.length} 个项目（可见+失败）的状态...`);

                // Step 2: Process UIDs in chunks
                const ownedUids = new Set();
                for (let i = 0; i < allUidsToCheck.length; i += API_CHUNK_SIZE) {
                    const chunk = allUidsToCheck.slice(i, i + API_CHUNK_SIZE);
                const apiUrl = new URL(API_ENDPOINT);
                    chunk.forEach(uid => apiUrl.searchParams.append('listing_ids', uid));

                    Utils.logger('info', `[Fab DOM Refresh] 正在处理批次 ${Math.floor(i / API_CHUNK_SIZE) + 1}... (${chunk.length}个项目)`);

                const response = await fetch(apiUrl.href, {
                    headers: { 'accept': 'application/json, text/plain, */*', 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                });

                    if (!response.ok) {
                         Utils.logger('warn', `批次处理失败，状态码: ${response.status}。将跳过此批次。`);
                         continue; // Skip to next chunk
                    }

                const data = await response.json();
                    data.filter(item => item.acquired).forEach(item => ownedUids.add(item.uid));

                    // Add a small delay between chunks to be safe
                    if (allUidsToCheck.length > i + API_CHUNK_SIZE) {
                       await new Promise(r => setTimeout(r, 250));
                    }
                }

                Utils.logger('info', `[Fab DOM Refresh] API查询完成，共确认 ${ownedUids.size} 个已拥有的项目。`);

                // Step 3: Update database based on all results
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
                        Utils.logger('info', `[Fab DB Sync] 从"失败"列表中清除了 ${initialFailedCount - State.db.failed.length} 个已手动完成的商品。`);
                    }
                }

                // Step 4: Update UI for visible cards
                const uidToCardMap = new Map([...document.querySelectorAll(Config.SELECTORS.card)]
                     .filter(isElementInViewport)
                     .map(card => {
                         const uid = card.querySelector(Config.SELECTORS.cardLink)?.href.match(/listings\/([a-f0-9-]+)/)?.[1];
                         return uid ? [uid, card] : null;
                     }).filter(Boolean));

                let updatedCount = 0;
                uidToCardMap.forEach((card, uid) => {
                    const isOwned = ownedUids.has(uid);

                    if (isOwned) {
                        const freeElement = card.querySelector(Config.SELECTORS.freeStatus);
                        if (freeElement) {
                            freeElement.replaceWith(createOwnedElement());
                            updatedCount++;
                        }
                    } else {
                        const ownedElement = card.querySelector(Config.SELECTORS.ownedStatus);
                        if (ownedElement) {
                            ownedElement.replaceWith(createFreeElement());
                            updatedCount++;
                        }
                    }
                });

                if (dbUpdated) {
                    await Database.saveFailed();
                    await Database.saveDone();
                }

                Utils.logger('info', `[Fab DOM Refresh] Complete. Updated ${updatedCount} visible card states.`);

                TaskRunner.runHideOrShow();

            } catch (e) {
                Utils.logger('error', '[Fab DOM Refresh] An error occurred:', e);
                alert('API 刷新失败。请检查控制台中的错误信息，并确认您已登录。');
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
                const statesUrl = new URL('https://www.fab.com/i/users/me/listings-states');
                candidates.forEach(item => statesUrl.searchParams.append('listing_ids', item.uid));
                const statesResponse = await API.gmFetch({ method: 'GET', url: statesUrl.href, headers: apiHeaders });
                const statesData = JSON.parse(statesResponse.responseText);

                // API returns an array, convert it to a Set for efficient lookup.
                const ownedUids = new Set(statesData.filter(s => s.acquired).map(s => s.uid));

                const notOwnedItems = [];
                candidates.forEach(item => {
                    if (!ownedUids.has(item.uid)) {
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

            State.watchdogTimer = setInterval(async () => {
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

                        // The watchdog now follows the same logic as the WORKER_DONE listener for failures.
                        const task = workerInfo.task;

                        // 1. Remove from To-Do
                        State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);

                        // 2. Add to Failed
                        if (!State.db.failed.some(f => f.uid === task.uid)) {
                            State.db.failed.push(task);
                            await Database.saveFailed();
                        }
                        State.executionFailedTasks++;

                        // 3. Clean up worker
                        delete State.runningWorkers[workerId];
                        State.activeWorkers--;

                        Utils.logger('info', `Stalled worker cleaned up. Active: ${State.activeWorkers}. Resuming dispatch...`);

                        // 4. Update UI and dispatch
                        UI.update();
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
                
                // REMOVED: This logic is now handled more reliably in the WORKER_DONE listener.
                UI.update();
                return;
            }

            // 如果处于限速状态，不派发新任务，但保持现有任务继续执行
            if (State.appStatus === 'RATE_LIMITED') {
                Utils.logger('info', '由于处于限速状态，暂停派发新任务。现有任务将继续执行。');
                return;
            }

            // --- DISPATCHER FOR DETAIL TASKS ---
            // New logic: Iterate without modifying the todo list. Dispatch tasks that are not yet "in-flight".
            const inFlightUIDs = new Set(Object.values(State.runningWorkers).map(w => w.task.uid));

            for (const task of State.db.todo) {
                if (State.activeWorkers >= Config.MAX_WORKERS) break;

                // Skip if this task is already in-flight
                if (inFlightUIDs.has(task.uid)) continue;

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
                // The worker's ONLY job is to report back. It does NOT modify the database.
                // All state changes are handled by the main tab's listener for consistency.
                await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                    workerId: workerId,
                    success: success,
                    logs: logBuffer,
                    task: currentTask // Pass the original task back
                });
                await GM_deleteValue(workerId); // Clean up the task payload
                window.close();
            }
        },

        // This function is now fully obsolete.
        advanceDetailTask: async () => {},

        runHideOrShow: () => {
            State.hiddenThisPageCount = 0;
            document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
                // UNIFIED LOGIC: Use the new single source of truth.
                const isFinished = TaskRunner.isCardFinished(card);

                if (State.hideSaved && isFinished) {
                    card.style.display = 'none';
                    State.hiddenThisPageCount++;
                } else {
                    card.style.display = '';
                }
            });
            UI.update();
        },

        scanAndAddTasks: (cards) => {
            // This function should ONLY ever run if auto-add is enabled.
            if (!State.autoAddOnScroll) return;

            // 延迟处理，给卡片状态更新留出时间
            setTimeout(() => {
                const newlyAddedList = [];
            cards.forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const url = link ? link.href.split('?')[0] : null;
                if (!url) return;

                    // 1. Must NOT be already finished (in done list, etc.) or in the current to-do list.
                    const isAlreadyProcessed = TaskRunner.isCardFinished(card) || Database.isTodo(url);
                    if (isAlreadyProcessed) {
                    return;
                }

                    // 2. Must be visibly "Free". This is the most critical filter.
                    const isFree = card.querySelector(Config.SELECTORS.freeStatus) !== null;
                    if (!isFree) {
                    return;
                }

                    // If it passes all checks, it's a valid new task.
                const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || 'Untitled';
                newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
            });

            if (newlyAddedList.length > 0) {
                State.db.todo.push(...newlyAddedList);
                Utils.logger('info', `[自动添加] 新增 ${newlyAddedList.length} 个任务到队列。`);
                    
                    // Do NOT start execution from here. Only update totals if already running.
                if (State.isExecuting) {
                        State.executionTotalTasks = State.db.todo.length;
                    }
                    
                    UI.update();
                }
            }, 1000); // 延迟1秒，给API请求和状态更新留出时间
        },

        async handleRateLimit(url) {
            // 如果已经处于限速状态，不需要重复处理
            if (State.appStatus === 'RATE_LIMITED') return;
            
            // 记录正常运行期的统计信息
            const normalDuration = ((Date.now() - State.normalStartTime) / 1000).toFixed(2);
            const logEntry = {
                type: 'NORMAL',
                duration: parseFloat(normalDuration),
                requests: State.successfulSearchCount,
                endTime: new Date().toISOString()
            };
            
            // 保存到历史记录并更新UI
            State.statusHistory.push(logEntry);
            await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
            
            // 记录日志
            Utils.logger('error', `🚨 RATE LIMIT DETECTED at ${url}! Normal operation lasted ${normalDuration}s with ${State.successfulSearchCount} successful search requests.`);
            
            // 切换到限速状态
            State.appStatus = 'RATE_LIMITED';
            State.rateLimitStartTime = Date.now();
            
            // 保存状态到存储
            await GM_setValue(Config.DB_KEYS.APP_STATUS, { status: 'RATE_LIMITED', startTime: State.rateLimitStartTime });
            
            // 不停止任务执行，但暂停新任务的派发
            Utils.logger('warn', '检测到限速。已暂停新任务派发，但现有任务将继续执行。');
            
            // 更新UI
            UI.updateDebugTab();
            UI.update();
            
            // 自动恢复逻辑
            if (State.autoResumeAfter429) {
                // 开始随机刷新尝试恢复
                Utils.logger('info', '自动恢复已启用。开始随机时间刷新页面尝试恢复...');
                
                // 设置一个递归的随机刷新函数
                const attemptRecovery = () => {
                    // 如果不再处于限速状态，停止刷新
                    if (State.appStatus !== 'RATE_LIMITED') return;
                    
                    // 如果有活动任务，等待它们完成
                    if (State.activeWorkers > 0) {
                        Utils.logger('info', `仍有 ${State.activeWorkers} 个任务在执行中，等待它们完成后再刷新...`);
                        setTimeout(attemptRecovery, 5000); // 5秒后再检查
                        return;
                    }
                    
                    // 生成一个随机延迟（5-15秒）
                    const randomDelay = 5000 + Math.random() * 10000;
                    
                    // 如果还有待办任务，保存它们
                    if (State.db.todo.length > 0) {
                        Utils.logger('info', `保存 ${State.db.todo.length} 个待办任务，刷新后将继续处理...`);
                        GM_setValue('temp_todo_tasks', State.db.todo);
                    }
                    
                    // 使用倒计时刷新
                    countdownRefresh(randomDelay, '自动恢复尝试');
                };
                
                // 开始第一次恢复尝试
                attemptRecovery();
            } else {
                Utils.logger('info', '检测到限速。启用"设定"中的"429后自动恢复并继续"选项可自动处理此情况。');
            }
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
                if (urlParams.has('workerId')) return false; // Explicitly return false for worker

                Utils.logger('info', "On a detail page (detected by action buttons), skipping UI creation.");
                return false; // Explicitly return false to halt further execution
            }

            if (document.getElementById(Config.UI_CONTAINER_ID)) return true; // Already created

            // --- Style Injection ---
            const styles = `
                :root {
                    --bg-color: rgba(28, 28, 30, 0.9);
                    --border-color: rgba(255, 255, 255, 0.15);
                    --text-color-primary: #f5f5f7;
                    --text-color-secondary: #a0a0a5;
                    --radius-l: 12px;
                    --radius-m: 8px;
                    --radius-s: 6px;
                    --blue: #007aff; --pink: #ff2d55; --green: #34c759;
                    --orange: #ff9500; --gray: #8e8e93; --dark-gray: #3a3a3c;
                    --blue-bg: rgba(0, 122, 255, 0.2);
                }
                #${Config.UI_CONTAINER_ID} {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: var(--bg-color);
                    backdrop-filter: blur(15px) saturate(1.8);
                    -webkit-backdrop-filter: blur(15px) saturate(1.8);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-l);
                    color: var(--text-color-primary);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    width: 300px;
                    font-size: 14px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                /* FINAL FIX: Apply a robust box model to all elements within the container */
                #${Config.UI_CONTAINER_ID} *, #${Config.UI_CONTAINER_ID} *::before, #${Config.UI_CONTAINER_ID} *::after {
                    box-sizing: border-box;
                }
                .fab-helper-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--border-color);
                }
                .fab-helper-tabs button {
                    flex: 1;
                    padding: 10px 0;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    background: transparent;
                    border: none;
                    color: var(--text-color-secondary);
                    transition: color 0.2s, border-bottom 0.2s;
                    border-bottom: 2px solid transparent;
                    /* --- FIX: Center align tab text --- */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .fab-helper-tabs button.active {
                    color: var(--text-color-primary);
                    border-bottom: 2px solid var(--blue);
                }
                .fab-helper-tab-content {
                    padding: 12px;
                }
                .fab-helper-status-bar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    /* REMOVED: No longer needed at the bottom of the log */
                    /* margin-bottom: 12px; */
                }
                .fab-helper-status-item {
                    background: var(--dark-gray);
                    padding: 8px 6px;
                    border-radius: var(--radius-m);
                    font-size: 12px;
                    color: var(--text-color-secondary);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    gap: 2px;
                    min-width: 0;
                    flex-grow: 1;
                    /* This formula is now correct thanks to box-sizing: border-box */
                    flex-basis: calc((100% - 12px) / 3); /* (100% width - 2*6px gap) / 3 columns */
                }
                .fab-helper-status-label {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    white-space: nowrap;
                    /* REMOVED: No longer needed with a wrapping layout */
                }
                .fab-helper-status-item span {
                    display: block;
                    font-size: 18px;
                    font-weight: 600;
                    color: #fff;
                    margin-top: 0;
                }
                .fab-helper-execute-btn {
                    width: 100%;
                    border: none;
                    border-radius: var(--radius-m);
                    padding: 12px 14px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #fff;
                    background: var(--blue);
                    margin-bottom: 12px;
                    /* --- FIX: Center align button content --- */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px; /* Add space between icon and text */
                }
                .fab-helper-execute-btn.executing {
                    background: var(--pink);
                }
                .fab-helper-actions {
                    display: flex;
                    gap: 8px;
                }
                .fab-helper-actions button {
                    flex: 1; /* RESTORED: Distribute space equally */
                    min-width: 0; /* ADDED BACK: Crucial for flex shrinking */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    background: var(--dark-gray);
                    border: none;
                    border-radius: var(--radius-m);
                    color: var(--text-color-primary);
                    padding: 8px 6px; /* CRITICAL FIX: Reduced horizontal padding */
                    cursor: pointer;
                    transition: background-color 0.2s;
                    white-space: nowrap;
                    font-size: 13.5px;
                    font-weight: normal;
                }
                .fab-helper-actions button:hover {
                    background: #4a4a4c;
                }
                .fab-log-container {
                    padding: 0 12px 12px 12px;
                    /* FIX: Swapped border and margin from top to bottom */
                    border-bottom: 1px solid var(--border-color);
                    margin-bottom: 12px;
                }
                .fab-log-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    margin-top: 8px;
                }
                .fab-log-header span {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-color-secondary);
                }
                .fab-log-controls button {
                    background: transparent;
                    border: none;
                    color: var(--text-color-secondary);
                    cursor: pointer;
                    padding: 4px;
                    font-size: 18px;
                    line-height: 1;
                }
                #${Config.UI_LOG_ID} {
                    background: rgba(10,10,10,0.85);
                    color: #ddd;
                    font-size: 11px;
                    line-height: 1.4;
                    padding: 8px;
                    border-radius: var(--radius-m);
                    max-height: 150px;
                    overflow-y: auto;
                    min-height: 50px;
                    display: flex;
                    flex-direction: column-reverse;
                    box-shadow: inset 0 1px 4px rgba(0,0,0,0.2);
                }
                @keyframes fab-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(0, 122, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0); }
                }
                .fab-helper-pulse {
                    animation: fab-pulse 2s infinite;
                }
                .fab-setting-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .fab-setting-row:last-child {
                    border-bottom: none;
                }
                .fab-setting-label {
                    font-size: 14px;
                }
                .fab-toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                .fab-toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .fab-toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: var(--dark-gray);
                    transition: .4s;
                    border-radius: 24px;
                }
                .fab-toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 20px;
                    width: 20px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }
                input:checked + .fab-toggle-slider {
                    background-color: var(--blue);
                }
                input:checked + .fab-toggle-slider:before {
                    transform: translateX(20px);
                }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);

            const container = document.createElement('div');
            container.id = Config.UI_CONTAINER_ID;
            State.UI.container = container;

            // --- Header with Version ---
            const header = document.createElement('div');
            header.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
            const title = document.createElement('span');
            title.textContent = 'Fab Helper';
            title.style.fontWeight = '600';
            const version = document.createElement('span');
            version.textContent = `v${GM_info.script.version}`;
            version.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); background: var(--dark-gray); padding: 2px 5px; border-radius: var(--radius-s);';
            header.append(title, version);
            container.appendChild(header);

            // --- Tab Controls ---
            const tabContainer = document.createElement('div');
            tabContainer.className = 'fab-helper-tabs';
            const tabs = ['dashboard', 'settings', 'debug'];
            tabs.forEach(tabName => {
                const btn = document.createElement('button');
                btn.textContent = Utils.getText(`tab_${tabName}`);
                btn.onclick = () => UI.switchTab(tabName);
                tabContainer.appendChild(btn);
                State.UI.tabs[tabName] = btn;
            });

            container.appendChild(tabContainer);

            // --- Dashboard Tab ---
            const dashboardContent = document.createElement('div');
            dashboardContent.className = 'fab-helper-tab-content';
            State.UI.tabContents.dashboard = dashboardContent;

            const statusBar = document.createElement('div');
            statusBar.className = 'fab-helper-status-bar';

            const createStatusItem = (id, label, icon) => {
                const item = document.createElement('div');
                item.className = 'fab-helper-status-item';
                item.innerHTML = `<div class="fab-helper-status-label">${icon} ${label}</div><span id="${id}">0</span>`;
                return item;
            };
            State.UI.statusVisible = createStatusItem('fab-status-visible', '可见', '👁️');
            State.UI.statusTodo = createStatusItem('fab-status-todo', Utils.getText('todo'), '📥');
            State.UI.statusDone = createStatusItem('fab-status-done', Utils.getText('added'), '✅');
            State.UI.statusFailed = createStatusItem('fab-status-failed', Utils.getText('failed'), '❌');
            State.UI.statusFailed.style.cursor = 'pointer';
            State.UI.statusFailed.title = '点击打开所有失败的项目';
            State.UI.statusFailed.onclick = () => {
                if (State.db.failed.length === 0) {
                    Utils.logger('info', '失败列表为空，无需操作。');
                    return;
                }
                if (window.confirm(`您确定要在新标签页中打开 ${State.db.failed.length} 个失败的项目吗？`)) {
                    Utils.logger('info', `正在打开 ${State.db.failed.length} 个失败项目...`);
                    State.db.failed.forEach(task => {
                        GM_openInTab(task.url, { active: false });
                    });
                }
            };
            State.UI.statusHidden = createStatusItem('fab-status-hidden', Utils.getText('hidden'), '🙈');
            statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed, State.UI.statusVisible, State.UI.statusHidden);

            State.UI.execBtn = document.createElement('button');
            State.UI.execBtn.className = 'fab-helper-execute-btn';
            State.UI.execBtn.onclick = TaskRunner.toggleExecution;

            const actionButtons = document.createElement('div');
            actionButtons.className = 'fab-helper-actions';

            State.UI.syncBtn = document.createElement('button');
            State.UI.syncBtn.textContent = '🔄 ' + Utils.getText('sync');
            State.UI.syncBtn.onclick = TaskRunner.refreshVisibleStates;

            State.UI.hideBtn = document.createElement('button');
            State.UI.hideBtn.onclick = TaskRunner.toggleHideSaved;

            actionButtons.append(State.UI.syncBtn, State.UI.hideBtn);

            // --- Log Panel (created before other elements to be appended first) ---
            const logContainer = document.createElement('div');
            logContainer.className = 'fab-log-container';

            const logHeader = document.createElement('div');
            logHeader.className = 'fab-log-header';
            const logTitle = document.createElement('span');
            logTitle.textContent = '📝 操作日志';
            const logControls = document.createElement('div');
            logControls.className = 'fab-log-controls';

            const copyLogBtn = document.createElement('button');
            copyLogBtn.innerHTML = '📄';
            copyLogBtn.title = Utils.getText('copyLog');
            copyLogBtn.onclick = () => {
                navigator.clipboard.writeText(State.UI.logPanel.innerText).then(() => {
                    const originalText = copyLogBtn.textContent;
                    copyLogBtn.textContent = '✅';
                    setTimeout(() => { copyLogBtn.textContent = originalText; }, 1500);
                }).catch(err => Utils.logger('error', 'Failed to copy log:', err));
            };

            const clearLogBtn = document.createElement('button');
            clearLogBtn.innerHTML = '🗑️';
            clearLogBtn.title = Utils.getText('clearLog');
            clearLogBtn.onclick = () => { State.UI.logPanel.innerHTML = ''; };

            logControls.append(copyLogBtn, clearLogBtn);
            logHeader.append(logTitle, logControls);

            State.UI.logPanel = document.createElement('div');
            State.UI.logPanel.id = Config.UI_LOG_ID;
            
            logContainer.append(logHeader, State.UI.logPanel);
            
            // Reorder elements for the new layout: Log first, then status, then buttons
            dashboardContent.append(logContainer, statusBar, State.UI.execBtn, actionButtons);

            container.appendChild(dashboardContent);

            // --- Settings Tab ---
            const settingsContent = document.createElement('div');
            settingsContent.className = 'fab-helper-tab-content';
            
            const createSettingRow = (labelText, stateKey) => {
                const row = document.createElement('div');
                row.className = 'fab-setting-row';

                const label = document.createElement('span');
                label.className = 'fab-setting-label';
                label.textContent = labelText;

                const switchContainer = document.createElement('label');
                switchContainer.className = 'fab-toggle-switch';
                
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = State[stateKey];
                input.onchange = (e) => {
                    // Stop the event from doing anything weird, just in case.
                    e.stopPropagation();
                    e.preventDefault();

                    if(stateKey === 'autoAddOnScroll') {
                        TaskRunner.toggleAutoAdd();
                    } else if (stateKey === 'rememberScrollPosition') {
                        TaskRunner.toggleRememberPosition();
                    } else if (stateKey === 'autoResumeAfter429') {
                        TaskRunner.toggleAutoResume();
                    }
                    // Manually sync the visual state of the checkbox since we prevented default action
                    e.target.checked = State[stateKey];
                };

                const slider = document.createElement('span');
                slider.className = 'fab-toggle-slider';

                switchContainer.append(input, slider);
                row.append(label, switchContainer);
                return { row, input };
            };

            const autoAddSetting = createSettingRow('无限滚动时自动添加任务', 'autoAddOnScroll');
            settingsContent.appendChild(autoAddSetting.row);
            
            const rememberPosSetting = createSettingRow('记住瀑布流浏览位置', 'rememberScrollPosition');
            settingsContent.appendChild(rememberPosSetting.row);

            const autoResumeSetting = createSettingRow('429后自动恢复并继续', 'autoResumeAfter429');
            settingsContent.appendChild(autoResumeSetting.row);

            const resetButton = document.createElement('button');
            resetButton.textContent = '🗑️ 清空所有存档';
            resetButton.style.cssText = 'width: 100%; margin-top: 15px; background-color: var(--pink); color: white; padding: 10px; border-radius: var(--radius-m); border: none; cursor: pointer;';
            resetButton.onclick = Database.resetAllData;
            settingsContent.appendChild(resetButton);

            State.UI.tabContents.settings = settingsContent;
            container.appendChild(settingsContent);

            // --- 调试标签页 ---
            const debugContent = document.createElement('div');
            debugContent.className = 'fab-helper-tab-content';
            
            const debugHeader = document.createElement('div');
            debugHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';

            const debugTitle = document.createElement('h4');
            debugTitle.textContent = '状态周期历史记录';
            debugTitle.style.margin = '0';

            const debugControls = document.createElement('div');
            debugControls.style.cssText = 'display: flex; gap: 8px;';

            const copyHistoryBtn = document.createElement('button');
            copyHistoryBtn.textContent = '复制';
            copyHistoryBtn.title = '复制详细历史记录';
            copyHistoryBtn.style.cssText = 'background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;';
            copyHistoryBtn.onclick = () => {
                if (State.statusHistory.length === 0) {
                    Utils.logger('info', '没有历史记录可供复制。');
                    return;
                }
                const formatEntry = (entry) => {
                    const date = new Date(entry.endTime).toLocaleString();
                    
                    if (entry.type === 'STARTUP') {
                        return `🚀 脚本启动\n  - 时间: ${date}\n  - 信息: ${entry.message || ''}`;
                    } else {
                        const type = entry.type === 'NORMAL' ? '✅ 正常运行' : '🚨 限速时期';
                        let details = `持续: ${entry.duration.toFixed(2)}s`;
                        if (entry.requests !== undefined) {
                            details += `, 请求: ${entry.requests}次`;
                        }
                        return `${type}\n  - 结束于: ${date}\n  - ${details}`;
                    }
                };
                const fullLog = State.statusHistory.map(formatEntry).join('\n\n');
                navigator.clipboard.writeText(fullLog).then(() => {
                    const originalText = copyHistoryBtn.textContent;
                    copyHistoryBtn.textContent = '已复制!';
                    setTimeout(() => { copyHistoryBtn.textContent = originalText; }, 2000);
                }).catch(err => Utils.logger('error', '复制失败:', err));
            };

            const clearHistoryBtn = document.createElement('button');
            clearHistoryBtn.textContent = '清空';
            clearHistoryBtn.title = '清空历史记录';
            clearHistoryBtn.style.cssText = 'background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;';
            clearHistoryBtn.onclick = async () => {
                if (window.confirm('您确定要清空所有状态历史记录吗？')) {
                    State.statusHistory = [];
                    await GM_deleteValue(Config.DB_KEYS.STATUS_HISTORY);
                    
                    // 添加一个新的"当前会话"记录
                    const currentSessionEntry = {
                        type: 'STARTUP',
                        duration: 0,
                        endTime: new Date().toISOString(),
                        message: '历史记录已清空，新会话开始'
                    };
                    State.statusHistory.push(currentSessionEntry);
                    await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
                    
                    UI.updateDebugTab();
                    Utils.logger('info', '状态历史记录已清空。');
                }
            };
            
            debugControls.append(copyHistoryBtn, clearHistoryBtn);
            debugHeader.append(debugTitle, debugControls);

            const historyListContainer = document.createElement('div');
            historyListContainer.style.cssText = 'max-height: 250px; overflow-y: auto;';
            State.UI.debugContent = historyListContainer;

            debugContent.append(debugHeader, historyListContainer);
            State.UI.tabContents.debug = debugContent;
            container.appendChild(debugContent);

            document.body.appendChild(container);
            
            // --- BUG FIX: Explicitly return true on successful creation ---
            return true;
        },

        update: () => {
            if (!State.UI.container) return;

            // --- Update Status Numbers ---
            const todoCount = State.db.todo.length;
            const doneCount = State.db.done.length;
            const failedCount = State.db.failed.length;
            const visibleCount = document.querySelectorAll(Config.SELECTORS.card).length - State.hiddenThisPageCount;

            State.UI.statusTodo.querySelector('span').textContent = todoCount;
            State.UI.statusDone.querySelector('span').textContent = doneCount;
            State.UI.statusFailed.querySelector('span').textContent = failedCount;
            State.UI.statusHidden.querySelector('span').textContent = State.hiddenThisPageCount;
            State.UI.statusVisible.querySelector('span').textContent = visibleCount;
            
            // --- Update Button States ---
            if (State.isExecuting) {
                State.UI.execBtn.innerHTML = `<span>${Utils.getText('executing')}</span>`;
                State.UI.execBtn.classList.add('executing');
                // Maybe add a progress bar here later
            } else {
                State.UI.execBtn.textContent = Utils.getText('execute');
                State.UI.execBtn.classList.remove('executing');
            }
            State.UI.hideBtn.textContent = (State.hideSaved ? '🙈 ' : '👁️ ') + (State.hideSaved ? Utils.getText('show') : Utils.getText('hide'));
        },
        removeAllOverlays: () => {
            document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
                const overlay = card.querySelector('.fab-helper-overlay');
                if (overlay) overlay.remove();
                card.style.opacity = '1';
            });
        },
        switchTab: (tabName) => {
            for (const name in State.UI.tabs) {
                State.UI.tabs[name].classList.toggle('active', name === tabName);
                State.UI.tabContents[name].style.display = name === tabName ? 'block' : 'none';
            }
        },
        updateDebugTab: () => {
            if (!State.UI.debugContent) return;
            State.UI.debugContent.innerHTML = ''; // Clear previous entries
            
            // 创建历史记录项
            const createHistoryItem = (entry) => {
                const item = document.createElement('div');
                item.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border-color);';
                
                const header = document.createElement('div');
                header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
                
                let icon, color, titleText;
                
                if (entry.type === 'STARTUP') {
                    icon = '🚀';
                    color = 'var(--blue)';
                    titleText = '脚本启动';
                } else if (entry.type === 'NORMAL') {
                    icon = '✅';
                    color = 'var(--green)';
                    titleText = '正常运行期';
                } else { // RATE_LIMITED
                    icon = '🚨';
                    color = 'var(--orange)';
                    titleText = '限速期';
                }

                header.innerHTML = `<span style="font-size: 18px;">${icon}</span> <strong style="color: ${color};">${titleText}</strong>`;
                
                const details = document.createElement('div');
                details.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;';
                
                let detailsHtml = '';
                
                if (entry.type === 'STARTUP') {
                    detailsHtml = `<div>时间: ${new Date(entry.endTime).toLocaleString()}</div>`;
                    if (entry.message) {
                        detailsHtml += `<div>信息: <strong>${entry.message}</strong></div>`;
                    }
                } else {
                    detailsHtml = `<div>持续时间: <strong>${entry.duration.toFixed(2)}s</strong></div>`;
                    if (entry.requests !== undefined) {
                        detailsHtml += `<div>期间请求数: <strong>${entry.requests}</strong></div>`;
                    }
                    detailsHtml += `<div>结束于: ${new Date(entry.endTime).toLocaleString()}</div>`;
                }
                
                details.innerHTML = detailsHtml;

                item.append(header, details);
                return item;
            };
            
            // 创建当前状态项（即使没有历史记录也会显示）
            const createCurrentStatusItem = () => {
                if(State.appStatus === 'NORMAL' || State.appStatus === 'RATE_LIMITED') {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border-color); background: var(--blue-bg);';

                    const header = document.createElement('div');
                    header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
                    
                    const icon = State.appStatus === 'NORMAL' ? '✅' : '🚨';
                    const color = State.appStatus === 'NORMAL' ? 'var(--green)' : 'var(--orange)';
                    const titleText = State.appStatus === 'NORMAL' ? '当前: 正常运行' : '当前: 限速中';
                    
                    header.innerHTML = `<span style="font-size: 18px;">${icon}</span> <strong style="color: ${color};">${titleText}</strong>`;

                    const details = document.createElement('div');
                    details.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;';

                    const startTime = State.appStatus === 'NORMAL' ? State.normalStartTime : State.rateLimitStartTime;
                    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                    
                    let detailsHtml = `<div>已持续: <strong>${duration}s</strong></div>`;
                    if (State.appStatus === 'NORMAL') {
                         detailsHtml += `<div>期间请求数: <strong>${State.successfulSearchCount}</strong></div>`;
                    }
                     detailsHtml += `<div>开始于: ${new Date(startTime).toLocaleString()}</div>`;
                    details.innerHTML = detailsHtml;

                    item.append(header, details);
                    State.UI.debugContent.appendChild(item);
                }
            };
            
            // 添加当前状态项（始终显示）
            createCurrentStatusItem();
            
            // 如果没有历史记录，显示提示信息
            if (State.statusHistory.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.style.cssText = 'color: #888; text-align: center; padding: 20px;';
                emptyMessage.textContent = '没有可显示的历史记录。';
                State.UI.debugContent.appendChild(emptyMessage);
                return;
            }

            // 显示历史记录（如果有）
            const reversedHistory = [...State.statusHistory].reverse();
            reversedHistory.forEach(entry => State.UI.debugContent.appendChild(createHistoryItem(entry)));
        },
    };


    // --- 模块九: 主程序与初始化 (Main & Initialization) ---
    async function main() {
        Utils.logger('info', '脚本开始运行...');
        Utils.detectLanguage();
        await Database.load();
        await PagePatcher.init();
        
        // 检查是否有临时保存的待办任务（从429恢复）
        const tempTasks = await GM_getValue('temp_todo_tasks', null);
        if (tempTasks && tempTasks.length > 0) {
            Utils.logger('info', `从429恢复：找到 ${tempTasks.length} 个临时保存的待办任务，正在恢复...`);
            State.db.todo = tempTasks;
            await GM_deleteValue('temp_todo_tasks'); // 清除临时存储
        }
        
        // 初始化状态时间和历史记录
        if (State.appStatus === 'NORMAL' || State.appStatus === undefined) {
            State.appStatus = 'NORMAL';
            State.normalStartTime = Date.now();
            State.successfulSearchCount = 0;
            
            // 添加一个初始状态记录，表示脚本启动
            if (State.statusHistory.length === 0) {
                const startupEntry = {
                    type: 'STARTUP',
                    duration: 0,
                    endTime: new Date().toISOString(),
                    message: '脚本启动'
                };
                State.statusHistory.push(startupEntry);
                await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
            }
        }
        
        // 添加工作标签页完成任务的监听器
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.WORKER_DONE, async (key, oldValue, newValue) => {
            if (!newValue) return; // 如果值被删除，忽略此事件
            
            try {
                // 删除值，防止重复处理
                await GM_deleteValue(Config.DB_KEYS.WORKER_DONE);
                
                const { workerId, success, task, logs } = newValue;
                
                if (!workerId || !task) {
                    Utils.logger('error', '收到无效的工作报告。缺少workerId或task。');
                    return;
                }
                
                // 移除此工作标签页的记录
                if (State.runningWorkers[workerId]) {
                    delete State.runningWorkers[workerId];
                    State.activeWorkers--;
                }
                
                // 记录工作标签页的日志
                if (logs && logs.length) {
                    logs.forEach(log => Utils.logger('info', log));
                }
                
                // 处理任务结果
                if (success) {
                    Utils.logger('info', `✅ 任务完成: ${task.name}`);
                    
                    // 从待办列表中移除此任务
                    State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
                    
                    // 如果尚未在完成列表中，则添加
                    if (!State.db.done.includes(task.url)) {
                        State.db.done.push(task.url);
                        await Database.saveDone();
                    }
                    
                    // 更新会话状态
                    State.sessionCompleted.add(task.url);
                    
                    // 更新执行统计
                    State.executionCompletedTasks++;
        } else {
                    Utils.logger('warn', `❌ 任务失败: ${task.name}`);
                    
                    // 从待办列表中移除此任务
                    State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
                    
                    // 添加到失败列表（如果尚未存在）
                    if (!State.db.failed.some(f => f.uid === task.uid)) {
                        State.db.failed.push(task);
                        await Database.saveFailed();
                    }
                    
                    // 更新执行统计
                    State.executionFailedTasks++;
                }
                
                // 更新UI
                UI.update();
                
                // 如果还有待办任务，继续执行
                if (State.isExecuting && State.activeWorkers < Config.MAX_CONCURRENT_WORKERS && State.db.todo.length > 0) {
                    TaskRunner.executeBatch();
                }
                
                // 如果所有任务都已完成，停止执行
                if (State.isExecuting && State.db.todo.length === 0 && State.activeWorkers === 0) {
                    Utils.logger('info', '所有任务已完成。');
                    State.isExecuting = false;
                    UI.update();
                }
                
                // 更新隐藏状态
                TaskRunner.runHideOrShow();
            } catch (error) {
                Utils.logger('error', `处理工作报告时出错: ${error.message}`);
            }
        }));

        // --- ROBUST LAUNCHER ---
        // This interval is launched from the clean userscript context and is less likely to be interfered with.
        // It will persistently try to launch the DOM-dependent part of the script.
        const launcherInterval = setInterval(() => {
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                if (!State.hasRunDomPart) {
                    Utils.logger('info', '[Launcher] DOM is ready. Running main script logic...');
            runDomDependentPart();
        }
                if (State.hasRunDomPart) {
                     clearInterval(launcherInterval);
                     Utils.logger('info', '[Launcher] Main logic has been launched or skipped. Launcher is now idle.');
                }
            }
        }, 250); // Check every 250ms
    }

    async function runDomDependentPart() {
        if (State.hasRunDomPart) return;

        // The new, correct worker detection logic.
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('workerId')) {
            TaskRunner.processDetailPage();
            State.hasRunDomPart = true; // Mark as run to stop the launcher
            return; 
        }

        // --- NEW FLOW: Create the UI FIRST for immediate user feedback ---
        const uiCreated = UI.create();

        if (!uiCreated) {
            Utils.logger('info', 'This is a detail or worker page. Halting main script execution.');
            State.hasRunDomPart = true; // Mark as run to stop the launcher
             return;
        }

        // 确保UI创建后立即更新调试标签页
        UI.update();
        UI.updateDebugTab();
        UI.switchTab('dashboard'); // 设置初始标签页
        
        State.hasRunDomPart = true; // Mark as run *after* successful UI creation

        // --- Dead on Arrival Check for initial 429 page load ---
        // 使enterRateLimitedState函数全局可访问，以便其他部分可以调用
        window.enterRateLimitedState = function() {
            if (State.appStatus !== 'RATE_LIMITED') {
                // 记录正常运行期的统计信息
                const normalDuration = ((Date.now() - State.normalStartTime) / 1000).toFixed(2);
                const logEntry = {
                    type: 'NORMAL',
                    duration: parseFloat(normalDuration),
                    requests: State.successfulSearchCount,
                    endTime: new Date().toISOString()
                };
                
                // 保存到历史记录
                State.statusHistory.push(logEntry);
                GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
                
                // 切换到限速状态
                State.appStatus = 'RATE_LIMITED';
                State.rateLimitStartTime = Date.now();
                GM_setValue(Config.DB_KEYS.APP_STATUS, { status: 'RATE_LIMITED', startTime: State.rateLimitStartTime });
                Utils.logger('error', 'Rate limit detected on page load. Waiting for manual or automatic recovery.');
                
                // 更新UI
                if (UI.updateDebugTab) {
                    UI.updateDebugTab();
                    UI.update();
                }
                
                // 如果启用了自动恢复，开始随机刷新
                if (State.autoResumeAfter429) {
                    const randomDelay = 5000 + Math.random() * 10000;
                    countdownRefresh(randomDelay, '自动恢复');
                }
            }
        };

        const checkIsErrorPage = (title, text) => {
            const isCloudflareTitle = title.includes('Cloudflare') || title.includes('Attention Required');
            const is429Text = text.includes('429') || 
                              text.includes('Too Many Requests') || 
                              text.includes('Too many requests') || 
                              text.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i);
            if (isCloudflareTitle || is429Text) {
                Utils.logger('warn', `[页面加载] 检测到429错误页面: ${document.location.href}`);
                window.enterRateLimitedState();
                return true;
            }
            return false;
        };
        
        if (checkIsErrorPage(document.title, document.body.innerText || '')) {
            return;
        }

        // The auto-resume logic is preserved
        if (State.appStatus === 'RATE_LIMITED' && State.autoResumeAfter429) {
            Utils.logger('info', '[Auto-Resume] 页面在限速状态下加载。正在进行恢复探测...');
            
            // 尝试发送一个探测请求，检查是否已经恢复
            try {
                const probeResponse = await fetch('https://www.fab.com/api/health-check');
                if (probeResponse.ok) {
                    // 恢复成功，记录限速期的统计信息
                    const rateLimitDuration = ((Date.now() - State.rateLimitStartTime) / 1000).toFixed(2);
                    const logEntry = {
                        type: 'RATE_LIMITED',
                        duration: parseFloat(rateLimitDuration),
                        endTime: new Date().toISOString()
                    };
                    State.statusHistory.push(logEntry);
                    await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
                    
                    // 恢复到正常状态
                    Utils.logger('info', `✅ 恢复探测成功！限速期已结束，持续了 ${rateLimitDuration}s。`);
                    State.appStatus = 'NORMAL';
                    State.rateLimitStartTime = null;
                    State.normalStartTime = Date.now();
                    State.successfulSearchCount = 0;
                    GM_deleteValue(Config.DB_KEYS.APP_STATUS);
                    
                    // 如果有待办任务，继续执行
                    if (State.db.todo.length > 0 && !State.isExecuting) {
                        Utils.logger('info', `发现 ${State.db.todo.length} 个待办任务，自动恢复执行...`);
                        State.isExecuting = true;
                        TaskRunner.executeBatch();
                    }
                    
                    // 更新UI
                    UI.updateDebugTab();
                    UI.update();
                } else {
                    // 仍然处于限速状态，继续随机刷新
                    Utils.logger('warn', '恢复探测失败。仍处于限速状态，将继续随机刷新...');
                    const randomDelay = 5000 + Math.random() * 10000;
                    countdownRefresh(randomDelay, '恢复探测失败');
                }
            } catch (error) {
                // 探测出错，继续随机刷新
                Utils.logger('error', `恢复探测出错: ${error.message}。将继续随机刷新...`);
                const randomDelay = 5000 + Math.random() * 10000;
                countdownRefresh(randomDelay, '恢复探测出错');
            }
        }

        // --- Observer setup is now directly inside runDomDependentPart ---
        const containerSelectors = [
            'main', '#main', '.AssetGrid-root', '.fabkit-responsive-grid-container'
        ];
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
                    Utils.logger('info', '[Observer] New content detected. Processing...');
                    TaskRunner.scanAndAddTasks(document.querySelectorAll(Config.SELECTORS.card));
                    TaskRunner.runHideOrShow();
                }, 500);
            }
        });

        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
        Utils.logger('info', `✅ Core DOM observer is now active on <${targetNode.tagName.toLowerCase()}>.`);
        
        // 初始化时运行一次隐藏逻辑，确保页面加载时已有的内容能被正确处理
            TaskRunner.runHideOrShow();
        
        // 添加定期检查功能，每10秒检查一次待办列表中的任务是否已经完成
        setInterval(() => {
            // 如果待办列表为空，不需要检查
            if (State.db.todo.length === 0) return;
            
            // 检查待办列表中的每个任务，看是否已经在"完成"列表中
            const initialTodoCount = State.db.todo.length;
            State.db.todo = State.db.todo.filter(task => {
                const url = task.url.split('?')[0];
                // 如果任务已经在"完成"列表中，则从待办列表中移除
                return !State.db.done.includes(url);
            });
            
            // 如果待办列表的数量发生了变化，更新UI
            if (State.db.todo.length < initialTodoCount) {
                Utils.logger('info', `[自动清理] 从待办列表中移除了 ${initialTodoCount - State.db.todo.length} 个已完成的任务。`);
                UI.update();
            }
        }, 10000);
        
        // 添加定期检查功能，检测是否请求不出新商品（隐性限速）
        let lastCardCount = document.querySelectorAll(Config.SELECTORS.card).length;
        let noNewCardsCounter = 0;
        let lastScrollY = window.scrollY;
        
        setInterval(() => {
            // 如果已经处于限速状态，不需要检查
            if (State.appStatus !== 'NORMAL') return;
            
            // 获取当前卡片数量
            const currentCardCount = document.querySelectorAll(Config.SELECTORS.card).length;
            
            // 如果滚动了但卡片数量没有增加，可能是隐性限速
            if (window.scrollY > lastScrollY + 100 && currentCardCount === lastCardCount) {
                noNewCardsCounter++;
                
                // 如果连续3次检查都没有新卡片，认为是隐性限速
                if (noNewCardsCounter >= 3) {
                    Utils.logger('warn', `[隐性限速检测] 检测到可能的限速情况：连续${noNewCardsCounter}次滚动后卡片数量未增加。`);
                    PagePatcher.handleRateLimit('隐性限速检测');
                    noNewCardsCounter = 0;
                }
            } else if (currentCardCount > lastCardCount) {
                // 有新卡片，重置计数器
                noNewCardsCounter = 0;
            }
            
            // 更新上次卡片数量和滚动位置
            lastCardCount = currentCardCount;
            lastScrollY = window.scrollY;
        }, 5000); // 每5秒检查一次

        // 添加页面内容检测功能，定期检查页面是否显示了限速错误信息
        setInterval(() => {
            // 如果已经处于限速状态，不需要检查
            if (State.appStatus !== 'NORMAL') return;
            
            // 检查页面内容是否包含限速错误信息
            const pageText = document.body.innerText || '';
            const jsonPattern = /\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i;
            
            if (pageText.match(jsonPattern) || 
                pageText.includes('Too many requests') || 
                pageText.includes('rate limit')) {
                
                Utils.logger('warn', '[页面内容检测] 检测到页面显示限速错误信息！');
                try {
                    PagePatcher.handleRateLimit('页面内容检测');
                } catch (error) {
                    Utils.logger('error', `处理限速出错: ${error.message}`);
                    // 直接调用enterRateLimitedState作为备选方案
                    if (typeof window.enterRateLimitedState === 'function') {
                        window.enterRateLimitedState();
                } else {
                        // 最后的备选方案：直接刷新页面
                        const randomDelay = 5000 + Math.random() * 10000;
                        Utils.logger('info', `将在 ${(randomDelay/1000).toFixed(1)} 秒后刷新页面尝试恢复...`);
                        setTimeout(() => location.reload(), randomDelay);
                    }
                }
            }
        }, 3000); // 每3秒检查一次

        // 添加HTTP状态码检测功能，定期检查当前页面的HTTP状态码
        const checkHttpStatus = async () => {
            try {
                // 如果已经处于限速状态，不需要检查
                if (State.appStatus !== 'NORMAL') return;
                
                // 发送HEAD请求检查当前页面的HTTP状态码
                const response = await fetch(window.location.href, { 
                    method: 'HEAD',
                    cache: 'no-store',
                    credentials: 'same-origin'
                });
                
                if (response.status === 429 || response.status === '429' || response.status.toString() === '429') {
                    Utils.logger('warn', `[HTTP状态检测] 检测到当前页面状态码为429！`);
                    try {
                        PagePatcher.handleRateLimit('HTTP状态检测');
                    } catch (error) {
                        Utils.logger('error', `处理限速出错: ${error.message}`);
                        // 直接调用enterRateLimitedState作为备选方案
                        if (typeof window.enterRateLimitedState === 'function') {
                            window.enterRateLimitedState();
                        } else {
                            // 最后的备选方案：直接刷新页面
                            const randomDelay = 5000 + Math.random() * 10000;
                            Utils.logger('info', `将在 ${(randomDelay/1000).toFixed(1)} 秒后刷新页面尝试恢复...`);
                            setTimeout(() => location.reload(), randomDelay);
                        }
                    }
                }
            } catch (error) {
                // 忽略错误
            }
        };
        
        // 每10秒检查一次HTTP状态码
        setInterval(checkHttpStatus, 10000);

        // 添加API请求监控，定期检查最近的API请求状态
        const checkApiRequests = async () => {
            try {
                // 如果已经处于限速状态，不需要检查
                if (State.appStatus !== 'NORMAL') return;
                
                // 发送API请求检查状态
                const apiUrl = 'https://www.fab.com/i/listings/search?is_free=1&sort_by=title&cursor=' + 
                               encodeURIComponent('bz02JnA9Tm9yZGljK0JlYWNoK0JvdWxkZXI=');
                
                const response = await fetch(apiUrl, { 
                    method: 'HEAD',
                    cache: 'no-store',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.status === 429 || response.status === '429' || response.status.toString() === '429') {
                    Utils.logger('warn', `[API状态检测] 检测到API请求状态码为429！`);
                    try {
                        PagePatcher.handleRateLimit('API状态检测');
                    } catch (error) {
                        Utils.logger('error', `处理限速出错: ${error.message}`);
                        // 直接调用enterRateLimitedState作为备选方案
                        if (typeof window.enterRateLimitedState === 'function') {
                            window.enterRateLimitedState();
                        } else {
                            // 最后的备选方案：直接刷新页面
                            const randomDelay = 5000 + Math.random() * 10000;
                            Utils.logger('info', `将在 ${(randomDelay/1000).toFixed(1)} 秒后刷新页面尝试恢复...`);
                            setTimeout(() => location.reload(), randomDelay);
                        }
                    }
                }
            } catch (error) {
                // 如果请求失败，可能也是限速导致的
                Utils.logger('warn', `[API状态检测] API请求失败，可能是限速导致: ${error.message}`);
                if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                    try {
                        PagePatcher.handleRateLimit('API请求失败');
                    } catch (innerError) {
                        Utils.logger('error', `处理限速出错: ${innerError.message}`);
                        // 直接调用enterRateLimitedState作为备选方案
                        if (typeof window.enterRateLimitedState === 'function') {
                            window.enterRateLimitedState();
                        } else {
                            // 最后的备选方案：直接刷新页面
                            const randomDelay = 5000 + Math.random() * 10000;
                            Utils.logger('info', `将在 ${(randomDelay/1000).toFixed(1)} 秒后刷新页面尝试恢复...`);
                            setTimeout(() => location.reload(), randomDelay);
                        }
                    }
                }
            }
        };
        
        // 每15秒检查一次API状态
        setInterval(checkApiRequests, 15000);

        // 添加专门针对滚动加载API请求的拦截器
        const originalXMLHttpRequestSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(...args) {
            const xhr = this;
            
            // 添加额外的事件监听器，专门用于检测429错误
            xhr.addEventListener('load', function() {
                // 只检查listings/search相关的请求
                if (xhr._url && xhr._url.includes('/i/listings/search')) {
                    // 检查状态码
                    if (xhr.status === 429 || xhr.status === '429' || xhr.status.toString() === '429') {
                        Utils.logger('warn', `[滚动API监控] 检测到API请求状态码为429: ${xhr._url}`);
                        try {
                            PagePatcher.handleRateLimit('滚动API监控');
                        } catch (error) {
                            Utils.logger('error', `处理限速出错: ${error.message}`);
                            // 直接使用全局函数作为备选方案
                            if (typeof window.enterRateLimitedState === 'function') {
                                window.enterRateLimitedState();
                            } else {
                                // 最后的备选方案：直接刷新页面
                                const randomDelay = 5000 + Math.random() * 10000;
                                Utils.logger('info', `将在 ${(randomDelay/1000).toFixed(1)} 秒后刷新页面尝试恢复...`);
                                setTimeout(() => location.reload(), randomDelay);
                            }
                        }
                        return;
                    }
                    
                    // 检查响应内容
                    try {
                        const responseText = xhr.responseText;
                        if (responseText && (
                            responseText.includes('Too many requests') || 
                            responseText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)
                        )) {
                            Utils.logger('warn', `[滚动API监控] 检测到API响应内容包含限速信息: ${responseText}`);
                            try {
                                PagePatcher.handleRateLimit('滚动API监控');
                            } catch (error) {
                                Utils.logger('error', `处理限速出错: ${error.message}`);
                                // 直接使用全局函数作为备选方案
                                if (typeof window.enterRateLimitedState === 'function') {
                                    window.enterRateLimitedState();
                                } else {
                                    // 最后的备选方案：直接刷新页面
                                    const randomDelay = 5000 + Math.random() * 10000;
                                    Utils.logger('info', `将在 ${(randomDelay/1000).toFixed(1)} 秒后刷新页面尝试恢复...`);
                                    setTimeout(() => location.reload(), randomDelay);
                                }
                            }
                            return;
                        }
                    } catch (e) {
                        // 忽略错误
                    }
                }
            });
            
            return originalXMLHttpRequestSend.apply(this, args);
        };
    }

    main();

    // 添加一个通用的倒计时刷新函数
    const countdownRefresh = (delay, reason = '备选方案') => {
        const seconds = (delay/1000).toFixed(1);
        
        // 添加明显的倒计时日志
        Utils.logger('info', `🔄 ${reason}启动！将在 ${seconds} 秒后刷新页面尝试恢复...`);
        
        // 每秒更新倒计时日志
        let remainingSeconds = Math.ceil(delay/1000);
        const countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                Utils.logger('info', `⏱️ 倒计时结束，正在刷新页面...`);
            } else {
                Utils.logger('info', `⏱️ 自动刷新倒计时: ${remainingSeconds} 秒...`);
            }
        }, 1000);
        
        // 设置刷新定时器
        setTimeout(() => location.reload(), delay);
    };

})();