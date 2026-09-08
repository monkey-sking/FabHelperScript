/**
 * 端到端：新流水线 + iframe 领取传输层
 *
 * 这条链路在浏览器里跑不起来（领取端点未确认、iframe 领取未线上验证），
 * 但它恰恰是唯一能证明「新架构真的能领到东西」的手段：枚举走真实抓包夹具，
 * 领取走 ClaimExecutor → DomClaim → iframe 传输层 → detail-claim，全程真实代码，
 * 只有「帧」是假的。任何一环的返回值形态对不上（比如 normalizeClaimOutcome
 * 认不出传输层的返回），这条用例都会挂。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Pipeline } from '../src/modules/pipeline.js';
import { EventLog } from '../src/modules/event-log.js';
import { STATE } from '../src/modules/state-machine.js';
import { ClaimExecutor } from '../src/modules/claim-strategy.js';
import { bootstrapPipeline, resetPipelineAdapters } from '../src/modules/pipeline-adapter.js';
import { createIframeAcquire } from '../src/modules/iframe-claim.js';
import { makeNode, makeDoc, makeFakeUtils } from './helpers/fake-dom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadFixture = (name) => JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
const PAGE1 = loadFixture('fab-search-page1.json');
const LAST = loadFixture('fab-search-last-page.json');

const UID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function fixtureFetch() {
    return async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        const payload = u.searchParams.has('cursor') ? LAST : PAGE1;
        return { status: 200, responseText: JSON.stringify(payload) };
    };
}

function makeFakeDb() {
    const done = new Set();
    return {
        isDone: (url) => done.has(String(url).toLowerCase()),
        _mark: (uid) => done.add(`https://www.fab.com/listings/${uid}`)
    };
}

const fakeTaskRunner = {
    getExternalProductState: () => ({ handled: false }),
    findFreeLicenseOption: () => null,
    isFreeCard: () => false
};

/**
 * 假建帧器：每次开帧都造一个独立的假详情页，里面只有一个「添加到我的库」按钮，
 * 点掉后变成已拥有徽章并真的入库 —— 与真实页面的行为形状一致。
 */
function makeFrameFactory(fakeDb) {
    const opened = [];
    const open = async (url) => {
        opened.push(url);
        const uid = (url.match(UID_RE) || [])[0];
        const addButton = makeNode({
            text: '添加到我的库',
            onClick: (node) => {
                node.textContent = '已保存在我的库中';
                if (uid) fakeDb._mark(uid);
            }
        });
        return {
            iframe: { src: url },
            doc: makeDoc([makeNode({ tag: 'main' }), addButton]),
            win: { getComputedStyle: () => null, location: { pathname: '/listings/x' } },
            close: () => {}
        };
    };
    return { open, opened };
}

/**
 * 帧内用的虚拟定时器。
 * sleep 只推进时钟，now 读同一个时钟 —— 少了这一手，「找按钮最多 8 秒」这类
 * 轮询会按真实时间跑满，一条用例就要三十多秒。
 * runIntervalAtOnce: 让「等它变成已拥有」的轮询注册即执行一次，瞬间收敛。
 */
function makeVirtualTimers({ runIntervalAtOnce }) {
    let clock = 1_700_000_000_000;
    return {
        MutationObserver: null,
        sleep: async (ms) => { clock += ms; },
        setTimeoutFn: () => 0,
        clearTimeoutFn: () => {},
        setIntervalFn: (fn) => {
            if (runIntervalAtOnce) fn();
            return 0;
        },
        clearIntervalFn: () => {},
        now: () => clock,
        utils: makeFakeUtils(),
        api: { gmFetch: async () => ({ responseText: '[]' }), extractStateData: () => [] },
        diagnostics: { diagnoseDetailPage: () => ({ pageTitle: 'Fake', buttons: [] }) }
    };
}

test('端到端：枚举（真实夹具）→ iframe 领取 → 复查入库 → DONE', async () => {
    resetPipelineAdapters();
    const fakeDb = makeFakeDb();
    const frames = makeFrameFactory(fakeDb);

    const acquireFn = createIframeAcquire({
        taskRunner: fakeTaskRunner,
        openFrame: frames.open,
        // 虚拟定时器：interval 注册即执行一次，于是「等它变成已拥有」瞬间完成，
        // 整程 4 个商品不需要真等任何一秒。
        claimOptions: makeVirtualTimers({ runIntervalAtOnce: true })
    });

    bootstrapPipeline({
        fetchImpl: fixtureFetch(),
        database: fakeDb,
        acquireFn,
        // 测试环境没有页面信号，显式声明已登录，否则会被未登录闸门拦下
        isLoggedIn: () => true,
        ratePerMin: 100000,
        burst: 100
    });

    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 500, now: 0, advance: 1 });

    const stats = EventLog.stats();
    assert.equal(Pipeline.fsm.state, STATE.DONE);
    assert.equal(stats.claimed, 4, '4 个免费商品应全部领取成功');
    assert.equal(stats.failed, 0);
    assert.equal(stats.skipped, 0);
    assert.equal(frames.opened.length, 4, '每个商品各开一次领取帧');

    const cs = ClaimExecutor.stats();
    assert.equal(cs.dom.attempts, 4, '全走 DOM 回落路径（接口端点未配置）');
    assert.equal(cs.dom.success, 4);
    assert.equal(cs.api.attempts, 0);
    assert.equal(cs.fallbackRate, 1);

    resetPipelineAdapters();
});

test('领取失败时流水线把它记为 failed，而不是默默当成成功', async () => {
    resetPipelineAdapters();
    const fakeDb = makeFakeDb();

    // 帧里的详情页没有任何可点的按钮：领取必然失败
    const acquireFn = createIframeAcquire({
        taskRunner: fakeTaskRunner,
        openFrame: async () => ({
            iframe: {},
            doc: makeDoc([makeNode({ tag: 'main' }), makeNode({ text: '订阅更新' })]),
            win: { getComputedStyle: () => null, location: { pathname: '/listings/x' } },
            close: () => {}
        }),
        claimOptions: makeVirtualTimers({ runIntervalAtOnce: false })
    });

    bootstrapPipeline({
        fetchImpl: fixtureFetch(),
        database: fakeDb,
        acquireFn,
        // 测试环境没有页面信号，显式声明已登录，否则会被未登录闸门拦下
        isLoggedIn: () => true,
        ratePerMin: 100000,
        burst: 100
    });

    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 500, now: 0, advance: 1 });

    const stats = EventLog.stats();
    assert.equal(stats.claimed, 0);
    assert.equal(stats.failed, 4, '领不到的商品必须明确记成失败，不能凭空消失');
    assert.equal(Pipeline.fsm.state, STATE.DONE);

    resetPipelineAdapters();
});
