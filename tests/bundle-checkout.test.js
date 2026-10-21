import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireBundle, bundleCheckoutUrl, freeBundleOffers, isZeroPriceCheckout, isCheckoutPage } from '../src/modules/bundle-claim.js';
import { Database } from '../src/modules/database.js';
import { TaskRunner } from '../src/modules/task-runner.js';
import { API } from '../src/modules/api.js';
import { Utils } from '../src/modules/utils.js';

const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const offer = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const namespace = 'cccccccccccccccccccccccccccccccc';
const task = { uid, url: `https://www.fab.com/bundles/${uid}` };
const source = `https://www.fab.com/payment/web/purchase?offers=1-${namespace}-${offer}--&lang=en`;
const checkout = bundleCheckoutUrl(source, [offer]);
const listing = { listingType: 'bundle', licenses: [{ offerId: offer, priceTier: { price: 0 } }] };

function harness({ payment = false, text = '$0.00 This is free. Add it to your library to get started.', ownedAfter = true, captcha = false, terms = false } = {}) {
    let clock = 1000;
    let clicks = 0;
    let launched = false;
    let stateChecks = 0;
    const calls = [];
    const button = { disabled: false, textContent: 'Add to library', click: () => { clicks++; } };
    const buy = { disabled: false, textContent: 'Buy now', click: () => { launched = true; } };
    const checkoutDoc = {
        body: { innerText: text },
        querySelector: () => button,
        querySelectorAll: selector => selector === 'button' ? [button]
            : selector.startsWith('iframe') ? (captcha ? [{ getBoundingClientRect: () => ({ width: 100, height: 100 }) }] : [])
            : terms ? [{ checked: false, required: true }] : []
    };
    const doc = { body: { innerText: 'Bundle Free' }, querySelector: selector => selector.startsWith('iframe')
        ? (launched ? { getAttribute: () => source, contentDocument: checkoutDoc } : null)
        : { querySelectorAll: () => [buy] }, querySelectorAll: () => [] };
    const options = {
        doc,
        win: { location: { href: `${task.url}?workerId=worker_test` } },
        utils: { getCookie: () => 'test-csrf', deepClick: item => item.click() },
        api: {
            gmFetch: async req => {
                calls.push(req);
                if (req.url.includes('listings-states')) {
                    stateChecks++;
                    return { status: 200, responseText: JSON.stringify([{ uid, acquired: clicks > 0 && ownedAfter }]) };
                }
                return { status: 200, responseText: JSON.stringify(listing) };
            }
        },
        now: () => clock,
        sleep: async ms => { clock += ms; }
    };
    return { options, doc, calls, clicks: () => clicks, stateChecks: () => stateChecks };
}

test('only confirmed numeric zero prices qualify as free bundle offers', () => {
    assert.deepEqual(freeBundleOffers(listing), [offer]);
    for (const price of [null, '', false, 1, '0']) {
        assert.deepEqual(freeBundleOffers({ ...listing, licenses: [{ offerId: offer, priceTier: { price } }] }), []);
    }
    assert.equal(isZeroPriceCheckout('Free $0.00'), true);
    assert.equal(isZeroPriceCheckout('Free'), false);
    assert.equal(isZeroPriceCheckout('$0.00 $2.97'), false);
    assert.equal(isCheckoutPage('/payment/web/purchase'), true);
    assert.equal(isCheckoutPage('/bundles/anything'), false);
});

test('checkout URL must originate from Fab and contain a verified free offer for one bundle', () => {
    assert.equal(checkout, source);
    assert.equal(bundleCheckoutUrl(source.replace('www.fab.com', 'example.com'), [offer], 'w', uid), null);
    assert.equal(bundleCheckoutUrl(source, ['paid-or-other-offer'], 'w', uid), null);
    assert.equal(bundleCheckoutUrl(source.replace('offers=1-', 'offers=2-'), [offer], 'w', uid), null);
    assert.equal(bundleCheckoutUrl(source.replace('/payment/web/purchase', '/listings/other'), [offer]), null);
});

test('detail worker drives the official same-origin checkout iframe without POSTing the ordinary API', async () => {
    const h = harness();
    const result = await acquireBundle(task, h.options);
    assert.equal(h.clicks(), 1);
    assert.equal(result.success, true);
    assert.equal('redirectUrl' in result, false);
    assert.equal(h.calls.some(req => req.method !== 'GET'), false);
});

test('checkout submits once, then requires server acquired=true before success', async () => {
    const h = harness({ payment: true });
    const result = await acquireBundle(task, h.options);
    assert.equal(result.success, true);
    assert.equal(h.clicks(), 1);
    assert.equal(h.stateChecks(), 2);
});

test('clicking Add to library without server confirmation must not be counted as owned', async () => {
    const h = harness({ payment: true, ownedAfter: false });
    const result = await acquireBundle(task, h.options);
    assert.equal(result.success, false);
    assert.equal(h.clicks(), 1, 'do not repeatedly submit while waiting for ownership');
    assert.match(result.reason, /未确认入库/);
});

test('paid or unverified checkout is never submitted', async () => {
    const h = harness({ payment: true, text: '$0.99 Add to library' });
    const result = await acquireBundle(task, h.options);
    assert.equal(result.success, false);
    assert.equal(h.clicks(), 0);
});

test('visible CAPTCHA and unchecked required terms preserve the page for manual action', async () => {
    for (const blocker of [{ captcha: true }, { terms: true }]) {
        const h = harness({ payment: true, ...blocker });
        const result = await acquireBundle(task, h.options);
        assert.equal(result.success, false);
        assert.equal(result.manualRequired, true);
        assert.equal(h.clicks(), 0);
    }
});

test('429 during bundle checkout stops immediately and preserves Retry-After', async () => {
    const h = harness({ payment: true });
    h.options.api.gmFetch = async () => ({ status: 429, getResponseHeader: () => '30' });
    const result = await acquireBundle(task, h.options);
    assert.equal(result.rateLimited, true);
    assert.equal(result.retryAfterMs, 30000);
    assert.equal(h.clicks(), 0);
});

test('400 errors have no automatic retries', () => {
    assert.equal(Database.getMaxRetry('[API入库] 接口返回 400，请求体可能被拒绝'), 0);
    assert.equal(Database.getMaxRetry('需要人工完成人机验证'), 0);
    assert.equal(Database.getMaxRetry('Timeout waiting for page'), 3);
});

test('bundle worker reports success only after iframe checkout and server verification', async t => {
    const h = harness();
    const keys = ['window', 'document', 'GM_getValue', 'GM_setValue', 'GM_deleteValue'];
    const originals = new Map(keys.map(key => [key, globalThis[key]]));
    t.after(() => { for (const [key, value] of originals) globalThis[key] = value; });
    const reports = [];
    const removed = [];
    let closes = 0;
    globalThis.window = { location: { href: h.options.win.location.href, search: '?workerId=worker_test' }, close: () => closes++ };
    globalThis.document = h.doc;
    globalThis.GM_getValue = async () => ({ task, instanceId: 'test-instance' });
    globalThis.GM_setValue = async (...args) => reports.push(args);
    globalThis.GM_deleteValue = async key => removed.push(key);
    t.mock.method(globalThis, 'setTimeout', (callback, delay) => { if (delay < 1000) queueMicrotask(callback); return 1; });
    t.mock.method(globalThis, 'clearTimeout', () => {});
    let wallClock = 1000;
    t.mock.method(Date, 'now', () => (wallClock += 250));
    t.mock.method(API, 'gmFetch', h.options.api.gmFetch);
    t.mock.method(Utils, 'getCookie', () => 'test-csrf');
    t.mock.method(Utils, 'deepClick', item => item.click());
    await TaskRunner.processDetailPage();
    assert.equal(window.location.href, h.options.win.location.href);
    assert.equal(reports.length, 1);
    assert.equal(reports[0][1].success, true);
    assert.equal(removed.length, 1);
    assert.equal(closes, 1);
});
