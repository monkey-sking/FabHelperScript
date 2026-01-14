/**
 * Fab Helper - Instance Manager Module
 * 
 * This module handles:
 * - Multi-instance coordination across browser tabs
 * - Active instance detection and takeover
 * - Periodic ping mechanism for instance liveness
 */
import { Config } from '../config.js';
import { Utils } from './utils.js';

export const InstanceManager = {
    isActive: false,
    lastPingTime: 0,
    pingInterval: null,

    // 初始化实例管理
    init: async function () {
        try {
            // 检查当前页面是否是搜索页面
            const isSearchPage = window.location.href.includes('/search') ||
                window.location.pathname === '/' ||
                window.location.pathname === '/zh-cn/' ||
                window.location.pathname === '/en/';

            // 如果是搜索页面，总是成为活跃实例
            if (isSearchPage) {
                this.isActive = true;
                await this.registerAsActive();
                Utils.logger('info', Utils.getText('log_instance_activated', Config.INSTANCE_ID));

                // 启动ping机制，每3秒更新一次活跃状态
                this.pingInterval = setInterval(() => this.ping(), 3000);
                return true;
            }

            // 如果是工作标签页，检查是否有活跃实例
            const activeInstance = await GM_getValue('fab_active_instance', null);
            const currentTime = Date.now();

            if (activeInstance && (currentTime - activeInstance.lastPing < 10000)) {
                // 如果有活跃实例且在10秒内有ping，则当前实例不活跃
                Utils.logger('info', Utils.getText('log_instance_collaborating', activeInstance.id));
                this.isActive = false;
                return true; // 工作标签页也返回true，因为它需要执行自己的任务
            } else {
                // 没有活跃实例或实例超时，当前实例成为活跃实例
                this.isActive = true;
                await this.registerAsActive();
                Utils.logger('info', Utils.getText('log_instance_no_active', Config.INSTANCE_ID));

                // 启动ping机制，每3秒更新一次活跃状态
                this.pingInterval = setInterval(() => this.ping(), 3000);
                return true;
            }
        } catch (error) {
            Utils.logger('error', Utils.getText('log_instance_init_failed', error.message));
            // 出错时默认为活跃，避免脚本不工作
            this.isActive = true;
            return true;
        }
    },

    // 注册为活跃实例
    registerAsActive: async function () {
        await GM_setValue('fab_active_instance', {
            id: Config.INSTANCE_ID,
            lastPing: Date.now()
        });
    },

    // 定期更新活跃状态
    ping: async function () {
        if (!this.isActive) return;

        this.lastPingTime = Date.now();
        await this.registerAsActive();
    },

    // 检查是否可以接管
    checkTakeover: async function () {
        if (this.isActive) return;

        try {
            const activeInstance = await GM_getValue('fab_active_instance', null);
            const currentTime = Date.now();

            if (!activeInstance || (currentTime - activeInstance.lastPing > 10000)) {
                // 如果没有活跃实例或实例超时，接管
                this.isActive = true;
                await this.registerAsActive();
                Utils.logger('info', Utils.getText('log_instance_takeover', Config.INSTANCE_ID));

                // 启动ping机制
                this.pingInterval = setInterval(() => this.ping(), 3000);

                // 刷新页面以确保正确加载
                location.reload();
            } else {
                // 继续等待
                setTimeout(() => this.checkTakeover(), 5000);
            }
        } catch (error) {
            Utils.logger('error', Utils.getText('log_instance_takeover_failed', error.message));
            // 5秒后重试
            setTimeout(() => this.checkTakeover(), 5000);
        }
    },

    // 清理实例
    cleanup: function () {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    },

    // 手动强制激活（用于用户手动开始任务时）
    activate: async function () {
        if (this.isActive) return;

        this.isActive = true;
        await this.registerAsActive();
        Utils.logger('info', Utils.getText('log_instance_activated', Config.INSTANCE_ID));

        if (!this.pingInterval) {
            this.pingInterval = setInterval(() => this.ping(), 3000);
        }
    }
};
