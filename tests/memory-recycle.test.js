import test from 'node:test';
import assert from 'node:assert/strict';

import { TaskRunner, setDependencies } from '../src/modules/task-runner.js';
import { Config } from '../src/config.js';
import { State } from '../src/state.js';

const MEM_KEYS = {
    COUNT: 'fab_helper_mem_recycle_count_v1',
    LAST_AT: 'fab_helper_mem_recycle_last_at_v1',
    LAST_CURSOR: 'fab_helper_mem_recycle_last_cursor_v1',
    STRIKES: 'fab_helper_mem_recycle_strikes_v1',
    PENDING: 'fab_helper_mem_recycle_pending_v1'
};

function makeCursor(iso) {
    return btoa(`o=1&p=${iso}`);
}

function installMemoryEnv({ cards = 0 } = {}) {
    const store = new Map();
    globalThis.sessionStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear()
    };
    globalThis.document = {
        querySelectorAll: (selector) => ({ length: selector.includes('data-fab-card') ? cards : 0 })
    };
    return store;
}

function resetState() {
    State.autoScroll = true;
    State.apiPipelineActive = false;
    State.appStatus = 'NORMAL';
    State.manualVerificationPending = false;
    State.isAutoScrolling = false;
    State.isScanningTasks = false;
    State.isDispatchingTasks = false;
    State.isRefreshScheduled = false;
    State.isRecoveryMode = false;
    State.isEndOfSearchList = false;
    State.memoryRecycleInFlight = false;
    State.memoryRecycleDisabled = false;
    State.isWorkerTab = false;
    State.db.todo = [];
    State.activeWorkers = 0;
    State.savedCursor = makeCursor('2024-06-01T00:00:00.000Z');
}

test('canRecycleMemory: 达到阈值且完全空闲时返回 true', () => {
    installMemoryEnv({ cards: Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10 });
    resetState();

    assert.equal(TaskRunner.canRecycleMemory(), true);
});

test('getDomCardCount: 站点卡片选择器失效时回退到脚本标记', () => {
    installMemoryEnv({ cards: Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10 });
    resetState();

    assert.equal(TaskRunner.getDomCardCount(), Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10);
});

test('canRecycleMemory: 没有游标时绝不刷新（否则会从头重扫）', () => {
    installMemoryEnv({ cards: Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10 });
    resetState();
    State.savedCursor = null;

    assert.equal(TaskRunner.canRecycleMemory(), false);
});

test('canRecycleMemory: 队列或 worker 未空闲时不刷新', () => {
    installMemoryEnv({ cards: Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10 });
    resetState();
    State.db.todo = [{ uid: 'u1', url: 'https://www.fab.com/listings/u1' }];
    assert.equal(TaskRunner.canRecycleMemory(), false);

    resetState();
    State.activeWorkers = 1;
    assert.equal(TaskRunner.canRecycleMemory(), false);
});

test('canRecycleMemory: 未开启自动滚动/已到列表末尾时不刷新', () => {
    installMemoryEnv({ cards: Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10 });
    resetState();
    State.autoScroll = false;
    assert.equal(TaskRunner.canRecycleMemory(), false);

    resetState();
    State.isEndOfSearchList = true;
    assert.equal(TaskRunner.canRecycleMemory(), false);
});

test('canRecycleMemory: 最小间隔与单会话次数上限生效', () => {
    const store = installMemoryEnv({ cards: Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10 });
    resetState();
    store.set(MEM_KEYS.LAST_AT, String(Date.now()));
    assert.equal(TaskRunner.canRecycleMemory(), false);

    store.delete(MEM_KEYS.LAST_AT);
    store.set(MEM_KEYS.COUNT, String(Config.MEMORY_RECYCLE_MAX_PER_SESSION));
    assert.equal(TaskRunner.canRecycleMemory(), false);
});

test('maybeRecycleMemory: 触发后写入 pending 并调用刷新', () => {
    const store = installMemoryEnv({ cards: Config.MEMORY_RECYCLE_CARD_THRESHOLD + 10 });
    resetState();
    let reloads = 0;
    setDependencies({ reloadPage: () => { reloads += 1; } });

    try {
        assert.equal(TaskRunner.maybeRecycleMemory(), true);
        assert.equal(reloads, 1);
        assert.equal(store.get(MEM_KEYS.PENDING), '1');
        assert.equal(store.get(MEM_KEYS.LAST_CURSOR), State.savedCursor);
        assert.equal(Number(store.get(MEM_KEYS.COUNT)), 1);
    } finally {
        setDependencies({ reloadPage: () => {} });
    }
});

test('resumeAfterMemoryRecycle: 消费 pending 并安排续跑', () => {
    installMemoryEnv();
    resetState();
    sessionStorage.setItem(MEM_KEYS.PENDING, '1');

    const originalSetTimeout = globalThis.setTimeout;
    let scheduled = 0;
    globalThis.setTimeout = (fn) => { scheduled += 1; return 0; };
    try {
        assert.equal(TaskRunner.resumeAfterMemoryRecycle(), true);
        assert.equal(sessionStorage.getItem(MEM_KEYS.PENDING), null);
        assert.equal(scheduled, 1);
        // 再次调用不应重复续跑
        assert.equal(TaskRunner.resumeAfterMemoryRecycle(), false);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
    }
});

test('cursorSortTimestamp: 解析游标中的排序时间，无法解析时返回 null', () => {
    assert.equal(
        TaskRunner.cursorSortTimestamp(makeCursor('2024-01-02T03:04:05.000Z')),
        Date.parse('2024-01-02T03:04:05.000Z')
    );
    assert.equal(TaskRunner.cursorSortTimestamp('not-base64-cursor'), null);
});

test('_noteMemoryRecycleProgress: 位置退回开头累计 strike 后禁用回收', () => {
    installMemoryEnv();
    resetState();
    sessionStorage.setItem(MEM_KEYS.LAST_CURSOR, makeCursor('2024-01-01T00:00:00.000Z'));

    const newer = makeCursor('2024-09-01T00:00:00.000Z');
    TaskRunner._noteMemoryRecycleProgress(newer);
    assert.equal(State.memoryRecycleDisabled, false);
    TaskRunner._noteMemoryRecycleProgress(newer);
    assert.equal(State.memoryRecycleDisabled, true);
});
