/**
 * Fab Helper - Pipeline Adapter Module（把 API 优先流水线接进真实运行环境）
 *
 * 基础设施模块（pipeline / listing-source / claim-strategy / rate-limiter /
 * state-machine / event-log）已在隔离环境测过，本模块负责把它们与真实的
 * Fab 网页环境对接：
 *   - fetchPage    → 真网络请求（GM_xmlhttpRequest）调 /i/listings/search，经 ListingSource 解析
 *   - verifyOwned  → Database.isDone（规范 uid 命中，与现有隐藏/去重一致）
 *   - filter       → ListingSource.isClaimable（免费判定，可配置策略）
 *   - DomClaim     → 注入真实 DOM 领取实现（复用现有领取逻辑，见 createDomClaim）
 *   - ApiClaim     → 一旦确认领取 POST 端点，ApiClaim.configure({endpoint}) 即可接管，无需改流程
 *
 * 整条链路由 Config.USE_API_PIPELINE 控制，关闭时完全不被触碰（默认关闭），
 * 开启后取代旧的「滚动 DOM + 7 worker 标签页」枚举/领取路径。
 */
import { Config } from '../config.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { Database } from './database.js';
import { ListingSource, FREE_POLICY } from './listing-source.js';
import { Pipeline } from './pipeline.js';
import { EventLog } from './event-log.js';
import { ApiClaim, DomClaim, setDomClaim, normalizeClaimOutcome } from './claim-strategy.js';

/** 事件日志的持久化上限（条）。超出后按 uid 保留最新事件，见 EventLog.prune。 */
export const EVENT_LOG_MAX = 3000;

const log = (level, msg) => {
    try { Utils.logger(level, msg); } catch (e) { /* 测试环境 Utils 可能无 logger */ }
};

/**
 * 真实网络获取：适配 ListingSource.fetchImpl 的形状
 *   (url, { headers }) => Promise<{ status, responseText, responseHeaders }>
 * 走 GM_xmlhttpRequest，自动带 cookie（anonymous:false）。
 */
export const gmFetchImpl = (url, { headers } = {}) => new Promise((resolve, reject) => {
    API.gmFetch({
        method: 'GET',
        url,
        headers: { accept: 'application/json', ...(headers || {}) },
        onload: (res) => resolve({
            status: res.status,
            responseText: res.responseText,
            responseHeaders: res.responseHeaders
        }),
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error('search request timeout'))
    });
});

/** 把 ListingSource 包成 Pipeline 期望的 fetchPage 形状 { items, nextCursor } */
export const createFetchPage = (fetchImpl = gmFetchImpl) => {
    ListingSource.configure({ fetchImpl });
    return async (cursor = null) => {
        const page = await ListingSource.fetchPage(cursor);
        return { items: page.items, nextCursor: page.nextCursor, isEnd: page.isEnd };
    };
};

/** 入库复查：复用 Database.isDone（规范 uid 判定，与现有隐藏/去重一致） */
export const createVerifyOwned = (database = Database) => async (uid) => {
    if (!uid) return false;
    return database.isDone(`https://www.fab.com/listings/${uid}`);
};

/**
 * 注入真实 DOM 领取实现。
 * acquireFn(task) 的契约：返回 { success: boolean, reason? }（与现有 worker 协议一致），
 * 或任意被 normalizeClaimOutcome 识别的形态。返回是否成功注册。
 * 未注入时 DomClaim 不可用，领取回退到 ApiClaim（若已配置），否则整体判为无可用策略。
 */
export const createDomClaim = (acquireFn) => {
    if (typeof acquireFn !== 'function') return false;
    setDomClaim(async (task) => normalizeClaimOutcome(await acquireFn(task)));
    return true;
};

/**
 * 是否存在可用的领取后端。
 *
 * 两个都不具备时开启流水线是危险的：整页商品会被逐条标记为「领取失败」，
 * 事件日志被污染，用户还看不出原因。调度方应在启动前用这个判定直接拒绝运行。
 */
export const hasClaimBackend = () => Boolean(
    (typeof ApiClaim.isAvailable === 'function' && ApiClaim.isAvailable()) ||
    (typeof DomClaim.isAvailable === 'function' && DomClaim.isAvailable())
);

/**
 * 「新流水线是否真的在干活」的唯一判定。
 *
 * 为什么不能直接读 Config.USE_API_PIPELINE：开关打开但没有领取后端时
 * startApiPipeline() 会拒绝启动，而旧路径（滚动枚举 + worker 领取）的各处
 * 护栏若只认开关，就会被一起关掉 —— 结果是脚本整体什么都不做，除了日志里
 * 一行字之外没有任何现象，用户只会以为脚本坏了。
 *
 * 凡是「新流水线接管了，旧路径要让位」的判断都必须调这个函数，
 * 而不是直接读 Config.USE_API_PIPELINE。
 */
export const isApiPipelineActive = () => Boolean(Config.USE_API_PIPELINE && hasClaimBackend());

/**
 * 扫描阶段过滤器，返回 null 表示纳入待领，返回字符串表示跳过原因。
 *
 * 「已入库」判定之所以放在这里而不是留给领取阶段：扫描阶段是唯一能同时
 * 看到「商品完整信息」和「历史状态」的地方，在这里拦下的商品连待领队列
 * 都不会进，也就不存在重复领取的可能。
 */
export const createScanFilter = (database = Database) => (item) => {
    if (!item || !item.uid) return 'invalid_item';
    // 已入库的商品（旧数据层记录过 / 本会话刚领过）不再领取。
    // EventLog.isKnown 由 pipeline 在调用本过滤器之前判定，这里补旧数据层的那一半。
    if (database && typeof database.isDone === 'function'
        && database.isDone(`https://www.fab.com/listings/${item.uid}`)) {
        return 'already_owned';
    }
    if (!ListingSource.isClaimable(item)) return 'not_free';
    return null;
};

/** 绑定真实 Database 的默认过滤器 */
export const defaultScanFilter = createScanFilter(Database);

/**
 * 把流水线接进真实环境并配置好。
 * options:
 *   fetchImpl      自定义网络层（测试用）
 *   database       覆盖 Database（测试用）
 *   acquireFn      真实 DOM 领取实现（可选；不传则 DomClaim 不可用）
 *   apiEndpoint    领取 POST 端点（可选；传入即启用 ApiClaim 主路径）
 *   apiFetchImpl   领取 POST 的网络层（可选；默认复用 gmFetchImpl）
 *   apiBuildBody   构造领取请求体（可选）
 *   ratePerMin/burst 限速器参数
 *   freePolicy     免费判定策略（FREE_POLICY.*）
 */
export const bootstrapPipeline = (options = {}) => {
    const {
        fetchImpl,
        database = Database,
        acquireFn,
        apiEndpoint,
        apiFetchImpl,
        apiBuildBody,
        ratePerMin,
        burst,
        freePolicy
    } = options;

    if (freePolicy) ListingSource.configure({ freePolicy });

    if (apiEndpoint) {
        ApiClaim.configure({
            endpoint: apiEndpoint,
            fetchImpl: apiFetchImpl || gmFetchImpl,
            buildBody: apiBuildBody
        });
    }

    Pipeline.configure({
        fetchPage: createFetchPage(fetchImpl),
        verifyOwned: createVerifyOwned(database),
        filter: createScanFilter(database),
        ...(Number.isFinite(ratePerMin) ? { ratePerMin } : {}),
        ...(Number.isFinite(burst) ? { burst } : {})
    });

    const domOk = createDomClaim(acquireFn);
    const apiOk = ApiClaim.isAvailable();
    if (!domOk && !apiOk) {
        // 按 error 记而不是 warn：这不是「少了个可选能力」，而是「现在启动就会
        // 把整页商品逐条标记成领取失败」。bootstrap 自己不拒绝（它也可以在
        // 只枚举的模式下被调用，例如测试），真正把住这道闸的是 hasClaimBackend()。
        log('error',
            '[Pipeline] 未配置任何领取后端（DomClaim 未注入且 ApiClaim 未启用）。' +
            '此时不得启动流水线：整页商品会被逐条标记为「领取失败」。' +
            '请注入 acquireFn 或配置 apiEndpoint 后再开启 USE_API_PIPELINE。');
    }

    return Pipeline;
};

/**
 * 载入持久化的事件历史。
 *
 * 不载的后果是每次刷新页面都从零开始，已领取的商品会被重新领一遍 ——
 * 事件日志作为「单一真相源」的意义全失。
 */
export const loadEventLog = async () => {
    let loaded = 0;
    try {
        loaded = await EventLog.load();
    } catch (e) {
        log('error', `[Pipeline] 读取事件日志失败，本次会话从空历史开始: ${e.message}`);
        return { loaded: 0, total: 0 };
    }
    EventLog.prune(EVENT_LOG_MAX);
    log('info', `[Pipeline] 已载入事件历史 ${loaded} 条（去重后 ${EventLog.stats().total} 个商品）。`);
    return { loaded, total: EventLog.stats().total };
};

/**
 * 落盘事件历史，并把本程新领取的商品回写到旧数据层。
 *
 * 回写不是可选项：UI 计数、隐藏已领取、以及旧路径的 isDone 去重都读
 * State.db.done，新流水线若只写事件日志，用户在界面上会看不到任何进展。
 */
export const persistEventLog = ({ database = Database } = {}) => {
    EventLog.prune(EVENT_LOG_MAX);
    EventLog.save();

    let synced = 0;
    try {
        if (database && typeof database.addDoneUrl === 'function') {
            EventLog.getDone().forEach(entry => {
                const url = EventLog.canonicalUrl(entry.uid);
                if (database.isDone && database.isDone(url)) return;
                database.addDoneUrl(url);
                synced += 1;
            });
            if (synced > 0 && typeof database.saveDone === 'function') database.saveDone();
        }
    } catch (e) {
        log('error', `[Pipeline] 回写已领取商品到旧数据层失败: ${e.message}`);
    }
    return { synced, total: EventLog.stats().total };
};

/** 测试/复用之间清理适配器注入状态，避免用例互相泄漏 */
export const resetPipelineAdapters = () => {
    setDomClaim(null);              // 清 DomClaim 注入
    ApiClaim.endpoint = null;       // 清 ApiClaim
    ApiClaim.fetchImpl = null;
    ApiClaim.buildBody = null;
    // ListingSource.reset 只清 stats，这里把 freePolicy 与注入的 fetch 层一并复位到默认，
    // 否则上一个用例设过的 FLAG_ONLY 会泄漏到下一个不传 freePolicy 的用例。
    ListingSource.freePolicy = FREE_POLICY.FLAG_OR_PRICE;
    ListingSource.deps.fetchImpl = null;
    ListingSource.deps.buildUrl = null;
    ListingSource.deps.getBaseParams = null;
    ListingSource.deps.getHeaders = null;
    ListingSource.reset();
    Pipeline.reset(0);
};
