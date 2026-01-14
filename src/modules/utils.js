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
        // 支持debug级别日志
        if (type === 'debug') {
            // 只有在调试模式下才显示debug日志（控制台和面板都需要开启调试模式）
            if (!State.debugMode) {
                return; // 调试模式关闭时，完全不显示debug日志
            }

            // 调试模式下在控制台输出日志
            console.log(`${Config.SCRIPT_NAME} [DEBUG]`, ...args);

            // 调试模式下记录到日志面板
            if (State.UI && State.UI.logPanel) {
                const logEntry = document.createElement('div');
                logEntry.style.cssText = 'padding: 2px 4px; border-bottom: 1px solid #444; font-size: 11px; color: #888;';
                const timestamp = new Date().toLocaleTimeString();
                logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> <span style="color: #8a8;">[DEBUG]</span> ${args.join(' ')}`;
                State.UI.logPanel.prepend(logEntry);
                while (State.UI.logPanel.children.length > 100) {
                    State.UI.logPanel.removeChild(State.UI.logPanel.lastChild);
                }
            }
            return;
        }

        // 在工作标签页中，只记录关键日志
        if (State.isWorkerTab) {
            if (type === 'error' || args.some(arg => typeof arg === 'string' && arg.includes('Worker'))) {
                console[type](`${Config.SCRIPT_NAME} [Worker]`, ...args);
            }
            return;
        }

        console[type](`${Config.SCRIPT_NAME}`, ...args);
        // The actual logging to screen will be handled by the UI module
        // to keep modules decoupled.
        if (State.UI && State.UI.logPanel) {
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
            return false;
        }
        return true;
    },
    // 将所有空白字符（包括换行、多个空格）统一替换为单个空格
    normalizeWhitespace: (text) => {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim();
    },
    // Broadened to find more clickable elements including inputs and divs/spans that look like buttons
    findAllButtonsWithShadow: (root = document) => {
        const interactables = [];
        const traverse = (node) => {
            if (!node) return;
            if (node.nodeType === 1) { // Element
                if (node.shadowRoot) {
                    traverse(node.shadowRoot);
                }

                const tagName = node.tagName;
                const role = node.getAttribute('role');
                const type = node.getAttribute('type');
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
        return interactables;
    }
};
