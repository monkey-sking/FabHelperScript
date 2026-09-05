/**
 * Iframe Claim 传输层测试
 *
 * 这个模块解决的是「怎么把商品详情页送到眼前」—— 新流水线 DomClaim 缺的最后一块。
 * 它本身不碰领取逻辑（那是 detail-claim 的事），只负责建帧、等帧、收尾，
 * 以及最关键的：把失败正确归类成「可重试」还是「终态失败」。
 *
 * 这个归类比看上去重要得多：如果帧没加载出来（网络抖动 / 被风控）被判成终态失败，
 * 整份免费列表会一次性在事件日志里定型，之后就算修好了也不会再重试。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../src/config.js';
import { createIframeAcquire, createRealFrameOpener, defaultBuildUrl } from '../src/modules/iframe-claim.js';
import { makeNode, makeDoc, makeFakeUtils } from './helpers/fake-dom.js';

/** 虚拟时钟同样要起在真实量级，理由见 helpers/fake-dom.js 的说明 */
const CLOCK_START = 1_700_000_000_000;

/**
 * 造一套虚拟定时环境，并把它同时喂给传输层（建帧）和领取核心（帧内轮询）。
 * interval 不自动跑，由测试手动 tick，于是「60 秒等待」能在毫秒内走完。
 */
function makeEnv(nodes) {
    let clock = CLOCK_START;
    const intervals = [];
    const doc = makeDoc(nodes);
    const win = { getComputedStyle: () => null, location: { pathname: '/listings/x' } };

    const timers = {
        sleep: async (ms) => { clock += ms; },
        setTimeoutFn: () => 0,
        clearTimeoutFn: () => {},
        setIntervalFn: (fn) => { const handle = { fn }; intervals.push(handle); return handle; },
        clearIntervalFn: (handle) => {
            const i = intervals.indexOf(handle);
            if (i >= 0) intervals.splice(i, 1);
        },
        now: () => clock
    };

    const claimOptions = {
        ...timers,
        MutationObserver: null,
        utils: makeFakeUtils(),
        api: { gmFetch: async () => ({ responseText: '[]' }), extractStateData: () => [] },
        diagnostics: { diagnoseDetailPage: () => ({ pageTitle: 'Fake', buttons: [] }) }
    };

    const flush = async (n = 3) => {
        for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r));
    };
    const tick = async (count = 1) => {
        for (let i = 0; i < count; i++) {
            clock += 500;
            for (const handle of [...intervals]) await handle.fn();
        }
    };

    return { doc, win, timers, claimOptions, flush, tick, intervalCount: () => intervals.length };
}

/** 假建帧器：记录开了哪些 URL、关了几次 */
function fakeOpener(doc, win) {
    const state = { opened: [], closed: 0 };
    const open = async (url) => {
        state.opened.push(url);
        return {
            iframe: { src: url },
            doc,
            win,
            close: () => { state.closed += 1; }
        };
    };
    return { open, state };
}

const fakeTaskRunner = {
    getExternalProductState: () => ({ handled: false }),
    findFreeLicenseOption: () => null,
    isFreeCard: () => false
};

const TASK = { uid: 'abc-123', name: 'Fake Asset', url: 'https://www.fab.com/listings/abc-123' };

test('主路径：帧内点掉添加按钮后领取成功，且帧一定被关掉', async () => {
    const addButton = makeNode({
        text: '添加到我的库',
        onClick: (node) => { node.textContent = '已保存在我的库中'; }
    });
    const env = makeEnv([makeNode({ tag: 'main' }), addButton]);
    const opener = fakeOpener(env.doc, env.win);

    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner,
        openFrame: opener.open,
        claimOptions: env.claimOptions
    });

    const promise = acquire(TASK);
    await env.flush();
    await env.tick(2);
    const result = await promise;

    assert.equal(result.success, true);
    assert.equal(opener.state.closed, 1, '领取成功也必须摘掉帧，否则页面里会堆满隐藏 iframe');
});

test('帧的 URL 必须带领取帧标记，否则脚本会在帧内二次初始化', async () => {
    const url = defaultBuildUrl(TASK);

    assert.ok(url.includes(`/listings/abc-123`), url);
    assert.ok(url.includes(`${Config.CLAIM_FRAME_PARAM}=1`), url);
});

test('缺 uid 时不建帧，直接失败', async () => {
    const env = makeEnv([makeNode({ tag: 'main' })]);
    const opener = fakeOpener(env.doc, env.win);

    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner, openFrame: opener.open, claimOptions: env.claimOptions
    });

    const result = await acquire({ name: 'no uid' });

    assert.equal(result.success, false);
    assert.equal(opener.state.opened.length, 0, '没有 uid 连帧都不该开');
});

test('帧没加载出来 → 判为可重试，绝不写死成终态失败', async () => {
    let clock = CLOCK_START;
    const iframeStub = { contentDocument: null, remove() {}, setAttribute() {}, style: {} };
    const parentDoc = { createElement: () => iframeStub, body: { appendChild() {} } };

    const opener = createRealFrameOpener({
        parentDoc,
        timeoutMs: 1000,
        sleep: async (ms) => { clock += ms; },
        now: () => clock,
        log: () => {}
    });

    await assert.rejects(() => opener('https://www.fab.com/listings/x'), /没有加载完成/);

    // 传输层拿到这个异常后必须转成 retryable
    const env = makeEnv([makeNode({ tag: 'main' })]);
    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner, openFrame: opener, claimOptions: env.claimOptions
    });
    const result = await acquire(TASK);

    assert.equal(result.success, false);
    assert.equal(result.retryable, true, '帧没起来是「这次没领成」，不是「这个商品领不了」');
});

test('跨域拿不到 iframe 文档 → 同样判为可重试', async () => {
    let clock = CLOCK_START;
    const iframeStub = {
        get contentDocument() { throw new Error('Blocked a frame with origin'); },
        remove() {}, setAttribute() {}, style: {}
    };
    const parentDoc = { createElement: () => iframeStub, body: { appendChild() {} } };

    const opener = createRealFrameOpener({
        parentDoc,
        timeoutMs: 1000,
        sleep: async (ms) => { clock += ms; },
        now: () => clock,
        log: () => {}
    });

    const env = makeEnv([makeNode({ tag: 'main' })]);
    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner, openFrame: opener, claimOptions: env.claimOptions
    });
    const result = await acquire(TASK);

    assert.equal(result.success, false);
    assert.equal(result.retryable, true);
    assert.ok(/跨域/.test(result.reason), result.reason);
});

test('iframe 刚挂上时是 about:blank，必须等真实导航提交才算就绪', async () => {
    let clock = CLOCK_START;
    let navigated = false;
    const blankDoc = { readyState: 'complete', location: { href: 'about:blank' } };
    const realDoc = { readyState: 'complete', location: { href: 'https://www.fab.com/listings/abc-123' } };

    const iframeStub = {
        get contentDocument() { return navigated ? realDoc : blankDoc; },
        remove() {}, setAttribute() {}, style: {}
    };
    const parentDoc = { createElement: () => iframeStub, body: { appendChild() {} } };

    const opener = createRealFrameOpener({
        parentDoc,
        timeoutMs: 5000,
        // 第一次轮询空转后才「导航完成」，模拟真实浏览器里 about:blank → 目标页的切换
        sleep: async (ms) => { clock += ms; navigated = true; },
        now: () => clock,
        log: () => {}
    });

    const frame = await opener('https://www.fab.com/listings/abc-123');

    assert.equal(
        frame.doc, realDoc,
        '拿到的必须是真实导航后的文档。若放行 about:blank，detail-claim 会拿空文档去领，' +
        '最后被判成「没有可点按钮」这种终态失败，整条商品就再也不会重试了'
    );
});

test('一直停在 about:blank（导航从未提交）→ 超时，且判为可重试', async () => {
    let clock = CLOCK_START;
    const blankDoc = { readyState: 'complete', location: { href: 'about:blank' } };
    const iframeStub = {
        get contentDocument() { return blankDoc; },
        remove() {}, setAttribute() {}, style: {}
    };
    const parentDoc = { createElement: () => iframeStub, body: { appendChild() {} } };

    const opener = createRealFrameOpener({
        parentDoc,
        timeoutMs: 1000,
        sleep: async (ms) => { clock += ms; },
        now: () => clock,
        log: () => {}
    });

    const env = makeEnv([makeNode({ tag: 'main' })]);
    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner, openFrame: opener, claimOptions: env.claimOptions
    });
    const result = await acquire(TASK);

    assert.equal(result.success, false);
    assert.equal(result.retryable, true, '不能因为 readyState 恰好是 complete 就当成加载好了');
});

test('帧内明确领不到（找不到按钮）→ 终态失败，不无限重试', async () => {
    const env = makeEnv([makeNode({ tag: 'main' }), makeNode({ text: '订阅更新' })]);
    const opener = fakeOpener(env.doc, env.win);

    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner, openFrame: opener.open, claimOptions: env.claimOptions
    });

    const result = await acquire(TASK);

    assert.equal(result.success, false);
    assert.equal(result.retryable, false, '商品自己没有可点的按钮，重试多少次都一样');
    assert.equal(opener.state.closed, 1, '失败也必须摘掉帧');
});

test('建帧就失败 → 不误报成功，也不会因为帧不存在而二次抛错', async () => {
    const env = makeEnv([makeNode({ tag: 'main' })]);
    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner,
        openFrame: async () => { throw new Error('建帧时炸了'); },
        claimOptions: env.claimOptions
    });

    const result = await acquire(TASK);

    assert.equal(result.success, false);
    assert.equal(result.retryable, true);
    assert.ok(/建帧时炸了/.test(result.reason), result.reason);
});

test('帧开起来了但拿不到文档 → 关掉帧再返回，不能把 iframe 留在页面上', async () => {
    const env = makeEnv([makeNode({ tag: 'main' })]);
    const state = { closed: 0 };
    const acquire = createIframeAcquire({
        taskRunner: fakeTaskRunner,
        openFrame: async () => ({
            iframe: {},
            doc: null,           // 加载了但读不到文档
            win: null,
            close: () => { state.closed += 1; }
        }),
        claimOptions: env.claimOptions
    });

    const result = await acquire(TASK);

    assert.equal(result.success, false);
    assert.equal(result.retryable, true);
    assert.equal(state.closed, 1, '帧已经建出来了，就必须收掉');
});
