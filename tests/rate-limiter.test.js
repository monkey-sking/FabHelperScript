import test from 'node:test';
import assert from 'node:assert/strict';

import { RateLimiter } from '../src/modules/rate-limiter.js';

// 时间全部由测试注入，不依赖真实时间流逝
function fresh({ ratePerMin = 60, burst = 5, minRatePerMin = 4 } = {}) {
    RateLimiter.configure({ ratePerMin, burst, minRatePerMin });
    RateLimiter.reset(0);
    return RateLimiter;
}

test('桶满时允许突发，耗尽后拒绝', () => {
    fresh({ ratePerMin: 60, burst: 5 });
    // 60 次/分钟 = 1 次/秒
    assert.equal(RateLimiter.tryAcquire(1, 0), true);
    assert.equal(RateLimiter.tryAcquire(1, 0), true);
    assert.equal(RateLimiter.tryAcquire(1, 0), true);
    assert.equal(RateLimiter.tryAcquire(1, 0), true);
    assert.equal(RateLimiter.tryAcquire(1, 0), true);
    assert.equal(RateLimiter.tryAcquire(1, 0), false, '桶容量 5 用尽后应拒绝');
});

test('令牌按速率随时间补充', () => {
    fresh({ ratePerMin: 60, burst: 5 });
    for (let i = 0; i < 5; i++) RateLimiter.tryAcquire(1, 0);
    assert.equal(RateLimiter.tryAcquire(1, 0), false);

    // 1 秒后应刚好补回 1 个
    assert.equal(RateLimiter.tryAcquire(1, 1000), true);
    assert.equal(RateLimiter.tryAcquire(1, 1000), false);

    // 5 秒后补满（上限为容量）
    assert.equal(RateLimiter.tryAcquire(5, 6000), true);
});

test('长时间空转不会超过桶容量', () => {
    fresh({ ratePerMin: 600, burst: 3 });
    assert.equal(RateLimiter.tryAcquire(1, 0), true);
    // 空转一小时后令牌仍被容量限制
    assert.equal(RateLimiter.status(3600000).tokens, 3);
});

test('nextAvailableMs 给出正确等待时间且无副作用', () => {
    fresh({ ratePerMin: 60, burst: 2 });
    RateLimiter.tryAcquire(1, 0);
    RateLimiter.tryAcquire(1, 0);

    const tokensBefore = RateLimiter.tokens;
    const wait = RateLimiter.nextAvailableMs(1, 0);
    assert.equal(wait, 1000, '缺 1 个令牌、速率 1 个/秒 → 应等 1000ms');
    assert.equal(RateLimiter.tokens, tokensBefore, '查询不应改变令牌数');
    assert.equal(RateLimiter.lastRefill, 0, '查询不应推进补充时间戳');

    // 等满之后确实能取到
    assert.equal(RateLimiter.tryAcquire(1, 1000), true);
});

test('penalize 暂停派发并折半速率（乘性减）', () => {
    fresh({ ratePerMin: 40, burst: 5 });
    assert.equal(RateLimiter.tryAcquire(1, 0), true);

    const result = RateLimiter.penalize(30000, 0);
    assert.equal(result.pauseMs, 30000);
    assert.equal(result.ratePerMin, 20, '40 折半为 20');

    // 暂停期间一律拒绝，即便桶里还有令牌
    assert.equal(RateLimiter.tryAcquire(1, 10000), false);
    assert.equal(RateLimiter.status(10000).paused, true);
    assert.equal(RateLimiter.status(10000).pauseLeftMs, 20000);

    // 暂停解除，但惩罚已清空令牌桶 —— 解除瞬间必须逐令牌恢复，不得突发
    assert.equal(RateLimiter.status(30000).paused, false);
    assert.equal(RateLimiter.tryAcquire(1, 30000), false);
    // 折半后 20 次/分钟 = 每 3000ms 补 1 个令牌
    assert.equal(RateLimiter.tryAcquire(1, 33100), true);
});

test('暂停期间冻结令牌补充，解除瞬间不会突发', () => {
    fresh({ ratePerMin: 600, burst: 10 });
    RateLimiter.penalize(60000, 0);
    // 暂停 60 秒期间，令牌不应被补满
    assert.equal(RateLimiter.tokens, 0, '惩罚会清空桶');
    assert.equal(RateLimiter.status(30000).tokens, 0);
    // 解除瞬间也不能一次取走 10 个（速率已折半且桶空）
    assert.equal(RateLimiter.tryAcquire(10, 60000), false);
});

test('未指定 retryAfter 时按连续惩罚次数指数退避，且封顶 10 分钟', () => {
    fresh();
    assert.equal(RateLimiter.penalize(null, 0).pauseMs, 30000);
    RateLimiter.pauseUntil = 0;
    assert.equal(RateLimiter.penalize(null, 0).pauseMs, 60000);
    RateLimiter.pauseUntil = 0;
    assert.equal(RateLimiter.penalize(null, 0).pauseMs, 120000);
    RateLimiter.pauseUntil = 0;
    assert.equal(RateLimiter.penalize(null, 0).pauseMs, 240000);
    RateLimiter.pauseUntil = 0;
    assert.equal(RateLimiter.penalize(null, 0).pauseMs, 480000);
    RateLimiter.pauseUntil = 0;
    assert.equal(RateLimiter.penalize(null, 0).pauseMs, 600000, '封顶 10 分钟');
    RateLimiter.pauseUntil = 0;
    assert.equal(RateLimiter.penalize(null, 0).pauseMs, 600000, '继续封顶');
});

test('降速有下限，不会被反复惩罚打到 0', () => {
    fresh({ ratePerMin: 40, burst: 5, minRatePerMin: 4 });
    let rate = 40;
    for (let i = 0; i < 10; i++) {
        rate = RateLimiter.penalize(0, 0).ratePerMin;
        RateLimiter.pauseUntil = 0;
    }
    assert.equal(rate, 4, '应停在 minRatePerMin 上');
});

test('reward 和性增，逐步恢复到基准速率但不超过', () => {
    fresh({ ratePerMin: 40, burst: 5 });
    RateLimiter.penalize(0, 0);      // 40 → 20
    RateLimiter.pauseUntil = 0;
    assert.equal(RateLimiter.currentRatePerMin, 20);

    // 每 8 次连续成功上调基准的 25%（即 10）
    for (let i = 0; i < 8; i++) RateLimiter.reward();
    assert.equal(RateLimiter.currentRatePerMin, 30);

    for (let i = 0; i < 8; i++) RateLimiter.reward();
    assert.equal(RateLimiter.currentRatePerMin, 40);

    for (let i = 0; i < 80; i++) RateLimiter.reward();
    assert.equal(RateLimiter.currentRatePerMin, 40, '不得超过基准速率');
});

test('reward 会重置连续惩罚计数', () => {
    fresh();
    RateLimiter.penalize(null, 0);
    RateLimiter.penalize(null, 0);
    assert.equal(RateLimiter.status(0).penaltyCount, 2);
    RateLimiter.reward();
    assert.equal(RateLimiter.status(0).penaltyCount, 0);
});

test('status 暴露可观测字段供控制台展示', () => {
    fresh({ ratePerMin: 40, burst: 5 });
    RateLimiter.tryAcquire(2, 0);
    const s = RateLimiter.status(0);
    assert.equal(s.ratePerMin, 40);
    assert.equal(s.baseRatePerMin, 40);
    assert.equal(s.tokens, 3);
    assert.equal(s.capacity, 5);
    assert.equal(s.paused, false);
    assert.equal(s.pauseLeftMs, 0);
});
