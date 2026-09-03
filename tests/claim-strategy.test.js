import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ApiClaim, DomClaim, ClaimExecutor, CLAIM_RESULT, setDomClaim
} from '../src/modules/claim-strategy.js';
import { Utils } from '../src/modules/utils.js';

// 每个用例前把策略与指标恢复到干净状态
function resetAll() {
    ApiClaim.endpoint = null;
    ApiClaim.method = 'POST';
    ApiClaim.buildBody = null;
    ApiClaim.fetchImpl = null;
    setDomClaim(null);
    ClaimExecutor.resetMetrics();
    ClaimExecutor.preferApi = true;
    Utils.getCookie = () => 'test-csrf-token';
}

test('无任何策略可用时返回终态失败，而非抛异常', async () => {
    resetAll();
    const r = await ClaimExecutor.claim({ uid: 'u1' });
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.equal(r.strategy, null);
    assert.equal(ClaimExecutor.metrics.unavailable, 2, '两个策略都判定不可用');
});

test('ApiClaim 端点未配置时不可用并回落到 DOM', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });

    assert.equal(ApiClaim.isAvailable(), false);
    const r = await ClaimExecutor.claim({ uid: 'u1' });

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
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => ({ status: 200, getResponseHeader: () => null })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1' });
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
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => ({ status: 500, getResponseHeader: () => null })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1' });
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
            endpoint: 'https://www.fab.com/i/listings/claim',
            fetchImpl: async () => ({ status, getResponseHeader: () => null })
        });
        const r = await ClaimExecutor.claim({ uid: 'u1' });
        assert.equal(r.result, CLAIM_RESULT.FAILURE);
        assert.equal(r.strategy, 'api');
        assert.equal(domCalled, 0, `${status} 属于终态，重试无意义`);
    }
});

test('429 与终态失败区分开，并带出 retry-after', async () => {
    resetAll();
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => ({ status: 429, getResponseHeader: h => (h === 'retry-after' ? '30' : null) })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1' });
    assert.equal(r.result, CLAIM_RESULT.RATE_LIMITED);
    assert.equal(r.strategy, 'api');
    assert.equal(r.retryAfterMs, 30000, 'retry-after 是秒，应换算成毫秒');
});

test('429 绝不回落 DOM（限速时叠加请求只会雪上加霜）', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => ({ status: 429, getResponseHeader: () => '5' })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1' });
    assert.equal(r.result, CLAIM_RESULT.RATE_LIMITED);
    assert.equal(domCalled, 0, '限速期间不得叠加任何额外请求');
});

test('无 retry-after 头时 429 不臆造退避时长', async () => {
    resetAll();
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => ({ status: 429, getResponseHeader: () => null })
    });
    const r = await ClaimExecutor.claim({ uid: 'u1' });
    assert.equal(r.result, CLAIM_RESULT.RATE_LIMITED);
    assert.equal(r.retryAfterMs, null, '交给令牌桶按自己的退避策略决定');
});

test('缺少 CSRF token 时接口策略直接失败', async () => {
    resetAll();
    Utils.getCookie = () => '';
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => ({ status: 200, getResponseHeader: () => null })
    });

    const r = await ClaimExecutor.claim({ uid: 'u1' });
    assert.equal(r.result, CLAIM_RESULT.FAILURE);
    assert.match(r.reason, /CSRF/);
});

test('策略抛异常被吞掉并回落到下一个，不向上冒泡', async () => {
    resetAll();
    let domCalled = 0;
    setDomClaim(async () => { domCalled += 1; return { result: CLAIM_RESULT.SUCCESS }; });
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => { throw new Error('boom'); }
    });

    const r = await ClaimExecutor.claim({ uid: 'u1' });
    assert.equal(r.strategy, 'dom');
    assert.equal(domCalled, 1);
});

test('DomClaim 兼容旧式布尔返回值', async () => {
    resetAll();
    setDomClaim(async () => true);
    assert.equal((await DomClaim.claim({ uid: 'u1' })).result, CLAIM_RESULT.SUCCESS);

    setDomClaim(async () => false);
    assert.equal((await DomClaim.claim({ uid: 'u1' })).result, CLAIM_RESULT.FAILURE);
});

test('buildBody 可自定义请求体', async () => {
    resetAll();
    let captured = null;
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        buildBody: (task) => ({ listing_uid: task.uid, source: 'userscript' }),
        fetchImpl: async (opts) => {
            captured = JSON.parse(opts.data);
            return { status: 200, getResponseHeader: () => null };
        }
    });

    await ApiClaim.claim({ uid: 'abc' });
    assert.deepEqual(captured, { listing_uid: 'abc', source: 'userscript' });
});

test('preferApi 关闭时优先走 DOM', async () => {
    resetAll();
    const calls = [];
    setDomClaim(async () => { calls.push('dom'); return { result: CLAIM_RESULT.SUCCESS }; });
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => { calls.push('api'); return { status: 200, getResponseHeader: () => null }; }
    });

    await ClaimExecutor.claim({ uid: 'u1' }, { preferApi: false });
    assert.deepEqual(calls, ['dom'], '灰度期间可强制走 DOM 对照');
});

test('stats 聚合可观测指标', async () => {
    resetAll();
    setDomClaim(async () => ({ result: CLAIM_RESULT.SUCCESS }));
    ApiClaim.configure({
        endpoint: 'https://www.fab.com/i/listings/claim',
        fetchImpl: async () => ({ status: 200, getResponseHeader: () => null })
    });

    await ClaimExecutor.claim({ uid: 'a' });
    await ClaimExecutor.claim({ uid: 'b' });

    const s = ClaimExecutor.stats();
    assert.equal(s.api.attempts, 2);
    assert.equal(s.api.success, 2);
    assert.equal(s.dom.attempts, 0);
    assert.equal(s.fallbackRate, 0);
});
