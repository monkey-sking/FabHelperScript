/**
 * Fab Helper - Utility Functions
 */
import { Config } from '../config.js';
import { State } from '../state.js';

// Forward declaration for circular dependency
let UI = null;
export const setUIReference = (uiModule) => { UI = uiModule; };

export const Utils = {
    logger: (type, ...args) => {
        // 在工作标签页中，只记录关键日志
        if (State.isWorkerTab) {
            if (type === 'error' || args.some(arg => typeof arg === 'string' && arg.includes('Worker'))) {
                console[type](`${Config.SCRIPT_NAME} [Worker]`, ...args);
            }
            return;
        }

        // 支持debug级别日志
        if (type === 'debug') {
            if (!State.debugMode) {
                return; // 调试模式关闭时，不输出debug日志
            }
            console.log(`${Config.SCRIPT_NAME} [DEBUG]`, ...args);
        } else {
            console[type](`${Config.SCRIPT_NAME}`, ...args);
        }

        // 记录到日志面板
        if (State.UI && State.UI.logPanel) {
            const logEntry = document.createElement('div');
            logEntry.style.cssText = 'padding: 2px 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;';
            
            // 根据日志类型应用色彩样式（符合暗色玻璃态控制台的主题色）
            if (type === 'error') {
                logEntry.style.color = '#ff3b30'; // 亮红 (System Red)
                logEntry.style.fontWeight = '500';
            } else if (type === 'warn') {
                logEntry.style.color = '#ff9500'; // 亮橙 (System Orange)
                logEntry.style.fontWeight = '500';
            } else if (type === 'debug') {
                logEntry.style.color = '#8e8e93'; // 灰字 (System Gray)
            } else {
                logEntry.style.color = '#f5f5f7'; // 亮灰白 (Primary Text)
            }

            const timestamp = new Date().toLocaleTimeString();
            const debugPrefix = type === 'debug' ? '<span style="color: #34c759;">[DEBUG]</span> ' : '';
            logEntry.innerHTML = `<span style="color: rgba(255, 255, 255, 0.4);">[${timestamp}]</span> ${debugPrefix}${args.join(' ')}`;
            
            State.UI.logPanel.prepend(logEntry);
            
            // 限制最大日志行数
            while (State.UI.logPanel.children.length > 100) {
                State.UI.logPanel.removeChild(State.UI.logPanel.lastChild);
            }
        }
    },
    getText: (key, ...args) => {
        let text = (Config.TEXTS[State.lang]?.[key]) || (Config.TEXTS['en']?.[key]) || key;

        // 支持两种格式的参数替换
        if (args.length > 0) {
            // 如果第一个参数是对象，使用 %placeholder% 格式
            if (typeof args[0] === 'object' && args[0] !== null) {
                const replacements = args[0];
                for (const placeholder in replacements) {
                    text = text.replace(`%${placeholder}%`, replacements[placeholder]);
                }
            } else {
                // 否则使用 {0}, {1}, {2} 格式
                args.forEach((arg, index) => {
                    text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
                });
            }
        }

        return text;
    },
    detectLanguage: () => {
        const oldLang = State.lang;
        State.lang = window.location.href.includes('/zh-cn/') ? 'zh' : (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
        Utils.logger('debug', `语言检测: 地址=${window.location.href}, 检测到语言=${State.lang}${oldLang !== State.lang ? ` (从${oldLang}切换)` : ''}`);

        // 如果语言发生了变化且UI已经创建，更新UI
        if (oldLang !== State.lang && State.UI && State.UI.container && UI) {
            Utils.logger('info', `语言已切换到${State.lang}，正在更新界面...`);
            UI.update();
        }
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

        // Ensure element is focused if possible
        try { element.focus(); } catch (e) { }

        // A small delay to ensure the browser's event loop is clear and any framework
        // event listeners on the element have had a chance to attach.
        setTimeout(() => {
            const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

            Utils.logger('info', `Performing deep click on element: <${element.tagName.toLowerCase()} class="${element.className}">`);

            const eventOptions = { view: pageWindow, bubbles: true, cancelable: true, composed: true };

            // Pointer events sequence
            element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
            element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
            element.dispatchEvent(new PointerEvent('pointerup', eventOptions));
            element.dispatchEvent(new MouseEvent('mouseup', eventOptions));

            // Standard click
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
    },
    // ... (existing helper methods) ...
    // 添加游标解码函数
    decodeCursor: (cursor) => {
        if (!cursor) return Utils.getText('no_saved_position');
        try {
            // Base64 decode
            const decoded = atob(cursor);

            // Cursor format is usually: o=1&p=Item+Name or p=Item+Name
            // Extract p parameter value
            let match;
            if (decoded.includes('&p=')) {
                match = decoded.match(/&p=([^&]+)/);
            } else if (decoded.startsWith('p=')) {
                match = decoded.match(/p=([^&]+)/);
            }

            if (match && match[1]) {
                // Decode URI component and replace + with space
                let itemName = decodeURIComponent(match[1].replace(/\+/g, ' '));

                // Check if it looks like an ISO date (e.g., 2023-05-05T...)
                // If so, format it to be shorter and cleaner
                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(itemName)) {
                    try {
                        const date = new Date(itemName);
                        // Format: YYYY-MM-DD HH:mm:ss
                        const dateStr = date.toLocaleDateString();
                        const timeStr = date.toLocaleTimeString([], { hour12: false });
                        itemName = `${dateStr} ${timeStr}`;
                    } catch (e) { /* Ignore date parse error */ }
                }

                return `${Utils.getText('position_label')}: "${itemName}"`;
            }

            return `${Utils.getText('position_label')}: (Unknown)`;
        } catch (e) {
            Utils.logger('error', `Cursor decode failed: ${e.message}`);
            return `${Utils.getText('position_label')}: (Invalid)`;
        }
    },
    // Helper to extract just the item name from cursor
    getCursorItemName: (cursor) => {
        if (!cursor) return null;
        try {
            const decoded = atob(cursor);
            let match;
            if (decoded.includes('&p=')) {
                match = decoded.match(/&p=([^&]+)/);
            } else if (decoded.startsWith('p=')) {
                match = decoded.match(/p=([^&]+)/);
            }
            if (match && match[1]) {
                return decodeURIComponent(match[1].replace(/\+/g, ' '));
            }
        } catch (e) { }
        return null;
    },
    // 账号验证函数 - silent模式用于初始化时的检查，不弹出警告
    checkAuthentication: (silent = false) => {
        const csrfToken = Utils.getCookie('fab_csrftoken');
        if (!csrfToken) {
            if (!silent) {
                Utils.logger('error', Utils.getText('auth_error'));
                // 停止执行状态
                if (State.isExecuting) {
                    State.isExecuting = false;
                    GM_setValue(Config.DB_KEYS.IS_EXECUTING, false);
                }
                // 更新UI显示
                if (State.UI && State.UI.execBtn) {
                    State.UI.execBtn.textContent = Utils.getText('execute');
                    State.UI.execBtn.disabled = true;
                }
                // 显示警告信息
                alert(Utils.getText('auth_error_alert'));
            }
            State.isAuthenticated = false;
            return false;
        }
        State.isAuthenticated = true;
        return true;
    },

    // 从当前页面的 SSR 数据里同步读取登录态。fab.com 在每个页面都内嵌了：
    //   1. window._epicAccountId        — 已登录是真实 UUID，未登录是空字符串
    //   2. <script id="js-json-data-prefetched-data"> 里 "/i/users/me".isAnonymous
    //   3. 同一块 JSON 里的 result UUID — 全零（00000000-...）也代表匿名
    // 三者任一明确指向匿名 → 返回 false；任一明确指向已登录 → 返回 true；
    // 都拿不到 → 返回 null，留给调用方决定要不要走 API 兜底。
    detectLoginFromPage: () => {
        const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
        try {
            if (typeof window !== 'undefined' && Object.prototype.hasOwnProperty.call(window, '_epicAccountId')) {
                const id = window._epicAccountId;
                if (typeof id === 'string') {
                    if (id === '' || id === ZERO_UUID) return false;
                    if (/^[0-9a-f-]{32,36}$/i.test(id)) return true;
                }
            }
        } catch (e) { /* swallow */ }

        try {
            const tag = document && document.getElementById && document.getElementById('js-json-data-prefetched-data');
            if (tag && tag.textContent) {
                const data = JSON.parse(tag.textContent);
                const userInfo = data && data['/i/users/me'];
                if (userInfo) {
                    if (userInfo.isAnonymous === true) return false;
                    if (userInfo.isAnonymous === false) return true;
                    if (typeof userInfo.result === 'string') {
                        if (userInfo.result === ZERO_UUID) return false;
                        if (/^[0-9a-f-]{32,36}$/i.test(userInfo.result)) return true;
                    }
                }
            }
        } catch (e) { /* swallow */ }

        return null;
    },

    // 校验登录态。优先用页面 SSR 数据（同步、零网络、零 Cloudflare 风险），
    // 拿不到再退回 /i/users/me API 探测。结果缓存到 State.isAuthenticated。
    verifyServerSession: () => {
        const csrfToken = Utils.getCookie('fab_csrftoken');
        if (!csrfToken) {
            State.isAuthenticated = false;
            return Promise.resolve(false);
        }

        const fromPage = Utils.detectLoginFromPage();
        if (fromPage === true) {
            State.isAuthenticated = true;
            return Promise.resolve(true);
        }
        if (fromPage === false) {
            State.isAuthenticated = false;
            return Promise.resolve(false);
        }

        // 页面信号缺失（理论上不会发生在 fab.com 上）→ API 兜底
        return new Promise((resolve) => {
            try {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://www.fab.com/i/users/me',
                    headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' },
                    anonymous: false,
                    timeout: 5000,
                    onload: (response) => {
                        if (response.status === 401 || response.status === 403) {
                            State.isAuthenticated = false;
                            resolve(false);
                            return;
                        }
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const data = JSON.parse(response.responseText);
                                if (data && (data.id || data.uid || data.email || data.username || data.isAnonymous === false)) {
                                    State.isAuthenticated = true;
                                    resolve(true);
                                    return;
                                }
                            } catch (e) { /* fallthrough */ }
                            State.isAuthenticated = false;
                            resolve(false);
                            return;
                        }
                        resolve(State.isAuthenticated);
                    },
                    onerror: () => resolve(State.isAuthenticated),
                    ontimeout: () => resolve(State.isAuthenticated)
                });
            } catch (e) {
                resolve(State.isAuthenticated);
            }
        });
    },

    // 强校验：cookie + 服务端 session 一起验。返回 boolean。
    // notify=true 时对用户提示并停止当前执行。
    ensureAuthenticated: async (notify = true) => {
        if (!Utils.checkAuthentication(true)) {
            if (notify) Utils.notifyAuthFailure();
            return false;
        }
        const sessionOk = await Utils.verifyServerSession();
        if (!sessionOk) {
            if (notify) Utils.notifyAuthFailure();
            return false;
        }
        return true;
    },

    notifyAuthFailure: () => {
        Utils.logger('error', Utils.getText('auth_error'));
        if (State.isExecuting) {
            State.isExecuting = false;
            try { GM_setValue(Config.DB_KEYS.IS_EXECUTING, false); } catch (e) { }
        }
        if (State.UI && State.UI.execBtn) {
            State.UI.execBtn.textContent = Utils.getText('execute');
            State.UI.execBtn.disabled = true;
        }
        try { alert(Utils.getText('auth_error_alert')); } catch (e) { }
    },
    // 将所有空白字符（包括换行、多个空格）统一替换为单个空格
    normalizeWhitespace: (text) => {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim();
    },
    // Broadened to find more clickable elements including inputs and divs/spans that look like buttons.
    // Also traverses into same-origin iframes.
    findAllButtonsWithShadow: (root = document) => {
        const interactables = [];
        const visitedIframes = new WeakSet(); // Prevent infinite loops with nested iframes

        const traverse = (node) => {
            if (!node) return;
            if (node.nodeType === 1) { // Element
                // Handle Shadow DOM
                if (node.shadowRoot) {
                    traverse(node.shadowRoot);
                }

                // Handle iframes (same-origin only)
                if (node.tagName === 'IFRAME' && !visitedIframes.has(node)) {
                    visitedIframes.add(node);
                    try {
                        const iframeDoc = node.contentDocument || node.contentWindow?.document;
                        if (iframeDoc) {
                            Utils.logger('debug', `Traversing iframe: ${node.src || '(inline)'}`);
                            traverse(iframeDoc.body || iframeDoc);
                        }
                    } catch (e) {
                        // Cross-origin iframe, skip silently
                        Utils.logger('debug', `Cannot access cross-origin iframe: ${node.src}`);
                    }
                }

                const tagName = node.tagName;
                const role = node.getAttribute && node.getAttribute('role');
                const type = node.getAttribute && node.getAttribute('type');
                const className = (node.className && typeof node.className === 'string') ? node.className : '';

                // 1. Basic Buttons
                if (tagName === 'BUTTON') {
                    interactables.push(node);
                }
                // 2. Links that validly look like buttons
                else if (tagName === 'A' && (role === 'button' || className.includes('btn') || className.includes('button'))) {
                    interactables.push(node);
                }
                // 3. Inputs (submit/button)
                else if (tagName === 'INPUT' && (type === 'submit' || type === 'button' || type === 'reset')) {
                    interactables.push(node);
                }
                // 4. Divs/Spans acting as buttons (common in modern frameworks)
                else if (role === 'button' || className.includes('payment-order-confirm__btn') || className.includes('place-order')) {
                    interactables.push(node);
                }
            }
            // Traverse children
            let child = node.firstChild;
            while (child) {
                traverse(child);
                child = child.nextSibling;
            }
        };
        traverse(root);

        // Also search for any iframes at the top level of document in case they are not nested
        if (root === document) {
            try {
                const allIframes = document.querySelectorAll('iframe');
                allIframes.forEach(iframe => {
                    if (!visitedIframes.has(iframe)) {
                        visitedIframes.add(iframe);
                        try {
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (iframeDoc) {
                                Utils.logger('debug', `Top-level iframe search: ${iframe.src || '(inline)'}`);
                                traverse(iframeDoc.body || iframeDoc);
                            }
                        } catch (e) {
                            // Cross-origin, skip
                        }
                    }
                });
            } catch (e) {
                // Error querying iframes, skip
            }
        }

        return interactables;
    }
};
