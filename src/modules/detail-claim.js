/**
 * Fab Helper - Detail Claim Module（详情页领取核心）
 *
 * 从 TaskRunner.processDetailPage 抽出来的「单条商品领取」逻辑。
 *
 * 为什么抽出来：
 *   原实现约 885 行，其中近 400 行是「在一个已经停在商品详情页的文档上，
 *   找到按钮、点下去、等它变成已拥有」的纯 DOM 自动化，与 worker 标签页的
 *   任务装载 / 结果回传 / 关页毫无关系，却被焊死在那个函数里 —— 于是这部分
 *   逻辑既无法单测，也无法被新的 API 优先流水线复用。
 *
 *   抽出来之后：老路径（worker 标签页）与新路径（ClaimStrategy 的 DomClaim
 *   回退）共用同一份领取实现，行为永远一致，改动只需要做一次。
 *
 * 本模块的职责边界很明确 —— 它只负责「把商品领到手」，不负责：
 *   - 把页面送到商品详情页（worker 标签页 / iframe / 直接导航，由调用方决定）
 *   - 任务装载、结果回传、关页（worker 协议，见 task-runner.processDetailPage）
 *
 * 所有环境依赖（document / window / Utils / API / TaskRunner / PageDiagnostics /
 * 定时器）都可注入，因此这一段原本只能靠线上观察的逻辑，现在可以在 Node 里
 * 用假 DOM 完整驱动。
 */
import { Config } from '../config.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { PageDiagnostics } from './page-diagnostics.js';

/** 就绪检测 / 已拥有判定用的「关键元素」选择器 */
const KEY_ELEMENT_SELECTOR =
    'button, a.fabkit-Button-root, [role="button"], a[class*="Button"], a[class*="button"]';

/** 动作按钮扫描用的宽选择器：含 a[href]，因为外部 CTA 也可能是链接 */
const ACTION_BUTTON_SELECTOR =
    'button, .fabkit-Button-root, [role="button"], [class*="Button"], [class*="button"], a[href]';

/**
 * 「已保存在我的库中」类徽章文案。必须整串相等才认 ——
 * 放宽成 includes 会把「添加到我的库」这类动作按钮误判成已拥有。
 */
const OWNED_BADGE_TEXTS = [
    '已保存在我的库中',
    'Saved in My Library',
    'Saved in library',
    '已保存在库中'
];

/** 结算/下单按钮的关键词（原文案即为数组，保持扁平结构不变） */
const CHECKOUT_KEYWORDS = [
    'place order', '下单',
    'checkout', '结账',
    'complete order', '完成订单',
    'confirm', '确认',
    'claim', '领取',
    'get', '获取',
    'pay', '支付'
];

const DEFAULT_SLEEP = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const noop = () => {};

/**
 * 归一化运行上下文：把「页面从哪来」全部收敛到一处，
 * 后面所有辅助函数只认 ctx，不再直接摸全局。
 */
const normalizeContext = (options = {}) => ({
    doc: options.doc ?? (typeof document !== 'undefined' ? document : null),
    win: options.win ?? (typeof window !== 'undefined' ? window : null),
    utils: options.utils || Utils,
    api: options.api || API,
    diagnostics: options.diagnostics || PageDiagnostics,
    // TaskRunner 必须显式传入：task-runner 会 import 本模块，反向 import 会成环
    taskRunner: options.taskRunner || null,
    MutationObserver: options.MutationObserver
        || (typeof globalThis !== 'undefined' ? globalThis.MutationObserver : null),
    sleep: options.sleep || DEFAULT_SLEEP,
    setTimeoutFn: options.setTimeoutFn || ((fn, ms) => setTimeout(fn, ms)),
    clearTimeoutFn: options.clearTimeoutFn || ((id) => clearTimeout(id)),
    setIntervalFn: options.setIntervalFn || ((fn, ms) => setInterval(fn, ms)),
    clearIntervalFn: options.clearIntervalFn || ((id) => clearInterval(id)),
    now: options.now || (() => Date.now())
});

/** 等待页面把详情页的骨架渲染出来。返回是否真正等到了（超时也继续，不中断流程）。 */
const waitForPageReady = async (ctx) => {
    const { doc, sleep, now } = ctx;
    const maxWait = 15000;
    const startAt = now();
    let lastState = '';

    while (now() - startAt < maxWait) {
        const currentState = doc?.readyState;
        const hasMainContent = doc?.querySelector('main, .product-detail, [class*="listing"], [class*="detail"]');
        const hasButtons = (doc?.querySelectorAll(KEY_ELEMENT_SELECTOR)?.length || 0) > 0;
        const hasTitle = doc?.querySelector('h1, .fabkit-Heading--xl');

        if (currentState !== lastState) {
            ctx.log(`页面状态: ${currentState}`);
            lastState = currentState;
        }

        // 'interactive' 或 'complete' 且关键 DOM 已渲染即认定就绪，不必死等 load
        const isReadyState = currentState === 'interactive' || currentState === 'complete';
        if (isReadyState && hasMainContent && (hasButtons || hasTitle)) {
            ctx.log(`页面就绪检测通过: readyState=${currentState}, hasContent=true`);
            return true;
        }

        await sleep(100);
    }

    ctx.log(`页面就绪检测超时 (${maxWait}ms)，继续尝试操作`);
    return false;
};

/**
 * 等待关键 UI 元素出现（领取按钮 / 已保存指示器 / 外部 CTA）。
 * 元素已在 DOM 上时立即返回 —— 原来的无条件 setTimeout(2000) 是单任务耗时的主要来源。
 */
const waitForKeyElement = async (ctx, maxWait = 2000) => {
    const matchKey = () => {
        const buttons = ctx.doc?.querySelectorAll(KEY_ELEMENT_SELECTOR) || [];
        for (const btn of buttons) {
            const text = ctx.utils.normalizeWhitespace(btn.textContent || '');
            if (!text) continue;
            const lower = text.toLowerCase();
            if ([...Config.ACQUISITION_TEXT_SET].some(k => lower.includes(k.toLowerCase()))) return true;
            if ([...Config.SAVED_TEXT_SET].some(k => lower.includes(k.toLowerCase()))) return true;
            if ([...Config.EXTERNAL_CTA_TEXT_SET].some(k => lower.includes(k.toLowerCase()))) return true;
        }
        const bodyText = ctx.doc?.body && ctx.doc.body.textContent;
        if (bodyText) {
            for (const phrase of Config.SAVED_TEXT_SET) {
                if (bodyText.includes(phrase)) return true;
            }
        }
        return false;
    };

    if (matchKey()) return;
    if (!ctx.MutationObserver || !ctx.doc?.body) {
        await ctx.sleep(maxWait);
        return;
    }

    await new Promise(resolve => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            try { observer.disconnect(); } catch (e) { /* ignore */ }
            clearTimeout(timer);
            resolve();
        };
        const observer = new ctx.MutationObserver(() => {
            if (matchKey()) finish();
        });
        observer.observe(ctx.doc.body, { childList: true, subtree: true });
        const timer = ctx.setTimeoutFn(finish, maxWait);
    });
};

/** 成人内容确认弹窗：点了「继续」之后要等页面重新加载 */
const dismissAdultWarning = async (ctx) => {
    const heading = ctx.doc?.querySelector('.fabkit-Heading--xl');
    if (!heading) return;
    const text = heading.textContent || '';
    if (!text.includes('成人内容') && !text.includes('Adult Content') && !text.includes('Mature Content')) return;

    ctx.log('检测到成人内容警告对话框，自动点击"继续"按钮...');
    const continueButton = [...(ctx.doc.querySelectorAll('button.fabkit-Button--primary') || [])]
        .find(btn => (btn.textContent || '').includes('继续') || (btn.textContent || '').includes('Continue'));
    if (!continueButton) return;

    ctx.utils.deepClick(continueButton);
    ctx.log('已点击"继续"按钮，等待页面加载...');
    await ctx.sleep(2000);
};

/**
 * API-First 归属复查：先问 listings-states 接口，命中即直接判成功。
 * 失败一律降级到 UI 判定，不抛错 —— 接口不可用是常态，不是异常。
 */
const checkOwnedViaApi = async (ctx, task, push) => {
    try {
        const csrfToken = ctx.utils.getCookie('fab_csrftoken');
        if (!csrfToken) throw new Error('CSRF token not found for API check.');

        const statesUrl = new URL('https://www.fab.com/i/users/me/listings-states');
        statesUrl.searchParams.append('listing_ids', task.uid);

        const response = await ctx.api.gmFetch({
            method: 'GET',
            url: statesUrl.href,
            headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
        });

        let statesData;
        try {
            statesData = JSON.parse(response.responseText);
            if (!Array.isArray(statesData)) {
                statesData = ctx.api.extractStateData(statesData, 'SingleItemCheck');
            }
        } catch (e) {
            push(`解析API响应失败: ${e.message}`);
            statesData = [];
        }

        const isOwned = Array.isArray(statesData)
            && statesData.some(s => s && s.uid === task.uid && s.acquired);
        if (isOwned) {
            push('API check confirms item is already owned.');
            return true;
        }
        push('API check confirms item is not owned. Proceeding to UI interaction.');
    } catch (apiError) {
        push(`API ownership check failed: ${apiError.message}. Falling back to UI-based check.`);
    }
    return false;
};

/**
 * UI 归属判定（三种信号任一命中即可）：
 *   snackbar 文案 / 按钮文案 / 「已保存在我的库中」状态徽章
 */
const detectOwnedOnPage = (ctx) => {
    const { doc, utils } = ctx;
    const criteria = Config.OWNED_SUCCESS_CRITERIA;

    const snackbar = doc?.querySelector('.fabkit-Snackbar-root, div[class*="Toast-root"]');
    if (snackbar && criteria.snackbarText.some(t => snackbar.textContent.includes(t))) {
        return { owned: true, reason: `Snackbar text "${snackbar.textContent}"` };
    }

    const allButtons = [...(doc?.querySelectorAll(KEY_ELEMENT_SELECTOR) || [])];
    const ownedButton = allButtons.find(btn => criteria.buttonTexts.some(k => btn.textContent.includes(k)));
    if (ownedButton) return { owned: true, reason: `Button text "${ownedButton.textContent}"` };

    const ownedBadge = allButtons.find(btn => {
        const text = utils.normalizeWhitespace(btn.textContent || '');
        return OWNED_BADGE_TEXTS.includes(text);
    });
    if (ownedBadge) return { owned: true, reason: `Badge text "${ownedBadge.textContent}"` };

    return { owned: false };
};

/** 过滤出「有文案且未被 CSS 隐藏」的按钮。后台标签页可能被浏览器挂起渲染，故不判尺寸。 */
const visibleButtons = (ctx) => {
    const { doc, win } = ctx;
    return [...(doc?.querySelectorAll(ACTION_BUTTON_SELECTOR) || [])].filter(btn => {
        const text = (btn.textContent || '').trim();
        const style = (win && win.getComputedStyle) ? win.getComputedStyle(btn) : null;
        const isHidden = style && (style.display === 'none' || style.visibility === 'hidden');
        return text.length > 0 && !isHidden;
    });
};

/** 失败排查用的按钮快照：只记关键按钮，避免整页噪声 */
const logButtonDiagnostics = (ctx, push) => {
    const allVisibleButtons = visibleButtons(ctx);
    const criticalKeywords = [
        ...Config.ACQUISITION_TEXT_SET, ...Config.FREE_TEXT_SET,
        '许可', 'License', 'Select', '选择', 'Add', '添加', 'Library', '库'
    ];
    const criticalButtons = allVisibleButtons.filter(btn =>
        criticalKeywords.some(key => (btn.textContent || '').includes(key)));

    push(`=== 按钮检测: 可见=${allVisibleButtons.length}, 关键=${criticalButtons.length} ===`);
    if (criticalButtons.length > 0) {
        criticalButtons.slice(0, 5).forEach((btn, i) => {
            push(`  关键按钮${i + 1}: "${(btn.textContent || '').trim().substring(0, 40)}"`);
        });
    } else if (allVisibleButtons.length > 0) {
        allVisibleButtons.slice(0, 3).forEach((btn, i) => {
            push(`  按钮${i + 1}: "${(btn.textContent || '').trim().substring(0, 40)}"`);
        });
    }
};

/**
 * 多许可证商品：先展开下拉，再从新增节点里找「免费/个人」那一项点掉。
 * 失败不抛错 —— 有些商品本来就不用选许可，直接走后面的添加按钮。
 */
const selectFreeLicense = async (ctx, push, isItemOwned) => {
    const licenseButton = visibleButtons(ctx).find(btn => {
        const text = ctx.utils.normalizeWhitespace(btn.textContent || '');
        return text.includes('选择许可')
            || text.includes('Select license')
            || (btn.getAttribute('aria-haspopup') === 'true' && ctx.taskRunner?.isFreeCard?.(btn));
    });

    if (!licenseButton) return false;
    push('Multi-license item detected. Setting up observer for dropdown.');

    try {
        await new Promise((resolve, reject) => {
            const observer = new ctx.MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    for (const node of (mutation.addedNodes || [])) {
                        if (node.nodeType !== 1) continue;
                        const clickableParent = ctx.taskRunner?.findFreeLicenseOption?.(node);
                        if (clickableParent) {
                            push('Found explicit free license option, clicking it.');
                            ctx.utils.deepClick(clickableParent);
                            observer.disconnect();
                            resolve();
                            return;
                        }
                    }
                }
            });

            observer.observe(ctx.doc.body, { childList: true, subtree: true });
            push('Clicking license button to open dropdown.');
            ctx.utils.deepClick(licenseButton);

            // 第一次点击有时不生效，1.5s 后补一次
            const retryTimer = ctx.setTimeoutFn(() => {
                push('Second attempt to click license button.');
                ctx.utils.deepClick(licenseButton);
            }, 1500);

            ctx.setTimeoutFn(() => {
                ctx.clearTimeoutFn(retryTimer);
                observer.disconnect();
                reject(new Error('Timeout (5s): The free/personal option did not appear.'));
            }, 5000);
        });

        push('License selected, waiting for UI update.');
        await ctx.sleep(2000);

        if (isItemOwned().owned) {
            push('Item became owned after license selection.');
            return true;
        }
    } catch (licenseError) {
        push(`License selection failed: ${licenseError.message}`);
    }
    return false;
};

/**
 * 轮询找动作按钮（最多 8s）。三档匹配：主动作文案 → 限时免费/折扣 → add+library。
 * 前端 CSR/GraphQL 异步渲染可能延迟出按钮，瞬间找不到就放弃会大量漏领。
 */
const findActionButton = async (ctx) => {
    const startAt = ctx.now();
    const maxWait = 8000;

    while (ctx.now() - startAt < maxWait) {
        const freshButtons = visibleButtons(ctx);

        let actionButton = freshButtons.find(btn => {
            const text = ctx.utils.normalizeWhitespace(btn.textContent || '').toLowerCase();
            return [...Config.ACQUISITION_TEXT_SET].some(keyword => text.includes(keyword.toLowerCase()));
        });

        if (!actionButton) {
            actionButton = freshButtons.find(btn => {
                const text = ctx.utils.normalizeWhitespace(btn.textContent || '');
                const hasFreeText = [...Config.FREE_TEXT_SET].some(freeWord => text.includes(freeWord));
                const hasDiscount = /-\s*100\s*%\s*(?:OFF|折扣)?/i.test(text);
                const hasPersonal = text.includes('个人') || text.includes('Personal');
                return hasFreeText && hasDiscount && hasPersonal;
            });
        }

        if (!actionButton) {
            actionButton = freshButtons.find(btn => {
                const text = (btn.textContent || '').toLowerCase();
                return (text.includes('add') && text.includes('library'))
                    || (text.includes('添加') && text.includes('库'));
            });
        }

        if (actionButton) return actionButton;
        await ctx.sleep(400);
    }
    return null;
};

/** 在已点过添加按钮的页面上找结算/下单按钮（含 shadow DOM 内的按钮） */
const findCheckoutButton = (ctx) => {
    const { doc, win, utils } = ctx;
    const allButtonsWithShadow = utils.findAllButtonsWithShadow(doc);

    const byClass = allButtonsWithShadow.find(btn => btn.classList?.contains('payment-order-confirm__btn'));
    if (byClass) return byClass;

    return allButtonsWithShadow.find(btn => {
        const text = utils.normalizeWhitespace(btn.textContent || '').toLowerCase();
        if (text.includes('buy now') || text.includes('立即购买')) return false;

        const isCheckoutContext = (btn.ownerDocument !== doc)
            || Boolean(win?.location?.pathname?.includes('/payment/'));
        if (isCheckoutContext) {
            return text.includes('add to library') || text.includes('添加到库')
                || text.includes('add to account') || text.includes('添加到账户');
        }
        return CHECKOUT_KEYWORDS.some(kw => text.includes(kw));
    });
};

/**
 * 点完添加按钮后等待进入「已拥有」态，期间积极寻找并点击结算/下单按钮。
 * 同一个按钮 2s 内不重复点，避免把它打成不可用。
 */
const waitForOwnedAfterClick = async (ctx, push, isItemOwned) => {
    const timeout = 60000;
    const startAt = ctx.now();

    return new Promise((resolve) => {
        let settled = false;
        // interval 必须先声明后赋值：回调有可能在 setIntervalFn 返回之前就被同步调用
        // （注入的定时器替身就会这么干），此时 const interval 还在 TDZ，
        // finish 里一引用就抛「Cannot access 'interval' before initialization」，
        // 把一次本该成功的领取打成失败。
        let interval = null;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            if (interval !== null) ctx.clearIntervalFn(interval);
            resolve(ok);
        };

        interval = ctx.setIntervalFn(() => {
            const currentState = isItemOwned();
            if (currentState.owned) {
                push(`Successfully owned (UI Match: ${currentState.reason})`);
                finish(true);
                return;
            }

            const checkoutBtn = findCheckoutButton(ctx);
            if (checkoutBtn && !checkoutBtn.disabled) {
                const lastClickTime = parseInt(checkoutBtn.dataset?.lastClickTime || '0', 10);
                const nowMs = ctx.now();
                if (nowMs - lastClickTime > 2000) {
                    push(`Found checkout/place order button [${(checkoutBtn.textContent || '').trim()}], clicking it.`);
                    checkoutBtn.dataset.lastClickTime = nowMs.toString();
                    ctx.utils.deepClick(checkoutBtn);
                }
            }

            if (ctx.now() - startAt > timeout) {
                push(`Timeout waiting for ownership: Timeout waiting for page to enter an 'owned' state. (UI might be stuck)`);
                finish(false);
            }
        }, 500);
    });
};

/**
 * 在一个已经停在商品详情页的文档上完成单条领取。
 *
 * @param {object} task    { uid, name, url }
 * @param {object} options 运行上下文，见 normalizeContext
 * @returns {Promise<{success: boolean, logs: string[]}>}
 */
export const acquireOnDetailPage = async (task, options = {}) => {
    const ctx = normalizeContext(options);
    const pushFn = options.log || noop;

    const logs = [];
    const push = (msg) => {
        logs.push(msg);
        try { pushFn(msg); } catch (e) { /* 日志收集器出错不得影响领取 */ }
    };
    ctx.log = push;

    let success = false;
    try {
        const pageReady = await waitForPageReady(ctx);
        if (!pageReady) {
            push('⚠️ 警告: 页面可能未完全加载，这可能导致操作失败');
        }

        await waitForKeyElement(ctx);
        await dismissAdultWarning(ctx);

        push('=== 页面状态诊断开始 ===');
        try {
            const report = ctx.diagnostics.diagnoseDetailPage();
            push(`页面标题: ${report.pageTitle}`);
            push(`可见按钮数量: ${report.buttons.filter(btn => btn.isVisible).length}`);
        } catch (e) {
            push(`页面诊断失败: ${e.message}`);
        }
        push('=== 页面状态诊断结束 ===');

        success = await checkOwnedViaApi(ctx, task, push);
        if (!success) success = await claimViaUi(ctx, push);
    } catch (error) {
        push(`A critical error occurred: ${error.message}`);
        success = false;
    }

    return { success, logs };
};

/**
 * UI 领取主流程：已拥有 → 外部链接 → 选许可 → 点添加 → 等「已拥有」。
 * 每一步都可能在中间就成功，因此逐段回传而不是一路走到黑。
 */
async function claimViaUi(ctx, push) {
    const isItemOwned = () => detectOwnedOnPage(ctx);

    const initialState = isItemOwned();
    if (initialState.owned) {
        push(`Item already owned on page load (UI Fallback PASS: ${initialState.reason}).`);
        return true;
    }

    const externalState = ctx.taskRunner?.getExternalProductState?.(ctx.doc) || { handled: false };
    if (externalState.handled) {
        push(`Detected non-purchasable external listing (${externalState.reason}). Marking task as handled.`);
        return true;
    }

    logButtonDiagnostics(ctx, push);

    if (await selectFreeLicense(ctx, push, isItemOwned)) return true;

    const actionButton = await findActionButton(ctx);
    if (!actionButton) {
        push('Could not find an add button.');
        return false;
    }

    push(`Found add button [${(actionButton.textContent || '').trim().substring(0, 30)}], clicking it.`);
    ctx.utils.deepClick(actionButton);

    return await waitForOwnedAfterClick(ctx, push, isItemOwned);
}
