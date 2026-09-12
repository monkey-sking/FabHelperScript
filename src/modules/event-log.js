/**
 * Fab Helper - Event Log Module
 *
 * 单一真相源（single source of truth）。
 *
 * 旧模型把状态拆成 done / failed / todo 三份并行数组，靠散落各处的手工互清维持一致
 * （例如「成功时要顺手删掉 failed 里的陈旧条目」「todo 加载时要过滤非 listings 链接」）。
 * 这类补丁本质上是在补一个错误的数据模型。
 *
 * 新模型只做一件事：按规范 listing uid 追加写入不可变事件。
 * todo / done / failed 全部是这条事件流上的派生视图，「最新事件优先」。
 * 一致性由模型保证，而不是由调用点保证。
 *
 * 事件是不可变的：状态修正通过追加新事件完成，永不回头改写历史。
 * 这带来两个直接收益：失败归因可追溯（能看到「先失败后成功」的完整轨迹），
 * 且存储格式永远不需要版本号迁移（旧事件天然兼容）。
 */
import { Config } from '../config.js';
import { Utils } from './utils.js';

export const EVENT_STATE = {
    DISCOVERED: 'discovered', // 在列表中发现，等待领取
    CLAIMED: 'claimed',       // 领取成功（已入库）
    FAILED: 'failed',         // 领取最终失败（含归因）
    SKIPPED: 'skipped'        // 主动跳过（付费 / 外部站 / 不可购买）
};

export const EventLog = {
    events: [],
    // uid -> 该 uid 的最新事件，派生视图的唯一依据
    _latest: new Map(),

    /**
     * 从 URL 或裸 uid 提取规范 uid。
     * 与 Database.getListingUid 行为一致（有测试守护两者不漂移），
     * 此处独立实现是为了让本模块不依赖 Database，保持可单独测试。
     */
    uidOf: (urlOrUid) => {
        if (!urlOrUid) return '';
        const match = String(urlOrUid).split('?')[0].match(/\/listings\/([^/?#]+)/i);
        if (match && match[1]) return match[1].toLowerCase();
        // 传入的已经是裸 uid
        const bare = String(urlOrUid).trim().toLowerCase();
        return /^[a-z0-9_-]+$/.test(bare) ? bare : '';
    },

    canonicalUrl: (uid) => `https://www.fab.com/listings/${uid}`,

    reset: () => {
        EventLog.events = [];
        EventLog._latest = new Map();
    },

    _rebuildIndex: () => {
        EventLog._latest = new Map();
        // 事件按 ts 升序追加，后写覆盖先写即为「最新优先」
        EventLog.events.forEach(e => EventLog._latest.set(e.uid, e));
    },

    load: async () => {
        let raw = [];
        try {
            raw = await GM_getValue(Config.DB_KEYS.EVENT_LOG, []);
        } catch (e) {
            Utils.logger('error', `读取事件日志失败: ${e.message}`);
            // 读取失败不能伪装成空历史，否则启动流程会把旧队列迁移后
            // 覆盖掉原有 CLAIMED/FAILED 记录，下一轮可能重复领取。
            return null;
        }
        if (!Array.isArray(raw)) raw = [];
        // 清洗：丢弃缺 uid / 状态非法的历史残留，避免一条脏数据污染整个派生视图
        EventLog.events = raw.filter(e =>
            e && typeof e.uid === 'string' && e.uid && Object.values(EVENT_STATE).includes(e.state)
        );
        EventLog._rebuildIndex();
        return EventLog.events.length;
    },

    save: async () => {
        try {
            await GM_setValue(Config.DB_KEYS.EVENT_LOG, EventLog.events);
            return true;
        } catch (e) {
            Utils.logger('error', `写入事件日志失败: ${e.message}`);
            return false;
        }
    },

    /**
     * 追加一条事件。name / url 若本次未提供，则继承该 uid 上一次已知的值，
     * 这样任何时刻的派生视图都能还原出完整任务对象，而不必回头翻历史事件。
     */
    append: (uid, state, meta = {}) => {
        const id = EventLog.uidOf(uid);
        if (!id) return null;
        if (!Object.values(EVENT_STATE).includes(state)) return null;

        const prev = EventLog._latest.get(id);
        const event = {
            uid: id,
            state,
            ts: meta.ts != null ? meta.ts : Date.now(),
            name: meta.name || (prev && prev.name) || '',
            url: meta.url || (prev && prev.url) || EventLog.canonicalUrl(id),
            reason: meta.reason || ''
        };
        // 只存非空 offerId，避免污染旧 persisted 数据（向后兼容）
        const offerId = meta.offerId || (prev && prev.offerId);
        if (offerId) event.offerId = offerId;

        EventLog.events.push(event);
        EventLog._latest.set(id, event);
        return event;
    },

    appendMany: (entries) => entries.map(e => EventLog.append(e.uid, e.state, e)).filter(Boolean),

    latestOf: (uid) => {
        const id = EventLog.uidOf(uid);
        return id ? (EventLog._latest.get(id) || null) : null;
    },

    stateOf: (uid) => {
        const latest = EventLog.latestOf(uid);
        return latest ? latest.state : null;
    },

    isDone: (uid) => EventLog.stateOf(uid) === EVENT_STATE.CLAIMED,
    isFailed: (uid) => EventLog.stateOf(uid) === EVENT_STATE.FAILED,
    isSkipped: (uid) => EventLog.stateOf(uid) === EVENT_STATE.SKIPPED,
    isPending: (uid) => EventLog.stateOf(uid) === EVENT_STATE.DISCOVERED,
    isKnown: (uid) => EventLog.latestOf(uid) !== null,

    getTodo: () => [...EventLog._latest.values()]
        .filter(e => e.state === EVENT_STATE.DISCOVERED)
        .map(e => {
            const task = { uid: e.uid, url: e.url, name: e.name };
            if (e.offerId) task.offerId = e.offerId;
            return task;
        }),

    getDone: () => [...EventLog._latest.values()]
        .filter(e => e.state === EVENT_STATE.CLAIMED)
        .map(e => ({ uid: e.uid, url: e.url, name: e.name })),

    getFailed: () => [...EventLog._latest.values()]
        .filter(e => e.state === EVENT_STATE.FAILED)
        .map(e => ({
            uid: e.uid,
            url: e.url,
            name: e.name,
            failureReason: e.reason || '未知原因',
            failedAt: new Date(e.ts).toISOString()
        })),

    stats: () => {
        const counts = { total: EventLog._latest.size };
        Object.values(EVENT_STATE).forEach(s => { counts[s] = 0; });
        EventLog._latest.forEach(e => { counts[e.state] += 1; });
        return counts;
    },

    /**
     * 控制存储体积。只保留最近 maxEvents 条，但保证每个 uid 的最新事件绝不丢失
     * （丢失会让该 uid 在派生视图里凭空消失，等于数据损坏）。
     */
    prune: (maxEvents) => {
        if (!Number.isFinite(maxEvents) || maxEvents <= 0) return 0;
        if (EventLog.events.length <= maxEvents) return 0;

        const before = EventLog.events.length;
        const kept = EventLog.events.slice(-maxEvents);
        const previousLatest = new Map(EventLog._latest);

        EventLog.events = kept;
        EventLog._rebuildIndex();

        // 被截断的 uid 补回其最新事件（置于队首，成为该 uid 的唯一事件，语义不变）
        const recovered = [];
        previousLatest.forEach((event, uid) => {
            if (!EventLog._latest.has(uid)) recovered.push(event);
        });
        if (recovered.length > 0) {
            EventLog.events = recovered.concat(EventLog.events);
            EventLog._rebuildIndex();
        }
        return before - EventLog.events.length;
    },

    /**
     * 一次性导入旧的三份并行数组，用于从旧版本迁移。
     * ts 递增保证 discovered 早于其后续结果事件，派生视图才正确。
     */
    importLegacy: ({ todo = [], done = [], failed = [] }) => {
        let ts = Date.now() - (todo.length + done.length + failed.length + 1) * 1000;
        const nextTs = () => (ts += 1000);

        todo.forEach(task => {
            EventLog.append(task.uid || task.url, EVENT_STATE.DISCOVERED, {
                ts: nextTs(), name: task.name, url: task.url
            });
        });
        done.forEach(entry => {
            const url = typeof entry === 'string' ? entry : entry.url;
            EventLog.append(url, EVENT_STATE.CLAIMED, { ts: nextTs() });
        });
        failed.forEach(task => {
            EventLog.append(task.uid || task.url, EVENT_STATE.FAILED, {
                ts: nextTs(), name: task.name, url: task.url, reason: task.failureReason
            });
        });
        return EventLog.events.length;
    },

    /** 反向导出为旧格式，用于灰度期间回退到旧数据层。 */
    exportLegacy: () => ({
        todo: EventLog.getTodo(),
        done: EventLog.getDone().map(e => e.url),
        failed: EventLog.getFailed()
    })
};
