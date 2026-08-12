/**
 * attemptAutoScroll 端到端模拟验证（独立脚本，不依赖 node:test 的定时器）。
 *
 * 为什么这么测：
 *   之前的验证把 stopExecutionAndSettle 中和了，等于根本没检测“到底有没有提前停”，
 *   所以真实使用时一滚到底就停。这次保留停止函数并插桩记录，用“有限列表”去跑完整遍历：
 *   - 列表共 TOTAL 个商品，每次滚到底（模拟 Fab 的 IntersectionObserver 哨兵）就加载下一页；
 *   - 加载到 TOTAL 后不再增长，触发“连续无新内容”判定，脚本应在真到底时 stop；
 *   - 最坏情况：一开始就把 isEndOfSearchList 强制置 true（后端误报“已到末尾”），
 *     在 v3.5.13 逻辑下不应影响判底（判底只看连续无新内容 + 物理触底）。
 *
 * 关键：直接用动态 import 在 mock 定时器下加载【真实】的 task-runner 模块，
 * 跑的是真实的 attemptAutoScroll / doScroll 代码，停止函数保持真实生效（仅插桩记录）。
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

// 模拟 Fab 的无限滚动加载器：滚到底部（物理触底）且还有商品时，加载下一页
function onScroll() {
    const sh = documentElement.scrollHeight;
    const atBottom = (INNER_HEIGHT + scrollY) >= sh - 50;
    if (atBottom && cardsLoaded < TOTAL_CARDS) {
        const load = Math.min(PAGE_SIZE, TOTAL_CARDS - cardsLoaded);
        cardsLoaded += load;
        nearBottomLoads++;
        // 模拟“扫描新页”把商品加入已处理集合（让 newProcessedCount 也作为增长信号）
        for (let i = 0; i < load; i++) {
            State.processedCardUids.add('card-' + (cardsLoaded - load + i));
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

async function runTraversal({ forceEndOfList, _diag = false }) {
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
    State.isEndOfSearchList = !!forceEndOfList; // 最坏情况：后端提前误报“已到末尾”
    State.hasReachedBottomToastShown = false;

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

// ---- 5. 多轮运行 + 断言 ----
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
const variants = [
    { name: '正常情况（isEndOfSearchList 保持 false）', forceEndOfList: false },
    { name: '最坏情况（一开始强制 isEndOfSearchList=true，模拟“滚到底+后端误报结束”）', forceEndOfList: true }
];

// 先跑一遍诊断
console.log('--- 诊断单遍 ---');
await runTraversal({ forceEndOfList: true, _diag: true });
console.log('--- 诊断结束 ---\n');

let totalFailures = 0;

await (async () => {
for (const variant of variants) {
    let failed = 0;
    const firstFailure = [];
    for (let i = 0; i < RUNS; i++) {
        const r = await runTraversal({ forceEndOfList: variant.forceEndOfList });
        const problems = assertRun(variant.name, r);
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
    console.log(`[${status}] ${variant.name} — ${RUNS - failed}/${RUNS} 遍通过`);
    if (failed > 0) {
        console.log('        首次失败原因: ' + firstFailure.join('; '));
    }
}
})();

// 额外：打印最坏情况的一遍详细轮次轨迹，证明“滚到底也不提前停”
console.log('\n=== 最坏情况一遍的轨迹抽样（应看到一路加载到 120 才停）===');
await (async () => {
    cardsLoaded = PAGE_SIZE; scrollY = 0; nearBottomLoads = 0;
    stopCalled = false; stopCallCount = 0; stopAtCardsLoaded = -1; stopAtAttempts = -1;
    State.db = { todo: [], done: [], failed: [] };
    State.processedCardUids = new Set();
    State.autoScrollAttempts = 0; State.isAutoScrolling = false; State.isExecuting = true;
    State.autoAddOnScroll = true; State.isEndOfSearchList = true; State.hasReachedBottomToastShown = false;
    TaskRunner.attemptAutoScroll();
    const trace = [];
    let guard = 0;
    while (!stopCalled && guard < 50000) {
        const before = cardsLoaded;
        flushTimers();
        if (cardsLoaded !== before) {
            trace.push(`滚完一轮后已加载到 ${cardsLoaded}/${TOTAL_CARDS}（isEndOfSearchList=true 仍继续）`);
        }
        await new Promise(res => setImmediate(res));
        guard++;
    }
    trace.push(`→ 停止于 ${cardsLoaded}/${TOTAL_CARDS}，attempts=${stopAtAttempts}，stop 调用 ${stopCallCount} 次`);
    console.log(trace.join('\n'));
})();

console.log('\n==== 汇总 ====');
if (totalFailures === 0) {
    console.log(`全部 ${RUNS * variants.length} 遍通过：列表均完整遍历到 ${TOTAL_CARDS} 个商品，停止函数只在真到底时调用一次，滚到底+后端误报也不会提前停。`);
    process.exit(0);
} else {
    console.log(`存在 ${totalFailures} 遍失败，需继续排查。`);
    process.exit(1);
}
