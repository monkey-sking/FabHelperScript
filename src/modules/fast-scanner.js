/**
 * Fab Helper - Fast Scanner Module（API 分片极速扫描 + 主标签页直领）
 *
 * 针对全站 4.7 万+免费商品场景替代慢速 DOM 滚动：
 *   1. 直接通过 /i/listings/search 游标接口拉取商品 JSON（24条/页）；
 *   2. 按 -firstPublishedAt 时利用实测可用的 Base64 时间游标（o=0&p=<ISO>）
 *      拆分为多路并发时间分片（默认 4 路，可调 1-6 路），分片边界保留 1s 重叠
 *      并由运行内 seenUids 去重，保证 0 漏扫、0 重复；
 *   3. 本地 Database.doneSet O(1) 命中直接跳过（0 网络请求）；未命中的每 ≤24 个
 *      合批查一次 /i/users/me/listings-states 核验；
 *   4. 确认未入库的普通免费商品直接在主标签页复用搜索响应的 startingPrice.offerId
 *      通过 ApiClaim.claim 1 次 POST 入库；仅 Bundle、人机验证或可重试故障
 *      回落到 worker 标签页队列；
 *   5. 可选「增量早停」模式：在 -firstPublishedAt 下单路从最新往下扫，连续 N 页
 *      全已拥有自动结束；
 *   6. 统一 429 退避闸门：任意一路撞 429 即全路暂停并自动降并发、增加节流间隔，
 *      保住原游标重试。
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { Database } from './database.js';
import { DataCache } from './data-cache.js';
import { ListingSource } from './listing-source.js';
import { ApiClaim, CLAIM_RESULT } from './claim-strategy.js';
import { isConfirmedBundleTask } from './bundle-claim.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_PATH = '/i/listings/search';
const STATES_PATH = '/i/users/me/listings-states';
const STATES_MAX_IDS = 24;
const CHECKPOINT_INTERVAL_MS = 5000;
const OVERLAP_MS = 1000;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const encodeBase64 = (text) => {
    if (typeof btoa === 'function') return btoa(text);
    if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
    throw new Error('Base64 encoder unavailable');
};

const decodeBase64 = (encoded) => {
    if (typeof atob === 'function') return atob(encoded);
    if (typeof Buffer !== 'undefined') return Buffer.from(encoded, 'base64').toString('utf8');
    throw new Error('Base64 decoder unavailable');
};

const formatPlus0000Iso = (ms) => {
    const iso = new Date(ms).toISOString();
    return iso.replace(/Z$/, '+00:00');
};

const parseHeaderValue = (res, name) => {
    if (!res) return null;
    if (typeof res.getResponseHeader === 'function') {
        const val = res.getResponseHeader(name);
        if (val != null && val !== '') return val;
    }
    if (res.headers && typeof res.headers.get === 'function') {
        const val = res.headers.get(name);
        if (val != null && val !== '') return val;
    }
    const rawHeaders = String(res.responseHeaders || '');
    if (!rawHeaders) return null;
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = rawHeaders.match(new RegExp(`^${escaped}:\\s*(.+)$`, 'im'));
    return match ? match[1].trim() : null;
};

const parseRetryAfterMs = (res) => {
    if (!res) return null;
    if (Number.isFinite(res.retryAfterMs)) return res.retryAfterMs;
    const raw = parseHeaderValue(res, 'retry-after');
    if (raw == null || raw === '') return null;
    const sec = Number(raw);
    if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
    const ts = Date.parse(raw);
    if (Number.isFinite(ts)) return Math.max(0, ts - Date.now());
    return null;
};

/**
 * 从当前页面 URL 提取搜索过滤与排序参数。
 * 剥离 lang / cursor / workerId / fab_claim_frame，其余过滤参数原样保留。
 */
export const extractSearchParamsFromUrl = (href) => {
    const ignored = new Set(['lang', 'cursor', 'workerId', 'fab_claim_frame']);
    const params = {};
    try {
        const u = new URL(
            href || 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
            'https://www.fab.com'
        );
        const keys = [];
        for (const k of u.searchParams.keys()) {
            if (ignored.has(k) || keys.includes(k)) continue;
            keys.push(k);
        }
        for (const k of keys) {
            const values = u.searchParams.getAll(k).filter((v) => v !== '');
            if (values.length === 0) continue;
            params[k] = values.length > 1 ? values : values[0];
        }
    } catch (_e) {
        // fallback below
    }
    if (Object.keys(params).length === 0) {
        return { is_free: '1', sort_by: '-firstPublishedAt' };
    }
    return params;
};

/** 生成稳定、有序的查询参数签名，用于断点续扫匹配。 */
export const buildQueryKey = (params = {}) => {
    const parts = [];
    Object.keys(params || {}).sort().forEach((k) => {
        const v = params[k];
        if (v === null || v === undefined || v === '') return;
        if (Array.isArray(v)) {
            [...v].map(String).sort().forEach((item) => {
                parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(item)}`);
            });
        } else {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    });
    return parts.join('&');
};

/** 构造 Fab 实测兼容的游标：base64("o=0&p=YYYY-MM-DDTHH%3Amm%3Ass.SSS%2B00%3A00") */
export const encodeTimeCursor = (isoOrMs) => {
    let ms;
    if (typeof isoOrMs === 'number') {
        ms = isoOrMs;
    } else if (isoOrMs instanceof Date) {
        ms = isoOrMs.getTime();
    } else {
        ms = Date.parse(String(isoOrMs));
    }
    if (!Number.isFinite(ms)) {
        throw new Error(`Invalid timestamp for cursor: ${isoOrMs}`);
    }
    const formatted = formatPlus0000Iso(ms);
    return encodeBase64(`o=0&p=${encodeURIComponent(formatted)}`);
};

/** 从 Fab 游标提取时间戳（毫秒）；非时间戳游标返回 null。 */
export const decodeTimeCursorMs = (cursor) => {
    if (!cursor || typeof cursor !== 'string') return null;
    try {
        const decoded = decodeBase64(cursor);
        const match = decoded.match(/(?:^|&)p=([^&]+)/);
        if (!match || !match[1]) return null;
        const val = decodeURIComponent(match[1].replace(/\+/g, ' '));
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return null;
        const ts = Date.parse(val);
        return Number.isFinite(ts) ? ts : null;
    } catch (_e) {
        return null;
    }
};

/**
 * 为 -firstPublishedAt 倒序构造降序时间分片队列。
 * 近期 2.5 年分布最密、切分更细；早期长尾粗分；最后一片 lowerMs=null 扫至列表真实末尾。
 */
export const buildTimeSlices = (newestMs, oldestMs, concurrency = 4, initialNextCursor = null) => {
    if (!Number.isFinite(newestMs) || !Number.isFinite(oldestMs) || newestMs <= oldestMs) {
        return [{
            id: 'time-0',
            extraParams: null,
            upperMs: Number.isFinite(newestMs) ? newestMs : null,
            lowerMs: null,
            cursor: initialNextCursor || null,
            done: false,
            pages: 0
        }];
    }

    const minSlices = Math.max(12, Math.max(1, Number(concurrency) || 4) * 3);
    const totalSpan = newestMs - oldestMs;
    if (totalSpan < minSlices * 60_000) {
        return [{
            id: 'time-0',
            extraParams: null,
            upperMs: newestMs,
            lowerMs: null,
            cursor: initialNextCursor || null,
            done: false,
            pages: 0
        }];
    }

    const recentWindowMs = 912 * DAY_MS; // ~2.5 years
    const recentFloorMs = Math.max(oldestMs, newestMs - recentWindowMs);
    const boundaries = [newestMs];

    if (recentFloorMs > oldestMs && totalSpan > 120 * DAY_MS) {
        const recentSpan = newestMs - recentFloorMs;
        const olderSpan = recentFloorMs - oldestMs;
        const recentCount = Math.max(8, Math.ceil(minSlices * 0.7));
        const olderCount = Math.max(4, minSlices - recentCount);

        const recentStep = Math.max(60_000, Math.floor(recentSpan / recentCount));
        for (let i = 1; i < recentCount; i++) {
            boundaries.push(newestMs - i * recentStep);
        }
        boundaries.push(recentFloorMs);

        const olderStep = Math.max(60_000, Math.floor(olderSpan / olderCount));
        for (let i = 1; i < olderCount; i++) {
            const b = recentFloorMs - i * olderStep;
            if (b > oldestMs + 60_000) boundaries.push(b);
        }
    } else {
        const step = Math.max(60_000, Math.floor(totalSpan / minSlices));
        for (let i = 1; i < minSlices; i++) {
            const b = newestMs - i * step;
            if (b > oldestMs + 60_000) boundaries.push(b);
        }
    }

    // Ensure descending strictly unique boundaries
    const unique = [];
    for (const b of boundaries) {
        if (unique.length === 0 || b < unique[unique.length - 1] - 1000) {
            unique.push(b);
        }
    }

    const slices = [];
    for (let i = 0; i < unique.length; i++) {
        const upperMs = unique[i];
        const lowerMs = i === unique.length - 1 ? null : unique[i + 1];
        const cursor = i === 0 ? (initialNextCursor || null) : encodeTimeCursor(upperMs);
        slices.push({
            id: `time-${i}`,
            extraParams: null,
            upperMs,
            lowerMs,
            cursor,
            done: false,
            pages: 0
        });
    }
    return slices;
};

const defaultFetchPageImpl = async (url, { headers, rawFetch } = {}) => {
    const fetchFn = typeof rawFetch === 'function'
        ? rawFetch
        : (typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null);

    if (fetchFn) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 30000) : null;
        try {
            const res = await fetchFn(url, {
                method: 'GET',
                credentials: 'include',
                headers: { accept: 'application/json', ...(headers || {}) },
                ...(controller ? { signal: controller.signal } : {})
            });
            const responseText = await res.text();
            return {
                status: res.status,
                responseText,
                getResponseHeader: (name) => res.headers?.get?.(name) ?? null
            };
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    const res = await API.gmFetch({
        method: 'GET',
        url,
        timeout: 30000,
        headers: { accept: 'application/json', ...(headers || {}) }
    });
    return {
        status: res.status,
        responseText: res.responseText,
        responseHeaders: res.responseHeaders
    };
};

/**
 * 构造可测试、可注入依赖的 FastScanner 实例。
 */
export const createFastScanner = (deps = {}) => {
    const getDatabase = () => deps.database || Database;
    const getApiClaim = () => deps.apiClaim || ApiClaim;
    const getListingSource = () => deps.listingSource || ListingSource;
    const getDataCache = () => deps.dataCache || DataCache;
    const getState = () => deps.state || State;
    const getConfig = () => deps.config || Config;
    const getUtils = () => deps.utils || Utils;
    const sleep = deps.sleep || defaultSleep;
    const nowFn = deps.now || (() => Date.now());
    const getHref = deps.getHref || (() => (typeof window !== 'undefined' && window.location ? window.location.href : 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt'));
    const getHeaders = deps.getHeaders || (() => ListingSource._defaultHeaders());
    let onUiUpdate = deps.onUiUpdate || (() => {});
    let onToast = deps.onToast || (() => {});
    let onAuthFailure = deps.onAuthFailure || (() => {});
    const onRecordNetwork = deps.onRecordNetwork || (() => {
        try {
            if (typeof window !== 'undefined' && typeof window.recordNetworkActivity === 'function') {
                window.recordNetworkActivity();
            }
        } catch (_e) { /* ignore */ }
    });
    let enqueueFallbackFn = deps.enqueueWorkerFallback || null;
    const gmGet = deps.gmGetValue || ((k, def) => (typeof GM_getValue === 'function' ? GM_getValue(k, def) : Promise.resolve(def)));
    const gmSet = deps.gmSetValue || ((k, v) => (typeof GM_setValue === 'function' ? GM_setValue(k, v) : Promise.resolve()));
    const gmDelete = deps.gmDeleteValue || ((k) => (typeof GM_deleteValue === 'function' ? GM_deleteValue(k) : Promise.resolve()));

    const claimIntervalMs = Number.isFinite(deps.claimIntervalMs) ? deps.claimIntervalMs : 400;
    const rateLimitBaseBackoffMs = Number.isFinite(deps.rateLimitBaseBackoffMs) ? deps.rateLimitBaseBackoffMs : 15000;
    const checkpointIntervalMs = Number.isFinite(deps.checkpointIntervalMs) ? deps.checkpointIntervalMs : CHECKPOINT_INTERVAL_MS;
    const claimWorkersCount = Number.isFinite(deps.claimWorkers) ? Math.max(1, deps.claimWorkers) : 2;
    const uiThrottleMs = Number.isFinite(deps.uiThrottleMs) ? deps.uiThrottleMs : 200;

    let running = false;
    let stopped = false;
    let authAborted = false;
    let earlyStopped = false;
    let activeRunPromise = null;

    let configuredConcurrency = 4;
    let activeConcurrency = 4;
    let pauseUntil = 0;
    let penaltyCount = 0;
    let extraDelayMs = 0;
    let cleanStreak = 0;

    let currentQueryKey = '';
    let currentBaseParams = {};
    let currentHeadUpperMs = null;
    let resumedFromCheckpoint = false;
    let currentMode = 'sequential';
    let currentSlices = [];
    let currentStats = null;
    let seenUids = new Set();
    let unknownBuffer = [];
    let inFlightStateChunks = new Set();
    let statesFlushChain = Promise.resolve();
    let claimQueue = [];
    let inFlightClaimTasks = new Set();
    let claimWaiters = [];
    let activeClaimsInFlight = 0;
    let lastClaimAt = 0;
    let slowPathLock = Promise.resolve();
    let consecutiveOwnedPages = 0;
    let lastUiAt = 0;
    let lastCheckpointAt = 0;
    let currentPhase = 'idle';
    let workerSlotWaiters = [];

    const wakeWorkerSlots = () => {
        while (workerSlotWaiters.length > 0) {
            const resolve = workerSlotWaiters.shift();
            resolve();
        }
    };

    const noteHeadTimestamp = (ms) => {
        if (Number.isFinite(ms)) {
            currentHeadUpperMs = currentHeadUpperMs == null ? ms : Math.max(currentHeadUpperMs, ms);
        }
    };

    const resetRunVars = () => {
        stopped = false;
        authAborted = false;
        earlyStopped = false;
        pauseUntil = 0;
        penaltyCount = 0;
        extraDelayMs = 0;
        cleanStreak = 0;
        currentQueryKey = '';
        currentBaseParams = {};
        currentHeadUpperMs = null;
        resumedFromCheckpoint = false;
        currentMode = 'sequential';
        currentSlices = [];
        seenUids = new Set();
        unknownBuffer = [];
        inFlightStateChunks = new Set();
        statesFlushChain = Promise.resolve();
        claimQueue = [];
        inFlightClaimTasks = new Set();
        claimWaiters = [];
        activeClaimsInFlight = 0;
        lastClaimAt = 0;
        slowPathLock = Promise.resolve();
        consecutiveOwnedPages = 0;
        lastUiAt = 0;
        lastCheckpointAt = 0;
        currentPhase = 'idle';
        workerSlotWaiters = [];
        currentStats = {
            pagesFetched: 0,
            itemsScanned: 0,
            totalEstimated: 0,
            skippedLocal: 0,
            skippedNonFree: 0,
            skippedFailed: 0,
            confirmedOwnedServer: 0,
            claimedDirect: 0,
            queuedFallback: 0,
            failed: 0,
            pageErrors: 0,
            failedSlices: 0,
            startedAt: nowFn(),
            finishedAt: null
        };
    };
    resetRunVars();

    const doFetch = async (url) => {
        onRecordNetwork();
        const headers = getHeaders();
        if (typeof deps.fetchImpl === 'function') {
            return deps.fetchImpl(url, { headers });
        }
        const rawFetch = getState().nativeFetch || null;
        return defaultFetchPageImpl(url, { headers, rawFetch });
    };

    const buildSnapshot = () => {
        const now = nowFn();
        const elapsedSec = Math.max(0.001, ((currentStats.finishedAt || now) - currentStats.startedAt) / 1000);
        return {
            running,
            phase: currentPhase,
            mode: currentMode,
            configuredConcurrency,
            activeConcurrency,
            pagesFetched: currentStats.pagesFetched,
            itemsScanned: currentStats.itemsScanned,
            totalEstimated: currentStats.totalEstimated,
            itemsPerSec: Math.round(currentStats.itemsScanned / elapsedSec),
            skippedLocal: currentStats.skippedLocal,
            skippedNonFree: currentStats.skippedNonFree,
            skippedFailed: currentStats.skippedFailed,
            confirmedOwnedServer: currentStats.confirmedOwnedServer,
            claimedDirect: currentStats.claimedDirect,
            queuedFallback: currentStats.queuedFallback,
            failed: currentStats.failed,
            pageErrors: currentStats.pageErrors,
            incompleteSlices: currentSlices.filter((s) => !s.done).length,
            resumedFromCheckpoint,
            consecutiveOwnedPages,
            earlyStopped,
            rateLimitedUntil: pauseUntil > now ? pauseUntil : 0,
            startedAt: currentStats.startedAt,
            finishedAt: currentStats.finishedAt
        };
    };

    const syncStatus = (force = false) => {
        const now = nowFn();
        getState().fastScanStatus = buildSnapshot();
        if (force || now - lastUiAt >= uiThrottleMs) {
            lastUiAt = now;
            try { onUiUpdate(getState().fastScanStatus); } catch (_e) { /* ignore */ }
        }
    };

    const logMsg = (level, msg) => {
        try { getUtils().logger(level, msg); } catch (_e) { /* ignore */ }
    };

    const waitRateGate = async () => {
        while (!stopped && !authAborted) {
            const now = nowFn();
            if (now < pauseUntil) {
                currentPhase = 'rate_limited';
                syncStatus();
                const waitMs = Math.min(250, Math.max(1, pauseUntil - now));
                await sleep(waitMs);
                continue;
            }
            if (currentPhase === 'rate_limited') {
                currentPhase = 'scanning';
                syncStatus(true);
            }
            if (extraDelayMs > 0) {
                await sleep(extraDelayMs);
            }
            return true;
        }
        return false;
    };

    const noteSuccess = () => {
        cleanStreak += 1;
        if (cleanStreak >= 40) {
            cleanStreak = 0;
            penaltyCount = 0;
            if (extraDelayMs > 0) {
                extraDelayMs = Math.max(0, extraDelayMs - 50);
            }
        }
    };

    const handleRateLimit = async (retryAfterMs = null, source = 'search') => {
        const now = nowFn();
        penaltyCount += 1;
        cleanStreak = 0;
        const backoffMs = (retryAfterMs != null && Number.isFinite(retryAfterMs) && retryAfterMs > 0)
            ? retryAfterMs
            : Math.min(600_000, rateLimitBaseBackoffMs * Math.pow(2, penaltyCount - 1));
        const targetUntil = now + backoffMs;
        const wasExtended = targetUntil > pauseUntil;
        pauseUntil = Math.max(pauseUntil, targetUntil);
        if (wasExtended) {
            activeConcurrency = Math.max(1, activeConcurrency - 1);
            extraDelayMs = Math.min(1000, extraDelayMs + 150);
            currentPhase = 'rate_limited';
            logMsg('warn', `[FastScanner] ${source} 触发 429 限速，全路暂停 ${Math.ceil(backoffMs / 1000)}s，并发降至 ${activeConcurrency} 路。`);
            syncStatus(true);
        }
    };

    const buildSearchUrl = (baseParams, cursor = null, extraParams = null) => {
        const merged = { ...(baseParams || {}), ...(extraParams || {}) };
        const sp = new URLSearchParams();
        Object.keys(merged).forEach((k) => {
            const v = merged[k];
            if (v === null || v === undefined || v === '') return;
            if (Array.isArray(v)) {
                v.forEach((item) => sp.append(k, String(item)));
            } else {
                sp.set(k, String(v));
            }
        });
        if (cursor) sp.set('cursor', cursor);
        return `https://www.fab.com${SEARCH_PATH}?${sp.toString()}`;
    };

    const toPendingClaimPayload = (item) => ({
        uid: item.uid,
        url: item.url,
        name: item.name || 'Untitled',
        offerId: item.offerId || '',
        offerIds: Array.isArray(item.offerIds) ? item.offerIds : [],
        listingType: item.listingType || '',
        isBundle: Boolean(item.isBundle || item.listingType === 'bundle'),
        needsDiscountVerify: Boolean(item.needsDiscountVerify)
    });

    const dedupePending = (items, mapFn) => {
        const db = getDatabase();
        const seen = new Set();
        const out = [];
        for (const it of items) {
            if (!it || !it.uid || seen.has(it.uid)) continue;
            if (it.url && db.isDone(it.url)) continue;
            seen.add(it.uid);
            out.push(mapFn(it));
        }
        return out;
    };

    const buildCheckpointPayload = () => ({
        version: 1,
        queryKey: currentQueryKey,
        mode: currentMode,
        headUpperMs: currentHeadUpperMs,
        totalEstimated: currentStats.totalEstimated,
        slices: currentSlices.map(({ inProgress, failedThisRun, ...rest }) => rest),
        pendingUnknowns: dedupePending(
            [...Array.from(inFlightStateChunks).flat(), ...unknownBuffer],
            (item) => ({
                uid: item.uid,
                url: item.url,
                name: item.name || 'Untitled',
                offerId: item.offerId || '',
                offerIds: Array.isArray(item.offerIds) ? item.offerIds : [],
                listingType: item.listingType || '',
                needsDiscountVerify: Boolean(item.needsDiscountVerify)
            })
        ),
        pendingClaims: dedupePending(
            [...Array.from(inFlightClaimTasks), ...claimQueue],
            toPendingClaimPayload
        ),
        stats: {
            pagesFetched: currentStats.pagesFetched,
            itemsScanned: currentStats.itemsScanned,
            totalEstimated: currentStats.totalEstimated,
            skippedLocal: currentStats.skippedLocal,
            skippedNonFree: currentStats.skippedNonFree,
            skippedFailed: currentStats.skippedFailed,
            confirmedOwnedServer: currentStats.confirmedOwnedServer,
            claimedDirect: currentStats.claimedDirect,
            queuedFallback: currentStats.queuedFallback,
            failed: currentStats.failed
        },
        savedAt: nowFn()
    });

    const saveCheckpoint = async (force = false) => {
        if (currentMode === 'incremental') return;
        const now = nowFn();
        if (!force && now - lastCheckpointAt < checkpointIntervalMs) return;
        lastCheckpointAt = now;
        try {
            await gmSet(getConfig().DB_KEYS.FAST_SCAN_CHECKPOINT, buildCheckpointPayload());
            getState().hasFastScanCheckpoint = true;
        } catch (_e) { /* ignore */ }
    };

    const clearCheckpoint = async () => {
        try {
            await gmDelete(getConfig().DB_KEYS.FAST_SCAN_CHECKPOINT);
            getState().hasFastScanCheckpoint = false;
        } catch (_e) { /* ignore */ }
    };

    const wakeClaimWorkers = () => {
        while (claimWaiters.length > 0) {
            const resolve = claimWaiters.shift();
            resolve();
        }
    };

    const enqueueClaim = (item) => {
        claimQueue.push({
            uid: item.uid,
            url: item.url,
            name: item.name || 'Untitled',
            offerId: item.offerId || '',
            offerIds: Array.isArray(item.offerIds) ? item.offerIds : [],
            listingType: item.listingType || '',
            isBundle: item.listingType === 'bundle',
            needsDiscountVerify: Boolean(item.needsDiscountVerify)
        });
        wakeClaimWorkers();
    };

    const routeToFallback = async (task) => {
        currentStats.queuedFallback += 1;
        if (typeof enqueueFallbackFn === 'function') {
            await enqueueFallbackFn(task);
            return;
        }
        const db = getDatabase();
        const st = getState();
        if (!Array.isArray(st.db.todo)) st.db.todo = [];
        const cleanTarget = db.normalizeListingUrl(task.url);
        const alreadyTodo = st.db.todo.some((t) => t.uid === task.uid || db.normalizeListingUrl(t.url) === cleanTarget);
        const alreadyRunning = Object.values(st.runningWorkers || {}).some((w) => w?.task?.uid === task.uid);
        if (!alreadyTodo && !alreadyRunning) {
            st.db.todo.push(task);
            await db.saveTodo();
        }
    };

    const checkStatesChunk = async (chunk) => {
        if (!chunk || chunk.length === 0) return { ownedCount: 0, unownedCount: 0 };
        const db = getDatabase();
        const u = new URL(`https://www.fab.com${STATES_PATH}`);
        chunk.forEach((item) => u.searchParams.append('listing_ids', item.uid));

        inFlightStateChunks.add(chunk);
        try {
            let attempts = 0;
            while (!stopped && !authAborted) {
                const okToRun = await waitRateGate();
                if (!okToRun) {
                    unknownBuffer.unshift(...chunk);
                    return { ownedCount: 0, unownedCount: 0 };
                }

                attempts += 1;
                let res;
                try {
                    res = await doFetch(u.toString());
                } catch (_err) {
                    if (stopped || authAborted) {
                        unknownBuffer.unshift(...chunk);
                        return { ownedCount: 0, unownedCount: 0 };
                    }
                    if (attempts < 2) {
                        await sleep(Math.min(500, rateLimitBaseBackoffMs));
                        continue;
                    }
                    chunk.forEach((item) => enqueueClaim(item));
                    return { ownedCount: 0, unownedCount: chunk.length };
                }

                if (stopped || authAborted) {
                    unknownBuffer.unshift(...chunk);
                    return { ownedCount: 0, unownedCount: 0 };
                }

                const status = Number(res?.status) || 0;
                if (status === 429) {
                    await handleRateLimit(parseRetryAfterMs(res), 'listings-states');
                    continue;
                }
                if (status === 401 || status === 403) {
                    authAborted = true;
                    currentPhase = 'error';
                    onAuthFailure();
                    return { ownedCount: 0, unownedCount: 0 };
                }
                if (status >= 200 && status < 300) {
                    noteSuccess();
                    let raw = null;
                    try { raw = JSON.parse(res.responseText || '[]'); } catch (_e) { raw = []; }
                    const states = Array.isArray(raw) ? raw : (API.extractStateData(raw, 'FastScanner') || []);
                    const acquiredSet = new Set(
                        states.filter((s) => s && s.acquired && s.uid).map((s) => String(s.uid).toLowerCase())
                    );
                    const ownedUrls = [];
                    const unownedItems = [];
                    chunk.forEach((item) => {
                        if (acquiredSet.has(item.uid)) {
                            ownedUrls.push(item.url);
                        } else {
                            unownedItems.push(item);
                        }
                    });
                    if (ownedUrls.length > 0) {
                        db.addDoneUrls(ownedUrls);
                        db.scheduleSaveDone();
                        currentStats.confirmedOwnedServer += ownedUrls.length;
                    }
                    unownedItems.forEach((item) => enqueueClaim(item));
                    syncStatus();
                    return { ownedCount: ownedUrls.length, unownedCount: unownedItems.length };
                }

                if (attempts < 2) {
                    await sleep(Math.min(500, rateLimitBaseBackoffMs));
                    continue;
                }
                // 保守回退：接口异常时入领队队列，由领取侧决定，避免漏领
                chunk.forEach((item) => enqueueClaim(item));
                return { ownedCount: 0, unownedCount: chunk.length };
            }
            unknownBuffer.unshift(...chunk);
            return { ownedCount: 0, unownedCount: 0 };
        } finally {
            inFlightStateChunks.delete(chunk);
        }
    };

    const flushUnknownBuffer = (drainAll = false) => {
        const job = async () => {
            let ownedTotal = 0;
            let unownedTotal = 0;
            while (unknownBuffer.length > 0 && !stopped && !authAborted) {
                if (!drainAll && unknownBuffer.length < STATES_MAX_IDS) break;
                const chunk = unknownBuffer.splice(0, STATES_MAX_IDS);
                const res = await checkStatesChunk(chunk);
                ownedTotal += res.ownedCount;
                unownedTotal += res.unownedCount;
            }
            return { ownedTotal, unownedTotal };
        };
        const next = statesFlushChain.then(job, job);
        statesFlushChain = next.catch(() => ({ ownedTotal: 0, unownedTotal: 0 }));
        return next;
    };

    const processPageItems = async (items, { flushImmediately = false } = {}) => {
        const db = getDatabase();
        const ls = getListingSource();
        const cache = getDataCache();
        const isFreeQuery = String(currentBaseParams?.is_free || '') === '1';
        const isTimeDesc = currentBaseParams?.sort_by === '-firstPublishedAt';
        let addedToUnknown = 0;

        for (const item of (items || [])) {
            if (!item || !item.uid) continue;
            if (isTimeDesc && Number.isFinite(item.publishedAtMs)) {
                noteHeadTimestamp(item.publishedAtMs);
            }
            if (seenUids.has(item.uid)) continue;
            seenUids.add(item.uid);

            currentStats.itemsScanned += 1;

            let queueItem = item;
            if (!ls.isClaimable(item)) {
                // 搜索结果里 100% 限时折扣商品的 startingPrice 可能仍标原价且缺 discountedPrice，
                // 在 is_free=1 下交给 ApiClaim 慢路径查详情 licenses 再判是否真正免费。
                const maybeDiscountedFree = isFreeQuery
                    && item.isDiscounted === true
                    && item.discountedPrice == null
                    && item.effectiveDiscountPercentage == null;
                if (!maybeDiscountedFree) {
                    currentStats.skippedNonFree += 1;
                    continue;
                }
                queueItem = { ...item, offerId: '', needsDiscountVerify: true };
            }
            if (db.isDone(item.url)) {
                currentStats.skippedLocal += 1;
                continue;
            }
            if (db.isFailed(item.url)) {
                currentStats.skippedFailed += 1;
                continue;
            }

            // 缓存 offerId 映射，供可能走传统详情页或价格拦截的路径复用
            if (queueItem.offerId) {
                cache.offerListingUids.set(queueItem.offerId, queueItem.uid);
            }

            unknownBuffer.push(queueItem);
            addedToUnknown += 1;
        }

        if (flushImmediately) {
            return flushUnknownBuffer(true);
        }
        if (unknownBuffer.length >= STATES_MAX_IDS) {
            await flushUnknownBuffer(false);
        } else if (addedToUnknown === 0) {
            syncStatus();
        }
        return { ownedTotal: 0, unownedTotal: 0 };
    };

    const runClaimWithSlowPathGuard = async (task, apiClaim) => {
        if (task.offerId) {
            return apiClaim.claim(task);
        }
        // ApiClaim 慢路径复用单例字段 _lastResolvedListing，无 offerId 时串行化防止竞态
        const exec = () => apiClaim.claim(task);
        const run = slowPathLock.then(exec, exec);
        slowPathLock = run.catch(() => {});
        return run;
    };

    const runClaimLoop = async (scanDoneRef) => {
        const db = getDatabase();
        const apiClaim = getApiClaim();
        const cfg = getConfig();
        const st = getState();

        while (true) {
            if (stopped || authAborted) break;

            if (claimQueue.length === 0) {
                if (scanDoneRef.done) break;
                await new Promise((resolve) => {
                    claimWaiters.push(resolve);
                });
                continue;
            }

            const task = claimQueue.shift();
            if (!task) continue;
            if (db.isDone(task.url)) continue;

            activeClaimsInFlight += 1;
            inFlightClaimTasks.add(task);
            try {
                if (isConfirmedBundleTask(task)) {
                    await routeToFallback(task);
                    syncStatus();
                    continue;
                }

                const canApiClaim = Boolean(cfg.USE_API_CLAIM && typeof apiClaim.isAvailable === 'function' && apiClaim.isAvailable());
                if (!canApiClaim) {
                    await routeToFallback(task);
                    syncStatus();
                    continue;
                }

                const gateOk = await waitRateGate();
                if (!gateOk) {
                    claimQueue.unshift(task);
                    break;
                }

                if (claimIntervalMs > 0) {
                    const sinceLast = nowFn() - lastClaimAt;
                    if (sinceLast < claimIntervalMs) {
                        await sleep(claimIntervalMs - sinceLast);
                    }
                    lastClaimAt = nowFn();
                }

                let outcome = await runClaimWithSlowPathGuard(task, apiClaim);

                if (outcome.serverInternalError && task.offerId) {
                    // 搜索返回的 offerId 触发 500 Internal error 时，回源详情换另一免费许可（如 professional）再试一次
                    outcome = await runClaimWithSlowPathGuard({ ...task, offerId: '' }, apiClaim);
                }

                if (outcome.result === CLAIM_RESULT.SUCCESS) {
                    noteSuccess();
                    await db.markAsDone(task, { deferSave: true });
                    st.sessionCompleted?.add(db.normalizeListingUrl(task.url));
                    currentStats.claimedDirect += 1;
                    syncStatus(true);
                } else if (outcome.result === CLAIM_RESULT.RATE_LIMITED) {
                    await handleRateLimit(outcome.retryAfterMs, 'add-to-library');
                    const retries = (task._claimRateRetries || 0) + 1;
                    if (retries <= 5) {
                        task._claimRateRetries = retries;
                        claimQueue.push(task);
                    } else {
                        const reason = `连续限速 ${retries - 1} 次，放弃该商品`;
                        logMsg('warn', `[FastScanner] 领取失败 (${task.name || task.uid}): ${reason}`);
                        const failRes = await db.markAsFailed(task, { reason });
                        if (failRes && failRes.retried) {
                            currentStats.queuedFallback += 1;
                        } else {
                            currentStats.failed += 1;
                        }
                        syncStatus(true);
                    }
                } else if (outcome.isBundle) {
                    task.listingType = 'bundle';
                    task.isBundle = true;
                    await routeToFallback(task);
                    syncStatus();
                } else if (outcome.serverInternalError) {
                    const reason = 'Fab 服务端内部错误 (500 Internal error)，官网按钮亦无法入库';
                    logMsg('warn', `[FastScanner] 领取失败 (${task.name || task.uid}): ${reason}`);
                    const failRes = await db.markAsFailed(task, { reason });
                    if (failRes && failRes.retried) {
                        currentStats.queuedFallback += 1;
                    } else {
                        currentStats.failed += 1;
                    }
                    syncStatus(true);
                } else if (outcome.result === CLAIM_RESULT.UNAVAILABLE || outcome.retryable === true) {
                    await routeToFallback(task);
                    syncStatus();
                } else {
                    const reason = outcome.reason || '领取失败';
                    if (/CSRF|401|未登录|会话/i.test(reason)) {
                        authAborted = true;
                        currentPhase = 'error';
                        onAuthFailure();
                        break;
                    }
                    if (task.needsDiscountVerify && /未找到免费许可/.test(reason)) {
                        currentStats.skippedNonFree += 1;
                        logMsg('debug', `[FastScanner] 折扣商品复核非 100% 免费，已跳过 (${task.name || task.uid})`);
                        syncStatus();
                        continue;
                    }
                    logMsg('warn', `[FastScanner] 领取失败 (${task.name || task.uid}): ${reason}`);
                    const failRes = await db.markAsFailed(task, { reason });
                    if (failRes && failRes.retried) {
                        currentStats.queuedFallback += 1;
                    } else {
                        currentStats.failed += 1;
                    }
                    syncStatus(true);
                }
            } finally {
                inFlightClaimTasks.delete(task);
                activeClaimsInFlight -= 1;
            }
        }
    };

    const fetchSearchPageRaw = async (url, label = 'search') => {
        let networkFailures = 0;
        while (!stopped && !authAborted) {
            const gateOk = await waitRateGate();
            if (!gateOk) return { aborted: true };

            let res;
            try {
                res = await doFetch(url);
            } catch (err) {
                networkFailures += 1;
                currentStats.pageErrors += 1;
                if (networkFailures >= 3) {
                    return { error: err };
                }
                await sleep(Math.min(2000 * networkFailures, Math.max(50, rateLimitBaseBackoffMs)));
                continue;
            }

            const status = Number(res?.status) || 0;
            if (status === 429) {
                await handleRateLimit(parseRetryAfterMs(res), label);
                continue;
            }
            if (status === 401 || status === 403) {
                authAborted = true;
                currentPhase = 'error';
                onAuthFailure();
                return { aborted: true };
            }
            if (status >= 200 && status < 300) {
                noteSuccess();
                try {
                    const json = JSON.parse(res.responseText || '{}');
                    return { ok: true, json };
                } catch (e) {
                    networkFailures += 1;
                    if (networkFailures >= 3) return { error: e };
                    await sleep(Math.min(500, rateLimitBaseBackoffMs));
                    continue;
                }
            }

            networkFailures += 1;
            currentStats.pageErrors += 1;
            if (networkFailures >= 3) {
                return { error: new Error(`Search HTTP ${status}`) };
            }
            await sleep(Math.min(1000 * networkFailures, Math.max(50, rateLimitBaseBackoffMs)));
        }
        return { aborted: true };
    };

    const calibrateRun = async (baseParams, opts) => {
        const ls = getListingSource();
        const cfg = getConfig();
        const incrementalMode = Boolean(opts.incrementalEarlyStop && baseParams.sort_by === '-firstPublishedAt');
        const targetConcurrency = incrementalMode ? 1 : configuredConcurrency;

        // 1. 先检查是否存在匹配当前筛选条件且未完成的全量断点
        if (!incrementalMode && opts.resumeCheckpoint !== false) {
            try {
                const db = getDatabase();
                const saved = await gmGet(cfg.DB_KEYS.FAST_SCAN_CHECKPOINT, null);
                const pendingUnknowns = Array.isArray(saved?.pendingUnknowns) ? saved.pendingUnknowns : [];
                const pendingClaims = Array.isArray(saved?.pendingClaims) ? saved.pendingClaims : [];
                const hasUnfinishedSlices = Array.isArray(saved?.slices) && saved.slices.some((s) => !s.done);
                if (saved && saved.queryKey === currentQueryKey && (hasUnfinishedSlices || pendingUnknowns.length > 0 || pendingClaims.length > 0)) {
                    resumedFromCheckpoint = true;
                    currentMode = saved.mode || 'time-shards';
                    currentSlices = Array.isArray(saved.slices)
                        ? saved.slices.map((s) => ({ ...s, inProgress: false, failedThisRun: false }))
                        : [];
                    pendingUnknowns.forEach((item) => {
                        if (!item || !item.uid || seenUids.has(item.uid) || db.isDone(item.url)) return;
                        seenUids.add(item.uid);
                        unknownBuffer.push(item);
                    });
                    pendingClaims.forEach((task) => {
                        if (!task || !task.uid || seenUids.has(task.uid) || db.isDone(task.url)) return;
                        seenUids.add(task.uid);
                        claimQueue.push(toPendingClaimPayload(task));
                    });
                    if (saved.stats) {
                        currentStats.totalEstimated = saved.stats.totalEstimated || saved.totalEstimated || 0;
                        currentStats.pagesFetched = saved.stats.pagesFetched || 0;
                        currentStats.itemsScanned = saved.stats.itemsScanned || 0;
                        currentStats.skippedLocal = saved.stats.skippedLocal || 0;
                        currentStats.skippedNonFree = saved.stats.skippedNonFree || 0;
                        currentStats.skippedFailed = saved.stats.skippedFailed || 0;
                        currentStats.confirmedOwnedServer = saved.stats.confirmedOwnedServer || 0;
                        currentStats.claimedDirect = saved.stats.claimedDirect || 0;
                        currentStats.queuedFallback = saved.stats.queuedFallback || 0;
                        currentStats.failed = saved.stats.failed || 0;
                    }

                    // 续扫前先从最新头部向下补扫到上次断点的顶部时间戳，避免中断期间新上架商品被永久跳过
                    let prevHeadMs = Number.isFinite(saved.headUpperMs) ? saved.headUpperMs : null;
                    if (prevHeadMs == null) {
                        for (const s of currentSlices) {
                            if (Number.isFinite(s?.upperMs)) {
                                prevHeadMs = prevHeadMs == null ? s.upperMs : Math.max(prevHeadMs, s.upperMs);
                            }
                            const cMs = decodeTimeCursorMs(s?.cursor);
                            if (Number.isFinite(cMs)) {
                                prevHeadMs = prevHeadMs == null ? cMs : Math.max(prevHeadMs, cMs);
                            }
                        }
                    }
                    if (prevHeadMs == null && Number.isFinite(saved.savedAt)) {
                        prevHeadMs = saved.savedAt;
                    }
                    let addedHeadSlice = false;
                    if (baseParams.sort_by === '-firstPublishedAt' && Number.isFinite(prevHeadMs)) {
                        currentHeadUpperMs = prevHeadMs;
                        currentSlices.unshift({
                            id: `time-head-${nowFn()}`,
                            extraParams: null,
                            upperMs: null,
                            lowerMs: prevHeadMs,
                            cursor: null,
                            done: false,
                            inProgress: false,
                            failedThisRun: false,
                            pages: 0
                        });
                        addedHeadSlice = true;
                    }

                    logMsg(
                        'info',
                        `[FastScanner] 检测到未完成的断点，恢复扫描（剩余 ${currentSlices.filter((s) => !s.done).length} 个分片，待处理 ${unknownBuffer.length + claimQueue.length} 项` +
                        (addedHeadSlice ? '，已追加头部补扫分片覆盖断点期间新品' : '') +
                        '）。'
                    );
                    return;
                }
            } catch (_e) { /* ignore */ }
        }

        // 2. 聚合查询：获取总数量与品类分布
        let listingTypes = [];
        const aggUrl = buildSearchUrl(baseParams, null, { count: '0', aggregate_on: 'listing_type' });
        const aggRes = await fetchSearchPageRaw(aggUrl, 'aggregate');
        if (aggRes.aborted) return;
        if (aggRes.ok && aggRes.json) {
            const buckets = aggRes.json?.aggregations?.listingType?.buckets
                || aggRes.json?.aggregations?.listing_type?.buckets
                || {};
            const entries = Object.entries(buckets)
                .map(([type, info]) => ({ type, count: Number(info?.docCount ?? info?.doc_count) || 0 }))
                .filter((e) => e.count > 0)
                .sort((a, b) => b.count - a.count);
            currentStats.totalEstimated = entries.reduce((sum, e) => sum + e.count, 0);
            listingTypes = entries.map((e) => e.type);
        }

        if (incrementalMode) {
            currentMode = 'incremental';
            currentSlices = [{
                id: 'inc-0',
                extraParams: null,
                upperMs: null,
                lowerMs: null,
                cursor: null,
                done: false,
                inProgress: false,
                pages: 0
            }];
            return;
        }

        if (targetConcurrency > 1 && baseParams.sort_by === '-firstPublishedAt') {
            // 并行拉取第 1 页（降序）和最老第 1 页（升序）定标时间跨度，两页结果直接消费不浪费
            const descUrl = buildSearchUrl(baseParams, null);
            const ascUrl = buildSearchUrl({ ...baseParams, sort_by: 'firstPublishedAt' }, null);
            const [descRes, ascRes] = await Promise.all([
                fetchSearchPageRaw(descUrl, 'calibrate-desc'),
                fetchSearchPageRaw(ascUrl, 'calibrate-asc')
            ]);
            if (descRes.aborted || ascRes.aborted) return;

            let descPage = null;
            if (descRes.ok) {
                descPage = ls.parsePage(descRes.json);
                currentStats.pagesFetched += 1;
                await processPageItems(descPage.items, { flushImmediately: false });
            }
            let ascPage = null;
            if (ascRes.ok) {
                ascPage = ls.parsePage(ascRes.json);
                currentStats.pagesFetched += 1;
                await processPageItems(ascPage.items, { flushImmediately: false });
            }

            if (descPage && !descPage.nextCursor) {
                currentMode = 'time-shards';
                currentSlices = [];
                return;
            }

            const topMs = decodeTimeCursorMs(descPage?.nextCursor);
            const bottomMs = decodeTimeCursorMs(ascPage?.nextCursor);
            noteHeadTimestamp(topMs);
            if (topMs != null && bottomMs != null && topMs > bottomMs) {
                currentMode = 'time-shards';
                currentSlices = buildTimeSlices(topMs, bottomMs, targetConcurrency, descPage.nextCursor)
                    .map((s) => ({ ...s, inProgress: false, failedThisRun: false }));
            } else {
                currentMode = 'sequential';
                currentSlices = [{
                    id: 'seq-0',
                    extraParams: null,
                    upperMs: topMs,
                    lowerMs: null,
                    cursor: descPage?.nextCursor || null,
                    done: false,
                    inProgress: false,
                    failedThisRun: false,
                    pages: 0
                }];
            }
            return;
        }

        const shardableTypes = listingTypes.filter((t) => t !== 'bundle');
        if (targetConcurrency > 1 && !baseParams.listing_types && shardableTypes.length > 1) {
            currentMode = 'type-shards';
            currentSlices = shardableTypes.map((t) => ({
                id: `type-${t}`,
                extraParams: { listing_types: t },
                upperMs: null,
                lowerMs: null,
                cursor: null,
                done: false,
                inProgress: false,
                failedThisRun: false,
                pages: 0
            }));
            return;
        }

        currentMode = 'sequential';
        currentSlices = [{
            id: 'seq-0',
            extraParams: null,
            upperMs: null,
            lowerMs: null,
            cursor: null,
            done: false,
            inProgress: false,
            failedThisRun: false,
            pages: 0
        }];
    };

    const runScanWorker = async (workerIdx, baseParams, stopPages) => {
        const ls = getListingSource();
        while (!stopped && !authAborted && !earlyStopped) {
            if (workerIdx >= activeConcurrency) {
                const remaining = currentSlices.some((s) => !s.done && !s.failedThisRun);
                if (!remaining) break;
                await new Promise((resolve) => { workerSlotWaiters.push(resolve); });
                continue;
            }

            const slice = currentSlices.find((s) => !s.done && !s.inProgress && !s.failedThisRun);
            if (!slice) {
                const anyInProgress = currentSlices.some((s) => !s.done && !s.failedThisRun && s.inProgress);
                if (!anyInProgress) break;
                await new Promise((resolve) => { workerSlotWaiters.push(resolve); });
                continue;
            }

            slice.inProgress = true;
            try {
                while (!stopped && !authAborted && !earlyStopped && !slice.done && !slice.failedThisRun) {
                    if (workerIdx >= activeConcurrency) {
                        break; // 降并发时让出当前分片（cursor 保留，供活跃 worker 接力）
                    }

                    const url = buildSearchUrl(baseParams, slice.cursor, slice.extraParams);
                    const res = await fetchSearchPageRaw(url, slice.id);
                    if (res.aborted || stopped || authAborted) break;
                    if (res.error) {
                        logMsg('warn', `[FastScanner] 分片 ${slice.id} 请求连续失败，保留断点待续扫: ${res.error.message}`);
                        slice.failedThisRun = true;
                        slice.lastError = res.error.message || 'Search error';
                        currentStats.failedSlices += 1;
                        break;
                    }

                    const page = ls.parsePage(res.json);
                    slice.pages += 1;
                    currentStats.pagesFetched += 1;

                    const isIncremental = currentMode === 'incremental';
                    const pageResult = await processPageItems(page.items, { flushImmediately: isIncremental });
                    if (stopped || authAborted) break;

                    if (baseParams.sort_by === '-firstPublishedAt' && page.nextCursor) {
                        noteHeadTimestamp(decodeTimeCursorMs(page.nextCursor));
                    }

                    if (!page.nextCursor) {
                        slice.cursor = null;
                        slice.done = true;
                    } else if (slice.lowerMs != null) {
                        const nextMs = decodeTimeCursorMs(page.nextCursor);
                        if (nextMs != null && nextMs < slice.lowerMs - OVERLAP_MS) {
                            slice.cursor = null;
                            slice.done = true;
                        } else {
                            slice.cursor = page.nextCursor;
                        }
                    } else {
                        slice.cursor = page.nextCursor;
                    }

                    if (isIncremental && page.items.length > 0) {
                        if (pageResult.unownedTotal === 0) {
                            consecutiveOwnedPages += 1;
                        } else {
                            consecutiveOwnedPages = 0;
                        }
                        if (consecutiveOwnedPages >= stopPages) {
                            earlyStopped = true;
                            slice.done = true;
                        }
                    }

                    syncStatus();
                    await saveCheckpoint(false);
                }
            } finally {
                slice.inProgress = false;
                wakeWorkerSlots();
            }
        }
    };

    const start = async (options = {}) => {
        if (running && activeRunPromise) return activeRunPromise;

        const st = getState();
        const cfg = getConfig();
        const db = getDatabase();

        resetRunVars();
        running = true;

        const reqConc = Number.isFinite(options.concurrency)
            ? options.concurrency
            : (Number(st.apiScanConcurrency) || cfg.DEFAULT_API_SCAN_CONCURRENCY || 4);
        configuredConcurrency = Math.max(1, Math.min(cfg.MAX_API_SCAN_CONCURRENCY || 6, Math.floor(reqConc)));
        activeConcurrency = configuredConcurrency;

        const incEnabled = options.incrementalEarlyStop !== undefined
            ? Boolean(options.incrementalEarlyStop)
            : Boolean(st.incrementalEarlyStop);
        const stopPages = Math.max(1, Math.min(50, Math.floor(
            Number.isFinite(options.incrementalStopPages)
                ? options.incrementalStopPages
                : (Number(st.incrementalStopPages) || cfg.DEFAULT_INCREMENTAL_STOP_PAGES || 5)
        )));

        const rawBaseParams = options.baseParams || extractSearchParamsFromUrl(getHref());
        const baseParams = { ...rawBaseParams };
        if (!options.preserveQuery && baseParams.is_free === undefined) {
            baseParams.is_free = '1';
            logMsg('info', '[FastScanner] 当前页面未携带 is_free=1，已自动限定仅扫描免费商品。');
        }
        if (!options.preserveSort && baseParams.sort_by !== '-firstPublishedAt') {
            baseParams.sort_by = '-firstPublishedAt';
            logMsg(
                'info',
                incEnabled
                    ? '[FastScanner] 追新模式已自动按最新发布倒序 (-firstPublishedAt) 扫描（保留当前筛选）'
                    : '[FastScanner] 全量扫描已自动切换为按最新发布倒序 (-firstPublishedAt) 时间分片（避免默认排序触发 Fab 万条分页上限）'
            );
        }
        currentBaseParams = baseParams;
        currentQueryKey = buildQueryKey(baseParams);

        currentPhase = 'calibrating';
        syncStatus(true);

        const runWork = async () => {
            try {
                await calibrateRun(baseParams, {
                    incrementalEarlyStop: incEnabled,
                    resumeCheckpoint: options.resumeCheckpoint
                });

                if (stopped || authAborted) {
                    return buildSnapshot();
                }

                currentPhase = 'scanning';
                logMsg(
                    'info',
                    `[FastScanner] 开始极速扫描 (${currentMode}, ${activeConcurrency} 路并发` +
                    (currentStats.totalEstimated > 0 ? `, 预计 ${currentStats.totalEstimated} 件` : '') +
                    (incEnabled && currentMode === 'incremental' ? `, 连续 ${stopPages} 页已拥有早停` : '') +
                    ')'
                );
                syncStatus(true);

                const scanDoneRef = { done: false };
                const spawnCount = currentMode === 'incremental'
                    ? 1
                    : Math.min(cfg.MAX_API_SCAN_CONCURRENCY || 6, Math.max(configuredConcurrency, 1), Math.max(1, currentSlices.length));
                const claimLoops = Array.from({ length: claimWorkersCount }, () => runClaimLoop(scanDoneRef));

                if (currentSlices.some((s) => !s.done)) {
                    const scanWorkers = Array.from(
                        { length: spawnCount },
                        (_, idx) => runScanWorker(idx, baseParams, stopPages)
                    );
                    await Promise.all(scanWorkers);
                }

                // 扫尾：冲刷最后不足 24 条的待核验队列，并等待主标签页领取队列排空
                if (!stopped && !authAborted) {
                    currentPhase = 'draining';
                    syncStatus(true);
                    await flushUnknownBuffer(true);
                }

                scanDoneRef.done = true;
                wakeClaimWorkers();
                await Promise.all(claimLoops);
                await db.flushSaveDone();

                currentStats.finishedAt = nowFn();
                const incompleteSlices = currentSlices.filter((s) => !s.done).length;
                if (stopped) {
                    currentPhase = 'paused';
                    await saveCheckpoint(true);
                } else if (authAborted) {
                    currentPhase = 'error';
                    await saveCheckpoint(true);
                } else if (!earlyStopped && incompleteSlices > 0) {
                    currentPhase = 'partial';
                    await saveCheckpoint(true);
                    const summary = buildSnapshot();
                    const toastMsg = getUtils().getText(
                        'toast_fast_scan_partial',
                        summary.claimedDirect,
                        summary.itemsScanned,
                        incompleteSlices
                    );
                    logMsg(
                        'warn',
                        `[FastScanner] 扫描未完整（${incompleteSlices} 个分片失败已保留断点）：扫描 ${summary.itemsScanned}，新领 ${summary.claimedDirect}，本地已领跳过 ${summary.skippedLocal}，服务端已拥有 ${summary.confirmedOwnedServer}，非免费跳过 ${summary.skippedNonFree}，失败列表跳过 ${summary.skippedFailed}，转后台队列 ${summary.queuedFallback}，领取失败 ${summary.failed}`
                    );
                    onToast(toastMsg, true);
                } else {
                    currentPhase = 'completed';
                    if (currentMode !== 'incremental') {
                        await clearCheckpoint();
                    }
                    const summary = buildSnapshot();
                    const toastMsg = earlyStopped
                        ? getUtils().getText('toast_fast_scan_early_stop', summary.claimedDirect, summary.itemsScanned)
                        : getUtils().getText('toast_fast_scan_completed', summary.claimedDirect, summary.itemsScanned);
                    logMsg(
                        'info',
                        `[FastScanner] ${toastMsg}（明细：本地跳过 ${summary.skippedLocal}，服务端已拥有 ${summary.confirmedOwnedServer}，非免费跳过 ${summary.skippedNonFree}，失败列表跳过 ${summary.skippedFailed}，转后台队列 ${summary.queuedFallback}，领取失败 ${summary.failed}）`
                    );
                    onToast(toastMsg, true);
                }

                syncStatus(true);
                return buildSnapshot();
            } catch (err) {
                currentStats.finishedAt = nowFn();
                currentPhase = 'error';
                logMsg('error', `[FastScanner] 扫描异常: ${err.message}`);
                await db.flushSaveDone();
                await saveCheckpoint(true);
                syncStatus(true);
                throw err;
            } finally {
                running = false;
                activeRunPromise = null;
                syncStatus(true);
            }
        };

        activeRunPromise = runWork();
        return activeRunPromise;
    };

    const stop = async () => {
        if (!running && !activeRunPromise) return;
        stopped = true;
        currentPhase = 'paused';
        wakeClaimWorkers();
        wakeWorkerSlots();
        syncStatus(true);
        // 同步先触发一次落盘保存（供 beforeunload 等不等待异步完成的调用方保底）
        saveCheckpoint(true);
        getDatabase().flushSaveDone();
        if (activeRunPromise) {
            try { await activeRunPromise; } catch (_e) { /* ignore */ }
        }
        await getDatabase().flushSaveDone();
        await saveCheckpoint(true);
    };

    const setConcurrency = (count) => {
        const cfg = getConfig();
        const safe = Math.max(1, Math.min(cfg.MAX_API_SCAN_CONCURRENCY || 6, Math.floor(Number(count) || 4)));
        configuredConcurrency = safe;
        activeConcurrency = Math.min(activeConcurrency, safe) || safe;
        if (currentMode !== 'incremental') {
            activeConcurrency = safe;
        }
        wakeWorkerSlots();
        syncStatus(true);
        return safe;
    };

    const configure = (nextDeps = {}) => {
        if (typeof nextDeps.onUiUpdate === 'function') onUiUpdate = nextDeps.onUiUpdate;
        if (typeof nextDeps.onToast === 'function') onToast = nextDeps.onToast;
        if (typeof nextDeps.onAuthFailure === 'function') onAuthFailure = nextDeps.onAuthFailure;
        if (typeof nextDeps.enqueueWorkerFallback === 'function') enqueueFallbackFn = nextDeps.enqueueWorkerFallback;
    };

    return {
        configure,
        start,
        stop,
        clearCheckpoint,
        setConcurrency,
        isRunning: () => running,
        getStatus: () => buildSnapshot()
    };
};

export const FastScanner = createFastScanner();
