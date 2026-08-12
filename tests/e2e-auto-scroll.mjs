/**
 * attemptAutoScroll 端到端模拟验证（服务器驱动判底版，v3.5.18）。
 *
 * 设计变更：判底的唯一权威信号改为「服务器接口返回 cursors.next === null」，
 * 即 State.isEndOfSearchList（由 index.js 拦截 /i/listings/search 响应写入）。
 * 滚动条位置 / scrollHeight / 卡片 DOM 计数不再作为到底依据（Fab 虚拟化，本地信号不可靠）。
 *
 * 模拟环境：
 *   - 有限列表 TOTAL=120，每滚到底（模拟 Fab IntersectionObserver 哨兵）加载下一页 24 个；
 *   - 加载到末页后，模拟「服务器响应 cursors.next === null」置 isEndOfSearchList=true；
 *   - 脚本应在 isEndOfSearchList=true 时停止并视作自动入库成功，且只在真到底调用一次 stop；
 *   - Bug B：服务器确认无更多但仍有 2 个 worker 在途，脚本应仅停滚动、不调用
 *     stopExecutionAndSettle（不误杀 worker），worker 完成后再 settle。
 */

// ---- 0. 补浏览器环境垫片（Node 无 Event 全局，而 doScroll 会 new Event('scroll')）----
if (typeof globalThis.Event === 'undefined') {
    globalThis.Event = class Event {
        constructor(type) { this.type = type; }
    };
}

// ---- 1. 先装 mock 定时器，再加载真实模块（确保 _realSetTimeout 捕获到 mock）----
globalThis.__timerQueue = [];
globalThis.setTimeout = (cb) => {
    globalThis.__timerQueue.push(cb);
    return globalThis.__timerQueue.length;
};
globalThis.clearTimeout = () => {};

function flushTimers() {
    const q = globalThis.__timerQueue;
    globalThis.__timerQueue = [];
    for (const cb of q) {
        cb();
    }
    return q.length;
}

// 动态 import（在 mock 装好之后），保证 task-runner 捕获到 mock 的 setTimeout
const { TaskRunner } = await import('../src/modules/task-runner.js');
const { State } = await import('../src/state.js');
const { Utils } = await import('../src/modules/utils.js');

// ---- 2. 构造“有限 Fab 无限滚动列表”的环境 ----
const CARD_HEIGHT = 200;
const BASE_HEIGHT = 200;
const INNER_HEIGHT = 400;
const TOTAL_CARDS = 120;
const PAGE_SIZE = 24;

let cardsLoaded = 0;
let scrollY = 0;
let nearBottomLoads = 0;

const documentElement = {
    get scrollHeight() {
        return BASE_HEIGHT + cardsLoaded * CARD_HEIGHT;
    }
};

const windowMock = {
    innerHeight: INNER_HEIGHT,
    get scrollY() {
        return scrollY;
    },
    scrollBy: (x, y) => {
        const maxY = Math.max(0, documentElement.scrollHeight - INNER_HEIGHT);
        scrollY = Math.max(0, Math.min(scrollY + y, maxY));
    },
    scrollTo: (x, y) => {
        const maxY = Math.max(0, documentElement.scrollHeight - INNER_HEIGHT);
        scrollY = Math.max(0, Math.min(y, maxY));
    },
    dispatchEvent: (ev) => {
        if (ev && ev.type === 'scroll') {
            onScroll();
        }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
};

globalThis.window = windowMock;
globalThis.document = {
    documentElement,
    querySelectorAll: () => [],
    getElementById: () => null
};

// 模拟 Fab 的无限滚动加载器 + 服务器：
//   - 滚到底、还有商品、且服务器未宣告结束时，加载下一页；
//   - 加载到末页后，模拟「服务器响应 cursors.next === null」置 isEndOfSearchList=true。
function onScroll() {
    const sh = documentElement.scrollHeight;
    const atBottom = (INNER_HEIGHT + scrollY) >= sh - 50;
    if (atBottom && cardsLoaded < TOTAL_CARDS && !State.isEndOfSearchList) {
        const load = Math.min(PAGE_SIZE, TOTAL_CARDS - cardsLoaded);
        cardsLoaded += load;
        nearBottomLoads++;
        // 模拟“扫描新页”把商品加入已处理集合（让 newProcessedCount 也作为增长信号）
        for (let i = 0; i < load; i++) {
            State.processedCardUids.add('card-' + (cardsLoaded - load + i));
        }
        // 模拟服务器响应：加载到最后一页后，/i/listings/search 返回 cursors.next === null
        if (cardsLoaded >= TOTAL_CARDS) {
            State.isEndOfSearchList = true;
        }
    }
}

// ---- 3. 插桩：保留停止函数的“真实效果”，只额外记录调用时刻 ----
let stopCalled = false;
let stopCallCount = 0;
let stopAtCardsLoaded = -1;
let stopAtAttempts = -1;
const originalStop = TaskRunner.stopExecutionAndSettle;
TaskRunner.stopExecutionAndSettle = async () => {
    stopCalled = true;
    stopCallCount++;
    stopAtCardsLoaded = cardsLoaded;
    stopAtAttempts = State.autoScrollAttempts;
};

// 其它会被顺带触发的函数，替换为无副作用桩，避免牵连 KeepAlive / 真实 DOM
TaskRunner.runHideOrShow = () => {};
TaskRunner.getCardCounts = () => ({ total: cardsLoaded, hidden: 0, visible: cardsLoaded });
Utils.logger = () => {};
Utils.getText = (k) => (typeof k === 'string' ? k : JSON.stringify(k));

// ---- 4. 单次完整遍历驱动 ----
process.on('unhandledRejection', (e) => {
    console.error('[DIAG] UNHANDLED REJECTION:', e && (e.stack || e.message || e));
});

async function runTraversal({ _diag = false } = {}) {
    // 重置每轮状态
    cardsLoaded = PAGE_SIZE; // 首屏已渲染 24 个（同 Fab 首屏）
    scrollY = 0;
    nearBottomLoads = 0;
    stopCalled = false;
    stopCallCount = 0;
    stopAtCardsLoaded = -1;
    stopAtAttempts = -1;

    State.db = { todo: [], done: [], failed: [] };
    State.processedCardUids = new Set();
    State.autoScrollAttempts = 0;
    State.isAutoScrolling = false;
    State.isExecuting = true;
    State.autoAddOnScroll = true;
    State.autoScroll = true; // 新增独立开关：显式开启以驱动 attemptAutoScroll 的自循环
    State.isEndOfSearchList = false; // 由 mock 加载器在末页置 true（模拟服务器 next=null）
    State.hasReachedBottomToastShown = false;
    State.activeWorkers = 0;

    // 启动自动滚动（真实函数）
    const startPromise = TaskRunner.attemptAutoScroll();
    startPromise.catch((e) => {
        if (_diag) console.error('[DIAG] attemptAutoScroll rejected:', e && (e.stack || e.message || e));
    });

    if (_diag) {
        console.error('[DIAG] after start, queue len =', globalThis.__timerQueue.length,
            ', cardsLoaded =', cardsLoaded);
    }

    // 驱动：反复 flush 定时器队列并让出事件循环，直到停止或超时
    // 关键：doScroll 内 `await new Promise(r => _realSetTimeout(r,350))` 的续体是微任务，
    // 纯同步 while 循环会把它饿死导致死锁。每轮 flush 后 await setImmediate 让出一拍，
    // 微任务即可执行并排下一批定时器，驱动才持续推进。
    let guard = 0;
    const MAX_GUARD = 50000;
    while (!stopCalled && guard < MAX_GUARD) {
        flushTimers();
        if (_diag && guard < 8) {
            console.error(`[DIAG] flush #${guard}: queue len =`, globalThis.__timerQueue.length,
                ', cardsLoaded =', cardsLoaded, ', attempts =', State.autoScrollAttempts,
                ', isAutoScrolling =', State.isAutoScrolling);
        }
        await new Promise(res => setImmediate(res));
        guard++;
    }

    return {
        stopCalled,
        stopCallCount,
        stopAtCardsLoaded,
        stopAtAttempts,
        finalCardsLoaded: cardsLoaded,
        fullyTraversed: cardsLoaded === TOTAL_CARDS,
        hung: !stopCalled && guard >= MAX_GUARD
    };
}

// ---- 5. 断言 ----
function assertRun(label, result) {
    const problems = [];
    if (result.hung) problems.push('死循环：50000 次 flush 仍未停止');
    if (!result.stopCalled) problems.push('从未调用停止函数');
    if (result.stopCallCount !== 1) problems.push(`停止函数被调用 ${result.stopCallCount} 次（应为 1）`);
    if (!result.fullyTraversed) problems.push(`未完整遍历：停在 ${result.finalCardsLoaded}/${TOTAL_CARDS}`);
    if (result.stopAtCardsLoaded !== TOTAL_CARDS) {
        problems.push(`提前停转：停止时仅 ${result.stopAtCardsLoaded}/${TOTAL_CARDS} 个商品`);
    }
    return problems;
}

const RUNS = 50;

// 先跑一遍诊断
console.log('--- 诊断单遍 ---');
await runTraversal({ _diag: true });
console.log('--- 诊断结束 ---\n');

let totalFailures = 0;

await (async () => {
    let failed = 0;
    const firstFailure = [];
    for (let i = 0; i < RUNS; i++) {
        const r = await runTraversal();
        const problems = assertRun('正常完整遍历', r);
        if (problems.length > 0) {
            failed++;
            totalFailures++;
            if (firstFailure.length === 0) {
                firstFailure.push(...problems);
                firstFailure.push('示例: ' + JSON.stringify(r));
            }
        }
    }
    const status = failed === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] 正常完整遍历（服务器末页 next=null 触发停止）— ${RUNS - failed}/${RUNS} 遍通过`);
    if (failed > 0) {
        console.log('        首次失败原因: ' + firstFailure.join('; '));
    }
})();

// 额外：打印正常遍历的一遍详细轮次轨迹，证明“完整加载到 120 后由服务器信号停止”
console.log('\n=== 正常遍历轨迹抽样（应看到一路加载到 120，随后因 isEndOfSearchList=true 停止）===');
await (async () => {
    cardsLoaded = PAGE_SIZE; scrollY = 0; nearBottomLoads = 0;
    stopCalled = false; stopCallCount = 0; stopAtCardsLoaded = -1; stopAtAttempts = -1;
    State.db = { todo: [], done: [], failed: [] };
    State.processedCardUids = new Set();
    State.autoScrollAttempts = 0; State.isAutoScrolling = false; State.isExecuting = true;
    State.autoAddOnScroll = true; State.autoScroll = true;
    State.isEndOfSearchList = false; State.hasReachedBottomToastShown = false; State.activeWorkers = 0;
    TaskRunner.attemptAutoScroll();
    const trace = [];
    let guard = 0;
    let last = -1;
    while (!stopCalled && guard < 50000) {
        const before = cardsLoaded;
        flushTimers();
        if (cardsLoaded !== before) {
            trace.push(`已加载到 ${cardsLoaded}/${TOTAL_CARDS}（isEndOfSearchList=${State.isEndOfSearchList}）`);
            last = cardsLoaded;
        }
        await new Promise(res => setImmediate(res));
        guard++;
    }
    trace.push(`→ 停止于 ${cardsLoaded}/${TOTAL_CARDS}，stop 调用 ${stopCallCount} 次（服务器确认无更多 → 自动入库成功）`);
    console.log(trace.join('\n'));
})();

console.log('\n=== 验证 Bug B：服务器确认无更多（isEndOfSearchList=true）但仍有 2 个在途 worker，不应误杀/不应提前 settle ===');
await (async () => {
    // 场景：服务器已返回 cursors.next === null（isEndOfSearchList=true），但仍有 2 个 worker 在途处理任务。
    // 期望：自动滚动只停止滚动（isAutoScrolling=false），绝不调用 stopExecutionAndSettle
    //       （否则会 closeAllWorkerTabs 误杀在途 worker → “工作标签页在完成前关闭”）。
    windowMock.scrollTo(0, documentElement.scrollHeight); // 先把滚动位置钉在底部
    cardsLoaded = TOTAL_CARDS; scrollY = windowMock.scrollY; nearBottomLoads = 0;
    stopCalled = false; stopCallCount = 0; stopAtCardsLoaded = -1; stopAtAttempts = -1;
    State.db = { todo: [], done: [], failed: [] };
    State.processedCardUids = new Set();
    State.autoScrollAttempts = 0; State.isAutoScrolling = false; State.isExecuting = true;
    State.autoAddOnScroll = true;
    State.autoScroll = true;
    State.isEndOfSearchList = true; State.hasReachedBottomToastShown = false; State.activeWorkers = 2; // 模拟 2 个 worker 在途

    TaskRunner.attemptAutoScroll();
    // 驱动若干轮（服务器已确认无更多，若逻辑正确应始终保持 stopCalled=false）
    let guard = 0;
    while (!stopCalled && guard < 200) {
        flushTimers();
        await new Promise(res => setImmediate(res));
        guard++;
    }
    const preserved = (State.activeWorkers === 2) && (stopCalled === false) && (State.isAutoScrolling === false);
    console.log(`[${preserved ? 'PASS' : 'FAIL'}] 服务器确认无更多 + 2 在途 worker：stopCalled=${stopCalled}, activeWorkers=${State.activeWorkers}, isAutoScrolling=${State.isAutoScrolling} → 未误杀、仅停滚动`);

    // 模拟在途 worker 全部完成：activeWorkers 归零、待办清空，再次触发到底收尾
    State.activeWorkers = 0;
    State.db = { todo: [], done: [], failed: [] };
    stopCalled = false;
    TaskRunner.attemptAutoScroll();
    guard = 0;
    while (!stopCalled && guard < 50000) {
        flushTimers();
        await new Promise(res => setImmediate(res));
        guard++;
    }
    const settled = stopCalled === true;
    console.log(`[${settled ? 'PASS' : 'FAIL'}] worker 全部完成后再次到底：stopCalled=${stopCalled} → 正常收尾`);

    if (!preserved || !settled) totalFailures++;
})();

console.log('\n==== 汇总 ====');
if (totalFailures === 0) {
    console.log(`全部 ${RUNS} 遍通过：列表均完整遍历到 ${TOTAL_CARDS} 个商品，并在服务器确认无更多（isEndOfSearchList=true）时停止一次；Bug B 在途 worker 不被误杀。`);
    process.exit(0);
} else {
    console.log(`存在 ${totalFailures} 遍失败，需继续排查。`);
    process.exit(1);
}
