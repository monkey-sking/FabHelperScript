/**
 * Fab Helper - Main Entry Point
 * 
 * This is the main entry file that imports all modules and initializes the script.
 * Build with: npm run build
 */

// Immediate optimization to block large resources (runs at document-start)
(function () {
    try {
        const blockEnabled = typeof GM_getValue !== 'undefined' ? GM_getValue('fab_block_resources_v1', true) : true;
        if (blockEnabled) {
            // 1. Inject CSP to block network requests for images, media, fonts, frames
            const meta = document.createElement('meta');
            meta.httpEquiv = 'Content-Security-Policy';
            meta.content = "img-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; child-src 'none';";
            if (document.documentElement) {
                document.documentElement.appendChild(meta);
            } else {
                document.appendChild(meta);
            }

            // 2. Inject CSS to hide images and background images visually
            const style = document.createElement('style');
            style.textContent = `
                img, source, picture, video, iframe, [style*="background-image"] {
                    display: none !important;
                    background-image: none !important;
                }
            `;
            if (document.documentElement) {
                document.documentElement.appendChild(style);
            } else {
                document.appendChild(style);
            }

            // 3. Use MutationObserver to strip src/srcset from images to prevent preload requests
            const blockImage = (el) => {
                if (el.tagName === 'IMG') {
                    if (el.src && !el.src.startsWith('data:')) {
                        el.setAttribute('data-original-src', el.src);
                        el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    }
                    if (el.srcset) {
                        el.setAttribute('data-original-srcset', el.srcset);
                        el.srcset = '';
                    }
                } else if (el.tagName === 'SOURCE') {
                    if (el.srcset) {
                        el.setAttribute('data-original-srcset', el.srcset);
                        el.srcset = '';
                    }
                }
            };

            const traverseAndBlock = (node) => {
                if (node.nodeType !== 1) return;
                if (node.tagName === 'IMG' || node.tagName === 'SOURCE') {
                    blockImage(node);
                }
                const descendants = node.querySelectorAll('img, source');
                descendants.forEach(blockImage);
            };

            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        traverseAndBlock(node);
                    }
                }
            });

            // Start observing as early as possible
            observer.observe(document.documentElement || document, {
                childList: true,
                subtree: true
            });

            console.log('[Fab Helper] Injected CSP, CSS, and MutationObserver to block images/media/iframes/fonts.');
        }
    } catch (e) {
        console.error('[Fab Helper] Failed to inject CSP:', e);
    }
})();

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

// Triggers hide/show + status check when ownership data arrives, debounced so
// multiple listings-states responses in a burst coalesce into a single DOM pass.
let _ownedStatusUpdateTimer = null;
function triggerOwnedStatusUpdate() {
    if (State.isWorkerTab) return;
    clearTimeout(_ownedStatusUpdateTimer);
    _ownedStatusUpdateTimer = setTimeout(() => {
        if (State.hideSaved) {
            try { TaskRunner.scheduleHideOrShow(); } catch (e) { }
        }
        try { TaskRunner.checkVisibleCardsStatus().catch(() => { }); } catch (e) { }
    }, 50);
}

// 解析 listings-states URL 中的 listing_ids/listing_uids
function parseListingsStatesUrl(urlString) {
    try {
        const urlObj = new URL(urlString, window.location.origin);
        const uids = [];
        let paramName = 'listing_ids';

        if (urlObj.searchParams.has('listing_ids')) {
            uids.push(...urlObj.searchParams.getAll('listing_ids'));
            paramName = 'listing_ids';
        } else if (urlObj.searchParams.has('listing_uids')) {
            uids.push(...urlObj.searchParams.getAll('listing_uids'));
            paramName = 'listing_uids';
        }

        return { uids, paramName, urlObj };
    } catch (e) {
        return { uids: [], paramName: 'listing_ids', urlObj: null };
    }
}

// Setup XHR interceptor for caching
function setupXHRInterceptor() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...args) {
        if (url && typeof url === 'string' && url.includes('/i/users/me/listings-states')) {
            const { uids, paramName, urlObj } = parseListingsStatesUrl(url);
            if (uids.length > 0) {
                const doneUids = [];
                const activeUids = [];
                uids.forEach(uid => {
                    const itemUrl = `https://www.fab.com/listings/${uid}`;
                    if (Database.isDone(itemUrl)) {
                        doneUids.push(uid);
                    } else {
                        activeUids.push(uid);
                    }
                });

                if (doneUids.length > 0) {
                    this._doneUids = doneUids;
                    this._allUids = uids;
                    this._paramName = paramName;

                    if (activeUids.length > 0) {
                        // 只向服务器请求未入库的 ID
                        urlObj.searchParams.delete(paramName);
                        activeUids.forEach(uid => urlObj.searchParams.append(paramName, uid));
                        url = urlObj.toString();
                        Utils.logger('debug', `[XHR Intercept] 过滤已入库商品: 原请求 ${uids.length} 个, 过滤 ${doneUids.length} 个, 实际请求 ${activeUids.length} 个`);
                    } else {
                        // 所有商品都已入库，保留第一个 ID 触发一次超轻量请求以维持 XHR 状态机和 onload 事件的正常触发
                        urlObj.searchParams.delete(paramName);
                        urlObj.searchParams.append(paramName, uids[0]);
                        url = urlObj.toString();
                        this._allDoneBypass = true;
                        Utils.logger('debug', `[XHR Intercept] 所有 ${uids.length} 个商品均已本地入库，转换为单 ID 占位请求`);
                    }
                }
            }
        }
        this._url = url;
        return originalOpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const xhr = this;

        if (xhr._url && typeof xhr._url === 'string') {
            xhr.addEventListener('readystatechange', function () {
                if (xhr.readyState === 4 && xhr.status === 200 && xhr._doneUids && xhr._doneUids.length > 0) {
                    try {
                        const originalText = xhr.responseText;
                        const rawData = JSON.parse(originalText);
                        const serverResults = Array.isArray(rawData) ? rawData : (API.extractStateData(rawData, 'XHRInterceptor') || []);

                        let mergedResults;
                        if (xhr._allDoneBypass) {
                            // 丢弃占位符的服务器结果，完全使用 Mock 数据
                            mergedResults = xhr._allUids.map(uid => ({
                                uid: uid,
                                acquired: true,
                                lastUpdatedAt: new Date().toISOString()
                            }));
                        } else {
                            // 合并服务器返回的数据与 Mock 数据
                            const mockDoneResponses = xhr._doneUids.map(uid => ({
                                uid: uid,
                                acquired: true,
                                lastUpdatedAt: new Date().toISOString()
                            }));
                            mergedResults = [...serverResults, ...mockDoneResponses];
                        }

                        DataCache.saveOwnedStatus(mergedResults);
                        triggerOwnedStatusUpdate();

                        const mergedText = JSON.stringify(mergedResults);
                        Object.defineProperty(xhr, 'responseText', { get: () => mergedText, configurable: true });
                        Object.defineProperty(xhr, 'response', {
                            get: () => {
                                if (xhr.responseType === 'json') {
                                    return mergedResults;
                                }
                                return mergedText;
                            },
                            configurable: true
                        });
                    } catch (e) {
                        Utils.logger('error', `XHR 状态拦截合并失败: ${e.message}`);
                    }
                }
            });

            xhr.addEventListener('load', function () {
                if (xhr.readyState === 4 && xhr.status === 200 && !xhr._doneUids) {
                    try {
                        const responseData = JSON.parse(xhr.responseText);

                        if (xhr._url.includes('/i/listings/search') && responseData.results && Array.isArray(responseData.results)) {
                            DataCache.saveListings(responseData.results);
                        } else if (xhr._url.includes('/i/users/me/listings-states')) {
                            if (Array.isArray(responseData)) {
                                DataCache.saveOwnedStatus(responseData);
                                triggerOwnedStatusUpdate();
                            } else {
                                const extractedData = API.extractStateData(responseData, 'XHRInterceptor');
                                if (Array.isArray(extractedData) && extractedData.length > 0) {
                                    DataCache.saveOwnedStatus(extractedData);
                                    triggerOwnedStatusUpdate();
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
        let url = args[0]?.toString() || '';

        if (url.includes('/i/users/me/listings-states')) {
            const { uids, paramName, urlObj } = parseListingsStatesUrl(url);
            if (uids.length > 0) {
                const doneUids = [];
                const activeUids = [];
                uids.forEach(uid => {
                    const itemUrl = `https://www.fab.com/listings/${uid}`;
                    if (Database.isDone(itemUrl)) {
                        doneUids.push(uid);
                    } else {
                        activeUids.push(uid);
                    }
                });

                if (doneUids.length > 0) {
                    const mockDoneResponses = doneUids.map(uid => ({
                        uid: uid,
                        acquired: true,
                        lastUpdatedAt: new Date().toISOString()
                    }));

                    // 情况 1: 全部已入库 -> 完全绕过网络请求，直接返回 Mock 响应
                    if (activeUids.length === 0) {
                        Utils.logger('info', `[Fetch Intercept] 所有 ${uids.length} 个商品均已本地入库，完全绕过网络请求`);
                        
                        DataCache.saveOwnedStatus(mockDoneResponses);
                        triggerOwnedStatusUpdate();

                        return new Response(JSON.stringify(mockDoneResponses), {
                            status: 200,
                            statusText: 'OK',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // 情况 2: 部分未入库 -> 过滤掉已入库的商品 ID，只请求未知的 ID
                    urlObj.searchParams.delete(paramName);
                    activeUids.forEach(uid => urlObj.searchParams.append(paramName, uid));
                    url = urlObj.toString();
                    args[0] = url;
                    Utils.logger('debug', `[Fetch Intercept] 过滤已入库商品: 原请求 ${uids.length} 个, 过滤 ${doneUids.length} 个, 实际请求 ${activeUids.length} 个`);

                    if (window._apiWaitStatus) {
                        window._apiWaitStatus.lastApiActivity = Date.now();
                    }

                    try {
                        const response = await originalFetch.apply(this, args);
                        if (response.ok) {
                            const clonedResponse = response.clone();
                            const rawData = await clonedResponse.json();
                            const serverResults = Array.isArray(rawData) ? rawData : (API.extractStateData(rawData, 'FetchInterceptor') || []);

                            const mergedResults = [...serverResults, ...mockDoneResponses];
                            DataCache.saveOwnedStatus(mergedResults);
                            triggerOwnedStatusUpdate();

                            return new Response(JSON.stringify(mergedResults), {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });
                        }
                        return response;
                    } catch (e) {
                        Utils.logger('error', `拦截 fetch listings-states 失败，使用原始 fetch 回退: ${e.message}`);
                        return originalFetch.apply(this, args);
                    }
                }
            }
        }

        if (url.includes('/i/listings/search') ||
            url.includes('/i/users/me/listings-states') ||
            url.includes('/i/listings/prices-infos')) {

            if (window._apiWaitStatus) {
                window._apiWaitStatus.lastApiActivity = Date.now();
            }

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
                                triggerOwnedStatusUpdate();
                            } else {
                                const extractedData = API.extractStateData(data, 'FetchInterceptor');
                                if (Array.isArray(extractedData) && extractedData.length > 0) {
                                    DataCache.saveOwnedStatus(extractedData);
                                    triggerOwnedStatusUpdate();
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

                // Cache-first hide: if ownership data is already cached for these UIDs,
                // hide immediately. The listings-states interceptor handles the case
                // where data arrives later via triggerOwnedStatusUpdate().
                TaskRunner.checkVisibleCardsStatus().then(() => {
                    if (State.hideSaved) {
                        TaskRunner.scheduleHideOrShow();
                    }
                    if (State.appStatus === 'NORMAL' || State.autoAddOnScroll) {
                        TaskRunner.scanAndAddTasks(document.querySelectorAll(Config.SELECTORS.card))
                            .catch(error => Utils.logger('error', `自动添加任务失败: ${error.message}`));
                    }
                }).catch(() => {
                    if (State.hideSaved) {
                        TaskRunner.scheduleHideOrShow();
                    }
                });
            }, 300);
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
    // 间隔 10s：跳过已处理隐藏卡片（状态稳定），只检查可见未处理卡片
    setInterval(() => {
        if (!State.hideSaved && !State.hideDiscountedPaid && !State.hidePaid) return;
        const cards = document.querySelectorAll(Config.SELECTORS.card);
        let unprocessedCount = 0;

        cards.forEach(card => {
            // 已处理且已隐藏 → 状态完全稳定，跳过所有检查（这是最大 CPU 热点）
            if (card.getAttribute('data-fab-processed') === 'true' && card.style.display === 'none') return;

            const isProcessed = card.getAttribute('data-fab-processed') === 'true';
            if (!isProcessed) {
                unprocessedCount++;
            } else {
                // 只对可见的已处理卡片做状态一致性检查
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
            TaskRunner.scheduleHideOrShow();
        }
    }, 10000);

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
            // 只用 style.display 判断，避免 getComputedStyle 对每张卡片触发强制 reflow
            const visibleCards = Array.from(document.querySelectorAll(Config.SELECTORS.card)).filter(card => {
                return card.style.display !== 'none';
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

    // Cookie 级别快速判断
    const hasCookie = Utils.checkAuthentication(true); // silent mode
    if (!hasCookie) {
        Utils.logger('warn', '账号未登录，部分功能可能受限');
        State.isAuthenticated = false;
    } else {
        State.isAuthenticated = true;
    }

    // Check if worker tab
    const urlParams = new URLSearchParams(window.location.search);
    const workerId = urlParams.get('workerId');
    if (workerId) {
        State.isWorkerTab = true;
        State.workerTaskId = workerId;

        // worker tab: 启动前强校验 session，避免在未登录页里空跑
        if (!hasCookie || !(await Utils.verifyServerSession())) {
            Utils.logger('error', Utils.getText('auth_worker_aborted'));
            return;
        }

        await InstanceManager.init();
        Utils.logger('info', `工作标签页初始化完成，开始处理任务...`);
        await TaskRunner.processDetailPage();
        return;
    }

    await InstanceManager.init();
    await Database.load();

    // 在 UI 起来后再异步校验一次 session（cookie 还在但服务端已过期的常见场景）。
    // 不阻塞 UI，结果落到 State.isAuthenticated，后续 toggleExecution 时会再次硬校验。
    if (hasCookie) {
        Utils.verifyServerSession().then(ok => {
            if (!ok) {
                Utils.logger('warn', Utils.getText('auth_session_invalid'));
                State.isAuthenticated = false;
            }
        });
    }

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

            if (State.runningWorkers[workerId]) {
                delete State.runningWorkers[workerId];
                State.activeWorkers--;
            }

            if (logs && logs.length) {
                logs.forEach(log => {
                    // 工作线程的详细步骤默认作为 debug 级别输出，避免刷屏主控制台
                    Utils.logger('debug', log);
                });
            }

            const isZh = State.lang === 'zh';
            const timeSuffix = executionTime ? ` (${Utils.getText('task_execution_time', (executionTime / 1000).toFixed(2))})` : '';

            if (success) {
                const successMsg = isZh ? `✅ 任务完成: ${task.name}` : `✅ Task completed: ${task.name}`;
                Utils.logger('info', successMsg + timeSuffix);
                await Database.markAsDone(task);
                State.sessionCompleted.add(Database.normalizeListingUrl(task.url));
                State.executionCompletedTasks++;
            } else {
                // 任务失败时，从日志中寻找具体原因以 warn 级别显式输出
                const errorLog = logs && logs.length ? 
                    (logs.find(log => log.includes('Error') || log.includes('Timeout') || log.includes('failed') || log.includes('Critical')) || logs[logs.length - 1]) : 
                    (isZh ? '工作标签页报告失败' : 'Worker tab reported failure');
                const cleanError = errorLog ? errorLog.replace(/^\[[a-f0-9-]+\]\s*/i, '') : (isZh ? '未知原因' : 'Unknown reason');

                const failMsg = isZh ? `❌ 任务失败: ${task.name} (${cleanError})` : `❌ Task failed: ${task.name} (${cleanError})`;
                Utils.logger('warn', failMsg + timeSuffix);
                await Database.markAsFailed(task, {
                    reason: cleanError,
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

// ─── 锁屏 / 后台冻结恢复 ───────────────────────────────────────────────────
// 浏览器在标签页不可见（锁屏、切换到其他应用）时会暂停或大幅节流
// setInterval / setTimeout，导致 watchdog、任务调度全部冻结。
// 当标签页重新可见时，主动做一次恢复：
//   1. 清理冻结期间已超时但 watchdog 来不及处理的 stale workers
//   2. 若 isExecuting && todo 有任务，重新踢起 executeBatch
// ─────────────────────────────────────────────────────────────────────────────
function handleWakeRecovery() {
    // 只在主标签页（非 worker tab）执行恢复逻辑
    if (State.isWorkerTab) return;
    if (!State.isExecuting && State.db.todo.length === 0) return;

    Utils.logger('info', Utils.getText('log_wake_recovery'));

    // 1. 强制清理超时 worker（watchdog 在冻结期间无法运行）
    const now = Date.now();
    const STALL_TIMEOUT = Config.WORKER_TIMEOUT;
    let cleaned = 0;

    for (const workerId in State.runningWorkers) {
        const workerInfo = State.runningWorkers[workerId];
        if (!workerInfo) continue;
        if (now - workerInfo.startTime > STALL_TIMEOUT) {
            delete State.runningWorkers[workerId];
            State.activeWorkers = Math.max(0, State.activeWorkers - 1);
            GM_deleteValue(workerId).catch(() => {});
            cleaned++;
        }
    }

    if (cleaned > 0) {
        Utils.logger('warn', Utils.getText('log_wake_cleanup_stale', cleaned));
    }

    // 2. 重新启动执行循环
    if (State.db.todo.length > 0) {
        if (!State.isExecuting) {
            Utils.logger('info', Utils.getText('log_wake_restarting', State.db.todo.length));
            TaskRunner.startExecution();
        } else if (State.activeWorkers < Config.MAX_CONCURRENT_WORKERS) {
            Utils.logger('info', Utils.getText('log_wake_restarting', State.db.todo.length));
            TaskRunner.executeBatch();
        }
    }
}

// Check UI on visibility change
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        setTimeout(ensureUILoaded, 500);
        // 延迟一点让页面 JS 引擎完全恢复后再处理
        setTimeout(handleWakeRecovery, 1000);
    }
});

// focus 事件作为双重保险（某些锁屏场景只触发 focus 不触发 visibilitychange）
window.addEventListener('focus', () => {
    setTimeout(handleWakeRecovery, 1000);
});

// Run main function
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
