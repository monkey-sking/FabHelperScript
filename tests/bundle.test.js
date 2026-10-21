import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../src/config.js';
import { State } from '../src/state.js';
import { Database } from '../src/modules/database.js';
import { DataCache } from '../src/modules/data-cache.js';
import { TaskRunner } from '../src/modules/task-runner.js';
import { ListingSource } from '../src/modules/listing-source.js';
import { EventLog } from '../src/modules/event-log.js';
import { ApiClaim, CLAIM_RESULT, FAB_CLAIM_ENDPOINT } from '../src/modules/claim-strategy.js';
import { Utils } from '../src/modules/utils.js';

// Public listing observed on Fab: listingType=bundle, isFree=false, both licenses cost 0.
const uid = 'a783d3cc-f844-4145-897d-c0ac662525fe';
const bundleUrl = `https://www.fab.com/bundles/${uid}`;
const identityUrl = `https://www.fab.com/listings/${uid}`;

function bundleCard(priceText = '起始价格 免费', id = uid) {
    const link = { href: `https://www.fab.com/zh-cn/bundles/${id}?ref=search`, textContent: 'Asset collection' };
    return {
        textContent: `Asset collection ${priceText}`,
        querySelector: selector => selector.includes('a[href*="/bundles/"]') ? link : null,
        querySelectorAll: () => []
    };
}

test('auto scan queues a free bundle with its real page URL, rejects paid bundles and deduplicates', async t => {
    const previousWindow = globalThis.window;
    globalThis.window = {};
    t.after(() => { globalThis.window = previousWindow; });
    let clock = 0;
    t.mock.method(Date, 'now', () => (clock += 3000));
    t.mock.method(globalThis, 'setInterval', cb => { cb(); return 1; });
    t.mock.method(globalThis, 'clearInterval', () => {});
    t.mock.method(Utils, 'logger', () => {});
    t.mock.method(Database, 'saveTodo', () => {});
    let starts = 0;
    t.mock.method(TaskRunner, 'startExecution', () => { starts++; });
    State.autoAddOnScroll = true;
    State.isAuthenticated = true;
    State.isScanningTasks = false;
    State.isExecuting = false;
    State.autoAddRetryTimer = null;
    State.db = { todo: [], done: [], failed: [] };
    DataCache.ownedStatus.clear();

    const card = bundleCard();
    const paid = bundleCard('$4.99', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    await TaskRunner.scanAndAddTasks([card, paid]);
    assert.deepEqual(State.db.todo, [{ uid, name: 'Asset collection', url: bundleUrl, type: 'detail' }]);
    assert.equal(starts, 1);
    await TaskRunner.scanAndAddTasks([card]);
    assert.equal(State.db.todo.length, 1);
    assert.equal(Database.isTodo(identityUrl), true);

    State.db.todo = [];
    State.db.done = [identityUrl];
    await TaskRunner.scanAndAddTasks([card]);
    assert.equal(State.db.todo.length, 0);
    assert.equal(TaskRunner.isCardFinished(card), true);
    State.db.done = [];
    State.db.failed = [{ uid, url: bundleUrl }];
    await TaskRunner.scanAndAddTasks([card]);
    assert.equal(State.db.todo.length, 0, '最终失败不能被 DOM 重扫自动重新加入');
});

test('bundle tasks survive storage reload, while search links are discarded', async t => {
    const storedTasks = [
        { uid, url: bundleUrl, name: 'Bundle' },
        { uid: 'ordinary', url: 'https://www.fab.com/listings/ordinary', name: 'Listing' },
        { url: 'https://www.fab.com/search?tags=bundle' }
    ];
    t.mock.method(Database, '_safeGet', async (key, fallback) => key === Config.DB_KEYS.TODO ? storedTasks : fallback);
    t.mock.method(Utils, 'logger', () => {});
    await Database.load();
    assert.deepEqual(State.db.todo, storedTasks.slice(0, 2));
});

test('bundle ownership shares a single UID with listing aliases across database and event history', () => {
    State.db.done = [bundleUrl, `${identityUrl}?ref=old`];
    Database.normalizeDoneList();
    assert.deepEqual(State.db.done, [identityUrl]);
    assert.equal(Database.isDone(`/zh-cn/bundles/${uid}`), true);
    assert.equal(Database.getListingUid(bundleUrl), uid);
    assert.equal(EventLog.uidOf(bundleUrl), uid);
    State.db.failed = [{ uid, url: bundleUrl }];
    assert.equal(Database.isFailed(identityUrl), true);
});

test('API enumeration retains the bundle page route and recognizes zero-price standard licenses', () => {
    const item = ListingSource.normalize({ uid, listingType: 'bundle', isFree: false, startingPrice: { price: 0 } });
    assert.equal(item.url, bundleUrl);
    assert.equal(ListingSource.isClaimable(item), true);
});

test('bundle must not POST to ordinary add-to-library even when a free offer exists', async t => {
    const previous = { endpoint: ApiClaim.endpoint, fetchImpl: ApiClaim.fetchImpl };
    t.after(() => ApiClaim.configure(previous));
    t.mock.method(Utils, 'getCookie', () => 'test-csrf');
    const calls = [];
    ApiClaim.configure({
        endpoint: FAB_CLAIM_ENDPOINT,
        fetchImpl: async req => {
            calls.push(req);
            return req.method === 'GET' ? {
                status: 200,
                responseText: JSON.stringify({ listingType: 'bundle', licenses: [
                    { slug: 'personal', offerId: 'personal-free', priceTier: { price: 0 } },
                    { slug: 'professional', offerId: 'professional-free', priceTier: { price: 0 } }
                ] })
            } : { status: 204 };
        }
    });
    const result = await ApiClaim.claim({ uid, url: bundleUrl });
    assert.equal(result.result, CLAIM_RESULT.UNAVAILABLE);
    assert.equal(calls.length, 0, 'bundle 的普通领取端点已实测返回 400，必须走官网结算');
});
