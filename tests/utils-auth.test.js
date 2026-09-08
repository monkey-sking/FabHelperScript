/**
 * 登录态判定测试
 *
 * 这组用例针对的是一个真实踩到的坑：未登录时 fab_csrftoken 依然存在，
 * /i/csrf 也照常返回 200。所以「有 cookie」根本不能证明「已登录」。
 *
 * 实测数据（真实未登录会话，Ego 浏览器抓取）：
 *   fab_csrftoken cookie  存在          ← 旧判据，误判为已登录
 *   /i/csrf              200           ← 同样是误信号
 *   window._epicAccountId ''           ← 正确
 *   SSR /i/users/me       isAnonymous: true  ← 正确
 *   /i/users/me           401          ← 正确
 *
 * 判错的后果不是多打一次请求：task-runner 的三道执行闸门会全部放行，
 * 脚本在未登录态逐条领取失败，事件日志里整份免费列表被一次性定型成终态失败。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { Utils } from '../src/modules/utils.js';

const REAL_UUID = '3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071';
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/** 造一个带 SSR 数据的假文档，模拟 fab.com 页面内嵌的那块 JSON */
const ssrDoc = (payload) => ({
    getElementById: (id) => (
        id === 'js-json-data-prefetched-data'
            ? { textContent: JSON.stringify(payload) }
            : null
    )
});

const emptyDoc = { getElementById: () => null };

test('未登录（_epicAccountId 为空串）即使 cookie 存在也必须判为未登录', () => {
    // 这一条是核心回归：旧实现只看 cookie，会在这里返回 true
    const ok = Utils.checkAuthentication(true, {
        window: { _epicAccountId: '' },
        document: emptyDoc
    });
    assert.equal(ok, false, 'cookie 存在不代表已登录，页面信号才是权威的');
});

test('未登录（SSR isAnonymous=true）即使 cookie 存在也必须判为未登录', () => {
    const ok = Utils.checkAuthentication(true, {
        window: {},
        document: ssrDoc({ '/i/users/me': { isAnonymous: true } })
    });
    assert.equal(ok, false);
});

test('未登录（SSR result 为全零 UUID）判为未登录', () => {
    const ok = Utils.checkAuthentication(true, {
        window: {},
        document: ssrDoc({ '/i/users/me': { result: ZERO_UUID } })
    });
    assert.equal(ok, false);
});

test('已登录（_epicAccountId 为真实 UUID）判为已登录', () => {
    const ok = Utils.checkAuthentication(true, {
        window: { _epicAccountId: REAL_UUID },
        document: emptyDoc
    });
    assert.equal(ok, true);
});

test('已登录（SSR isAnonymous=false）判为已登录', () => {
    const ok = Utils.checkAuthentication(true, {
        window: {},
        document: ssrDoc({ '/i/users/me': { isAnonymous: false } })
    });
    assert.equal(ok, true);
});

test('页面信号缺失时退回 cookie 判定（保持旧行为，不引入新故障）', () => {
    const originalDoc = global.document;
    try {
        global.document = { cookie: 'fab_csrftoken=abc123; other=1' };
        assert.equal(
            Utils.checkAuthentication(true, { window: {}, document: emptyDoc }),
            true,
            '拿不到页面信号时应当退回 cookie 判定'
        );

        global.document = { cookie: 'other=1' };
        assert.equal(
            Utils.checkAuthentication(true, { window: {}, document: emptyDoc }),
            false
        );
    } finally {
        global.document = originalDoc;
    }
});

test('detectLoginFromPage 拿不到任何信号时返回 null，交给调用方决定', () => {
    assert.equal(Utils.detectLoginFromPage({ window: {}, document: emptyDoc }), null);
    assert.equal(Utils.detectLoginFromPage({}), null);
});

test('页面信号与 cookie 冲突时以页面信号为准', () => {
    const originalDoc = global.document;
    try {
        // cookie 说已登录，页面说未登录 → 必须听页面的
        global.document = { cookie: 'fab_csrftoken=abc123' };
        assert.equal(
            Utils.checkAuthentication(true, {
                window: { _epicAccountId: '' },
                document: emptyDoc
            }),
            false,
            '冲突时页面信号优先'
        );

        // 反过来：页面说已登录，即使 cookie 缺失也应当放行
        global.document = { cookie: '' };
        assert.equal(
            Utils.checkAuthentication(true, {
                window: { _epicAccountId: REAL_UUID },
                document: emptyDoc
            }),
            true
        );
    } finally {
        global.document = originalDoc;
    }
});
