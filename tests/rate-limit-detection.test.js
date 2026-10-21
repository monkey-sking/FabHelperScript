import test from 'node:test';
import assert from 'node:assert/strict';
import { isRateLimitedResponse, isRateLimitedPage } from '../src/modules/rate-limit-detection.js';
import { PagePatcher } from '../src/modules/page-patcher.js';
import { RateLimitManager } from '../src/modules/rate-limit-manager.js';
import { Utils } from '../src/modules/utils.js';

const page = { results: [{ title: 'Blueprint Automation Toolkit', uid: 'uid-containing-429',
    technicalDetails: 'Bearer-token authentication, safe mode, rate limiting, and request limits' }],
    cursors: { next: 'page-2' }, next: 'https://www.fab.com/i/listings/search?cursor=page-2' };

test('successful product data containing rate limit, Too many requests or 429 is not throttling', () => {
    assert.equal(isRateLimitedResponse(200, JSON.stringify(page)), false);
    assert.equal(isRateLimitedResponse(200, { results: [], detail: 'Too many requests plugin' }), false);
    assert.equal(isRateLimitedResponse(200, { title: 'Too many requests', description: 'rate limit', uid: '429' }), false);
    assert.equal(isRateLimitedPage('Blueprint Automation Toolkit | Fab', 'Safe mode, rate limiting, and request limits'), false);
    assert.equal(isRateLimitedPage('Search | Fab', 'Search Tool 429'), false);
});

test('real 429 status and explicit error envelopes still trigger throttling', () => {
    assert.equal(isRateLimitedResponse(429, page), true);
    for (const payload of [{ detail: 'Too many requests' }, { detail: 'Request was throttled. Expected available in 30 seconds.' }, { code: 'rate_limit_exceeded' }]) {
        assert.equal(isRateLimitedResponse(200, JSON.stringify(payload)), true);
    }
    assert.equal(isRateLimitedPage('429 Too Many Requests', 'Please wait'), true);
    assert.equal(isRateLimitedPage('Error', '{"detail":"Too many requests"}'), true);
    assert.equal(isRateLimitedResponse(200, { detail: { field: 'invalid' } }), false);
});

test('XHR and fetch pagination successes are counted without scanning product descriptions for rate words', async t => {
    const originalWindow = globalThis.window;
    const originalXHR = globalThis.XMLHttpRequest;
    t.after(() => { globalThis.window = originalWindow; globalThis.XMLHttpRequest = originalXHR; });
    class XHR {
        constructor() { this.status = 200; this.responseText = JSON.stringify(page); this.listeners = new Set(); }
        open() {}
        addEventListener(_, cb) { this.listeners.add(cb); }
        removeEventListener(_, cb) { this.listeners.delete(cb); }
        send() { for (const cb of [...this.listeners]) cb(); }
    }
    globalThis.XMLHttpRequest = XHR;
    const url = 'https://www.fab.com/i/listings/search?is_free=1&cursor=page-1';
    globalThis.window = { location: { origin: 'https://www.fab.com' }, fetch: async () => ({
        status: 200, url, clone: () => ({ text: async () => JSON.stringify(page) })
    }) };
    t.mock.method(PagePatcher, 'shouldPatchUrl', () => false);
    t.mock.method(PagePatcher, 'saveLatestCursorFromUrl', () => {});
    t.mock.method(PagePatcher, 'saveCursorFromSearchPayload', () => {});
    t.mock.method(Utils, 'logger', () => {});
    let successes = 0;
    let limits = 0;
    t.mock.method(RateLimitManager, 'recordSuccessfulRequest', async (_, valid) => { if (valid) successes++; });
    t.mock.method(RateLimitManager, 'enterRateLimitedState', async () => { limits++; });
    PagePatcher.applyPatches();
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.send();
    await window.fetch(url);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(successes, 2);
    assert.equal(limits, 0);
});
