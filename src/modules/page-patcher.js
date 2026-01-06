/**
 * Fab Helper - Page Patcher Module
 * 
 * This module handles:
 * - Network request interception (XHR/Fetch)
 * - Cursor injection for scroll position restoration
 * - Rate limit detection from API responses
 * - Request debouncing to reduce API calls
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';
import { RateLimitManager } from './rate-limit-manager.js';

export const PagePatcher = {
    _patchHasBeenApplied: false,
    _lastSeenCursor: null,
    _lastCheckedUrl: null,
    _bodyObserver: null,

    // State for request debouncing
    _debounceXhrTimer: null,
    _pendingXhr: null,

    async init() {
        // 初始化时，从存储中加载上次保存的cursor
        try {
            const savedCursor = await GM_getValue(Config.DB_KEYS.LAST_CURSOR);
            if (savedCursor) {
                State.savedCursor = savedCursor;
                this._lastSeenCursor = savedCursor;
                Utils.logger('debug', `[Cursor] Initialized. Loaded saved cursor: ${savedCursor.substring(0, 30)}...`);
            } else {
                Utils.logger('debug', `[Cursor] Initialized. No saved cursor found.`);
            }
        } catch (e) {
            Utils.logger('warn', '[Cursor] Failed to restore cursor state:', e);
        }

        // 应用拦截器
        this.applyPatches();
        Utils.logger('debug', '[Cursor] Network interceptors applied.');

        // 监听URL变化，检测排序方式变更
        this.setupSortMonitor();
    },

    // 添加监听URL变化的方法，检测排序方式和筛选条件变更
    setupSortMonitor() {
        // 初始检查当前URL
        this.checkUrlChanges();

        // 使用MutationObserver监听URL变化
        if (typeof MutationObserver !== 'undefined') {
            const bodyObserver = new MutationObserver(() => {
                if (window.location.href !== this._lastCheckedUrl) {
                    this._lastCheckedUrl = window.location.href;
                    this.checkUrlChanges();
                    Utils.detectLanguage();
                }
            });

            bodyObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            this._bodyObserver = bodyObserver;
        }

        // 监听popstate事件（浏览器前进/后退按钮）
        window.addEventListener('popstate', () => {
            this.checkUrlChanges();
            Utils.detectLanguage();
        });

        // 监听hashchange事件
        window.addEventListener('hashchange', () => {
            this.checkUrlChanges();
            Utils.detectLanguage();
        });

        // 保存当前URL作为初始状态
        this._lastCheckedUrl = window.location.href;
    },

    // 检查URL变化（排序、搜索词、分类等）并重置状态
    checkUrlChanges() {
        try {
            const url = new URL(window.location.href);
            const currentSort = url.searchParams.get('sort_by');
            const currentQuery = url.searchParams.get('query') || url.searchParams.get('q'); // 兼容不同搜索参数
            const currentCategory = url.searchParams.get('category'); // 或 path 变化，这里主要看参数

            // 1. 处理排序变更
            if (currentSort) {
                // 查找匹配的排序选项
                let matchedOption = null;
                if (State.sortOptions) {
                    for (const [key, option] of Object.entries(State.sortOptions)) {
                        if (option.value === currentSort) {
                            matchedOption = key;
                            break;
                        }
                    }
                }

                // 如果找到匹配的排序选项，且与当前选项不同，则更新
                if (matchedOption && matchedOption !== State.currentSortOption) {
                    const previousSort = State.currentSortOption;
                    State.currentSortOption = matchedOption;
                    GM_setValue('fab_helper_sort_option', State.currentSortOption);

                    Utils.logger('debug', Utils.getText('log_url_sort_changed',
                        State.sortOptions?.[previousSort]?.name || previousSort,
                        State.sortOptions?.[State.currentSortOption]?.name || State.currentSortOption
                    ));

                    this.clearSavedPosition('Sort change');
                }
            }

            // 2. 简单的搜索词/分类变更检测
            // 这里我们对比上一次记录的关键参数 (如果存在)
            if (this._lastParams) {
                if (this._lastParams.query !== currentQuery ||
                    this._lastParams.category !== currentCategory) {
                    this.clearSavedPosition('Search/Filter change');
                }
            }

            // 更新记录的参数
            this._lastParams = {
                query: currentQuery,
                category: currentCategory,
                sort: currentSort
            };

        } catch (e) {
            Utils.logger('warn', Utils.getText('log_sort_check_error', e.message));
        }
    },

    // 辅助方法：清除位置
    async clearSavedPosition(reason) {
        if (State.savedCursor) {
            State.savedCursor = null;
            await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
            if (State.UI && State.UI.savedPositionDisplay) {
                State.UI.savedPositionDisplay.textContent = Utils.getText('no_saved_position');
            }
            Utils.logger('info', `${Utils.getText('log_sort_changed_position_cleared')} (${reason})`);
        }
    },

    async handleSearchResponse(request) {
        if (request.status === 429) {
            await RateLimitManager.enterRateLimitedState('搜索响应429');
        } else if (request.status >= 200 && request.status < 300) {
            try {
                const responseText = request.responseText;
                if (responseText) {
                    const data = JSON.parse(responseText);
                    const hasResults = data && data.results && data.results.length > 0;
                    await RateLimitManager.recordSuccessfulRequest(Utils.getText('request_source_search_response'), hasResults);
                }
            } catch (e) {
                Utils.logger('warn', Utils.getText('search_response_parse_failed', e.message));
            }
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
        Utils.logger('debug', Utils.getText('page_patcher_match') + ` URL: ${url}`);
        return true;
    },

    getPatchedUrl(originalUrl) {
        if (State.savedCursor) {
            const urlObj = new URL(originalUrl, window.location.origin);
            urlObj.searchParams.set('cursor', State.savedCursor);
            const modifiedUrl = urlObj.pathname + urlObj.search;
            Utils.logger('debug', `[Cursor] ${Utils.getText('cursor_injecting')}: ${originalUrl}`);
            Utils.logger('debug', `[Cursor] ${Utils.getText('cursor_patched_url')}: ${modifiedUrl}`);
            this._patchHasBeenApplied = true;

            // UI 视觉反馈：高亮显示已恢复的位置
            if (State.UI && State.UI.savedPositionDisplay) {
                const container = State.UI.savedPositionDisplay.parentElement;
                if (container) {
                    const originalBg = container.style.backgroundColor;
                    container.style.transition = 'background-color 0.5s';
                    container.style.backgroundColor = '#d4edda'; // 浅绿色高亮
                    setTimeout(() => {
                        container.style.backgroundColor = originalBg;
                    }, 5000); // 5秒后恢复
                }
            }

            return modifiedUrl;
        }
        return originalUrl;
    },

    saveLatestCursorFromUrl(url) {
        try {
            if (typeof url !== 'string' || !url.includes('/i/listings/search') || !url.includes('cursor=')) return;
            const urlObj = new URL(url, window.location.origin);
            const newCursor = urlObj.searchParams.get('cursor');

            if (newCursor && newCursor !== this._lastSeenCursor) {
                this._lastSeenCursor = newCursor;
                State.savedCursor = newCursor;
                GM_setValue(Config.DB_KEYS.LAST_CURSOR, newCursor);

                if (State.debugMode) {
                    Utils.logger('debug', Utils.getText('debug_save_cursor', newCursor.substring(0, 30) + '...'));
                }

                if (State.UI && State.UI.savedPositionDisplay) {
                    State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(newCursor);
                }
            }
        } catch (e) {
            Utils.logger('warn', Utils.getText('log_cursor_save_error'), e);
        }
    },

    applyPatches() {
        const self = this;
        const originalXhrOpen = XMLHttpRequest.prototype.open;
        const originalXhrSend = XMLHttpRequest.prototype.send;
        const DEBOUNCE_DELAY_MS = 350;

        const listenerAwareSend = function (...args) {
            const request = this;
            const onLoad = () => {
                request.removeEventListener("load", onLoad);

                if (typeof window.recordNetworkActivity === 'function') {
                    window.recordNetworkActivity();
                }

                if (request.status >= 200 && request.status < 300 &&
                    request._url && self.isDebounceableSearch(request._url)) {
                    if (typeof window.recordNetworkRequest === 'function') {
                        window.recordNetworkRequest(Utils.getText('request_source_xhr_item'), true);
                    }
                }

                if (request.status === 429 || request.status === '429' || request.status.toString() === '429') {
                    Utils.logger('warn', Utils.getText('xhr_detected_429', request.responseURL || request._url));
                    RateLimitManager.enterRateLimitedState(request.responseURL || request._url || 'XHR响应429');
                    return;
                }

                if (request.status >= 200 && request.status < 300) {
                    try {
                        const responseText = request.responseText;
                        if (responseText) {
                            if (responseText.includes("Too many requests") ||
                                responseText.includes("rate limit") ||
                                responseText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                                Utils.logger('warn', Utils.getText('log_xhr_rate_limit_detect', responseText));
                                RateLimitManager.enterRateLimitedState('XHR响应内容限速');
                                return;
                            }

                            try {
                                const data = JSON.parse(responseText);

                                if (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit"))) {
                                    Utils.logger('warn', Utils.getText('detected_rate_limit_error', JSON.stringify(data)));
                                    RateLimitManager.enterRateLimitedState('XHR响应限速错误');
                                    return;
                                }

                                if (data.results && data.results.length === 0 && self.isDebounceableSearch(request._url)) {
                                    const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;
                                    const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;

                                    const urlObj = new URL(request._url, window.location.origin);
                                    const params = urlObj.searchParams;
                                    const hasSpecialFilters = params.has('query') || params.has('category') || params.has('subcategory') || params.has('tag');

                                    if (isEndOfList) {
                                        Utils.logger('info', Utils.getText('log_list_end_normal', JSON.stringify(data).substring(0, 200)));
                                        RateLimitManager.recordSuccessfulRequest('XHR列表末尾', true);
                                        return;
                                    } else if (isEmptySearch && hasSpecialFilters) {
                                        Utils.logger('info', Utils.getText('log_empty_search_with_filters', JSON.stringify(data).substring(0, 200)));
                                        RateLimitManager.recordSuccessfulRequest('XHR空搜索结果', true);
                                        return;
                                    } else if (isEmptySearch && State.appStatus === 'RATE_LIMITED') {
                                        Utils.logger('info', Utils.getText('log_empty_search_already_limited', JSON.stringify(data).substring(0, 200)));
                                        return;
                                    } else if (isEmptySearch && document.readyState !== 'complete') {
                                        Utils.logger('info', Utils.getText('log_empty_search_page_loading', JSON.stringify(data).substring(0, 200)));
                                        return;
                                    } else if (isEmptySearch && Date.now() - (window.pageLoadTime || 0) < 5000) {
                                        Utils.logger('info', Utils.getText('empty_search_initial'));
                                        return;
                                    } else {
                                        Utils.logger('warn', Utils.getText('detected_possible_rate_limit_empty', JSON.stringify(data).substring(0, 200)));
                                        RateLimitManager.enterRateLimitedState('XHR响应空结果');
                                        return;
                                    }
                                }

                                if (self.isDebounceableSearch(request._url) && data.results && data.results.length > 0) {
                                    RateLimitManager.recordSuccessfulRequest(Utils.getText('request_source_xhr_search'), true);
                                }
                            } catch (jsonError) {
                                // JSON解析错误，忽略
                            }
                        }
                    } catch (e) {
                        // 解析错误，忽略
                    }
                }

                if (self.isDebounceableSearch(request._url)) {
                    self.handleSearchResponse(request);
                }
            };
            request.addEventListener("load", onLoad);

            return originalXhrSend.apply(request, args);
        };

        XMLHttpRequest.prototype.open = function (method, url, ...args) {
            let modifiedUrl = url;
            if (self.shouldPatchUrl(url)) {
                modifiedUrl = self.getPatchedUrl(url);
                this._isDebouncedSearch = false;
            } else if (self.isDebounceableSearch(url)) {
                self.saveLatestCursorFromUrl(url);
                this._isDebouncedSearch = true;
            } else {
                self.saveLatestCursorFromUrl(url);
            }
            this._url = modifiedUrl;
            return originalXhrOpen.apply(this, [method, modifiedUrl, ...args]);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            if (!this._isDebouncedSearch) {
                return listenerAwareSend.apply(this, args);
            }

            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('log_debounce_intercept', DEBOUNCE_DELAY_MS));
            }

            if (self._pendingXhr) {
                self._pendingXhr.abort();
                Utils.logger('info', Utils.getText('log_debounce_discard'));
            }
            clearTimeout(self._debounceXhrTimer);

            self._pendingXhr = this;

            self._debounceXhrTimer = setTimeout(() => {
                if (State.debugMode) {
                    Utils.logger('debug', Utils.getText('log_debounce_sending', this._url));
                }
                listenerAwareSend.apply(self._pendingXhr, args);
                self._pendingXhr = null;
            }, DEBOUNCE_DELAY_MS);
        };

        const originalFetch = window.fetch;
        window.fetch = function (input, init) {
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

            return originalFetch.apply(this, [modifiedInput, init])
                .then(async response => {
                    if (typeof window.recordNetworkActivity === 'function') {
                        window.recordNetworkActivity();
                    }

                    if (response.status >= 200 && response.status < 300 &&
                        typeof url === 'string' && self.isDebounceableSearch(url)) {
                        if (typeof window.recordNetworkRequest === 'function') {
                            window.recordNetworkRequest('Fetch商品请求', true);
                        }
                    }

                    if (response.status === 429 || response.status === '429' || response.status.toString() === '429') {
                        response.clone();
                        Utils.logger('warn', Utils.getText('log_fetch_detected_429', response.url));
                        RateLimitManager.enterRateLimitedState('Fetch响应429').catch(e =>
                            Utils.logger('error', Utils.getText('log_handling_rate_limit_error', e.message))
                        );
                    }

                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const clonedResponse = response.clone();
                            const text = await clonedResponse.text();

                            if (text.includes("Too many requests") ||
                                text.includes("rate limit") ||
                                text.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                                Utils.logger('warn', Utils.getText('log_fetch_rate_limit_detect', text.substring(0, 100)));
                                RateLimitManager.enterRateLimitedState('Fetch响应内容限速').catch(e =>
                                    Utils.logger('error', Utils.getText('log_handling_rate_limit_error', e.message))
                                );
                                return response;
                            }

                            try {
                                const data = JSON.parse(text);

                                if (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit"))) {
                                    Utils.logger('warn', Utils.getText('detected_rate_limit_error', 'API限速响应'));
                                    RateLimitManager.enterRateLimitedState('API限速响应').catch(e =>
                                        Utils.logger('error', Utils.getText('log_handling_rate_limit_error', e.message))
                                    );
                                    return response;
                                }

                                const responseUrl = response.url || '';
                                if (data.results && data.results.length === 0 && responseUrl.includes('/i/listings/search')) {
                                    const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;
                                    const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;

                                    const urlObj = new URL(responseUrl, window.location.origin);
                                    const params = urlObj.searchParams;
                                    const hasSpecialFilters = params.has('query') || params.has('category') || params.has('subcategory') || params.has('tag');

                                    if (isEndOfList) {
                                        Utils.logger('info', Utils.getText('log_fetch_list_end', JSON.stringify(data).substring(0, 200)));
                                        RateLimitManager.recordSuccessfulRequest('Fetch列表末尾', true);
                                    } else if (isEmptySearch && hasSpecialFilters) {
                                        Utils.logger('info', Utils.getText('log_fetch_empty_with_filters', JSON.stringify(data).substring(0, 200)));
                                        RateLimitManager.recordSuccessfulRequest('Fetch空搜索结果', true);
                                    } else if (isEmptySearch && State.appStatus === 'RATE_LIMITED') {
                                        Utils.logger('info', Utils.getText('log_fetch_empty_already_limited', JSON.stringify(data).substring(0, 200)));
                                    } else if (isEmptySearch && document.readyState !== 'complete') {
                                        Utils.logger('info', Utils.getText('log_fetch_empty_page_loading', JSON.stringify(data).substring(0, 200)));
                                    } else if (isEmptySearch && Date.now() - (window.pageLoadTime || 0) < 5000) {
                                        Utils.logger('info', Utils.getText('empty_search_initial'));
                                    } else {
                                        Utils.logger('warn', Utils.getText('log_fetch_implicit_rate_limit', JSON.stringify(data).substring(0, 200)));
                                        RateLimitManager.enterRateLimitedState('Fetch响应空结果').catch(e =>
                                            Utils.logger('error', Utils.getText('log_handling_rate_limit_error', e.message))
                                        );
                                    }
                                }
                            } catch (jsonError) {
                                Utils.logger('debug', Utils.getText('log_json_parse_error', jsonError.message));
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
