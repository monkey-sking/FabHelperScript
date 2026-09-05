/**
 * Fab Helper - Iframe Claim Transport（同源 iframe 领取传输层）
 *
 * detail-claim.js 解决的是「页面已经在详情页时怎么领」，本模块解决的是
 * 「怎么把页面送到详情页」—— 也就是新流水线 DomClaim 缺的最后一块。
 *
 * 做法：在主标签页里挂一个同源隐藏 iframe 加载商品详情页，等它加载完，
 * 由主标签页直接驱动 iframe 内部的 DOM 完成领取，最后把 iframe 摘掉。
 * 全程不开新标签页，也就不需要 Worker 心跳 / WebRTC 防冻结 / 卡死看门狗
 * 那一整套为后台标签页打的补丁。
 *
 * 为什么这条路可行：www.fab.com 返回 `x-frame-options: SAMEORIGIN`，
 * 同源页面加载它是允许的，父页面也能读写其 contentDocument。
 *
 * 两个必须注意的点：
 *   1. iframe 的 URL 必须带 Config.CLAIM_FRAME_PARAM 标记，脚本在那个帧里
 *      会立刻退出（见 index.js main 开头的护栏）。否则 userscript 会在
 *      iframe 内二次初始化，实例抢占 / UI 重复 / 任务派发会与主标签页打架。
 *   2. 帧里不能 display:none —— 部分前端框架对隐藏元素会跳过渲染和懒加载。
 *      这里用「移到视口外」而不是隐藏，document-start 注入的全局 CSS 也为此
 *      特意豁免了带 data-fab-claim-frame 的 iframe。
 *
 * 所有环境依赖（父文档 / 建帧方式 / 等就绪策略 / 定时器）都可注入，
 * 因此这一段可以脱离浏览器被完整测试。
 */
import { Config } from '../config.js';
import { acquireOnDetailPage } from './detail-claim.js';

const noop = () => {};

export const defaultBuildUrl = (task) => {
    const base = `https://www.fab.com/listings/${encodeURIComponent(task && task.uid)}`;
    return `${base}?${Config.CLAIM_FRAME_PARAM}=1`;
};

/** 帧内样式：移出视口但参与布局，不用 display:none（会让部分框架跳过渲染） */
export const CLAIM_FRAME_STYLE =
    'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:0;';

/**
 * 判断 iframe 里的文档是不是「真实导航已经提交」的那一份。
 *
 * 这里有个很容易踩的坑：iframe 刚 appendChild 时，contentDocument 是初始的
 * about:blank 文档，而它的 readyState 已经是 'complete'。只检查 readyState 会
 * 立刻放行，于是 detail-claim 拿着一份空文档去领，8 秒后判成「页面没有可点按钮」
 * —— 而那是终态失败，整条商品就再也不会重试了。真正导航提交后 iframe 会换上
 * 一个新 Document，所以必须等 href 变成真实地址才算就绪。
 */
const isRealDocument = (doc) => {
    if (!doc || (doc.readyState !== 'interactive' && doc.readyState !== 'complete')) return false;
    let href = '';
    try {
        href = (doc.location && doc.location.href) || '';
    } catch (e) {
        // 读 location 抛异常 = 跨域，交给上层读 contentDocument 的分支处理
        return false;
    }
    return /^https?:/.test(href);
};

/**
 * 等 iframe 把详情页加载出来。
 * 只判定「真实导航已提交」：SPA 的内部渲染由 detail-claim 的就绪检测负责，
 * 这里不重复等，也不该等（重复等待只会让超时判定变得含糊）。
 */
const waitForFrameReady = async (iframe, { timeoutMs, sleep, now }) => {
    const startAt = now();
    while (now() - startAt < timeoutMs) {
        let doc = null;
        try {
            doc = iframe.contentDocument;
        } catch (e) {
            // 跨域时读 contentDocument 会直接抛：这不是「再等等就好」的问题
            return { ok: false, reason: `读不到 iframe 文档（跨域或被 CSP 拦截）: ${e.message}` };
        }
        if (isRealDocument(doc)) return { ok: true };
        await sleep(200);
    }
    return { ok: false, reason: `iframe 在 ${timeoutMs}ms 内没有加载完成` };
};

/**
 * 默认建帧实现：真的往父文档里挂一个 iframe。
 * 返回 { iframe, doc, win, close }；close 必须幂等 —— 领取成功、失败、
 * 超时三条路径都会调到它。
 */
export const createRealFrameOpener = (options = {}) => {
    const {
        parentDoc = (typeof document !== 'undefined' ? document : null),
        container = null,
        timeoutMs = 30000,
        sleep = (ms) => new Promise(r => setTimeout(r, ms)),
        now = () => Date.now(),
        log = noop
    } = options;

    return async (url) => {
        if (!parentDoc || typeof parentDoc.createElement !== 'function') {
            throw new Error('没有可用的父文档，无法创建领取 iframe');
        }

        const host = container || parentDoc.body || parentDoc.documentElement;
        const iframe = parentDoc.createElement('iframe');
        iframe.setAttribute('data-fab-claim-frame', '1');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = CLAIM_FRAME_STYLE;
        iframe.src = url;
        host.appendChild(iframe);

        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            try { iframe.remove(); } catch (e) { /* 已经不在文档里了 */ }
        };

        const ready = await waitForFrameReady(iframe, { timeoutMs, sleep, now });
        if (!ready.ok) {
            close();
            const err = new Error(ready.reason);
            err.retryable = true;   // 加载不出来多半是网络/风控，换条商品未必一样
            throw err;
        }

        log(`[IframeClaim] 详情页已在领取帧内就绪: ${url}`);
        return { iframe, doc: iframe.contentDocument, win: iframe.contentWindow, close };
    };
};

/**
 * 造一个「用 iframe 领单条商品」的函数，可直接作为 DomClaim 的 acquireFn。
 *
 * 返回值对齐 normalizeClaimOutcome 认识的 { success, reason, retryable }：
 *   - 帧加载失败 / 拿不到文档 / 帧内异常 → retryable: true
 *     这些都不是「这个商品领不了」，而是「这次没领成」，判成终态失败会让
 *     整份免费列表在事件日志里一次性定型，之后修好了也不会再试。
 *   - 帧内明确领不到（找不到按钮、超时未入库）→ retryable: false
 *     沿用 detail-claim 的判定，那是商品本身的问题。
 *
 * options:
 *   taskRunner  TaskRunner（detail-claim 需要，必须显式传入以免形成循环依赖）
 *   openFrame   建帧实现，默认 createRealFrameOpener(options)；测试可注入假帧
 *   buildUrl    (task) => url
 *   timeoutMs   帧加载超时
 *   log         (msg) => void
 *   claimOptions 透传给 acquireOnDetailPage。测试靠它注入虚拟定时器与假 Utils，
 *                否则帧内的轮询（8s 找按钮 / 60s 等入库）会真的跑上几十秒。
 */
export const createIframeAcquire = (options = {}) => {
    const {
        taskRunner = null,
        openFrame = createRealFrameOpener(options),
        buildUrl = defaultBuildUrl,
        log = noop,
        claimOptions = {}
    } = options;

    return async function acquireViaIframe(task) {
        if (!task || !task.uid) {
            return { success: false, reason: '任务缺少 uid', retryable: false };
        }

        let frame = null;
        try {
            frame = await openFrame(buildUrl(task));
            if (!frame || !frame.doc) {
                return { success: false, reason: '领取帧没有可用文档', retryable: true };
            }

            const result = await acquireOnDetailPage(task, {
                doc: frame.doc,
                win: frame.win,
                taskRunner,
                log,
                ...claimOptions
            });

            return {
                success: Boolean(result && result.success),
                reason: (result && result.logs && result.logs.slice(-1)[0]) || '',
                retryable: false
            };
        } catch (e) {
            // 帧本身没起来、跨域、帧内异常：都是「这次没领成」，不是商品的问题
            return {
                success: false,
                reason: (e && e.message) || String(e),
                retryable: (e && e.retryable) !== false
            };
        } finally {
            if (frame && typeof frame.close === 'function') frame.close();
        }
    };
};
