/**
 * 端到端集成测试：用真实抓包夹具驱动「枚举层 → 流水线 → 事件日志」整条链路。
 *
 * 这里刻意不使用任何手写 mock 商品 —— 全部数据来自 tests/fixtures 里用户
 * 提供的真实响应。一旦 Fab 改了字段形状，这里会先炸，而不是等线上才发现。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ListingSource, FREE_POLICY } from '../src/modules/listing-source.js';
import { Pipeline } from '../src/modules/pipeline.js';
import { EventLog, EVENT_STATE } from '../src/modules/event-log.js';
import { STATE } from '../src/modules/state-machine.js';
import { setDomClaim, CLAIM_RESULT } from '../src/modules/claim-strategy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
const PAGE1 = read('fab-search-page1.json');
const LAST_PAGE = read('fab-search-last-page.json');

function fakeFetch(pages) {
    let n = 0;
    return async () => {
        const payload = pages[n] !== undefined ? pages[n] : LAST_PAGE;
        n += 1;
        return { status: 200, responseText: JSON.stringify(payload) };
    };
}

function setup({ pages = [PAGE1, LAST_PAGE], verifyOwned = async () => true, domClaim } = {}) {
    ListingSource.reset();
    ListingSource.configure({
        fetchImpl: fakeFetch(pages),
        freePolicy: FREE_POLICY.FLAG_OR_PRICE,
        baseParams: { is_free: '1', sort_by: 'title' }
    });
    setDomClaim(domClaim || (async () => ({ success: true })));
    Pipeline.reset(0);
    Pipeline.configure({
        fetchPage: (cursor) => ListingSource.fetchPage(cursor),
        verifyOwned,
        filter: null
    });
}

test('真实夹具驱动全流程：4 个商品全部领取成功并进入 DONE', async () => {
    setup();
    Pipeline.start(0);
    const steps = await Pipeline.run({ now: 0, advance: 10 });

    assert.equal(Pipeline.fsm.state, STATE.DONE);
    assert.equal(EventLog.stats().claimed, 4, '4 个真实商品都应领取成功');
    assert.equal(EventLog.stats().failed, 0);
    assert.equal(Pipeline.pagesFetched, 2, '首页 + 末页');
    assert.equal(Pipeline.isEndOfList, true);

    // 整个流程不应触发任何限速退避
    assert.ok(!steps.some(s => s.action === 'rate_limited'));
});

test('真实夹具下的领取顺序与接口返回顺序一致（游标分页不重排）', async () => {
    setup();
    Pipeline.start(0);
    await Pipeline.run({ now: 0, advance: 10 });

    const claimed = EventLog.events
        .filter(e => e.state === EVENT_STATE.CLAIMED)
        .map(e => e.uid);

    assert.deepEqual(claimed, PAGE1.results.map(r => r.uid));
});

test('商品名与 URL 正确写入事件日志（供 UI 与失败归因使用）', async () => {
    setup();
    Pipeline.start(0);
    await Pipeline.run({ now: 0, advance: 10 });

    const first = EventLog.latestOf(PAGE1.results[0].uid);
    assert.equal(first.name, '"Preservons la Creation" (giant mural)');
    assert.equal(first.url, 'https://www.fab.com/listings/f32c6ac7-ae94-4fd5-be5a-0d9985b99917');
});

test('复查未确认入库时不计入成功，且不会重复领取', async () => {
    setup({ verifyOwned: async () => false });
    Pipeline.start(0);
    await Pipeline.run({ now: 0, advance: 10 });

    const stats = EventLog.stats();
    assert.equal(stats.claimed, 0, '复查不通过不应记为成功');
    assert.equal(stats.failed, 4);
    // 失败后不能再回到待办队列，否则会无限重领
    assert.equal(EventLog.getTodo().length, 0);
});

test('免费策略切换会真实改变领取范围（证明策略可观测，不是摆设）', async () => {
    setup();
    // 只认 isFree 标记时，Personal/Professional 的 $0 商品会被漏掉。
    // 过滤器拿到的是完整商品对象，才能做这个判断。
    ListingSource.freePolicy = FREE_POLICY.FLAG_ONLY;
    Pipeline.configure({
        filter: (item) => (ListingSource.isClaimable(item) ? null : '非免费')
    });

    Pipeline.start(0);
    await Pipeline.run({ now: 0, advance: 10 });

    assert.equal(EventLog.stats().skipped, 2, '2 条 isFree=false 的商品应被跳过');
    assert.equal(EventLog.stats().claimed, 2, '只剩 2 条 CC0 商品被领取');
    assert.equal(EventLog.getFailed().length, 0);
});

test('过滤器收到的是完整商品对象（含价格与许可证），而不是只有 uid', async () => {
    setup();
    const seen = [];
    Pipeline.configure({
        filter: (item) => { seen.push(item); return item.price === 0 ? null : '付费'; }
    });

    Pipeline.start(0);
    await Pipeline.run({ now: 0, advance: 10 });

    assert.equal(seen.length, 4);
    seen.forEach(item => {
        assert.ok(item.uid, '应有 uid');
        assert.ok(Array.isArray(item.licenses), '应带许可证列表');
        assert.ok('price' in item, '应带价格字段');
    });
});

test('接口持续 429 时流水线退避并最终放弃，而不是无限循环', async () => {
    setup({
        domClaim: async () => ({
            result: CLAIM_RESULT.RATE_LIMITED, retryAfterMs: 1000
        })
    });
    Pipeline.start(0);
    const steps = await Pipeline.run({ now: 0, advance: 5000, maxSteps: 500 });

    assert.ok(steps.some(s => s.action === 'rate_limited'), '应触发退避');

    const abandoned = steps.filter(s => s.action === 'rate_limit_abandoned');
    assert.equal(abandoned.length, 4, '4 个商品各自在连续限速后放弃');

    // 关键：必须真正收敛，而不是耗尽步数上限
    assert.ok(steps.length < 500, `不应耗尽步数上限（实际 ${steps.length} 步）`);
    assert.equal(Pipeline.fsm.state, STATE.DONE);
    assert.equal(EventLog.stats().failed, 4);
    assert.equal(EventLog.getTodo().length, 0, '放弃后不应回到待领队列重复撞限速');
});

test('多页连续翻页：跨页累计，不会因为末页空结果而丢掉已发现的商品', async () => {
    const pageA = JSON.parse(JSON.stringify(PAGE1));
    const pageB = JSON.parse(JSON.stringify(PAGE1));
    // 第二页换掉 uid，避免与首页重复
    pageB.results = pageB.results.map(r => ({ ...r, uid: r.uid.replace(/^./, 'b') }));

    setup({ pages: [pageA, pageB, LAST_PAGE] });
    Pipeline.start(0);
    await Pipeline.run({ now: 0, advance: 10 });

    assert.equal(EventLog.stats().claimed, 8, '两页共 8 个不同商品');
    assert.equal(Pipeline.pagesFetched, 3);
    assert.equal(Pipeline.fsm.state, STATE.DONE);
});
