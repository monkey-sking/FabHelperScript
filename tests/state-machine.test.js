import test from 'node:test';
import assert from 'node:assert/strict';

import { TaskStateMachine, STATE } from '../src/modules/state-machine.js';

function fresh(now = 0) {
    TaskStateMachine._listeners = [];
    TaskStateMachine.reset(now);
    return TaskStateMachine;
}

test('初始状态为 IDLE', () => {
    fresh();
    assert.equal(TaskStateMachine.state, STATE.IDLE);
    assert.equal(TaskStateMachine.history.length, 0);
});

test('正常链路：IDLE→SCANNING→CLAIMING→VERIFYING→CLAIMING', () => {
    fresh();
    assert.equal(TaskStateMachine.start(0), true);
    assert.equal(TaskStateMachine.state, STATE.SCANNING);
    assert.equal(TaskStateMachine.transition(STATE.CLAIMING, { now: 100 }), true);
    assert.equal(TaskStateMachine.transition(STATE.VERIFYING, { now: 200 }), true);
    assert.equal(TaskStateMachine.transition(STATE.CLAIMING, { now: 300 }), true);
    assert.equal(TaskStateMachine.state, STATE.CLAIMING);
});

test('队列排空但未到底时，领取可以退回扫描继续翻页', () => {
    fresh();
    TaskStateMachine.start(0);
    TaskStateMachine.transition(STATE.CLAIMING, { now: 10 });
    assert.equal(TaskStateMachine.transition(STATE.SCANNING, { now: 20 }), true);
    assert.equal(TaskStateMachine.state, STATE.SCANNING);

    // 复查完成后同样可以直接退回扫描
    TaskStateMachine.transition(STATE.CLAIMING, { now: 30 });
    TaskStateMachine.transition(STATE.VERIFYING, { now: 40 });
    assert.equal(TaskStateMachine.transition(STATE.SCANNING, { now: 50 }), true);
});

test('非法转移被拒绝且不改变状态', () => {
    fresh();
    assert.equal(TaskStateMachine.start(0), true);
    // SCANNING 不能直接跳到 VERIFYING
    assert.equal(TaskStateMachine.transition(STATE.VERIFYING, { now: 10 }), false);
    assert.equal(TaskStateMachine.state, STATE.SCANNING);
    // 也不能从 SCANNING 直接回到 IDLE 以外的无关状态
    assert.equal(TaskStateMachine.transition(STATE.RATE_LIMITED, { now: 20 }), true, '限速是全局逃生通道');
});

test('重复转移到当前状态是空操作', () => {
    fresh();
    TaskStateMachine.start(0);
    assert.equal(TaskStateMachine.transition(STATE.SCANNING, { now: 10 }), false);
    assert.equal(TaskStateMachine.history.length, 1);
});

test('IDLE 与 RATE_LIMITED 是全局逃生通道', () => {
    fresh();
    // 任意状态下都可以被用户停止
    TaskStateMachine.start(0);
    TaskStateMachine.transition(STATE.CLAIMING, { now: 10 });
    assert.equal(TaskStateMachine.stop(20), true);
    assert.equal(TaskStateMachine.state, STATE.IDLE);

    // 任意状态下都可能撞上 429
    TaskStateMachine.start(30);
    TaskStateMachine.transition(STATE.CLAIMING, { now: 40 });
    TaskStateMachine.transition(STATE.VERIFYING, { now: 50 });
    assert.equal(TaskStateMachine.hitRateLimit(60, 30000), true);
    assert.equal(TaskStateMachine.state, STATE.RATE_LIMITED);
});

test('RATE_LIMITED 只能回到 CLAIMING 或 IDLE', () => {
    fresh();
    TaskStateMachine.start(0);
    TaskStateMachine.hitRateLimit(10, 1000);
    assert.equal(TaskStateMachine.transition(STATE.SCANNING, { now: 20 }), false, '不得直接跳回 SCANNING');
    assert.equal(TaskStateMachine.state, STATE.RATE_LIMITED);
    assert.equal(TaskStateMachine.transition(STATE.CLAIMING, { now: 20 }), true);
});

test('DONE 只能通过 IDLE 重新开始', () => {
    fresh();
    TaskStateMachine.start(0);
    assert.equal(TaskStateMachine.transition(STATE.DONE, { now: 10 }), true);
    assert.equal(TaskStateMachine.transition(STATE.SCANNING, { now: 20 }), false);
    assert.equal(TaskStateMachine.transition(STATE.IDLE, { now: 30 }), true);
    assert.equal(TaskStateMachine.start(40), true);
});

test('tick 在超时后按策略表自动转移', () => {
    fresh();
    TaskStateMachine.start(0);
    // SCANNING 超时 15s → DONE
    assert.equal(TaskStateMachine.tick(14000), null, '未超时不应转移');
    const r = TaskStateMachine.tick(15000);
    assert.deepEqual(r, { from: STATE.SCANNING, to: STATE.DONE, reason: '分页拉取超时，按列表结束处理', timedOut: true });
    assert.equal(TaskStateMachine.state, STATE.DONE);
});

test('CLAIMING 超时转入退避，VERIFYING 超时回到领取', () => {
    fresh();
    TaskStateMachine.start(0);
    TaskStateMachine.transition(STATE.CLAIMING, { now: 10 });

    const c = TaskStateMachine.tick(20010);
    assert.equal(c.to, STATE.RATE_LIMITED);
    assert.equal(TaskStateMachine.state, STATE.RATE_LIMITED);

    // 从退避回到领取，再进复查
    TaskStateMachine.transition(STATE.CLAIMING, { now: 30000 });
    TaskStateMachine.transition(STATE.VERIFYING, { now: 30010 });
    const v = TaskStateMachine.tick(38010);
    assert.equal(v.to, STATE.CLAIMING);
    assert.equal(TaskStateMachine.state, STATE.CLAIMING);
});

test('RATE_LIMITED 超时交回用户 IDLE', () => {
    fresh();
    TaskStateMachine.start(0);
    TaskStateMachine.hitRateLimit(10, 5000);
    assert.equal(TaskStateMachine.tick(600010).to, STATE.IDLE);
});

test('IDLE 与 DONE 没有超时，tick 返回 null', () => {
    fresh();
    assert.equal(TaskStateMachine.tick(999999), null);
    TaskStateMachine.start(0);
    TaskStateMachine.transition(STATE.DONE, { now: 10 });
    assert.equal(TaskStateMachine.tick(999999), null);
});

test('remainingMs 反映当前状态剩余时间', () => {
    fresh();
    TaskStateMachine.start(0);
    assert.equal(TaskStateMachine.remainingMs(0), 15000);
    assert.equal(TaskStateMachine.remainingMs(5000), 10000);
    assert.equal(TaskStateMachine.remainingMs(20000), 0, '超时后不为负');
    assert.equal(TaskStateMachine.remainingMs(0), 15000);

    TaskStateMachine.reset(0);
    assert.equal(TaskStateMachine.remainingMs(0), Infinity, 'IDLE 无超时上限');
});

test('状态变更会通知监听器，监听器抛异常不影响状态机', () => {
    fresh();
    const seen = [];
    TaskStateMachine.onChange(e => seen.push(`${e.from}->${e.to}`));
    TaskStateMachine.onChange(() => { throw new Error('监听器炸了'); });
    TaskStateMachine.onChange(e => seen.push(`reason=${e.reason}`));

    assert.doesNotThrow(() => TaskStateMachine.start(0));
    assert.deepEqual(seen, ['IDLE->SCANNING', 'reason=用户开始']);
    assert.equal(TaskStateMachine.state, STATE.SCANNING);
});

test('history 有上限，长时间运行不会无限增长', () => {
    fresh();
    for (let i = 0; i < 200; i++) {
        TaskStateMachine.start(i * 2);
        TaskStateMachine.stop(i * 2 + 1);
    }
    assert.ok(TaskStateMachine.history.length <= 50, 'history 应被截断到 50 条');
});

test('取消订阅后不再收到通知', () => {
    fresh();
    let count = 0;
    const off = TaskStateMachine.onChange(() => { count += 1; });
    TaskStateMachine.start(0);
    assert.equal(count, 1);
    off();
    TaskStateMachine.stop(10);
    assert.equal(count, 1);
});
