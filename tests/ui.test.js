import test from 'node:test';
import assert from 'node:assert/strict';

import { Config } from '../src/config.js';
import { State } from '../src/state.js';
import { Database, setUIReference as setDbUIRef } from '../src/modules/database.js';
import { TaskRunner, setUIReference as setTaskRunnerUIRef } from '../src/modules/task-runner.js';
import { UI, setTaskRunnerReference as setUITaskRunnerRef } from '../src/modules/ui.js';
import { setUIReference as setUtilsUIRef, Utils } from '../src/modules/utils.js';

function createFakeDomEnv(t) {
    const prevDocument = globalThis.document;
    const prevWindow = globalThis.window;
    const prevGmGet = globalThis.GM_getValue;
    const prevGmSet = globalThis.GM_setValue;
    const prevGmDelete = globalThis.GM_deleteValue;
    const prevGmOpen = globalThis.GM_openInTab;
    const prevGmInfo = globalThis.GM_info;

    const gmStore = new Map();
    const gmCalls = [];

    const makeClassList = (el) => ({
        add: (...names) => {
            const set = new Set(el.className ? el.className.split(/\s+/).filter(Boolean) : []);
            names.forEach((n) => set.add(n));
            el.className = Array.from(set).join(' ');
        },
        remove: (...names) => {
            const set = new Set(el.className ? el.className.split(/\s+/).filter(Boolean) : []);
            names.forEach((n) => set.delete(n));
            el.className = Array.from(set).join(' ');
        },
        toggle: (name, force) => {
            const set = new Set(el.className ? el.className.split(/\s+/).filter(Boolean) : []);
            const next = force === undefined ? !set.has(name) : Boolean(force);
            if (next) set.add(name);
            else set.delete(name);
            el.className = Array.from(set).join(' ');
            return next;
        },
        contains: (name) => el.className.split(/\s+/).includes(name)
    });

    const matchesSingle = (el, sel) => {
        const s = sel.trim();
        if (!s) return false;
        if (s.startsWith('#')) return el.id === s.slice(1);
        if (s.startsWith('.')) return el.classList.contains(s.slice(1));
        const attrMatch = s.match(/^([a-z0-9_-]*)\[([^=\]]+)(?:="([^"]*)")?\]$/i);
        if (attrMatch) {
            const [, tag, attr, val] = attrMatch;
            if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
            const actual = el.getAttribute(attr);
            return val === undefined ? actual !== null : actual === val;
        }
        return el.tagName.toLowerCase() === s.toLowerCase();
    };

    const matchesSelector = (el, selector) =>
        String(selector).split(',').some((part) => matchesSingle(el, part));

    const collectDescendants = (root, out = []) => {
        for (const child of root.children) {
            out.push(child);
            collectDescendants(child, out);
        }
        return out;
    };

    const makeElement = (tagName) => {
        const attrs = new Map();
        const el = {
            tagName: String(tagName).toUpperCase(),
            id: '',
            className: '',
            style: { cssText: '', display: '' },
            children: [],
            parentElement: null,
            textContent: '',
            innerText: '',
            innerHTML: '',
            title: '',
            disabled: false,
            checked: false,
            value: '',
            type: '',
            min: '',
            max: '',
            onclick: null,
            onchange: null,
            onmouseover: null,
            onmouseout: null,
            setAttribute: (k, v) => {
                attrs.set(k, String(v));
                if (k === 'id') el.id = String(v);
            },
            getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
            removeAttribute: (k) => attrs.delete(k),
            appendChild: (child) => {
                if (child) {
                    child.parentElement = el;
                    el.children.push(child);
                }
                return child;
            },
            append: (...nodes) => nodes.forEach((n) => el.appendChild(n)),
            prepend: (child) => {
                if (child) {
                    child.parentElement = el;
                    el.children.unshift(child);
                }
            },
            removeChild: (child) => {
                const idx = el.children.indexOf(child);
                if (idx >= 0) {
                    el.children.splice(idx, 1);
                    child.parentElement = null;
                }
            },
            get firstChild() { return el.children[0] || null; },
            get lastChild() { return el.children[el.children.length - 1] || null; },
            querySelectorAll: (sel) => collectDescendants(el).filter((n) => matchesSelector(n, sel)),
            querySelector: (sel) => collectDescendants(el).find((n) => matchesSelector(n, sel)) || null,
            click: () => {
                if (el.disabled) return;
                if (typeof el.onclick === 'function') {
                    el.onclick({
                        stopPropagation: () => {},
                        preventDefault: () => {},
                        target: el
                    });
                }
            }
        };
        el.classList = makeClassList(el);
        return el;
    };

    const head = makeElement('head');
    const body = makeElement('body');
    const doc = {
        head,
        body,
        activeElement: null,
        createElement: (tag) => makeElement(tag),
        getElementById: (id) => collectDescendants(body).find((n) => n.id === id) || null,
        querySelectorAll: (sel) => collectDescendants(body).filter((n) => matchesSelector(n, sel)),
        querySelector: (sel) => collectDescendants(body).find((n) => matchesSelector(n, sel)) || null
    };

    globalThis.document = doc;
    globalThis.window = {
        location: { href: 'https://www.fab.com/search?is_free=1', reload: () => {} },
        confirm: () => true,
        scrollTo: () => {}
    };
    globalThis.GM_info = { script: { version: '3.6.0' } };
    globalThis.GM_openInTab = () => {};
    globalThis.GM_getValue = async (k, def) => (gmStore.has(k) ? gmStore.get(k) : def);
    globalThis.GM_setValue = async (k, v) => {
        gmStore.set(k, v);
        gmCalls.push({ key: k, value: v });
    };
    globalThis.GM_deleteValue = async (k) => { gmStore.delete(k); };

    const snapshot = {
        lang: State.lang,
        fastApiScan: State.fastApiScan,
        autoClaimVisible: State.autoClaimVisible,
        domFallbackMode: State.domFallbackMode,
        autoAddOnScroll: State.autoAddOnScroll,
        autoScroll: State.autoScroll,
        hideSaved: State.hideSaved,
        hidePaid: State.hidePaid,
        rememberScrollPosition: State.rememberScrollPosition,
        uiExpanded: State.uiExpanded,
        settingsAdvancedOpen: State.settingsAdvancedOpen,
        hasFastScanCheckpoint: State.hasFastScanCheckpoint,
        fastScanCheckpointMeta: State.fastScanCheckpointMeta,
        fastScanStatus: State.fastScanStatus,
        isExecuting: State.isExecuting,
        executionTotalTasks: State.executionTotalTasks,
        executionCompletedTasks: State.executionCompletedTasks,
        executionFailedTasks: State.executionFailedTasks,
        debugMode: State.debugMode,
        activeTab: State.activeTab,
        db: State.db,
        savedCursor: State.savedCursor,
        apiScanConcurrency: State.apiScanConcurrency,
        UI: { ...State.UI }
    };

    setUITaskRunnerRef(TaskRunner);
    setTaskRunnerUIRef(UI);
    setDbUIRef(UI);
    setUtilsUIRef(UI);
    t.mock.method(Utils, 'logger', () => {});

    State.lang = 'zh';
    State.fastApiScan = true;
    State.autoClaimVisible = true;
    State.domFallbackMode = false;
    State.autoAddOnScroll = false;
    State.autoScroll = false;
    State.hideSaved = false;
    State.hidePaid = false;
    State.rememberScrollPosition = false;
    State.uiExpanded = true;
    State.settingsAdvancedOpen = false;
    State.hasFastScanCheckpoint = false;
    State.fastScanCheckpointMeta = null;
    State.fastScanStatus = null;
    State.isExecuting = false;
    State.executionTotalTasks = 0;
    State.executionCompletedTasks = 0;
    State.executionFailedTasks = 0;
    State.debugMode = false;
    State.activeTab = 'dashboard';
    State.db = { todo: [], done: [], failed: [] };
    State.savedCursor = null;
    State.apiScanConcurrency = 4;

    t.after(() => {
        globalThis.document = prevDocument;
        globalThis.window = prevWindow;
        globalThis.GM_getValue = prevGmGet;
        globalThis.GM_setValue = prevGmSet;
        globalThis.GM_deleteValue = prevGmDelete;
        globalThis.GM_openInTab = prevGmOpen;
        globalThis.GM_info = prevGmInfo;
        Object.assign(State, snapshot);
        State.UI = snapshot.UI;
    });

    return { doc, gmStore, gmCalls };
}

test('Dashboard renders mode-free UI, checkpoint resume/restart, unified pending count, and quick pills', async (t) => {
    const { gmStore } = createFakeDomEnv(t);
    assert.equal(UI.create(), true);

    assert.equal(State.UI.tabContents.dashboard.querySelectorAll('.fab-mode-switcher').length, 0);
    assert.equal(State.UI.execBtn.textContent, '🚀 全站扫描入库');
    assert.equal(State.UI.resetCheckpointBtn.style.display, 'none');
    assert.equal(State.UI.retryFailedBtn.style.display, 'none');
    assert.equal(State.UI.fastScanStatusDisplay.textContent, '已开启眼前免费自动领 · 点上方可扫全站 4.8万+ 查漏');

    // Checkpoint available with percentage -> Resume (30%) + side Restart button
    State.hasFastScanCheckpoint = true;
    State.fastScanCheckpointMeta = { itemsScanned: 14161, totalEstimated: 47978, pct: 30 };
    UI.update();
    assert.equal(State.UI.execBtn.textContent, '▶ 继续上次扫描 (30%)');
    assert.equal(State.UI.resetCheckpointBtn.style.display, '');
    assert.equal(State.UI.resetCheckpointBtn.disabled, false);
    assert.equal(State.UI.fastScanStatusDisplay.textContent, '上次停在 30%（14,161 / 47,978）· 可继续或重扫');

    // Running scan combines State.db.todo + FastScanner.pendingCount in unified 待入库
    State.isExecuting = true;
    State.db.todo = [{ uid: 'bundle-1', url: 'https://www.fab.com/bundles/bundle-1' }];
    State.fastScanStatus = {
        running: true,
        phase: 'scanning',
        mode: 'time-shards',
        activeConcurrency: 4,
        itemsScanned: 24000,
        totalEstimated: 48000,
        itemsPerSec: 120,
        claimedDirect: 9,
        pendingCount: 7,
        rateLimitedUntil: 0
    };
    UI.update();
    assert.equal(State.UI.execBtn.textContent, '■ 停止扫描');
    assert.equal(State.UI.resetCheckpointBtn.style.display, 'none');
    assert.equal(State.UI.statusTodo._valueEl.textContent, '8');

    // Failed items reveal compact retry banner
    State.isExecuting = false;
    State.fastScanStatus = null;
    State.hasFastScanCheckpoint = false;
    State.fastScanCheckpointMeta = null;
    State.db.failed = [{ uid: 'fail-1', url: 'https://www.fab.com/listings/fail-1' }];
    UI.update();
    assert.equal(State.UI.retryFailedBtn.style.display, '');
    assert.equal(State.UI.retryFailedBtn.textContent, '🔁 重试失败 (1)');

    // Quick pills toggle & persist
    assert.equal(State.UI.quickAutoClaimBtn.classList.contains('active'), true);
    await TaskRunner.toggleAutoClaimVisible();
    assert.equal(State.autoClaimVisible, false);
    assert.equal(gmStore.get(Config.DB_KEYS.AUTO_CLAIM_VISIBLE), false);
    assert.equal(State.UI.quickAutoClaimBtn.classList.contains('active'), false);

    await TaskRunner.toggleHideSaved();
    assert.equal(State.hideSaved, true);
    assert.equal(State.UI.quickHideSavedBtn.classList.contains('active'), true);

    await TaskRunner.toggleHidePaid();
    assert.equal(State.hidePaid, true);
    assert.equal(State.UI.quickHidePaidBtn.classList.contains('active'), true);
});

test('Settings tab shows 4 general/filter rows + collapsed Advanced & Fallback drawer with isolated DOM fallback controls', async (t) => {
    const { gmStore } = createFakeDomEnv(t);
    UI.create();

    const settingsTab = State.UI.tabContents.settings;
    const primaryCards = settingsTab.children.filter((c) => c.classList.contains('fab-card-group'));
    assert.equal(primaryCards.length, 1);

    const visibleRows = primaryCards.flatMap((c) => c.querySelectorAll('.fab-setting-row'));
    assert.equal(visibleRows.length, 4);
    const visibleLabels = visibleRows.map((r) => r.querySelector('.fab-setting-label')?.textContent);
    assert.deepEqual(visibleLabels, ['过滤打折商品', 'API 并发路数', '无图省流模式', '人机验证通知']);

    assert.equal(State.UI.settingsAdvancedBody.style.display, 'none');
    assert.equal(State.UI.domFallbackControls.style.display, 'none');

    State.UI.settingsAdvancedToggle.click();
    assert.equal(State.settingsAdvancedOpen, true);
    assert.equal(State.UI.settingsAdvancedBody.style.display, 'block');

    // Enabling DOM fallback mode switches primary CTA and reveals fallback controls
    await TaskRunner.setDomFallbackMode(true);
    assert.equal(State.domFallbackMode, true);
    assert.equal(State.fastApiScan, false);
    assert.equal(State.autoScroll, true);
    assert.equal(gmStore.get(Config.DB_KEYS.DOM_FALLBACK_MODE), true);
    assert.equal(State.UI.domFallbackControls.style.display, 'block');
    assert.equal(State.UI.execBtn.textContent, '📜 开始滚页扫描 (备用)');

    // Debug mode toggle remains in Debug tab
    const debugRows = State.UI.tabContents.debug.querySelectorAll('.fab-setting-row');
    assert.equal(debugRows.length, 1);
    assert.equal(debugRows[0].querySelector('.fab-setting-label')?.textContent, '调试模式');
});

test('Collapse button hides panel body, shows live badge when active, and persists preference', (t) => {
    const { gmStore } = createFakeDomEnv(t);
    UI.create();

    State.isExecuting = true;
    State.fastScanStatus = {
        running: true,
        mode: 'time-shards',
        activeConcurrency: 4,
        itemsScanned: 1200,
        totalEstimated: 4000,
        itemsPerSec: 120,
        claimedDirect: 5,
        rateLimitedUntil: 0
    };

    State.UI.collapseBtn.click();

    assert.equal(State.uiExpanded, false);
    assert.equal(gmStore.get(Config.DB_KEYS.UI_EXPANDED), false);
    assert.equal(State.UI.container.classList.contains('fab-helper-collapsed'), true);
    assert.equal(State.UI.tabsContainer.style.display, 'none');
    assert.equal(State.UI.tabContents.dashboard.style.display, 'none');
    assert.equal(State.UI.headerLiveBadge.textContent, '⚡ 30%');
    assert.equal(State.UI.headerLiveBadge.style.display, 'inline-flex');

    State.UI.collapseBtn.click();
    assert.equal(State.uiExpanded, true);
    assert.equal(gmStore.get(Config.DB_KEYS.UI_EXPANDED), true);
    assert.equal(State.UI.container.classList.contains('fab-helper-collapsed'), false);
    assert.equal(State.UI.tabContents.dashboard.style.display, 'block');
    assert.equal(State.UI.headerLiveBadge.style.display, 'none');
});
