// ==UserScript==
// @name          Fab API驱动型全能助手 (v8.0.0 Refactored)
// @name:en       Fab API-Driven Omnipotent Helper (v8.0.0 Refactored)
// @namespace     https://fab.com/
// @version       8.0.0
// @description   【v8 重构版】通过模块化重构，提升代码稳定性、可读性和可维护性。保留全部核心功能，优化逻辑流程。
// @description:en [v8 Refactored] Improved stability, readability, and maintainability through modular refactoring. All core features retained with an optimized logic flow.
// @author        gpt-4 & user & Gemini
// @match         https://www.fab.com/*
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_deleteValue
// @grant         GM_addValueChangeListener
// @grant         GM_removeValueChangeListener
// @grant         GM_xmlhttpRequest
// @grant         GM_webRequest
// @grant         unsafeWindow
// @grant         window.close
// @connect       api.fab.com
// @connect       www.fab.com
// @downloadURL   https://update.greasyfork.org/scripts/541307/Fab%20%E9%9A%90%E8%97%8F%E5%B7%B2%E4%BF%9D%E5%AD%98%E9%A1%B9%E7%9B%AE.user.js
// @updateURL     https://update.greasyfork.org/scripts/541307/Fab%20%E9%9A%90%E8%97%8F%E5%B7%B2%E4%BF%9D%E5%AD%98%E9%A1%B9%E7%9B%AE.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // --- 模块一: 配置与常量 (Config & Constants) ---
    const Config = {
        SCRIPT_NAME: '[Fab API-Driven Helper v8.0.0]',
        UI_CONTAINER_ID: 'fab-helper-container-v8',
        DB_KEYS: {
            TODO: 'fab_todoList_v8',
            DONE: 'fab_doneList_v8',
            FAILED: 'fab_failedList_v8', // For items that failed processing
            HIDE: 'fab_hideSaved_v8',
            TASK: 'fab_activeDetailTask_v8',
            CURSOR: 'fab_reconCursor_v8',
            DETAIL_LOG: 'fab_detailLog_v8', // For worker tab remote logging
        },
        SELECTORS: {
            card: 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root',
            cardLink: 'a[href*="/listings/"]',
            addButton: 'button[aria-label*="Add to"], button[aria-label*="添加至"], button[aria-label*="cart"]',
            rootElement: '#root',
            successBanner: 'div[class*="Toast-root"]'
        },
        TEXTS: {
            en: { hide: '🙈 Hide', show: '👀 Show', recon: '🔍 Recon', reconning: 'Reconning...', execute: '🚀 Start Tasks', executing: 'Executing...', stopExecute: '🛑 Stop', seek: '🚀 Seek New', seeking: 'Seeking...', added: 'Added', failed: 'Failed', todo: 'To-Do', batchSize: 'Batch Size:', clearLog: 'Clear Log', log_init: 'Assistant is online!', log_db_loaded: 'Reading archive...', log_exec_no_tasks: 'To-Do list is empty.', log_recon_start: 'Starting scan for new items...', log_recon_end: 'Scan complete!', log_task_added: 'Found new item:', log_api_request: 'Requesting page data (Page: %page%). Scanned: %scanned%, Owned: %owned%...', log_api_owned_check: 'Checking ownership for %count% items...', log_api_owned_done: 'Ownership check complete. Found %newCount% new items.', log_verify_success: 'Verified and added to library!', log_verify_fail: "Couldn't add. Will retry later.", log_seek_start: 'Seeking first new item...', log_seek_found: 'Found it! Stopping here.', log_seek_end: 'End of page reached.', log_429_error: 'Request limit hit! Taking a 15s break...', log_recon_error: 'An error occurred during recon cycle:', goto_page_label: 'Page:', goto_page_btn: 'Go', retry_failed: '🔁 Retry Failed' },
            zh: { hide: '🙈 隐藏', show: '👀 显示', recon: '🔍 侦察', reconning: '侦察中...', execute: '🚀 启动任务', executing: '执行中...', stopExecute: '🛑 停止', seek: '🚀 寻新', seeking: '寻新中...', added: '已添加', failed: '失败', todo: '待办', batchSize: '本批数量:', clearLog: '清空日志', log_init: '助手已上线！', log_db_loaded: '正在读取存档...', log_exec_no_tasks: '“待办”清单是空的。', log_recon_start: '开始扫描新宝贝...', log_recon_end: '扫描完成！', log_task_added: '发现一个新宝贝:', log_api_request: '正在请求页面数据 (页码: %page%)。已扫描: %scanned%，已拥有: %owned%...', log_api_owned_check: '正在批量验证 %count% 个项目的所有权...', log_api_owned_done: '所有权验证完毕，发现 %newCount% 个全新项目！', log_verify_success: '搞定！已成功入库。', log_verify_fail: '哎呀，这个没加上。稍后会自动重试！', log_seek_start: '好的，我来帮您找到第一个新宝贝...', log_seek_found: '找到了！就停在这里。', log_seek_end: '已经到页面底啦，没有发现新东西。', log_429_error: '请求太快被服务器限速了！休息15秒后自动重试...', log_recon_error: '侦察周期中发生严重错误：', goto_page_label: '页码:', goto_page_btn: '跳转', retry_failed: '🔁 重试失败' }
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
        lang: 'en',
        isInitialized: false,
        hideSaved: false,
        hiddenThisPageCount: 0,
        isReconning: false,
        isExecuting: false,
        isSeeking: false,
        reconScannedCount: 0,
        reconOwnedCount: 0,
        debounceTimer: null,
        db: {
            todo: [],
            done: [],
            failed: []
        },
        ui: { // To be populated by the UI module
            container: null,
            logPanel: null,
            statusDisplay: null,
            execBtn: null,
            hideBtn: null,
            seekBtn: null,
            reconBtn: null,
            retryBtn: null, // For the new button
            batchInput: null,
            pageInput: null,
            jumpBtn: null,
        },
        valueChangeListeners: []
    };

    // --- 模块三: 日志与工具函数 (Logger & Utilities) ---
    const Utils = {
        logger: (type, ...args) => {
            console[type](`${Config.SCRIPT_NAME}`, ...args);
            // The actual logging to screen will be handled by the UI module
            // to keep modules decoupled.
            if (State.ui.logPanel) {
                const logEntry = document.createElement('div');
                logEntry.style.cssText = 'padding: 2px 4px; border-bottom: 1px solid #444; font-size: 11px;';
                const timestamp = new Date().toLocaleTimeString();
                logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${args.join(' ')}`;
                State.ui.logPanel.prepend(logEntry);
                while (State.ui.logPanel.children.length > 100) {
                    State.ui.logPanel.removeChild(State.ui.logPanel.lastChild);
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
        decodeCursorToPageNum: (cursor) => {
            if (!cursor) return '1';
            try {
                const decoded = atob(cursor); // e.g., "o=24"
                const offsetMatch = decoded.match(/o=(\d+)/);
                if (offsetMatch && offsetMatch[1]) {
                    const offset = parseInt(offsetMatch[1], 10);
                    const pageSize = 24; // Deduced from server behavior
                    const pageNum = Math.round((offset / pageSize) + 1);
                    return pageNum.toString();
                }
                return cursor.substring(0, 10) + '...';
            } catch (e) {
                return cursor.substring(0, 10) + '...';
            }
        },
        encodePageNumToCursor: (pageNum) => {
            if (!pageNum || pageNum <= 1) {
                return ''; // Page 1 has no cursor
            }
            try {
                const pageSize = 24;
                const offset = (pageNum - 1) * pageSize;
                return btoa(`o=${offset}`);
            } catch (e) {
                return ''; // Fallback
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
             // unsafeWindow refers to the page's real window object, which is necessary for creating events
            // that the page's own scripts will recognize correctly. Using it is crucial in sandboxed environments.
            const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

            Utils.logger('info', `Performing deep click on element: <${element.tagName.toLowerCase()} class="${element.className}">`);
            const mouseDownEvent = new MouseEvent('mousedown', { view: pageWindow, bubbles: true, cancelable: true });
            const mouseUpEvent = new MouseEvent('mouseup', { view: pageWindow, bubbles: true, cancelable: true });
            element.dispatchEvent(mouseDownEvent);
            element.dispatchEvent(mouseUpEvent);
            // Also trigger the standard click for maximum compatibility.
            element.click();
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
                State.reconScannedCount = 0;
                State.reconOwnedCount = 0;
                Utils.logger('info', Utils.getText('log_recon_start'));
                const savedCursor = await GM_getValue(Config.DB_KEYS.CURSOR, '');
                if (savedCursor) {
                    Utils.logger('info', `Resuming recon from cursor: ${savedCursor.substring(0, 10)}...`);
                }
                TaskRunner.reconWithApi(savedCursor);
            } else {
                Utils.logger('info', 'Reconnaissance stopped by user.');
                // BUG FIX: Do NOT delete the cursor on manual stop. The user expects to resume from here.
                // The cursor should only be deleted when the recon process completes naturally (reaches the end).
                // await GM_deleteValue(Config.DB_KEYS.CURSOR); 
            }
        },
        toggleExecution: () => {
            State.isExecuting = !State.isExecuting;
            UI.update();
            if (State.isExecuting) {
                if (State.db.todo.length === 0) {
                    alert(Utils.getText('log_exec_no_tasks'));
                    State.isExecuting = false;
                    UI.update();
                    return;
                }
                TaskRunner.executeBatch();
            } else {
                // When stopping, we must clean up any active task to prevent "ghost" workers.
                GM_deleteValue(Config.DB_KEYS.TASK);
            }
        },
        toggleSeek: () => {
            State.isSeeking = !State.isSeeking;
            UI.update();
            if (State.isSeeking) {
                Utils.logger('info', Utils.getText('log_seek_start'));
                TaskRunner.seekNew();
            } else {
                Utils.logger('info', 'Seek stopped by user.');
            }
        },
        toggleHideSaved: async () => {
            State.hideSaved = !State.hideSaved;
            await Database.saveHidePref();
            TaskRunner.runHideOrShow();
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

        jumpToPageAndRecon: async () => {
            const pageNum = parseInt(State.ui.pageInput.value, 10);
            if (isNaN(pageNum) || pageNum < 1) {
                Utils.logger('warn', 'Please enter a valid page number > 0.');
                return;
            }

            if (State.isExecuting) {
                 Utils.logger('warn', 'Cannot start recon while execution is in progress.');
                 return;
            }

            // If recon is running, stop it first. The toggle will handle cleanup.
            if (State.isReconning) {
                await TaskRunner.toggleRecon();
                await new Promise(r => setTimeout(r, 100)); // Brief pause to ensure state is updated.
            }

            const cursor = Utils.encodePageNumToCursor(pageNum);
            await GM_setValue(Config.DB_KEYS.CURSOR, cursor);

            Utils.logger('info', `Set start page to ${pageNum}. Starting recon.`);

            // Now, start the recon.
            await TaskRunner.toggleRecon();
        },

        // --- Core Logic Functions ---
        reconWithApi: async (cursor = '') => {
            if (!State.isReconning) return;

            let searchResponse = null;

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
                const searchUrl = new URL('https://www.fab.com/i/listings/search');
                searchUrl.searchParams.set('page_size', '24');
                searchUrl.searchParams.set('sort_by', '-relevance');
                // We keep is_free=1 as a preliminary filter to reduce candidates
                searchUrl.searchParams.set('is_free', '1');
                if (cursor) { searchUrl.searchParams.set('cursor', cursor); }

                const displayPage = Utils.decodeCursorToPageNum(cursor);
                // UX Improvement: Update the page input to reflect the current recon page.
                if (State.ui.pageInput) {
                    State.ui.pageInput.value = displayPage;
                }
                
                Utils.logger('info', "Step 1: " + Utils.getText('log_api_request', {
                    page: displayPage,
                    scanned: State.reconScannedCount,
                    owned: State.reconOwnedCount
                }));
                searchResponse = await API.gmFetch({ method: 'GET', url: searchUrl.href, headers: apiHeaders });

                if (searchResponse.finalUrl && new URL(searchResponse.finalUrl).pathname !== new URL(searchUrl.href).pathname) {
                    Utils.logger('warn', `Request was redirected, which may indicate a login issue. Final URL: ${searchResponse.finalUrl}`);
                }
                
                if (searchResponse.status === 429) {
                    Utils.logger('error', Utils.getText('log_429_error'));
                    await new Promise(r => setTimeout(r, 15000));
                    TaskRunner.reconWithApi(cursor);
                    return;
                }
                
                const searchData = JSON.parse(searchResponse.responseText);
                const initialResultsCount = searchData.results.length;
                State.reconScannedCount += initialResultsCount;

                if (!searchData.results || initialResultsCount === 0) {
                    State.isReconning = false;
                    await GM_deleteValue(Config.DB_KEYS.CURSOR);
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
                State.reconOwnedCount += initiallySkippedCount;

                if (candidates.length === 0) {
                    // No new candidates on this page, go to next page
                    const nextCursor = searchData.cursors?.next;
                    if (nextCursor && State.isReconning) {
                        if (nextCursor === cursor) {
                            Utils.logger('warn', "服务器返回了相同的游标，为防止无限循环，侦察任务已停止。");
                            Utils.logger('warn', "Server returned the same cursor, halting recon to prevent an infinite loop.");
                            State.isReconning = false;
                            await GM_deleteValue(Config.DB_KEYS.CURSOR);
                            UI.update();
                            return;
                        }
                        await GM_setValue(Config.DB_KEYS.CURSOR, nextCursor);
                        await new Promise(r => setTimeout(r, 300));
                        TaskRunner.reconWithApi(nextCursor);
                    } else {
                         State.isReconning = false;
                         await GM_deleteValue(Config.DB_KEYS.CURSOR);
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
                        State.reconOwnedCount++;
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
                const nextCursor = searchData.cursors?.next;
                if (nextCursor && State.isReconning) {
                    if (nextCursor === cursor) {
                        Utils.logger('warn', "服务器返回了相同的游标，为防止无限循环，侦察任务已停止。");
                        Utils.logger('warn', "Server returned the same cursor, halting recon to prevent an infinite loop.");
                        State.isReconning = false;
                        await GM_deleteValue(Config.DB_KEYS.CURSOR);
                        UI.update();
                        return;
                    }
                    await GM_setValue(Config.DB_KEYS.CURSOR, nextCursor);
                    await new Promise(r => setTimeout(r, 500)); // Rate limit
                    TaskRunner.reconWithApi(nextCursor);
                } else {
                    State.isReconning = false;
                    await GM_deleteValue(Config.DB_KEYS.CURSOR);
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

            const batchSize = parseInt(State.ui.batchInput.value, 10) || 50;
            const batch = State.db.todo.slice(0, batchSize);

            if (batch.length === 0) {
                Utils.logger('info', 'All tasks completed!');
                State.isExecuting = false;
                UI.update();
                return;
            }

            // In this refactored version, all tasks are 'detail' tasks.
            const detailTasks = batch.filter(t => t.type === 'detail');
            
            if (detailTasks.length > 0) {
                 const detailTaskPayload = {
                    // Pass the whole task object, not just the URL.
                    batch: detailTasks,
                    currentIndex: 0
                };
                await GM_setValue(Config.DB_KEYS.TASK, detailTaskPayload);
                // Open the first task's URL in a new tab
                window.open(detailTaskPayload.batch[0].url, '_blank').focus();
            } else if (State.isExecuting) {
                // If for some reason there are no detail tasks, continue the loop
                setTimeout(TaskRunner.executeBatch, 1000);
            }
        },

        processDetailPage: async () => {
            const logBuffer = [`Task started on: ${window.location.href}`];
            // BUG FIX #2: Read the task payload ONCE at the beginning and use it throughout.
            // This prevents race conditions where the value in GM storage might change during execution.
            const taskPayload = await GM_getValue(Config.DB_KEYS.TASK);
            const currentTask = taskPayload?.batch?.[taskPayload?.currentIndex];

            if (!currentTask || !currentTask.uid) {
                logBuffer.push(`CRITICAL ERROR: Could not retrieve current task from GM_getValue or task is invalid.`);
                // Pass the potentially null taskPayload, advanceDetailTask must handle it gracefully.
                await TaskRunner.advanceDetailTask(taskPayload, false, logBuffer);
                return;
            }

            // --- New API-First Ownership Check ---
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
                    logBuffer.push(`API check confirms item is already owned. Marking as success.`);
                    await TaskRunner.advanceDetailTask(taskPayload, true, logBuffer);
                    return; // Stop further processing
                }
                logBuffer.push(`API check confirms item is not owned. Proceeding with UI interaction.`);

            } catch (apiError) {
                logBuffer.push(`API ownership check failed: ${apiError.message}. Falling back to UI-based check.`);
            }
            // --- End of API Check ---


            // This function is the single source of truth for checking the "owned" state.
            // It adheres STRICTLY to the rules defined in FAB_HELPER_RULES.md.
            const isItemOwned = () => {
                const criteria = Config.OWNED_SUCCESS_CRITERIA;
                
                // Rule 1: Look for the H2 success message.
                const successHeader = document.querySelector('h2');
                if (successHeader && criteria.h2Text.some(text => successHeader.textContent.includes(text))) {
                    return { owned: true, reason: `H2 text "${successHeader.textContent}"` };
                }

                // Rule 1: Look for the "View in My Library" button.
                // NOTE: "Download" is explicitly IGNORED as per Rule 2.
                const allButtons = [...document.querySelectorAll('button, a.fabkit-Button-root')];
                const ownedButton = allButtons.find(btn => 
                    criteria.buttonTexts.some(keyword => btn.textContent.includes(keyword))
                );
                if (ownedButton) {
                    return { owned: true, reason: `Button text "${ownedButton.textContent}"` };
                }

                return { owned: false };
            };
            
            try {
                // --- Logic Based on FAB_HELPER_RULES.md ---

                // Step 1: Check for Owned State (Rule 1) - Kept as a fallback
                const initialState = isItemOwned();
                if (initialState.owned) {
                    logBuffer.push(`Item already owned on page load (UI Fallback PASS: ${initialState.reason}). Marking as success.`);
                    await TaskRunner.advanceDetailTask(taskPayload, true, logBuffer);
                    return;
                }

                // Step 2: Check for Multi-License State (Rule 3) - Now with MutationObserver
                const licenseButton = [...document.querySelectorAll('button')].find(btn => btn.textContent.includes('选择许可'));
                if (licenseButton) {
                    logBuffer.push(`Multi-license item detected. Setting up observer for dropdown.`);

                    // Use a Promise that resolves when the observer sees the dropdown open.
                    // This is more robust than waiting a fixed time.
                    const waitForDropdownOpen = new Promise((resolve, reject) => {
                        let observer;
                        const timeout = setTimeout(() => {
                            if (observer) observer.disconnect();
                            reject(new Error('Timeout (10s): "选择许可" dropdown did not open.'));
                        }, 10000);

                        observer = new MutationObserver((mutationsList) => {
                            for (const mutation of mutationsList) {
                                if (mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded') {
                                    if (licenseButton.getAttribute('aria-expanded') === 'true') {
                                        logBuffer.push('Observer detected aria-expanded="true". Dropdown is open.');
                                        clearTimeout(timeout);
                                        observer.disconnect();
                                        resolve();
                                        return; // We're done, no need to check other mutations.
                                    }
                                }
                            }
                        });

                        observer.observe(licenseButton, { attributes: true });
                    });

                    logBuffer.push('Performing deep click on "选择许可" to trigger observer...');
                    Utils.deepClick(licenseButton); // This click should trigger the observer.

                    // Wait for the dropdown to actually open, with a timeout.
                    await waitForDropdownOpen;
                    
                    // BUG FIX #1: Don't rely on a fixed delay. Actively wait for the listbox to appear
                    // after the observer confirms the dropdown is logically open.
                    const listbox = await Utils.waitForElement('div[role="listbox"]');
                    if (!listbox) {
                        // This case should theoretically not be reached if waitForElement works correctly, but it's good practice.
                        throw new Error('Dropdown opened, but listbox container (div[role="listbox"]) was not found even after waiting.');
                    }
                    
                    // A small delay is still useful for the options *inside* the listbox to render.
                    await new Promise(r => setTimeout(r, 300));
                    
                    // --- New robust clicking logic based on user screenshot ---
                    let optionToClick = null;
                    
                    // Strategy: Find the element with the exact text "免费", then find its clickable parent.
                    const freeTextElement = [...listbox.querySelectorAll('span, div')].find(el => {
                        // Use exact match for "免费" to avoid picking up other text.
                        return el.textContent.trim() === '免费';
                    });

                    if (freeTextElement) {
                        logBuffer.push('Found the "免费" text element.');
                        // Now, find the closest ancestor element that is the actual clickable option.
                        optionToClick = freeTextElement.closest('[role="option"]');
                    }
                    // --- End of new logic ---

                    if (optionToClick) {
                         logBuffer.push(`Found free license option container. Performing deep click...`);
                         Utils.deepClick(optionToClick); // Keep deepClick on the option as well.
                         // After clicking a license, the UI needs a moment to update the main "Add" button.
                         await new Promise(r => setTimeout(r, 500));
                         logBuffer.push(`Successfully dispatched click events on the license option.`);
                    } else {
                        throw new Error('Could not find a clickable "免费" license option inside the listbox.');
                    }
                }

                // Step 3: Find and click the standard Acquisition Button (Rule 2)
                // This will run either after the multi-license logic or if it wasn't a multi-license item.
                const actionButton = [...document.querySelectorAll('button.fabkit-Button-root')].find(btn => 
                    [...Config.ACQUISITION_TEXT_SET].some(keyword => btn.textContent.includes(keyword))
                );

                if (actionButton) {
                    const originalButtonText = actionButton.textContent;
                    logBuffer.push(`Found acquisition button (Rule 2 PASS: "${originalButtonText}"). Performing deep click...`);
                    // Add a slight delay before clicking to ensure button is fully interactive
                    await new Promise(r => setTimeout(r, 250));
                    Utils.deepClick(actionButton);

                    // Step 4: Wait for the page state to change to "owned" (wait for Rule 1 to PASS).
                    await new Promise((resolve, reject) => {
                        const timeout = 10000;
                        const interval = setInterval(() => {
                            const currentState = isItemOwned();
                            if (currentState.owned) {
                                logBuffer.push(`Acquisition confirmed! (Rule 1 now PASS: ${currentState.reason})`);
                                clearInterval(interval);
                                resolve();
                            }
                        }, 200);
                        setTimeout(() => {
                            clearInterval(interval);
                            reject(new Error(`Timeout waiting for page to enter an 'owned' state after click.`));
                        }, timeout);
                    });
                    
                    await TaskRunner.advanceDetailTask(taskPayload, true, logBuffer);
                    return;
                }
                
                throw new Error('Could not find any button matching the acquisition keyword sets after all steps.');

            } catch (error) {
                logBuffer.push(`Acquisition FAILED: ${error.message}`);
                await TaskRunner.advanceDetailTask(taskPayload, false, logBuffer);
            }
        },

        advanceDetailTask: async (taskPayload, success, logBuffer = []) => {
            // First, send the final log report back to the main tab.
            await GM_setValue(Config.DB_KEYS.DETAIL_LOG, logBuffer);

            // Gracefully handle cases where the task payload might be null
            if (!taskPayload || typeof taskPayload.currentIndex === 'undefined' || !taskPayload.batch) {
                Utils.logger('error', 'advanceDetailTask called with invalid or null taskPayload. Cannot advance. Closing tab.');
                window.close();
                return;
            }

            const currentTask = taskPayload.batch[taskPayload.currentIndex];

            if (success) {
                await Database.markAsDone(currentTask);
            } else {
                await Database.markAsFailed(currentTask);
            }

            // BUG FIX: After processing the current item, we MUST re-check if the master task has been cancelled.
            // The main tab signals a stop by deleting the TASK key. If it's gone, we must abort.
            const masterTaskStillActive = await GM_getValue(Config.DB_KEYS.TASK);
            if (!masterTaskStillActive) {
                Utils.logger('info', 'Execution stopped by main tab. Worker tab will now close.');
                window.close(); // Halt all further action.
                return;
            }

            taskPayload.currentIndex++;

            if (taskPayload.currentIndex >= taskPayload.batch.length) {
                await GM_deleteValue(Config.DB_KEYS.TASK);
                window.close();
            } else {
                await GM_setValue(Config.DB_KEYS.TASK, taskPayload);
                window.location.href = taskPayload.batch[taskPayload.currentIndex].url;
            }
        },

        seekNew: async () => {
             if (!State.isSeeking) return;
            const cards = [...document.querySelectorAll(Config.SELECTORS.card)].filter(c => c.style.display !== 'none');
            const firstNewCard = cards.find(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                return link && !Database.isDone(link.href) && !Database.isTodo(link.href);
            });

            if (firstNewCard) {
                Utils.logger('info', Utils.getText('log_seek_found'));
                firstNewCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                State.isSeeking = false;
                UI.update();
            } else {
                 if (window.innerHeight + window.scrollY >= document.body.scrollHeight) {
                    Utils.logger('info', Utils.getText('log_seek_end'));
                    State.isSeeking = false;
                    UI.update();
                    return;
                }
                window.scrollBy(0, window.innerHeight);
                setTimeout(TaskRunner.seekNew, 1500);
            }
        },

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

            const container = document.createElement('div');
            container.id = Config.UI_CONTAINER_ID;
            Object.assign(container.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch', width: '280px' });

            const createButton = (id, textKey) => {
                const btn = document.createElement('button');
                btn.id = id;
                btn.textContent = Utils.getText(textKey);
                Object.assign(btn.style, { padding: '10px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: 'white', transition: 'all 0.2s', flexGrow: '1', whiteSpace: 'nowrap' });
                return btn;
            };
            
            const uiRow = (children) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '10px';
                row.style.justifyContent = 'space-between';
                children.forEach(c => row.appendChild(c));
                return row;
            };

            // Log Panel
            State.ui.logPanel = document.createElement('div');
            State.ui.logPanel.style.cssText = 'background: rgba(0,0,0,0.7); color: white; padding: 8px; border-radius: 8px; max-height: 200px; overflow-y: auto; display: flex; flex-direction: column-reverse;';

            // Status Row
            const statusRow = document.createElement('div');
            statusRow.style.cssText = 'display: flex; gap: 10px; align-items: center;';
            State.ui.statusDisplay = document.createElement('div');
            State.ui.statusDisplay.style.cssText = 'background: #333; color: white; padding: 8px; border-radius: 8px; text-align: center; font-size: 12px; flex-grow: 1;';
            const clearLogBtn = createButton('clearLogBtn', 'clearLog');
            clearLogBtn.style.flexGrow = '0';
            clearLogBtn.onclick = () => { State.ui.logPanel.innerHTML = ''; };
            statusRow.append(State.ui.statusDisplay, clearLogBtn);
            
            // Buttons
            State.ui.execBtn = createButton('execBtn', 'execute');
            State.ui.execBtn.onclick = TaskRunner.toggleExecution;
            State.ui.retryBtn = createButton('retryBtn', 'retry_failed');
            State.ui.retryBtn.onclick = TaskRunner.retryFailedTasks;
            State.ui.hideBtn = createButton('hideBtn', 'hide');
            State.ui.hideBtn.onclick = TaskRunner.toggleHideSaved;
            State.ui.seekBtn = createButton('seekBtn', 'seek');
            State.ui.seekBtn.onclick = TaskRunner.toggleSeek;
            State.ui.reconBtn = createButton('reconBtn', 'recon');
            State.ui.reconBtn.onclick = TaskRunner.toggleRecon;

            // Batch Input
            const batchContainer = document.createElement('div');
            batchContainer.style.display = 'flex';
            const batchLabel = document.createElement('span');
            batchLabel.textContent = Utils.getText('batchSize');
            batchLabel.style.cssText = 'color: white; background: #555; padding: 10px; border-radius: 8px 0 0 8px; font-size: 12px; display: flex; align-items: center;';
            State.ui.batchInput = document.createElement('input');
            State.ui.batchInput.type = 'number';
            State.ui.batchInput.value = '100';
            State.ui.batchInput.style.cssText = 'width: 60px; border: none; padding: 10px; border-radius: 0 8px 8px 0; text-align: center;';
            batchContainer.append(batchLabel, State.ui.batchInput);
            
            // Page Jump Input
            const jumpContainer = document.createElement('div');
            jumpContainer.style.cssText = 'display: flex;';
            const pageLabel = document.createElement('span');
            pageLabel.textContent = Utils.getText('goto_page_label');
            pageLabel.style.cssText = 'color: white; background: #555; padding: 10px; border-radius: 8px 0 0 8px; font-size: 12px; display: flex; align-items: center; flex-shrink: 0;';
            State.ui.pageInput = document.createElement('input');
            State.ui.pageInput.type = 'number';
            State.ui.pageInput.placeholder = '1';
            State.ui.pageInput.style.cssText = 'width: 100%; border: none; padding: 10px; text-align: center;';
            State.ui.jumpBtn = createButton('jumpBtn', 'goto_page_btn');
            State.ui.jumpBtn.style.borderRadius = '0 8px 8px 0';
            State.ui.jumpBtn.style.flexShrink = '0';
            State.ui.jumpBtn.onclick = TaskRunner.jumpToPageAndRecon;
            jumpContainer.append(pageLabel, State.ui.pageInput, State.ui.jumpBtn);

            // Append elements one by one to avoid layout conflicts
            container.append(State.ui.logPanel);
            container.append(statusRow);
            container.append(State.ui.execBtn);
            container.append(State.ui.retryBtn);
            // Group the discovery buttons in a single row for a cleaner layout.
            container.append(uiRow([State.ui.hideBtn, State.ui.seekBtn, State.ui.reconBtn]));
            container.append(batchContainer);
            container.append(jumpContainer);
            
            document.body.appendChild(container);
            
            State.ui.container = container;
            UI.update();
        },

        update: () => {
            if (!State.ui.container) return;
            
            // Status Display
            State.ui.statusDisplay.innerHTML = `${Utils.getText('todo')}: <b>${State.db.todo.length}</b> | ${Utils.getText('added')}: <b>${State.db.done.length}</b> | ${Utils.getText('failed')}: <b style="color: #ff453a;">${State.db.failed.length}</b>`;
            
            // Execute Button
            State.ui.execBtn.innerHTML = State.isExecuting ? Utils.getText('executing') : Utils.getText('execute');
            State.ui.execBtn.style.background = State.isExecuting ? '#ff453a' : '#e91e63';

            // Retry Button - Full width, placed below the main execute button.
            const hasFailedTasks = State.db.failed.length > 0;
            State.ui.retryBtn.disabled = !hasFailedTasks || State.isExecuting;
            State.ui.retryBtn.style.background = hasFailedTasks && !State.isExecuting ? '#ff9f0a' : '#555'; // Orange when active, gray otherwise
            State.ui.retryBtn.style.cursor = State.ui.retryBtn.disabled ? 'not-allowed' : 'pointer';

            // Style the buttons in the discovery row to have equal width.
            // Hide Button
            const hideText = State.hideSaved ? Utils.getText('show') : Utils.getText('hide');
            State.ui.hideBtn.innerHTML = `${hideText} (${State.hiddenThisPageCount})`;
            State.ui.hideBtn.style.background = '#0a84ff';

            // Seek Button
            State.ui.seekBtn.innerHTML = State.isSeeking ? Utils.getText('seeking') : Utils.getText('seek');
            State.ui.seekBtn.disabled = State.isReconning || State.isExecuting;
            State.ui.seekBtn.style.background = State.isSeeking ? '#ff9800' : '#00b8d4';
            
            // Recon Button
            State.ui.reconBtn.innerHTML = State.isReconning ? Utils.getText('reconning') : Utils.getText('recon');
            State.ui.reconBtn.disabled = State.isExecuting; // BUG FIX: Should only be disabled during execution, not during its own process.
            State.ui.reconBtn.style.background = State.isReconning ? '#ff9800' : '#34c759';
        },

        applyOverlay: (card) => {
            if (!card || card.querySelector('.fab-helper-overlay-v8')) return;
            const overlay = document.createElement('div');
            overlay.className = 'fab-helper-overlay-v8';
            Object.assign(overlay.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(25, 25, 25, 0.6)', zIndex: '10', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4caf50', fontSize: '24px', fontWeight: 'bold', backdropFilter: 'blur(2px)', borderRadius: 'inherit' });
            overlay.innerHTML = '✅';
            const thumbnail = card.querySelector('.fabkit-Thumbnail-root, .AssetCard-thumbnail');
            if (thumbnail) {
                if (getComputedStyle(thumbnail).position === 'static') {
                    thumbnail.style.position = 'relative';
                }
                thumbnail.appendChild(overlay);
            }
        },

        applyOverlaysToPage: () => {
            document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                if (link && Database.isDone(link.href)) {
                    UI.applyOverlay(card);
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
                                    UI.applyOverlay(node);
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
            UI.update();
        }));
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.FAILED, (name, old_value, new_value) => {
            State.db.failed = new_value;
            UI.update();
        }));
        // NEW LISTENER: This now exclusively handles the execution flow continuation.
        // It triggers when a worker tab finishes its batch and deletes the TASK key.
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.TASK, (name, old_value, new_value) => {
            if (State.isExecuting && !new_value && old_value) { // A batch has just finished.
                Utils.logger('info', 'Batch completed. Checking for more tasks...');
                // The individual TODO/DONE listeners are responsible for updating state.
                // This listener's ONLY job is to continue the execution loop.
                if (State.db.todo.length > 0) {
                    Utils.logger('info', 'More tasks to process. Starting next batch in 1 second.');
                    setTimeout(TaskRunner.executeBatch, 1000);
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