/**
 * Fab Helper - API Module
 */
import { State } from '../state.js';
import { Utils } from './utils.js';
import { DataCache } from './data-cache.js';

export const API = {
    gmFetch: (options) => {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                anonymous: false, // Default to false to ensure cookies are sent
                ...options,
                onload: (response) => resolve(response),
                onerror: (error) => reject(new Error(`GM_xmlhttpRequest error: ${error.statusText || 'Unknown Error'}`)),
                ontimeout: () => reject(new Error('Request timed out.')),
                onabort: () => reject(new Error('Request aborted.'))
            });
        });
    },

    // 接口响应数据提取函数
    extractStateData: (rawData, source = '') => {
        // 记录原始数据格式
        const dataType = Array.isArray(rawData) ? 'Array' : typeof rawData;
        if (State.debugMode) {
            Utils.logger('debug', `[${source}] 接口返回数据类型: ${dataType}`);
        }

        // 如果是数组，直接返回
        if (Array.isArray(rawData)) {
            return rawData;
        }

        // 如果是对象，尝试提取可能的数组字段
        if (rawData && typeof rawData === 'object') {
            // 记录对象的顶级键
            const keys = Object.keys(rawData);
            if (State.debugMode) {
                Utils.logger('debug', `[${source}] 接口返回对象键: ${keys.join(', ')}`);
            }

            // 尝试常见的数组字段名
            const possibleArrayFields = ['data', 'results', 'items', 'listings', 'states'];
            for (const field of possibleArrayFields) {
                if (rawData[field] && Array.isArray(rawData[field])) {
                    Utils.logger('info', `[${source}] 在字段 "${field}" 中找到数组数据`);
                    return rawData[field];
                }
            }

            // 如果没有找到预定义字段，查找任何数组类型的字段
            for (const key of keys) {
                if (Array.isArray(rawData[key])) {
                    Utils.logger('info', `[${source}] 在字段 "${key}" 中找到数组数据`);
                    return rawData[key];
                }
            }

            // 如果对象中有uid和acquired字段，可能是单个项目
            if (rawData.uid && 'acquired' in rawData) {
                Utils.logger('info', `[${source}] 返回的是单个项目数据，转换为数组`);
                return [rawData];
            }
        }

        // 如果无法提取，记录详细信息并返回空数组
        Utils.logger('warn', `[${source}] 无法从API响应中提取数组数据`);
        if (State.debugMode) {
            try {
                const preview = JSON.stringify(rawData).substring(0, 200);
                Utils.logger('debug', `[${source}] API响应预览: ${preview}...`);
            } catch (e) {
                Utils.logger('debug', `[${source}] 无法序列化API响应: ${e.message}`);
            }
        }
        return [];
    },

    // 优化后的商品拥有状态检查函数 - 只使用缓存和网页原生请求的数据
    checkItemsOwnership: async function (uids) {
        if (!uids || uids.length === 0) return [];

        try {
            // 从缓存中获取已知的拥有状态
            const { result: cachedResults, missing: missingUids } = DataCache.getOwnedStatus(uids);

            // 如果有缺失的UID，记录但不主动请求
            if (missingUids.length > 0) {
                Utils.logger('debug', Utils.getText('fab_dom_unknown_status', missingUids.length));
                // 将这些UID添加到等待列表，等待网页原生请求更新
                DataCache.addToWaitingList(missingUids);
            }

            // 只返回缓存中已有的结果
            return cachedResults;
        } catch (e) {
            Utils.logger('error', `检查拥有状态失败: ${e.message}`);
            return []; // 出错时返回空数组
        }
    },

    // 优化后的价格验证函数
    checkItemsPrices: async function (offerIds) {
        if (!offerIds || offerIds.length === 0) return [];

        try {
            // 从缓存中获取已知的价格信息
            const { result: cachedResults, missing: missingOfferIds } = DataCache.getPrices(offerIds);

            // 如果所有报价都有缓存，直接返回
            if (missingOfferIds.length === 0) {
                if (State.debugMode) {
                    Utils.logger('info', `使用缓存的价格数据，避免API请求`);
                }
                return cachedResults;
            }

            // 对缺失的报价ID发送API请求
            if (State.debugMode) {
                Utils.logger('info', `对 ${missingOfferIds.length} 个缺失的报价ID发送API请求`);
            }

            const csrfToken = Utils.getCookie('fab_csrftoken');
            if (!csrfToken) {
                Utils.checkAuthentication();
                throw new Error("CSRF token not found");
            }

            const pricesUrl = new URL('https://www.fab.com/i/listings/prices-infos');
            missingOfferIds.forEach(offerId => pricesUrl.searchParams.append('offer_ids', offerId));

            const response = await this.gmFetch({
                method: 'GET',
                url: pricesUrl.href,
                headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
            });

            try {
                const pricesData = JSON.parse(response.responseText);

                // 提取并缓存价格信息
                if (pricesData.offers && Array.isArray(pricesData.offers)) {
                    DataCache.savePrices(pricesData.offers);

                    // 合并缓存结果和API结果
                    return [...cachedResults, ...pricesData.offers];
                }
            } catch (e) {
                Utils.logger('error', `[优化] 解析价格API响应失败: ${e.message}`);
            }

            // 出错时返回缓存结果
            return cachedResults;
        } catch (e) {
            Utils.logger('error', `[优化] 获取价格信息失败: ${e.message}`);
            return []; // 出错时返回空数组
        }
    }
};
