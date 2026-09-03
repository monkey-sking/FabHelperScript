/**
 * Fab Helper - Rate Limiter Module（令牌桶）
 *
 * 把「并发」这个抽象从「开几个标签页」换成「每秒发几个请求」。
 *
 * 旧模型用 MAX_CONCURRENT_WORKERS = 7 控制压力，但标签数只是请求速率的拙劣代理：
 * 每个标签还要加载整个详情页（HTML + React 运行时 + GraphQL 批量查询），
 * 真实请求速率既不可控也不可知；而后台标签被浏览器节流后，标签数与速率更是彻底脱钩。
 * 为了把节流后的标签维持住，又必须引入 Web Worker 心跳、WebRTC 防冻结、卡死看门狗……
 * 一整条复杂度链条，全部源于选错了控制变量。
 *
 * 令牌桶直接控制真正的目标量：速率。AIMD 策略（和性增、乘性减）——
 * 连续成功则缓慢升速回到基准，遇 429 则立即折半并暂停到 Retry-After 指定时刻。
 *
 * 本模块为纯逻辑、零依赖，不碰 GM_* / DOM / 定时器，因此可以直接同步单元测试。
 * 时间一律由调用方注入（now 参数），测试无需等待真实时间流逝。
 */

export const RateLimiter = {
    // 基准速率（次/分钟），突发上限，降速下限
    baseRatePerMin: 40,
    minRatePerMin: 4,
    currentRatePerMin: 40,
    capacity: 5,

    tokens: 5,
    lastRefill: 0,
    pauseUntil: 0,

    // 连续成功计数，用于和性增
    _successStreak: 0,
    _penaltyCount: 0,

    configure: ({ ratePerMin, burst, minRatePerMin } = {}) => {
        if (Number.isFinite(ratePerMin) && ratePerMin > 0) {
            RateLimiter.baseRatePerMin = ratePerMin;
            RateLimiter.currentRatePerMin = ratePerMin;
        }
        if (Number.isFinite(minRatePerMin) && minRatePerMin > 0) {
            RateLimiter.minRatePerMin = Math.min(minRatePerMin, RateLimiter.baseRatePerMin);
        }
        if (Number.isFinite(burst) && burst > 0) {
            RateLimiter.capacity = burst;
        }
        RateLimiter.reset();
    },

    reset: (now = 0) => {
        RateLimiter.currentRatePerMin = RateLimiter.baseRatePerMin;
        RateLimiter.capacity = Math.max(1, RateLimiter.capacity);
        RateLimiter.tokens = RateLimiter.capacity;
        RateLimiter.lastRefill = now;
        RateLimiter.pauseUntil = 0;
        RateLimiter._successStreak = 0;
        RateLimiter._penaltyCount = 0;
    },

    get refillPerMs() {
        return RateLimiter.currentRatePerMin / 60000;
    },

    isPaused: (now) => now < RateLimiter.pauseUntil,

    /**
     * 补充令牌。暂停期间冻结补充（不推进 lastRefill），
     * 避免解除限速的瞬间攒满一桶、立刻再次撞上限速。
     */
    _refill: (now) => {
        if (RateLimiter.isPaused(now)) {
            RateLimiter.lastRefill = now;
            return;
        }
        // 暂停区间不计入令牌补充：把补充起点推到暂停结束时刻。
        // 只在 tryAcquire 时推进 lastRefill 是不够的——暂停期间若无人查询，
        // 解除瞬间会一次性补满整桶并立刻再次撞上限速。
        if (RateLimiter.pauseUntil > RateLimiter.lastRefill) {
            RateLimiter.lastRefill = Math.max(RateLimiter.lastRefill, RateLimiter.pauseUntil);
        }
        const elapsed = Math.max(0, now - RateLimiter.lastRefill);
        if (elapsed <= 0) return;
        RateLimiter.tokens = Math.min(
            RateLimiter.capacity,
            RateLimiter.tokens + elapsed * RateLimiter.refillPerMs
        );
        RateLimiter.lastRefill = now;
    },

    /** 尝试取 n 个令牌。取到返回 true，否则 false（调用方应等待 nextAvailableMs）。 */
    tryAcquire: (count = 1, now = Date.now()) => {
        if (RateLimiter.isPaused(now)) {
            RateLimiter.lastRefill = now;
            return false;
        }
        RateLimiter._refill(now);
        if (RateLimiter.tokens >= count) {
            RateLimiter.tokens -= count;
            RateLimiter._successStreak = 0;
            return true;
        }
        return false;
    },

    /** 距离可以取到 n 个令牌还需等待多少毫秒（暂停中会一并计入）。 */
    nextAvailableMs: (count = 1, now = Date.now()) => {
        const pauseLeft = Math.max(0, RateLimiter.pauseUntil - now);
        if (pauseLeft > 0) return pauseLeft;

        // 用当前令牌数推算，不修改状态（查询必须是无副作用的）
        const tokens = Math.min(
            RateLimiter.capacity,
            RateLimiter.tokens + Math.max(0, now - RateLimiter.lastRefill) * RateLimiter.refillPerMs
        );
        const missing = count - tokens;
        if (missing <= 0) return 0;
        return Math.ceil(missing / RateLimiter.refillPerMs);
    },

    /**
     * 收到 429：暂停到 retryAfterMs 之后，并把速率折半（乘性减）。
     * retryAfterMs 缺省时按已连续被惩罚的次数指数退避，上限 10 分钟。
     */
    penalize: (retryAfterMs, now = Date.now()) => {
        RateLimiter._penaltyCount += 1;
        const backoff = retryAfterMs != null && retryAfterMs >= 0
            ? retryAfterMs
            : Math.min(600000, 30000 * Math.pow(2, RateLimiter._penaltyCount - 1));
        RateLimiter.pauseUntil = now + backoff;
        RateLimiter.currentRatePerMin = Math.max(
            RateLimiter.minRatePerMin,
            Math.floor(RateLimiter.currentRatePerMin / 2)
        );
        // 惩罚后清空桶，避免解除瞬间突发
        RateLimiter.tokens = 0;
        RateLimiter.lastRefill = now;
        RateLimiter._successStreak = 0;
        return { pauseMs: backoff, ratePerMin: RateLimiter.currentRatePerMin };
    },

    /**
     * 领取成功后调用，连续成功则和性增，缓慢回到基准速率。
     * 每 8 次连续成功上调基准的 25%，但绝不超过基准。
     */
    reward: () => {
        RateLimiter._penaltyCount = 0;
        RateLimiter._successStreak += 1;
        if (RateLimiter._successStreak >= 8) {
            RateLimiter._successStreak = 0;
            const step = Math.max(1, Math.floor(RateLimiter.baseRatePerMin * 0.25));
            RateLimiter.currentRatePerMin = Math.min(
                RateLimiter.baseRatePerMin,
                RateLimiter.currentRatePerMin + step
            );
        }
        return RateLimiter.currentRatePerMin;
    },

    status: (now = Date.now()) => {
        // 先补充再读数，否则报告的是上次调用时的陈旧令牌数
        RateLimiter._refill(now);
        return {
            ratePerMin: RateLimiter.currentRatePerMin,
            baseRatePerMin: RateLimiter.baseRatePerMin,
            tokens: Number(RateLimiter.tokens.toFixed(2)),
            capacity: RateLimiter.capacity,
            paused: RateLimiter.isPaused(now),
            pauseLeftMs: Math.max(0, RateLimiter.pauseUntil - now),
            penaltyCount: RateLimiter._penaltyCount
        };
    }
};
