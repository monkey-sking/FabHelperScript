import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSrc = fs.readFileSync(path.join(here, '../src/index.js'), 'utf8');

test('checkout documents never launch listing scanning or instance management', async t => {
    installFakeBrowser();
    window.location.pathname = '/payment/web/purchase';
    const { main } = await import('../src/index.js');
    const { InstanceManager } = await import('../src/modules/instance-manager.js');
    const { TaskRunner } = await import('../src/modules/task-runner.js');
    const { State } = await import('../src/state.js');
    const wasWorker = State.isWorkerTab;
    t.after(() => { State.isWorkerTab = wasWorker; });
    let instances = 0;
    let workers = 0;
    t.mock.method(InstanceManager, 'init', async () => instances++);
    t.mock.method(TaskRunner, 'processDetailPage', async () => workers++);
    await main();
    assert.equal(instances, 0);
    assert.equal(workers, 0);
    window.location.search = '?workerId=worker_test&fab_bundle_checkout=bundle-test';
    await main();
    assert.equal(workers, 0);
    assert.equal(instances, 0);
});

test('列表页启动不再引用已删除的 hasCookie', () => {
    assert.equal(/\bhasCookie\b/.test(indexSrc), false);
    assert.match(indexSrc, /const signedIn = Utils\.checkAuthentication\(true\)/);
    assert.match(indexSrc, /if \(signedIn\) \{\s*Utils\.verifyServerSession/);
});

test('manual verification report pauses execution, retains task, updates UI and never dispatches again', async t => {
    installFakeBrowser();
    const { registerWorkerDoneListener } = await import('../src/index.js');
    const { State } = await import('../src/state.js');
    const { Config } = await import('../src/config.js');
    const { TaskRunner } = await import('../src/modules/task-runner.js');
    const { Database } = await import('../src/modules/database.js');
    const { UI } = await import('../src/modules/ui.js');
    const { Utils } = await import('../src/modules/utils.js');
    let callback;
    globalThis.GM_addValueChangeListener = (_, cb) => { callback = cb; return 1; };
    let updated = 0;
    let dispatched = 0;
    let failed = 0;
    const errors = [];
    t.mock.method(UI, 'update', () => updated++);
    t.mock.method(TaskRunner, 'runHideOrShow', () => {});
    t.mock.method(TaskRunner, 'executeBatch', () => dispatched++);
    t.mock.method(Database, 'markAsFailed', () => failed++);
    t.mock.method(Utils, 'logger', (level, message) => { if (level === 'error') errors.push(message); });
    const task = { uid: 'manual-asset', name: 'Asset', url: 'https://www.fab.com/listings/manual-asset' };
    State.registeredWorkerDoneKeys = new Set();
    State.valueChangeListeners = [];
    State.runningWorkers = { 'manual-worker': {} };
    State.activeWorkers = 1;
    State.isExecuting = true;
    State.executionFailedTasks = 0;
    State.db = { todo: [], done: [], failed: [] };
    registerWorkerDoneListener('manual-worker');
    await callback('', null, { workerId: 'manual-worker', instanceId: Config.INSTANCE_ID, task,
        success: false, manualRequired: true, logs: [] });
    assert.deepEqual(errors, [], 'the report must not throw an undefined-variable error');
    assert.equal(State.isExecuting, false);
    assert.equal(State.activeWorkers, 0);
    assert.deepEqual(State.db.todo, [task]);
    assert.equal(failed, 0);
    assert.equal(State.executionFailedTasks, 0);
    assert.equal(updated, 1);
    assert.equal(dispatched, 0);
    assert.equal(State.manualVerificationPending, true);
    TaskRunner.startExecution();
    await TaskRunner.attemptAutoScroll();
    assert.equal(State.isExecuting, false, 'automatic scanning must not undo the manual pause');
    State.manualVerificationPending = false;
});

function installFakeBrowser() {
    globalThis.__FAB_HELPER_SKIP_AUTO_MAIN__ = true;

    class FakeXHR {
        open() {}
        send() {}
        addEventListener() {}
        removeEventListener() {}
        setRequestHeader() {}
        getResponseHeader() { return null; }
    }

    globalThis.XMLHttpRequest = FakeXHR;
    globalThis.MutationObserver = class {
        observe() {}
        disconnect() {}
    };

    const gmStore = new Map();
    globalThis.GM_getValue = async (key, def) => (gmStore.has(key) ? gmStore.get(key) : def);
    globalThis.GM_setValue = async (key, val) => { gmStore.set(key, val); };
    globalThis.GM_deleteValue = async (key) => { gmStore.delete(key); };
    globalThis.GM_addValueChangeListener = () => 1;
    globalThis.GM_removeValueChangeListener = () => {};
    globalThis.GM_xmlhttpRequest = () => {};
    globalThis.GM_openInTab = () => {};

    const body = {
        innerText: '',
        style: {},
        appendChild() {},
        addEventListener() {}
    };
    const doc = {
        readyState: 'complete',
        title: 'Fab Search',
        body,
        cookie: 'fab_csrftoken=test-csrf',
        documentElement: { appendChild() {} },
        head: { appendChild() {} },
        createElement: () => ({
            tagName: 'META',
            style: {},
            setAttribute() {},
            appendChild() {},
            textContent: '',
            httpEquiv: '',
            content: ''
        }),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        removeEventListener() {}
    };
    globalThis.document = doc;

    const location = {
        href: 'https://www.fab.com/zh-cn/search?is_free=1',
        search: '',
        pathname: '/zh-cn/search',
        hostname: 'www.fab.com'
    };
    const win = {
        location,
        _epicAccountId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        addEventListener() {},
        removeEventListener() {},
        fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' })
    };
    globalThis.window = win;
    globalThis.location = location;
    globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };

    let timerId = 1;
    globalThis.setInterval = () => timerId++;
    globalThis.clearInterval = () => {};
    globalThis.setTimeout = () => timerId++;
    globalThis.clearTimeout = () => {};
}

test('listing-page main() 能走到 PagePatcher.init 和请求拦截器', async () => {
    installFakeBrowser();
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalFetch = window.fetch;

    const { main } = await import('../src/index.js');
    const { PagePatcher } = await import('../src/modules/page-patcher.js');
    const { State } = await import('../src/state.js');
    const { InstanceManager } = await import('../src/modules/instance-manager.js');
    const { RateLimitManager } = await import('../src/modules/rate-limit-manager.js');

    let initCalls = 0;
    const originalInit = PagePatcher.init.bind(PagePatcher);
    PagePatcher.init = async function (...args) {
        initCalls += 1;
        return originalInit(...args);
    };

    try {
        await main();
        assert.equal(initCalls, 1, '列表页必须初始化 PagePatcher，否则游标不会保存');
        assert.notEqual(XMLHttpRequest.prototype.open, originalOpen, 'setupRequestInterceptors 应改写 XHR');
        assert.notEqual(window.fetch, originalFetch, 'setupRequestInterceptors 应改写 fetch');
        assert.equal(State.isWorkerTab, false);
    } finally {
        PagePatcher.init = originalInit;
        InstanceManager.isActive = false;
        if (InstanceManager.pingInterval) {
            clearInterval(InstanceManager.pingInterval);
            InstanceManager.pingInterval = null;
        }
        if (RateLimitManager._trackingInterval) {
            clearInterval(RateLimitManager._trackingInterval);
            RateLimitManager._trackingInterval = null;
        }
        State.hasRunDomPart = false;
        State.domIntervals = [];
    }
});
