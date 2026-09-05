/**
 * 极简假 DOM，供详情页领取相关的测试共用。
 *
 * 项目里没有 jsdom，也不打算为一个 userscript 引入它 —— 领取逻辑碰到的 DOM
 * 面其实很窄（选择器查询、文本、class、点击），这里只把这些实现出来。
 *
 * 两个反直觉的坑，写在注释里免得下次重踩：
 *   1. ownerDocument 由 makeDoc 在建文档时统一赋值。不要用「点击后再 push 进节点数组」
 *      来模拟元素后出现 —— 那样新节点的 ownerDocument 是 null，而真实 DOM 里任何
 *      节点都有 ownerDocument，假节点一缺失就会被误判成「结算上下文」。
 *      要模拟元素后出现，请用 hidden 标记 + makeDoc 的查询过滤。
 *   2. 虚拟时钟要起在真实量级（如 1_700_000_000_000）。从 0 开始的话，
 *      「2 秒冷静期」这类 now - lastClickTime 判定第一次就会不成立。
 */

/** 极简假节点：只实现领取逻辑真正会碰到的那几个属性 */
export function makeNode(spec = {}) {
    const node = {
        tag: spec.tag || 'button',
        textContent: spec.text || '',
        classes: spec.classes || [],
        attrs: spec.attrs || {},
        dataset: {},
        disabled: Boolean(spec.disabled),
        ownerDocument: null,   // 由 makeDoc 补上
        onClick: spec.onClick, // 可在建好之后再覆盖（模拟「点击后页面才变化」）
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

/** 只覆盖被测模块实际用到的选择器形态，够用即可 */
export function matchSelector(node, selector) {
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

export function makeDoc(nodes = []) {
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

/** 详情页领取需要的那几个 Utils 替身 */
export function makeFakeUtils(overrides = {}) {
    return {
        normalizeWhitespace: (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim(),
        deepClick: (el) => { if (el && typeof el.click === 'function') el.click(); },
        getCookie: (name) => (name === 'fab_csrftoken' ? 'test-csrf' : null),
        findAllButtonsWithShadow: (root) => (root && root.querySelectorAll ? root.querySelectorAll('button') : []),
        ...overrides
    };
}
