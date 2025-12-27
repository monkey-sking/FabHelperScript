/**
 * Fab Helper - Data Cache System
 */
import { State } from '../state.js';
import { Utils } from './utils.js';

export const DataCache = {
    // 商品数据缓存 - 键为商品ID，值为商品数据
    listings: new Map(),

    // 拥有状态缓存 - 键为商品ID，值为拥有状态对象
    ownedStatus: new Map(),

    // 价格缓存 - 键为报价ID，值为价格信息对象
    prices: new Map(),

    // 等待网页原生请求更新的UID列表
    waitingList: new Set(),

    // 缓存时间戳 - 用于判断缓存是否过期
    timestamps: {
        listings: new Map(),
        ownedStatus: new Map(),
        prices: new Map()
    },

    // 缓存有效期（毫秒）
    TTL: 5 * 60 * 1000, // 5分钟

    // 检查缓存是否有效
    isValid: function (type, key) {
        const timestamp = this.timestamps[type].get(key);
        return timestamp && (Date.now() - timestamp < this.TTL);
    },

    // 保存商品数据到缓存
    saveListings: function (items) {
        if (!Array.isArray(items)) return;

        const now = Date.now();
        items.forEach(item => {
            if (item && item.uid) {
                this.listings.set(item.uid, item);
                this.timestamps.listings.set(item.uid, now);
            }
        });
    },

    // 添加到等待列表
    addToWaitingList: function (uids) {
        if (!uids || !Array.isArray(uids)) return;
        uids.forEach(uid => this.waitingList.add(uid));
        Utils.logger('debug', `[Cache] ${Utils.getText('fab_dom_add_to_waitlist', uids.length, this.waitingList.size)}`);
    },

    // 检查并从等待列表中移除
    checkWaitingList: function () {
        if (this.waitingList.size === 0) return;

        // 检查等待列表中的UID是否已经有了拥有状态
        let removedCount = 0;
        for (const uid of this.waitingList) {
            if (this.ownedStatus.has(uid)) {
                this.waitingList.delete(uid);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            Utils.logger('info', `[Cache] 从等待列表中移除了 ${removedCount} 个已更新的商品ID，剩余: ${this.waitingList.size}`);
        }
    },

    // 保存拥有状态到缓存
    saveOwnedStatus: function (states) {
        if (!Array.isArray(states)) return;

        const now = Date.now();
        states.forEach(state => {
            if (state && state.uid) {
                this.ownedStatus.set(state.uid, {
                    acquired: !!state.acquired,
                    lastUpdatedAt: state.lastUpdatedAt || new Date().toISOString(),
                    uid: state.uid
                });
                this.timestamps.ownedStatus.set(state.uid, now);

                // 如果在等待列表中，从等待列表移除
                if (this.waitingList.has(state.uid)) {
                    this.waitingList.delete(state.uid);
                }
            }
        });

        // 如果有更新，检查等待列表
        if (states.length > 0) {
            this.checkWaitingList();
        }
    },

    // 保存价格信息到缓存
    savePrices: function (offers) {
        if (!Array.isArray(offers)) return;

        const now = Date.now();
        offers.forEach(offer => {
            if (offer && offer.offerId) {
                this.prices.set(offer.offerId, {
                    offerId: offer.offerId,
                    price: offer.price || 0,
                    currencyCode: offer.currencyCode || 'USD'
                });
                this.timestamps.prices.set(offer.offerId, now);
            }
        });
    },

    // 获取商品数据，如果缓存有效则使用缓存
    getListings: function (uids) {
        const result = [];
        const missing = [];

        uids.forEach(uid => {
            if (this.isValid('listings', uid)) {
                result.push(this.listings.get(uid));
            } else {
                missing.push(uid);
            }
        });

        return { result, missing };
    },

    // 获取拥有状态，如果缓存有效则使用缓存
    getOwnedStatus: function (uids) {
        const result = [];
        const missing = [];

        uids.forEach(uid => {
            if (this.isValid('ownedStatus', uid)) {
                result.push(this.ownedStatus.get(uid));
            } else {
                missing.push(uid);
            }
        });

        return { result, missing };
    },

    // 获取价格信息，如果缓存有效则使用缓存
    getPrices: function (offerIds) {
        const result = [];
        const missing = [];

        offerIds.forEach(offerId => {
            if (this.isValid('prices', offerId)) {
                result.push(this.prices.get(offerId));
            } else {
                missing.push(offerId);
            }
        });

        return { result, missing };
    },

    // 清理过期缓存
    cleanupExpired: function () {
        try {
            const now = Date.now();
            const cacheTypes = ['listings', 'ownedStatus', 'prices'];

            // 统一清理所有类型的缓存
            for (const type of cacheTypes) {
                for (const [key, timestamp] of this.timestamps[type].entries()) {
                    if (now - timestamp > this.TTL) {
                        this[type].delete(key);
                        this.timestamps[type].delete(key);
                    }
                }
            }

            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('cache_cleanup_complete', this.listings.size, this.ownedStatus.size, this.prices.size));
            }
        } catch (e) {
            Utils.logger('error', `缓存清理失败: ${e.message}`);
        }
    }
};
