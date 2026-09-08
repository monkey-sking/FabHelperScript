import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ApiClaim, DomClaim, ClaimExecutor, CLAIM_RESULT, setDomClaim, normalizeClaimOutcome,
    pickFreeOfferId, multipartBody
} from '../src/modules/claim-strategy.js';
import { Utils } from '../src/modules/utils.js';

// 每个用例前把策略与指标恢复到干净状态
function resetAll() {
    ApiClaim.endpoint = null;
    ApiClaim.method = 'POST';
    ApiClaim.buildBody = null;
    ApiClaim.resolveOfferId = null;
    ApiClaim.fetchImpl = null;
    setDomClaim(null);
    ClaimExecutor.resetMetrics();
    ClaimExecutor.preferApi = true;
    Utils.getCookie = () => 'test-csrf-token';
}

test('无任何策略可用时返回终态失败，而非抛异常', async () => {
    resetAll();
    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.equal(r.strategy, null);
    assert.equal(ClaimExecutor.metrics.unavailable, 2, '两个策略都判定不可用');
});

test('ApiClaim 端点未配置时不可用并回落到 DOM', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });

    assert.equal(ApiClaim.isAvailable(), false);
    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });

    assert.equal(r.result, CLAIM_RESULT.SUCCESS);
    assert.equal(r.strategy, 'dom');
    assert.equal(domCalled, 1);
    assert.equal(ClaimExecutor.fallbackRate(), 1, '接口不可用时应 100% 回落');
});

test('接口可用时优先走接口，不再触碰 DOM', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });

    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 200, getResponseHeader: () => null })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.result, CLAIM_RESULT.SUCCESS);
    assert.equal(r.strategy, 'api');
    assert.equal(domCalled, 0, '接口成功时不应回落到 DOM');
    assert.equal(ClaimExecutor.fallbackRate(), 0);
});

test('接口失败会回落到 DOM，并计入回落率', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 500, getResponseHeader: () => null })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.strategy, 'dom', '接口 5xx 应回落到 DOM');
    assert.equal(domCalled, 1);
    assert.equal(ClaimExecutor.stats().api.attempts, 1);
    assert.equal(ClaimExecutor.stats().api.success, 0);
    assert.equal(ClaimExecutor.fallbackRate(), 0.5);
});

test('接口 403 / 404 是终态失败，不浪费一次 DOM 回落', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });

    for (const status of [403, 404]) {
        domCalled = 0;
        ApiClaim.configure({
            endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
            fetchImpl: async () => ({ status, getResponseHeader: () => null })
        });
        const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
        assert.equal(r.result, CLAIM_RESULT.FAILURE);
        assert.equal(r.strategy, 'api');
        assert.equal(domCalled, 0, `${status} 属于终态，重试无意义`);
    }
});

test('429 与终态失败区分开，并带出 retry-after', async () => {
    resetAll();
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 429, getResponseHeader: h => (h === 'retry-after' ? '30' : null) })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.result, CLAIM_RESULT.RATE_LIMITED);
    assert.equal(r.strategy, 'api');
    assert.equal(r.retryAfterMs, 30000, 'retry-after 是秒，应换算成毫秒');
});

test('429 绝不回落 DOM（限速时叠加请求只会雪上加霜）', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 429, getResponseHeader: () => '5' })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.result, CLAIM_RESULT.RATE_LIMITED);
    assert.equal(domCalled, 0, '限速期间不得叠加任何额外请求');
});

test('无 retry-after 头时 429 不臆造退避时长', async () => {
    resetAll();
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 429, getResponseHeader: () => null })
    });
    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.result, CLAIM_RESULT.RATE_LIMITED);
    assert.equal(r.retryAfterMs, null, '交给令牌桶按自己的退避策略决定');
});

test('缺少 CSRF token 时接口策略直接失败', async () => {
    resetAll();
    Utils.getCookie = () => '';
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 200, getResponseHeader: () => null })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.match(r.reason, /CSRF/);
});

test('策略抛异常被吞掉并回落到下一个，不向上冒泡', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => { throw new Error('boom'); }
    });

    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.strategy, 'dom');
    assert.equal(domCalled, 1);
});

test('DomClaim 兼容旧式布尔返回值', async () => {
    resetAll();
    setDomClaim(async () => true);
    assert.equal((await DomClaim.claim({ uid: 'u1', offerId: 'offer-u1' })).result, CLAIM_RESULT.SUCCESS);

    setDomClaim(async () => false);
    assert.equal((await DomClaim.claim({ uid: 'u1', offerId: 'offer-u1' })).result, CLAIM_RESULT.FAILURE);
});

test('buildBody 可自定义请求体', async () => {
    resetAll();
    let captured = null;
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        buildBody: (task) => ({ offer_id: task.offerId, source: 'userscript' }),
        fetchImpl: async (opts) => {
            captured = opts.data;
            return { status: 200, getResponseHeader: () => null };
        }
    });

    await ApiClaim.claim({ uid: 'abc', offerId: 'offer-abc' });
    assert.match(captured, /name="offer_id"\r\n\r\noffer-abc/, 'offer_id 应进 multipart');
    assert.match(captured, /name="source"\r\n\r\nuserscript/, '自定义字段也应带上');
});

test('默认请求体是 multipart/form-data 且带 boundary', async () => {
    resetAll();
    let opts = null;
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async (o) => { opts = o; return { status: 200, getResponseHeader: () => null }; }
    });

    await ApiClaim.claim({ uid: 'abc', offerId: 'offer-abc' });
    const ct = opts.headers['content-type'];
    assert.match(ct, /^multipart\/form-data; boundary=/, 'Content-Type 必须显式带 boundary');
    const boundary = ct.split('boundary=')[1];
    assert.match(opts.data, new RegExp(`--${boundary}\r\nContent-Disposition: form-data; name="offer_id"`));
    assert.match(opts.data, new RegExp(`--${boundary}--\r\n$`), '必须以结束边界收尾');
});

test('端点模板里的 {uid} 被替换成真实 uid', async () => {
    resetAll();
    let url = null;
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async (o) => { url = o.url; return { status: 200, getResponseHeader: () => null }; }
    });

    await ApiClaim.claim({ uid: 'e0e9cad6-cfdf-48d7-bce1-8883ed8c31e9', offerId: 'x' });
    assert.equal(url, 'https://www.fab.com/i/listings/e0e9cad6-cfdf-48d7-bce1-8883ed8c31e9/add-to-library');
});

test('缺 offer_id 时不发请求（发了也只会 400），并判为终态失败', async () => {
    resetAll();
    let called = 0;
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        // 注入 resolveOfferId 返回 null，避免回源详情 GET 干扰断言
        resolveOfferId: () => null,
        fetchImpl: async () => { called += 1; return { status: 400, getResponseHeader: () => null }; }
    });

    const r = await ApiClaim.claim({ uid: 'u1' });
    assert.equal(called, 0, '拿不到 offer_id 就不该发请求');
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.match(r.reason, /offer_id/);
});

test('401 判为终态失败（未登录，回落 DOM 同样没有领取按钮）', async () => {
    resetAll();
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 401, getResponseHeader: () => null })
    });

    const r = await ApiClaim.claim({ uid: 'u1', offerId: 'o1' });
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.equal(r.retryable, false, '未登录不是靠重试能解决的');
    assert.match(r.reason, /401/);
});

test('400 判为终态失败（请求体问题，重试只会重复同一个错误）', async () => {
    resetAll();
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 400, getResponseHeader: () => null })
    });

    const r = await ApiClaim.claim({ uid: 'u1', offerId: 'o1' });
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.equal(r.retryable, false);
});

// ── offer_id 解析：免费档位挑选 ──
// offer_id 是 add-to-library 的必填字段，挑错档位要么 400，要么领到付费许可。

test('pickFreeOfferId 取 priceTier.price 为 0 的档位', () => {
    const listing = { licenses: [{ offerId: 'paid', slug: 'personal', priceTier: { price: 6920 } },
                                  { offerId: 'free', slug: 'professional', priceTier: { price: 0 } }] };
    assert.equal(pickFreeOfferId(listing), 'free');
});

test('pickFreeOfferId 在多个免费档中优先 professional', () => {
    const listing = { licenses: [{ offerId: 'per', slug: 'personal', priceTier: { price: 0 } },
                                  { offerId: 'pro', slug: 'professional', priceTier: { price: 0 } }] };
    assert.equal(pickFreeOfferId(listing), 'pro');
});

test('pickFreeOfferId 无免费档时返回 null（绝不拿付费档去领）', () => {
    assert.equal(pickFreeOfferId({ licenses: [{ offerId: 'p', slug: 'personal', priceTier: { price: 100 } }] }), null);
    assert.equal(pickFreeOfferId({}), null);
    assert.equal(pickFreeOfferId(null), null);
});

test('task 自带 offerId 时走快路径，不再回源详情', async () => {
    resetAll();
    const urls = [];
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async (o) => { urls.push(o.url); return { status: 200, getResponseHeader: () => null }; }
    });

    await ApiClaim.claim({ uid: 'u1', offerId: 'fast-offer' });
    assert.equal(urls.length, 1, '快路径下只该有领取那一次请求');
    assert.match(urls[0], /add-to-library$/);
});

test('task 无 offerId 时回源详情页解析', async () => {
    resetAll();
    const urls = [];
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async (o) => {
            urls.push(o.url);
            if (o.method === 'GET') {
                return { status: 200, responseText: JSON.stringify({ licenses: [
                    { offerId: 'pro-free', slug: 'professional', priceTier: { price: 0 } }
                ] }) };
            }
            return { status: 200, getResponseHeader: () => null };
        }
    });

    const r = await ApiClaim.claim({ uid: 'u1' });
    assert.equal(r.result, CLAIM_RESULT.SUCCESS);
    assert.equal(urls[0], 'https://www.fab.com/i/listings/u1', '先拉详情');
    assert.match(urls[1], /add-to-library$/, '再领取');
});

test('preferApi 关闭时优先走 DOM', async () => {
    resetAll();
    const calls = [];
    setDomClaim(async () => { calls.push('dom'); return { result: CLAIM_RESULT.SUCCESS }; });
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => { calls.push('api'); return { status: 200, getResponseHeader: () => null }; }
    });

    await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' }, { preferApi: false });
    assert.deepEqual(calls, ['dom'], '灰度期间可强制走 DOM 对照');
});

test('stats 聚合可观测指标', async () => {
    resetAll();
    setDomClaim(async () => ({ result: CLAIM_RESULT.SUCCESS }));
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/{uid}/add-to-library',
        fetchImpl: async () => ({ status: 200, getResponseHeader: () => null })
    });

    await ClaimExecutor.claim({ uid: 'a', offerId: 'oa' });
    await ClaimExecutor.claim({ uid: 'b', offerId: 'ob' });

    const s = ClaimExecutor.stats();
    assert.equal(s.api.attempts, 2);
    assert.equal(s.api.success, 2);
    assert.equal(s.dom.attempts, 0);
    assert.equal(s.fallbackRate, 0);
});

// ── 返回值归一：现有 DOM 自动化的 { success } 与本模块的 { result } 必须互通 ──
// 不做归一的话，接入 task-runner 时 result 为 undefined，会被静默判成
// 「没有可用的领取策略」——线上表现为全部领取失败且无原因可查。

test('归一 { success: true }（现有 worker 协议）为成功', () => {
    const r = normalizeClaimOutcome({ success: true });
    assert.equal(r.result, CLAIM_RESULT.SUCCESS);
});

test('归一 { success: false } 为失败，并保留原因与可重试标记', () => {
    const r = normalizeClaimOutcome({ success: false, reason: '按钮未找到', retryable: true });
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.equal(r.reason, '按钮未找到');
    assert.equal(r.retryable, true);
});

test('归一布尔返回值为成功 / 失败', () => {
    assert.equal(normalizeClaimOutcome(true).result, CLAIM_RESULT.SUCCESS);
    assert.equal(normalizeClaimOutcome(false).result, CLAIM_RESULT.FAILURE);
});

test('已是规范形态的 { result } 原样返回', () => {
    const input = { result: CLAIM_RESULT.RATE_LIMITED, retryAfterMs: 3000 };
    assert.equal(normalizeClaimOutcome(input), input);
});

test('无法识别的返回判为终态失败，绝不退化成可重试（否则会无限回落）', () => {
    [null, undefined, 42, {}, { success: 'yes' }].forEach(bad => {
        const r = normalizeClaimOutcome(bad);
        assert.equal(r.result, CLAIM_RESULT.FAILURE);
        assert.equal(r.retryable, false);
    });
});

test('注入返回 { success: true } 时流水线能真正领取成功（端到端守住该契约）', async () => {
    resetAll();
    setDomClaim(async () => ({ success: true }));
    const r = await ClaimExecutor.claim({ uid: 'u1', offerId: 'offer-u1' });
    assert.equal(r.result, CLAIM_RESULT.SUCCESS, 'worker 协议的返回值必须被正确识别');
    assert.equal(r.strategy, 'dom');
});
