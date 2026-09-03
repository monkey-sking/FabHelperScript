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
import { Utils } from './utils.js';
import { API } from './api.js';
import { Database } from './database.js';
import { ListingSource, FREE_POLICY } from './listing-source.js';
import { Pipeline } from './pipeline.js';
import { ApiClaim, setDomClaim, normalizeClaimOutcome } from './claim-strategy.js';

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

/** 扫描阶段过滤器：非可领（非免费）商品跳过并记录原因 */
export const defaultScanFilter = (item) => {
    if (!item || !item.uid) return 'invalid_item';
    if (!ListingSource.isClaimable(item)) return 'not_free';
    return null;
};

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
        filter: defaultScanFilter,
        ...(Number.isFinite(ratePerMin) ? { ratePerMin } : {}),
        ...(Number.isFinite(burst) ? { burst } : {})
    });

    const domOk = createDomClaim(acquireFn);
    const apiOk = ApiClaim.isAvailable();
    if (!domOk && !apiOk) {
        log('warn',
            '[Pipeline] 未配置任何领取后端（DomClaim 未注入且 ApiClaim 未启用）；' +
            '枚举可运行但领取会失败。请注入 acquireFn 或配置 apiEndpoint 后再开启 USE_API_PIPELINE。');
    }

    return Pipeline;
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
