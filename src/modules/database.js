/**
 * Fab Helper - Database Module
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';
import { DataCache } from './data-cache.js';

// Forward declaration for circular dependency
let UI = null;
export const setUIReference = (uiModule) => { UI = uiModule; };

export const Database = {
    normalizeListingUrl: (url) => {
        if (!url) return '';
        const cleanUrl = String(url).split('?')[0].toLowerCase();
        const uidMatch = cleanUrl.match(/\/listings\/([^/?#]+)/i);
        if (uidMatch && uidMatch[1]) {
            return `https://www.fab.com/listings/${uidMatch[1].toLowerCase()}`;
        }
        return cleanUrl;
    },

    // 归一化 url 的 Set，避免 isDone 在热路径上对每个 done 项重复 normalize（O(n²)）。
    doneSet: new Set(),
    // State.db.done 的数组引用，用于 O(1) 检测「直接重赋值」（测试/直接赋值加载），
    // 命中即从数组重建 doneSet；生产路径只经 normalizeDoneList/addDoneUrl 写入，无需重建。
    _doneRef: null,

    // 存储读写兜底：单个 GM_* 失败（如存储写满/序列化失败）不应中断主流程。
    _safeGet: async (key, def) => {
        try { return await GM_getValue(key, def); } catch (e) {
            Utils.logger('error', `读取存储失败 [${key}]: ${e.message}`);
            return def;
        }
    },
    _safeSet: (key, val) => {
        try { GM_setValue(key, val); } catch (e) {
            Utils.logger('error', `写入存储失败 [${key}]: ${e.message}`);
        }
    },

    getListingUid: (url) => {
        if (!url) return '';
        const uidMatch = String(url).split('?')[0].match(/\/listings\/([^/?#]+)/i);
        return uidMatch && uidMatch[1] ? uidMatch[1].toLowerCase() : '';
    },

    seedDoneOwnedStatusCache: () => {
        const states = State.db.done
            .map(url => Database.getListingUid(url))
            .filter(Boolean)
            .map(uid => ({
                uid,
                acquired: true,
                lastUpdatedAt: new Date().toISOString()
            }));

        DataCache.saveOwnedStatus(states);
        return states.length;
    },

    normalizeDoneList: () => {
        const normalized = [];
        const seen = new Set();
        State.db.done.forEach(url => {
            const cleanUrl = Database.normalizeListingUrl(url);
            if (!cleanUrl || seen.has(cleanUrl)) return;
            seen.add(cleanUrl);
            normalized.push(cleanUrl);
        });

        const changed = normalized.length !== State.db.done.length ||
            normalized.some((url, index) => url !== State.db.done[index]);
        State.db.done = normalized;
        Database.doneSet = new Set(normalized);
        return changed;
    },

    addDoneUrl: (url) => {
        const normalizedChanged = Database.normalizeDoneList();
        const cleanUrl = Database.normalizeListingUrl(url);
        if (!cleanUrl) return normalizedChanged;
        if (Database.isDone(cleanUrl)) return normalizedChanged;
        State.db.done.push(cleanUrl);
        Database.doneSet.add(cleanUrl);
        Database.seedDoneOwnedStatusCache();
        return true;
    },

    load: async () => {
        // 从存储中加载待办列表
        State.db.todo = await Database._safeGet(Config.DB_KEYS.TODO, []);
        State.db.done = await Database._safeGet(Config.DB_KEYS.DONE, []);
        State.db.failed = await Database._safeGet(Config.DB_KEYS.FAILED, []);
        State.hideSaved = await Database._safeGet(Config.DB_KEYS.HIDE, false);
        State.autoAddOnScroll = await Database._safeGet(Config.DB_KEYS.AUTO_ADD, false); // Load the setting
        State.rememberScrollPosition = await Database._safeGet(Config.DB_KEYS.REMEMBER_POS, false);
        State.autoResumeAfter429 = await Database._safeGet(Config.DB_KEYS.AUTO_RESUME, false);
        State.autoRefreshEmptyPage = await Database._safeGet(Config.DB_KEYS.AUTO_REFRESH_EMPTY, true); // 加载无商品自动刷新设置
        State.hideDiscountedPaid = await Database._safeGet(Config.DB_KEYS.HIDE_DISCOUNTED, false); // 加载隐藏打折付费设置
        State.hidePaid = await Database._safeGet(Config.DB_KEYS.HIDE_PAID, false); // 加载隐藏所有付费设置
        State.blockLargeResources = await Database._safeGet(Config.DB_KEYS.BLOCK_RESOURCES, true); // 加载工作标签页禁用大资源设置
        State.debugMode = await Database._safeGet('fab_helper_debug_mode', false); // 加载调试模式设置
        State.currentSortOption = await Database._safeGet('fab_helper_sort_option', 'title_desc'); // 加载排序设置
        State.isExecuting = await Database._safeGet(Config.DB_KEYS.IS_EXECUTING, false); // Load the execution state

        State.statusHistory = await Database._safeGet(Config.DB_KEYS.STATUS_HISTORY, []);

        if (Database.normalizeDoneList()) {
            await Database.saveDone();
        }

        Database.seedDoneOwnedStatusCache();

        Utils.logger('info', Utils.getText('log_db_loaded'), `(Session) To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
    },
    // 添加保存待办列表的方法
    saveTodo: () => Database._safeSet(Config.DB_KEYS.TODO, State.db.todo),
    saveDone: () => Database._safeSet(Config.DB_KEYS.DONE, State.db.done),
    saveFailed: () => Database._safeSet(Config.DB_KEYS.FAILED, State.db.failed),
    saveHidePref: () => Database._safeSet(Config.DB_KEYS.HIDE, State.hideSaved),
    saveAutoAddPref: () => Database._safeSet(Config.DB_KEYS.AUTO_ADD, State.autoAddOnScroll), // Save the setting
    saveAutoScrollPref: () => Database._safeSet(Config.DB_KEYS.AUTO_SCROLL, State.autoScroll), // 保存自动滚动页面开关
    saveRememberPosPref: () => Database._safeSet(Config.DB_KEYS.REMEMBER_POS, State.rememberScrollPosition),
    saveAutoResumePref: () => Database._safeSet(Config.DB_KEYS.AUTO_RESUME, State.autoResumeAfter429),
    saveAutoRefreshEmptyPref: () => Database._safeSet(Config.DB_KEYS.AUTO_REFRESH_EMPTY, State.autoRefreshEmptyPage), // 保存无商品自动刷新设置
    saveHideDiscountedPref: () => Database._safeSet(Config.DB_KEYS.HIDE_DISCOUNTED, State.hideDiscountedPaid), // 保存隐藏打折付费设置
    saveHidePaidPref: () => Database._safeSet(Config.DB_KEYS.HIDE_PAID, State.hidePaid), // 保存隐藏所有付费设置
    saveBlockResourcesPref: () => Database._safeSet(Config.DB_KEYS.BLOCK_RESOURCES, State.blockLargeResources), // 保存禁用大资源设置
    saveExecutingState: () => Database._safeSet(Config.DB_KEYS.IS_EXECUTING, State.isExecuting), // Save the execution state

    resetAllData: async () => {
        if (window.confirm(Utils.getText('confirm_clear_data'))) {
            // 清除待办列表
            await GM_deleteValue(Config.DB_KEYS.TODO);
            await GM_deleteValue(Config.DB_KEYS.DONE);
            await GM_deleteValue(Config.DB_KEYS.FAILED);
            await GM_deleteValue(Config.DB_KEYS.HIDE_DISCOUNTED); // 清除隐藏打折设置
            await GM_deleteValue(Config.DB_KEYS.HIDE_PAID); // 清除隐藏所有付费设置
            await GM_deleteValue(Config.DB_KEYS.BLOCK_RESOURCES); // 清除禁用大资源设置
            if (typeof PagePatcher !== 'undefined' && PagePatcher.clearSavedPosition) {
                await PagePatcher.clearSavedPosition('Reset all data');
            } else {
                await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
                if (typeof sessionStorage !== 'undefined') {
                    try {
                        sessionStorage.removeItem('fab_helper_recovery_cursor');
                        sessionStorage.removeItem('fab_helper_last_recovery_cursor');
                    } catch (e) { }
                }
                State.savedCursor = null;
            }
            State.db.todo = [];
            State.db.done = [];
            Database.doneSet = new Set();
            State.db.failed = [];
            State.blockLargeResources = true;
            Utils.logger('info', '所有脚本数据（包括滚动记忆与大资源禁用设置）已重置。');
            if (UI) {
                UI.removeAllOverlays();
                UI.update();
            }
        }
    },

    isDone: (url) => {
        if (!url) return false;
        const cleanUrl = Database.normalizeListingUrl(url);
        // State.db.done 可能被直接重新赋值（测试 / 直接赋值加载），doneSet 未同步；
        // 用数组引用比对检测重赋值（O(1)），命中则从数组重建 Set，保持查询 O(1)。
        // 生产路径只经 normalizeDoneList/addDoneUrl 写入，引用/push 与 Set 始终一致。
        if (Database._doneRef !== State.db.done) {
            Database.doneSet = new Set(State.db.done.map(u => Database.normalizeListingUrl(u)));
            Database._doneRef = State.db.done;
        }
        return Database.doneSet.has(cleanUrl);
    },
    isFailed: (url) => {
        if (!url) return false;
        const cleanUrl = url.split('?')[0];
        return State.db.failed.some(task => task.url === cleanUrl);
    },
    isTodo: (url) => {
        if (!url) return false;
        const cleanUrl = url.split('?')[0];
        return State.db.todo.some(task => task.url === cleanUrl);
    },
    markAsDone: async (task) => {
        if (!task || !task.uid) {
            Utils.logger('error', '标记任务完成失败，收到无效任务:', JSON.stringify(task));
            return;
        }

        // 从待办列表中移除任务
        const initialTodoCount = State.db.todo.length;

        State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);

        // 如果待办列表发生了变化，保存到存储
        if (State.db.todo.length !== initialTodoCount) {
            Database.saveTodo();
        }

        if (State.db.todo.length === initialTodoCount && initialTodoCount > 0) {
            Utils.logger('warn', '任务未能从待办列表中移除，可能已被其他操作处理');
        }

        let changed = false;

        const initialFailedCount = State.db.failed.length;
        State.db.failed = State.db.failed.filter(failedTask => failedTask.uid !== task.uid);
        if (State.db.failed.length !== initialFailedCount) {
            changed = true;
            await Database.saveFailed();
        }

        // The 'done' list can still use URLs for simplicity, as it's for display/hiding.
        if (Database.addDoneUrl(task.url)) {
            changed = true;
        }

        if (changed) {
            await Database.saveDone();
        }
    },
    // 根据失败原因判定自动重试上限：
    //  - 人机验证/适配类：重试无意义且会招更多风控 → 0 次，直接进失败列表
    //  - 环境类(超时/被远程判死/唤醒清理)：值得自动重试 → 3 次
    //  - 其他(可能只是页面没加载好)：给 1 次机会
    getMaxRetry: (reason) => {
        if (!reason) return 1;
        if (/人机验证|captcha|需要人工|verification/i.test(reason)) return 0;
        if (/超时|Watchdog|完成前关闭|closed before|Timeout|唤醒/i.test(reason)) return 3;
        return 1;
    },

    // 返回 { retried: bool }。retried=true 表示已按归因自动放回待办重试，未计入最终失败；
    // 调用方据此决定是否累加 executionFailedTasks。
    markAsFailed: async (task, failureInfo = {}) => {
        if (!task || !task.uid) {
            Utils.logger('error', '标记任务失败，收到无效任务:', JSON.stringify(task));
            return { retried: false };
        }

        const reason = failureInfo.reason || '未知原因';
        const nextRetry = (task.retryCount || 0) + 1;
        const maxRetry = Database.getMaxRetry(reason);

        // 先从待办移除当前任务实例
        State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);

        // 环境型失败且未超重试上限 → 放回待办自动重试，不计入失败
        if (nextRetry <= maxRetry) {
            State.db.todo.push({ ...task, retryCount: nextRetry });
            Utils.logger('info', Utils.getText('log_auto_retry', nextRetry, maxRetry, task.name) + ` [${reason}]`);
            await Database.saveTodo();
            if (UI) UI.update();
            return { retried: true };
        }

        // 否则记为最终失败
        const failedTask = {
            ...task,
            failedAt: new Date().toISOString(),
            failureReason: reason,
            errorDetails: failureInfo.details || null,
            workerLogs: failureInfo.logs || [],
            retryCount: nextRetry
        };

        // 记录详细的失败日志
        Utils.logger('warn', `📋 任务失败详情:`);
        Utils.logger('warn', `   - 任务名称: ${task.name}`);
        Utils.logger('warn', `   - 任务UID: ${task.uid}`);
        Utils.logger('warn', `   - 失败原因: ${failedTask.failureReason}`);
        Utils.logger('warn', `   - 重试次数: ${failedTask.retryCount}`);
        if (failedTask.errorDetails) {
            Utils.logger('warn', `   - 错误详情: ${JSON.stringify(failedTask.errorDetails)}`);
        }
        if (failedTask.workerLogs && failedTask.workerLogs.length > 0) {
            Utils.logger('warn', `   - 工作线程日志 (${failedTask.workerLogs.length} 条):`);
            failedTask.workerLogs.slice(-5).forEach((log, i) => {
                Utils.logger('warn', `     ${i + 1}. ${log}`);
            });
        }

        // Add to failed, ensuring no duplicates by UID (update if exists)
        const existingIndex = State.db.failed.findIndex(f => f.uid === task.uid);
        if (existingIndex >= 0) {
            // 更新现有记录
            State.db.failed[existingIndex] = failedTask;
            Utils.logger('debug', `更新了已存在的失败记录: ${task.name}`);
        } else {
            State.db.failed.push(failedTask);
        }

        await Database.saveTodo();
        await Database.saveFailed();
        return { retried: false };
    },
};
