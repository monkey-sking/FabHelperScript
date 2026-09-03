import test from 'node:test';
import assert from 'node:assert/strict';

import { EventLog, EVENT_STATE } from '../src/modules/event-log.js';
import { Database } from '../src/modules/database.js';

function fresh() {
    EventLog.reset();
    return EventLog;
}

test('uidOf 与 Database.getListingUid 在 URL 形态上行为一致（防止两份实现漂移）', () => {
    const samples = [
        'https://www.fab.com/listings/ABC123',
        'https://www.fab.com/zh-cn/listings/def-456?utm_source=x',
        'https://www.fab.com/listings/xyz_789/ref/foo',
        'https://www.fab.com/listings/',
        'https://www.fab.com/sellers/foo',
        '',
        null
    ];
    samples.forEach(s => {
        assert.equal(EventLog.uidOf(s), Database.getListingUid(s), `样本不一致: ${s}`);
    });
});

test('uidOf 额外支持裸 uid（EventLog 以 uid 为键，这是对 Database 的有意超集）', () => {
    assert.equal(EventLog.uidOf('plain-uid'), 'plain-uid');
    assert.equal(EventLog.uidOf('ABC_123-x'), 'abc_123-x');
    // Database 只认含 /listings/ 的 URL，裸 uid 返回空——此处显式记录该差异，
    // 若将来统一了两份实现，这条断言会失败并提醒同步更新。
    assert.equal(Database.getListingUid('plain-uid'), '');
    // 含路径分隔符等非法字符的裸输入仍应被拒绝
    assert.equal(EventLog.uidOf('not a valid uid'), '');
    assert.equal(EventLog.uidOf('a/b'), '');
});

test('append 会继承上一次已知的名称与链接', () => {
    fresh();
    EventLog.append('https://www.fab.com/listings/uid-1', EVENT_STATE.DISCOVERED, {
        name: 'Odin Inspector', url: 'https://www.fab.com/listings/uid-1'
    });
    // 后续事件不携带 name/url
    EventLog.append('uid-1', EVENT_STATE.CLAIMED);

    const latest = EventLog.latestOf('uid-1');
    assert.equal(latest.state, EVENT_STATE.CLAIMED);
    assert.equal(latest.name, 'Odin Inspector');
    assert.equal(latest.url, 'https://www.fab.com/listings/uid-1');
});

test('最新事件决定派生视图：先失败后成功应归为已入库', () => {
    fresh();
    const uid = 'https://www.fab.com/listings/uid-2';
    EventLog.append(uid, EVENT_STATE.DISCOVERED, { name: 'Pack A' });
    assert.equal(EventLog.isPending(uid), true);

    EventLog.append(uid, EVENT_STATE.FAILED, { reason: '超时' });
    assert.equal(EventLog.isFailed(uid), true);
    assert.equal(EventLog.isDone(uid), false);

    EventLog.append(uid, EVENT_STATE.CLAIMED);
    assert.equal(EventLog.isDone(uid), true);
    assert.equal(EventLog.isFailed(uid), false, '成功必须覆盖此前的失败，无需手工清理 failed 数组');

    assert.equal(EventLog.getTodo().length, 0);
    assert.equal(EventLog.getDone().length, 1);
    assert.equal(EventLog.getFailed().length, 0, '陈旧失败项不应残留在派生视图中');
});

test('同一 uid 重复 discovered 只产生一条待办', () => {
    fresh();
    EventLog.append('uid-3', EVENT_STATE.DISCOVERED, { name: 'Pack B' });
    EventLog.append('uid-3', EVENT_STATE.DISCOVERED, { name: 'Pack B' });
    assert.equal(EventLog.getTodo().length, 1);
    assert.equal(EventLog.stats().total, 1);
});

test('跳过态与失败态互不混淆', () => {
    fresh();
    EventLog.append('uid-skip', EVENT_STATE.SKIPPED, { reason: '付费商品' });
    EventLog.append('uid-fail', EVENT_STATE.FAILED, { reason: '人机验证' });
    assert.equal(EventLog.isSkipped('uid-skip'), true);
    assert.equal(EventLog.isFailed('uid-skip'), false);
    assert.equal(EventLog.getFailed().length, 1);
    assert.equal(EventLog.getFailed()[0].failureReason, '人机验证');
});

test('非法输入被拒绝且不污染日志', () => {
    fresh();
    assert.equal(EventLog.append('', EVENT_STATE.CLAIMED), null);
    assert.equal(EventLog.append(null, EVENT_STATE.CLAIMED), null);
    assert.equal(EventLog.append('uid-4', 'not-a-real-state'), null);
    assert.equal(EventLog.events.length, 0);
    assert.equal(EventLog.stats().total, 0);
});

test('prune 截断体积但绝不丢失任何 uid 的最新事件', async () => {
    fresh();
    // 20 个 uid，每个写 2 条事件
    for (let i = 0; i < 20; i++) {
        const uid = `uid-p${i}`;
        EventLog.append(uid, EVENT_STATE.DISCOVERED, { name: `Pack ${i}` });
        EventLog.append(uid, i % 2 === 0 ? EVENT_STATE.CLAIMED : EVENT_STATE.FAILED);
    }
    assert.equal(EventLog.events.length, 40);
    assert.equal(EventLog.stats().total, 20);

    const removed = EventLog.prune(10);
    assert.ok(removed > 0, '应有事件被截断');
    assert.ok(EventLog.events.length <= 30, '补回最新事件后体积仍需受控');
    // 关键断言：20 个 uid 的终态一个都不能错
    assert.equal(EventLog.stats().total, 20);
    for (let i = 0; i < 20; i++) {
        const expected = i % 2 === 0 ? EVENT_STATE.CLAIMED : EVENT_STATE.FAILED;
        assert.equal(EventLog.stateOf(`uid-p${i}`), expected, `uid-p${i} 的终态被截断破坏`);
    }
});

test('load 会清洗缺少 uid 或状态非法的脏数据', async () => {
    fresh();
    globalThis.GM_getValue = async () => ([
        { uid: 'uid-ok', state: EVENT_STATE.CLAIMED, ts: 1 },
        { uid: '', state: EVENT_STATE.CLAIMED, ts: 2 },
        { uid: 'uid-bad-state', state: 'whatever', ts: 3 },
        null,
        { state: EVENT_STATE.CLAIMED, ts: 4 }
    ]);
    const loaded = await EventLog.load();
    assert.equal(loaded, 1);
    assert.equal(EventLog.isDone('uid-ok'), true);
    assert.equal(EventLog.stats().total, 1);
});

test('importLegacy / exportLegacy 往返保持等价', () => {
    fresh();
    EventLog.importLegacy({
        todo: [{ uid: 'a', url: 'https://www.fab.com/listings/a', name: 'A' }],
        done: ['https://www.fab.com/listings/b'],
        failed: [{ uid: 'c', url: 'https://www.fab.com/listings/c', name: 'C', failureReason: '超时' }]
    });

    assert.equal(EventLog.isPending('a'), true);
    assert.equal(EventLog.isDone('b'), true);
    assert.equal(EventLog.isFailed('c'), true);

    const legacy = EventLog.exportLegacy();
    assert.deepEqual(legacy.todo, [{ uid: 'a', url: 'https://www.fab.com/listings/a', name: 'A' }]);
    assert.deepEqual(legacy.done, ['https://www.fab.com/listings/b']);
    assert.equal(legacy.failed[0].failureReason, '超时');
});

test('importLegacy 中 done 覆盖 todo（同一 uid 已在库则不再待办）', () => {
    fresh();
    EventLog.importLegacy({
        todo: [{ uid: 'dup', url: 'https://www.fab.com/listings/dup', name: 'Dup' }],
        done: ['https://www.fab.com/listings/dup'],
        failed: []
    });
    assert.equal(EventLog.isDone('dup'), true);
    assert.equal(EventLog.getTodo().length, 0);
});
