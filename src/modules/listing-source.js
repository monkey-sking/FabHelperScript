/**
 * Fab Helper - Listing Source Module（列表枚举层）
 *
 * 取代「滚动 DOM → 骗页面自己发搜索请求 → 再从卡片 DOM 里正则抠 uid」这条链路。
 * 改为直接调用 /i/listings/search 并用 cursors.next 翻页。
 *
 * 接口形态已于 2026-09-03 用真实抓包确认（夹具见 tests/fixtures/）：
 *   请求  GET /i/listings/search?is_free=1&sort_by=title&cursor=<base64>
 *   响应  { aggregations, cursors: { next, previous }, next, previous, results: [...] }
 *
 * 商品对象的关键字段（真实样本，非推测）：
 *   uid, title, isFree, isDiscounted, hasEffectiveDiscounts,
 *   startingPrice: { price, discountedPrice, currencyCode, offerId, effectiveDiscountPercentage },
 *   licenses: [{ name, isCc0, priceTier, uid }], listingType, user.sellerName
 *
 * ── 关于「免费」判定的重要警告 ────────────────────────────────────────
 * 抓包样本里 4 个商品全部 startingPrice.price === 0，但只有 2 个 isFree === true。
 * 而且这个请求本身已经是 is_free=1 过滤过的。也就是说：
 *
 *     isFree 不等于「价格为零」，它看起来只标记 CC0 类许可，
 *     而 Personal / Professional 的 $0 商品会被标成 false。
 *
 * 因此本模块绝不把 isFree 当作唯一判据，而是把它做成可配置策略
 * （FREE_POLICY），默认取 FLAG_OR_PRICE 并集，与现行 DOM 判据的
 * 实际行为保持一致（不会漏领）。待线上数据积累后再收敛到单一规则。
 * ────────────────────────────────────────────────────────────────────
 *
 * 所有网络副作用通过 deps 注入，本模块可在测试中用真实抓包夹具同步验证。
 */
import { Utils } from './utils.js';

export const SEARCH_PATH = '/i/listings/search';

/** 搜索请求失败。status / retryAfterMs 供上层流水线判定是否退避。 */
export class SearchError extends Error {
    constructor(message, { status = 0, retryAfterMs = null, url = '' } = {}) {
        super(message);
        this.name = 'SearchError';
        this.status = status;
        this.retryAfterMs = retryAfterMs;
        this.url = url;
    }
}

/**
 * 免费判定策略。
 * 之所以存在三种而不是写死一种，是因为抓包证据不足以判定唯一正确答案
 * （详见文件头警告）。策略可配置，便于线上对照后收敛。
 */
export const FREE_POLICY = {
    // 只认服务端 isFree 标记。会漏掉 Personal/Professional 的 $0 商品。
    FLAG_ONLY: 'flag_only',
    // 只认有效价格为 0。
    PRICE_ONLY: 'price_only',
    // 并集：两者任一命中即视为可领取。与现行 DOM 判据行为最接近，默认采用。
    FLAG_OR_PRICE: 'flag_or_price'
};

export const ListingSource = {
    deps: {
        // (url, { headers }) => Promise<{ status, responseText } | Response>
        fetchImpl: null,
        // 覆盖 URL 构造（测试或特殊页面用）
        buildUrl: null,
        // 覆盖基础查询参数，默认取下方 baseParams
        getBaseParams: null,
        // 覆盖请求头（默认带 cookie + csrf）
        getHeaders: null
    },

    // 与抓包原文一致。若用户改了页面筛选条件，上层应覆盖 getBaseParams。
    baseParams: { is_free: '1', sort_by: 'title' },

    freePolicy: FREE_POLICY.FLAG_OR_PRICE,

    // 观测计数
    stats: { pagesFetched: 0, itemsSeen: 0, malformedPages: 0 },

    configure: ({ fetchImpl, buildUrl, getBaseParams, getHeaders, baseParams, freePolicy } = {}) => {
        if (typeof fetchImpl === 'function' || fetchImpl === null) ListingSource.deps.fetchImpl = fetchImpl;
        if (typeof buildUrl === 'function' || buildUrl === null) ListingSource.deps.buildUrl = buildUrl;
        if (typeof getBaseParams === 'function' || getBaseParams === null) ListingSource.deps.getBaseParams = getBaseParams;
        if (typeof getHeaders === 'function' || getHeaders === null) ListingSource.deps.getHeaders = getHeaders;
        if (baseParams && typeof baseParams === 'object') ListingSource.baseParams = { ...baseParams };
        if (freePolicy) ListingSource.freePolicy = freePolicy;
    },

    reset: () => {
        ListingSource.stats = { pagesFetched: 0, itemsSeen: 0, malformedPages: 0 };
    },

    /**
     * 折算实际应付价格：有折扣价时以折扣价为准。
     * 返回 null 表示「价格未知」——未知绝不等于免费。
     */
    effectivePrice: (item) => {
        if (!item) return null;
        if (Number.isFinite(item.discountedPrice)) return item.discountedPrice;
        if (Number.isFinite(item.price)) return item.price;
        return null;
    },

    /**
     * 是否可领取（免费）。判据随策略而变，见 FREE_POLICY 注释。
     * 注意：本方法只回答「是否免费」，不回答「是否已入库」——后者由事件日志负责。
     */
    isClaimable: (item) => {
        if (!item || !item.uid) return false;
        const price = ListingSource.effectivePrice(item);
        switch (ListingSource.freePolicy) {
            case FREE_POLICY.FLAG_ONLY:
                return item.isFreeFlag === true;
            case FREE_POLICY.PRICE_ONLY:
                return price === 0;
            case FREE_POLICY.FLAG_OR_PRICE:
            default:
                // 100% 折扣等价于免费，即使接口未把 discountedPrice 落到 0
                return item.isFreeFlag === true || price === 0 || item.effectiveDiscountPercentage === 100;
        }
    },

    /**
     * 单个商品 JSON → 规范化任务对象。
     * 字段缺失一律降级为空值而不是抛错：Fab 的响应允许大量字段为 null，
     * 一条脏数据不该让整页作废。
     */
    normalize: (raw) => {
        if (!raw || typeof raw !== 'object' || !raw.uid) return null;

        const uid = String(raw.uid).trim().toLowerCase();
        if (!uid) return null;

        const sp = raw.startingPrice && typeof raw.startingPrice === 'object' ? raw.startingPrice : {};
        const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

        const licenses = Array.isArray(raw.licenses) ? raw.licenses : [];
        const offerIds = [];
        const pushOffer = (v) => { if (typeof v === 'string' && v && !offerIds.includes(v)) offerIds.push(v); };
        pushOffer(sp.offerId);
        pushOffer(raw.offerId);
        licenses.forEach(l => pushOffer(l && l.uid));

        return {
            uid,
            url: `https://www.fab.com/listings/${uid}`,
            name: typeof raw.title === 'string' ? raw.title : '',
            offerId: offerIds[0] || '',
            offerIds,
            price: numOrNull(sp.price),
            discountedPrice: numOrNull(sp.discountedPrice),
            effectiveDiscountPercentage: numOrNull(sp.effectiveDiscountPercentage),
            currency: typeof sp.currencyCode === 'string' ? sp.currencyCode : '',
            isFreeFlag: raw.isFree === true,
            isDiscounted: raw.isDiscounted === true,
            licenses: licenses.map(l => ({
                name: (l && typeof l.name === 'string') ? l.name : '',
                isCc0: !!(l && l.isCc0),
                uid: (l && l.uid) ? String(l.uid) : ''
            })),
            listingType: typeof raw.listingType === 'string' ? raw.listingType : '',
            seller: (raw.user && typeof raw.user.sellerName === 'string') ? raw.user.sellerName : ''
        };
    },

    /**
     * 从完整 URL 中抠出 cursor 参数。
     * 响应里 cursors.next 与顶层 next 同时存在，优先用前者；
     * 但当 cursors 缺失时，这是唯一的翻页依据。
     */
    _cursorFromUrl: (url) => {
        try {
            const u = new URL(String(url), 'https://www.fab.com');
            return u.searchParams.get('cursor');
        } catch (e) {
            return null;
        }
    },

    /**
     * 解析一页响应。
     * 「是否到底」的唯一权威信号是 cursors.next === null —— 与 index.js 中
     * State.isEndOfSearchList 的判定口径保持一致，不靠本地猜。
     */
    parsePage: (payload) => {
        if (!payload || typeof payload !== 'object') {
            ListingSource.stats.malformedPages += 1;
            return { items: [], nextCursor: null, isEnd: true, malformed: true };
        }

        // 响应体本身是数组时按 results 处理。index.js 的 extractStateData 也兼容
        // 这种形态（接口并非稳定返回对象信封），此处保持一致。
        const rawItems = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload.results) ? payload.results : []);
        const items = rawItems
            .map(ListingSource.normalize)
            .filter(Boolean);
        ListingSource.stats.itemsSeen += items.length;

        let nextCursor = null;
        if (payload.cursors && payload.cursors.next != null) {
            nextCursor = String(payload.cursors.next);
        } else if (payload.next != null) {
            // 退路：cursors 缺失时从顶层完整 URL 里取
            nextCursor = ListingSource._cursorFromUrl(payload.next);
        }

        return {
            items,
            nextCursor: nextCursor || null,
            isEnd: !nextCursor,
            malformed: false
        };
    },

    /** 构造搜索 URL。cursor 为 null 时即为首页。 */
    buildUrl: (cursor = null) => {
        const getBase = ListingSource.deps.getBaseParams;
        const base = typeof getBase === 'function'
            ? (getBase() || {})
            : (ListingSource.baseParams || {});

        const params = new URLSearchParams();
        Object.keys(base).forEach(k => {
            const v = base[k];
            if (v !== null && v !== undefined && v !== '') params.set(k, String(v));
        });
        if (cursor) params.set('cursor', cursor);

        return `https://www.fab.com${SEARCH_PATH}?${params.toString()}`;
    },

    _defaultHeaders: () => {
        const headers = { 'x-requested-with': 'XMLHttpRequest', 'accept': 'application/json' };
        try {
            const token = Utils.getCookie('fab_csrftoken');
            if (token) headers['x-csrftoken'] = token;
        } catch (e) {
            // Utils 在测试环境可能不可用，缺 csrf 头不该让流程崩掉
        }
        return headers;
    },

    /** Retry-After 优先取调用方给的毫秒数，其次解析响应头（秒 → 毫秒）。 */
    _parseRetryAfter: (res) => {
        if (!res) return null;
        if (Number.isFinite(res.retryAfterMs)) return res.retryAfterMs;
        const match = String(res.responseHeaders || '').match(/retry-after:\s*(\d+)/i);
        return match ? Number(match[1]) * 1000 : null;
    },

    /**
     * 拉取一页。失败抛 SearchError，由上层决定退避还是终止。
     * 这里刻意不做重试 —— 重试节奏属于流水线与限速器的职责，
     * 在每一层都加退避会导致实际等待时间成倍叠加。
     */
    fetchPage: async (cursor = null) => {
        const fetchImpl = ListingSource.deps.fetchImpl;
        if (typeof fetchImpl !== 'function') {
            throw new SearchError('未配置 fetchImpl', { status: 0 });
        }

        const buildUrl = ListingSource.deps.buildUrl || ListingSource.buildUrl;
        const url = buildUrl(cursor);

        const getHeaders = ListingSource.deps.getHeaders || ListingSource._defaultHeaders;
        const res = await fetchImpl(url, { headers: getHeaders() });

        if (!res) throw new SearchError('搜索接口无响应', { status: 0, url });

        const status = Number(res.status) || 0;
        if (status === 429) {
            throw new SearchError('搜索接口限速', {
                status, retryAfterMs: ListingSource._parseRetryAfter(res), url
            });
        }
        if (status < 200 || status >= 300) {
            throw new SearchError(`搜索接口返回 ${status}`, { status, url });
        }

        let text = res.responseText;
        if (text === undefined && typeof res.text === 'function') text = await res.text();

        let payload = null;
        try {
            payload = JSON.parse(text == null ? '' : text);
        } catch (e) {
            throw new SearchError('搜索响应不是合法 JSON', { status, url });
        }

        const page = ListingSource.parsePage(payload);
        ListingSource.stats.pagesFetched += 1;
        return { ...page, url };
    }
};
