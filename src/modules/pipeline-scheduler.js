/**
 * Fab Helper - Pipeline Scheduler Module（流水线调度器）
 *
 * 与 Pipeline 分开，是因为两者关心的事不同：
 *   Pipeline 只负责「一步做什么」；调度器负责「多快做、做完了要不要再来一遍」。
 *
 * 后者正是旧实现里最容易出错的部分 —— 四处散落的刷新兜底、暂停后恢复的
 * 时钟错乱、失败后被当成无事发生继续全速重试 —— 而且它们全都藏在真实
 * 定时器背后，无法被测试。把它单独成模块后，调度策略可以脱离 setTimeout，
 * 用注入的时钟逐步验证。
 *
 * 三条硬约束，每一条都对应旧实现的一个具体故障：
 *   1. 一轮到底后不自动重扫。执行开关保持开启时若自动重扫，脚本会在几秒内把
 *      整份免费列表重新翻一遍，既无意义地反复请求接口，也放大被风控的概率。
 *      重新枚举需要满足其一：用户重新拨动过执行开关，或到了 rescanIntervalMs。
 *   2. 重新枚举保留事件历史（pipeline.restart 而非 reset）。历史里已 CLAIMED /
 *      FAILED / SKIPPED 的 uid 不会再次进入待领队列，这是不重复领取的唯一保证。
 *   3. 任何异常都必须换成退避时长。吞掉异常后按 0 延迟继续调度，等于以最快
 *      速度反复猛打接口，一次偶发 429 会被自己打成持续风控。
 */
import { Pipeline } from './pipeline.js';
import { STATE } from './state-machine.js';
import { RateLimiter } from './rate-limiter.js';

export const IDLE_POLL_MS = 2000;   // 未执行：等用户开开关，需要点得动
export const DONE_POLL_MS = 10000;  // 本轮到底且未开自动重扫：低频等待即可
export const PERSIST_INTERVAL_MS = 15000;

export const RUNNING_STATES = [
    STATE.SCANNING,
    STATE.CLAIMING,
    STATE.VERIFYING,
    STATE.RATE_LIMITED
];

/**
 * options:
 *   pipeline        被测/被调度的流水线（默认全局 Pipeline）
 *   isExecuting     () => boolean，读执行开关
 *   persist         (now) => void，落盘回调
 *   rescanIntervalMs 一轮到底后自动重扫的间隔，0 = 不自动重扫
 *   log             (level, msg) => void
 *   setTimeoutFn / clearTimeoutFn / nowFn  定时器与时钟注入，测试全靠它们
 */
export const createPipelineScheduler = (options = {}) => {
    const {
        pipeline = Pipeline,
        limiter = RateLimiter,
        isExecuting = () => false,
        persist = () => {},
        log = () => {},
        setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
        clearTimeoutFn = (id) => clearTimeout(id),
        nowFn = () => Date.now()
    } = options;

    let rescanIntervalMs = Math.max(0, Number(options.rescanIntervalMs) || 0);

    let running = false;
    let timer = null;
    let prevExecuting = false;
    // 脚本启动即带着「执行中」时，视为一次开始请求（与旧版自动恢复行为一致）
    let restartRequested = true;
    let passActive = false;
    let lastPassAt = 0;
    let lastPersistAt = 0;

    const isRescanDue = (now) =>
        rescanIntervalMs > 0 && lastPassAt > 0 && now - lastPassAt >= rescanIntervalMs;

    /** 起一程新的枚举。历史保留，只重置运行态。 */
    const beginPass = (now) => {
        pipeline.restart(now);
        passActive = true;
        restartRequested = false;
        lastPassAt = now;
        log('info', '[Pipeline] 开始新一程枚举（保留历史，已处理商品不会重复领取）。');
    };

    /**
     * 推进一步，返回调用方应等待的毫秒数。
     * 不自行调度 —— 自调度只发生在 start() 的循环里，这样测试可以逐步驱动。
     */
    const tick = async () => {
        const now = nowFn();
        const executing = isExecuting() === true;

        // 暂停 → 恢复的上升沿：请求重扫，并把状态机时钟推到当前。
        // 不推时钟的话，暂停时长会被算进超时判定，恢复瞬间就误触发超时转移
        // （SCANNING 超时被当成「列表已到底」，整轮枚举会被提前结束）。
        if (executing && !prevExecuting) {
            restartRequested = true;
            pipeline.fsm.refreshClock(now);
        }
        prevExecuting = executing;

        if (!executing) return IDLE_POLL_MS;

        try {
            if (pipeline.fsm.is(STATE.IDLE)) {
                // IDLE 有两种来源：本程被超时交回，或压根还没开始
                if (passActive) {
                    pipeline.fsm.refreshClock(now);
                    pipeline.start(now);
                } else if (restartRequested || isRescanDue(now)) {
                    beginPass(now);
                }
            } else if (pipeline.fsm.is(STATE.DONE)) {
                // 先收尾，再判断是否要起新一程 —— 两件事必须在同一步里都做：
                // 若收尾后直接返回，恰好在这一步到达的「用户重新开启执行」请求
                // 会被吞掉，用户得再拨一次开关才会重扫。
                // 收尾时 restartRequested 已被 beginPass 消费为 false、
                // isRescanDue 也尚未到期，因此这里不会顺手触发自动重扫。
                if (passActive) {
                    passActive = false;
                    lastPassAt = now;
                    log('info', `[Pipeline] 本程结束：${JSON.stringify(pipeline.log.stats())}。`);
                    persist(now);
                }
                if (restartRequested || isRescanDue(now)) beginPass(now);
            }

            if (pipeline.fsm.is(...RUNNING_STATES)) {
                await pipeline.tick(now);

                // 按节奏落盘：中途关页面也不丢已领取记录
                if (now - lastPersistAt >= PERSIST_INTERVAL_MS) {
                    lastPersistAt = now;
                    persist(now);
                }
            }

            const delay = pipeline.nextDelayMs(nowFn());
            return Number.isFinite(delay) ? Math.max(0, delay) : DONE_POLL_MS;
        } catch (e) {
            // 异常不得被静默吞掉后继续按 0 延迟调度。统一换成退避：
            // 服务端给了 Retry-After 就听它的，否则走限速器的指数退避。
            const retryAfterMs = e && Number.isFinite(e.retryAfterMs) ? e.retryAfterMs : null;
            const pause = limiter.penalize(retryAfterMs, now);
            log('error',
                `[Pipeline] tick 出错: ${e && e.message}，退避 ${Math.round(pause.pauseMs / 1000)}s` +
                `（速率降至 ${pause.ratePerMin}/min）`);
            return Math.max(0, pause.pauseMs);
        }
    };

    const loop = async () => {
        if (!running) return;
        let delay = DONE_POLL_MS;
        try {
            delay = await tick();
        } catch (e) {
            log('error', `[Pipeline] 调度循环异常: ${e && e.message}`);
        }
        if (!running) return;
        timer = setTimeoutFn(loop, Math.max(0, delay));
    };

    return {
        tick,
        start: () => {
            if (running) return false;
            running = true;
            loop();
            return true;
        },
        stop: () => {
            running = false;
            prevExecuting = false;
            if (timer != null) {
                clearTimeoutFn(timer);
                timer = null;
            }
            return true;
        },
        configure: ({ rescanIntervalMs: interval } = {}) => {
            if (Number.isFinite(interval)) rescanIntervalMs = Math.max(0, Number(interval));
            return rescanIntervalMs;
        },
        status: () => ({
            running,
            passActive,
            restartRequested,
            lastPassAt,
            rescanIntervalMs,
            state: pipeline.fsm.state
        })
    };
};
