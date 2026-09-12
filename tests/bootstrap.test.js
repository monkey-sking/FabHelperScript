import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexSrc = fs.readFileSync(path.join(here, '../src/index.js'), 'utf8');

test('列表页启动不再引用已删除的 hasCookie', () => {
    assert.equal(/\bhasCookie\b/.test(indexSrc), false);
    assert.match(indexSrc, /const signedIn = Utils\.checkAuthentication\(true\)/);
    assert.match(indexSrc, /if \(signedIn\) \{\s*Utils\.verifyServerSession/);
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
