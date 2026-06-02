/**
 * Fab Helper - KeepAlive Module
 *
 * 让主标签页(manager)在后台 / 最小化 / 锁屏时仍能持续调度任务。
 * Chrome 会对隐藏标签页做两件事，二者要分别对付：
 *   L1 定时器节流: 后台标签页主线程的 setTimeout/setInterval 被钳到 >=1s，
 *                  隐藏 >5min 后进一步降到约 1 次/分钟。
 *     -> 对策: Web Worker 线程里的定时器不受主线程节流影响，用它周期性
 *              postMessage "踢" 主线程执行调度回调。
 *   L2 整页冻结: 隐藏且静音 >5min 的 CPU 密集标签页会被 freeze(连 message
 *                /事件都挂起)，心跳也救不了。
 *     -> 对策: 本地 RTCPeerConnection loopback + 一个 open 的 RTCDataChannel
 *              命中 Chrome 的冻结豁免(官方列出: 带 open data channel 的 RTC 连接)，
 *              且全程无声。可用 Config.ENABLE_FREEZE_GUARD 关闭。
 *
 * 注意: 静音音频骗不过 Chrome(必须可闻才豁免)，所以这里用 WebRTC 而非音频。
 * 参考: https://developer.chrome.com/blog/freezing-on-energy-saver
 *       https://developer.chrome.com/blog/timer-throttling-in-chrome-88
 */
import { Config } from '../config.js';
import { Utils } from './utils.js';

export const KeepAlive = {
    _worker: null,
    _workerUrl: null,
    _tickCb: null,
    _running: false,

    // WebRTC freeze-guard
    _pc1: null,
    _pc2: null,
    _dc: null,

    /** 注入心跳要执行的调度回调(由 index.js 提供，内含 ping/派发/watchdog) */
    setTick(cb) {
        this._tickCb = cb;
    },

    /** 启动后台保活(心跳 + 可选的防冻结)。幂等。 */
    start() {
        if (this._running) return;
        this._running = true;
        this._startHeartbeat();
        if (Config.ENABLE_FREEZE_GUARD) {
            // 异步建连，失败不影响心跳
            this._startFreezeGuard();
        }
    },

    /** 停止后台保活，释放 Worker 与 RTC 资源。幂等。 */
    stop() {
        if (!this._running) return;
        this._running = false;
        this._stopHeartbeat();
        this._stopFreezeGuard();
    },

    _startHeartbeat() {
        if (this._worker) return;
        try {
            const intervalMs = Config.KEEPALIVE_TICK_MS || 2000;
            // Worker 内的定时器不被主线程后台节流，是不间断的心跳源
            const workerSrc = 'let n=0;setInterval(function(){postMessage(++n);},' + intervalMs + ');';
            const blob = new Blob([workerSrc], { type: 'application/javascript' });
            this._workerUrl = URL.createObjectURL(blob);
            this._worker = new Worker(this._workerUrl);
            this._worker.onmessage = () => {
                try {
                    const r = this._tickCb && this._tickCb();
                    // tick 回调可能是 async，吞掉其 rejection，避免中断心跳
                    if (r && typeof r.catch === 'function') {
                        r.catch(e => console.error('[Fab Helper] keepalive tick error:', e));
                    }
                } catch (e) {
                    console.error('[Fab Helper] keepalive tick error:', e);
                }
            };
            Utils.logger('debug', Utils.getText('log_keepalive_on'));
        } catch (e) {
            Utils.logger('warn', Utils.getText('log_keepalive_failed', e.message));
        }
    },

    _stopHeartbeat() {
        if (this._worker) {
            try { this._worker.terminate(); } catch (e) { /* ignore */ }
            this._worker = null;
        }
        if (this._workerUrl) {
            try { URL.revokeObjectURL(this._workerUrl); } catch (e) { /* ignore */ }
            this._workerUrl = null;
        }
    },

    async _startFreezeGuard() {
        if (this._pc1 || typeof RTCPeerConnection === 'undefined') return;
        try {
            const pc1 = new RTCPeerConnection();
            const pc2 = new RTCPeerConnection();
            this._pc1 = pc1;
            this._pc2 = pc2;

            pc1.onicecandidate = e => { if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {}); };
            pc2.onicecandidate = e => { if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {}); };

            // 一个保持 open 的 data channel 即可命中冻结豁免
            this._dc = pc1.createDataChannel('fab-keepalive');

            const offer = await pc1.createOffer();
            await pc1.setLocalDescription(offer);
            await pc2.setRemoteDescription(offer);
            const answer = await pc2.createAnswer();
            await pc2.setLocalDescription(answer);
            await pc1.setRemoteDescription(answer);
        } catch (e) {
            Utils.logger('warn', Utils.getText('log_keepalive_failed', e.message));
            this._stopFreezeGuard();
        }
    },

    _stopFreezeGuard() {
        try { if (this._dc) this._dc.close(); } catch (e) { /* ignore */ }
        try { if (this._pc1) this._pc1.close(); } catch (e) { /* ignore */ }
        try { if (this._pc2) this._pc2.close(); } catch (e) { /* ignore */ }
        this._dc = null;
        this._pc1 = null;
        this._pc2 = null;
    },

    /** 由心跳驱动，偶尔通过 data channel 发一下保持活跃 */
    poke() {
        try {
            if (this._dc && this._dc.readyState === 'open') this._dc.send('p');
        } catch (e) { /* ignore */ }
    },
};
