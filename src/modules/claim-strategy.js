/**
 * Fab Helper - Claim Strategy Module
 *
 * 把「怎么把商品领进库」从流程代码里剥离出来，成为一个可替换的策略。
 *
 * 现状：领取逻辑深埋在 TaskRunner.processDetailPage（单函数约 885 行），
 * 与「打开完整详情页 → 按 class hash 找按钮 → 点击 → 轮询是否入库」这条
 * DOM 自动化路径死死绑在一起。Fab 前端每次改版都可能打碎它——git 历史里
 * 「fix(worker) 按钮选择器 / 404 误判 / className 大小写」这类提交反复出现，
 * 正是这个耦合的代价。
 *
 * 新模型区分两条路径：
 *   ApiClaim —— 直接调用后端接口。快、稳、不受前端改版影响。
 *   DomClaim —— 回落路径，复用现有 DOM 自动化。慢、脆，但永远可用。
 *
 * 关键收益是可观测：Executor 记录各自的尝试与成功次数，于是「回落率」
 * 变成一个可监控的数字。当 ApiClaim 不可用时回落率是 100%，一旦接口接通
 * 它应该趋近于 0——这个数字会直接告诉你 DOM 路径是否已经悄悄失效。
 *
 * 回落判定（重要）：并非所有失败都值得回落到 DOM。
 *   - 可重试故障（5xx、网络异常）→ 回落。灰度期间不能让用户卡死。
 *   - 终态失败（403 / 404 / 400 / 会话失效）→ 不回落。重试与回落都无意义。
 *   - 429 → 不回落。限速时叠加请求只会让情况更糟，应交给令牌桶退避。
 * 每个 outcome 用 retryable 标记这一判断，Executor 据此决定是否继续尝试。
 *
 * 端点状态：领取端点已于 2026-09 抓包确认（见下方 FAB_CLAIM_ENDPOINT 的
 * 证据链），并且成功响应 204 已于 2026-09-08 在登录态下实测确认——用真实免费
 * 商品的 startingPrice.offerId 与详情页 licenses[].offerId（price===0）两种
 * offer_id 来源均成功入库。此前本仓库从没有过领取接口——全量扫描 884 个历史
 * blob 只出现过 search / listings-states / prices-infos 三个只读端点，领取
 * 一直是 DOM 点击。端点确认后，仅入库动作切换为 ApiClaim；列表枚举仍由页面 DOM 负责。
 */
import { Utils } from './utils.js';

export const CLAIM_RESULT = {
    SUCCESS: 'success',
    FAILURE: 'failure',
    SKIPPED: 'skipped',         // 主动跳过：付费 / 外部站 / 不可购买
    RATE_LIMITED: 'rate_limited', // 撞上 429，需退避
    UNAVAILABLE: 'unavailable'    // 该策略不可用，应由 Executor 尝试下一个
};

/**
 * 领取端点 —— 2026-09 抓包确认，勿再凭猜测改动。
 *
 * 证据链（在未登录的 www.fab.com 页面内实测）：
 *   POST /i/listings/{uid}/add-to-library  → 401 {"detail":"身份认证信息未提供。"}
 *   POST /i/listings/{uid}/add-to-libary   → 404 Page not found（故意拼错）
 *   POST /i/listings/claim                 → 404 Page not found（早期误猜的端点）
 *   POST /i/listings/{uid}/zzz-bogus       → 404 Page not found
 * 鉴权中间件先于路由匹配报错 → 只有真实存在的路由才会到 401。
 *
 * 登录态实测（2026-09-08，账号 Game7caifei）：
 *   请求  POST，Content-Type: multipart/form-data; boundary=----FabHelperFormBoundary，
 *         字段 offer_id，header 带 x-csrftoken（取自 fab_csrftoken cookie）与
 *         x-requested-with: XMLHttpRequest。
 *   成功  204，无响应体。
 *   失败  400 {"detail":{"offerId":["该字段不能为空。"]}}（offer_id 缺失/为空）；
 *         401（未登录）；429（限速）；5xx（服务端故障，可重试回落）。
 *   offer_id 来源：快路径用搜索结果 startingPrice.offerId；慢路径用详情页
 *   licenses[] 中 priceTier.price===0 的 offerId（优先 professional 档）。
 */
export const FAB_CLAIM_ENDPOINT = 'https://www.fab.com/i/listings/{uid}/add-to-library';
export const FAB_LISTING_ENDPOINT = 'https://www.fab.com/i/listings/{uid}';

/**
 * multipart/form-data 请求体。
 *
 * 必须自己拼 boundary：GM_xmlhttpRequest 不会像浏览器那样替我们生成，
 * 手动设 Content-Type 又极易漏掉 boundary 而被服务端判 400。
 */
export const multipartBody = (fields, boundary = '----FabHelperFormBoundary') => {
    const lines = [];
    Object.keys(fields || {}).forEach((key) => {
        lines.push(`--${boundary}`);
        lines.push(`Content-Disposition: form-data; name="${key}"`);
        lines.push('');
        lines.push(String(fields[key]));
    });
    lines.push(`--${boundary}--`);
    lines.push('');
    return lines.join('\r\n');
};

/**
 * 从详情页 JSON 里挑出「免费许可」的 offerId。
 *
 * 判据来自竞品实测：priceTier.price === 0 的许可才是可白拿的；同一商品
 * 若 professional 档也免费则优先取它，否则取第一个免费档。
 * 注意价格单位是分（实测 6920 = $69.20），所以只与 0 比较是安全的。
 */
export const pickFreeOfferId = (listing) => {
    const list = Array.isArray(listing && listing.licenses) ? listing.licenses : [];
    const free = list.filter(
        (l) => l && l.offerId && l.priceTier && Number(l.priceTier.price) === 0
    );
    if (!free.length) return null;
    const pro = free.find((l) => l.slug === 'professional');
    return (pro || free[0]).offerId;
};

/**
 * ApiClaim：接口领取。
 *
 * 默认即走已确认的 Fab 端点：POST multipart/form-data，字段 offer_id。
 * offer_id 不能凭空构造，必须来自商品的许可信息，因此领取前需要先解析它。
 */
export const ApiClaim = {
    name: 'api',
    endpoint: FAB_CLAIM_ENDPOINT,
    method: 'POST',
    boundary: '----FabHelperFormBoundary',
    buildBody: null,
    resolveOfferId: null, // 可注入：(task) => offerId | null
    fetchImpl: null, // 可注入，便于测试与替换传输层

    configure: ({ endpoint, method, buildBody, resolveOfferId, fetchImpl, boundary } = {}) => {
        if (endpoint) ApiClaim.endpoint = endpoint;
        if (method) ApiClaim.method = method;
        if (boundary) ApiClaim.boundary = boundary;
        if (typeof buildBody === 'function' || buildBody === null) ApiClaim.buildBody = buildBody;
        if (typeof resolveOfferId === 'function' || resolveOfferId === null) ApiClaim.resolveOfferId = resolveOfferId;
        if (typeof fetchImpl === 'function' || fetchImpl === null) ApiClaim.fetchImpl = fetchImpl;
    },

    isAvailable: () => Boolean(ApiClaim.endpoint) && typeof ApiClaim.fetchImpl === 'function',

    /** 端点模板里的 {uid} 换成真实 uid。 */
    _url: (task) => String(ApiClaim.endpoint).replace(/\{uid\}/g, encodeURIComponent(task && task.uid)),

    /**
     * 解析 offer_id。
     * 快路径：搜索结果自带 startingPrice.offerId，而免费商品的最低价档就是
     * 免费档，可以直接用，省掉每件商品一次详情请求。
     * 慢路径：拿不到时才回源详情页，按免费 + 优先 professional 挑。
     */
    _resolveOfferId: async (task) => {
        if (typeof ApiClaim.resolveOfferId === 'function') return ApiClaim.resolveOfferId(task);
        if (task && task.offerId) return task.offerId;

        const res = await ApiClaim.fetchImpl({
            method: 'GET',
            url: String(FAB_LISTING_ENDPOINT).replace(/\{uid\}/g, encodeURIComponent(task && task.uid)),
            headers: { accept: 'application/json' }
        });
        if (!res || res.status !== 200) return null;
        try {
            return pickFreeOfferId(JSON.parse(res.responseText));
        } catch (e) {
            return null;
        }
    },

    claim: async (task) => {
        if (!ApiClaim.isAvailable()) {
            return { result: CLAIM_RESULT.UNAVAILABLE, reason: '领取端点未配置' };
        }

        const csrfToken = Utils.getCookie('fab_csrftoken');
        if (!csrfToken) {
            // 会话问题回落 DOM 同样无解，属终态
            return {
                result: CLAIM_RESULT.FAILURE,
                reason: '缺少 CSRF token，未登录或会话已失效',
                retryable: false
            };
        }

        // offer_id 是必填项，缺失时发请求只会拿到 400，别浪费一次调用
        let offerId = null;
        try {
            offerId = await ApiClaim._resolveOfferId(task);
        } catch (e) {
            return { result: CLAIM_RESULT.FAILURE, reason: `解析 offer_id 失败: ${e.message}`, retryable: true };
        }
        if (!offerId) {
            return {
                result: CLAIM_RESULT.FAILURE,
                reason: '未找到免费许可的 offer_id',
                retryable: false
            };
        }

        // buildBody 可返回字符串、裸对象，或 { body, contentType }
        const built = typeof ApiClaim.buildBody === 'function'
            ? ApiClaim.buildBody({ ...task, offerId })
            : { offer_id: offerId };
        const isString = typeof built === 'string';
        const body = isString
            ? built
            : (built && typeof built.body === 'string' ? built.body : multipartBody(built, ApiClaim.boundary));
        const contentType = (!isString && built && built.contentType)
            ? built.contentType
            : `multipart/form-data; boundary=${ApiClaim.boundary}`;

        let response;
        try {
            response = await ApiClaim.fetchImpl({
                method: ApiClaim.method,
                url: ApiClaim._url(task),
                headers: {
                    'content-type': contentType,
                    'x-csrftoken': csrfToken,
                    'x-requested-with': 'XMLHttpRequest'
                },
                data: body
            });
        } catch (e) {
            // 网络层异常通常是暂时性的，值得回落重试
            return { result: CLAIM_RESULT.FAILURE, reason: `请求异常: ${e.message}`, retryable: true };
        }

        const status = response && response.status;

        // 429 必须与普通失败区分开：调用方要据此触发令牌桶退避
        if (status === 429) {
            const raw = response.getResponseHeader ? response.getResponseHeader('retry-after') : null;
            const retryAfterMs = raw ? Number(raw) * 1000 : null;
            return {
                result: CLAIM_RESULT.RATE_LIMITED,
                reason: '接口返回 429',
                retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : null
            };
        }

        if (status >= 200 && status < 300) return { result: CLAIM_RESULT.SUCCESS, reason: '' };

        // 401 是未登录：实测返回 {"detail":"身份认证信息未提供。"}。
        // 回落 DOM 同样没有领取按钮，属终态。
        if (status === 401) {
            return { result: CLAIM_RESULT.FAILURE, reason: '接口返回 401，未登录或会话已失效', retryable: false };
        }

        // 403/404 属于终态失败，重试与回落都无意义
        if (status === 403 || status === 404) {
            return { result: CLAIM_RESULT.FAILURE, reason: `接口返回 ${status}`, retryable: false };
        }

        // 400 多为请求体不合法（例如漏了 boundary），重试只会重复同一个错误
        if (status === 400) {
            return { result: CLAIM_RESULT.FAILURE, reason: '接口返回 400，请求体可能被拒绝', retryable: false };
        }

        // 5xx 是服务端临时故障，值得回落到 DOM 再试一次
        if (status >= 500) {
            return { result: CLAIM_RESULT.FAILURE, reason: `接口返回 ${status}`, retryable: true };
        }

        return {
            result: CLAIM_RESULT.FAILURE,
            reason: `接口返回 ${status || '未知状态'}`,
            retryable: false
        };
    }
};

/**
 * DomClaim：回落路径，复用现有 DOM 自动化。
 * 具体实现由外部注入（setDomClaim），避免与 task-runner 形成循环依赖。
 */
let domClaimImpl = null;
export const setDomClaim = (fn) => { domClaimImpl = fn; };

/**
 * 把注入实现的返回值归一成规范形态。
 *
 * 之所以需要这层：现有 DOM 自动化（task-runner 的 worker 协议）返回的是
 * { success: true }，而本模块的规范字段是 { result }。若不做归一，
 * 接入时 result 为 undefined，ClaimExecutor 会静默判成
 * 「没有可用的领取策略」—— 线上表现为全部领取失败且看不出原因。
 *
 * 支持三种形态：布尔（旧式）、{ success }（现有 worker 协议）、{ result }（规范）。
 * 无法识别的返回一律判为终态失败，绝不退化成「可重试」，避免无限回落。
 */
export const normalizeClaimOutcome = (raw) => {
    if (typeof raw === 'boolean') {
        return { result: raw ? CLAIM_RESULT.SUCCESS : CLAIM_RESULT.FAILURE, reason: '' };
    }
    if (raw && typeof raw === 'object') {
        if (raw.result) return raw;
        if (typeof raw.success === 'boolean') {
            return {
                result: raw.success ? CLAIM_RESULT.SUCCESS : CLAIM_RESULT.FAILURE,
                reason: typeof raw.reason === 'string' ? raw.reason : '',
                retryable: raw.retryable === true
            };
        }
    }
    return {
        result: CLAIM_RESULT.FAILURE,
        reason: '领取返回值无法识别',
        retryable: false
    };
};

export const DomClaim = {
    name: 'dom',
    isAvailable: () => typeof domClaimImpl === 'function',
    claim: async (task) => {
        if (!DomClaim.isAvailable()) {
            return { result: CLAIM_RESULT.UNAVAILABLE, reason: 'DOM 领取未注入' };
        }
        return normalizeClaimOutcome(await domClaimImpl(task));
    }
};

export const ClaimExecutor = {
    preferApi: true,
    metrics: {
        api: { attempts: 0, success: 0 },
        dom: { attempts: 0, success: 0 },
        unavailable: 0
    },

    resetMetrics: () => {
        ClaimExecutor.metrics = {
            api: { attempts: 0, success: 0 },
            dom: { attempts: 0, success: 0 },
            unavailable: 0
        };
    },

    /**
     * 依次尝试策略，返回首个非 UNAVAILABLE 的结果。
     * 策略抛异常或不可用都会回落到下一个，绝不向上冒泡。
     */
    claim: async (task, { preferApi = ClaimExecutor.preferApi } = {}) => {
        const order = preferApi ? [ApiClaim, DomClaim] : [DomClaim, ApiClaim];

        for (const strategy of order) {
            if (!strategy.isAvailable()) {
                ClaimExecutor.metrics.unavailable += 1;
                continue;
            }

            let outcome;
            try {
                ClaimExecutor.metrics[strategy.name].attempts += 1;
                outcome = await strategy.claim(task);
            } catch (e) {
                // 策略自身崩溃视为可重试故障，交给下一个策略
                outcome = { result: CLAIM_RESULT.FAILURE, reason: `策略异常: ${e.message}`, retryable: true };
            }

            if (!outcome || outcome.result === CLAIM_RESULT.UNAVAILABLE) continue;

            // 终态失败（403/404/429/会话失效）不再回落：重试无益，
            // 且限速时叠加请求只会雪上加霜。
            if (outcome.result === CLAIM_RESULT.FAILURE && !outcome.retryable) {
                return { ...outcome, strategy: strategy.name };
            }
            if (outcome.result === CLAIM_RESULT.FAILURE && outcome.retryable) continue;

            if (outcome.result === CLAIM_RESULT.SUCCESS) {
                ClaimExecutor.metrics[strategy.name].success += 1;
            }
            return { ...outcome, strategy: strategy.name };
        }

        return { result: CLAIM_RESULT.FAILURE, reason: '没有可用的领取策略', strategy: null };
    },

    /**
     * 回落率：DOM 尝试数占总尝试数的比例。
     * API 通路健康时应趋近 0；若长期为 1，说明接口路径没生效。
     */
    fallbackRate: () => {
        const { api, dom } = ClaimExecutor.metrics;
        const total = api.attempts + dom.attempts;
        return total === 0 ? 0 : dom.attempts / total;
    },

    stats: () => {
        const { api, dom, unavailable } = ClaimExecutor.metrics;
        return {
            api,
            dom,
            unavailable,
            fallbackRate: ClaimExecutor.fallbackRate()
        };
    }
};
