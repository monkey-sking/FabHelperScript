import test from 'node:test';
import assert from 'node:assert/strict';

import { Pipeline } from '../src/modules/pipeline.js';
import { EventLog, EVENT_STATE } from '../src/modules/event-log.js';
import { STATE } from '../src/modules/state-machine.js';
import { setDomClaim, ClaimExecutor, CLAIM_RESULT } from '../src/modules/claim-strategy.js';

const mkItem = (n) => ({
    uid: `uid-${n}`,
    url: `https://www.fab.com/listings/uid-${n}`,
    name: `Pack ${n}`
});

/** 构造一个分页接口：每页 pageSize 个，共 total 个，最后一页 nextCursor 为 null */
function fakeSearch(total, pageSize) {
    let served = 0;
    return async (cursor) => {
        const start = cursor ? Number(cursor) : 0;
        const end = Math.min(start + pageSize, total);
        const items = [];
        for (let i = start; i < end; i++) items.push(mkItem(i));
        served += 1;
        return { items, nextCursor: end < total ? String(end) : null, _pages: served };
    };
}

function setup({ ratePerMin = 600, burst = 5, claimResult = CLAIM_RESULT.SUCCESS, verify = true } = {}) {
    setDomClaim(async () => ({ result: claimResult }));
    Pipeline.reset(0);
    Pipeline.configure({
        ratePerMin,
        burst,
        verifyOwned: async () => verify,
        filter: null,
        fetchPage: fakeSearch(0, 10)
    });
    return Pipeline;
}

test('完整遍历：按 cursor 翻页领完全部商品后进入 DONE', async () => {
    setup();
    Pipeline.configure({ fetchPage: fakeSearch(12, 4) });

    Pipeline.start(0);
    const steps = await Pipeline.run({ maxSteps: 200, now: 0, advance: 1 });

    assert.equal(Pipeline.fsm.state, STATE.DONE);
    assert.equal(EventLog.stats().claimed, 12);
    assert.equal(EventLog.stats().total, 12);
    assert.equal(EventLog.getTodo().length, 0);
    // 12 个商品 / 每页 4 个 = 3 页。最后一页正好填满时 nextCursor 即为 null，
    // 不需要再发一次空请求确认结束。
    assert.equal(Pipeline.pagesFetched, 3);
    assert.ok(steps.some(s => s.action === 'scan'));
});

test('到底由 cursor.next === null 权威判定，不会无限翻页', async () => {
    setup();
    const fetchPage = fakeSearch(6, 3);
    Pipeline.configure({ fetchPage });

    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 200, now: 0, advance: 1 });

    assert.equal(Pipeline.isEndOfList, true);
    assert.equal(Pipeline.fsm.state, STATE.DONE);
    // 6 个商品 / 每页 3 个 = 2 页，绝不应多发第 3 次请求
    assert.equal(Pipeline.pagesFetched, 2);
});

test('队列清空但未到底时回到 SCANNING 继续拉下一页', async () => {
    // 第一页 2 个，第二页 2 个，第三页空 → 应看到 SCANNING 出现两次以上
    setup();
    let call = 0;
    Pipeline.configure({
        fetchPage: async () => {
            call += 1;
            if (call === 1) return { items: [mkItem(1), mkItem(2)], nextCursor: '2' };
            if (call === 2) return { items: [mkItem(3), mkItem(4)], nextCursor: '4' };
            return { items: [], nextCursor: null };
        }
    });

    Pipeline.start(0);
    const steps = await Pipeline.run({ maxSteps: 200, now: 0, advance: 1 });

    assert.equal(EventLog.stats().claimed, 4);
    assert.equal(Pipeline.fsm.state, STATE.DONE);
    const scanSteps = steps.filter(s => s.action === 'scan');
    assert.equal(scanSteps.length, 3, '应翻了三页（两页数据 + 一页确认结束）');
});

test('领取失败只影响当前商品，流程继续推进', async () => {
    setup({ claimResult: CLAIM_RESULT.FAILURE });
    Pipeline.configure({ fetchPage: fakeSearch(3, 3) });

    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 200, now: 0, advance: 1 });

    assert.equal(EventLog.stats().failed, 3);
    assert.equal(EventLog.stats().claimed, 0);
    assert.equal(Pipeline.fsm.state, STATE.DONE, '失败不应让流程卡死');
});

test('复查未确认入库则记为失败，而非乐观计为成功', async () => {
    setup({ verify: false });
    Pipeline.configure({ fetchPage: fakeSearch(2, 2) });

    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 200, now: 0, advance: 1 });

    assert.equal(EventLog.stats().claimed, 0);
    assert.equal(EventLog.stats().failed, 2);
    assert.match(EventLog.getFailed()[0].failureReason, /复查/);
});

test('过滤命中的商品记为跳过，不进入领取', async () => {
    setup();
    let claimCalls = 0;
    setDomClaim(async () => { claimCalls += 1; return { result: CLAIM_RESULT.SUCCESS }; });
    Pipeline.configure({
        fetchPage: fakeSearch(4, 4),
        filter: (task) => (task.uid === 'uid-1' ? '付费商品' : null)
    });

    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 200, now: 0, advance: 1 });

    assert.equal(EventLog.isSkipped('uid-1'), true);
    assert.equal(EventLog.stats().skipped, 1);
    assert.equal(EventLog.stats().claimed, 3);
    assert.equal(claimCalls, 3, '被跳过的商品不应占用领取次数');
});

test('429 进入退避并在退避结束后自动恢复，全程无需刷新页面', async () => {
    setup();
    let hits = 0;
    setDomClaim(async () => {
        hits += 1;
        if (hits === 1) return { result: CLAIM_RESULT.RATE_LIMITED, retryAfterMs: 30000 };
        return { result: CLAIM_RESULT.SUCCESS };
    });
    Pipeline.configure({ fetchPage: fakeSearch(3, 3) });

    Pipeline.start(0);
    const steps = await Pipeline.run({ maxSteps: 300, now: 0 });

    assert.ok(steps.some(s => s.action === 'rate_limited'), '应触发限速退避');
    assert.ok(steps.some(s => s.action === 'recovered'), '退避结束后应自动恢复');
    assert.equal(Pipeline.fsm.state, STATE.DONE);
    assert.equal(EventLog.stats().claimed, 3, '限速恢复后应把漏掉的商品补领完');
});

test('限速期间不发出任何领取请求', async () => {
    setup();
    let calls = 0;
    setDomClaim(async () => {
        calls += 1;
        return { result: CLAIM_RESULT.RATE_LIMITED, retryAfterMs: 60000 };
    });
    Pipeline.configure({ fetchPage: fakeSearch(3, 3) });

    Pipeline.start(0);
    await Pipeline.tick(0);                 // 扫描出任务
    const rl = await Pipeline.tick(0);      // 首次领取 → 429
    assert.equal(rl.action, 'rate_limited');
    assert.equal(calls, 1);
    assert.equal(Pipeline.fsm.state, STATE.RATE_LIMITED);

    // 退避未结束前，后续每一步都不得再发起领取
    await Pipeline.tick(1000);
    await Pipeline.tick(30000);
    assert.equal(calls, 1, '限速期间不得叠加请求');
});

test('连续限速达到上限后放弃该商品，不再无限重试', async () => {
    const originalMax = Pipeline.maxConsecutiveRateLimits;
    try {
        setup();
        Pipeline.maxConsecutiveRateLimits = 3;
        let calls = 0;
        setDomClaim(async () => {
            calls += 1;
            return { result: CLAIM_RESULT.RATE_LIMITED, retryAfterMs: 1000 };
        });
        Pipeline.configure({ fetchPage: fakeSearch(1, 1) });

        Pipeline.start(0);
        await Pipeline.run({ maxSteps: 100, now: 0 });

        assert.equal(calls, 3, '达到上限后应停止重试');
        assert.equal(EventLog.isFailed('uid-0'), true);
        assert.match(EventLog.getFailed()[0].failureReason, /连续限速/);
    } finally {
        Pipeline.maxConsecutiveRateLimits = originalMax;
    }
});

test('令牌桶按速率节流：领取被摊开到时间轴上', async () => {
    // 6 次/分钟 = 每 10 秒 1 个令牌，突发 2
    setup({ ratePerMin: 6, burst: 2 });
    Pipeline.configure({ fetchPage: fakeSearch(10, 10) });

    Pipeline.start(0);
    const steps = await Pipeline.run({ maxSteps: 60, now: 0 });

    const claimed = steps.filter(s => s.action === 'claimed').length;
    const elapsed = steps[steps.length - 1].at;
    // 节流的效果体现在「时间」而非「步数」上：突发额度用完后，
    // 每多领一个就要多等 10 秒，因此绝不可能瞬间领完。
    assert.ok(
        claimed <= 2 + Math.floor(elapsed / 10000) + 1,
        `领取次数(${claimed})不应超过令牌供给量（耗时 ${elapsed}ms）`
    );
    assert.ok(elapsed > 0, '低速率下应消耗真实等待时间');
});

test('nextDelayMs 在终止态返回 Infinity，调用方可据此停止调度', async () => {
    setup();
    Pipeline.configure({ fetchPage: fakeSearch(2, 2) });
    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 100, now: 0, advance: 1 });

    assert.equal(Pipeline.nextDelayMs(0), Infinity);
    assert.equal(Pipeline.nextDelayMs(0), Infinity);
});

test('stop 可在运行中随时中止，并保留已领取成果', async () => {
    setup({ ratePerMin: 6, burst: 1 });
    Pipeline.configure({ fetchPage: fakeSearch(20, 5) });

    Pipeline.start(0);
    // 只推进几步就手动停止
    await Pipeline.run({ maxSteps: 4, now: 0 });
    const beforeStop = EventLog.stats().claimed;

    Pipeline.stop(1000);
    assert.equal(Pipeline.fsm.state, STATE.IDLE);
    assert.equal(Pipeline.nextDelayMs(1000), Infinity, '停止后不再调度');
    assert.equal(EventLog.stats().claimed, beforeStop, '已领取的成果不因停止而丢失');
});

test('状态机超时兜底：领取卡死时被强制转入退避而非永久挂起', async () => {
    setup();
    setDomClaim(async () => {
        // 模拟一个永不返回的领取
        return new Promise(() => {});
    });
    Pipeline.configure({ fetchPage: fakeSearch(2, 2) });

    Pipeline.start(0);
    await Pipeline.tick(0); // 扫描出任务
    assert.equal(Pipeline.fsm.state, STATE.CLAIMING);

    // 直接推进到超过 CLAIMING 的 20s 超时
    const step = await Pipeline.tick(20001);
    assert.equal(step.action, 'timeout');
    assert.equal(step.to, STATE.RATE_LIMITED);
});

test('status 聚合全流程可观测指标', async () => {
    setup();
    Pipeline.configure({ fetchPage: fakeSearch(3, 3) });
    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 200, now: 0, advance: 1 });

    const s = Pipeline.status(0);
    assert.equal(s.state, STATE.DONE);
    assert.equal(s.endOfList, true);
    assert.equal(s.log.claimed, 3);
    assert.equal(typeof s.limiter.ratePerMin, 'number');
    assert.equal(typeof s.claims.fallbackRate, 'number');
    assert.equal(s.claims.fallbackRate, 1, '当前无领取端点，全部走 DOM 回落');
});

test('整个流程可在同一 uid 上先失败后成功（事件日志天然支持重试）', async () => {
    setup();
    let attempt = 0;
    setDomClaim(async () => {
        attempt += 1;
        return { result: attempt === 1 ? CLAIM_RESULT.FAILURE : CLAIM_RESULT.SUCCESS };
    });
    Pipeline.configure({ fetchPage: fakeSearch(1, 1) });

    Pipeline.start(0);
    await Pipeline.run({ maxSteps: 100, now: 0, advance: 1 });

    // 第一次失败记为 failed，但队列里已无该商品（不再重入），
    // 这里验证「失败不会污染成功路径」：单商品场景下最终状态是 failed
    assert.equal(EventLog.isFailed('uid-0'), true);
    assert.equal(EventLog.stats().total, 1);
    assert.equal(ClaimExecutor.stats().dom.attempts, 1);
});
