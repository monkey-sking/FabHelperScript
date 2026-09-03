/**
 * Fab Helper - Task State Machine Module
 *
 * 取代散落各处的「卡住了就刷新页面」兜底。
 *
 * 旧实现里至少有四套独立的卡死恢复机制，分别诞生于不同的历史时点：
 *   1. countdownRefresh —— 任务完成但处于限速态时，定时刷新
 *   2. 无网络活动 30 秒 → 强制刷新
 *   3. handleWakeRecovery —— 页面从后台唤醒后的恢复
 *   4. autoRefreshEmptyPage —— 页面无可见商品时自动刷新
 * 它们互不知情、可能叠在一起触发，且每一套都只覆盖当时遇到的那一种卡死。
 * 这是症状的堆叠，不是设计。
 *
 * 新模型只有一个显式状态机：异常一律收敛到 RATE_LIMITED，退避到 Retry-After
 * 指定时刻，再回到 CLAIMING。超时策略集中在一张表里，改一处即全局生效。
 *
 * 时间由调用方注入（now 参数），本模块不持有任何真实定时器，可完全同步测试。
 */

export const STATE = {
    IDLE: 'IDLE',
    SCANNING: 'SCANNING',
    CLAIMING: 'CLAIMING',
    VERIFYING: 'VERIFYING',
    RATE_LIMITED: 'RATE_LIMITED',
    DONE: 'DONE'
};

// 常规允许的转移。IDLE 与 RATE_LIMITED 是两条全局逃生通道：
// 用户可以随时停止（→IDLE），429 可以在任何时刻发生（→RATE_LIMITED）。
const TRANSITIONS = {
    IDLE: ['SCANNING'],
    SCANNING: ['CLAIMING', 'DONE'],
    // 队列排空但列表未到底时，要从领取退回扫描继续翻页
    CLAIMING: ['VERIFYING', 'SCANNING', 'DONE'],
    VERIFYING: ['CLAIMING', 'SCANNING', 'DONE'],
    RATE_LIMITED: ['CLAIMING', 'IDLE'],
    DONE: ['IDLE']
};

// 各状态的超时上限与超时后的去向。集中在此，避免恢复策略散落。
const TIMEOUTS = {
    SCANNING: { ms: 15000, to: STATE.DONE, reason: '分页拉取超时，按列表结束处理' },
    CLAIMING: { ms: 20000, to: STATE.RATE_LIMITED, reason: '单任务领取超时，转入退避' },
    VERIFYING: { ms: 8000, to: STATE.CLAIMING, reason: '复查超时，回到领取重试一次' },
    RATE_LIMITED: { ms: 600000, to: STATE.IDLE, reason: '退避超过上限，交回用户' }
};

export const TaskStateMachine = {
    state: STATE.IDLE,
    enteredAt: 0,
    history: [],
    _listeners: [],

    onChange: (fn) => {
        TaskStateMachine._listeners.push(fn);
        return () => {
            TaskStateMachine._listeners = TaskStateMachine._listeners.filter(f => f !== fn);
        };
    },

    reset: (now = 0) => {
        TaskStateMachine.state = STATE.IDLE;
        TaskStateMachine.enteredAt = now;
        TaskStateMachine.history = [];
    },

    /**
     * 把「进入当前状态的时刻」推到 now，仅动时钟、不动状态。
     *
     * 用于外部长时间没有推进状态机之后恢复（用户暂停执行、标签页被冻结/休眠）：
     * 不重置时钟的话，暂停时长会被算进超时判定，恢复瞬间就直接触发超时转移 ——
     * 最典型的后果是 SCANNING 暂停几分钟后一恢复就超时，被当成「列表已到底」
     * 而提前结束整轮枚举。
     */
    refreshClock: (now = Date.now()) => {
        TaskStateMachine.enteredAt = now;
        return TaskStateMachine.enteredAt;
    },

    canTransition: (to) => {
        const from = TaskStateMachine.state;
        if (from === to) return false;
        if (to === STATE.IDLE || to === STATE.RATE_LIMITED) return true;
        return (TRANSITIONS[from] || []).includes(to);
    },

    transition: (to, { now = Date.now(), reason = '' } = {}) => {
        const from = TaskStateMachine.state;
        if (!TaskStateMachine.canTransition(to)) return false;

        TaskStateMachine.state = to;
        TaskStateMachine.enteredAt = now;
        TaskStateMachine.history.push({ from, to, at: now, reason });
        if (TaskStateMachine.history.length > 50) TaskStateMachine.history.shift();

        TaskStateMachine._listeners.forEach(fn => {
            try { fn({ from, to, at: now, reason }); } catch (e) { /* 监听器异常不得中断状态机 */ }
        });
        return true;
    },

    is: (...states) => states.includes(TaskStateMachine.state),

    elapsed: (now = Date.now()) => Math.max(0, now - TaskStateMachine.enteredAt),

    remainingMs: (now = Date.now()) => {
        const rule = TIMEOUTS[TaskStateMachine.state];
        if (!rule) return Infinity;
        return Math.max(0, rule.ms - TaskStateMachine.elapsed(now));
    },

    /**
     * 推进状态机：若当前状态已超时，按 TIMEOUTS 表执行既定转移。
     * 返回本次是否发生了超时转移，便于调用方记录日志。
     */
    tick: (now = Date.now()) => {
        const rule = TIMEOUTS[TaskStateMachine.state];
        if (!rule) return null;
        if (TaskStateMachine.elapsed(now) < rule.ms) return null;

        const from = TaskStateMachine.state;
        TaskStateMachine.transition(rule.to, { now, reason: rule.reason });
        return { from, to: rule.to, reason: rule.reason, timedOut: true };
    },

    // --- 面向调用方的语义化入口，避免各处硬编码状态名 ---

    start: (now) => TaskStateMachine.transition(STATE.SCANNING, { now, reason: '用户开始' }),
    stop: (now) => TaskStateMachine.transition(STATE.IDLE, { now, reason: '用户停止' }),

    /** 429 / 风控：任何状态都可进入退避 */
    hitRateLimit: (now, retryAfterMs) => {
        const ok = TaskStateMachine.transition(STATE.RATE_LIMITED, {
            now, reason: retryAfterMs != null ? `429 退避 ${retryAfterMs}ms` : '429 限速'
        });
        return ok;
    },

    status: (now = Date.now()) => ({
        state: TaskStateMachine.state,
        elapsedMs: TaskStateMachine.elapsed(now),
        remainingMs: TaskStateMachine.remainingMs(now),
        lastTransition: TaskStateMachine.history[TaskStateMachine.history.length - 1] || null
    })
};
