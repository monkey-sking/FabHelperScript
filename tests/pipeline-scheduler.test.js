/**
 * Pipeline Scheduler 测试
 *
 * 这里的每一条都对应调度策略里的一条硬约束，且都是旧实现真实踩过的坑：
 * 到底后自动重扫导致无限重复领取、暂停恢复被当成超时、失败后 0 延迟猛打接口。
 *
 * 时钟与定时器全部注入，因此无需等待真实时间，断言是确定性的。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { Pipeline } from '../src/modules/pipeline.js';
import { EventLog } from '../src/modules/event-log.js';
import { STATE } from '../src/modules/state-machine.js';
import { setDomClaim, CLAIM_RESULT } from '../src/modules/claim-strategy.js';
import {
    createPipelineScheduler,
    IDLE_POLL_MS,
    DONE_POLL_MS
} from '../src/modules/pipeline-scheduler.js';

const mkItem = (n) => ({
    uid: `uid-${n}`,
    url: `https://www.fab.com/listings/uid-${n}`,
    name: `Pack ${n}`
});

/**
 * 搭一个可控的调度环境：时钟手动推进、执行开关可拨、定时器只记录不真跑。
 * step() 推进一步并把时钟推进到下一次调度时刻（可用 advanceClock:false 关掉）。
 */
function harness({ total = 3, pageSize = 3, rescanIntervalMs = 0, ratePerMin = 6000, burst = 5 } = {}) {
    let clock = 1000;
    let executing = false;
    const timers = [];
    const persisted = [];
    const logs = [];

    let served = 0;
    const fetchPage = async (cursor) => {
        served += 1;
        const start = cursor ? Number(cursor) : 0;
        const end = Math.min(start + pageSize, total);
        const items = [];
        for (let i = start; i < end; i++) items.push(mkItem(i));
        return { items, nextCursor: end < total ? String(end) : null };
    };

    let claimCalls = 0;
    setDomClaim(async () => { claimCalls += 1; return { result: CLAIM_RESULT.SUCCESS }; });

    Pipeline.reset(clock);
    Pipeline.configure({
        ratePerMin,
        burst,
        verifyOwned: async () => true,
        filter: null,
        fetchPage
    });

    const scheduler = createPipelineScheduler({
        pipeline: Pipeline,
        isExecuting: () => executing,
        persist: (now) => persisted.push(now),
        rescanIntervalMs,
        log: (level, msg) => logs.push({ level, msg }),
        nowFn: () => clock,
        setTimeoutFn: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        clearTimeoutFn: () => {}
    });

    const step = async ({ advanceClock = true } = {}) => {
        const delay = await scheduler.tick();
        if (advanceClock && Number.isFinite(delay)) clock += delay;
        return delay;
    };

    /** 一直推进到给定状态，最多 maxSteps 步 */
    const runUntil = async (predicate, maxSteps = 40) => {
        for (let i = 0; i < maxSteps; i++) {
            if (predicate()) return true;
            await step();
        }
        return predicate();
    };

    return {
        scheduler,
        logs,
        timers,
        step,
        runUntil,
        get clock() { return clock; },
        get pages() { return served; },
        get claimCalls() { return claimCalls; },
        get persisted() { return persisted; },
        setExec: (v) => { executing = v; }
    };
}

test('执行开关关闭时不推进，开启后立即起一程', async () => {
    const h = harness();
    h.setExec(false);

    const idleDelay = await h.step();
    assert.equal(idleDelay, IDLE_POLL_MS, '未执行时只做低频空转');
    assert.equal(Pipeline.fsm.state, STATE.IDLE);
    assert.equal(EventLog.stats().total, 0, '未开启执行前不得枚举');

    h.setExec(true);
    await h.step();
    // 一步 = 起程 + 推进一次流水线，因此这里已经翻过第一页
    assert.equal(h.pages, 1, '开启执行后应立即开始枚举');
    assert.equal(EventLog.stats().total, 3);
    assert.ok(Pipeline.fsm.is(STATE.SCANNING, STATE.CLAIMING));
});

test('一轮到底后不自动重扫 —— 执行开关一直开着也不会重复领取', async () => {
    const h = harness({ total: 3, pageSize: 3 });
    h.setExec(true);

    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE), '应能跑到 DONE');
    assert.equal(EventLog.stats().claimed, 3);

    const pagesAfterDone = h.pages;
    const claimsAfterDone = h.claimCalls;

    // 再喂它 30 步（相当于执行开关一直开着、脚本挂机很久）
    for (let i = 0; i < 30; i++) await h.step();

    assert.equal(Pipeline.fsm.state, STATE.DONE, '到底后应停在 DONE，不得自动重开');
    assert.equal(h.pages, pagesAfterDone, '到底后不得再翻任何一页');
    assert.equal(h.claimCalls, claimsAfterDone, '到底后不得产生任何领取请求');
    assert.equal(EventLog.stats().claimed, 3, '已领取的历史必须原样保留');
});

test('用户重新拨动执行开关 → 重新枚举，且保留历史不会重复领取', async () => {
    const h = harness({ total: 3, pageSize: 3 });
    h.setExec(true);
    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE));
    assert.equal(EventLog.stats().claimed, 3);

    // 关掉再打开
    h.setExec(false);
    await h.step();
    h.setExec(true);
    await h.step();

    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE));
    assert.equal(h.pages, 2, '新一程确实重新翻了整份列表');
    assert.equal(h.claimCalls, 3, '重扫不得产生任何新的领取请求');
    assert.equal(EventLog.stats().claimed, 3, '已领取的商品不得被重复领取');
});

test('暂停期间不推进，恢复后不会因暂停时长被误判超时', async () => {
    const h = harness({ total: 6, pageSize: 3 });
    h.setExec(true);
    await h.step();  // 起一程 + 扫第一页 → CLAIMING
    assert.equal(Pipeline.fsm.state, STATE.CLAIMING, '应停在等待领取的状态');

    const pagesBeforePause = h.pages;

    // 暂停 26 秒（远超 CLAIMING 的 20s 超时）：期间调度器只空转，绝不推进流水线
    h.setExec(false);
    for (let i = 0; i < 13; i++) await h.step();
    assert.equal(h.pages, pagesBeforePause, '暂停期间不得发出任何请求');
    assert.equal(Pipeline.fsm.state, STATE.CLAIMING, '暂停只是不推进，不重置状态');

    // 恢复：若把暂停时长算进超时判定，这里会被直接判成「领取卡死」转入退避。
    // 注意一步 = 一次流水线推进，因此恢复后状态会正常往前走一格（CLAIMING→VERIFYING）。
    h.setExec(true);
    await h.step({ advanceClock: false });
    assert.notEqual(
        Pipeline.fsm.state, STATE.RATE_LIMITED,
        '恢复后应就地继续，不得被暂停时长误判为超时'
    );

    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE));
    assert.equal(EventLog.stats().claimed, 6, '恢复后应把剩下的商品领完');
});

test('配置了重扫间隔：间隔未到不重扫，到期才重扫（仍不重复领取）', async () => {
    const h = harness({ total: 3, pageSize: 3, rescanIntervalMs: 60000 });
    h.setExec(true);
    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE));
    assert.equal(EventLog.stats().claimed, 3);

    // 到底后每步空转 DONE_POLL_MS(10s)，3 步共 30s，未到 60s 间隔
    await h.step();
    await h.step();
    await h.step();
    assert.equal(Pipeline.fsm.state, STATE.DONE, '间隔未到不得重扫');
    assert.equal(h.pages, 1);

    // 继续空转直到跨越间隔。注意重扫很可能在同一「步」内跑完整程
    // （整份列表只有一页且商品都已处理），因此用翻页数判断是否重扫，
    // 而不是去抓一个中间状态。
    const pagesBefore = h.pages;
    const rescanned = await h.runUntil(() => h.pages > pagesBefore, 20);
    assert.ok(rescanned, '间隔到期后应自动重扫');

    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE));
    assert.equal(h.pages, 2, '重扫确实重新翻了整份列表');
    assert.equal(h.claimCalls, 3, '重扫依然不得重复领取');
    assert.equal(EventLog.stats().claimed, 3);
});

test('tick 抛出的非限速异常也要换成退避时长，绝不返回 0 延迟', async () => {
    const h = harness();
    // 复查阶段抛一个普通异常（非 SearchError），走调度器自己的兜底
    Pipeline.configure({
        verifyOwned: async () => { throw Object.assign(new Error('复查请求失败'), { status: 500 }); }
    });
    h.setExec(true);

    let delay = 0;
    for (let i = 0; i < 10; i++) {
        delay = await h.step({ advanceClock: false });
        if (h.logs.some(l => l.level === 'error')) break;
    }

    assert.ok(h.logs.some(l => l.level === 'error' && /退避/.test(l.msg)), '退避应留痕');
    assert.ok(delay >= 30000, `异常必须换成退避时长，实际 ${delay}`);
});

test('本程结束时会落盘，避免刷新页面丢历史', async () => {
    const h = harness({ total: 3, pageSize: 3 });
    h.setExec(true);
    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE));

    const before = h.persisted.length;
    await h.step();  // 让调度器观察到 DONE 并收尾

    assert.ok(h.persisted.length > before, '本程结束时必须落盘');
});

test('start/stop 控制自调度循环', async () => {
    const h = harness();
    h.setExec(true);

    assert.equal(h.scheduler.start(), true);
    assert.equal(h.scheduler.start(), false, '重复 start 不应起第二个循环');
    assert.equal(h.scheduler.status().running, true);

    h.scheduler.stop();
    // 注意 stop 只停止调度，不重置流水线状态 —— 这样用户再次开启执行时
    // 是从暂停处继续，而不是从头重扫。
    assert.equal(h.scheduler.status().running, false);
});

test('status 暴露调度器内部状态，便于排障', async () => {
    const h = harness();
    h.setExec(true);
    await h.step();

    const s = h.scheduler.status();
    assert.equal(s.passActive, true, '本程应标记为进行中');
    assert.equal(s.restartRequested, false, '请求已在起程时被消费');
    assert.equal(s.rescanIntervalMs, 0, '默认不自动重扫');
    assert.ok(Pipeline.fsm.is(STATE.SCANNING, STATE.CLAIMING, STATE.VERIFYING));
    assert.equal(typeof s.lastPassAt, 'number');
});

test('DONE 后调度器返回低频等待，而不是让自己忙等', async () => {
    const h = harness({ total: 3, pageSize: 3 });
    h.setExec(true);
    assert.ok(await h.runUntil(() => Pipeline.fsm.state === STATE.DONE));

    const delay = await h.step({ advanceClock: false });
    assert.equal(delay, DONE_POLL_MS);
});
