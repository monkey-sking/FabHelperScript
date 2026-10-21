import test from 'node:test';
import assert from 'node:assert/strict';
import { VerificationNotifications as notices } from '../src/modules/verification-notifications.js';

test('background verification never requests permission; explicit enable requests and sends a test', async t => {
    const previous = globalThis.Notification;
    t.after(() => { globalThis.Notification = previous; notices.sent.clear(); });
    let requests = 0;
    const delivered = [];
    class Notice {
        static permission = 'default';
        static async requestPermission() { requests++; Notice.permission = 'granted'; return 'granted'; }
        constructor(title, options) { delivered.push({ title, options, instance: this }); }
        close() { this.closed = true; }
    }
    globalThis.Notification = Notice;
    assert.equal(notices.show({ task: { uid: 'u' } }), false);
    assert.equal(requests, 0);
    assert.equal(await notices.enableAndTest(), 'granted');
    assert.equal(requests, 1);
    assert.equal(delivered.length, 1);
    let focused = 0;
    assert.equal(notices.show({ task: { uid: 'u', name: 'Asset' }, workerId: 'w', win: { focus: () => focused++ } }), true);
    assert.equal(notices.show({ workerId: 'w' }), false);
    assert.equal(delivered.length, 2);
    delivered[1].instance.onclick();
    assert.equal(focused, 1);
    assert.equal(delivered[1].instance.closed, true);
    assert.match(delivered[1].options.body, /手动完成验证/);
    Notice.permission = 'denied';
    assert.equal(notices.show({ workerId: 'other' }), false);
    assert.equal(await notices.enableAndTest(), 'denied');
    assert.equal(requests, 1, 'denied permission must not be requested repeatedly');
});

test('missing Notification or constructor failure leaves manual handling available', t => {
    const previous = globalThis.Notification;
    t.after(() => { globalThis.Notification = previous; });
    globalThis.Notification = undefined;
    assert.equal(notices.show(), false);
    globalThis.Notification = class {
        static permission = 'granted';
        constructor() { throw new Error('browser disabled notifications'); }
    };
    assert.equal(notices.show(), false);
});
