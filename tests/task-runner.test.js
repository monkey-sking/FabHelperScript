import test from 'node:test';
import assert from 'node:assert/strict';

import { TaskRunner } from '../src/modules/task-runner.js';
import { Database } from '../src/modules/database.js';
import { State } from '../src/state.js';
import { Utils } from '../src/modules/utils.js';

function createAnchor({ text, href, visible = true }) {
    return {
        textContent: text,
        href,
        getBoundingClientRect: () => visible ? { width: 120, height: 40 } : { width: 0, height: 0 }
    };
}

test('detects external website CTA as a handled terminal state', () => {
    const root = {
        querySelectorAll: (selector) => {
            assert.equal(selector, 'a[href]');
            return [
                createAnchor({
                    text: '在外部网站查看',
                    href: 'https://odininspector.com/?utm_source=fabstore'
                })
            ];
        }
    };

    const result = TaskRunner.getExternalProductState(root);

    assert.deepEqual(result, {
        handled: true,
        reason: 'External CTA "在外部网站查看"',
        href: 'https://odininspector.com/?utm_source=fabstore'
    });
});

test('markAsDone clears stale failed entries for the same uid', async () => {
    const saved = [];
    globalThis.GM_setValue = async (key, value) => {
        saved.push({ key, value });
    };

    State.db.todo = [{
        uid: 'listing-1',
        url: 'https://www.fab.com/listings/listing-1',
        name: 'Odin Inspector'
    }];
    State.db.done = [];
    State.db.failed = [{
        uid: 'listing-1',
        url: 'https://www.fab.com/listings/listing-1',
        name: 'Odin Inspector',
        retryCount: 2
    }];

    await Database.markAsDone({
        uid: 'listing-1',
        url: 'https://www.fab.com/listings/listing-1',
        name: 'Odin Inspector'
    });

    assert.equal(State.db.todo.length, 0);
    assert.equal(State.db.failed.length, 0);
    assert.deepEqual(State.db.done, ['https://www.fab.com/listings/listing-1']);
    assert.ok(saved.some(entry => entry.value === State.db.failed));
});

function createLicenseNode(options) {
    return {
        querySelectorAll: (selector) => {
            assert.equal(selector, 'span, div');
            return options.map(option => ({
                childNodes: [{ nodeType: 3, textContent: option.text }],
                textContent: option.text,
                closest: (closestSelector) => {
                    assert.equal(closestSelector, '[role="option"], button, label, input[type="radio"]');
                    return option.clickTarget;
                }
            }));
        }
    };
}

test('prefers explicit free license over paid personal option', () => {
    const paidPersonal = { id: 'paid-personal' };
    const freeProfessional = { id: 'free-professional' };
    const node = createLicenseNode([
        { text: 'Personal $29.99', clickTarget: paidPersonal },
        { text: 'Professional Free', clickTarget: freeProfessional }
    ]);

    const result = TaskRunner.findFreeLicenseOption(node);

    assert.equal(result, freeProfessional);
});

test('coalesces hide retries while cards are still loading', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const scheduled = [];
    const logs = [];

    globalThis.document = {
        querySelectorAll: () => [{
            querySelector: () => null,
            querySelectorAll: () => [],
            textContent: '',
            style: {},
            getAttribute: () => null,
            setAttribute: () => {}
        }],
        getElementById: () => null
    };
    globalThis.window = {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    };
    globalThis.setTimeout = (callback, delay) => {
        scheduled.push({ callback, delay });
        return scheduled.length;
    };
    Utils.logger = (type, message) => {
        logs.push({ type, message });
    };
    State.hideSaved = true;
    State.hideDiscountedPaid = false;
    State.hidePaid = false;
    State.hideRetryTimer = null;

    try {
        TaskRunner.runHideOrShow();
        TaskRunner.runHideOrShow();

        assert.equal(logs.filter(log => log.type === 'debug').length, 1);
        assert.equal(scheduled.length, 1);
        assert.equal(scheduled[0].delay, 2000);
    } finally {
        globalThis.document = originalDocument;
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.setTimeout = originalSetTimeout;
        Utils.logger = originalLogger;
        State.hideRetryTimer = null;
    }
});

test('treats linked cards with saved library text as ready to hide', () => {
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const scheduled = [];
    const logs = [];
    const card = {
        textContent: '2DFactory – Advanced JSON Sprite Importer Tamarar 已保存在我的库中',
        style: {},
        attributes: {},
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: 'https://www.fab.com/listings/0eaac510-c35b-4bbc-96f7-3fb9d1d43684'
                };
            }
            return null;
        },
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };

    globalThis.document = {
        querySelectorAll: () => [card],
        getElementById: () => null
    };
    globalThis.window = {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    };
    globalThis.setTimeout = (callback, delay) => {
        scheduled.push({ callback, delay });
        return scheduled.length;
    };
    Utils.logger = (type, message) => {
        logs.push({ type, message });
    };
    State.hideSaved = true;
    State.hideDiscountedPaid = false;
    State.hidePaid = false;
    State.hideRetryTimer = null;
    State.db.done = [];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        TaskRunner.runHideOrShow();

        assert.equal(logs.some(log => log.message === 'log_unsettled_cards'), false);
        assert.equal(card.attributes['data-fab-processed'], 'true');
        assert.equal(scheduled.some(timer => timer.delay === 2000), false);
    } finally {
        globalThis.document = originalDocument;
        delete globalThis.window;
        globalThis.setTimeout = originalSetTimeout;
        Utils.logger = originalLogger;
        State.hideRetryTimer = null;
    }
});

test('does not block owned cards when another card is still loading', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const scheduled = [];
    const logs = [];
    const makeCard = ({ textContent, href }) => ({
        textContent,
        style: {},
        attributes: {},
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]' && href) {
                return { href };
            }
            return null;
        },
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    });
    const ownedCard = makeCard({
        textContent: 'Owned asset 已保存在我的库中',
        href: 'https://www.fab.com/listings/11111111-1111-4111-8111-111111111111'
    });
    const loadingCard = makeCard({
        textContent: 'Still loading asset',
        href: 'https://www.fab.com/listings/22222222-2222-4222-8222-222222222222'
    });

    globalThis.document = {
        querySelectorAll: () => [loadingCard, ownedCard],
        getElementById: () => null
    };
    globalThis.window = {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    };
    globalThis.setTimeout = (callback, delay) => {
        scheduled.push({ callback, delay });
        return scheduled.length;
    };
    Utils.logger = (type, message) => {
        logs.push({ type, message });
    };
    State.hideSaved = true;
    State.hideDiscountedPaid = false;
    State.hidePaid = false;
    State.hideRetryTimer = null;
    State.db.done = [];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        TaskRunner.runHideOrShow();

        assert.equal(ownedCard.attributes['data-fab-processed'], 'true');
        assert.equal(loadingCard.attributes['data-fab-processed'] ?? null, null);
        assert.equal(scheduled.some(timer => timer.delay === 2000), true);
        assert.equal(logs.some(log => log.type === 'info' && log.message === 'log_unsettled_cards'), false);
    } finally {
        globalThis.document = originalDocument;
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.setTimeout = originalSetTimeout;
        Utils.logger = originalLogger;
        State.hideRetryTimer = null;
    }
});
