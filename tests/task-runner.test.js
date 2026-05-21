import test from 'node:test';
import assert from 'node:assert/strict';

import { TaskRunner } from '../src/modules/task-runner.js';
import { Database } from '../src/modules/database.js';
import { State } from '../src/state.js';
import { Utils } from '../src/modules/utils.js';
import { API } from '../src/modules/api.js';
import { Config } from '../src/config.js';

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
    assert.equal('TASK' in Config.DB_KEYS, false);
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
        assert.equal(card.style.display, 'none');
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
        assert.equal(card.style.display, 'none');
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
