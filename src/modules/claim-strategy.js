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
 * 端点状态：Fab 的领取端点尚未抓包确认，因此 ApiClaim 默认不可用
 * （isAvailable() 为 false）。管道已铺好，确认端点后配置即可生效。
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
 * ApiClaim：接口领取。
 *
 * 领取端点待抓包确认（手动领取一件免费商品，观察 Network 面板中的 POST）。
 * 确认后调用 ApiClaim.configure({ endpoint }) 即可启用，无需改动流程代码。
 */
export const ApiClaim = {
    name: 'api',
    endpoint: null,
    method: 'POST',
    buildBody: null,
    fetchImpl: null, // 可注入，便于测试与替换传输层

    configure: ({ endpoint, method, buildBody, fetchImpl } = {}) => {
        if (endpoint) ApiClaim.endpoint = endpoint;
        if (method) ApiClaim.method = method;
        if (typeof buildBody === 'function') ApiClaim.buildBody = buildBody;
        if (typeof fetchImpl === 'function') ApiClaim.fetchImpl = fetchImpl;
    },

    isAvailable: () => Boolean(ApiClaim.endpoint) && typeof ApiClaim.fetchImpl === 'function',

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

        let response;
        try {
            response = await ApiClaim.fetchImpl({
                method: ApiClaim.method,
                url: ApiClaim.endpoint,
                headers: {
                    'content-type': 'application/json',
                    'x-csrftoken': csrfToken,
                    'x-requested-with': 'XMLHttpRequest'
                },
                data: JSON.stringify(
                    ApiClaim.buildBody ? ApiClaim.buildBody(task) : { listing_uid: task.uid }
                )
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

        // 403/404 属于终态失败，重试与回落都无意义
        if (status === 403 || status === 404) {
            return { result: CLAIM_RESULT.FAILURE, reason: `接口返回 ${status}`, retryable: false };
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

export const DomClaim = {
    name: 'dom',
    isAvailable: () => typeof domClaimImpl === 'function',
    claim: async (task) => {
        if (!DomClaim.isAvailable()) {
            return { result: CLAIM_RESULT.UNAVAILABLE, reason: 'DOM 领取未注入' };
        }
        const result = await domClaimImpl(task);
        // 兼容旧布尔式返回值
        if (typeof result === 'boolean') {
            return { result: result ? CLAIM_RESULT.SUCCESS : CLAIM_RESULT.FAILURE, reason: '' };
        }
        return result;
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
