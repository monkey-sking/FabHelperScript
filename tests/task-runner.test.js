import test from 'node:test';
import assert from 'node:assert/strict';

import { TaskRunner } from '../src/modules/task-runner.js';
import { Database } from '../src/modules/database.js';
import { State } from '../src/state.js';
import { Utils } from '../src/modules/utils.js';
import { API } from '../src/modules/api.js';
import { Config } from '../src/config.js';
import { InstanceManager } from '../src/modules/instance-manager.js';
import { PagePatcher } from '../src/modules/page-patcher.js';

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

test('database keys used by persisted settings are defined', () => {
    assert.equal(typeof Config.DB_KEYS.HIDE_PAID, 'string');
    assert.equal(Config.DB_KEYS.HIDE_PAID.length > 0, true);
    assert.equal(typeof Config.DB_KEYS.BLOCK_RESOURCES, 'string');
    assert.equal(Config.DB_KEYS.BLOCK_RESOURCES.length > 0, true);
    assert.equal('TASK' in Config.DB_KEYS, false);
});

test('does not debounce cursor based infinite-scroll search requests', () => {
    assert.equal(
        PagePatcher.isDebounceableSearch('https://www.fab.com/i/listings/search?is_free=1&sort_by=-firstPublishedAt&cursor=abc'),
        false
    );
    assert.equal(
        PagePatcher.isDebounceableSearch('https://www.fab.com/i/listings/search?is_free=1&sort_by=-firstPublishedAt'),
        true
    );
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

test('done URLs are normalized so language paths do not double count', async () => {
    const saved = [];
    globalThis.GM_setValue = async (key, value) => {
        saved.push({ key, value });
    };

    State.db.todo = [];
    State.db.done = ['https://www.fab.com/zh-cn/listings/listing-2'];
    State.db.failed = [];

    await Database.markAsDone({
        uid: 'listing-2',
        url: 'https://www.fab.com/listings/listing-2?ref=abc',
        name: 'Already counted'
    });

    assert.deepEqual(State.db.done, ['https://www.fab.com/listings/listing-2']);
    assert.equal(saved.some(entry => entry.value === State.db.done), true);
});

test('isDone matches relative, localized, and canonical listing URLs', () => {
    State.db.done = ['https://www.fab.com/listings/listing-3'];

    assert.equal(Database.isDone('/zh-cn/listings/listing-3'), true);
    assert.equal(Database.isDone('https://www.fab.com/listings/listing-3?foo=bar'), true);
    assert.equal(Database.isDone('https://www.fab.com/listings/listing-other'), false);
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

test('hides paid cards that expose only starting price text', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const card = {
        textContent: 'The Orbitator Mist Polygon 3D fbx gltf +2 起始价格 $2.99',
        style: {},
        attributes: {},
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: 'https://www.fab.com/listings/12345678-1234-4234-8234-123456789abc'
                };
            }
            return null;
        },
        querySelectorAll: () => [],
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        removeAttribute(name) {
            delete this.attributes[name];
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
        if (delay !== 2000) callback();
        return 1;
    };
    Utils.logger = () => {};
    State.hideSaved = false;
    State.hideDiscountedPaid = false;
    State.hidePaid = true;
    State.hideRetryTimer = null;
    State.cardCountCache = {
        total: 0,
        hidden: 0,
        visible: 0,
        dirty: true,
        documentRef: null,
        href: ''
    };
    State.lastHideModeKey = '';
    State.db.done = [];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        TaskRunner.runHideOrShow();

        assert.equal(card.attributes['data-fab-processed'], 'true');
        assert.equal(card.attributes['data-fab-hidden'], 'true');
        assert.equal(card.style.visibility, 'hidden');
        assert.equal(card.style.pointerEvents, 'none');
        assert.equal(card.style.userSelect, 'none');
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

test('hides paid cards with other currency price formats (e.g. ¥, €, GBP)', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const cards = [
        {
            textContent: 'Orbitator 3D fbx gltf 起始价格 ¥14.00',
            style: {},
            attributes: {},
            querySelector: (selector) => selector === 'a[href*="/listings/"]' ? { href: 'https://www.fab.com/listings/1' } : null,
            querySelectorAll: () => [],
            getAttribute(name) { return this.attributes[name] ?? null; },
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; }
        },
        {
            textContent: 'Model with price 19,99 €',
            style: {},
            attributes: {},
            querySelector: (selector) => selector === 'a[href*="/listings/"]' ? { href: 'https://www.fab.com/listings/2' } : null,
            querySelectorAll: () => [],
            getAttribute(name) { return this.attributes[name] ?? null; },
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; }
        },
        {
            textContent: 'Item costing 50 GBP',
            style: {},
            attributes: {},
            querySelector: (selector) => selector === 'a[href*="/listings/"]' ? { href: 'https://www.fab.com/listings/3' } : null,
            querySelectorAll: () => [],
            getAttribute(name) { return this.attributes[name] ?? null; },
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; }
        }
    ];

    globalThis.document = {
        querySelectorAll: () => cards,
        getElementById: () => null
    };
    globalThis.window = {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    };
    globalThis.setTimeout = (callback, delay) => {
        if (delay !== 2000) callback();
        return 1;
    };
    Utils.logger = () => {};
    State.hideSaved = false;
    State.hideDiscountedPaid = false;
    State.hidePaid = true;
    State.hideRetryTimer = null;
    State.cardCountCache = {
        total: 0,
        hidden: 0,
        visible: 0,
        dirty: true,
        documentRef: null,
        href: ''
    };
    State.lastHideModeKey = '';
    State.db.done = [];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        TaskRunner.runHideOrShow();

        cards.forEach(card => {
            assert.equal(card.attributes['data-fab-processed'], 'true');
            assert.equal(card.attributes['data-fab-hidden'], 'true');
            assert.equal(card.style.visibility, 'hidden');
        });
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

test('refreshing visible ownership state triggers hiding confirmed owned cards', async () => {
    const originalDocument = globalThis.document;
    const originalCheckItemsOwnership = API.checkItemsOwnership;
    const originalSaveDone = Database.saveDone;
    const originalSaveFailed = Database.saveFailed;
    const originalRunHideOrShow = TaskRunner.runHideOrShow;
    const originalLogger = Utils.logger;

    let hideRuns = 0;
    const card = {
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: 'https://www.fab.com/listings/33333333-3333-4333-8333-333333333333'
                };
            }
            return null;
        }
    };

    globalThis.document = {
        querySelectorAll: () => [card]
    };
    API.checkItemsOwnership = async () => [{
        uid: '33333333-3333-4333-8333-333333333333',
        acquired: true
    }];
    Database.saveDone = async () => {};
    Database.saveFailed = async () => {};
    TaskRunner.runHideOrShow = () => {
        hideRuns++;
    };
    Utils.logger = () => {};
    State.hideSaved = true;
    State.isCheckingStatus = false;
    State.db.done = [];
    State.db.failed = [];
    State.db.todo = [];

    try {
        await TaskRunner.checkVisibleCardsStatus();

        assert.equal(hideRuns, 1);
        assert.deepEqual(State.db.done, ['https://www.fab.com/listings/33333333-3333-4333-8333-333333333333']);
    } finally {
        globalThis.document = originalDocument;
        API.checkItemsOwnership = originalCheckItemsOwnership;
        Database.saveDone = originalSaveDone;
        Database.saveFailed = originalSaveFailed;
        TaskRunner.runHideOrShow = originalRunHideOrShow;
        Utils.logger = originalLogger;
        State.isCheckingStatus = false;
    }
});

test('auto add schedules a retry when cards are not settled yet', async () => {
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const originalLogger = Utils.logger;
    const originalDateNow = Date.now;
    const originalAutoAddOnScroll = State.autoAddOnScroll;

    const scheduled = [];
    const card = {
        textContent: 'Loading free listing',
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: 'https://www.fab.com/listings/44444444-4444-4444-8444-444444444444'
                };
            }
            return null;
        },
        querySelectorAll: () => []
    };

    globalThis.window = {
        _apiWaitStatus: null,
        fetch: async () => ({})
    };
    globalThis.setTimeout = (callback, delay) => {
        scheduled.push({ callback, delay });
        return scheduled.length;
    };
    globalThis.setInterval = (callback) => {
        callback();
        return 1;
    };
    globalThis.clearInterval = () => {};
    let nowCall = 0;
    Date.now = () => {
        nowCall++;
        return nowCall < 3 ? 0 : 3000;
    };
    Utils.logger = () => {};
    State.autoAddOnScroll = true;
    State.isAuthenticated = true;
    State.isScanningTasks = false;
    State.autoAddRetryTimer = null;
    State.db.todo = [];
    State.db.done = [];
    State.db.failed = [];

    try {
        await TaskRunner.scanAndAddTasks([card]);

        assert.equal(State.db.todo.length, 0);
        assert.equal(scheduled.some(timer => timer.delay === 2000), true);
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.setTimeout = originalSetTimeout;
        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
        Date.now = originalDateNow;
        Utils.logger = originalLogger;
        State.autoAddOnScroll = originalAutoAddOnScroll;
        State.isScanningTasks = false;
        State.autoAddRetryTimer = null;
    }
});

test('auto add queues mixed-license cards that show a free option', async () => {
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const originalLogger = Utils.logger;
    const originalDateNow = Date.now;
    const originalSaveTodo = Database.saveTodo;
    const originalStartExecution = TaskRunner.startExecution;
    const originalAutoAddOnScroll = State.autoAddOnScroll;

    const card = {
        textContent: 'Vintage Chair 选择许可（从 免费 到 $6.99）',
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: 'https://www.fab.com/listings/55555555-5555-4555-8555-555555555555',
                    textContent: 'Vintage Chair'
                };
            }
            return null;
        },
        querySelectorAll: () => []
    };

    globalThis.window = {
        _apiWaitStatus: null,
        fetch: async () => ({})
    };
    globalThis.setTimeout = () => 1;
    globalThis.setInterval = (callback) => {
        callback();
        return 1;
    };
    globalThis.clearInterval = () => {};
    let nowCall = 0;
    Date.now = () => {
        nowCall++;
        return nowCall < 3 ? 0 : 3000;
    };
    Utils.logger = () => {};
    Database.saveTodo = () => {};
    TaskRunner.startExecution = () => {};
    State.autoAddOnScroll = true;
    State.isScanningTasks = false;
    State.autoAddRetryTimer = null;
    State.db.todo = [];
    State.db.done = [];
    State.db.failed = [];

    try {
        await TaskRunner.scanAndAddTasks([card]);

        assert.equal(State.db.todo.length, 1);
        assert.equal(State.db.todo[0].uid, '55555555-5555-4555-8555-555555555555');
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.setTimeout = originalSetTimeout;
        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
        Date.now = originalDateNow;
        Utils.logger = originalLogger;
        Database.saveTodo = originalSaveTodo;
        TaskRunner.startExecution = originalStartExecution;
        State.autoAddOnScroll = originalAutoAddOnScroll;
        State.isScanningTasks = false;
        State.autoAddRetryTimer = null;
    }
});

test('hides auto-completed free cards even before the page text changes to saved', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const scheduled = [];
    const card = {
        textContent: 'Auto completed listing 选择许可（从 免费 到 $6.99）',
        style: {},
        attributes: {},
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: 'https://www.fab.com/zh-cn/listings/66666666-6666-4666-8666-666666666666?foo=bar'
                };
            }
            return null;
        },
        querySelectorAll: () => [],
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
        if (delay !== 2000) callback();
        return scheduled.length;
    };
    Utils.logger = () => {};
    State.hideSaved = true;
    State.hideDiscountedPaid = false;
    State.hidePaid = false;
    State.hideRetryTimer = null;
    State.hiddenThisPageCount = 0;
    State.db.done = ['https://www.fab.com/listings/66666666-6666-4666-8666-666666666666'];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        TaskRunner.runHideOrShow();

        assert.equal(card.attributes['data-fab-processed'], 'true');
        assert.equal(card.style.visibility, 'hidden');
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

test('hidden cards are marked and reflected in the card count cache', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const createCard = (uid, text) => ({
        textContent: text,
        style: {},
        attributes: {},
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: `https://www.fab.com/listings/${uid}`
                };
            }
            return null;
        },
        querySelectorAll: () => [],
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        removeAttribute(name) {
            delete this.attributes[name];
        }
    });

    const ownedCard = createCard('88888888-8888-4888-8888-888888888888', 'Owned free listing Free');
    const visibleCard = createCard('99999999-9999-4999-8999-999999999999', 'Available free listing Free');
    const cards = [ownedCard, visibleCard];

    globalThis.document = {
        querySelectorAll: () => cards,
        getElementById: () => null
    };
    globalThis.window = {
        location: { href: 'https://www.fab.com/search?is_free=1' },
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    };
    globalThis.setTimeout = (callback, delay) => {
        if (delay !== 2000) callback();
        return 1;
    };
    Utils.logger = () => {};
    State.hideSaved = true;
    State.hideDiscountedPaid = false;
    State.hidePaid = false;
    State.hideRetryTimer = null;
    State.cardCountCache = {
        total: 0,
        hidden: 0,
        visible: 0,
        dirty: true,
        documentRef: null,
        href: ''
    };
    State.lastHideModeKey = '';
    State.db.done = ['https://www.fab.com/listings/88888888-8888-4888-8888-888888888888'];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        TaskRunner.runHideOrShow();

        assert.equal(ownedCard.attributes['data-fab-processed'], 'true');
        assert.equal(ownedCard.attributes['data-fab-hidden'], 'true');
        assert.equal(ownedCard.style.visibility, 'hidden');
        assert.equal(ownedCard.style.pointerEvents, 'none');
        assert.equal(ownedCard.style.userSelect, 'none');
        assert.equal(visibleCard.attributes['data-fab-hidden'], undefined);
        assert.deepEqual(TaskRunner.getCardCounts(), {
            total: 2,
            hidden: 1,
            visible: 1
        });
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

test('done records hide cards even when list card status text is missing', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    const card = {
        textContent: 'Auto completed listing without visible price text',
        style: {},
        attributes: {},
        querySelector: (selector) => {
            if (selector === 'a[href*="/listings/"]') {
                return {
                    href: 'https://www.fab.com/listings/77777777-7777-4777-8777-777777777777'
                };
            }
            return null;
        },
        querySelectorAll: () => [],
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
        if (delay !== 2000) callback();
        return 1;
    };
    Utils.logger = () => {};
    State.hideSaved = true;
    State.hideDiscountedPaid = false;
    State.hidePaid = false;
    State.hideRetryTimer = null;
    State.db.done = ['https://www.fab.com/listings/77777777-7777-4777-8777-777777777777'];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        TaskRunner.runHideOrShow();

        assert.equal(card.attributes['data-fab-processed'], 'true');
        assert.equal(card.style.visibility, 'hidden');
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

test('executeBatch triggers attemptAutoScroll when queue is empty and autoScroll is true', async () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
        cookie: 'fab_csrftoken=mock_token'
    };

    const originalAttemptAutoScroll = TaskRunner.attemptAutoScroll;
    const originalIsActiveInstance = InstanceManager.isActive;
    let autoScrollCalled = false;
    TaskRunner.attemptAutoScroll = async () => {
        autoScrollCalled = true;
    };

    State.isExecuting = true;
    State.db.todo = [];
    State.activeWorkers = 0;
    State.autoScroll = true;
    InstanceManager.isActive = true;

    try {
        await TaskRunner.executeBatch();
        assert.equal(autoScrollCalled, true);
    } finally {
        TaskRunner.attemptAutoScroll = originalAttemptAutoScroll;
        InstanceManager.isActive = originalIsActiveInstance;
        globalThis.document = originalDocument;
        State.isExecuting = false;
        State.autoScroll = false;
    }
});

test('checkVisibilityAndRefresh scrolls after hiding all visible cards when auto scroll is enabled', () => {
    const originalDocument = globalThis.document;
    const originalAttemptAutoScroll = TaskRunner.attemptAutoScroll;
    const originalLogger = Utils.logger;

    let autoScrollCalled = false;

    globalThis.document = {
        querySelectorAll: (selector) => {
            if (selector.includes(':not([data-fab-hidden="true"])')) return [];
            return [];
        }
    };
    TaskRunner.attemptAutoScroll = async () => {
        autoScrollCalled = true;
    };
    Utils.logger = () => {};
    State.cardCountCache = {
        total: 3,
        hidden: 3,
        visible: 0,
        dirty: false,
        documentRef: globalThis.document,
        href: ''
    };
    State.hiddenThisPageCount = 3;
    State.appStatus = 'NORMAL';
    State.autoScroll = true;
    State.isExecuting = true;
    State.isAutoScrolling = false;

    try {
        TaskRunner.checkVisibilityAndRefresh();

        assert.equal(autoScrollCalled, true);
    } finally {
        globalThis.document = originalDocument;
        TaskRunner.attemptAutoScroll = originalAttemptAutoScroll;
        Utils.logger = originalLogger;
        State.autoScroll = false;
        State.isExecuting = false;
        State.isAutoScrolling = false;
        State.hiddenThisPageCount = 0;
        State.cardCountCache = {
            total: 0,
            hidden: 0,
            visible: 0,
            dirty: true,
            documentRef: null,
            href: ''
        };
    }
});

test('checkVisibilityAndRefresh scrolls after hiding all visible cards even when execution is idle (autoScroll on)', () => {
    const originalDocument = globalThis.document;
    const originalAttemptAutoScroll = TaskRunner.attemptAutoScroll;
    const originalLogger = Utils.logger;

    let autoScrollCalled = false;

    globalThis.document = {
        querySelectorAll: (selector) => {
            if (selector.includes(':not([data-fab-hidden="true"])')) return [];
            return [];
        }
    };
    TaskRunner.attemptAutoScroll = async () => {
        autoScrollCalled = true;
    };
    Utils.logger = () => {};
    State.cardCountCache = {
        total: 3,
        hidden: 3,
        visible: 0,
        dirty: false,
        documentRef: globalThis.document,
        href: ''
    };
    State.hiddenThisPageCount = 3;
    State.appStatus = 'NORMAL';
    State.autoScroll = true;
    State.isExecuting = false;
    State.isAutoScrolling = false;

    try {
        TaskRunner.checkVisibilityAndRefresh();

        assert.equal(autoScrollCalled, true);
    } finally {
        globalThis.document = originalDocument;
        TaskRunner.attemptAutoScroll = originalAttemptAutoScroll;
        Utils.logger = originalLogger;
        State.autoScroll = false;
        State.isExecuting = false;
        State.isAutoScrolling = false;
        State.hiddenThisPageCount = 0;
        State.cardCountCache = {
            total: 0,
            hidden: 0,
            visible: 0,
            dirty: true,
            documentRef: null,
            href: ''
        };
    }
});

test('attemptAutoScroll stops execution when server confirms no more (isEndOfSearchList=true)', async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalStopExecutionAndSettle = TaskRunner.stopExecutionAndSettle;

    let stopCalled = false;
    let scrollCalled = false;
    let timeoutCallback = null;

    globalThis.window = {
        scrollY: 100,
        innerHeight: 800,
        scrollTo: () => {
            scrollCalled = true;
        }
    };

    globalThis.document = {
        documentElement: {
            scrollHeight: 900 // 800 innerHeight + 100 scrollY = 900 scrollHeight (reached bottom)
        }
    };

    globalThis.setTimeout = (callback, delay) => {
        timeoutCallback = callback;
        return 1;
    };

    TaskRunner.stopExecutionAndSettle = async () => {
        stopCalled = true;
    };

    State.db.todo = [];
    State.isEndOfSearchList = true; // 服务器确认无更多（cursors.next === null）→ 自动入库成功并收尾
    State.activeWorkers = 0;
    State.autoScrollAttempts = 2;
    State.isExecuting = true;

    try {
        await TaskRunner.attemptAutoScroll();
        assert.equal(scrollCalled, true);
        assert.ok(timeoutCallback !== null);

        // Run the timeout callback
        await timeoutCallback();

        assert.equal(stopCalled, true);
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.document = originalDocument;
        globalThis.setTimeout = originalSetTimeout;
        TaskRunner.stopExecutionAndSettle = originalStopExecutionAndSettle;
        State.autoScrollAttempts = 0;
        State.isAutoScrolling = false;
        State.isExecuting = false;
        State.isEndOfSearchList = false;
        State.activeWorkers = 0;
    }
});

test('attemptAutoScroll keeps scrolling when physically at bottom but server has not confirmed end', async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalStopExecutionAndSettle = TaskRunner.stopExecutionAndSettle;
    const originalAttemptAutoScroll = TaskRunner.attemptAutoScroll;
    const originalGetCardCounts = TaskRunner.getCardCounts;
    const originalAddEventListener = globalThis.addEventListener;
    const originalRemoveEventListener = globalThis.removeEventListener;

    let stopCalled = false;
    let recursiveCalled = false;
    let timeoutCallback = null;
    let listenerAdded = null;

    globalThis.window = {
        scrollY: 100,
        innerHeight: 800,
        scrollTo: () => {},
        dispatchEvent: () => {},
        addEventListener: (name, cb) => { listenerAdded = cb; },
        removeEventListener: () => {}
    };

    globalThis.document = {
        documentElement: {
            scrollHeight: 900 // physically at bottom: 800 + 100 = 900 >= 900 - 50
        },
        querySelectorAll: () => []
    };

    globalThis.setTimeout = (callback) => {
        timeoutCallback = callback;
        return 1;
    };

    TaskRunner.stopExecutionAndSettle = async () => {
        stopCalled = true;
    };
    TaskRunner.getCardCounts = () => ({
        total: 10,
        hidden: 0,
        visible: 10 // not all hidden
    });

    State.db.todo = [];
    State.autoScrollAttempts = 2;
    State.isExecuting = true;
    State.autoAddOnScroll = true;
    State.autoScroll = true; // 开启自动滚动开关
    State.isEndOfSearchList = false; // 服务器尚未确认结束 → 物理触底不再作为停转依据，应继续滚动

    try {
        await TaskRunner.attemptAutoScroll();
        TaskRunner.attemptAutoScroll = async () => {
            recursiveCalled = true;
        };
        await timeoutCallback();

        assert.equal(stopCalled, false); // 物理触底但服务器未确认结束 → 不误判成功、不 settle
        assert.equal(recursiveCalled, true); // 继续滚动等待服务器/loader 发出结束信号
        assert.equal(State.hasReachedBottomToastShown, false);
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.document = originalDocument;
        globalThis.setTimeout = originalSetTimeout;
        TaskRunner.stopExecutionAndSettle = originalStopExecutionAndSettle;
        TaskRunner.attemptAutoScroll = originalAttemptAutoScroll;
        TaskRunner.getCardCounts = originalGetCardCounts;
        globalThis.addEventListener = originalAddEventListener;
        globalThis.removeEventListener = originalRemoveEventListener;
        State.autoScrollAttempts = 0;
        State.isAutoScrolling = false;
        State.isExecuting = false;
        State.autoAddOnScroll = false;
        State.autoScroll = false;
        State.isEndOfSearchList = false;
        State.hasReachedBottomToastShown = false;
    }
});

test('hasPositivePriceText parses thousands separators and comma decimals correctly', () => {
    assert.equal(TaskRunner.hasPositivePriceText('Discounted to $1,234.56'), true);
    assert.equal(TaskRunner.hasPositivePriceText('Model with price 19,99 €'), true);
    assert.equal(TaskRunner.hasPositivePriceText('Free (no price shown)'), false);
    assert.equal(TaskRunner.hasPositivePriceText('Royalty Free asset'), false);
});

test('attemptAutoScroll safety cap stops loop without settling when server signal absent', async () => {    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalStopExecutionAndSettle = TaskRunner.stopExecutionAndSettle;

    let stopCalled = false;
    let timeoutCallback = null;

    globalThis.window = {
        scrollY: 100,
        innerHeight: 800,
        scrollTo: () => {}
    };

    globalThis.document = {
        documentElement: {
            scrollHeight: 2000 // Not at bottom
        }
    };

    globalThis.setTimeout = (callback, delay) => {
        timeoutCallback = callback;
        return 1;
    };

    TaskRunner.stopExecutionAndSettle = async () => {
        stopCalled = true;
    };

    State.db.todo = [];
    State.autoScrollAttempts = 5; // 下一次累加即为 6 = maxScrollAttempts（安全护栏上限）
    State.isExecuting = true;
    State.isEndOfSearchList = false; // 服务器始终未确认结束

    try {
        await TaskRunner.attemptAutoScroll();
        await timeoutCallback();

        // 安全护栏触发：未收到服务器到底信号，仅停止滚动循环，
        // 不调用 stopExecutionAndSettle（不宣称「自动入库成功」，避免误杀/误判）。
        assert.equal(stopCalled, false);
        assert.equal(State.autoScrollAttempts, 0); // 护栏触发后重置计数
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.document = originalDocument;
        globalThis.setTimeout = originalSetTimeout;
        TaskRunner.stopExecutionAndSettle = originalStopExecutionAndSettle;
        State.autoScrollAttempts = 0;
        State.isAutoScrolling = false;
        State.isExecuting = false;
        State.isEndOfSearchList = false;
    }
});

test('attemptAutoScroll keeps going when scrolling loads cards but no eligible tasks', async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalStopExecutionAndSettle = TaskRunner.stopExecutionAndSettle;
    const originalAttemptAutoScroll = TaskRunner.attemptAutoScroll;
    const originalGetCardCounts = TaskRunner.getCardCounts;
    const originalRunHideOrShow = TaskRunner.runHideOrShow;

    let stopCalled = false;
    let recursiveScrollCalled = false;
    let hideRunCalled = false;
    let timeoutCallback = null;
    let afterScroll = false;

    globalThis.window = {
        scrollY: 100,
        innerHeight: 800,
        scrollTo: () => {}
    };

    globalThis.document = {
        documentElement: {
            scrollHeight: 2000
        }
    };

    globalThis.setTimeout = (callback) => {
        timeoutCallback = callback;
        return 1;
    };

    TaskRunner.stopExecutionAndSettle = async () => {
        stopCalled = true;
    };
    TaskRunner.getCardCounts = () => ({
        total: afterScroll ? 12 : 10,
        hidden: afterScroll ? 12 : 10,
        visible: 0
    });
    TaskRunner.runHideOrShow = () => {
        hideRunCalled = true;
    };

    State.db.todo = [];
    State.autoScrollAttempts = 2;
    State.isExecuting = true;

    try {
        await originalAttemptAutoScroll();
        TaskRunner.attemptAutoScroll = async () => {
            recursiveScrollCalled = true;
        };
        afterScroll = true;

        await timeoutCallback();

        assert.equal(stopCalled, false);
        assert.equal(hideRunCalled, true);
        assert.equal(recursiveScrollCalled, true);
        assert.equal(State.autoScrollAttempts, 0);
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.document = originalDocument;
        globalThis.setTimeout = originalSetTimeout;
        TaskRunner.stopExecutionAndSettle = originalStopExecutionAndSettle;
        TaskRunner.attemptAutoScroll = originalAttemptAutoScroll;
        TaskRunner.getCardCounts = originalGetCardCounts;
        TaskRunner.runHideOrShow = originalRunHideOrShow;
        State.autoScrollAttempts = 0;
        State.isAutoScrolling = false;
        State.isExecuting = false;
    }
});

test('attemptAutoScroll resumes execution when new tasks are loaded', async () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalStartExecution = TaskRunner.startExecution;

    let startExecutionCalled = false;
    let timeoutCallback = null;

    globalThis.window = {
        scrollY: 100,
        innerHeight: 800,
        scrollTo: () => {}
    };

    globalThis.document = {
        documentElement: {
            scrollHeight: 2000
        }
    };

    globalThis.setTimeout = (callback, delay) => {
        timeoutCallback = callback;
        return 1;
    };

    TaskRunner.startExecution = () => {
        startExecutionCalled = true;
    };

    State.db.todo = [];
    State.autoScrollAttempts = 1;
    State.isExecuting = true;

    try {
        await TaskRunner.attemptAutoScroll();

        // Simulate DOM observer adding a task and calling scanAndAddTasks
        State.db.todo = [{ uid: 'task-new', url: 'https://www.fab.com/listings/task-new', name: 'New Task' }];
        State.isExecuting = false;

        await timeoutCallback();

        assert.equal(startExecutionCalled, true);
    } finally {
        if (originalWindow === undefined) {
            delete globalThis.window;
        } else {
            globalThis.window = originalWindow;
        }
        globalThis.document = originalDocument;
        globalThis.setTimeout = originalSetTimeout;
        TaskRunner.startExecution = originalStartExecution;
        State.autoScrollAttempts = 0;
        State.isAutoScrolling = false;
        State.isExecuting = false;
    }
});

test('PagePatcher clearSavedPosition locks saving, clears sessionStorage, and deletes stored GM cursor', async () => {
    const deletedKeys = [];
    const savedValues = [];
    globalThis.GM_deleteValue = async (key) => { deletedKeys.push(key); };
    globalThis.GM_setValue = async (key, val) => { savedValues.push({ key, val }); };

    const sessionStorageData = new Map();
    sessionStorageData.set('fab_helper_recovery_cursor', 'recovery-123');
    sessionStorageData.set('fab_helper_last_recovery_cursor', 'recovery-123');
    globalThis.sessionStorage = {
        getItem: (k) => sessionStorageData.get(k) || null,
        setItem: (k, v) => sessionStorageData.set(k, v),
        removeItem: (k) => sessionStorageData.delete(k)
    };

    State.rememberScrollPosition = true;
    State.savedCursor = 'old-cursor-123';
    PagePatcher._lastSeenCursor = 'old-cursor-123';
    PagePatcher.unlockCursorSaving();

    // Lock cursor saving
    PagePatcher.lockCursorSaving();
    assert.equal(PagePatcher._isCursorSaveLocked, true);

    // Save attempt while locked should do nothing
    PagePatcher.saveLatestCursorFromUrl('https://www.fab.com/i/listings/search?cursor=new-cursor-456');
    assert.equal(State.savedCursor, 'old-cursor-123');
    assert.equal(savedValues.length, 0);

    // clearSavedPosition should lock, clear State, delete DB key, and clear sessionStorage
    await PagePatcher.clearSavedPosition('test');
    assert.equal(State.savedCursor, null);
    assert.equal(PagePatcher._lastSeenCursor, null);
    assert.ok(deletedKeys.includes(Config.DB_KEYS.LAST_CURSOR));
    assert.equal(sessionStorageData.has('fab_helper_recovery_cursor'), false);
    assert.equal(sessionStorageData.has('fab_helper_last_recovery_cursor'), false);

    // Subsequent save attempt while locked should still do nothing
    PagePatcher.saveLatestCursorFromUrl('https://www.fab.com/i/listings/search?cursor=new-cursor-789');
    assert.equal(State.savedCursor, null);

    // Reset lock for clean state
    PagePatcher.unlockCursorSaving();
});

test('refreshes card count cache from real DOM after infinite-scroll loads new cards', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalSetTimeout = globalThis.setTimeout;
    const originalLogger = Utils.logger;

    function createCard(uid) {
        return {
            textContent: `Free listing ${uid} Free`,
            style: {},
            attributes: {},
            querySelector: (selector) => {
                if (selector === 'a[href*="/listings/"]') {
                    return { href: `https://www.fab.com/listings/${uid}` };
                }
                return null;
            },
            querySelectorAll: () => [],
            getAttribute(name) { return this.attributes[name] ?? null; },
            setAttribute(name, value) { this.attributes[name] = value; },
            removeAttribute(name) { delete this.attributes[name]; }
        };
    }

    const cardA = createCard('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    const cardB = createCard('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
    const cardC = createCard('cccccccc-cccc-4ccc-cccc-cccccccccccc');
    cardC.attributes['data-fab-hidden'] = 'true'; // 模拟此前已被隐藏
    const cards = [cardA, cardB, cardC];

    globalThis.document = {
        querySelectorAll: (selector) => {
            // 模拟真实 CSS 选择器语义：可见选择器会排除已隐藏卡片
            if (selector.includes(':not([data-fab-hidden')) {
                return cards.filter(card => card.attributes['data-fab-hidden'] !== 'true');
            }
            return cards;
        },
        getElementById: () => null
    };
    globalThis.window = {
        location: { href: 'https://www.fab.com/search?is_free=1' },
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    };
    globalThis.setTimeout = (callback, delay) => {
        if (delay !== 2000) callback();
        return 1;
    };
    Utils.logger = () => {};

    State.hideSaved = true;
    State.hideDiscountedPaid = false;
    State.hidePaid = false;
    State.hideRetryTimer = null;
    State.lastHideModeKey = 'init-diff';
    State.cardCountCache = { total: 0, hidden: 0, visible: 0, dirty: true, documentRef: null, href: '' };
    State.db.done = [];
    State.db.failed = [];
    State.sessionCompleted = new Set();

    try {
        // 第一轮：仅 2 张可见卡
        cards.length = 2;
        TaskRunner.runHideOrShow();
        assert.deepEqual(TaskRunner.getCardCounts(), { total: 2, hidden: 0, visible: 2 });

        // 模拟无限滚动加载第 3 张（已隐藏）卡——修复前 total 会停留在旧值 2
        cards.push(cardC);
        TaskRunner.runHideOrShow();
        assert.deepEqual(TaskRunner.getCardCounts(), { total: 3, hidden: 1, visible: 2 });
    } finally {
        globalThis.document = originalDocument;
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
        globalThis.setTimeout = originalSetTimeout;
        Utils.logger = originalLogger;
        State.hideRetryTimer = null;
        State.hideSaved = false;
    }
});

test('attemptAutoScroll scrolls stepwise (not a single jump) to trigger the infinite-scroll loader', async () => {
    // 回归测试：修复前 doScroll 用 scrollTo(0, scrollHeight) 一把跳到底，
    // IntersectionObserver 哨兵被跳过、下一页请求不发出，scrollHeight 不增长，
    // 脚本误判「已到列表末尾」提前停转（表现：入库卡在 N）。
    // 修复后改为分步下滚，应发出多次 scrollBy（而非一次跳到底）。
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalStopExecutionAndSettle = TaskRunner.stopExecutionAndSettle;

    const scrollMoves = [];
    let timeoutCallback = null;

    globalThis.window = {
        scrollY: 0,
        innerHeight: 800,
        scrollBy: (x, y) => { scrollMoves.push({ type: 'by', y }); },
        scrollTo: (x, y) => { scrollMoves.push({ type: 'to', y }); },
        dispatchEvent: () => {}
    };
    globalThis.document = {
        documentElement: { scrollHeight: 5000 },
        querySelectorAll: () => []
    };
    globalThis.setTimeout = (callback) => { timeoutCallback = callback; return 1; };
    TaskRunner.stopExecutionAndSettle = async () => {};

    State.db.todo = [];
    State.autoScrollAttempts = 2; // 下一轮即第 3 次 → flush 后走终止分支，避免递归悬挂
    State.isExecuting = true;
    State.autoAddOnScroll = false;

    try {
        await TaskRunner.attemptAutoScroll();
        assert.ok(timeoutCallback !== null, '3000ms 兜底定时器应已被调度');
        const scrollByCount = scrollMoves.filter(m => m.type === 'by').length;
        assert.ok(scrollByCount >= 2, `自动滚动应分步下滚（多次 scrollBy），实际 ${scrollByCount} 次`);
        await timeoutCallback();
    } finally {
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.setTimeout = originalSetTimeout;
        TaskRunner.stopExecutionAndSettle = originalStopExecutionAndSettle;
        State.autoScrollAttempts = 0;
        State.isAutoScrolling = false;
        State.isExecuting = false;
        State.autoAddOnScroll = false;
    }
});

