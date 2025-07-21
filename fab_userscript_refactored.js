// ==UserScript==
// @name         Fab API-Driven Helper
// @name:en      Fab API-Driven Helper
// @name:zh      Fab API 驱动助手
// @namespace    http://tampermonkey.net/
// @version      2.0.6
// @description  Automates acquiring free assets from Fab.com using its internal API, with a modern UI.
// @description:en Automates acquiring free assets from Fab.com using its internal API, with a modern UI.
// @description:zh 通过调用内部API，自动化获取Fab.com上的免费资源，并配有现代化的UI。
// @author       gpt-4 & user & Gemini
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

    // --- 页面级 cursor 恢复逻辑（最优先，document-start）---
    (function restoreCursorToUrl() {
        try {
            // 只在主商品搜索页生效
            const url = new URL(window.location.href);
            const isFabSearch =
                (/\/search\?is_free=1&sort_by=title/.test(url.pathname + url.search) ||
                 /\/zh-cn\/search\?is_free=1&sort_by=title/.test(url.pathname + url.search));
            if (!isFabSearch) return;
            if (url.searchParams.has('cursor')) {
                console.info('[Fab Helper][URL恢复] 当前URL已包含cursor参数，无需跳转');
                return;
            }
            // 读取本地保存的cursor（同步）
            let savedCursor = null;
            try {
                savedCursor = localStorage.getItem('fab_lastCursor') || null;
            } catch (e) {}
            // 若未找到，再尝试GM_getValue（异步，降级方案）
            if (!savedCursor && typeof GM_getValue === 'function') {
                try {
                    if (GM_getValue.length === 1) {
                        savedCursor = GM_getValue('fab_lastCursor');
                    } else {
                        // 异步API
                        GM_getValue('fab_lastCursor', null).then(cursor => {
                            if (cursor) {
                                url.searchParams.set('cursor', cursor);
                                console.info('[Fab Helper][URL恢复-异步] 跳转到带cursor的URL:', url.toString());
                                location.replace(url.toString());
                            }
                        });
                        return;
                    }
                } catch (e) {}
            }
            if (savedCursor) {
                url.searchParams.set('cursor', savedCursor);
                console.info('[Fab Helper][URL恢复] 跳转到带cursor的URL:', url.toString());
                location.replace(url.toString());
            } else {
                console.info('[Fab Helper][URL恢复] 未检测到本地保存的cursor，无需跳转');
            }
        } catch (e) {
            console.error('[Fab Helper][URL恢复] 发生异常:', e);
        }
    })();

    // --- 模块一: 配置与常量 (Config & Constants) ---
    const Config = {
        SCRIPT_NAME: '[Fab API-Driven Helper v2.0.0]',
        DB_VERSION: 3,
        DB_NAME: 'fab_helper_db',
        MAX_WORKERS: 3, // Maximum number of concurrent worker tabs
        UI_CONTAINER_ID: 'fab-helper-container-v2',
        UI_LOG_ID: 'fab-helper-log-v2',
        DB_KEYS: {
            DONE: 'fab_doneList_v8',
            FAILED: 'fab_failedList_v8', // For items that failed processing
            HIDE: 'fab_hideSaved_v8',
            AUTO_ADD: 'fab_autoAdd_v8', // Key for the new setting
            REMEMBER_POS: 'fab_rememberPos_v8',
            LAST_CURSOR: 'fab_lastCursor_v8', // Store only the cursor string
            WORKER_DONE: 'fab_worker_done_v8', // This is the ONLY key workers use to report back.
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
        },
        valueChangeListeners: [],
        sessionCompleted: new Set(), // Phase15: URLs completed this session
        isLogCollapsed: localStorage.getItem('fab_helper_log_collapsed') === 'true' || false, // 日志面板折叠状态
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
            Utils.logger('info', Utils.getText('log_db_loaded'), `(Session) To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
        },
        // saveTodo is no longer needed as the todo list is not persisted across sessions.
        saveDone: () => GM_setValue(Config.DB_KEYS.DONE, State.db.done),
        saveFailed: () => GM_setValue(Config.DB_KEYS.FAILED, State.db.failed),
        saveHidePref: () => GM_setValue(Config.DB_KEYS.HIDE, State.hideSaved),
        saveAutoAddPref: () => GM_setValue(Config.DB_KEYS.AUTO_ADD, State.autoAddOnScroll), // Save the setting
        saveRememberPosPref: () => GM_setValue(Config.DB_KEYS.REMEMBER_POS, State.rememberScrollPosition),

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
            Utils.logger('info', '网络过滤器(NetworkFilter)模块已弃用，功能由补丁程序(MonkeyPatcher)处理。');
        }
    };

    const MonkeyPatcher = {
        init: () => {
            Utils.logger('info', '[补丁] 初始化 MonkeyPatcher...');
            if (!State.rememberScrollPosition) {
                Utils.logger('info', '[补丁] 记住位置功能未开启，MonkeyPatcher 不生效');
                return;
            }

            // --- 共享的核心逻辑 ---
            const saveNextUrlFromResponse = (responseText) => {
                try {
                    const responseJson = JSON.parse(responseText);
                    const nextUrl = responseJson.next;
                    if (nextUrl) {
                        // 从下一个API URL中只提取cursor的值
                        const cursorValue = new URL(nextUrl).searchParams.get('cursor');
                        if (cursorValue) {
                            GM_setValue(Config.DB_KEYS.LAST_CURSOR, cursorValue);
                            Utils.logger('info', `[补丁-保存] 已成功保存下一页的 cursor: ${cursorValue}`);
                        } else {
                            Utils.logger('warn', `[补丁-保存] 在 'next' URL 中未找到 cursor: ${nextUrl}`);
                        }
                    } else {
                        GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
                        Utils.logger('info', '[补丁-保存] 已到达列表末尾，清除已保存的位置。');
                    }
            } catch (e) {
                    Utils.logger('error', `[补丁-保存] 解析API响应失败: ${e.message}`);
                }
            };

            const getModifiedUrl = (originalUrl) => {
                // 定义主内容加载请求的特征，用于精确打击
                const isMainContentRequest =
                    originalUrl.includes('is_free=1') &&
                    !originalUrl.includes('aggregate_on') &&
                    !originalUrl.includes('in=wishlist');

                if (!State.rememberScrollPosition) {
                    Utils.logger('info', `[补丁-劫持] 跳过：功能未开启`);
                    return originalUrl;
                }
                if (!State.savedCursor) {
                    Utils.logger('info', `[补丁-劫持] 跳过：无已保存cursor`);
                    return originalUrl;
                }
                if (!isMainContentRequest) {
                    Utils.logger('info', `[补丁-劫持] 跳过：非主内容请求: ${originalUrl}`);
                    return originalUrl;
                }
                if (originalUrl.includes('cursor=')) {
                    Utils.logger('info', `[补丁-劫持] 跳过：已包含cursor: ${originalUrl}`);
                    return originalUrl;
                }

                Utils.logger('info', `[补丁-劫持] 命中主内容初始请求: ${originalUrl}`);
                // 注入cursor参数
                const fullUrl = new URL(originalUrl, window.location.origin);
                fullUrl.searchParams.set('cursor', State.savedCursor);
                const modifiedUrl = fullUrl.pathname + fullUrl.search;
                Utils.logger('info', `[补丁-劫持] 注入cursor后URL: ${modifiedUrl}`);
                return modifiedUrl;
            };

            // --- 补丁 #1: XMLHttpRequest ---
            Utils.logger('info', '[补丁] 正在为 XMLHttpRequest 打补丁...');
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                let modifiedUrl = url;
                if (typeof url === 'string' && url.includes('/i/listings/search') && method.toUpperCase() === 'GET') {
                    const originalUrl = url;
                    modifiedUrl = getModifiedUrl(url);
                    if (modifiedUrl !== originalUrl) {
                        Utils.logger('info', `[补丁-XHR] open() 劫持成功: 原始URL: ${originalUrl} -> 新URL: ${modifiedUrl}`);
                    } else {
                        Utils.logger('info', `[补丁-XHR] open() 未劫持: ${originalUrl}`);
                    }
                }
                this._url = modifiedUrl; // 存储修改后(或原始)的URL供后续使用
                return originalXhrOpen.apply(this, [method, modifiedUrl, ...args]);
            };

            const originalXhrSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(...args) {
                const xhr = this;
                const originalOnReadyStateChange = xhr.onreadystatechange;
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200 && typeof xhr._url === 'string' && xhr._url.includes('/i/listings/search')) {
                        Utils.logger('info', `[补丁-XHR] onreadystatechange 捕获: ${xhr._url}`);
                        saveNextUrlFromResponse(xhr.responseText);
                    }
                    if (originalOnReadyStateChange) {
                        return originalOnReadyStateChange.apply(this, arguments);
                    }
                };
                return originalXhrSend.apply(this, args);
            };

            // --- 补丁 #2: Fetch API ---
            Utils.logger('info', '[补丁] 正在为 Fetch API 打补丁...');
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
                let url = (typeof input === 'string') ? input : input.url;
                let modifiedInput = input;

                if (url.includes('/i/listings/search')) {
                    const originalUrl = url;
                    const modifiedUrl = getModifiedUrl(url);
                    if (modifiedUrl !== originalUrl) {
                        Utils.logger('info', `[补丁-Fetch] fetch() 劫持成功: 原始URL: ${originalUrl} -> 新URL: ${modifiedUrl}`);
                        if (typeof input === 'string') {
                            modifiedInput = modifiedUrl;
                        } else {
                            // Request 对象是不可变的, 必须创建一个新的
                            modifiedInput = new Request(modifiedUrl, input);
                        }
                    } else {
                        Utils.logger('info', `[补丁-Fetch] fetch() 未劫持: ${originalUrl}`);
                    }
                }
                
                return originalFetch.apply(this, [modifiedInput, init]).then(response => {
                    if (response.ok && response.url.includes('/i/listings/search')) {
                        Utils.logger('info', `[补丁-Fetch] Response 捕获: ${response.url}`);
                        // 克隆响应体，因为他只能被读取一次
                        const responseClone = response.clone();
                        responseClone.text().then(text => {
                            saveNextUrlFromResponse(text);
                        });
                    }
                    return response; // 将原始响应返回给调用者
                });
            };
        }
    };


    // --- 模块七: 任务运行器与事件处理 (Task Runner & Event Handlers) ---
    const TaskRunner = {
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
            } else {
                // If it's not running, scan the current page and start.
                const cards = document.querySelectorAll(Config.SELECTORS.card);
                const newlyAddedList = [];
                let alreadyInQueueCount = 0;
                let ownedCount = 0;

                cards.forEach(card => {
                    const link = card.querySelector(Config.SELECTORS.cardLink);
                    const url = link ? link.href.split('?')[0] : null;
                    if (!url) return;

                    // Check if visibly owned, in the DB, or completed this session
                    const cardText = card.textContent || '';
                    const isVisiblyOwned = [...Config.SAVED_TEXT_SET].some(s => cardText.includes(s));
                    const isOwned = isVisiblyOwned || Database.isDone(url) || State.sessionCompleted.has(url);
                    if (isOwned) {
                        ownedCount++;
                        return;
                    }

                    // Check if already in todo or failed lists
                    const isTodo = Database.isTodo(url);
                    const isFailed = State.db.failed.some(t => t.url && t.url.startsWith(url));
                    if (isTodo || isFailed) {
                        alreadyInQueueCount++;
                        return;
                    }

                    const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || 'Untitled';
                    newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
                });

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
                     Utils.logger('info', `本页没有可领取的新商品 (已拥有: ${ownedCount} 个)。`);
            }
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
            const API_ENDPOINT = 'https://www.fab.com/i/users/me/listings-states';
            const CARD_SELECTOR = 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root';
            const LINK_SELECTOR = 'a[href*="/listings/"]';
            const CSRF_COOKIE_NAME = 'fab_csrftoken';

            // Selectors for the part of the card that shows the price/owned status
            const FREE_STATUS_SELECTOR = '.csZFzinF'; // The container for the "免费" text
            const OWNED_STATUS_SELECTOR = '.cUUvxo_s'; // The container for the "已保存..." text

            Utils.logger('info', '[Fab DOM Refresh] Starting for VISIBLE items...');

            // --- DOM Creation Helpers ---
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

            // --- Main Logic ---
            try {
                const csrfToken = Utils.getCookie(CSRF_COOKIE_NAME);
                if (!csrfToken) throw new Error('CSRF token not found. Are you logged in?');

                const visibleCards = [...document.querySelectorAll(CARD_SELECTOR)].filter(isElementInViewport);
                const uidToCardMap = new Map();

                visibleCards.forEach(card => {
                    const link = card.querySelector(LINK_SELECTOR);
                    if (link) {
                        const match = link.href.match(/listings\/([a-f0-9-]+)/);
                        if (match && match[1]) uidToCardMap.set(match[1], card);
                    }
                });

                const uidsToQuery = [...uidToCardMap.keys()];
                if (uidsToQuery.length === 0) {
                    Utils.logger('info', '[Fab DOM Refresh] No visible items to check.');
                    return;
                }
                Utils.logger('info', `[Fab DOM Refresh] Found ${uidsToQuery.length} visible items. Querying API...`);

                const apiUrl = new URL(API_ENDPOINT);
                uidsToQuery.forEach(uid => apiUrl.searchParams.append('listing_ids', uid));

                // Use fetch directly as it's a simple GET request with standard headers.
                const response = await fetch(apiUrl.href, {
                    headers: { 'accept': 'application/json, text/plain, */*', 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                });

                if (!response.ok) throw new Error(`API request failed with status: ${response.status}`);
                const data = await response.json();

                const ownedUids = new Set(data.filter(item => item.acquired).map(item => item.uid));
                Utils.logger('info', `[Fab DOM Refresh] API reports ${ownedUids.size} owned items in this batch.`);

                let updatedCount = 0;
                uidToCardMap.forEach((card, uid) => {
                    const isOwned = ownedUids.has(uid);

                    if (isOwned) {
                        const freeElement = card.querySelector(FREE_STATUS_SELECTOR);
                        if (freeElement) { // If it currently shows "Free", replace it.
                            freeElement.replaceWith(createOwnedElement());
                            updatedCount++;
                        }
                    } else { // Item is not owned
                        const ownedElement = card.querySelector(OWNED_STATUS_SELECTOR);
                        if (ownedElement) { // If it currently shows "Owned", replace it.
                            ownedElement.replaceWith(createFreeElement());
                            updatedCount++;
                        }
                    }
                });

                Utils.logger('info', `[Fab DOM Refresh] Complete. Updated ${updatedCount} card states.`);

                // 刷新后自动执行隐藏/显示逻辑，保证 UI 实时同步
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

        runHideOrShow: () => {
            State.hiddenThisPageCount = 0;
            document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
                const text = card.textContent || '';
                const link = card.querySelector(Config.SELECTORS.cardLink);
                if (!link) return;
                const url = link.href.split('?')[0];

                // 检查是否由网站原生标记为已保存
                const isNativelySaved = [...Config.SAVED_TEXT_SET].some(s => text.includes(s));
                const isFailed = Database.isFailed(url);
                const isDone = Database.isDone(url);

                // 如果设置为隐藏已保存项目，并且项目是已保存的或在本次会话中完成的
                if (State.hideSaved && (isNativelySaved || isDone || isFailed)) {
                    card.style.display = 'none';
                    State.hiddenThisPageCount++;
                } else {
                    card.style.display = '';
                }
            });
            UI.update();
        },

        scanAndAddTasks: (cards) => {
            const newlyAddedList = [];
            let alreadyInQueueCount = 0;
            let ownedCount = 0;

            cards.forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const url = link ? link.href.split('?')[0] : null;
                if (!url) return;

                // Check if visibly owned, in the DB, or completed this session
                const cardText = card.textContent || '';
                const isVisiblyOwned = [...Config.SAVED_TEXT_SET].some(s => cardText.includes(s));
                const isOwned = isVisiblyOwned || Database.isDone(url) || State.sessionCompleted.has(url);
                if (isOwned) {
                    ownedCount++;
                    return;
                }

                // Check if already in todo or failed lists
                const isTodo = Database.isTodo(url);
                const isFailed = State.db.failed.some(t => t.url && t.url.startsWith(url));
                if (isTodo || isFailed) {
                    alreadyInQueueCount++;
                    return;
                }

                const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || 'Untitled';
                newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
            });

            if (newlyAddedList.length > 0) {
                State.db.todo.push(...newlyAddedList);
                Utils.logger('info', `[自动添加] 新增 ${newlyAddedList.length} 个任务到队列。`);
                // If execution is running, we need to update the total task count
                if (State.isExecuting) {
                    State.executionTotalTasks += newlyAddedList.length;
                    UI.update();
                }
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
                 if (urlParams.has('workerId')) return;

                Utils.logger('info', "On a detail page (detected by action buttons), skipping UI creation.");
                return;
            }

            if (document.getElementById(Config.UI_CONTAINER_ID)) return;

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
                }
                .fab-helper-tabs button.active {
                    color: var(--text-color-primary);
                    border-bottom: 2px solid var(--blue);
                }
                .fab-helper-tab-content {
                    padding: 12px;
                }
                .fab-helper-status-bar {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                    margin-bottom: 12px;
                }
                .fab-helper-status-item {
                    background: var(--dark-gray);
                    padding: 8px;
                    border-radius: var(--radius-m);
                    font-size: 11px;
                    text-align: center;
                    color: var(--text-color-secondary);
                }
                .fab-helper-status-item span {
                    display: block;
                    font-size: 18px;
                    font-weight: 600;
                    color: #fff;
                    margin-top: 2px;
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
                }
                .fab-helper-execute-btn.executing {
                    background: var(--pink);
                }
                .fab-helper-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .fab-helper-actions button {
                    background: var(--dark-gray);
                    border: none;
                    border-radius: var(--radius-m);
                    color: var(--text-color-primary);
                    padding: 8px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .fab-helper-actions button:hover {
                    background: #4a4a4c;
                }
                .fab-log-container {
                    padding: 0 12px 12px 12px;
                    border-top: 1px solid var(--border-color);
                    margin-top: 12px;
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
                item.innerHTML = `${icon} ${label}<span id="${id}">0</span>`;
                return item;
            };
            State.UI.statusTodo = createStatusItem('fab-status-todo', Utils.getText('todo'), '📥');
            State.UI.statusDone = createStatusItem('fab-status-done', Utils.getText('added'), '✅');
            State.UI.statusFailed = createStatusItem('fab-status-failed', Utils.getText('failed'), '❌');
            State.UI.statusHidden = createStatusItem('fab-status-hidden', Utils.getText('hidden'), '🙈');
            statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed, State.UI.statusHidden);

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
            dashboardContent.append(statusBar, State.UI.execBtn, actionButtons);

            // --- Log Panel (moved to Dashboard) ---
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
            dashboardContent.appendChild(logContainer); // Append log to dashboard

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

            State.UI.tabContents.settings = settingsContent;
            container.appendChild(settingsContent);

            // --- Debug Tab (Log Panel) ---
            const debugContent = document.createElement('div');
            debugContent.className = 'fab-helper-tab-content';
            debugContent.innerHTML = '<p style="text-align: center; color: var(--text-color-secondary); padding: 20px;">此标签页用于未来的高级调试功能。</p>';
            State.UI.tabContents.debug = debugContent;
            container.appendChild(debugContent);

            document.body.appendChild(container);

            UI.switchTab('dashboard'); // Set initial tab
            UI.update();
        },

        switchTab: (tabNameToActivate) => {
            for (const tabName in State.UI.tabs) {
                const isActive = tabName === tabNameToActivate;
                State.UI.tabs[tabName].classList.toggle('active', isActive);
                State.UI.tabContents[tabName].style.display = isActive ? 'block' : 'none';
            }
        },

        update: () => {
            if (!State.UI.container) return;

            // Status Bar
            State.UI.container.querySelector('#fab-status-todo').textContent = State.db.todo.length;
            State.UI.container.querySelector('#fab-status-done').textContent = State.db.done.length;
            State.UI.container.querySelector('#fab-status-failed').textContent = State.db.failed.length;
            State.UI.container.querySelector('#fab-status-hidden').textContent = State.hiddenThisPageCount;

            // NEW: Progress Bar
            // This is removed for the new UI, can be re-added later if needed.

            // Execute Button
            const execText = State.isExecuting ? `🛑 ${Utils.getText('stopExecute')}` : `+ ${Utils.getText('execute')}`;
            State.UI.execBtn.innerHTML = execText;
            State.UI.execBtn.classList.toggle('executing', State.isExecuting);
            State.UI.execBtn.classList.remove('fab-helper-pulse');
            if (!State.isExecuting && State.db.todo.length > 0) {
                State.UI.execBtn.classList.add('fab-helper-pulse');
            }

            // Sync Button
            State.UI.syncBtn.disabled = State.isExecuting;


            // Hide/Show Button
            const hideText = State.hideSaved ? `👀 ${Utils.getText('show')}` : `🙈 ${Utils.getText('hide')}`;
            State.UI.hideBtn.innerHTML = hideText;

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
            if (type === 'owned' || State.sessionCompleted.has(url)) {
                styles.color='#4caf50';  // 绿色
                overlay.innerHTML='✅';   // 勾选标记
            }
            else if (type === 'queued' && Database.isTodo(url)) {
                styles.color='#ff9800';  // 橙色
                overlay.innerHTML='⏳';   // 等待标记
            }
            else if (type === 'failed') {
                styles.color='#f44336'; // 红色
                overlay.innerHTML='❌';  // 失败标记
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
                const existingOverlay = card.querySelector('.fab-helper-overlay-v8');

                // 如果原生就显示已拥有，确保移除我们的覆盖层
                if (isNativelyOwned) {
                    if(existingOverlay) existingOverlay.remove();
                    return;
                }

                // 根据状态应用不同的覆盖层
                if (State.sessionCompleted.has(url) || Database.isDone(url)) {
                    UI.applyOverlay(card, 'owned');
                } else if (Database.isTodo(url)) {
                    UI.applyOverlay(card, 'queued');
                } else if (Database.isFailed(url)) {
                    UI.applyOverlay(card, 'failed');
                } else {
                    // 如果没有任何状态，确保移除覆盖层
                    if(existingOverlay) existingOverlay.remove();
                }
            });
        },

        toggleLogPanel: () => {
            // This is now handled by tab switching, so this function is obsolete.
        },

        setupOwnershipObserver: (card) => {
            const checkHide=()=>{
                const text=card.textContent||'';
                if(State.hideSaved && [...Config.SAVED_TEXT_SET].some(s=>text.includes(s))){card.style.display='none';UI.update();return true;} return false;
            };
            if (checkHide()) return;

            // 获取卡片的 URL
            const link = card.querySelector(Config.SELECTORS.cardLink);
            if (!link) return;
            const url = link.href.split('?')[0];

            const obs = new MutationObserver((mutations) => {
                // 检查文本变化，判断是否商品已被拥有
                if ([...Config.SAVED_TEXT_SET].some(s => card.textContent.includes(s))) {
                    // 如果检测到"已保存"文本，将该 URL 添加到会话完成集合中
                    State.sessionCompleted.add(url);

                    // 更新 UI 显示（隐藏卡片或应用覆盖层）
                    if (State.hideSaved) {
                        card.style.display = 'none';
                        State.hiddenThisPageCount++;
                        UI.update();
                    } else {
                        UI.applyOverlay(card, 'owned');
                    }

                    // 断开观察器连接，不再需要监听
                    obs.disconnect();
                }
            });

            // 监听卡片的文本变化
            obs.observe(card, {childList: true, subtree: true, characterData: true});

            // 设置超时，确保不会无限期监听
            setTimeout(() => obs.disconnect(), 10000);
        },
    };


    // --- 模块九: 主程序与初始化 (Main & Initialization) ---
    async function main() {
        if (State.isInitialized) return;
        State.isInitialized = true;

        Utils.detectLanguage();
        await Database.load(); // 先加载所有 State.xxx

        if (State.rememberScrollPosition) {
            State.savedCursor = await GM_getValue(Config.DB_KEYS.LAST_CURSOR, null);
            Utils.logger('info', `[位置] 读取到已保存的cursor: ${State.savedCursor || '无'}`);
        }

        // 现在再初始化补丁，保证能正确判断 State.rememberScrollPosition
        MonkeyPatcher.init();

        // 由于脚本在 document-start 运行，UI 相关的操作必须等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runDomDependentPart);
        } else {
            runDomDependentPart();
        }
    }

    // 将所有依赖 DOM 的操作移到这里
    function runDomDependentPart() {
        // The new, correct worker detection logic.
        // We check if a workerId is present in the URL. If so, it's a worker tab.
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('workerId')) {
            // This is a worker tab. Its only job is to process the page and then close.
            TaskRunner.processDetailPage();
            return; // IMPORTANT: Stop all further script execution for this worker tab.
        }

        // --- Standard page setup (runs only for the main, non-worker tab) ---
        // The UI.create() function now internally checks if it should run,
        // so we can call it unconditionally here.
        UI.create();

        // The rest of the setup only makes sense if the UI was actually created.
        if (!State.UI.container) {
             Utils.logger('info', 'UI container not found, skipping remaining setup for this page.');
             return;
        }

        UI.applyOverlaysToPage();
        TaskRunner.runHideOrShow(); // Initial run

        Utils.logger('info', Utils.getText('log_init'));

        // Attach listeners and observers
        const mainObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    let newCardNodes = [];
                    mutation.addedNodes.forEach(node => {
                        // We only care about element nodes
                        if (node.nodeType === 1) {
                            // Check if the added node itself is a card
                            if (node.matches(Config.SELECTORS.card)) {
                                UI.setupOwnershipObserver(node);
                                newCardNodes.push(node);
                            }

                            // Check if the added node contains new cards (e.g., a container was added)
                            const newCardsInside = node.querySelectorAll(Config.SELECTORS.card);
                            if (newCardsInside.length > 0) {
                                newCardsInside.forEach(c => {
                                    UI.setupOwnershipObserver(c);
                                    newCardNodes.push(c);
                                });
                            }
                        }
                    });

                    if (newCardNodes.length > 0) {
                        // Always run visual updates for new cards
                                UI.applyOverlaysToPage();
                                TaskRunner.runHideOrShow();

                        // Conditionally scan for tasks if auto-add is on
                        if (State.isExecuting && State.autoAddOnScroll) {
                            TaskRunner.scanAndAddTasks(newCardNodes);
                            }
                        }
                }
            }
        });

        mainObserver.observe(document.body, { childList: true, subtree: true });

        // Listen for changes from other tabs
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.DONE, (name, old_value, new_value) => {
            State.db.done = new_value;
            UI.update();
            UI.applyOverlaysToPage();
            TaskRunner.runHideOrShow();
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
            UI.applyOverlaysToPage();
            TaskRunner.runHideOrShow();
        }));
        // This listener is obsolete as the API-driven recon is removed.
        // State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.TASK, ...));

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
                    // Phase15: Track successfully completed tasks in the current session
                    if (task && task.url) {
                        State.sessionCompleted.add(task.url.split('?')[0]); // Add the clean URL to sessionCompleted
                    }
                } else {
                    State.executionFailedTasks++;
                }

                State.activeWorkers--;
                delete State.runningWorkers[workerId];
                // This log now makes more sense as it comes AFTER the detailed log report.
                Utils.logger('info', `Worker [${workerId.substring(0,12)}] has finished. Active: ${State.activeWorkers}.`);

                // Explicitly update UI to show progress immediately
                UI.update();
                // We must update overlays and hide/show logic after a worker finishes
                UI.applyOverlaysToPage();
                TaskRunner.runHideOrShow();


                TaskRunner.executeBatch();
            }
        }));

        // The old TASK listener is now obsolete and will be removed.
        const oldTaskListener = State.valueChangeListeners.find(l => l.key === Config.DB_KEYS.TASK);
        if (oldTaskListener) {
            GM_removeValueChangeListener(oldTaskListener.id);
            State.valueChangeListeners = State.valueChangeListeners.filter(l => l.key !== Config.DB_KEYS.TASK);
        }
    }

    // --- Script Entry Point ---
    // This is the final, robust, SPA-and-infinite-scroll-aware entry point.
    // DEPRECATED SPA navigation handler, main() is now the entry point.
    /*
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
    */

    // Initial run when the script is first injected.
    main();

})();