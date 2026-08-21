/**
 * Fab Helper - Task Runner Module
 * 
 * This module handles:
 * - Task execution and batch processing
 * - Card status checking and filtering
 * - Worker tab management
 * - Detail page processing
 * - DOM observation for infinite scroll
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';
import { DataCache } from './data-cache.js';
import { Database } from './database.js';
import { API } from './api.js';
import { RateLimitManager } from './rate-limit-manager.js';
import { PageDiagnostics } from './page-diagnostics.js';
import { PagePatcher } from './page-patcher.js';
import { InstanceManager } from './instance-manager.js';
import { KeepAlive } from './keepalive.js';

// 捕获真实 setTimeout 的值（注意：必须是「值」而非箭头闭包，否则调用时会重新解析到
// 被测试 mock 的 globalThis.setTimeout）。自动滚动的分步延时需要真实定时器：
// 测试环境会 mock globalThis.setTimeout（只入队不执行），若分步延时引用它会导致
// promise 永远挂起、attemptAutoScroll 无法推进。3000ms 的兜底等待仍用被 mock 的
// globalThis.setTimeout（由测试手动 flush），不受影响。
const _realSetTimeout = (typeof setTimeout === 'function') ? setTimeout : (cb) => { try { cb(); } catch (_e) {} };

// Forward declaration for UI (will be set via dependency injection)
let UI = null;
let countdownRefresh = null;
// worker 回传监听注册函数（由 index.js 通过 deps 注入）。按 workerId 派生独立回传键
// 监听，避免旧版单键 WORKER_DONE 在多标签页并发完成时后者覆盖前者导致报告丢失/重复加库。
let registerWorkerDoneListener = null;

export function setUIReference(uiModule) {
    UI = uiModule;
}

export function setDependencies(deps = {}) {
    countdownRefresh = deps.countdownRefresh || countdownRefresh;
    registerWorkerDoneListener = deps.registerWorkerDoneListener || registerWorkerDoneListener;
}

export const TaskRunner = {
    findFreeLicenseOption: (root) => {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return null;
        }

        const candidates = Array.from(root.querySelectorAll('span, div'))
            .map(el => {
                const text = Utils.normalizeWhitespace(el.textContent || '');
                const clickTarget = el.closest('[role="option"], button, label, input[type="radio"]');
                return { text, clickTarget };
            })
            .filter(candidate => candidate.text && candidate.clickTarget);

        const hasExplicitFreeSignal = (text) => {
            const cleanText = text.replace(/royalty\s*-?\s*free/gi, '');
            return [...Config.FREE_TEXT_SET].some(freeWord => cleanText.includes(freeWord));
        };

        const explicitFree = candidates.find(candidate => hasExplicitFreeSignal(candidate.text));
        if (explicitFree) {
            return explicitFree.clickTarget;
        }

        const personalFree = candidates.find(candidate => {
            const isPersonal = candidate.text.includes('个人') || candidate.text.includes('Personal');
            return isPersonal && hasExplicitFreeSignal(candidate.text);
        });

        return personalFree ? personalFree.clickTarget : null;
    },

    getExternalProductState: (root = document) => {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return { handled: false };
        }

        // 防误判：如果页面上存在“添加到库 / 购买 / 免费获取”等主动作按钮，绝不判为外部链接处理项
        try {
            const buttons = root.querySelectorAll('button, a.fabkit-Button-root, [role="button"], a[class*="Button"], a[class*="button"]');
            if (buttons && buttons.length > 0) {
                const hasAcquisitionButton = [...buttons].some(btn => {
                    const text = Utils.normalizeWhitespace(btn?.textContent || '').toLowerCase();
                    return [...Config.ACQUISITION_TEXT_SET].some(k => text.includes(k.toLowerCase()));
                });
                if (hasAcquisitionButton) {
                    return { handled: false };
                }
            }
        } catch (e) {
            // Unit test mock querySelectorAll support
        }

        const currentHref = (typeof window !== 'undefined' && window.location?.href)
            ? window.location.href
            : 'https://www.fab.com/';
        const currentHostname = (typeof window !== 'undefined' && window.location?.hostname)
            ? window.location.hostname
            : 'www.fab.com';
        
        let links = [];
        try {
            links = [...root.querySelectorAll('a[href]')];
        } catch (e) {
            return { handled: false };
        }

        const externalLink = links.find(link => {
            const text = Utils.normalizeWhitespace(link.textContent || '');
            if (!text || ![...Config.EXTERNAL_CTA_TEXT_SET].some(label => text.includes(label))) {
                return false;
            }

            const rect = typeof link.getBoundingClientRect === 'function'
                ? link.getBoundingClientRect()
                : { width: 1, height: 1 };
            if (rect.width === 0 || rect.height === 0) {
                return false;
            }

            try {
                const href = link.href || link.getAttribute?.('href');
                if (!href) return false;
                const targetUrl = new URL(href, currentHref);
                return targetUrl.hostname !== currentHostname;
            } catch (error) {
                return false;
            }
        });

        if (!externalLink) {
            return { handled: false };
        }

        const text = Utils.normalizeWhitespace(externalLink.textContent || '');
        return {
            handled: true,
            reason: `External CTA "${text}"`,
            href: externalLink.href || externalLink.getAttribute?.('href') || ''
        };
    },

    hasSavedLibraryText: (card) => {
        const cardText = Utils.normalizeWhitespace(card.textContent || '');
        return [...Config.SAVED_TEXT_SET].some(savedText => cardText.includes(savedText));
    },

    hasPositivePriceText: (text) => {
        // Match common currency symbols/codes + numbers (with option dot/comma decimals)
        const regex = /(?:[$¥€£₩₹₪₫₱฿]|USD|EUR|CNY|GBP|JPY|CAD|AUD)\s*(\d+(?:[.,]\d{1,2})?)\b|\b(\d+(?:[.,]\d{1,2})?)\s*(?:[$¥€£₩₹₪₫₱฿]|USD|EUR|CNY|GBP|JPY|CAD|AUD)/gi;
        const priceMatches = Utils.normalizeWhitespace(text || '').match(regex);
        if (!priceMatches) return false;

        return priceMatches.some(priceStr => {
            let cleanStr = priceStr
                .replace(/[$¥€£₩₹₪₫₱฿]|USD|EUR|CNY|GBP|JPY|CAD|AUD/gi, '')
                .trim();
            // 处理千分位与小数逗号：1,234.56 -> 1234.56（千分位），19,99 -> 19.99（小数逗号）
            if (cleanStr.includes(',')) {
                if (/,\d{3}(?:\.|$)/.test(cleanStr)) {
                    cleanStr = cleanStr.replace(/,/g, '');
                } else {
                    cleanStr = cleanStr.replace(',', '.');
                }
            }
            const numValue = parseFloat(cleanStr);
            return !isNaN(numValue) && numValue > 0.00;
        });
    },

    isCardSettled: (card) => {
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const url = link ? link.href.split('?')[0] : null;

        return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null ||
            TaskRunner.hasSavedLibraryText(card) ||
            TaskRunner.isFreeCard(card) ||
            TaskRunner.hasPositivePriceText(card.textContent || '') ||
            (url && (Database.isDone(url) || Database.isFailed(url) || State.sessionCompleted.has(Database.normalizeListingUrl(url))));
    },

    // Check if a card is finished (owned, done, or failed)
    isCardFinished: (card) => {
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const url = link ? link.href.split('?')[0] : null;
        const hasSavedText = TaskRunner.hasSavedLibraryText(card);

        if (!link) {
            const icons = card.querySelectorAll('i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled');
            if (icons.length > 0) return true;

            return hasSavedText;
        }

        const uidMatch = link.href.match(/listings\/([a-f0-9-]+)/);
        if (!uidMatch || !uidMatch[1]) return false;

        const uid = uidMatch[1];

        if (DataCache.ownedStatus.has(uid)) {
            const status = DataCache.ownedStatus.get(uid);
            if (status && status.acquired) return true;
        }

        if (card.querySelector(Config.SELECTORS.ownedStatus) !== null || hasSavedText) {
            if (uid) {
                DataCache.saveOwnedStatus([{
                    uid: uid,
                    acquired: true,
                    lastUpdatedAt: new Date().toISOString()
                }]);
            }
            return true;
        }

        if (url) {
            if (Database.isDone(url)) return true;
            if (Database.isFailed(url)) return true;
            if (State.sessionCompleted.has(Database.normalizeListingUrl(url))) return true;
        }

        return false;
    },

    // Check if a card represents a free item
    isFreeCard: (card) => {
        const rawText = card.textContent || '';
        const cardText = Utils.normalizeWhitespace(rawText);

        const cleanText = cardText.replace(/royalty\s*-?\s*free/gi, '');

        // 1. Check for explicit keywords
        const hasFreeKeyword = [...Config.FREE_TEXT_SET].some(freeWord => cleanText.includes(freeWord));

        // 2. Check for -100% discount (handles various spacings like -100%, - 100%, -100 % etc.)
        const has100PercentDiscount = /-\s*100\s*%\s*(?:OFF|折扣)?/i.test(cleanText);

        // Extract all price-like strings (e.g. $1.99, $0.00)
        // Using a more robust regex that catches price formats
        const hasPositivePrice = TaskRunner.hasPositivePriceText(cardText);

        if (hasPositivePrice) {
            // STRICT RULE: If there is a price > 0, it is PAID, UNLESS:
            // 1. There is a -100% discount tag, OR
            // 2. There is also a "Free" keyword present (mixed license: e.g. Personal=$X, Professional=Free)
            // This overrides any non-license "Free" keyword (like "Royalty Free" or "Hassle Free").
            if (!has100PercentDiscount && !hasFreeKeyword) {
                return false;
            }
        }

        // If no positive price found (or it's discounted to free), check for keywords
        return hasFreeKeyword || has100PercentDiscount;
    },

    // Check if a card is a discounted paid item
    isDiscountedPaidCard: (card) => {
        if (TaskRunner.isFreeCard(card)) return false; // If it's free, it's not a "discounted paid" item

        const rawText = card.textContent || '';
        const cardText = Utils.normalizeWhitespace(rawText);
        // Look for -XX% pattern or "Save"/"Off" with percentage
        const hasDiscountTag = /-\d+%/.test(cardText) || cardText.includes('% off') || cardText.includes('% Off');

        // Also check simplified "Save $X" if need be, but percentage is standard on Fab
        // For now, stick to percentage to avoid false positives

        if (!hasDiscountTag) return false;

        // Double check positive price
        return TaskRunner.hasPositivePriceText(cardText);
    },

    // Toggle execution state
    toggleExecution: async () => {
        if (!Utils.checkAuthentication()) return;

        if (State.isExecuting) {
            State.isExecuting = false;
            Database.saveExecutingState();
            State.runningWorkers = {};
            State.activeWorkers = 0;
            State.executionTotalTasks = 0;
            State.executionCompletedTasks = 0;
            State.executionFailedTasks = 0;
            // 重置会话级跟踪，避免同会话重启后漏处理或重复计数
            State.processedCardUids = new Set();
            State.knownCursors = new Set();
            State.sessionCompleted = new Set();
            State.sessionFailed = new Set();
            State.autoScrollAttempts = 0;
            Utils.logger('info', Utils.getText('log_execution_stopped'));
            if (UI) UI.update();
            return;
        }

        // 在启动任务之前再次硬校验服务端 session，避免 cookie 还在但 session 已过期时
        // 把所有商品当作免费空跑（未登录态卡片上拿不到价格信息）。
        const sessionOk = await Utils.verifyServerSession();
        if (!sessionOk) {
            Utils.notifyAuthFailure();
            return;
        }

        if (State.autoAddOnScroll || State.autoScroll) {
            Utils.logger('info', Utils.getText('log_auto_add_enabled'));
            // 启动前先强制扫描一次当前可见卡片
            Utils.logger('debug', '启动任务前正在确认当前页面商品识别状态...');
            TaskRunner.checkVisibleCardsStatus().then(() => {
                Utils.logger('debug', '正在扫描当前页面符合条件的商品...');
                TaskRunner.scanAndAddTasks(document.querySelectorAll(TaskRunner.getVisibleCardSelector())).then(() => {
                    TaskRunner.startExecution();
                });
            });
            return;
        }

        State.db.todo = [];
        Utils.logger('info', Utils.getText('log_todo_cleared'));

        Utils.logger('debug', Utils.getText('log_scanning_items'));
        const cards = document.querySelectorAll(TaskRunner.getVisibleCardSelector());
        const newlyAddedList = [];
        let alreadyInQueueCount = 0;
        let ownedCount = 0;
        let skippedCount = 0;

        cards.forEach(card => {
            if (TaskRunner.isCardHidden(card)) return;
            if (!TaskRunner.isCardSettled(card)) {
                skippedCount++;
                return;
            }

            if (TaskRunner.isCardFinished(card)) {
                ownedCount++;
                return;
            }

            const link = card.querySelector(Config.SELECTORS.cardLink);
            const url = link ? link.href.split('?')[0] : null;
            if (!url) return;

            if (Database.isTodo(url)) {
                alreadyInQueueCount++;
                return;
            }

            if (!TaskRunner.isFreeCard(card)) return;

            const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() ||
                card.querySelector('a[href*="/listings/"]')?.textContent.trim() ||
                Utils.getText('untitled');
            newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
        });

        if (skippedCount > 0) {
            Utils.logger('debug', Utils.getText('log_skipped_unsettled', skippedCount));
        }

        if (newlyAddedList.length > 0) {
            State.db.todo.push(...newlyAddedList);
            Utils.logger('info', Utils.getText('log_added_to_queue', newlyAddedList.length));
        }

        const actionableCount = State.db.todo.length;
        if (actionableCount > 0) {
            if (newlyAddedList.length === 0 && alreadyInQueueCount > 0) {
                Utils.logger('info', Utils.getText('log_all_in_queue', alreadyInQueueCount));
            }
            TaskRunner.checkVisibleCardsStatus().then(() => {
                TaskRunner.startExecution();
            });
        } else {
            Utils.logger('info', Utils.getText('log_no_new_items', ownedCount, skippedCount));
            if (UI) UI.update();
        }
    },

    // Start execution without scanning
    startExecution: () => {
        if (State.isExecuting) {
            const newTotal = State.db.todo.length;
            if (newTotal > State.executionTotalTasks) {
                Utils.logger('info', Utils.getText('log_new_tasks_added', newTotal));
                State.executionTotalTasks = newTotal;
                if (UI) UI.update();
            } else {
                Utils.logger('info', Utils.getText('log_executor_running'));
            }
            return;
        }

        if (State.db.todo.length === 0) {
            Utils.logger('debug', Utils.getText('log_exec_no_tasks'));
            return;
        }

        Utils.logger('info', Utils.getText('log_starting_execution', State.db.todo.length));

        // 强制激活当前实例，确保多标签页环境下由用户操作的标签页接管
        if (typeof InstanceManager !== 'undefined' && InstanceManager.activate) {
            InstanceManager.activate();
        }

        // 启动后台保活：让本标签页在最小化/锁屏/切后台时仍能持续派发任务
        KeepAlive.start();

        State.isExecuting = true;
        Database.saveExecutingState();
        State.executionTotalTasks = State.db.todo.length;
        State.executionCompletedTasks = 0;
        State.executionFailedTasks = 0;
        State.autoScrollAttempts = 0; // Reset scroll attempts

        if (UI) UI.update();
        TaskRunner.executeBatch();
    },

    // Toggle hide saved items
    toggleHideSaved: async () => {
        State.hideSaved = !State.hideSaved;
        await Database.saveHidePref();
        TaskRunner.runHideOrShow();

        if (!State.hideSaved) {
            const { visible: actualVisibleCount } = TaskRunner.getCardCounts(true);
            Utils.logger('info', Utils.getText('log_display_mode_switched', actualVisibleCount));
        }

        if (UI) UI.update();
    },

    toggleAutoAdd: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.autoAddOnScroll = !State.autoAddOnScroll;
        await Database.saveAutoAddPref();
        Utils.logger('info', Utils.getText('log_auto_add_toggle', State.autoAddOnScroll ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    // 切换「脚本自动滚动页面以扫描全部」开关（默认关，独立于 autoAddOnScroll）
    toggleAutoScroll: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.autoScroll = !State.autoScroll;
        // 开启时重置「服务器到底」标记与尝试计数，避免上一轮残留的 isEndOfSearchList=true
        // 让本次一开就立即误判「自动入库成功」；由后续 /i/listings/search 响应如实重新确认。
        if (State.autoScroll) {
            State.isEndOfSearchList = false;
            State.autoScrollAttempts = 0;
            State.hasReachedBottomToastShown = false;
        }
        await Database.saveAutoScrollPref();
        Utils.logger('info', Utils.getText('log_auto_scroll_toggle', State.autoScroll ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    toggleAutoResume: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.autoResumeAfter429 = !State.autoResumeAfter429;
        await Database.saveAutoResumePref();
        Utils.logger('info', Utils.getText('log_auto_resume_toggle', State.autoResumeAfter429 ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    toggleRememberPosition: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.rememberScrollPosition = !State.rememberScrollPosition;
        await Database.saveRememberPosPref();
        Utils.logger('info', Utils.getText('log_remember_pos_toggle', State.rememberScrollPosition ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));

        if (!State.rememberScrollPosition) {
            if (typeof PagePatcher !== 'undefined' && PagePatcher.clearSavedPosition) {
                await PagePatcher.clearSavedPosition('Remember position disabled');
            } else {
                await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
                if (typeof sessionStorage !== 'undefined') {
                    try {
                        sessionStorage.removeItem('fab_helper_recovery_cursor');
                        sessionStorage.removeItem('fab_helper_last_recovery_cursor');
                    } catch (e) { }
                }
                State.savedCursor = null;
            }
        } else {
            if (typeof PagePatcher !== 'undefined' && PagePatcher.unlockCursorSaving) {
                PagePatcher.unlockCursorSaving();
            }
            if (State.UI && State.UI.savedPositionDisplay) {
                State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(State.savedCursor);
            }
        }

        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    toggleAutoRefreshEmpty: async () => {
        if (State.isTogglingSetting) return;
        State.isTogglingSetting = true;
        State.autoRefreshEmptyPage = !State.autoRefreshEmptyPage;
        await Database.saveAutoRefreshEmptyPref();
        Utils.logger('info', Utils.getText('log_auto_refresh_toggle', State.autoRefreshEmptyPage ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
        setTimeout(() => { State.isTogglingSetting = false; }, 200);
    },

    toggleHideDiscountedPaid: async () => {
        State.hideDiscountedPaid = !State.hideDiscountedPaid;
        await Database.saveHideDiscountedPref();
        TaskRunner.runHideOrShow();

        if (State.hideDiscountedPaid) {
            Utils.logger('info', '已开启隐藏打折付费商品');
        } else {
            Utils.logger('info', '已关闭隐藏打折付费商品');
        }

        if (UI) UI.update();
    },

    toggleHidePaid: async () => {
        State.hidePaid = !State.hidePaid;
        await Database.saveHidePaidPref();
        TaskRunner.runHideOrShow();

        if (State.hidePaid) {
            Utils.logger('info', '已开启隐藏付费商品');
        } else {
            Utils.logger('info', '已关闭隐藏付费商品');
        }

        if (UI) UI.update();
    },

    toggleBlockResources: async () => {
        State.blockLargeResources = !State.blockLargeResources;
        await Database.saveBlockResourcesPref();

        if (State.blockLargeResources) {
            Utils.logger('info', '已开启工作标签页大资源过滤');
        } else {
            Utils.logger('info', '已关闭工作标签页大资源过滤');
        }

        if (UI) UI.update();
    },

    stop: () => {
        if (!State.isExecuting) return;
        State.isExecuting = false;
        Database.saveExecutingState();
        Database.saveTodo();
        State.runningWorkers = {};
        State.activeWorkers = 0;
        State.executionTotalTasks = 0;
        State.executionCompletedTasks = 0;
        State.executionFailedTasks = 0;
        // 重置会话级跟踪，避免同会话重启后漏处理或重复计数
        State.processedCardUids = new Set();
        State.knownCursors = new Set();
        State.sessionCompleted = new Set();
        State.sessionFailed = new Set();
        State.autoScrollAttempts = 0;
        Utils.logger('info', Utils.getText('log_execution_stopped'));
        if (UI) UI.update();
    },

    runRecoveryProbe: async () => {
        const randomDelay = Math.floor(Math.random() * (30000 - 15000 + 1) + 15000);
        Utils.logger('info', Utils.getText('log_recovery_probe', (randomDelay / 1000).toFixed(1)));

        setTimeout(async () => {
            Utils.logger('info', Utils.getText('log_probing_connection'));
            try {
                const csrfToken = Utils.getCookie('fab_csrftoken');
                if (!csrfToken) {
                    Utils.checkAuthentication();
                    throw new Error("CSRF token not found for probe.");
                }
                const probeResponse = await API.gmFetch({
                    method: 'GET',
                    url: 'https://www.fab.com/i/users/context',
                    headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                });

                if (probeResponse.status === 429) {
                    throw new Error("Probe failed with 429. Still rate-limited.");
                } else if (probeResponse.status >= 200 && probeResponse.status < 300) {
                    await PagePatcher.handleSearchResponse({ status: 200 });
                    Utils.logger('info', Utils.getText('log_connection_restored'));
                    TaskRunner.toggleExecution();
                } else {
                    throw new Error(`Probe failed with unexpected status: ${probeResponse.status}`);
                }
            } catch (e) {
                Utils.logger('error', Utils.getText('log_recovery_failed', e.message));
                setTimeout(() => location.reload(), 2000);
            }
        }, randomDelay);
    },

    refreshVisibleStates: async () => {
        const API_ENDPOINT = 'https://www.fab.com/i/users/me/listings-states';
        const API_CHUNK_SIZE = 24;

        const isElementInViewport = (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
        };

        try {
            const csrfToken = Utils.getCookie('fab_csrftoken');
            if (!csrfToken) {
                Utils.checkAuthentication();
                throw new Error('CSRF token not found. Are you logged in?');
            }

            const uidsFromVisibleCards = new Set([...document.querySelectorAll(TaskRunner.getVisibleCardSelector())]
                .filter(isElementInViewport)
                .filter(card => {
                    const link = card.querySelector(Config.SELECTORS.cardLink);
                    if (!link) return false;
                    const url = link.href.split('?')[0];
                    // Only check status for items that are NOT done AND are detected as free.
                    // This prevents infinite looping on paid items like the $1.99 one.
                    // Also skip items that are already in the TODO queue to prevent redundant checks/logs while processing.
                    return !Database.isDone(url) && !Database.isTodo(url) && TaskRunner.isFreeCard(card);
                })
                .map(card => card.querySelector(Config.SELECTORS.cardLink)?.href.match(/listings\/([a-f0-9-]+)/)?.[1])
                .filter(Boolean));

            const uidsFromFailedList = new Set(State.db.failed.map(task => task.uid));
            const allUidsToCheck = Array.from(new Set([...uidsFromVisibleCards, ...uidsFromFailedList]));

            if (allUidsToCheck.length === 0) {
                Utils.logger('info', Utils.getText('log_no_items_to_check'));
                return;
            }

            Utils.logger('debug', Utils.getText('log_checking_items', uidsFromVisibleCards.size, uidsFromFailedList.size));

            const ownedUids = new Set();
            for (let i = 0; i < allUidsToCheck.length; i += API_CHUNK_SIZE) {
                const chunk = allUidsToCheck.slice(i, i + API_CHUNK_SIZE);
                const apiUrl = new URL(API_ENDPOINT);
                chunk.forEach(uid => apiUrl.searchParams.append('listing_ids', uid));

                Utils.logger('debug', Utils.getText('log_processing_batch', Math.floor(i / API_CHUNK_SIZE) + 1, chunk.length));

                const response = await fetch(apiUrl.href, {
                    headers: { 'accept': 'application/json, text/plain, */*', 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                });

                if (!response.ok) {
                    Utils.logger('warn', Utils.getText('log_batch_failed', response.status));
                    continue;
                }

                const rawData = await response.json();
                const data = API.extractStateData(rawData, 'RefreshStates');

                if (!data || !Array.isArray(data)) {
                    Utils.logger('warn', Utils.getText('log_unexpected_data_format'));
                    continue;
                }

                data.filter(item => item.acquired).forEach(item => ownedUids.add(item.uid));

                if (allUidsToCheck.length > i + API_CHUNK_SIZE) {
                    await new Promise(r => setTimeout(r, 250));
                }
            }

            Utils.logger('debug', Utils.getText('fab_dom_api_complete', ownedUids.size));

            let dbUpdated = false;
            const langPath = State.lang === 'zh' ? '/zh-cn' : '';

            if (ownedUids.size > 0) {
                const initialFailedCount = State.db.failed.length;
                State.db.failed = State.db.failed.filter(failedTask => !ownedUids.has(failedTask.uid));

                if (State.db.failed.length < initialFailedCount) {
                    dbUpdated = true;
                    ownedUids.forEach(uid => {
                        const url = `${window.location.origin}${langPath}/listings/${uid}`;
                        Database.addDoneUrl(url);
                    });
                    Utils.logger('info', Utils.getText('log_cleared_from_failed', initialFailedCount - State.db.failed.length));
                }
            }

            if (dbUpdated) {
                await Database.saveFailed();
                await Database.saveDone();
            }

            TaskRunner.runHideOrShow();

        } catch (e) {
            Utils.logger('error', Utils.getText('log_refresh_error'), e);
        }
    },

    retryFailedTasks: async () => {
        if (State.db.failed.length === 0) {
            Utils.logger('info', Utils.getText('log_no_failed_tasks'));
            return;
        }
        const count = State.db.failed.length;
        Utils.logger('info', Utils.getText('log_requeuing_tasks', count));
        State.db.todo.push(...State.db.failed);
        State.db.failed = [];
        await Database.saveFailed();
        Utils.logger('info', Utils.getText('log_tasks_moved', count));
        if (UI) UI.update();
    },

    // 检查并清理超时(卡死)的 worker。被 watchdog 定时器与后台心跳(KeepAlive)共同调用。
    // 抽成独立方法，是为了让主线程定时器被后台节流时，心跳也能驱动这套清理。
    // 返回被清理的 worker 数量。
    checkStalledWorkers: async () => {
        if (!State.isExecuting) return 0;

        const now = Date.now();
        const STALL_TIMEOUT = Config.WORKER_TIMEOUT;
        const stalledWorkers = [];

        for (const workerId in State.runningWorkers) {
            const workerInfo = State.runningWorkers[workerId];
            if (!workerInfo) continue;
            if (workerInfo.instanceId !== Config.INSTANCE_ID) continue;
            if (now - workerInfo.startTime > STALL_TIMEOUT) {
                stalledWorkers.push({ workerId, task: workerInfo.task });
            }
        }

        if (stalledWorkers.length === 0) return 0;

        Utils.logger('warn', Utils.getText('log_stalled_workers', stalledWorkers.length));

        for (const stalledWorker of stalledWorkers) {
            const { workerId, task } = stalledWorker;
            const workerInfo = State.runningWorkers[workerId];
            const stallDuration = workerInfo ? ((Date.now() - workerInfo.startTime) / 1000).toFixed(2) : '未知';

            Utils.logger('error', Utils.getText('log_watchdog_stalled', workerId.substring(0, 12)));

            // 使用增强的 markAsFailed 记录详细信息
            const _failRes = await Database.markAsFailed(task, {
                reason: '工作线程超时 (Watchdog)',
                logs: [`Worker ${workerId.substring(0, 12)} 超时`, `超时时长: ${stallDuration}s`],
                details: {
                    workerId: workerId,
                    stallDuration: `${stallDuration}s`,
                    timeout: `${Config.WORKER_TIMEOUT / 1000}s`
                }
            });
            if (!_failRes || !_failRes.retried) State.executionFailedTasks++;

            delete State.runningWorkers[workerId];
            State.activeWorkers = Math.max(0, State.activeWorkers - 1);
            await GM_deleteValue(workerId);
        }

        Utils.logger('info', Utils.getText('log_cleaned_workers', stalledWorkers.length, State.activeWorkers));
        if (UI) UI.update();
        return stalledWorkers.length;
    },

    runWatchdog: () => {
        if (State.watchdogTimer) clearInterval(State.watchdogTimer);

        State.watchdogTimer = setInterval(async () => {
            if (!InstanceManager.isActive) return;

            if (!State.isExecuting || Object.keys(State.runningWorkers).length === 0) {
                clearInterval(State.watchdogTimer);
                State.watchdogTimer = null;
                return;
            }

            const cleaned = await TaskRunner.checkStalledWorkers();
            if (cleaned > 0) {
                setTimeout(() => {
                    if (State.isExecuting && State.activeWorkers < Config.MAX_CONCURRENT_WORKERS && State.db.todo.length > 0) {
                        TaskRunner.executeBatch();
                    }
                }, 2000);
            }
        }, 5000);
    },

    executeBatch: async () => {
        if (!Utils.checkAuthentication()) return;

        if (!State.isWorkerTab && !InstanceManager.isActive) {
            Utils.logger('warn', Utils.getText('log_not_active_instance'));
            return;
        }

        if (!State.isExecuting) return;

        if (State.isDispatchingTasks) {
            Utils.logger('debug', 'Task dispatching already in progress, skipping executeBatch.');
            return;
        }

        State.isDispatchingTasks = true;

        try {
            if (State.db.todo.length === 0 && State.activeWorkers === 0) {
                if (State.autoScroll) {
                    State.isDispatchingTasks = false;
                    TaskRunner.attemptAutoScroll();
                    return;
                }
                await TaskRunner.stopExecutionAndSettle();
                State.isDispatchingTasks = false;
                return;
            }

            if (State.appStatus === 'RATE_LIMITED') {
                Utils.logger('info', Utils.getText('log_rate_limited_continue'));
            }

            if (State.activeWorkers >= Config.MAX_CONCURRENT_WORKERS) {
                Utils.logger('info', Utils.getText('log_max_workers_reached', Config.MAX_CONCURRENT_WORKERS));
                State.isDispatchingTasks = false;
                return;
            }

            const inFlightUIDs = new Set(Object.values(State.runningWorkers).map(w => w.task.uid));
            const todoList = [...State.db.todo];
            let dispatchedCount = 0;
            const dispatchedUIDs = new Set();
            const slotsAvailable = Config.MAX_CONCURRENT_WORKERS - State.activeWorkers;

            const tasksToDispatch = [];
            for (const task of todoList) {
                if (tasksToDispatch.length >= slotsAvailable) break;

                if (inFlightUIDs.has(task.uid) || dispatchedUIDs.has(task.uid)) {
                    Utils.logger('debug', Utils.getText('log_task_already_running', task.name));
                    continue;
                }

                if (Database.isDone(task.url)) {
                    Utils.logger('debug', Utils.getText('log_task_already_done', task.name));
                    State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
                    Database.saveTodo();
                    continue;
                }

                tasksToDispatch.push(task);
            }

            for (const task of tasksToDispatch) {
                dispatchedUIDs.add(task.uid);
                State.activeWorkers++;
                dispatchedCount++;

                const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                State.runningWorkers[workerId] = {
                    task,
                    startTime: Date.now(),
                    instanceId: Config.INSTANCE_ID
                };

                Utils.logger('debug', Utils.getText('log_dispatching_worker', workerId.substring(0, 12), task.name));

                const workerUrl = new URL(task.url);
                workerUrl.searchParams.set('workerId', workerId);

                await GM_setValue(workerId, {
                    task,
                    instanceId: Config.INSTANCE_ID
                });

                if (typeof registerWorkerDoneListener === 'function') {
                    registerWorkerDoneListener(workerId);
                }
                GM_openInTab(workerUrl.href, { active: false, insert: true });
            }

            if (dispatchedCount > 0) {
                Utils.logger('debug', Utils.getText('log_batch_dispatched', dispatchedCount));
            }

            if (!State.watchdogTimer && State.activeWorkers > 0) {
                TaskRunner.runWatchdog();
            }

            if (UI) UI.update();
        } finally {
            State.isDispatchingTasks = false;
        }
    },

    closeAllWorkerTabs: () => {
        const workerIds = Object.keys(State.runningWorkers);
        if (workerIds.length > 0) {
            Utils.logger('debug', Utils.getText('log_cleaning_workers_state', workerIds.length));
            for (const workerId of workerIds) {
                GM_deleteValue(workerId);
            }
            State.runningWorkers = {};
            State.activeWorkers = 0;
            Utils.logger('info', Utils.getText('log_workers_cleaned'));
        }
    },

    processDetailPage: async () => {
        if (!Utils.checkAuthentication()) return;

        const urlParams = new URLSearchParams(window.location.search);
        const workerId = urlParams.get('workerId');

        if (!workerId) return;

        State.isWorkerTab = true;
        State.workerTaskId = workerId;

        const startTime = Date.now();
        let hasReported = false;
        let closeAttempted = false;
        let payload = null;

        // worker 自身的超时兜底：略早于 manager 的 watchdog(WORKER_TIMEOUT)触发，
        // 让 worker 先主动上报失败(带真实耗时)再关闭，而不是被 watchdog 远程判死。
        const forceCloseTimer = setTimeout(() => {
            if (!closeAttempted) {
                console.log('工作标签页超时，主动上报并关闭');
                closeWorkerTab();
            }
        }, Math.max(10000, Config.WORKER_TIMEOUT - 5000));

        function closeWorkerTab() {
            closeAttempted = true;
            clearTimeout(forceCloseTimer);

            if (!hasReported && workerId) {
                try {
                    GM_setValue(Config.DB_KEYS.WORKER_DONE_PREFIX + workerId, {
                        workerId: workerId,
                        success: false,
                        logs: [Utils.getText('worker_closed')],
                        task: payload?.task,
                        instanceId: payload?.instanceId,
                        executionTime: Date.now() - startTime
                    });
                } catch (e) { /* ignore */ }
            }

            try {
                window.close();
            } catch (error) {
                Utils.logger('error', Utils.getText('log_close_worker_failed', error.message));
                try { window.location.href = 'about:blank'; } catch (e) { /* ignore */ }
            }
        }

        try {
            payload = await GM_getValue(workerId);
            // 跨标签页 GM 存储可能是异步提交：worker 标签页刚打开时偶尔读不到 manager 刚写入的
            // 任务数据，直接判「数据已清理」会误报「工作标签页在完成前关闭」。重试若干次再放弃。
            let readRetries = 6;
            while ((!payload || !payload.task) && readRetries-- > 0) {
                await new Promise(r => setTimeout(r, 400));
                payload = await GM_getValue(workerId);
            }
            if (!payload || !payload.task) {
                Utils.logger('info', Utils.getText('log_task_data_cleaned'));
                closeWorkerTab();
                return;
            }

            // 注意：不再拿全局 fab_active_instance 与 payload.instanceId 比较来判定
            // 「实例不符」而自杀。多个搜索标签并存时会互相覆盖 fab_active_instance，
            // 导致本 worker 的 owner 实例即使仍存活也被误判 mismatch 而自删关闭（漏加库根因）。
            // worker 自身的 forceCloseTimer 已做超时兜底；是否真正停止由 manager 清理
            // worker 数据（GM_deleteValue(workerId)）来信号化。

            const currentTask = payload.task;
            const logBuffer = [`[${workerId.substring(0, 12)}] Started: ${currentTask.name}`];
            let success = false;

            try {
                // 等待页面完全加载，使用多重检测机制
                const waitForPageReady = async () => {
                    const maxWait = 15000;
                    const startTime = Date.now();
                    let lastState = '';

                    while (Date.now() - startTime < maxWait) {
                        const currentState = document.readyState;
                        const hasMainContent = document.querySelector('main, .product-detail, [class*="listing"], [class*="detail"]');
                        const hasButtons = document.querySelectorAll('button, a.fabkit-Button-root, [role="button"], a[class*="Button"], a[class*="button"]').length > 0;
                        const hasTitle = document.querySelector('h1, .fabkit-Heading--xl');

                        if (currentState !== lastState) {
                            logBuffer.push(`页面状态: ${currentState}`);
                            lastState = currentState;
                        }

                        // 优化：在 'interactive' 或 'complete' 状态下，如果关键 DOM 元素已渲染，即可认定为就绪
                        const isReadyState = currentState === 'interactive' || currentState === 'complete';
                        if (isReadyState && hasMainContent && (hasButtons || hasTitle)) {
                            logBuffer.push(`页面就绪检测通过: readyState=${currentState}, hasContent=true`);
                            return true;
                        }

                        // 优化：将轮询检测间隔从 500ms 缩短到 100ms
                        await new Promise(r => setTimeout(r, 100));
                    }

                    logBuffer.push(`页面就绪检测超时 (${maxWait}ms)，继续尝试操作`);
                    return false;
                };

                const pageReady = await waitForPageReady();
                if (!pageReady) {
                    logBuffer.push(`⚠️ 警告: 页面可能未完全加载，这可能导致操作失败`);
                }



                // 等待关键 UI 元素出现（领取按钮 / 已保存指示器 / 外部 CTA），
                // 最长 2000ms 保留旧行为上限；如果元素已经在 DOM 上则立即继续。
                // 之前这里是无条件 setTimeout(2000)，是单任务耗时的主要来源。
                await (function waitForKeyElement(maxWait = 2000) {
                    const matchKey = () => {
                        const buttons = document.querySelectorAll('button, a.fabkit-Button-root, [role="button"], a[class*="Button"], a[class*="button"]');
                        for (const btn of buttons) {
                            const t = Utils.normalizeWhitespace(btn.textContent || '');
                            if (!t) continue;
                            const lowerT = t.toLowerCase();
                            if ([...Config.ACQUISITION_TEXT_SET].some(k => lowerT.includes(k.toLowerCase()))) return true;
                            if ([...Config.SAVED_TEXT_SET].some(k => lowerT.includes(k.toLowerCase()))) return true;
                            if ([...Config.EXTERNAL_CTA_TEXT_SET].some(k => lowerT.includes(k.toLowerCase()))) return true;
                        }
                        const bodyText = document.body && document.body.textContent;
                        if (bodyText) {
                            for (const phrase of Config.SAVED_TEXT_SET) {
                                if (bodyText.includes(phrase)) return true;
                            }
                        }
                        return false;
                    };
                    if (matchKey()) return Promise.resolve();
                    return new Promise(resolve => {
                        let done = false;
                        const finish = () => {
                            if (done) return;
                            done = true;
                            try { observer.disconnect(); } catch (e) { }
                            clearTimeout(timer);
                            resolve();
                        };
                        const observer = new MutationObserver(() => {
                            if (matchKey()) finish();
                        });
                        observer.observe(document.body, { childList: true, subtree: true });
                        const timer = setTimeout(finish, maxWait);
                    });
                })();


                // Check for adult content warning
                const adultContentWarning = document.querySelector('.fabkit-Heading--xl');
                if (adultContentWarning && (adultContentWarning.textContent.includes('成人内容') ||
                    adultContentWarning.textContent.includes('Adult Content') ||
                    adultContentWarning.textContent.includes('Mature Content'))) {
                    logBuffer.push(`检测到成人内容警告对话框，自动点击"继续"按钮...`);
                    const continueButton = [...document.querySelectorAll('button.fabkit-Button--primary')].find(btn =>
                        btn.textContent.includes('继续') || btn.textContent.includes('Continue')
                    );
                    if (continueButton) {
                        Utils.deepClick(continueButton);
                        logBuffer.push(`已点击"继续"按钮，等待页面加载...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                // Page diagnostics
                logBuffer.push(`=== 页面状态诊断开始 ===`);
                const diagnosticReport = PageDiagnostics.diagnoseDetailPage();
                logBuffer.push(`页面标题: ${diagnosticReport.pageTitle}`);
                logBuffer.push(`可见按钮数量: ${diagnosticReport.buttons.filter(btn => btn.isVisible).length}`);
                logBuffer.push(`=== 页面状态诊断结束 ===`);

                // API-First Ownership Check
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

                    let statesData;
                    try {
                        statesData = JSON.parse(response.responseText);
                        if (!Array.isArray(statesData)) {
                            statesData = API.extractStateData(statesData, 'SingleItemCheck');
                        }
                    } catch (e) {
                        logBuffer.push(`解析API响应失败: ${e.message}`);
                        statesData = [];
                    }

                    const isOwned = Array.isArray(statesData) && statesData.some(s => s && s.uid === currentTask.uid && s.acquired);
                    if (isOwned) {
                        logBuffer.push(`API check confirms item is already owned.`);
                        success = true;
                    } else {
                        logBuffer.push(`API check confirms item is not owned. Proceeding to UI interaction.`);
                    }
                } catch (apiError) {
                    logBuffer.push(`API ownership check failed: ${apiError.message}. Falling back to UI-based check.`);
                }

                // UI-based acquisition if API check didn't confirm ownership
                if (!success) {
                    const isItemOwned = () => {
                        const criteria = Config.OWNED_SUCCESS_CRITERIA;
                        const snackbar = document.querySelector('.fabkit-Snackbar-root, div[class*="Toast-root"]');
                        if (snackbar && criteria.snackbarText.some(text => snackbar.textContent.includes(text))) {
                            return { owned: true, reason: `Snackbar text "${snackbar.textContent}"` };
                        }
                        const allButtons = [...document.querySelectorAll('button, a.fabkit-Button-root, [role="button"], a[class*="Button"], a[class*="button"]')];
                        const ownedButton = allButtons.find(btn => criteria.buttonTexts.some(keyword => btn.textContent.includes(keyword)));
                        if (ownedButton) return { owned: true, reason: `Button text "${ownedButton.textContent}"` };

                        // 只有带有明确完整文案“已保存在我的库中”的指定状态标签才作为拥有判定
                        const ownedBadge = allButtons.find(btn => {
                            const text = Utils.normalizeWhitespace(btn.textContent || '');
                            return text === '已保存在我的库中' || text === 'Saved in My Library' || text === 'Saved in library' || text === '已保存在库中';
                        });
                        if (ownedBadge) return { owned: true, reason: `Badge text "${ownedBadge.textContent}"` };

                        return { owned: false };
                    };

                    const initialState = isItemOwned();
                    if (initialState.owned) {
                        logBuffer.push(`Item already owned on page load (UI Fallback PASS: ${initialState.reason}).`);
                        success = true;
                    } else {
                        const externalState = TaskRunner.getExternalProductState(document);
                        if (externalState.handled) {
                            logBuffer.push(`Detected non-purchasable external listing (${externalState.reason}). Marking task as handled.`);
                            success = true;
                        }
                    }

                    if (!success) {
                        // 记录关键按钮的文本，减少噪音
                        // 记录关键按钮的文本（注意：后台标签页可能被浏览器渲染挂起导致 getBoundingClientRect 返回 0，因此只需检查文本非空且非隐藏）
                        const buttonSelector = 'button, .fabkit-Button-root, [role="button"], [class*="Button"], [class*="button"], a[href]';
                        const allVisibleButtons = [...document.querySelectorAll(buttonSelector)].filter(btn => {
                            const text = btn.textContent.trim();
                            const style = window.getComputedStyle ? window.getComputedStyle(btn) : null;
                            const isHidden = style && (style.display === 'none' || style.visibility === 'hidden');
                            return text.length > 0 && !isHidden;
                        });

                        const criticalKeywords = [...Config.ACQUISITION_TEXT_SET, ...Config.FREE_TEXT_SET, '许可', 'License', 'Select', '选择', 'Add', '添加', 'Library', '库'];
                        const criticalButtons = allVisibleButtons.filter(btn => {
                            const text = btn.textContent;
                            return criticalKeywords.some(key => text.includes(key));
                        });

                        logBuffer.push(`=== 按钮检测: 可见=${allVisibleButtons.length}, 关键=${criticalButtons.length} ===`);
                        if (criticalButtons.length > 0) {
                            criticalButtons.slice(0, 5).forEach((btn, i) => {
                                logBuffer.push(`  关键按钮${i + 1}: "${btn.textContent.trim().substring(0, 40)}"`);
                            });
                        } else if (allVisibleButtons.length > 0) {
                            allVisibleButtons.slice(0, 3).forEach((btn, i) => {
                                logBuffer.push(`  按钮${i + 1}: "${btn.textContent.trim().substring(0, 40)}"`);
                            });
                        }

                        // 检查是否需要选择许可证（多许可证商品）
                        const licenseButton = allVisibleButtons.find(btn => {
                            const text = Utils.normalizeWhitespace(btn.textContent);
                            return text.includes('选择许可') ||
                                text.includes('Select license') ||
                                (btn.getAttribute('aria-haspopup') === 'true' && TaskRunner.isFreeCard(btn));
                        });

                        if (licenseButton) {
                            logBuffer.push(`Multi-license item detected. Setting up observer for dropdown.`);
                            try {
                                await new Promise((resolve, reject) => {
                                    const observer = new MutationObserver((mutationsList) => {
                                        for (const mutation of mutationsList) {
                                            if (mutation.addedNodes.length > 0) {
                                                for (const node of mutation.addedNodes) {
                                                    if (node.nodeType !== 1) continue;
                                                    const clickableParent = TaskRunner.findFreeLicenseOption(node);
                                                    if (clickableParent) {
                                                        logBuffer.push(`Found explicit free license option, clicking it.`);
                                                        Utils.deepClick(clickableParent);
                                                        observer.disconnect();
                                                        resolve();
                                                        return;
                                                    }
                                                }
                                            }
                                        }
                                    });

                                    observer.observe(document.body, { childList: true, subtree: true });
                                    logBuffer.push(`Clicking license button to open dropdown.`);
                                    Utils.deepClick(licenseButton);

                                    // 有时第一次点击可能不成功，1.5秒后再试一次
                                    setTimeout(() => {
                                        logBuffer.push(`Second attempt to click license button.`);
                                        Utils.deepClick(licenseButton);
                                    }, 1500);

                                    // 如果5秒内没有出现下拉菜单，则超时
                                    setTimeout(() => {
                                        observer.disconnect();
                                        reject(new Error('Timeout (5s): The free/personal option did not appear.'));
                                    }, 5000);
                                });

                                // 许可选择后等待UI更新
                                logBuffer.push(`License selected, waiting for UI update.`);
                                await new Promise(r => setTimeout(r, 2000)); // 增加等待时间

                                // 重新检查是否已拥有
                                if (isItemOwned().owned) {
                                    logBuffer.push(`Item became owned after license selection.`);
                                    success = true;
                                }
                            } catch (licenseError) {
                                logBuffer.push(`License selection failed: ${licenseError.message}`);
                            }
                        }

                        // 如果许可选择后仍未成功，或者不需要选择许可，尝试点击添加按钮
                        if (!success) {
                            // 持续轮询最多 8 秒查找动作按钮（防止前端 CSR/GraphQL 异步渲染延迟导致瞬间放弃）
                            let actionButton = null;
                            const findActionBtnStart = Date.now();
                            const findActionBtnMaxWait = 8000;

                            while (!actionButton && (Date.now() - findActionBtnStart < findActionBtnMaxWait)) {
                                const freshButtons = [...document.querySelectorAll(buttonSelector)].filter(btn => {
                                    const text = btn.textContent.trim();
                                    const style = window.getComputedStyle ? window.getComputedStyle(btn) : null;
                                    const isHidden = style && (style.display === 'none' || style.visibility === 'hidden');
                                    return text.length > 0 && !isHidden;
                                });

                                // 寻找动作按钮（匹配 ACQUISITION_TEXT_SET 集合中的任意动作文案）
                                actionButton = freshButtons.find(btn => {
                                    const text = Utils.normalizeWhitespace(btn.textContent).toLowerCase();
                                    return [...Config.ACQUISITION_TEXT_SET].some(keyword =>
                                        text.includes(keyword.toLowerCase())
                                    );
                                });

                                // 兜底：限时免费/折扣按钮
                                if (!actionButton) {
                                    actionButton = freshButtons.find(btn => {
                                        const text = Utils.normalizeWhitespace(btn.textContent);
                                        const hasFreeText = [...Config.FREE_TEXT_SET].some(freeWord => text.includes(freeWord));
                                        const hasDiscount = /-\s*100\s*%\s*(?:OFF|折扣)?/i.test(text);
                                        const hasPersonal = text.includes('个人') || text.includes('Personal');
                                        return hasFreeText && hasDiscount && hasPersonal;
                                    });
                                }

                                // 兜底：包含 add 与 library
                                if (!actionButton) {
                                    actionButton = freshButtons.find(btn => {
                                        const text = btn.textContent.toLowerCase();
                                        return (text.includes('add') && text.includes('library')) ||
                                            (text.includes('添加') && text.includes('库'));
                                    });
                                }

                                if (actionButton) break;
                                await new Promise(r => setTimeout(r, 400));
                            }

                            if (actionButton) {
                                logBuffer.push(`Found add button [${actionButton.textContent.trim().substring(0, 30)}], clicking it.`);
                                Utils.deepClick(actionButton);

                                // 等待添加操作完成
                                try {
                                    await new Promise((resolve, reject) => {
                                        const timeout = 60000;
                                        const startTime = Date.now();

                                        const interval = setInterval(() => {
                                            // 1. 检查是否已经拥有
                                            const currentState = isItemOwned();
                                            if (currentState.owned) {
                                                logBuffer.push(`Successfully owned (UI Match: ${currentState.reason})`);
                                                success = true;
                                                clearInterval(interval);
                                                resolve();
                                                return;
                                            }

                                            // 2. 积极寻找并点击 "Place Order" 按钮
                                            const allButtonsWithShadow = Utils.findAllButtonsWithShadow();

                                            // A. 优先尝试直接通过 Class 查找
                                            let checkoutBtn = allButtonsWithShadow.find(btn =>
                                                btn.classList.contains('payment-order-confirm__btn')
                                            );

                                            // B. 备用：通过文本查找（不判定 getBoundingClientRect，全面支持后台标签页）
                                            if (!checkoutBtn) {
                                                checkoutBtn = allButtonsWithShadow.find(btn => {
                                                    const text = Utils.normalizeWhitespace(btn.textContent).toLowerCase();
                                                    if (text.includes('buy now') || text.includes('立即购买')) return false;

                                                    const isCheckoutContext = (btn.ownerDocument !== document) || window.location.pathname.includes('/payment/');
                                                    if (isCheckoutContext) {
                                                        if (text.includes('add to library') || text.includes('添加到库') || text.includes('add to account') || text.includes('添加到账户')) {
                                                            return true;
                                                        }
                                                    }

                                                    const checkoutKeywords = [
                                                        'place order', '下单',
                                                        'checkout', '结账',
                                                        'complete order', '完成订单',
                                                        'confirm', '确认',
                                                        'claim', '领取',
                                                        'get', '获取',
                                                        'pay', '支付'
                                                    ];
                                                    return checkoutKeywords.some(kw => text.includes(kw));
                                                });
                                            }

                                            if (checkoutBtn && !checkoutBtn.disabled) {
                                                const lastClickTime = parseInt(checkoutBtn.dataset.lastClickTime || '0');
                                                const now = Date.now();

                                                if (now - lastClickTime > 2000) {
                                                    logBuffer.push(`Found checkout/place order button [${checkoutBtn.textContent.trim()}], clicking it.`);
                                                    checkoutBtn.dataset.lastClickTime = now.toString();
                                                    Utils.deepClick(checkoutBtn);
                                                }
                                            }

                                            if (Date.now() - startTime > timeout) {
                                                clearInterval(interval);
                                                reject(new Error(`Timeout waiting for page to enter an 'owned' state. (UI might be stuck)`));
                                            }
                                        }, 500);
                                    });

                                } catch (timeoutError) {
                                    logBuffer.push(`Timeout waiting for ownership: ${timeoutError.message}`);
                                }
                            } else {
                                logBuffer.push(`Could not find an add button.`);
                            }
                        }
                    }
                }
            } catch (error) {
                logBuffer.push(`A critical error occurred: ${error.message}`);
                success = false;
            } finally {
                // 失败时检测是否撞上人机验证/安全校验，给出明确归因(而非笼统超时/关闭)，
                // 便于事后区分「该适配的失败」与「被风控拦截的失败」。
                if (!success) {
                    try {
                        const vIframe = document.querySelector('iframe[src*="hcaptcha"], iframe[src*="recaptcha"], iframe[src*="captcha"], iframe[src*="turnstile"], iframe[src*="challenges.cloudflare.com"], iframe[src*="arkoselabs"]');
                        const bodyText = (document.body && document.body.innerText) || '';
                        const vPhrases = ['人机验证', '确认您是真人', '请完成安全验证', '我不是机器人', 'Verify you are human', "I'm not a robot", 'Checking your browser', 'complete the security check', 'unusual traffic'];
                        if (vIframe || vPhrases.some(p => bodyText.includes(p))) {
                            logBuffer.push(Utils.getText('worker_captcha'));
                        }
                    } catch (e) { /* ignore */ }
                }
                try {
                    hasReported = true;
                    await GM_setValue(Config.DB_KEYS.WORKER_DONE_PREFIX + workerId, {
                        workerId: workerId,
                        success: success,
                        logs: logBuffer,
                        task: currentTask,
                        instanceId: payload.instanceId,
                        executionTime: Date.now() - startTime
                    });
                } catch (error) {
                    console.error('Error setting worker done value:', error);
                }

                try {
                    await GM_deleteValue(workerId);
                } catch (error) {
                    console.error('Error deleting worker value:', error);
                }

                closeWorkerTab();
            }
        } catch (error) {
            Utils.logger('error', `Worker tab error: ${error.message}`);
            closeWorkerTab();
        }
    },

    // 节流标记：100ms 内多次调用只执行一次，消除 Observer/timer 风暴
    selectorWithSuffix: (selector, suffix) => {
        return selector
            .split(',')
            .map(part => `${part.trim()}${suffix}`)
            .join(', ');
    },

    getVisibleCardSelector: () => {
        return TaskRunner.selectorWithSuffix(Config.SELECTORS.card, ':not([data-fab-hidden="true"])');
    },

    isHideModeActive: () => {
        return State.hideSaved || State.hideDiscountedPaid || State.hidePaid;
    },

    getHideModeKey: () => {
        return [
            State.hideSaved ? 'saved' : '',
            State.hideDiscountedPaid ? 'discounted' : '',
            State.hidePaid ? 'paid' : ''
        ].join('|');
    },

    isCardHidden: (card) => {
        // 仅以 data-fab-hidden 属性判定隐藏态（setCardHidden 用 display:none 隐藏，
        // 不读 style.display，避免与“已处理且已隐藏”的稳定态判断冲突）。
        return card?.getAttribute?.('data-fab-hidden') === 'true';
    },

    invalidateCardCountCache: () => {
        State.cardCountCache.dirty = true;
    },

    refreshCardCountCache: (cardsArg = null) => {
        if (typeof document === 'undefined') {
            State.cardCountCache.total = 0;
            State.cardCountCache.hidden = 0;
            State.cardCountCache.visible = 0;
            State.cardCountCache.dirty = false;
            State.cardCountCache.documentRef = null;
            State.cardCountCache.href = '';
            State.hiddenThisPageCount = 0;
            return { total: 0, hidden: 0, visible: 0 };
        }

        const cards = cardsArg ? Array.from(cardsArg) : Array.from(document.querySelectorAll(Config.SELECTORS.card));
        const hidden = cards.reduce((count, card) => count + (TaskRunner.isCardHidden(card) ? 1 : 0), 0);
        const total = cards.length;
        const visible = total - hidden;

        State.cardCountCache.total = total;
        State.cardCountCache.hidden = hidden;
        State.cardCountCache.visible = visible;
        State.cardCountCache.dirty = false;
        State.cardCountCache.documentRef = document;
        State.cardCountCache.href = typeof window !== 'undefined' ? (window.location?.href || '') : '';
        State.hiddenThisPageCount = hidden;

        return { total, hidden, visible };
    },

    getCardCounts: (forceRefresh = false) => {
        const cache = State.cardCountCache;
        const href = typeof window !== 'undefined' ? (window.location?.href || '') : '';
        const documentChanged = typeof document !== 'undefined' && cache.documentRef !== document;
        const hrefChanged = cache.href !== href;

        if (forceRefresh || cache.dirty || documentChanged || hrefChanged) {
            return TaskRunner.refreshCardCountCache();
        }

        return {
            total: cache.total,
            hidden: cache.hidden,
            visible: cache.visible
        };
    },

    adjustCardCountCacheHidden: (delta) => {
        const cache = State.cardCountCache;
        if (cache.dirty) return;

        // 不再用 Math.min(cache.total, ...) 钳制：total 现已由 runHideOrShow 每次
        // 基于真实 DOM 校准，hidden 不会超过真实 total，钳制反而会掩盖计数偏差。
        cache.hidden = Math.max(0, cache.hidden + delta);
        cache.visible = Math.max(0, cache.total - cache.hidden);
        State.hiddenThisPageCount = cache.hidden;
    },

    setCardHidden: (card, hidden) => {
        if (!card) return;
        const wasHidden = TaskRunner.isCardHidden(card);

        if (hidden) {
            // 按用户原始记录：已入库/已隐藏商品不占高度、不占空间 —— 用 display:none
            // 彻底移出文档流（不保留占位、不撑高容器）。
            // 注：曾一度改为 visibility:hidden 保留占位（commit 75e410d），但其理由
            // “display:none 塌陷导致无限滚动 sentinel 卡视口”已被 8-11 ego 实测证伪：
            // Fab 为固定容器高度的虚拟化渲染，单卡 display:none 不改变页面总高度
            // （隐 15 张 docH 塌陷=0），故不触发旧假说，无需保留占位。
            if (card.style) card.style.display = 'none';
            card.setAttribute?.('data-fab-hidden', 'true');
        } else {
            if (card.style) card.style.display = '';
            card.removeAttribute?.('data-fab-hidden');
        }

        const isHidden = TaskRunner.isCardHidden(card);
        if (wasHidden !== isHidden) {
            TaskRunner.adjustCardCountCacheHidden(isHidden ? 1 : -1);
        }
    },

    resetHiddenCardState: (cardsArg) => {
        Array.from(cardsArg || []).forEach(card => {
            card.removeAttribute?.('data-fab-processed');
            TaskRunner.setCardHidden(card, false);
        });
    },

    shouldHideCard: (card) => {
        const isFinished = State.hideSaved && TaskRunner.isCardFinished(card);
        const isDiscountedPaid = State.hideDiscountedPaid && TaskRunner.isDiscountedPaidCard(card);
        const isPaidAndHidden = State.hidePaid && !TaskRunner.isFreeCard(card);
        return isFinished || isDiscountedPaid || isPaidAndHidden;
    },

    _runHideOrShowTimer: null,

    scheduleHideOrShow: () => {
        if (TaskRunner._runHideOrShowTimer) return;
        TaskRunner._runHideOrShowTimer = setTimeout(() => {
            TaskRunner._runHideOrShowTimer = null;
            TaskRunner.runHideOrShow();
        }, 100);
    },

    runHideOrShow: () => {
        // 清除节流 timer（直接调用时也需清除，避免重入）
        if (TaskRunner._runHideOrShowTimer) {
            clearTimeout(TaskRunner._runHideOrShowTimer);
            TaskRunner._runHideOrShowTimer = null;
        }

        if (!TaskRunner.isHideModeActive()) {
            // 关闭隐藏模式：恢复所有卡片占位状态并校准计数
            const allCards = document.querySelectorAll(Config.SELECTORS.card);
            TaskRunner.refreshCardCountCache(allCards);
            TaskRunner.resetHiddenCardState(allCards);
            State.lastHideModeKey = TaskRunner.getHideModeKey();
            if (UI) UI.update();
            return;
        }

        // 始终基于真实 DOM 校准计数缓存：Fab 无限滚动加载新卡后 document 引用与
        // href 均不变，仅靠 cardCountCache 的 dirty/href 失效条件会让 total 停留在
        // 旧值，导致「可见/隐藏」计数在长列表下持续偏差。这里每次都按当前真实卡片
        // 数重算 total/hidden/visible，避免缓存失准（runHideOrShow 本身已被节流）。
        const allCards = document.querySelectorAll(Config.SELECTORS.card);
        TaskRunner.refreshCardCountCache(allCards);

        const hideModeKey = TaskRunner.getHideModeKey();
        if (State.lastHideModeKey !== hideModeKey) {
            State.lastHideModeKey = hideModeKey;
            TaskRunner.resetHiddenCardState(allCards);
        }

        const cards = document.querySelectorAll(TaskRunner.getVisibleCardSelector());

        let actuallyHidden = 0;
        let hasUnsettledCards = false;
        const unsettledCards = [];

        cards.forEach(card => {
            // 已处理且已隐藏的卡片状态稳定，跳过昂贵的 isCardSettled 判断
            if (card.getAttribute('data-fab-processed') === 'true' && TaskRunner.isCardHidden(card)) {
                TaskRunner.setCardHidden(card, true);
                return;
            }
            if (!TaskRunner.isCardSettled(card)) {
                hasUnsettledCards = true;
                unsettledCards.push(card);
            }
        });

        if (hasUnsettledCards && unsettledCards.length > 0) {
            // 已有 timer 挂起时直接返回，避免重复 schedule 形成无限累积
            if (State.hideRetryTimer) return;
            Utils.logger('debug', Utils.getText('log_unsettled_cards', unsettledCards.length));
            State.hideRetryTimer = setTimeout(() => {
                State.hideRetryTimer = null;
                TaskRunner.runHideOrShow();
            }, 2000);
            // 有未就绪卡片时仍继续处理已就绪的，但本轮不再重入
        } else if (State.hideRetryTimer) {
            clearTimeout(State.hideRetryTimer);
            State.hideRetryTimer = null;
        }

        const cardsToHide = [];

        cards.forEach(card => {
            if (!TaskRunner.isCardSettled(card)) {
                return;
            }

            if (TaskRunner.isCardHidden(card)) {
                TaskRunner.setCardHidden(card, true);
                return;
            }

            card.setAttribute('data-fab-processed', 'true');
            const link = card.querySelector(Config.SELECTORS.cardLink);
            const href = link ? (link.getAttribute?.('href') || link.href) : null;
            if (href) {
                const uid = href.split('/').pop().split('?')[0];
                State.processedCardUids.add(uid);
            }

            if (TaskRunner.shouldHideCard(card)) {
                cardsToHide.push(card);
            }
        });

        if (cardsToHide.length > 0) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_prepare_hide', cardsToHide.length));
            }

            cardsToHide.sort(() => Math.random() - 0.5);

            if (cardsToHide.length > 30) {
                // 大批量：用 requestAnimationFrame 分帧同步隐藏，避免创建上百个 setTimeout
                const FRAME_BATCH = 20;
                let offset = 0;
                const hideNextFrame = () => {
                    const end = Math.min(offset + FRAME_BATCH, cardsToHide.length);
                    for (let i = offset; i < end; i++) {
                        TaskRunner.setCardHidden(cardsToHide[i], true);
                        actuallyHidden++;
                    }
                    offset = end;
                    if (offset < cardsToHide.length) {
                        requestAnimationFrame(hideNextFrame);
                    } else {
                        if (State.debugMode) {
                            Utils.logger('debug', Utils.getText('debug_hide_completed', actuallyHidden));
                        }
                        setTimeout(() => {
                            if (UI) UI.update();
                            TaskRunner.checkVisibilityAndRefresh();
                        }, 300);
                    }
                };
                requestAnimationFrame(hideNextFrame);
            } else {
                // 少量卡片：保留原有随机延迟动画（更自然）
                const batchSize = 10;
                const batches = Math.ceil(cardsToHide.length / batchSize);
                const initialDelay = 200; // 动画已由 cardDelay 提供，头部延迟缩短到 200ms

                for (let i = 0; i < batches; i++) {
                    const start = i * batchSize;
                    const end = Math.min(start + batchSize, cardsToHide.length);
                    const currentBatch = cardsToHide.slice(start, end);
                    const batchDelay = initialDelay + i * 300 + Math.random() * 300;
                    const isLastBatch = i === batches - 1;

                    setTimeout(() => {
                        let batchHidden = 0;
                        currentBatch.forEach((card, index) => {
                            const cardDelay = index * 50 + Math.random() * 100;
                            setTimeout(() => {
                                TaskRunner.setCardHidden(card, true);
                                actuallyHidden++;
                                batchHidden++;
                                // 每个 batch 最后一张卡片隐藏后即刻更新 UI，不再等到全部完成
                                if (batchHidden === currentBatch.length) {
                                    if (UI) UI.update();
                                    if (isLastBatch) {
                                        if (State.debugMode) {
                                            Utils.logger('debug', Utils.getText('debug_hide_completed', actuallyHidden));
                                        }
                                        setTimeout(() => {
                                            TaskRunner.checkVisibilityAndRefresh();
                                        }, 300);
                                    }
                                }
                            }, cardDelay);
                        });
                    }, batchDelay);
                }
            }
        }

        if (cardsToHide.length === 0) {
            if (UI) UI.update();
            TaskRunner.checkVisibilityAndRefresh();
        }
        return;
    },

    checkVisibilityAndRefresh: () => {
        const cards = document.querySelectorAll(TaskRunner.getVisibleCardSelector());

        let needsReprocessing = false;
        cards.forEach(card => {
            const isProcessed = card.getAttribute('data-fab-processed') === 'true';
            if (!isProcessed && TaskRunner.isCardSettled(card)) needsReprocessing = true;
        });

        if (needsReprocessing) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_unprocessed_cards_simple'));
            }
            setTimeout(() => TaskRunner.runHideOrShow(), 100);
            return;
        }

        // 仅以 data-fab-hidden 属性判定可见性，避免 getComputedStyle 对每张卡片触发强制 reflow
        const { visible: visibleCards } = TaskRunner.getCardCounts();

        if (State.debugMode) {
            Utils.logger('debug', Utils.getText('debug_visible_after_hide', visibleCards, State.hiddenThisPageCount));
        }

        // Use UI.update() so both visible AND hidden counts are refreshed from real DOM state
        if (UI) UI.update();

        if (visibleCards === 0) {
            if (State.appStatus === 'RATE_LIMITED' && State.autoRefreshEmptyPage) {
                if (State.isRefreshScheduled) {
                    Utils.logger('debug', Utils.getText('refresh_plan_exists'));
                    return;
                }

                if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                    Utils.logger('debug', Utils.getText('log_refresh_cancelled_tasks', State.db.todo.length, State.activeWorkers));
                    return;
                }

                Utils.logger('info', Utils.getText('log_all_hidden_rate_limited'));
                const randomDelay = 3000 + Math.random() * 2000;
                if (countdownRefresh) {
                    countdownRefresh(randomDelay, Utils.getText('rate_limit_no_visible_reason'));
                }
            } else if (State.appStatus === 'NORMAL' && State.hiddenThisPageCount > 0) {
                Utils.logger('debug', Utils.getText('page_status_hidden_no_visible', State.hiddenThisPageCount));
                if (State.autoScroll || State.autoAddOnScroll) {
                    TaskRunner.attemptAutoScroll();
                }
            }
        }
    },

    ensureTasksAreExecuted: () => {
        if (State.db.todo.length === 0) return;

        if (State.isExecuting) {
            if (State.activeWorkers === 0) {
                Utils.logger('info', Utils.getText('log_ensure_tasks'));
                TaskRunner.executeBatch();
            }
            return;
        }

        Utils.logger('info', Utils.getText('log_auto_start_execution', State.db.todo.length));
        TaskRunner.startExecution();
    },

    checkVisibleCardsStatus: async () => {
        if (State.isCheckingStatus) {
            return;
        }
        State.isCheckingStatus = true;

        try {
            const visibleCards = [...document.querySelectorAll(TaskRunner.getVisibleCardSelector())];

            if (visibleCards.length === 0) {
                // Utils.logger('info', Utils.getText('log_no_visible_cards')); // Reduce noise
                return;
            }

            let hasUnsettledCards = false;
            const unsettledCards = [];

            visibleCards.forEach(card => {
                if (!TaskRunner.isCardSettled(card)) {
                    hasUnsettledCards = true;
                    unsettledCards.push(card);
                }
            });

            if (hasUnsettledCards && unsettledCards.length > 0) {
                // Found unsettled cards. We will proceed to check settled cards' ownership,
                // and rely on subsequent triggers (observer/interval) to re-check.
                // We do NOT return here, and we do NOT unlock prematurely.
            }
            // Re-implementing logic with the lock safely:

            // Filter only settled items for API check to avoiding checking "loading" items?
            // Or just proceed. The original logic waited.

            const allItems = [];
            let confirmedOwned = 0;

            visibleCards.forEach(card => {
                // If card is unsettled, maybe skip it this round?
                // But if we skip it, we might miss it if observer doesn't fire again.
                // Let's process valid links regardless.

                const link = card.querySelector(Config.SELECTORS.cardLink);
                const uidMatch = link?.href.match(/listings\/([a-f0-9-]+)/);

                if (uidMatch && uidMatch[1]) {
                    const uid = uidMatch[1];
                    const url = link.href.split('?')[0];

                    if (Database.isDone(url)) return;
                    allItems.push({ uid, url, element: card });
                }
            });

            if (allItems.length === 0) {
                // Utils.logger('debug', Utils.getText('debug_no_cards_to_check'));
                return;
            }

            Utils.logger('debug', Utils.getText('fab_dom_checking_status', allItems.length));

            const uids = allItems.map(item => item.uid);
            const statesData = await API.checkItemsOwnership(uids);

            const ownedUids = new Set(
                statesData
                    .filter(state => state && state.acquired)
                    .map(state => state.uid)
            );

            for (const item of allItems) {
                if (ownedUids.has(item.uid)) {
                    if (Database.addDoneUrl(item.url)) {
                        confirmedOwned++;
                    }
                    State.db.failed = State.db.failed.filter(f => f.uid !== item.uid);
                    State.db.todo = State.db.todo.filter(t => t.uid !== item.uid);
                }
            }

            if (confirmedOwned > 0) {
                await Database.saveDone();
                await Database.saveFailed();
                Utils.logger('debug', Utils.getText('fab_dom_api_complete', confirmedOwned));
                Utils.logger('debug', Utils.getText('fab_dom_refresh_complete', confirmedOwned));
                // 无论是否开启隐藏模式，都立即刷新状态栏（todo/done/failed 数字需同步）
                if (UI) UI.update();
                if (State.hideSaved || State.hideDiscountedPaid || State.hidePaid) {
                    TaskRunner.runHideOrShow();
                }
            } else {
                Utils.logger('debug', Utils.getText('fab_dom_no_new_owned'));
            }
        } catch (error) {
            Utils.logger('error', Utils.getText('log_check_status_error', error.message));
            if (error.message && error.message.includes('429')) {
                RateLimitManager.enterRateLimitedState('[Fab DOM Refresh] 429错误');
            }
        } finally {
            State.isCheckingStatus = false;
        }
    },

    scanAndAddTasks: async (cards) => {
        if (!State.autoAddOnScroll && !State.autoScroll) return;

        // 未登录或 session 已过期时，卡片上拿不到价格信息，isFreeCard 会把所有商品
        // 误判为免费。直接跳过扫描，避免队列被付费商品塞满后 worker 空跑。
        if (!State.isAuthenticated) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('auth_scan_blocked'));
            }
            return;
        }

        // 防止并发调用
        if (State.isScanningTasks) {
            Utils.logger('debug', `已有扫描任务进行中，跳过本次调用 (${cards.length} 张卡片)`);
            return;
        }

        State.isScanningTasks = true;

        try {
            if (!window._apiWaitStatus) {
                window._apiWaitStatus = {
                    isWaiting: false,
                    pendingCards: [],
                    lastApiActivity: 0,
                    apiCheckInterval: null
                };
            }

            if (window._apiWaitStatus.isWaiting) {
                window._apiWaitStatus.pendingCards = [...window._apiWaitStatus.pendingCards, ...cards];
                Utils.logger('info', Utils.getText('debug_api_wait_in_progress', cards.length));
                return;
            }

            window._apiWaitStatus.isWaiting = true;
            window._apiWaitStatus.pendingCards = [...cards];
            window._apiWaitStatus.lastApiActivity = Date.now();

            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_wait_api_response', cards.length));
            }

            const waitForApiCompletion = () => {
                return new Promise((resolve) => {
                    if (window._apiWaitStatus.apiCheckInterval) {
                        clearInterval(window._apiWaitStatus.apiCheckInterval);
                        window._apiWaitStatus.apiCheckInterval = null;
                    }

                    const maxWaitTime = 10000;
                    const startTime = Date.now();

                    // 不再 wrap window.fetch（每次调用都嵌套一层会导致随时间推移越来越慢）。
                    // 改为仅靠 lastApiActivity 时间戳判断：页面发出 fetch 请求时
                    // 由下方已安装的全局拦截器（initFetchTracker）负责更新该时间戳。
                    window._apiWaitStatus.apiCheckInterval = setInterval(() => {
                        const now = Date.now();
                        const timeSinceLastActivity = now - window._apiWaitStatus.lastApiActivity;
                        const totalWaitTime = now - startTime;

                        if (totalWaitTime > maxWaitTime || timeSinceLastActivity > 2000) {
                            clearInterval(window._apiWaitStatus.apiCheckInterval);
                            window._apiWaitStatus.apiCheckInterval = null;
                            resolve();
                        }
                    }, 200);
                });
            };

            try {
                await waitForApiCompletion();
            } catch (error) {
                Utils.logger('error', Utils.getText('auto_add_api_error', error.message));
            }

            const cardsToProcess = [...window._apiWaitStatus.pendingCards];
            window._apiWaitStatus.pendingCards = [];
            window._apiWaitStatus.isWaiting = false;

            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_api_wait_complete', cardsToProcess.length));
            }

            const newlyAddedList = [];
            let skippedAlreadyOwned = 0;
            let skippedInTodo = 0;
            let skippedUnsettled = 0;

            cardsToProcess.forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const rawHref = link ? link.href : '';
                if (!rawHref) return;

                // 强要求：必须提取出合法的 listing UUID。对于任何 /search?tags=... 或非商品页链接一律杀掉，绝不加入待办队列！
                const uidMatch = rawHref.match(/listings\/([a-f0-9-]{32,36})/i);
                if (!uidMatch || !uidMatch[1]) return;

                const uid = uidMatch[1];
                const url = `https://www.fab.com/listings/${uid}`;

                if (!TaskRunner.isCardSettled(card)) {
                    skippedUnsettled++;
                    return;
                }

                if (Database.isDone(url)) {
                    skippedAlreadyOwned++;
                    return;
                }

                if (Database.isTodo(url)) {
                    skippedInTodo++;
                    return;
                }

                const text = card.textContent || '';
                if (text.includes("已保存在我的库中") ||
                    text.includes("已保存") ||
                    text.includes("Saved to My Library") ||
                    text.includes("In your library")) {
                    skippedAlreadyOwned++;
                    return;
                }

                const icons = card.querySelectorAll('i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled');
                if (icons.length > 0) {
                    skippedAlreadyOwned++;
                    return;
                }

                if (DataCache.ownedStatus.has(uid)) {
                    const status = DataCache.ownedStatus.get(uid);
                    if (status && status.acquired) {
                        skippedAlreadyOwned++;
                        return;
                    }
                }

                if (!TaskRunner.isFreeCard(card)) return;

                const name = card.querySelector('a[aria-label*="创作的"], a[aria-label*="by "]')?.textContent.trim() ||
                    card.querySelector('a[href*="/listings/"]')?.textContent.trim() ||
                    Utils.getText('untitled');
                newlyAddedList.push({ name, url, type: 'detail', uid });
            });

            if (skippedUnsettled > 0 && !State.autoAddRetryTimer) {
                    State.autoAddRetryTimer = setTimeout(() => {
                    State.autoAddRetryTimer = null;
                    if (State.autoAddOnScroll || State.autoScroll) {
                        TaskRunner.scanAndAddTasks(document.querySelectorAll(TaskRunner.getVisibleCardSelector()))
                            .catch(error => Utils.logger('error', `自动添加重试失败: ${error.message}`));
                    }
                }, 2000);
            } else if (skippedUnsettled === 0 && State.autoAddRetryTimer) {
                clearTimeout(State.autoAddRetryTimer);
                State.autoAddRetryTimer = null;
            }

            if (newlyAddedList.length > 0 || skippedAlreadyOwned > 0 || skippedInTodo > 0) {
                if (newlyAddedList.length > 0) {
                    // 严格去重：使用 uid 和 url 双重检查，防止重复添加
                    const existingUids = new Set(State.db.todo.map(t => t.uid));
                    const existingUrls = new Set(State.db.todo.map(t => t.url.split('?')[0]));

                    const uniqueNewTasks = newlyAddedList.filter(task => {
                        const cleanUrl = task.url.split('?')[0];
                        const isDuplicate = existingUids.has(task.uid) || existingUrls.has(cleanUrl);
                        if (isDuplicate) {
                            Utils.logger('debug', `跳过重复任务: ${task.name} (uid: ${task.uid})`);
                        }
                        return !isDuplicate;
                    });

                    if (uniqueNewTasks.length > 0) {
                        State.db.todo.push(...uniqueNewTasks);
                        Utils.logger('info', Utils.getText('auto_add_new_tasks', uniqueNewTasks.length));
                        if (uniqueNewTasks.length < newlyAddedList.length) {
                            Utils.logger('debug', `过滤了 ${newlyAddedList.length - uniqueNewTasks.length} 个重复任务`);
                        }
                        Database.saveTodo();
                        State.autoScrollAttempts = 0; // Reset scroll attempts
                    } else {
                        Utils.logger('debug', `所有 ${newlyAddedList.length} 个任务都是重复的，已跳过`);
                    }
                }

                if (skippedAlreadyOwned > 0 || skippedInTodo > 0) {
                    Utils.logger('debug', Utils.getText('debug_filter_owned', skippedAlreadyOwned, skippedInTodo));
                }

                if (State.isExecuting) {
                    State.executionTotalTasks = State.db.todo.length;
                    TaskRunner.executeBatch();
                } else if (State.autoAddOnScroll || State.autoScroll) {
                    TaskRunner.startExecution();
                }

                if (UI) UI.update();
            }
        } finally {
            // 确保扫描锁被释放
            State.isScanningTasks = false;
        }
    },

    handleRateLimit: async (url) => {
        await RateLimitManager.enterRateLimitedState(url || '网络请求');
    },

    reportTaskDone: async (task, success) => {
        try {
            const reportWorkerId = `worker_task_${task.uid}`;
            if (typeof registerWorkerDoneListener === 'function') {
                registerWorkerDoneListener(reportWorkerId);
            }
            await GM_setValue(Config.DB_KEYS.WORKER_DONE_PREFIX + reportWorkerId, {
                workerId: reportWorkerId,
                success: success,
                logs: [Utils.getText('task_report', success ? Utils.getText('task_success') : Utils.getText('task_failed'), task.name || task.uid)],
                task: task,
                instanceId: Config.INSTANCE_ID,
                executionTime: 0
            });
            Utils.logger('info', Utils.getText('task_report', success ? Utils.getText('task_success') : Utils.getText('task_failed'), task.name || task.uid));
        } catch (error) {
            Utils.logger('error', Utils.getText('log_report_error', error.message));
        }
    },

    onQueueCompleted: null,

    stopExecutionAndSettle: async () => {
        if (State.watchdogTimer) {
            clearInterval(State.watchdogTimer);
            State.watchdogTimer = null;
        }
        KeepAlive.stop();
        TaskRunner.closeAllWorkerTabs();

        if (typeof TaskRunner.onQueueCompleted === 'function') {
            await TaskRunner.onQueueCompleted();
        } else {
            Utils.logger('info', Utils.getText('log_all_tasks_completed'));
            State.isExecuting = false;
            Database.saveExecutingState();
            Database.saveTodo();
            if (UI) UI.update();
        }
    },

    attemptAutoScroll: async () => {
        if (State.isAutoScrolling) return;
        State.isAutoScrolling = true;

        if (typeof State.autoScrollAttempts === 'undefined') {
            State.autoScrollAttempts = 0;
        }

        const maxScrollAttempts = 6; // 安全护栏上限（仅防接口漏响应导致死循环，非判底依据）
        Utils.logger('info', Utils.getText('auto_scroll_attempt', State.autoScrollAttempts + 1, maxScrollAttempts));

        const getCurrentCardTotal = () => {
            try {
                // 关键修复：强制基于真实 DOM 重新计数。
                // 旧逻辑不传 forceRefresh，命中了「纯自动入库模式」下缓存未被刷新的旧
                // total —— runHideOrShow（唯一刷新 cardCountCache 的入口）在该模式下不执行，
                // 于是滚动加载出新卡后缓存 total 仍停在首屏值，newDomCardCount 恒为 0。
                // 一旦某页没有新的免费商品可加入待办，脚本便误判“已到列表末尾”而提前停转，
                // 表现为「已入库数量停在 N 不动」。强制重算后可正确感知「确实加载了新卡片」，
                // 继续滚动，直到后端确认无下一页（isEndOfSearchList）或物理触底 3 轮无新内容才收尾。
                return TaskRunner.getCardCounts(true).total;
            } catch (_error) {
                return 0;
            }
        };
        const previousCardTotal = getCurrentCardTotal();
        const previousProcessedTotal = State.processedCardUids.size;
        const previousScrollHeight = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement.scrollHeight : 0;
        const previousScrollY = (typeof window !== 'undefined') ? window.scrollY : 0;

        // 卡片现统一用 visibility:hidden 隐藏（保留文档流占位，页面高度始终不变），
        // 因此不再需要把隐藏卡片临时恢复成 display:none 来“撑高”页面后再滚动——
        // 那种反复切换 display 的做法会在滚动过程中造成布局抖动，并引发
        // “滚动条在中间就持续刷新入库/隐藏”的错觉。直接滚动到底部即可触发 Fab
        // 的无限滚动加载下一页。
        // 分步下滚触发加载：很多站点的无限滚动加载器基于 IntersectionObserver 哨兵，
        // 若用 scrollTo 一把跳到页面底部，哨兵会被「跳过」（已落到可视区之上），
        // 既不触发「进入可视区」回调，也不发起下一页请求，于是 scrollHeight 不增长、
        // newDomCardCount 恒为 0，脚本误判「已到列表末尾」而提前停转（表现：入库卡在 N）。
        // 分步向下滚动可让哨兵从下方逐帧进入可视区，稳定触发加载。
        const doScroll = async () => {
            if (typeof window === 'undefined') return;
            const doc = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement : null;
            const startHeight = doc ? doc.scrollHeight : 0;
            const innerH = window.innerHeight || 800;
            const steps = 6;
            const remaining = startHeight - (window.scrollY || 0);
            const stepSize = Math.max(300, Math.floor(remaining / steps));
            for (let i = 1; i <= steps; i++) {
                if (typeof window.scrollBy === 'function') {
                    window.scrollBy(0, stepSize);
                } else if (typeof window.scrollTo === 'function') {
                    window.scrollTo(0, (window.scrollY || 0) + stepSize);
                }
                if (typeof window.dispatchEvent === 'function') {
                    window.dispatchEvent(new Event('scroll'));
                }
                await new Promise(r => _realSetTimeout(r, 350));
            }
            // 末段再贴一次底，兜底触发基于 scroll 位置（scrollY+innerHeight>=scrollHeight-N）的加载器
            if (typeof window.scrollTo === 'function' && doc) {
                window.scrollTo(0, doc.scrollHeight);
                if (typeof window.dispatchEvent === 'function') {
                    window.dispatchEvent(new Event('scroll'));
                }
                await new Promise(r => _realSetTimeout(r, 350));
            }
            // 关键修复：若已在页面底部（向下滚动无法再推进滚动位置），Fab 的无限滚动
            // IntersectionObserver 哨兵始终处于「已 intersecting」状态，不会重新触发「进入可视区」
            // 回调，于是下一页请求不发、scrollHeight 不增长，脚本在 3 轮无增长后误判「已到列表
            // 末尾」而提前停转（用户实测：入库卡在 N、尝试 1/3 即「已到达页面底部」）。
            // 此时先上滚约半屏、再滚回底部，让哨兵离开并重新进入可视区，重新触发加载器。
            // 仅在确实到底时执行，正常分步下滚过程不受影响。
            if (doc) {
                const maxScroll = doc.scrollHeight - innerH;
                const atBottom = (window.scrollY || 0) >= maxScroll - 50;
                if (atBottom) {
                    // 上滚超过一整屏，确保底部哨兵明确离开可视区；再滚回底部使其重新进入，触发加载器。
                    const upBy = Math.round(innerH * 1.2);
                    window.scrollTo(0, Math.max(0, (window.scrollY || 0) - upBy));
                    if (typeof window.dispatchEvent === 'function') {
                        window.dispatchEvent(new Event('scroll'));
                    }
                    await new Promise(r => _realSetTimeout(r, 500));
                    window.scrollTo(0, doc.scrollHeight);
                    if (typeof window.dispatchEvent === 'function') {
                        window.dispatchEvent(new Event('scroll'));
                    }
                    await new Promise(r => _realSetTimeout(r, 500));
                }
            }
            return startHeight;
        };
        await doScroll();

        // Wait for potential content loading and scanning
        setTimeout(async () => {
            State.isAutoScrolling = false;

            const currentScrollHeight = (typeof document !== 'undefined' && document.documentElement) ? document.documentElement.scrollHeight : 0;
            const currentScrollY = (typeof window !== 'undefined') ? window.scrollY : 0;
            const newTodoCount = State.db.todo.length;
            const currentCardTotal = getCurrentCardTotal();

            // 1. If we got new tasks, scanning will have reset State.autoScrollAttempts and executed.
            if (newTodoCount > 0) {
                Utils.logger('info', Utils.getText('auto_scroll_success', newTodoCount));
                if (!State.isExecuting) {
                    TaskRunner.startExecution();
                }
                return;
            }

            const currentProcessedTotal = State.processedCardUids.size;
            const newProcessedCount = currentProcessedTotal - previousProcessedTotal;
            const newDomCardCount = currentCardTotal - previousCardTotal;
            // scrollHeight 增长是「确有新内容」的最强信号：只要页面被无限滚动撑高，
            // 就说明下一页已加载，应继续滚动。即便卡片计数/已处理计数因其它因素暂时未变，
            // 也不应据此误判到底。
            const scrollHeightGrew = currentScrollHeight > previousScrollHeight + 2;

            if (newProcessedCount > 0 || newDomCardCount > 0 || scrollHeightGrew) {
                State.autoScrollAttempts = 0;
                const loadedCount = newProcessedCount > 0 ? newProcessedCount : (newDomCardCount > 0 ? newDomCardCount : (currentScrollHeight - previousScrollHeight));
                Utils.logger('debug', Utils.getText('auto_scroll_cards_loaded', loadedCount));
                TaskRunner.runHideOrShow();
                TaskRunner.attemptAutoScroll();
                return;
            }

            // 2. 权威判底：由 index.js 拦截 /i/listings/search 响应写入
            //    State.isEndOfSearchList = (responseData.cursors.next === null)。
            //    即「服务器已无下一页」= 用户口径的「服务器没有新的了」。
            //    滚动条位置、scrollHeight、卡片 DOM 计数一律不作为到底依据
            //    （Fab 为虚拟化渲染，本地信号不可靠，曾导致「滚动条在底部就提前停」）。
            //    只有服务器确认无更多，才视作自动入库成功并收尾。
            if (State.isEndOfSearchList) {
                Utils.logger('info', Utils.getText('auto_scroll_reached_bottom'));
                if (UI && typeof UI.showToast === 'function' && !State.hasReachedBottomToastShown) {
                    State.hasReachedBottomToastShown = true;
                    UI.showToast(Utils.getText('toast_reached_bottom'), true);
                }
                // v3.5.14 修复保留：仍有 worker 在途或待办未空时，仅停滚动、不杀 worker，
                // 避免「工作标签页在完成前关闭」/ 左下角提示一出现就中断入库。
                State.isAutoScrolling = false;
                const workersStillBusy = State.activeWorkers > 0 || State.db.todo.length > 0;
                if (State.isExecuting && !workersStillBusy) {
                    await TaskRunner.stopExecutionAndSettle();
                } else {
                    State.autoScrollAttempts = 0;
                    if (State.isExecuting && State.db.todo.length > 0) {
                        // 仍待派发：补一发 executeBatch，避免滚动停了但待办无人处理而软锁
                        setTimeout(() => TaskRunner.executeBatch(), 200);
                    }
                }
                return;
            }

            // 3. 未确认到底、也未观察到新内容：继续滚动，给 loader / 服务器更多时间。
            //    仅作安全护栏：连续过多轮既无新内容又未收到服务器到底信号才放弃，
            //    【且绝不宣称「自动入库成功」】——成功只能由服务器确认。
            State.autoScrollAttempts++;
            if (State.autoScrollAttempts >= maxScrollAttempts) {
                Utils.logger('warn', Utils.getText('auto_scroll_safety_stop', maxScrollAttempts));
                State.autoScrollAttempts = 0;
                State.isAutoScrolling = false;
                return;
            }

            if (State.autoScroll || TaskRunner.isHideModeActive()) {
                Utils.logger('debug', Utils.getText('auto_scroll_waiting'));
                TaskRunner.attemptAutoScroll();
                return;
            }

            State.isAutoScrolling = false;
        }, 3000);
    }
};
