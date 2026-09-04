/**
 * Detail Claim 测试
 *
 * 这段逻辑原本深埋在 TaskRunner.processDetailPage（约 885 行）里，与 worker 标签页的
 * 任务装载/回传焊在一起，既没法单测也没法被新流水线复用。抽成模块后，环境依赖
 * （document / window / Utils / API / 定时器）全部可注入，于是可以用一个极简的假 DOM
 * 在 Node 里把「找按钮 → 点 → 等它变成已拥有」完整跑一遍 —— 包括原本只能靠线上
 * 观察的超时与降级分支。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { acquireOnDetailPage } from '../src/modules/detail-claim.js';

/** 极简假节点：只实现领取逻辑真正会碰到的那几个属性 */
function makeNode(spec = {}) {
    const node = {
        tag: spec.tag || 'button',
        textContent: spec.text || '',
        classes: spec.classes || [],
        attrs: spec.attrs || {},
        dataset: {},
        disabled: Boolean(spec.disabled),
        ownerDocument: null,   // 由 makeDoc 补上
        onClick: spec.onClick, // 可在建好之后再覆盖（模拟「点击后页面才变化」）
        // hidden 的节点不参与任何查询，用来模拟「点击之后才渲染出来」的元素。
        // 不要用「点击后再 push 进数组」来模拟：那样新节点的 ownerDocument 会是 null，
        // 而真实 DOM 里任何节点都有 ownerDocument，假节点一缺失就会被误判成结算上下文。
        hidden: Boolean(spec.hidden),
        clicks: 0,
        classList: {
            contains: (cls) => (spec.classes || []).includes(cls)
        },
        getAttribute: (name) => (spec.attrs && spec.attrs[name] !== undefined ? spec.attrs[name] : null),
        focus: () => {},
        click() {
            node.clicks += 1;
            if (typeof node.onClick === 'function') node.onClick(node);
        },
        matches: (selector) => matchSelector(node, selector)
    };
    return node;
}

/** 只覆盖本模块实际用到的选择器形态，够用即可 */
function matchSelector(node, selector) {
    return String(selector).split(',').map(s => s.trim().toLowerCase()).some(part => {
        if (!part) return false;
        if (part === 'button') return node.tag === 'button';
        if (part === 'a[href]') return node.tag === 'a' && Boolean(node.attrs.href);
        if (part === '[role="button"]') return node.attrs.role === 'button';
        if (part === 'main') return node.tag === 'main';
        if (part === 'h1') return node.tag === 'h1';
        if (part.includes('[class*=')) {
            const token = part.split('[class*=')[1].replace(/["'\]]/g, '');
            return node.classes.some(c => c.toLowerCase().includes(token));
        }
        if (part.startsWith('.')) {
            const cls = part.slice(1);
            return node.classes.some(c => c.toLowerCase() === cls);
        }
        if (part.includes('.')) {
            const [tag, ...rest] = part.split('.');
            return node.tag === tag && rest.every(r => node.classes.some(c => c.toLowerCase() === r));
        }
        return false;
    });
}

function makeDoc(nodes) {
    const doc = {
        readyState: 'complete',
        title: 'Fake Listing',
        nodes,
        body: { textContent: '' },
        querySelectorAll(selector) {
            return doc.nodes.filter(n => !n.hidden && n.matches(selector));
        },
        querySelector(selector) {
            return doc.querySelectorAll(selector)[0] || null;
        }
    };
    nodes.forEach(n => { n.ownerDocument = doc; });
    return doc;
}

/**
 * 造一套可注入的运行环境。
 * 定时器全部虚拟化：sleep 只推进时钟不真等，interval 手动 tick，
 * 于是「8 秒轮询」「60 秒超时」这类分支可以在毫秒内跑完并断言。
 */
function makeHarness({ nodes = [], api = {}, taskRunner = {} } = {}) {
    // 时钟必须起在真实量级上：结算按钮的「2 秒冷静期」是用 now - lastClickTime 判的，
    // 若从 0 开始，第一次点击时 now 也是 0，冷静期判定会把它当成「刚刚点过」而跳过点击
    // —— 那是假时钟的锅，真实环境 Date.now() 永远是个巨大的值。
    let clock = 1_700_000_000_000;
    const intervals = [];
    const doc = makeDoc(nodes);

    const opts = {
        doc,
        win: {
            getComputedStyle: () => null,
            location: { pathname: '/listings/fake-uid', href: 'https://www.fab.com/listings/fake-uid' }
        },
        utils: {
            normalizeWhitespace: (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim(),
            deepClick: (el) => { if (el && typeof el.click === 'function') el.click(); },
            getCookie: (name) => (name === 'fab_csrftoken' ? 'test-csrf' : null),
            findAllButtonsWithShadow: (root) => (root && root.querySelectorAll ? root.querySelectorAll('button') : [])
        },
        api: {
            gmFetch: async () => ({ responseText: '[]' }),
            extractStateData: () => [],
            ...api
        },
        diagnostics: { diagnoseDetailPage: () => ({ pageTitle: 'Fake Listing', buttons: [] }) },
        taskRunner: {
            getExternalProductState: () => ({ handled: false }),
            findFreeLicenseOption: () => null,
            isFreeCard: () => false,
            ...taskRunner
        },
        MutationObserver: null,
        sleep: async (ms) => { clock += ms; },
        setTimeoutFn: () => 0,
        clearTimeoutFn: () => {},
        setIntervalFn: (fn) => { const handle = { fn }; intervals.push(handle); return handle; },
        clearIntervalFn: (handle) => {
            const i = intervals.indexOf(handle);
            if (i >= 0) intervals.splice(i, 1);
        },
        now: () => clock,
        log: () => {}
    };

    const flush = async (n = 3) => {
        for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r));
    };
    const tick = async (count = 1) => {
        for (let i = 0; i < count; i++) {
            clock += 500;
            for (const handle of [...intervals]) await handle.fn();
        }
    };

    return { doc, opts, tick, flush, clockOf: () => clock, intervalCount: () => intervals.length };
}

const TASK = { uid: 'fake-uid', name: 'Fake Asset', url: 'https://www.fab.com/listings/fake-uid' };

test('主路径：点击「添加到我的库」后变为已拥有徽章 → 成功', async () => {
    const addButton = makeNode({
        text: '添加到我的库',
        onClick: (node) => { node.textContent = '已保存在我的库中'; }
    });
    const h = makeHarness({ nodes: [makeNode({ tag: 'main' }), addButton] });

    const promise = acquireOnDetailPage(TASK, h.opts);
    await h.flush();
    await h.tick(2);
    const result = await promise;

    assert.equal(result.success, true);
    assert.equal(addButton.clicks, 1, '添加按钮应被点击一次');
    assert.ok(result.logs.some(l => l.includes('Found add button')), result.logs.join(' | '));
});

test('API 复查已拥有时不碰 UI，直接判成功', async () => {
    let clicks = 0;
    const addButton = makeNode({
        text: '添加到我的库',
        onClick: () => { clicks += 1; }
    });
    const h = makeHarness({
        nodes: [makeNode({ tag: 'main' }), addButton],
        api: {
            gmFetch: async () => ({
                responseText: JSON.stringify([{ uid: 'fake-uid', acquired: true }])
            })
        }
    });

    const result = await acquireOnDetailPage(TASK, h.opts);

    assert.equal(result.success, true);
    assert.equal(clicks, 0, '接口已确认入库，不应再走 DOM 点击');
    assert.ok(result.logs.some(l => l.includes('API check confirms item is already owned')));
});

test('外部链接商品判为已处理，不再尝试领取', async () => {
    const h = makeHarness({
        nodes: [makeNode({ tag: 'main' }), makeNode({ text: '订阅' })],
        taskRunner: {
            getExternalProductState: () => ({ handled: true, reason: 'External CTA "在外部网站查看"' })
        }
    });

    const result = await acquireOnDetailPage(TASK, h.opts);

    assert.equal(result.success, true);
    assert.ok(result.logs.some(l => l.includes('Marking task as handled')));
});

test('找不到动作按钮 → 明确失败，而不是把商品误标成已领取', async () => {
    const h = makeHarness({ nodes: [makeNode({ tag: 'main' }), makeNode({ text: '订阅更新' })] });

    const result = await acquireOnDetailPage(TASK, h.opts);

    assert.equal(result.success, false);
    assert.ok(result.logs.some(l => l.includes('Could not find an add button')), result.logs.join(' | '));
    assert.equal(h.intervalCount(), 0, '没有可点的按钮就不该起等待循环');
});

test('需要结算时：点添加 → 出现 Place order → 点掉后变为已拥有', async () => {
    const addButton = makeNode({ text: '添加到我的库' });
    // 结算按钮是点了添加之后才渲染出来的
    const orderButton = makeNode({ text: 'Place order', hidden: true });

    addButton.onClick = () => { orderButton.hidden = false; };
    orderButton.onClick = () => { addButton.textContent = '在我的库中查看'; };

    const h = makeHarness({ nodes: [makeNode({ tag: 'main' }), addButton, orderButton] });

    const promise = acquireOnDetailPage(TASK, h.opts);
    await h.flush();
    await h.tick(1);            // 第一次轮询：添加按钮点完了，结算按钮刚出现
    assert.equal(orderButton.clicks, 1, '应主动找到并点击结算按钮');
    await h.tick(1);
    const result = await promise;

    assert.equal(result.success, true);
    assert.ok(result.logs.some(l => l.includes('Found checkout/place order button')));
});

test('结算按钮 2 秒内不重复点击，避免把它打成不可用', async () => {
    const addButton = makeNode({ text: '添加到我的库' });
    const orderButton = makeNode({ text: 'Place order' });
    const nodes = [makeNode({ tag: 'main' }), addButton, orderButton];
    const h = makeHarness({ nodes });

    const promise = acquireOnDetailPage(TASK, h.opts);
    await h.flush();
    // 每次 tick 只推进 500ms，连点 3 次也才 1.5s，不足 2s 冷静期
    await h.tick(3);

    assert.equal(orderButton.clicks, 1, '冷静期内的重复轮询不得重复点击');

    // 跑到超时收尾，避免留下悬空 promise
    await h.tick(130);
    const result = await promise;
    assert.equal(result.success, false);
});

test('一直等不到已拥有 → 60 秒后超时判失败（不挂死）', async () => {
    const addButton = makeNode({ text: '添加到我的库' });
    const h = makeHarness({ nodes: [makeNode({ tag: 'main' }), addButton] });

    const promise = acquireOnDetailPage(TASK, h.opts);
    await h.flush();
    await h.tick(130);          // 130 × 500ms = 65s > 60s 超时
    const result = await promise;

    assert.equal(result.success, false);
    assert.ok(result.logs.some(l => l.includes('Timeout waiting for ownership')), result.logs.join(' | '));
    assert.equal(h.intervalCount(), 0, '超时后必须清掉轮询，否则标签页会一直空转');
});

test('已拥有徽章在加载时就在 → 直接成功，一次都不点', async () => {
    const viewButton = makeNode({ text: '在我的库中查看' });
    const h = makeHarness({ nodes: [makeNode({ tag: 'main' }), viewButton] });

    const result = await acquireOnDetailPage(TASK, h.opts);

    assert.equal(result.success, true);
    assert.ok(result.logs.some(l => l.includes('Item already owned on page load')));
    assert.equal(viewButton.clicks, 0);
});

test('接口不可用（取不到 CSRF）时降级到 UI 判定，不抛错', async () => {
    const addButton = makeNode({
        text: '添加到我的库',
        onClick: (node) => { node.textContent = '已保存在我的库中'; }
    });
    const h = makeHarness({
        nodes: [makeNode({ tag: 'main' }), addButton],
        // 没有 CSRF：API 分支应直接降级，而不是让整条领取失败
    });
    h.opts.utils.getCookie = () => null;

    const promise = acquireOnDetailPage(TASK, h.opts);
    await h.flush();
    await h.tick(2);
    const result = await promise;

    assert.equal(result.success, true);
    assert.ok(result.logs.some(l => l.includes('Falling back to UI-based check')), result.logs.join(' | '));
});
