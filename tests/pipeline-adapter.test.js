/**
 * Pipeline Adapter 集成测试
 *
 * 用真实抓包夹具（tests/fixtures/fab-search-*.json）驱动「真实运行环境」形状的流水线：
 *   - fetchPage 走 ListingSource + 夹具（与线上 /i/listings/search 同形）
 *   - verifyOwned 走注入的 Database 替身
 *   - claim 走注入的 DomClaim（复用现有领取协议的 { success } 形态）
 *
 * 目的：证明新建的 pipeline-adapter 能把基础设施模块真正串成一条可跑通的全流程，
 * 而不是只在单元测试里各自为战。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Pipeline } from '../src/modules/pipeline.js';
import { EventLog, EVENT_STATE } from '../src/modules/event-log.js';
import { STATE } from '../src/modules/state-machine.js';
import { ClaimExecutor } from '../src/modules/claim-strategy.js';
import { ListingSource, FREE_POLICY } from '../src/modules/listing-source.js';
import {
    bootstrapPipeline,
    resetPipelineAdapters
} from '../src/modules/pipeline-adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 测试环境无浏览器：给一个最小 document.cookie，使 ApiClaim 内部的 CSRF 读取不抛错
// （真实运行环境由 Fab 页面提供 fab_csrftoken）。
if (typeof globalThis.document === 'undefined') {
    globalThis.document = { cookie: '' };
}
globalThis.document.cookie = 'fab_csrftoken=test-csrf-token';

const loadFixture = (name) => JSON.parse(
    readFileSync(join(__dirname, 'fixtures', name), 'utf8')
);
const PAGE1 = loadFixture('fab-search-page1.json');
const LAST = loadFixture('fab-search-last-page.json');

/**
 * 夹具驱动的网络层：首屏（无 cursor）返回 page1，其后任何 cursor 都返回末页（nextCursor=null）。
 * 形状对齐 ListingSource.fetchImpl：(url, {headers}) => { status, responseText }
 */
function fixtureFetch() {
    return async (url) => {
        const u = new URL(url, 'https://www.fab.com');
        const hasCursor = u.searchParams.has('cursor');
        const payload = hasCursor ? LAST : PAGE1;
        return { status: 200, responseText: JSON.stringify(payload) };
    };
}

/** 一个会「真实入库」的 Database 替身，供 verifyOwned 判定 */
function makeFakeDb() {
    const done = new Set();
    return {
        isDone: (url) => done.has(String(url).toLowerCase()),
        _mark: (uid) => done.add(`https://www.fab.com/listings/${uid}`)
    };
}

/** 注入式 DOM 领取：模拟现有 worker 协议返回 { success }，并把商品标记为已入库 */
function makeAcquireFn(fakeDb) {
    return async (task) => {
        fakeDb._mark(task.uid);
        return { success: true };
    };
}

function runFull(opts = {}) {
    const fakeDb = makeFakeDb();
    const acquireFn = makeAcquireFn(fakeDb);
    bootstrapPipeline({
        fetchImpl: fixtureFetch(),
        database: fakeDb,
        acquireFn,
        ratePerMin: 100000, // 测试不卡速率
        burst: 100,
        freePolicy: opts.freePolicy || FREE_POLICY.FLAG_OR_PRICE,
        ...(opts.extra || {})
    });
    Pipeline.start(0);
    return Pipeline.run({ maxSteps: 500, now: 0, advance: 1 }).then(() => ({
        fakeDb,
        stats: EventLog.stats()
    }));
}

test('端到端：真实夹具驱动枚举→领取→复查→DONE，4 个商品全领', async () => {
    resetPipelineAdapters();
    const { fakeDb, stats } = await runFull();

    assert.equal(Pipeline.fsm.state, STATE.DONE);
    assert.equal(stats.total, 4);
    assert.equal(stats.claimed, 4);
    assert.equal(stats.skipped, 0);
    assert.equal(stats.failed, 0);
    // page1(4 个) + 末页(0 个, nextCursor=null) = 2 页
    assert.equal(Pipeline.pagesFetched, 2);
    assert.equal(Pipeline.isEndOfList, true);
    assert.equal(EventLog.getTodo().length, 0);
    // 4 个 uid 都进了「已入库」替身
    assert.equal(fakeDb.isDone('https://www.fab.com/listings/f32c6ac7-ae94-4fd5-be5a-0d9985b99917'), true);
    // 仅配置 DomClaim 时所有领取都走 DOM，回落率应为 1（API 不可用时本就全 DOM）
    assert.equal(ClaimExecutor.stats().fallbackRate, 1);
});

test('免费策略 FLAG_ONLY 会漏掉 price=0 但 isFree=false 的商品', async () => {
    resetPipelineAdapters();
    const { stats } = await runFull({ freePolicy: FREE_POLICY.FLAG_ONLY });

    // page1 里仅 2 个 isFree=true（CC0），另 2 个 price=0/isFree=false 应被跳过
    assert.equal(stats.claimed, 2);
    assert.equal(stats.skipped, 2);
    assert.equal(stats.total, 4);
    assert.equal(Pipeline.fsm.state, STATE.DONE);
    const skipped = EventLog.getTodo().length === 0
        ? [...EventLog._latest.values()].filter(e => e.state === EVENT_STATE.SKIPPED)
        : [];
    assert.ok(skipped.every(e => e.reason === 'not_free'));
});

test('领取成功但复查未确认入库 → 判为失败，不计入已领', async () => {
    resetPipelineAdapters();
    // verifyOwned 永远返回 false，模拟「服务端尚未反映入库」
    const fakeDb = makeFakeDb();
    bootstrapPipeline({
        fetchImpl: fixtureFetch(),
        database: { isDone: () => false }, // 复查一律不成立
        acquireFn: makeAcquireFn(fakeDb),
        ratePerMin: 100000,
        burst: 100
    });
    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 500, now: 0, advance: 1 });

    const stats = EventLog.stats();
    assert.equal(stats.claimed, 0);
    assert.equal(stats.failed, 4);
    assert.equal(Pipeline.fsm.state, STATE.DONE);
});

test('ApiClaim 主路径：配置领取端点后 claims 经 api 策略，回落率为 0', async () => {
    resetPipelineAdapters();
    const fakeDb = makeFakeDb();
    // 领取 POST 端点已确认，ApiClaim 接管；不再依赖 DomClaim
    bootstrapPipeline({
        fetchImpl: fixtureFetch(),
        database: { isDone: () => true }, // 服务端已反映入库
        apiEndpoint: 'https://www.fab.com/i/listings/claim',
        apiFetchImpl: async () => ({ status: 200, responseText: '{}' }),
        ratePerMin: 100000,
        burst: 100
    });
    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 500, now: 0, advance: 1 });

    const stats = EventLog.stats();
    assert.equal(stats.claimed, 4);
    assert.equal(Pipeline.fsm.state, STATE.DONE);
    const cs = ClaimExecutor.stats();
    assert.equal(cs.api.attempts, 4);
    assert.equal(cs.api.success, 4);
    assert.equal(cs.dom.attempts, 0);
    assert.equal(cs.fallbackRate, 0);
});

test('resetPipelineAdapters 清除注入，避免用例间泄漏', async () => {
    resetPipelineAdapters();
    // 上一条用例配置了 ApiClaim 端点，这里重置后应当不可用
    const { ApiClaim } = await import('../src/modules/claim-strategy.js');
    assert.equal(ApiClaim.isAvailable(), false);
    // DomClaim 注入也应被清空
    const { DomClaim } = await import('../src/modules/claim-strategy.js');
    assert.equal(DomClaim.isAvailable(), false);
    // ListingSource 与 Pipeline 回到干净状态
    assert.equal(Pipeline.pagesFetched, 0);
    assert.equal(ListingSource.stats.pagesFetched, 0);
});
