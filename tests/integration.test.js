/**
 * 端到端集成测试：用真实抓包夹具驱动「ListingSource → FastScanner → Database → DOM 同步」整条链路。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

import { Config } from '../src/config.js';
import { State } from '../src/state.js';
import { Utils } from '../src/modules/utils.js';
import { DataCache } from '../src/modules/data-cache.js';
import { Database } from '../src/modules/database.js';
import { CLAIM_RESULT } from '../src/modules/claim-strategy.js';
import { createFastScanner } from '../src/modules/fast-scanner.js';
import { TaskRunner } from '../src/modules/task-runner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
const PAGE1 = read('fab-search-page1.json');
const LAST_PAGE = read('fab-search-last-page.json');

test('端到端全量扫描与入库后回调同步：真实抓包夹具走完枚举、核验、API 入库与落盘', async (t) => {
    const prevDone = State.db.done;
    const prevTodo = State.db.todo;
    const prevFailed = State.db.failed;
    const prevDoneRef = Database._doneRef;
    const prevNormRef = Database._normalizedRef;
    const prevSet = Database.doneSet;

    t.mock.method(Utils, 'logger', () => {});
    t.mock.method(Database, 'saveDone', async () => {});
    t.mock.method(Database, 'saveTodo', async () => {});
    t.mock.method(Database, 'saveFailed', async () => {});
    t.mock.method(TaskRunner, 'syncClaimedCardToDom', (uid) => { syncedUids.push(uid); return 1; });

    State.db.done = [];
    State.db.todo = [];
    State.db.failed = [];
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
    });

    const syncedUids = [];
    const claimedRequests = [];

    const fetchImpl = async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        if (u.pathname === '/i/listings/search') {
            if (u.searchParams.get('count') === '0') {
                return {
                    status: 200,
                    responseText: JSON.stringify({
                        aggregations: { listingType: { buckets: { '3d-model': { docCount: 4 } } } },
                        results: []
                    })
                };
            }
            const cursor = u.searchParams.get('cursor');
            const payload = cursor ? LAST_PAGE : PAGE1;
            return { status: 200, responseText: JSON.stringify(payload) };
        }
        if (u.pathname === '/i/users/me/listings-states') {
            const ids = u.searchParams.getAll('listing_ids');
            return {
                status: 200,
                responseText: JSON.stringify(ids.map((uid) => ({ uid, acquired: false })))
            };
        }
        return { status: 404, responseText: '{}' };
    };

    const scanner = createFastScanner({
        fetchImpl,
        apiClaim: {
            isAvailable: () => true,
            claim: async (task) => {
                claimedRequests.push(task.uid);
                return { result: CLAIM_RESULT.SUCCESS };
            }
        },
        onItemClaimed: (item) => TaskRunner.syncClaimedCardToDom(item.uid || item.url),
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

    const summary = await scanner.start({ concurrency: 1, globalFreeScan: true });
    assert.equal(summary.phase, 'completed');
    assert.equal(summary.claimedDirect, 4);
    assert.equal(claimedRequests.length, 4);
    assert.equal(syncedUids.length, 4);
    assert.equal(State.db.done.length, 4);
    assert.equal(State.db.failed.length, 0);
});
