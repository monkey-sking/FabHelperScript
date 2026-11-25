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
    globalThis.GM_info = { script: { version: '3.5.27' } };
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
        incrementalEarlyStop: State.incrementalEarlyStop,
        autoAddOnScroll: State.autoAddOnScroll,
        autoScroll: State.autoScroll,
        rememberScrollPosition: State.rememberScrollPosition,
        uiExpanded: State.uiExpanded,
        settingsAdvancedOpen: State.settingsAdvancedOpen,
        hasFastScanCheckpoint: State.hasFastScanCheckpoint,
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
        incrementalStopPages: State.incrementalStopPages,
        UI: { ...State.UI }
    };

    setUITaskRunnerRef(TaskRunner);
    setTaskRunnerUIRef(UI);
    setDbUIRef(UI);
    setUtilsUIRef(UI);
    t.mock.method(Utils, 'logger', () => {});

    State.lang = 'zh';
    State.fastApiScan = true;
    State.incrementalEarlyStop = false;
    State.autoAddOnScroll = false;
    State.autoScroll = false;
    State.rememberScrollPosition = false;
    State.uiExpanded = true;
    State.settingsAdvancedOpen = false;
    State.hasFastScanCheckpoint = false;
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
    State.incrementalStopPages = 5;

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

test('UI renders 3 work modes and toggles panels, metrics, buttons, and CTA labels', async (t) => {
    createFakeDomEnv(t);
    assert.equal(UI.create(), true);

    assert.deepEqual(Object.keys(State.UI.modeButtons), ['full', 'incremental', 'page']);

    // Default: Full API scan mode
    assert.equal(TaskRunner.getWorkMode(), 'full');
    assert.equal(State.UI.modeButtons.full.classList.contains('active'), true);
    assert.equal(State.UI.modePanels.full.style.display, 'block');
    assert.equal(State.UI.modePanels.incremental.style.display, 'none');
    assert.equal(State.UI.modePanels.page.style.display, 'none');
    assert.equal(State.UI.statusVisible.style.display, 'none');
    assert.equal(State.UI.statusHidden.style.display, 'none');
    assert.equal(State.UI.syncBtn.style.display, 'none');
    assert.equal(State.UI.hideBtn.style.display, 'none');
    assert.equal(State.UI.resetCheckpointBtn.style.display, '');
    assert.equal(State.UI.resetCheckpointBtn.disabled, true);
    assert.equal(State.UI.execBtn.textContent, '⚡ 开始全量扫描');

    // Checkpoint available -> CTA says resume & reset button enables
    State.hasFastScanCheckpoint = true;
    UI.update();
    assert.equal(State.UI.execBtn.textContent, '⚡ 继续全量扫描');
    assert.equal(State.UI.resetCheckpointBtn.disabled, false);

    // Switch to Incremental catch-up mode
    await TaskRunner.setWorkMode('incremental');
    assert.equal(TaskRunner.getWorkMode(), 'incremental');
    assert.equal(State.fastApiScan, true);
    assert.equal(State.incrementalEarlyStop, true);
    assert.equal(State.UI.modeButtons.incremental.classList.contains('active'), true);
    assert.equal(State.UI.modePanels.full.style.display, 'none');
    assert.equal(State.UI.modePanels.incremental.style.display, 'block');
    assert.equal(State.UI.modePanels.page.style.display, 'none');
    assert.equal(State.UI.statusVisible.style.display, 'none');
    assert.equal(State.UI.syncBtn.style.display, 'none');
    assert.equal(State.UI.resetCheckpointBtn.style.display, 'none');
    assert.equal(State.UI.execBtn.textContent, '🆕 开始追新扫描');

    // Switch to Page DOM mode
    await TaskRunner.setWorkMode('page');
    assert.equal(TaskRunner.getWorkMode(), 'page');
    assert.equal(State.fastApiScan, false);
    assert.equal(State.UI.modeButtons.page.classList.contains('active'), true);
    assert.equal(State.UI.modePanels.page.style.display, 'block');
    assert.equal(State.UI.statusVisible.style.display, '');
    assert.equal(State.UI.statusHidden.style.display, '');
    assert.equal(State.UI.syncBtn.style.display, '');
    assert.equal(State.UI.hideBtn.style.display, '');
    assert.equal(State.UI.resetCheckpointBtn.style.display, 'none');
    assert.equal(State.UI.execBtn.textContent, '📜 领取当前页面');
});

test('TaskRunner.setPageSubMode switches cleanly between visible, on_scroll, and auto_scroll', async (t) => {
    createFakeDomEnv(t);
    UI.create();
    await TaskRunner.setWorkMode('page');

    await TaskRunner.setPageSubMode('on_scroll');
    assert.equal(State.autoAddOnScroll, true);
    assert.equal(State.autoScroll, false);
    assert.equal(State.UI.pageSubModeButtons.on_scroll.classList.contains('active'), true);
    assert.equal(State.UI.execBtn.textContent, '📜 开始滚到即领');

    await TaskRunner.setPageSubMode('auto_scroll');
    assert.equal(State.autoAddOnScroll, false);
    assert.equal(State.autoScroll, true);
    assert.equal(State.UI.pageSubModeButtons.auto_scroll.classList.contains('active'), true);
    assert.equal(State.UI.execBtn.textContent, '📜 开始自动翻页');

    await TaskRunner.setPageSubMode('visible');
    assert.equal(State.autoAddOnScroll, false);
    assert.equal(State.autoScroll, false);
    assert.equal(State.UI.pageSubModeButtons.visible.classList.contains('active'), true);
    assert.equal(State.UI.execBtn.textContent, '📜 领取当前页面');
});

test('Settings tab shows 5 visible items + collapsed Advanced drawer; Debug mode lives in Debug tab', (t) => {
    createFakeDomEnv(t);
    UI.create();

    const settingsTab = State.UI.tabContents.settings;
    const primaryCards = settingsTab.children.filter((c) => c.classList.contains('fab-card-group'));
    assert.equal(primaryCards.length, 2);

    const visibleRows = primaryCards.flatMap((c) => c.querySelectorAll('.fab-setting-row'));
    assert.equal(visibleRows.length, 5);

    const visibleLabels = visibleRows.map((r) => r.querySelector('.fab-setting-label')?.textContent);
    assert.deepEqual(visibleLabels, ['过滤打折商品', '过滤付费商品', '并发工作标签', '无图省流模式', '人机验证通知']);

    // Advanced drawer starts collapsed and holds 2 toggles + 1 danger button
    assert.equal(State.UI.settingsAdvancedBody.style.display, 'none');
    assert.equal(State.UI.settingsAdvancedBody.querySelectorAll('.fab-setting-row').length, 2);
    assert.equal(State.UI.settingsAdvancedBody.querySelectorAll('.fab-danger-btn').length, 1);

    State.UI.settingsAdvancedToggle.click();
    assert.equal(State.settingsAdvancedOpen, true);
    assert.equal(State.UI.settingsAdvancedBody.style.display, 'block');

    // Debug mode toggle is in Debug tab, not Settings
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

test('UI shows partial scan status and resume CTA when FastScanner finishes with incomplete slices', (t) => {
    createFakeDomEnv(t);
    UI.create();

    State.hasFastScanCheckpoint = true;
    State.fastScanStatus = {
        running: false,
        phase: 'partial',
        mode: 'time-shards',
        itemsScanned: 47097,
        claimedDirect: 3,
        incompleteSlices: 2,
        queuedFallback: 0,
        failed: 0
    };
    UI.update();

    assert.equal(State.UI.execBtn.textContent, '⚡ 继续全量扫描');
    assert.equal(State.UI.fastScanStatusDisplay.textContent, '⚡ 扫描未完整 · 共 47,097 件 · 新领 3 · 2 分片失败(已存断点)');

    State.fastScanStatus = {
        running: false,
        phase: 'completed',
        mode: 'time-shards',
        itemsScanned: 47710,
        claimedDirect: 616,
        incompleteSlices: 0,
        queuedFallback: 2,
        failed: 1
    };
    State.hasFastScanCheckpoint = false;
    UI.update();

    assert.equal(State.UI.fastScanStatusDisplay.textContent, '⚡ 扫描完成 · 共 47,710 件 · 新领 616 · 待领 2 · 失败 1');
});
