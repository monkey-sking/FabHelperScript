/**
 * Fab Helper - Pipeline Module（单标签页领取流水线编排器）
 *
 * 这是重构后的主流程，用来取代「主标签页扫描 → 开 7 个 worker 标签页 →
 * 每个标签加载完整详情页 → DOM 点击」这条链路。
 *
 * 与旧流程的三点根本差异：
 *   1. 枚举走 /i/listings/search 的 cursor 分页，而不是滚动 DOM 骗页面发请求。
 *      「是否到底」由 cursors.next === null 权威判定，不再靠哨兵是否触发来猜。
 *   2. 并发由令牌桶按速率控制，而不是开几个标签页。单标签页内顺序推进，
 *      因此不存在跨标签页通信、实例争抢、后台节流、卡死看门狗这些问题。
 *   3. 状态全部落在 EventLog 上，异常统一收敛到 RATE_LIMITED 一条退避回路。
 *
 * 所有副作用（分页请求、入库复查、领取执行）都通过 deps 注入，
 * 本模块自身不碰网络与 DOM，因此整个流程可以在测试里同步跑完。
 */
import { EventLog, EVENT_STATE } from './event-log.js';
import { RateLimiter } from './rate-limiter.js';
import { TaskStateMachine, STATE } from './state-machine.js';
import { ClaimExecutor, CLAIM_RESULT } from './claim-strategy.js';

export const Pipeline = {
    fsm: TaskStateMachine,
    limiter: RateLimiter,
    log: EventLog,
    executor: ClaimExecutor,

    cursor: null,
    isEndOfList: false,
    pendingVerify: null,
    pagesFetched: 0,

    deps: {
        // 拉取一页列表，返回 { items: [{uid,url,name}], nextCursor }
        fetchPage: null,
        // 复查某 uid 是否确实已入库，返回 boolean
        verifyOwned: null,
        // 过滤不需要领取的商品，返回 null 表示领取，返回字符串表示跳过原因
        filter: null
    },

    /**
     * 注入副作用适配器。显式传 null 可清除对应项——若只允许覆盖而不允许清除，
     * 上一次注入的过滤器会静默残留并影响后续流程。
     */
    configure: ({ fetchPage, verifyOwned, filter, ratePerMin, burst } = {}) => {
        if (typeof fetchPage === 'function' || fetchPage === null) Pipeline.deps.fetchPage = fetchPage;
        if (typeof verifyOwned === 'function' || verifyOwned === null) Pipeline.deps.verifyOwned = verifyOwned;
        if (typeof filter === 'function' || filter === null) Pipeline.deps.filter = filter;
        if (Number.isFinite(ratePerMin) || Number.isFinite(burst)) {
            RateLimiter.configure({ ratePerMin, burst });
        }
    },

    // 连续撞 429 的重试上限。超过后放弃当前商品并记为失败，否则
    // 「退避 → 恢复 → 再撞」会无限循环：状态机的退避上限每次重新进入
    // RATE_LIMITED 时都被重置，因此兜不住这种反复限速。
    maxConsecutiveRateLimits: 5,
    consecutiveRateLimits: 0,

    reset: (now = 0) => {
        Pipeline.cursor = null;
        Pipeline.isEndOfList = false;
        Pipeline.pendingVerify = null;
        Pipeline.pagesFetched = 0;
        Pipeline.consecutiveRateLimits = 0;
        EventLog.reset();
        RateLimiter.reset(now);
        TaskStateMachine.reset(now);
        ClaimExecutor.resetMetrics();
    },

    start: (now = Date.now()) => {
        Pipeline.fsm.start(now);
        return Pipeline.fsm.state;
    },

    stop: (now = Date.now()) => {
        Pipeline.fsm.stop(now);
        Pipeline.pendingVerify = null;
        return Pipeline.fsm.state;
    },

    /**
     * 推进一步。返回本步的动作摘要，调用方据此决定下一步等待多久。
     * 不持有定时器、不自己 sleep —— 调度节奏完全由调用方掌握。
     *
     * 注意：当由 run() 驱动时，等待发生在 nextDelayMs 之后、下一次 tick 之前，
     * 因此 _stepClaim 内部的 'wait' 分支通常不会命中——它服务于直接调用
     * tick() 的调度方（此时调用方尚未按 nextDelayMs 等待）。
     */
    tick: async (now = Date.now()) => {
        // 超时先于业务：任何状态卡太久都由状态机按策略表处理
        const timeout = Pipeline.fsm.tick(now);
        if (timeout) return { action: 'timeout', ...timeout };

        switch (Pipeline.fsm.state) {
            case STATE.SCANNING: return Pipeline._stepScan(now);
            case STATE.CLAIMING: return Pipeline._stepClaim(now);
            case STATE.VERIFYING: return Pipeline._stepVerify(now);
            case STATE.RATE_LIMITED: return Pipeline._stepRecover(now);
            default: return { action: 'idle', state: Pipeline.fsm.state };
        }
    },

    /** 调用方应在再次 tick 前等待的毫秒数 */
    nextDelayMs: (now = Date.now()) => {
        if (Pipeline.fsm.is(STATE.IDLE, STATE.DONE)) return Infinity;
        if (Pipeline.limiter.isPaused(now)) return Pipeline.limiter.status(now).pauseLeftMs || 1000;
        if (Pipeline.fsm.is(STATE.CLAIMING)) {
            const wait = Pipeline.limiter.nextAvailableMs(1, now);
            return wait > 0 ? wait : 0;
        }
        return 0;
    },

    _stepScan: async (now) => {
        if (typeof Pipeline.deps.fetchPage !== 'function') {
            return { action: 'error', reason: '未配置 fetchPage' };
        }

        const page = await Pipeline.deps.fetchPage(Pipeline.cursor);
        Pipeline.pagesFetched += 1;

        (page.items || []).forEach(item => {
            // 已入库/已失败/已跳过的不再重复发现
            if (!EventLog.isKnown(item.uid)) {
                EventLog.append(item.uid, EVENT_STATE.DISCOVERED, {
                    name: item.name, url: item.url, ts: now
                });
            }
        });

        Pipeline.cursor = page.nextCursor;
        if (page.nextCursor == null) Pipeline.isEndOfList = true;

        const todo = EventLog.getTodo();
        if (todo.length > 0) {
            Pipeline.fsm.transition(STATE.CLAIMING, { now, reason: '本页有待领商品' });
        } else if (Pipeline.isEndOfList) {
            Pipeline.fsm.transition(STATE.DONE, { now, reason: '服务器确认无更多商品' });
        }
        // 否则停留在 SCANNING，下一步继续拉下一页

        return {
            action: 'scan',
            pageItems: (page.items || []).length,
            cursor: Pipeline.cursor,
            endOfList: Pipeline.isEndOfList,
            state: Pipeline.fsm.state
        };
    },

    _stepClaim: async (now) => {
        if (Pipeline.limiter.isPaused(now)) {
            return { action: 'wait', ms: Pipeline.limiter.status(now).pauseLeftMs, reason: '退避中' };
        }
        if (!Pipeline.limiter.tryAcquire(1, now)) {
            return { action: 'wait', ms: Pipeline.limiter.nextAvailableMs(1, now), reason: '等待令牌' };
        }

        const todo = EventLog.getTodo();
        if (todo.length === 0) {
            if (Pipeline.isEndOfList) {
                Pipeline.fsm.transition(STATE.DONE, { now, reason: '队列清空且已到列表末尾' });
            } else {
                Pipeline.fsm.transition(STATE.SCANNING, { now, reason: '队列清空，拉取下一页' });
            }
            return { action: 'drain', state: Pipeline.fsm.state };
        }

        const task = todo[0];

        const skipReason = Pipeline.deps.filter ? Pipeline.deps.filter(task) : null;
        if (skipReason) {
            EventLog.append(task.uid, EVENT_STATE.SKIPPED, { reason: skipReason, ts: now });
            return { action: 'skip', uid: task.uid, reason: skipReason };
        }

        const outcome = await Pipeline.executor.claim(task);

        if (outcome.result === CLAIM_RESULT.RATE_LIMITED) {
            Pipeline.consecutiveRateLimits += 1;
            Pipeline.limiter.penalize(outcome.retryAfterMs, now);
            Pipeline.fsm.hitRateLimit(now, outcome.retryAfterMs);

            if (Pipeline.consecutiveRateLimits >= Pipeline.maxConsecutiveRateLimits) {
                EventLog.append(task.uid, EVENT_STATE.FAILED, {
                    reason: `连续限速 ${Pipeline.consecutiveRateLimits} 次，放弃该商品`, ts: now
                });
                Pipeline.consecutiveRateLimits = 0;
                return { action: 'rate_limit_abandoned', uid: task.uid };
            }
            return { action: 'rate_limited', uid: task.uid, strategy: outcome.strategy };
        }

        if (outcome.result === CLAIM_RESULT.SUCCESS) {
            Pipeline.pendingVerify = task;
            Pipeline.fsm.transition(STATE.VERIFYING, { now, reason: `已通过 ${outcome.strategy} 领取` });
            return { action: 'claimed', uid: task.uid, strategy: outcome.strategy };
        }

        EventLog.append(task.uid, EVENT_STATE.FAILED, {
            reason: outcome.reason || '领取失败', ts: now
        });
        return { action: 'failed', uid: task.uid, reason: outcome.reason, strategy: outcome.strategy };
    },

    _stepVerify: async (now) => {
        const task = Pipeline.pendingVerify;
        Pipeline.pendingVerify = null;

        if (!task) {
            Pipeline.fsm.transition(STATE.CLAIMING, { now, reason: '无待复查任务' });
            return { action: 'verify_skipped' };
        }

        let owned = false;
        if (typeof Pipeline.deps.verifyOwned === 'function') {
            owned = await Pipeline.deps.verifyOwned(task.uid);
        }

        if (owned) {
            EventLog.append(task.uid, EVENT_STATE.CLAIMED, { ts: now });
            Pipeline.limiter.reward();
            Pipeline.consecutiveRateLimits = 0;
        } else {
            EventLog.append(task.uid, EVENT_STATE.FAILED, {
                reason: '复查未确认入库', ts: now
            });
        }

        Pipeline.fsm.transition(STATE.CLAIMING, { now, reason: owned ? '复查通过' : '复查未通过' });
        return { action: owned ? 'verified' : 'verify_failed', uid: task.uid };
    },

    _stepRecover: (now) => {
        if (!Pipeline.limiter.isPaused(now)) {
            Pipeline.fsm.transition(STATE.CLAIMING, { now, reason: '退避结束' });
            return { action: 'recovered', state: Pipeline.fsm.state };
        }
        return { action: 'wait', ms: Pipeline.limiter.status(now).pauseLeftMs, reason: '退避中' };
    },

    /**
     * 连续推进，直到停止条件满足。测试与脚本调度共用同一条路径，
     * 保证「单步正确」与「循环正确」不会被两套代码验证。
     */
    run: async ({ maxSteps = 1000, sleep = async () => {}, now: startNow = Date.now(), advance = 0 } = {}) => {
        const steps = [];
        let clock = startNow;

        for (let i = 0; i < maxSteps; i++) {
            if (Pipeline.fsm.is(STATE.IDLE, STATE.DONE)) break;

            const step = await Pipeline.tick(clock);
            steps.push({ at: clock, ...step });

            const delay = Pipeline.nextDelayMs(clock);
            if (!Number.isFinite(delay)) break;
            if (delay > 0) {
                await sleep(delay);
                clock += delay;
            } else {
                clock += advance;
            }
        }
        return steps;
    },

    status: (now = Date.now()) => ({
        state: Pipeline.fsm.state,
        cursor: Pipeline.cursor,
        endOfList: Pipeline.isEndOfList,
        pagesFetched: Pipeline.pagesFetched,
        pendingVerify: Pipeline.pendingVerify ? Pipeline.pendingVerify.uid : null,
        limiter: Pipeline.limiter.status(now),
        log: EventLog.stats(),
        claims: ClaimExecutor.stats()
    })
};
