// ==UserScript==
// @name         Fab API-Driven Helper
// @name:en      Fab API-Driven Helper
// @name:zh      Fab API 驱动助手
// @namespace    http://tampermonkey.net/
// @version      1.0.0
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
        SCRIPT_NAME: '[Fab API-Driven Helper v1.0.0]',
        DB_VERSION: 3,
        DB_NAME: 'fab_helper_db',
        MAX_WORKERS: 3, // Maximum number of concurrent worker tabs
        UI_CONTAINER_ID: 'fab-helper-container-v8',
        UI_LOG_ID: 'fab-helper-log-v8',
        DB_KEYS: {
            TODO: 'fab_todoList_v8',
            DONE: 'fab_doneList_v8',
            FAILED: 'fab_failedList_v8', // For items that failed processing
            HIDE: 'fab_hideSaved_v8',
            TASK: 'fab_currentTask_v8', // Legacy, will be phased out
            NEXT_URL: 'fab_reconNextUrl_v8', // REPLACES CURSOR
            DETAIL_LOG: 'fab_detailLog_v8', // For worker tab remote logging
            WORKER_DONE: 'fab_worker_done_v8', // New key for worker completion status
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
            buttonTexts: ['在我的库中查看', 'View in My Library']
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
        showAdvanced: false,
        activeWorkers: 0, // Count of currently active worker tabs
        hiddenThisPageCount: 0,
        totalTasks: 0,
        completedTasks: 0,
        watchdogTimer: null,
        // UI-related state
        UI: {
            container: null,
            logPanel: null,
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
        },
        valueChangeListeners: []
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
            State.db.todo = await GM_getValue(Config.DB_KEYS.TODO, []);
            State.db.done = await GM_getValue(Config.DB_KEYS.DONE, []);
            State.db.failed = await GM_getValue(Config.DB_KEYS.FAILED, []);
            State.hideSaved = await GM_getValue(Config.DB_KEYS.HIDE, false);
            Utils.logger('info', Utils.getText('log_db_loaded'), `To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
        },
        saveTodo: () => GM_setValue(Config.DB_KEYS.TODO, State.db.todo),
        saveDone: () => GM_setValue(Config.DB_KEYS.DONE, State.db.done),
        saveFailed: () => GM_setValue(Config.DB_KEYS.FAILED, State.db.failed),
        saveHidePref: () => GM_setValue(Config.DB_KEYS.HIDE, State.hideSaved),

        resetAllData: async () => {
            if (window.confirm('您确定要清空所有本地存储的脚本数据（待办、已完成、失败列表）吗？此操作不可逆！')) {
                await GM_deleteValue(Config.DB_KEYS.TODO);
                await GM_deleteValue(Config.DB_KEYS.DONE);
                await GM_deleteValue(Config.DB_KEYS.FAILED);
                State.db.todo = [];
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
            
            let changed = State.db.todo.length < initialTodoCount;

            // The 'done' list can still use URLs for simplicity, as it's for display/hiding.
            const cleanUrl = task.url.split('?')[0];
            if (!Database.isDone(cleanUrl)) {
                State.db.done.push(cleanUrl);
                changed = true;
            }

            if (changed) {
                await Promise.all([Database.saveTodo(), Database.saveDone()]);
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
                await Promise.all([Database.saveTodo(), Database.saveFailed()]);
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
            if (State.isExecuting) {
                Utils.logger('info', '执行器已在运行中，新任务已加入队列等待处理。');
                return;
            }
                if (State.db.todo.length === 0) {
                Utils.logger('info', '"待办"清单是空的，无需启动。');
                    return;
                }
            Utils.logger('info', '队列中有任务，即将开始执行...');
            State.isExecuting = true;
            UI.update();
                TaskRunner.executeBatch();
        },

        // This function is for the main UI button to toggle start/stop.
        toggleExecution: () => {
            if (State.isExecuting) {
                State.isExecuting = false;
                GM_deleteValue(Config.DB_KEYS.TASK); // Stop all workers
                Utils.logger('info', '执行已由用户手动停止。');
            } else {
                TaskRunner.startExecution();
            }
            UI.update();
        },
        toggleHideSaved: async () => {
            State.hideSaved = !State.hideSaved;
            await Database.saveHidePref();
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
            await Promise.all([Database.saveTodo(), Database.saveFailed()]);
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
                        if (priceInfo && priceInfo.price === 0) {
                            const task = { 
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
                        await Database.saveTodo();
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

        executeBatch: async () => {
            if (!State.isExecuting) return;

            // This is the dispatcher loop. It will keep dispatching workers
            // as long as there are tasks and available worker slots.
            while (State.activeWorkers < Config.MAX_WORKERS && State.db.todo.length > 0) {
                const task = State.db.todo.shift(); // Take a task from the queue
                State.activeWorkers++;
                
                // A unique ID for this worker instance.
                const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                Utils.logger('info', `🚀 Dispatching Worker [${workerId.substring(0, 12)}...] for: ${task.name}`);
                
                // The worker will find its task using this unique ID.
                await GM_setValue(workerId, { task });

                // Pass the workerId in the URL so the worker tab knows who it is.
                const workerUrl = new URL(task.url);
                workerUrl.searchParams.set('workerId', workerId);
                GM_openInTab(workerUrl.href, { active: false, setParent: true });
            }
            UI.update(); // Update the UI to reflect the new state of the queue and workers

            // Check for completion of the entire batch.
            if (State.db.todo.length === 0 && State.activeWorkers === 0 && State.isExecuting) {
                Utils.logger('info', '✅ 🎉 All batch tasks have been completed!');
                State.isExecuting = false;
                if (State.watchdogTimer) clearTimeout(State.watchdogTimer);
                UI.update();
            }
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
                // This entire block is the acquisition logic, moved from the old sequential version.
                
                // --- API-First Ownership Check ---
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

                // If API check was successful, we can skip the entire UI interaction block.
                if (!success) {
                    const isItemOwned = () => {
                        const criteria = Config.OWNED_SUCCESS_CRITERIA;
                        const snackbar = document.querySelector('.fabkit-Snackbar-root');
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
                }
            } catch (error) {
                // The main try-catch for the entire acquisition process.
                if (!success) { // Don't log error if we succeeded (e.g. via API)
                    logBuffer.push(`Acquisition FAILED. Error: ${error.message}`);
                    success = false;
                }
            } finally {
                // --- This is the worker's teardown process ---
                if (success) {
                    await Database.markAsDone(currentTask);
                    logBuffer.push(`✅ Task marked as DONE.`);
                } else {
                    await Database.markAsFailed(currentTask);
                    logBuffer.push(`❌ Task marked as FAILED.`);
                }
                
                await GM_setValue(Config.DB_KEYS.DETAIL_LOG, logBuffer);
                await GM_setValue(Config.DB_KEYS.WORKER_DONE, { workerId: workerId });
                await GM_deleteValue(workerId);
                window.close();
            }
        },

        // This function is now obsolete as its logic is handled by the worker's finally block.
        advanceDetailTask: async () => {},

        runHideOrShow: () => {
            State.hiddenThisPageCount = 0;
            document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const text = card.textContent || '';
                const isNativelySaved = [...Config.SAVED_TEXT_SET].some(s => text.includes(s));
                const isScriptSaved = link && Database.isDone(link.href);
                if (isNativelySaved || isScriptSaved) {
                    card.style.display = State.hideSaved ? 'none' : '';
                    if(State.hideSaved) State.hiddenThisPageCount++;
                }
            });
            UI.update();
        },
    };


    // --- 模块八: 用户界面 (User Interface) ---
    const UI = {
        create: () => {
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
            `;
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = styles;
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

            // -- Log Panel --
            State.UI.logPanel = document.createElement('div');
            State.UI.logPanel.id = 'fab-log-panel';
            State.UI.logPanel.style.cssText = `
  background: rgba(30,30,30,0.85);
  color: #eee;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px 6px 8px 8px;
  border-radius: 8px;
  margin: 8px 0;
  max-height: 40vh;
  overflow-y: auto;
  min-height: 40px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column-reverse;
`;

            // -- Basic Section --
            const basicSection = document.createElement('div');
            basicSection.className = 'fab-helper-btn-section';
            const basicTitle = document.createElement('div');
            basicTitle.className = 'fab-helper-section-title';
            basicTitle.textContent = '🧩 基础功能 (Basic)';
            // 本页一键领取
            const addAllBtn = document.createElement('button');
            addAllBtn.innerHTML = '🛒 本页一键领取';
            addAllBtn.style.background = 'var(--green)';
            addAllBtn.onclick = () => {
                const cards = document.querySelectorAll(Config.SELECTORS.card);
                const newlyAddedList = [];
                let alreadyInQueueCount = 0;
                let ownedCount = 0;

                cards.forEach(card => {
                    const link = card.querySelector(Config.SELECTORS.cardLink);
                    const url = link ? link.href.split('?')[0] : null;
                    if (!url) return;

                    // Final, Correct Logic:
                    // 1. Check ownership first (DB source of truth).
                    const isOwned = Database.isDone(url);
                    if (isOwned) {
                        ownedCount++;
                        return;
                    }

                    // 2. If not owned, check if it's already in any queue.
                    const isTodo = Database.isTodo(url);
                    const isFailed = State.db.failed.some(t => t.url.startsWith(url));
                    if (isTodo || isFailed) {
                        alreadyInQueueCount++;
                        return;
                    }
                    
                    // 3. If not owned and not in a queue, it's a new, valid task.
                    newlyAddedList.push({ url, type: 'detail', uid: url.split('/').pop() });
                });

                const actionableCount = newlyAddedList.length + alreadyInQueueCount;

                if (newlyAddedList.length > 0) {
                    State.db.todo.push(...newlyAddedList);
                    Database.saveTodo();
                    Utils.logger('info', `已将 ${newlyAddedList.length} 个新商品加入待办队列。`);
                }
                
                if (actionableCount > 0) {
                    if (newlyAddedList.length === 0) {
                        Utils.logger('info', `本页的 ${actionableCount} 个可领取商品已全部在待办队列中。`);
                    }
                    TaskRunner.startExecution();
                    } else {
                    Utils.logger('info', `本页没有可领取的新商品 (已拥有: ${ownedCount} 个)。`);
                }
            };
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
            basicSection.append(basicTitle, addAllBtn, refreshPageBtn, State.UI.hideBtn);

            // -- Divider --
            const divider = document.createElement('hr');
            divider.className = 'fab-helper-divider';

            // -- Advanced Section --
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
            State.UI.execBtn = document.createElement('button');
            State.UI.execBtn.innerHTML = '�� 批量领取';
            State.UI.execBtn.style.background = 'var(--pink)';
            State.UI.execBtn.onclick = TaskRunner.toggleExecution;
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
            advSection.append(advTitle, State.UI.reconBtn, State.UI.execBtn, State.UI.retryBtn, State.UI.refreshBtn, State.UI.resetReconBtn, resetDataBtn);

            // -- Advanced Wrapper (状态栏+高级区) --
            const advancedWrapper = document.createElement('div');
            advancedWrapper.style.display = 'none'; // 默认隐藏
            advancedWrapper.append(statusBar, divider, advSection);

            // -- Assemble UI --
            container.append(header, State.UI.logPanel, basicSection, advancedWrapper);
            document.body.appendChild(container);
            State.UI.container = container;

            // --- Console Commands (Fix using unsafeWindow) ---
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
            
            // Execute Button
            State.UI.execBtn.innerHTML = State.isExecuting ? `🛑 ${Utils.getText('stopExecute')}` : `🚀 ${Utils.getText('execute')}`;
            State.UI.execBtn.style.background = State.isExecuting ? 'var(--pink)' : 'var(--pink)';
            
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

            // Reset Recon Button
            State.UI.resetReconBtn.innerHTML = `⏮️ ${Utils.getText('resetRecon')}`;
            State.UI.resetReconBtn.disabled = State.isExecuting || State.isReconning;
            State.UI.resetReconBtn.style.background = 'var(--gray)';
        },

        applyOverlay: (card, type = 'owned') => {
            // Always remove existing overlay to reflect the latest state.
            const existingOverlay = card.querySelector('.fab-helper-overlay-v8');
            if (existingOverlay) existingOverlay.remove();

            // If the page natively shows it's owned, our job is done. Don't add any icon.
            const isNativelyOwned = card.textContent.includes('已保存在我的库中') || card.textContent.includes('Saved in My Library');
            if (isNativelyOwned) {
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'fab-helper-overlay-v8';
            
            const styles = {
                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                background: 'rgba(25, 25, 25, 0.6)', zIndex: '10', display: 'flex',
                justifyContent: 'center', alignItems: 'center', fontSize: '24px',
                fontWeight: 'bold', backdropFilter: 'blur(2px)', borderRadius: 'inherit'
            };

            if (type === 'owned') {
                styles.color = '#4caf50'; // Green
            overlay.innerHTML = '✅';
            } else if (type === 'queued') {
                styles.color = '#ff9800'; // Orange
                overlay.innerHTML = '⏳';
            }

            Object.assign(overlay.style, styles);

            const thumbnail = card.querySelector('.fabkit-Thumbnail-root, .AssetCard-thumbnail');
            if (thumbnail) {
                if (getComputedStyle(thumbnail).position === 'static') {
                    thumbnail.style.position = 'relative';
                }
                thumbnail.appendChild(overlay);
            }
        },

        removeAllOverlays: () => {
            document.querySelectorAll('.fab-helper-overlay-v8').forEach(overlay => overlay.remove());
        },

        applyOverlaysToPage: () => {
            document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                if (link) {
                    const url = link.href.split('?')[0];
                    const isNativelyOwned = card.textContent.includes('已保存在我的库中') || card.textContent.includes('Saved in My Library');

                    // If the page says it's owned, we trust it. Clean up any of our overlays.
                    if (isNativelyOwned) {
                        const existingOverlay = card.querySelector('.fab-helper-overlay-v8');
                        if (existingOverlay) existingOverlay.remove();
                        return;
                    }

                    // If the page does NOT say it's owned, then we apply our own state icons.
                    if (Database.isDone(url)) {
                        UI.applyOverlay(card, 'owned');
                    } else if (Database.isTodo(url)) {
                        UI.applyOverlay(card, 'queued');
                    } else {
                        // If it's not in any of our lists, ensure no overlay is present.
                        const existingOverlay = card.querySelector('.fab-helper-overlay-v8');
                        if (existingOverlay) existingOverlay.remove();
                    }
                }
            });
        }
    };


    // --- 模块九: 主程序与初始化 (Main & Initialization) ---
    async function main() {
        if (State.isInitialized) return;
        State.isInitialized = true;

        Utils.detectLanguage();
        // Initialize the network filter as early as possible, per Rule #6.
        NetworkFilter.init();
        await Database.load();

        // Stricter check to see if this tab is a "worker" tab.
        // It must be a listings page, have an active task payload, AND its URL must be in the batch.
        const activeTask = await GM_getValue(Config.DB_KEYS.TASK);
        if (activeTask && window.location.href.includes('/listings/')) {
            const currentCleanUrl = window.location.href.split('?')[0];
            const isLegitWorker = activeTask.batch.some(task => task.url === currentCleanUrl);

            if (isLegitWorker) {
                TaskRunner.processDetailPage();
                return; // This tab's only job is to run the detail task.
            }
        }

        // --- Standard page setup ---
        UI.create();

        // NEW: Immediately reflect saved recon progress in the UI on load.
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
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        // We only care about element nodes
                        if (node.nodeType === 1) {
                            // Check if the added node itself is a card
                            if (node.matches(Config.SELECTORS.card)) {
                                const link = node.querySelector(Config.SELECTORS.cardLink);
                                if (link && Database.isDone(link.href)) {
                                    UI.applyOverlay(node, 'owned');
                                } else if (link && Database.isTodo(link.href)) {
                                    UI.applyOverlay(node, 'queued');
                                }
                                TaskRunner.runHideOrShow(); // Run hide/show logic which is relatively fast
                            }
                            
                            // Check if the added node contains new cards (e.g., a container was added)
                            const newCards = node.querySelectorAll(Config.SELECTORS.card);
                            if (newCards.length > 0) {
                                UI.applyOverlaysToPage();
                                TaskRunner.runHideOrShow();
                            }
                        }
                    });
                }
            }
        });
        
        mainObserver.observe(document.body, { childList: true, subtree: true });

        // Listen for changes from other tabs
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.DONE, (name, old_value, new_value) => {
            State.db.done = new_value;
            UI.update();
            UI.applyOverlaysToPage();
        }));
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.TODO, (name, old_value, new_value) => {
            State.db.todo = new_value;
            UI.applyOverlaysToPage();
            UI.update();
        }));
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
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.DETAIL_LOG, (name, old_value, new_value) => {
            if (new_value && Array.isArray(new_value) && new_value.length > 0) {
                Utils.logger('info', '--- Log Report from Worker Tab ---');
                new_value.forEach(logMsg => {
                    const logType = logMsg.includes('FAIL') ? 'error' : 'info';
                    Utils.logger(logType, logMsg);
                });
                Utils.logger('info', '--- End Log Report ---');
                GM_deleteValue(Config.DB_KEYS.DETAIL_LOG); // Clean up after reading
            }
        }));
        
        window.addEventListener('beforeunload', () => {
            State.valueChangeListeners.forEach(id => GM_removeValueChangeListener(id));
        });

        // --- Event Listeners ---
        // This listener handles the completion signal from any worker tab.
        State.valueChangeListeners.push(
            GM_addValueChangeListener(Config.DB_KEYS.WORKER_DONE, (key, oldValue, newValue) => {
                if (!newValue || !newValue.workerId) return;
                
                State.activeWorkers--;
                Utils.logger('info', `✅ Worker [${newValue.workerId.substring(0,12)}] finished. Active: ${State.activeWorkers}`);
                
                // Immediately try to dispatch a new worker.
                TaskRunner.executeBatch();
            })
        );
    }

    // --- Script Entry Point ---
    function runWhenReady() {
        const readyInterval = setInterval(() => {
            if (document.body && document.querySelector(Config.SELECTORS.rootElement)) {
                clearInterval(readyInterval);
                main();
                // guardian(); // Guardian can be added back later
            }
        }, 200);
        setTimeout(() => {
            if (!State.isInitialized) {
                clearInterval(readyInterval);
                Utils.logger('warn', 'Initialization timed out.');
            }
        }, 20000);
    }

    runWhenReady();

})(); 