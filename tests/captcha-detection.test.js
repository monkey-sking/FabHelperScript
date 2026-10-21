import test from 'node:test';
import assert from 'node:assert/strict';
import { isCaptchaPresent } from '../src/modules/captcha-detection.js';

test('isCaptchaPresent 准确识别各类验证 iframe 与验证文案', () => {
    // 假 DOM 构造器
    const makeDoc = ({ frames = [], text = '' } = {}) => ({
        querySelectorAll: () => frames.map(f => ({
            getBoundingClientRect: () => ({ width: f.width ?? 100, height: f.height ?? 100 }),
            ownerDocument: { defaultView: { getComputedStyle: () => ({ visibility: f.visibility ?? 'visible', display: f.display ?? 'block' }) } }
        })),
        defaultView: { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) },
        body: { innerText: text }
    });

    // 1. 普通正常页面（无验证码）
    assert.equal(isCaptchaPresent(makeDoc({ text: 'Fab Helper 正常商品详情页' })), false);
    assert.equal(isCaptchaPresent(null), false);

    // 2. 包含验证关键词
    assert.equal(isCaptchaPresent(makeDoc({ text: '请完成安全验证后继续访问' })), true);
    assert.equal(isCaptchaPresent(makeDoc({ text: 'Verify you are human to proceed' })), true);
    assert.equal(isCaptchaPresent(makeDoc({ text: 'Checking your browser before accessing Fab' })), true);
    assert.equal(isCaptchaPresent(makeDoc({ text: '确认您是真人' })), true);

    // 3. 包含可见的 challenge iframe
    assert.equal(isCaptchaPresent(makeDoc({ frames: [{ width: 300, height: 80 }] })), true);

    // 4. 不可见的 iframe 不误报
    assert.equal(isCaptchaPresent(makeDoc({ frames: [{ width: 0, height: 0 }] })), false);
    assert.equal(isCaptchaPresent(makeDoc({ frames: [{ width: 100, height: 100, display: 'none' }] })), false);
});
