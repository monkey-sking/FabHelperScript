import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../src/config.js';
import { State } from '../src/state.js';
import { Database } from '../src/modules/database.js';
import { DataCache } from '../src/modules/data-cache.js';
import { Utils } from '../src/modules/utils.js';
import { ApiClaim, CLAIM_RESULT, FAB_CLAIM_ENDPOINT } from '../src/modules/claim-strategy.js';
import { TaskRunner } from '../src/modules/task-runner.js';
import {
    extractSearchParamsFromUrl,
    buildQueryKey,
    encodeTimeCursor,
    decodeTimeCursorMs,
    buildTimeSlices,
    createFastScanner
} from '../src/modules/fast-scanner.js';

const mkItem = (idx, tsMs, opts = {}) => {
    const uid = opts.uid || `00000000-0000-4000-8000-${String(idx).padStart(12, '0')}`;
    const offerId = opts.offerId !== undefined ? opts.offerId : `offer_${idx}`;
    return {
        uid,
        title: opts.title || `Asset ${idx}`,
        isFree: opts.isFree !== undefined ? opts.isFree : true,
        isDiscounted: false,
        listingType: opts.listingType || '3d-model',
        publishedAt: new Date(tsMs).toISOString(),
        _firstPublishedAtMs: tsMs,
        startingPrice: {
            price: opts.price !== undefined ? opts.price : 0,
            discountedPrice: null,
            effectiveDiscountPercentage: null,
            currencyCode: 'USD',
            offerId
        },
        licenses: offerId ? [{ name: 'Personal', isCc0: false, offerId, uid: `lic_${idx}` }] : []
    };
};

const setupMockServer = (itemsDesc, ownedSet = new Set()) => {
    // itemsDesc is sorted descending by _firstPublishedAtMs
    const itemsAsc = [...itemsDesc].reverse();
    const requestLog = { searchUrls: [], stateBatches: [], searchPages: 0 };

    const fetchImpl = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/users/me/listings-states') {
            const ids = u.searchParams.getAll('listing_ids');
            assert.ok(ids.length <= 24, `listings-states batch exceeded 24: ${ids.length}`);
            requestLog.stateBatches.push(ids);
            const payload = ids.map((uid) => ({ uid, acquired: ownedSet.has(uid) }));
            return { status: 200, responseText: JSON.stringify(payload) };
        }

        if (u.pathname === '/i/listings/search') {
            requestLog.searchUrls.push(url);
            if (u.searchParams.get('aggregate_on') === 'listing_type' || u.searchParams.get('count') === '0') {
                const buckets = {};
                itemsDesc.forEach((it) => {
                    buckets[it.listingType] = buckets[it.listingType] || { docCount: 0 };
                    buckets[it.listingType].docCount += 1;
                });
                return {
                    status: 200,
                    responseText: JSON.stringify({
                        aggregations: { listingType: { buckets } },
                        results: []
                    })
                };
            }

            requestLog.searchPages += 1;
            const sortBy = u.searchParams.get('sort_by') || '-firstPublishedAt';
            const typeFilter = u.searchParams.get('listing_types');
            const cursor = u.searchParams.get('cursor');

            let source = sortBy === 'firstPublishedAt' ? itemsAsc : itemsDesc;
            if (typeFilter) {
                source = source.filter((it) => it.listingType === typeFilter);
            }
            if (u.searchParams.get('is_discounted') === '1') {
                source = source.filter((it) => Boolean(it.isDiscounted));
            }

            let startIdx = 0;
            if (cursor) {
                const cursorMs = decodeTimeCursorMs(cursor);
                if (cursorMs != null) {
                    if (sortBy === '-firstPublishedAt') {
                        // Match Fab cursor: items strictly older or equal boundary from cursor
                        const found = source.findIndex((it) => it._firstPublishedAtMs <= cursorMs);
                        startIdx = found === -1 ? source.length : found;
                    } else {
                        const found = source.findIndex((it) => it._firstPublishedAtMs >= cursorMs);
                        startIdx = found === -1 ? source.length : found;
                    }
                } else {
                    startIdx = Number(cursor) || 0;
                }
            }

            const pageSize = 24;
            const slice = source.slice(startIdx, startIdx + pageSize);
            let nextCursor = null;
            if (startIdx + pageSize < source.length) {
                const lastItem = slice[slice.length - 1];
                // Step by 1ms when next item differs, or keep timestamp on tie to test 1s overlap safety
                const nextItem = source[startIdx + pageSize];
                if (sortBy === '-firstPublishedAt' || sortBy === 'firstPublishedAt') {
                    nextCursor = encodeTimeCursor(nextItem._firstPublishedAtMs);
                } else {
                    nextCursor = String(startIdx + pageSize);
                }
                void lastItem;
            }

            return {
                status: 200,
                responseText: JSON.stringify({
                    cursors: { next: nextCursor, previous: null },
                    results: slice
                })
            };
        }

        return { status: 404, responseText: '{}' };
    };

    return { fetchImpl, requestLog };
};

const setupMemoryDb = (t, initialDone = []) => {
    const prevDone = State.db.done;
    const prevTodo = State.db.todo;
    const prevFailed = State.db.failed;
    const prevDoneRef = Database._doneRef;
    const prevNormRef = Database._normalizedRef;
    const prevSet = Database.doneSet;
    const prevSessionCompleted = State.sessionCompleted;

    const saveCalls = { done: 0, todo: 0, failed: 0 };
    t.mock.method(Utils, 'logger', () => {});
    t.mock.method(Database, 'saveDone', async () => { saveCalls.done += 1; });
    t.mock.method(Database, 'saveTodo', async () => { saveCalls.todo += 1; });
    t.mock.method(Database, 'saveFailed', async () => { saveCalls.failed += 1; });

    State.db.done = [...initialDone];
    State.db.todo = [];
    State.db.failed = [];
    State.sessionCompleted = new Set();
    Database.normalizeDoneList();
    DataCache.ownedStatus.clear();

    t.after(() => {
        if (Database._saveDoneTimer) {
            clearTimeout(Database._saveDoneTimer);
            Database._saveDoneTimer = null;
        }
        Database._saveDoneDirty = false;
        State.db.done = prevDone;
        State.db.todo = prevTodo;
        State.db.failed = prevFailed;
        Database._doneRef = prevDoneRef;
        Database._normalizedRef = prevNormRef;
        Database.doneSet = prevSet;
        State.sessionCompleted = prevSessionCompleted;
    });

    return { saveCalls };
};

test('Database.addDoneUrl and addDoneUrls run in O(1) at 50k items and handle debounced flush', async (t) => {
    const initial = Array.from({ length: 50000 }, (_, i) => `https://www.fab.com/listings/seed-${i}`);
    const { saveCalls } = setupMemoryDb(t, initial);

    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
        assert.equal(Database.addDoneUrl(`https://www.fab.com/zh-cn/listings/new-${i}?ref=test`), true);
    }
    const batchRes = Database.addDoneUrls(
        Array.from({ length: 100 }, (_, i) => `https://www.fab.com/listings/batch-${i}`)
    );
    const elapsedMs = performance.now() - t0;

    assert.equal(batchRes.added, 100);
    assert.equal(State.db.done.length, 50200);
    assert.equal(Database._doneRef, State.db.done);
    assert.equal(Database._normalizedRef, State.db.done);
    assert.equal(Database.isDone('https://www.fab.com/listings/new-55'), true);
    assert.equal(Database.isDone('https://www.fab.com/listings/batch-99'), true);
    assert.ok(elapsedMs < 150, `Expected 200 inserts on 50k items to take <150ms, took ${elapsedMs.toFixed(1)}ms`);

    // Debounced persistence
    await Database.markAsDone({ uid: 'debounced-1', url: 'https://www.fab.com/listings/debounced-1' }, { deferSave: true });
    assert.equal(saveCalls.done, 0, 'deferSave=true must not synchronously trigger saveDone');
    assert.equal(Database._saveDoneDirty, true);
    await Database.flushSaveDone();
    assert.equal(saveCalls.done, 1, 'flushSaveDone must persist dirty done list');
    assert.equal(Database._saveDoneDirty, false);
});

test('extractSearchParamsFromUrl, cursor codec, and buildTimeSlices work accurately', () => {
    const params = extractSearchParamsFromUrl(
        'https://www.fab.com/search?lang=zh-cn&is_free=1&sort_by=-firstPublishedAt&cursor=abc&listing_types=3d-model'
    );
    assert.deepEqual(params, {
        is_free: '1',
        sort_by: '-firstPublishedAt',
        listing_types: '3d-model'
    });
    assert.equal(buildQueryKey(params), 'is_free=1&listing_types=3d-model&sort_by=-firstPublishedAt');
    assert.deepEqual(extractSearchParamsFromUrl('https://www.fab.com/search?lang=zh-cn'), {
        is_free: '1',
        sort_by: '-firstPublishedAt'
    });

    const iso = '2026-11-23T11:24:02.115+00:00';
    const encoded = encodeTimeCursor(iso);
    const decodedMs = decodeTimeCursorMs(encoded);
    assert.equal(decodedMs, Date.parse(iso));
    assert.equal(decodeTimeCursorMs(Buffer.from('o=0&p=not-a-date', 'utf8').toString('base64')), null);

    const newest = Date.parse('2026-11-24T00:00:00.000Z');
    const oldest = Date.parse('2020-01-01T00:00:00.000Z');
    const slices = buildTimeSlices(newest, oldest, 4, encoded);
    assert.ok(slices.length >= 12);
    assert.equal(slices[0].cursor, encoded);
    assert.equal(slices[slices.length - 1].lowerMs, null);
    for (let i = 1; i < slices.length; i++) {
        assert.ok(slices[i].upperMs < slices[i - 1].upperMs);
    }
});

test('multi-shard time-cursor full scan covers all items including boundary ties with 0 misses and 0 duplicate claims', async (t) => {
    // 130 items across 30 days with deliberate same-timestamp ties in the middle
    const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
    const itemsDesc = [];
    for (let i = 0; i < 130; i++) {
        const tieGroup = Math.floor(i / 5) * 5; // groups of 5 share identical timestamp
        const tsMs = baseMs + (130 - tieGroup) * 6 * 3600 * 1000;
        itemsDesc.push(mkItem(i, tsMs));
    }

    // Mark first 60 as locally done, next 30 as server-owned, leaving 40 unowned
    const localDoneUrls = itemsDesc.slice(0, 60).map((it) => `https://www.fab.com/listings/${it.uid}`);
    setupMemoryDb(t, localDoneUrls);

    const serverOwnedSet = new Set(itemsDesc.slice(60, 90).map((it) => it.uid));
    const expectedToClaim = new Set(itemsDesc.slice(90).map((it) => it.uid));
    const { fetchImpl, requestLog } = setupMockServer(itemsDesc, serverOwnedSet);

    const claimed = [];
    const mockApiClaim = {
        isAvailable: () => true,
        claim: async (task) => {
            claimed.push(task.uid);
            return { result: CLAIM_RESULT.SUCCESS, strategy: 'api' };
        }
    };

    const gmStore = new Map();
    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: mockApiClaim,
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        rateLimitBaseBackoffMs: 10,
        getHref: () => 'https://www.fab.com/search?lang=zh-cn&is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });

    const summary = await scanner.start({ concurrency: 4 });
    assert.equal(summary.mode, 'time-shards');
    assert.equal(summary.itemsScanned, 130);
    assert.equal(summary.skippedLocal, 60);
    assert.equal(summary.confirmedOwnedServer, 30);
    assert.equal(summary.claimedDirect, 40);
    assert.equal(claimed.length, 40, 'No duplicate claims allowed across boundary overlaps');
    assert.deepEqual(new Set(claimed), expectedToClaim);

    // Verify local-done items were never sent to /listings-states and batches never exceeded 24
    const allCheckedUids = requestLog.stateBatches.flat();
    assert.equal(allCheckedUids.length, 70);
    assert.ok(allCheckedUids.every((uid) => !itemsDesc.slice(0, 60).some((d) => d.uid === uid)));
    assert.equal(gmStore.has(Config.DB_KEYS.FAST_SCAN_CHECKPOINT), false, 'Completed full scan clears checkpoint');
});

test('non-time-desc sort falls back to listing_types sharding when concurrency > 1 and excludes bundle', async (t) => {
    const baseMs = Date.parse('2026-05-01T00:00:00.000Z');
    const items = [
        ...Array.from({ length: 30 }, (_, i) => mkItem(i, baseMs + i * 1000, { listingType: '3d-model' })),
        ...Array.from({ length: 15 }, (_, i) => mkItem(100 + i, baseMs + i * 1000, { listingType: 'material' })),
        mkItem(999, baseMs + 20000, { listingType: 'bundle' })
    ];
    setupMemoryDb(t);

    const { fetchImpl, requestLog } = setupMockServer(items, new Set());
    const wrappedFetch = async (url) => {
        if (url.includes('listing_types=bundle')) {
            return { status: 400, responseText: '{"detail":"Invalid listing_types"}' };
        }
        return fetchImpl(url);
    };
    const claimed = [];
    const scanner = createFastScanner({
        fetchImpl: wrappedFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=title',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 4, preserveSort: true });
    assert.equal(summary.mode, 'type-shards');
    assert.equal(summary.itemsScanned, 45);
    assert.equal(summary.claimedDirect, 45);
    assert.equal(claimed.length, 45);
    assert.ok(requestLog.searchUrls.some((u) => u.includes('listing_types=3d-model')));
    assert.ok(requestLog.searchUrls.some((u) => u.includes('listing_types=material')));
    assert.ok(!requestLog.searchUrls.some((u) => u.includes('listing_types=bundle')));
});

test('direct main-tab ApiClaim uses offerId fast path (1 POST), routes bundles & retryables to fallback, and stops on 401', async (t) => {
    const baseMs = Date.parse('2026-08-01T00:00:00.000Z');
    const items = [
        mkItem(1, baseMs + 4000, { listingType: '3d-model', offerId: 'fast_offer_1' }),
        mkItem(2, baseMs + 3000, { listingType: 'bundle', offerId: 'bundle_offer_2' }),
        mkItem(3, baseMs + 2000, { listingType: '3d-model', offerId: 'retry_offer_3' }),
        mkItem(4, baseMs + 1000, { listingType: '3d-model', offerId: 'perm_fail_4' })
    ];
    setupMemoryDb(t);

    const { fetchImpl } = setupMockServer(items, new Set());
    const postCalls = [];
    const fallbackTasks = [];

    const prevEndpoint = ApiClaim.endpoint;
    const prevFetch = ApiClaim.fetchImpl;
    const prevCookie = globalThis.document?.cookie;
    const hadDoc = 'document' in globalThis;
    if (!hadDoc) globalThis.document = { cookie: 'fab_csrftoken=csrf_123' };
    else if (globalThis.document) globalThis.document.cookie = 'fab_csrftoken=csrf_123';

    ApiClaim.configure({
        endpoint: FAB_CLAIM_ENDPOINT,
        fetchImpl: async ({ method, url }) => {
            postCalls.push({ method, url });
            if (url.includes(items[0].uid)) return { status: 204, responseText: '' };
            if (url.includes(items[2].uid)) return { status: 500, responseText: 'server error' };
            if (url.includes(items[3].uid)) return { status: 400, responseText: 'bad request' };
            return { status: 404, responseText: '' };
        }
    });

    t.after(() => {
        ApiClaim.endpoint = prevEndpoint;
        ApiClaim.fetchImpl = prevFetch;
        if (!hadDoc) delete globalThis.document;
        else if (globalThis.document) globalThis.document.cookie = prevCookie;
    });

    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: ApiClaim,
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        claimWorkers: 1,
        enqueueWorkerFallback: async (task) => { fallbackTasks.push(task); },
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 1 });
    assert.equal(summary.claimedDirect, 1);
    assert.equal(summary.queuedFallback, 2); // bundle item + 500 retryable item
    assert.equal(summary.failed, 1); // 400 terminal failure
    assert.equal(postCalls.every((c) => c.method === 'POST'), true, 'Fast path must skip GET detail requests');
    assert.deepEqual(fallbackTasks.map((x) => x.uid).sort(), [items[1].uid, items[2].uid].sort());

    // 401 stop verification
    let authNotified = 0;
    const scanner401 = createFastScanner({
        fetchImpl: async () => ({ status: 401, responseText: '{"detail":"Unauthorized"}' }),
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        onAuthFailure: () => { authNotified += 1; },
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });
    const res401 = await scanner401.start({ concurrency: 2 });
    assert.equal(authNotified >= 1, true);
    assert.equal(res401.phase, 'error');
});

test('incremental early stop runs 1 stream, resets streak on unowned item, and stops after N consecutive owned pages', async (t) => {
    // 8 pages (192 items):
    // Page 0: all owned -> streak 1
    // Page 1: 1 unowned -> resets streak to 0!
    // Page 2 & Page 3: all owned -> streak 2 -> early stop! Pages 4..7 never fetched!
    const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
    const itemsDesc = Array.from({ length: 192 }, (_, i) => mkItem(i, baseMs + (192 - i) * 1000));
    const localDone = itemsDesc
        .filter((_, idx) => idx !== 30) // item #30 (on page 1) is unowned
        .map((it) => `https://www.fab.com/listings/${it.uid}`);
    setupMemoryDb(t, localDone);

    const { fetchImpl, requestLog } = setupMockServer(itemsDesc, new Set());
    const claimed = [];

    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({
        concurrency: 4,
        incrementalEarlyStop: true,
        incrementalStopPages: 2
    });

    assert.equal(summary.mode, 'incremental');
    assert.equal(summary.earlyStopped, true);
    assert.equal(summary.pagesFetched, 4); // pages 0, 1, 2, 3
    assert.equal(requestLog.searchPages, 4);
    assert.deepEqual(claimed, [itemsDesc[30].uid]);
});

test('429 rate limit pauses globally, downshifts concurrency, and retries exact cursor', async (t) => {
    const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
    const itemsDesc = Array.from({ length: 72 }, (_, i) => mkItem(i, baseMs + (72 - i) * 60_000));
    setupMemoryDb(t);

    const { fetchImpl: baseFetch } = setupMockServer(itemsDesc, new Set());
    let injected429 = false;
    let fakeNow = 1000;
    const searchAttemptsForPage = new Map();

    const wrappedFetch = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/listings/search' && u.searchParams.get('cursor')) {
            const key = u.searchParams.get('cursor');
            const seen = (searchAttemptsForPage.get(key) || 0) + 1;
            searchAttemptsForPage.set(key, seen);
            if (!injected429) {
                injected429 = true;
                return {
                    status: 429,
                    responseText: '{"detail":"Throttled"}',
                    getResponseHeader: (h) => (h.toLowerCase() === 'retry-after' ? '1' : null)
                };
            }
        }
        return baseFetch(url);
    };

    const scanner = createFastScanner({
        fetchImpl: wrappedFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async () => ({ result: CLAIM_RESULT.SUCCESS })
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        now: () => fakeNow,
        sleep: async (ms) => { fakeNow += ms; },
        claimIntervalMs: 0,
        rateLimitBaseBackoffMs: 500,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 4 });
    assert.equal(injected429, true);
    assert.equal(summary.activeConcurrency, 3, 'Concurrency must downshift from 4 to 3 on 429');
    assert.equal(summary.itemsScanned, 72, 'Exact cursor must be retried so zero items are skipped');
    assert.equal(summary.claimedDirect, 72);
});

test('checkpoint saves on stop, resumes remaining slices on matching query, and ignores mismatched query', async (t) => {
    const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
    const itemsDesc = Array.from({ length: 120 }, (_, i) => mkItem(i, baseMs + (120 - i) * 3600 * 1000));
    setupMemoryDb(t);

    const { fetchImpl } = setupMockServer(itemsDesc, new Set());
    const gmStore = new Map();
    const claimed = [];
    let pagesBeforeStop = 0;

    let scannerRef = null;
    const stopAfterTwoPagesFetch = async (url) => {
        const res = await fetchImpl(url);
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/listings/search' && u.searchParams.get('count') !== '0') {
            pagesBeforeStop += 1;
            if (pagesBeforeStop >= 3 && scannerRef) {
                scannerRef.stop();
            }
        }
        return res;
    };

    const scanner1 = createFastScanner({
        fetchImpl: stopAfterTwoPagesFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });
    scannerRef = scanner1;

    const pausedSummary = await scanner1.start({ concurrency: 1 });
    assert.equal(pausedSummary.phase, 'paused');
    const cp = gmStore.get(Config.DB_KEYS.FAST_SCAN_CHECKPOINT);
    assert.ok(cp, 'Checkpoint must be persisted on stop');
    assert.equal(cp.slices.some((s) => !s.done), true);

    // Resume on matching query
    let aggCalls = 0;
    const resumeFetch = async (url) => {
        if (url.includes('aggregate_on=')) aggCalls += 1;
        return fetchImpl(url);
    };
    const scanner2 = createFastScanner({
        fetchImpl: resumeFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });
    const resumedSummary = await scanner2.start({ concurrency: 1 });
    assert.equal(aggCalls, 0, 'Resuming from matching checkpoint should skip recalibration aggregate query');
    assert.equal(resumedSummary.phase, 'completed');
    assert.equal(new Set(claimed).size, 120, 'Resumed scan must claim every remaining item');
    assert.equal(gmStore.has(Config.DB_KEYS.FAST_SCAN_CHECKPOINT), false);

    // Mismatched query invalidates old checkpoint
    gmStore.set(Config.DB_KEYS.FAST_SCAN_CHECKPOINT, {
        version: 1,
        queryKey: 'is_free=1&listing_types=audio&sort_by=-firstPublishedAt',
        mode: 'sequential',
        slices: [{ id: 'stale', cursor: 'stale_cursor', done: false }],
        stats: { itemsScanned: 999 }
    });
    let sawStaleCursor = false;
    const mismatchFetch = async (url) => {
        if (url.includes('stale_cursor')) sawStaleCursor = true;
        return fetchImpl(url);
    };
    setupMemoryDb(t);
    const scanner3 = createFastScanner({
        fetchImpl: mismatchFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async () => ({ result: CLAIM_RESULT.SUCCESS })
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });
    await scanner3.start({ concurrency: 1 });
    assert.equal(sawStaleCursor, false, 'Mismatched query checkpoint must not be resumed');
});

test('legacy scanAndAddTasks enriches queued tasks with cached offerId and TaskRunner clamps fast scan settings', async (t) => {
    const prevWindow = globalThis.window;
    globalThis.window = {};
    t.after(() => { globalThis.window = prevWindow; });

    let clock = 0;
    t.mock.method(Date, 'now', () => (clock += 3000));
    t.mock.method(globalThis, 'setInterval', (cb) => { cb(); return 1; });
    t.mock.method(globalThis, 'clearInterval', () => {});
    t.mock.method(Utils, 'logger', () => {});
    t.mock.method(Database, 'saveTodo', () => {});
    t.mock.method(TaskRunner, 'startExecution', () => {});
    t.mock.method(Database, '_safeSet', async () => {});

    State.autoAddOnScroll = true;
    State.isAuthenticated = true;
    State.isScanningTasks = false;
    State.isExecuting = false;
    State.autoAddRetryTimer = null;
    State.db = { todo: [], done: [], failed: [] };
    DataCache.listings.clear();

    const uid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    DataCache.saveListings([{
        uid,
        listingType: '3d-model',
        startingPrice: { price: 0, offerId: 'cached_offer_xyz' }
    }]);

    const card = {
        textContent: 'Cached Asset Free',
        querySelector: (sel) => sel.includes('cardLink') || sel.includes('listings')
            ? { href: `https://www.fab.com/listings/${uid}`, textContent: 'Cached Asset' }
            : null,
        querySelectorAll: () => []
    };
    await TaskRunner.scanAndAddTasks([card]);
    assert.equal(State.db.todo.length, 1);
    assert.equal(State.db.todo[0].offerId, 'cached_offer_xyz');
    assert.equal(State.db.todo[0].listingType, '3d-model');

    assert.equal(await TaskRunner.setApiScanConcurrency(99), Config.MAX_API_SCAN_CONCURRENCY);
    assert.equal(await TaskRunner.setApiScanConcurrency(0), 1);

    // When domFallbackMode is false (default fast API), DOM scroll scanning must not queue items even if autoAddOnScroll is true
    const prevFastApi = State.fastApiScan;
    const prevFallback = State.domFallbackMode;
    const prevAutoScroll = State.autoScroll;
    await TaskRunner.setDomFallbackMode(false);
    State.db.todo = [];
    t.after(() => {
        State.fastApiScan = prevFastApi;
        State.domFallbackMode = prevFallback;
        State.autoScroll = prevAutoScroll;
    });
    await TaskRunner.scanAndAddTasks([card]);
    assert.equal(State.db.todo.length, 0);
});

test('incrementalEarlyStop auto-enforces -firstPublishedAt while keeping existing search filters', async (t) => {
    setupMemoryDb(t);
    const seenSearchUrls = [];
    const baseMs = Date.UTC(2026, 0, 10);
    const page0 = Array.from({ length: 24 }, (_, i) => mkItem(i, baseMs - i * 1000));
    const page1 = Array.from({ length: 24 }, (_, i) => mkItem(100 + i, baseMs - (100 + i) * 1000));
    page0.forEach((item) => Database.addDoneUrl(`https://www.fab.com/listings/${item.uid}`));
    page1.forEach((item) => Database.addDoneUrl(`https://www.fab.com/listings/${item.uid}`));

    const scanner = createFastScanner({
        fetchImpl: async (url) => {
            if (url.includes('aggregate_on=')) {
                return { status: 200, responseText: JSON.stringify({ aggregations: { listingType: { buckets: { '3d-model': { docCount: 48 } } } } }) };
            }
            seenSearchUrls.push(url);
            if (url.includes('cursor=p1')) {
                return { status: 200, responseText: JSON.stringify({ results: page1, cursors: { next: 'p2' } }) };
            }
            return { status: 200, responseText: JSON.stringify({ results: page0, cursors: { next: 'p1' } }) };
        },
        apiClaim: { isAvailable: () => true, claim: async () => ({ result: CLAIM_RESULT.SUCCESS }) },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&listing_types=3d-model&sort_by=relevance',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 4, incrementalEarlyStop: true, incrementalStopPages: 2 });
    assert.equal(summary.mode, 'incremental');
    assert.equal(summary.earlyStopped, true);
    assert.ok(seenSearchUrls.length >= 2);
    seenSearchUrls.forEach((u) => {
        const parsed = new URL(u);
        assert.equal(parsed.searchParams.get('sort_by'), '-firstPublishedAt');
        assert.equal(parsed.searchParams.get('is_free'), '1');
        assert.equal(parsed.searchParams.get('listing_types'), '3d-model');
    });
});

test('FastScanner fast-fails on Fab 500 Internal error after trying alternate offer and skips worker fallback', async (t) => {
    setupMemoryDb(t);

    const baseMs = Date.UTC(2026, 0, 10);
    const itemBroken = mkItem(1, baseMs, { offerId: 'offer-broken-personal' });
    const itemRecoverable = mkItem(2, baseMs - 1000, { offerId: 'offer-bad-search' });

    const prevEndpoint = ApiClaim.endpoint;
    const prevFetch = ApiClaim.fetchImpl;
    const prevCookie = globalThis.document?.cookie;
    const hadDoc = 'document' in globalThis;
    if (!hadDoc) globalThis.document = { cookie: 'fab_csrftoken=csrf_123' };
    else if (globalThis.document) globalThis.document.cookie = 'fab_csrftoken=csrf_123';

    t.after(() => {
        ApiClaim.endpoint = prevEndpoint;
        ApiClaim.fetchImpl = prevFetch;
        if (!hadDoc) delete globalThis.document;
        else if (globalThis.document) globalThis.document.cookie = prevCookie;
    });

    const fallbackTasks = [];
    let recoverAttempts = 0;
    ApiClaim.configure({
        endpoint: FAB_CLAIM_ENDPOINT,
        fetchImpl: async ({ method, url, data }) => {
            if (method === 'GET') {
                if (url.includes(itemBroken.uid)) {
                    return {
                        status: 200,
                        responseText: JSON.stringify({
                            uid: itemBroken.uid,
                            listingType: '3d-model',
                            licenses: [
                                { slug: 'personal', offerId: 'offer-broken-personal', priceTier: { price: 0 } },
                                { slug: 'professional', offerId: 'offer-broken-pro', priceTier: { price: 0 } }
                            ]
                        })
                    };
                }
                return {
                    status: 200,
                    responseText: JSON.stringify({
                        uid: itemRecoverable.uid,
                        listingType: '3d-model',
                        licenses: [
                            { slug: 'professional', offerId: 'offer-good-pro', priceTier: { price: 0 } }
                        ]
                    })
                };
            }
            if (url.includes(itemBroken.uid)) {
                return { status: 500, responseText: '{"detail":"Internal error"}' };
            }
            if (url.includes(itemRecoverable.uid)) {
                recoverAttempts += 1;
                if (String(data).includes('offer-good-pro')) {
                    return { status: 204, responseText: '' };
                }
                return { status: 500, responseText: '{"detail":"Internal error"}' };
            }
            return { status: 204, responseText: '' };
        }
    });

    const scanner = createFastScanner({
        fetchImpl: async (url) => {
            if (url.includes('aggregate_on=')) {
                return { status: 200, responseText: JSON.stringify({ aggregations: { listingType: { buckets: { '3d-model': { docCount: 2 } } } } }) };
            }
            if (url.includes('/i/users/me/listings-states')) {
                return {
                    status: 200,
                    responseText: JSON.stringify([
                        { uid: itemBroken.uid, acquired: false },
                        { uid: itemRecoverable.uid, acquired: false }
                    ])
                };
            }
            return { status: 200, responseText: JSON.stringify({ results: [itemBroken, itemRecoverable], cursors: { next: null } }) };
        },
        apiClaim: ApiClaim,
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        claimWorkers: 1,
        enqueueWorkerFallback: async (task) => { fallbackTasks.push(task); },
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 1 });
    assert.equal(fallbackTasks.length, 0, '500 Internal error must not spawn worker tabs');
    assert.equal(recoverAttempts, 2, 'Search offer 500 retries alternate offer from detail JSON once');
    assert.equal(summary.claimedDirect, 1);
    assert.equal(summary.failed, 1);
    assert.equal(State.db.todo.length, 0);
    assert.equal(State.db.failed.length, 1);
    assert.match(State.db.failed[0].failureReason, /500 Internal error/);
    assert.equal(Database.getMaxRetry('Fab 服务端内部错误 (500 Internal error)，官网按钮亦无法入库'), 0);
    assert.equal(Database.getMaxRetry('Fab 服务端返回错误提示，无法入库: Ooops an error occurred'), 0);
});

test('stale checkpoint resume prepends head catch-up slice and claims newly published items without re-aggregating', async (t) => {
    const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
    const oldItemsDesc = Array.from({ length: 96 }, (_, i) => mkItem(i, baseMs + (96 - i) * 3600 * 1000));
    setupMemoryDb(t);

    let activeItemsDesc = oldItemsDesc;
    const gmStore = new Map();
    const claimed = [];
    let pagesBeforeStop = 0;
    let scannerRef = null;
    let aggCalls = 0;

    const dynamicFetch = async (url) => {
        if (url.includes('aggregate_on=')) aggCalls += 1;
        const { fetchImpl } = setupMockServer(activeItemsDesc, new Set());
        const res = await fetchImpl(url);
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/listings/search' && u.searchParams.get('count') !== '0' && scannerRef && pagesBeforeStop !== -1) {
            pagesBeforeStop += 1;
            if (pagesBeforeStop >= 2) {
                pagesBeforeStop = -1;
                scannerRef.stop();
            }
        }
        return res;
    };

    const scanner1 = createFastScanner({
        fetchImpl: dynamicFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });
    scannerRef = scanner1;
    const paused = await scanner1.start({ concurrency: 1 });
    assert.equal(paused.phase, 'paused');

    // Prepend 30 brand-new items published strictly after the checkpoint head
    const newItemsDesc = Array.from({ length: 30 }, (_, i) =>
        mkItem(1000 + i, baseMs + (200 - i) * 3600 * 1000)
    );
    activeItemsDesc = [...newItemsDesc, ...oldItemsDesc];
    aggCalls = 0;
    scannerRef = null;

    const scanner2 = createFastScanner({
        fetchImpl: dynamicFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });
    const resumed = await scanner2.start({ concurrency: 2 });
    assert.equal(aggCalls, 0, 'Resume must not repeat aggregate query');
    assert.equal(resumed.phase, 'completed');
    assert.equal(resumed.resumedFromCheckpoint, true);
    const uniqueClaimed = new Set(claimed);
    assert.equal(uniqueClaimed.size, 126, 'Must claim all 30 new items plus all 96 original items');
    assert.ok(newItemsDesc.every((it) => uniqueClaimed.has(it.uid)));
});

test('Full scan auto-enforces is_free=1 and sort_by=-firstPublishedAt to use time-shards on default Chrome URLs', async (t) => {
    const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
    const itemsDesc = Array.from({ length: 70 }, (_, i) => mkItem(i, baseMs + (70 - i) * 30 * 86400 * 1000));
    setupMemoryDb(t);

    for (const href of [
        'https://www.fab.com/search?is_free=1',
        'https://www.fab.com/search?sort_by=-firstPublishedAt'
    ]) {
        const { fetchImpl, requestLog } = setupMockServer(itemsDesc, new Set());
        const claimed = [];
        const scanner = createFastScanner({
            fetchImpl,
            apiClaim: {
                isAvailable: () => true,
                claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
            },
            database: Database,
            dataCache: DataCache,
            state: State,
            config: Config,
            utils: Utils,
            sleep: async () => {},
            claimIntervalMs: 0,
            getHref: () => href,
            getHeaders: () => ({}),
            gmGetValue: async (_, def) => def,
            gmSetValue: async () => {},
            gmDeleteValue: async () => {}
        });
        // Reset local done between runs
        State.db.done = [];
        Database.normalizeDoneList();

        const summary = await scanner.start({ concurrency: 4 });
        assert.equal(summary.mode, 'time-shards', `Expected time-shards for ${href}`);
        assert.equal(summary.claimedDirect, 70);
        assert.ok(requestLog.searchUrls.every((u) => {
            const sp = new URL(u, 'https://www.fab.com').searchParams;
            const sort = sp.get('sort_by');
            return sp.get('is_free') === '1' && (sort === '-firstPublishedAt' || sort === 'firstPublishedAt');
        }));
        assert.equal(
            requestLog.searchUrls.filter((u) => new URL(u, 'https://www.fab.com').searchParams.get('sort_by') === 'firstPublishedAt').length,
            1,
            'Only the single asc calibration request uses firstPublishedAt'
        );
    }
});

test('100%-off discounted items missing discountedPrice in search verify via ApiClaim detail slow path without dropping or falsely failing', async (t) => {
    const baseMs = Date.parse('2026-11-24T00:00:00.000Z');
    const discFreeItem = {
        ...mkItem(1, baseMs, { isFree: false, price: 65.99, offerId: 'paid_looking_offer' }),
        isDiscounted: true
    };
    const disc50Item = {
        ...mkItem(2, baseMs - 1000, { isFree: false, price: 39.99, offerId: 'half_off_offer' }),
        isDiscounted: true
    };
    const regularPaidItem = {
        ...mkItem(3, baseMs - 2000, { isFree: false, price: 19.99, offerId: 'regular_paid_offer' }),
        isDiscounted: false
    };
    setupMemoryDb(t);

    const { fetchImpl } = setupMockServer([discFreeItem, disc50Item, regularPaidItem], new Set());
    const claimedTasks = [];
    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => {
                claimedTasks.push({ uid: task.uid, offerId: task.offerId, needsDiscountVerify: task.needsDiscountVerify });
                if (task.uid === discFreeItem.uid) {
                    return { result: CLAIM_RESULT.SUCCESS };
                }
                return { result: CLAIM_RESULT.FAILURE, reason: '未找到免费许可的 offer_id', retryable: false };
            }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        claimWorkers: 1,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 1 });
    assert.equal(claimedTasks.length, 2, 'Regular non-discounted paid item is skipped; both discounted items are verified');
    assert.equal(claimedTasks[0].offerId, '', 'Discounted verify task clears search offerId to force detail license lookup');
    assert.equal(claimedTasks[0].needsDiscountVerify, true);
    assert.equal(summary.claimedDirect, 1);
    assert.equal(summary.skippedNonFree, 2, 'Regular paid + non-100%-off discounted item both count as skippedNonFree');
    assert.equal(summary.failed, 0, 'Non-100%-off discounted item must not pollute failed list');
    assert.equal(State.db.failed.length, 0);
});

test('slice failure preserves checkpoint as phase=partial and subsequent resume finishes remaining slice', async (t) => {
    const baseMs = Date.parse('2024-01-01T00:00:00.000Z');
    const itemsDesc = Array.from({ length: 120 }, (_, i) => mkItem(i, baseMs + (120 - i) * 3 * 86400 * 1000));
    setupMemoryDb(t);

    const { fetchImpl } = setupMockServer(itemsDesc, new Set());
    const gmStore = new Map();
    const claimed = [];
    let failMiddleSlice = true;
    let targetFailedCursor = null;

    const flakyFetch = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        const cur = u.searchParams.get('cursor');
        if (failMiddleSlice && cur && u.pathname === '/i/listings/search' && u.searchParams.get('count') !== '0' && u.searchParams.get('sort_by') === '-firstPublishedAt') {
            if (!targetFailedCursor) {
                const ms = decodeTimeCursorMs(cur);
                if (ms != null && ms < baseMs + 100 * 3 * 86400 * 1000) {
                    targetFailedCursor = cur;
                }
            }
            if (cur === targetFailedCursor) {
                return { status: 502, responseText: 'Bad Gateway' };
            }
        }
        return fetchImpl(url);
    };

    const scanner1 = createFastScanner({
        fetchImpl: flakyFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        rateLimitBaseBackoffMs: 1,
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });

    const partial = await scanner1.start({ concurrency: 4 });
    assert.equal(partial.phase, 'partial');
    assert.ok(partial.incompleteSlices >= 1);
    assert.ok(partial.pageErrors >= 3);
    assert.ok('skippedNonFree' in partial && 'skippedFailed' in partial);
    const savedCp = gmStore.get(Config.DB_KEYS.FAST_SCAN_CHECKPOINT);
    assert.ok(savedCp, 'Partial run must keep checkpoint for resume');
    assert.equal(savedCp.slices.some((s) => !s.done), true);
    assert.equal(savedCp.slices.every((s) => !('failedThisRun' in s)), true);

    failMiddleSlice = false;
    const scanner2 = createFastScanner({
        fetchImpl: flakyFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });
    const completed = await scanner2.start({ concurrency: 4 });
    assert.equal(completed.phase, 'completed');
    assert.equal(completed.incompleteSlices, 0);
    assert.equal(new Set(claimed).size, 120);
    assert.equal(gmStore.has(Config.DB_KEYS.FAST_SCAN_CHECKPOINT), false);
});

test('retried markAsFailed tasks increment queuedFallback rather than failed', async (t) => {
    const baseMs = Date.parse('2026-06-01T00:00:00.000Z');
    const items = [mkItem(1, baseMs, { offerId: 'off_1' })];
    setupMemoryDb(t);
    const { fetchImpl } = setupMockServer(items, new Set());

    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: {
            isAvailable: () => true,
            claim: async () => ({ result: CLAIM_RESULT.FAILURE, reason: '请求超时 Timeout', retryable: false })
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        claimWorkers: 1,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 1 });
    assert.equal(summary.failed, 0);
    assert.equal(summary.queuedFallback, 1);
    assert.equal(State.db.todo.length, 1);
    assert.equal(State.db.failed.length, 0);
});

test('priorityItems are verified and claimed before shard pages on both fresh and resumed scans, and globalFreeScan enforces global query', async (t) => {
    const baseMs = Date.parse('2026-06-01T00:00:00.000Z');
    const items = Array.from({ length: 30 }, (_, i) => mkItem(i, baseMs - i * 86400 * 1000));
    setupMemoryDb(t);

    const visibleUid = 'aaaaaaaa-0000-4000-8000-000000000099';
    const orderLog = [];
    const { fetchImpl: baseFetchImpl, requestLog } = setupMockServer(items, new Set());
    const fetchImpl = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/users/me/listings-states') {
            orderLog.push({ type: 'states', ids: u.searchParams.getAll('listing_ids') });
        } else if (u.pathname === '/i/listings/search' && u.searchParams.get('count') !== '0') {
            orderLog.push({ type: 'search', url });
        }
        return baseFetchImpl(url);
    };

    const gmStore = new Map();
    gmStore.set(Config.DB_KEYS.FAST_SCAN_CHECKPOINT, {
        version: 1,
        queryKey: 'is_free=1&sort_by=-firstPublishedAt',
        mode: 'time-shards',
        headUpperMs: baseMs,
        totalEstimated: 30,
        slices: [{
            id: 'time-0',
            extraParams: null,
            upperMs: baseMs,
            lowerMs: null,
            cursor: null,
            done: false,
            pages: 0
        }],
        pendingUnknowns: [],
        pendingClaims: [],
        stats: { itemsScanned: 5, totalEstimated: 30 }
    });

    const claimedEvents = [];
    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => {
                orderLog.push({ type: 'claim', uid: task.uid });
                return { result: CLAIM_RESULT.SUCCESS };
            }
        },
        onItemClaimed: (item, source) => claimedEvents.push({ uid: item.uid, source }),
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        claimWorkers: 1,
        getHref: () => 'https://www.fab.com/search?q=castle&sort_by=relevance',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });

    const summary = await scanner.start({
        concurrency: 2,
        globalFreeScan: true,
        priorityItems: [{ uid: visibleUid, url: `https://www.fab.com/listings/${visibleUid}`, name: 'Visible Free', offerId: 'vis_offer' }]
    });

    assert.equal(summary.resumedFromCheckpoint, true);
    const firstSearchIdx = orderLog.findIndex((e) => e.type === 'search');
    const visClaimIdx = orderLog.findIndex((e) => e.type === 'claim' && e.uid === visibleUid);
    assert.ok(visClaimIdx !== -1, 'Priority visible item should be claimed');
    assert.ok(visClaimIdx < firstSearchIdx, 'Priority visible item must be claimed before background shard search');
    assert.ok(claimedEvents.some((e) => e.uid === visibleUid && e.source === 'claimed'));
    assert.ok(requestLog.searchUrls.every((u) => {
        const sp = new URL(u, 'https://www.fab.com').searchParams;
        return sp.get('is_free') === '1' && sp.get('q') === null;
    }), 'globalFreeScan must ignore subpage q filter');
});

test('claimVisibleItems claims visible items without touching checkpoint and triggers onItemClaimed', async (t) => {
    const uidOwned = 'bbbbbbbb-0000-4000-8000-000000000001';
    const uidFree = 'bbbbbbbb-0000-4000-8000-000000000002';
    setupMemoryDb(t);

    const gmStore = new Map();
    const claimedCallbacks = [];
    const scanner = createFastScanner({
        fetchImpl: async (url) => {
            const u = new URL(url, 'https://www.fab.com');
            if (u.pathname === '/i/users/me/listings-states') {
                const ids = u.searchParams.getAll('listing_ids');
                return {
                    status: 200,
                    responseText: JSON.stringify(ids.map((id) => ({ uid: id, acquired: id === uidOwned })))
                };
            }
            return { status: 404, responseText: '{}' };
        },
        apiClaim: {
            isAvailable: () => true,
            claim: async () => ({ result: CLAIM_RESULT.SUCCESS })
        },
        onItemClaimed: (item, source) => claimedCallbacks.push({ uid: item.uid, source }),
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });

    const res = await scanner.claimVisibleItems([
        { uid: uidOwned, url: `https://www.fab.com/listings/${uidOwned}`, name: 'Already Owned', offerId: 'off_owned' },
        { uid: uidFree, url: `https://www.fab.com/listings/${uidFree}`, name: 'Free Visible', offerId: 'off_free' }
    ]);

    assert.equal(res.owned, 1);
    assert.equal(res.claimed, 1);
    assert.equal(Database.isDone(`https://www.fab.com/listings/${uidOwned}`), true);
    assert.equal(Database.isDone(`https://www.fab.com/listings/${uidFree}`), true);
    assert.equal(gmStore.has(Config.DB_KEYS.FAST_SCAN_CHECKPOINT), false);
    assert.deepEqual(claimedCallbacks, [
        { uid: uidOwned, source: 'server-owned' },
        { uid: uidFree, source: 'claimed' }
    ]);
});

test('sparse <24 unknowns flush eagerly mid-scan without waiting for scan end, and stop({ drainDiscovered: true }) finishes buffered claims', async (t) => {
    const baseMs = Date.parse('2025-01-01T00:00:00.000Z');
    // 60 items across 60 days so multi-shard creates >=12 slices
    const itemsDesc = Array.from({ length: 60 }, (_, i) => mkItem(i, baseMs + (60 - i) * 86400 * 1000));
    // First 2 items unowned (found in calibrate desc page); rest locally done
    const localDone = itemsDesc.slice(2).map((it) => `https://www.fab.com/listings/${it.uid}`);
    setupMemoryDb(t, localDone);

    const { fetchImpl } = setupMockServer(itemsDesc, new Set());
    let releaseShardGate;
    const shardGate = new Promise((resolve) => { releaseShardGate = resolve; });
    let hitSecondaryShard = false;
    let secondaryStartedResolve;
    const secondaryStarted = new Promise((resolve) => { secondaryStartedResolve = resolve; });

    const gatedFetch = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        if (
            u.pathname === '/i/listings/search'
            && u.searchParams.get('count') !== '0'
            && u.searchParams.get('sort_by') === '-firstPublishedAt'
            && u.searchParams.get('cursor')
            && !hitSecondaryShard
        ) {
            hitSecondaryShard = true;
            secondaryStartedResolve();
            await shardGate;
        }
        return fetchImpl(url);
    };

    const claimed = [];
    const scanner1 = createFastScanner({
        fetchImpl: gatedFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        unknownFlushDelayMs: 15,
        claimIntervalMs: 0,
        claimWorkers: 1,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const scanPromise = scanner1.start({ concurrency: 2 });
    await secondaryStarted;
    // Wait long enough for the 15ms timer flush + states + claim to finish while shardGate is still held
    for (let i = 0; i < 40 && claimed.length < 2; i += 1) {
        await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(scanner1.isRunning(), true, 'Scanner must still be running while shard gate is blocked');
    assert.deepEqual(new Set(claimed), new Set([itemsDesc[0].uid, itemsDesc[1].uid]), 'Sparse <24 unknowns must claim mid-scan');

    releaseShardGate();
    const summary1 = await scanPromise;
    assert.equal(summary1.phase, 'completed');
    assert.equal(claimed.length, 2, 'No duplicate claims after full scan finishes');

    // Part 2: stop({ drainDiscovered: true }) finishes <24 buffered unknowns immediately when delay hasn't fired
    const itemsDesc2 = Array.from({ length: 80 }, (_, i) => mkItem(200 + i, baseMs + (80 - i) * 86400 * 1000));
    const localDone2 = itemsDesc2.slice(2).map((it) => `https://www.fab.com/listings/${it.uid}`);
    setupMemoryDb(t, localDone2);

    const { fetchImpl: fetchImpl2 } = setupMockServer(itemsDesc2, new Set());
    let releasePage2Gate;
    const page2Gate = new Promise((resolve) => { releasePage2Gate = resolve; });
    let page2EnteredResolve;
    const page2Entered = new Promise((resolve) => { page2EnteredResolve = resolve; });
    let extraSearchesAfterStop = 0;
    let stopIssued = false;
    const claimed2 = [];

    const stopDrainFetch = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/listings/search' && u.searchParams.get('cursor')) {
            if (stopIssued) {
                extraSearchesAfterStop += 1;
            } else {
                page2EnteredResolve();
                await page2Gate;
            }
        }
        return fetchImpl2(url);
    };

    const gmStore = new Map();
    const scanner2 = createFastScanner({
        fetchImpl: stopDrainFetch,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => { claimed2.push(task.uid); return { result: CLAIM_RESULT.SUCCESS }; }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        unknownFlushDelayMs: 60000,
        claimIntervalMs: 0,
        claimWorkers: 1,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def),
        gmSetValue: async (k, v) => { gmStore.set(k, v); },
        gmDeleteValue: async (k) => { gmStore.delete(k); }
    });

    const p2 = scanner2.start({ concurrency: 1 });
    await page2Entered;
    stopIssued = true;
    const stopPromise = scanner2.stop({ drainDiscovered: true });
    releasePage2Gate();
    await stopPromise;
    const summary2 = await p2;

    assert.equal(summary2.phase, 'paused');
    assert.deepEqual(new Set(claimed2), new Set([itemsDesc2[0].uid, itemsDesc2[1].uid]));
    assert.equal(extraSearchesAfterStop, 0, 'Manual stop with drainDiscovered must not fetch new search pages');
});

test('globalFreeScan quickPrepass claims old is_discounted=1 items and newest head pages before background shards with 0 double-counting', async (t) => {
    const baseMs = Date.parse('2020-01-01T00:00:00.000Z');
    const itemsDesc = Array.from({ length: 160 }, (_, i) => {
        const tsMs = baseMs + (160 - i) * 14 * 86400 * 1000;
        if (i === 155) {
            return { ...mkItem(i, tsMs), isDiscounted: true };
        }
        return mkItem(i, tsMs);
    });

    // Mark 157 items locally done; leave #30 (page 2 of head), #95 (middle shard), #155 (2020 discounted item)
    const unownedIndices = new Set([30, 95, 155]);
    const localDone = itemsDesc
        .filter((_, idx) => !unownedIndices.has(idx))
        .map((it) => `https://www.fab.com/listings/${it.uid}`);
    setupMemoryDb(t, localDone);

    const events = [];
    const { fetchImpl: baseFetch } = setupMockServer(itemsDesc, new Set());
    const fetchImpl = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/listings/search' && u.searchParams.get('count') !== '0') {
            events.push({ type: 'search', url });
        }
        return baseFetch(url);
    };

    const claimed = [];
    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => {
                claimed.push(task.uid);
                events.push({ type: 'claim', uid: task.uid });
                return { result: CLAIM_RESULT.SUCCESS };
            }
        },
        database: Database,
        dataCache: DataCache,
        state: State,
        config: Config,
        utils: Utils,
        sleep: async () => {},
        claimIntervalMs: 0,
        claimWorkers: 1,
        getHref: () => 'https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt',
        getHeaders: () => ({}),
        gmGetValue: async (_, def) => def,
        gmSetValue: async () => {},
        gmDeleteValue: async () => {}
    });

    const summary = await scanner.start({ concurrency: 3, globalFreeScan: true });

    const discSearchIdx = events.findIndex((e) => e.type === 'search' && e.url.includes('is_discounted=1'));
    const claim30Idx = events.findIndex((e) => e.type === 'claim' && e.uid === itemsDesc[30].uid);
    const claim95Idx = events.findIndex((e) => e.type === 'claim' && e.uid === itemsDesc[95].uid);
    const claim155Idx = events.findIndex((e) => e.type === 'claim' && e.uid === itemsDesc[155].uid);

    assert.ok(discSearchIdx !== -1, 'Prepass must query is_discounted=1 pool');
    assert.ok(claim155Idx !== -1 && claim30Idx !== -1 && claim95Idx !== -1, 'All 3 unowned items must be claimed');
    assert.ok(claim155Idx < claim95Idx, 'Old 2020 discounted item must be claimed before middle background shard');
    assert.ok(claim30Idx < claim95Idx, 'Newest head page item must be claimed before middle background shard');
    assert.equal(claimed.length, 3);
    assert.equal(summary.claimedDirect, 3);
    assert.equal(summary.itemsScanned, 160, 'Prepass overlap must not double-count itemsScanned');
});
