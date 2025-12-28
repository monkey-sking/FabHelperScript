/**
 * Fab Helper - Database Module
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';

// Forward declaration for circular dependency
let UI = null;
export const setUIReference = (uiModule) => { UI = uiModule; };

export const Database = {
    load: async () => {
        // 从存储中加载待办列表
        State.db.todo = await GM_getValue(Config.DB_KEYS.TODO, []);
        State.db.done = await GM_getValue(Config.DB_KEYS.DONE, []);
        State.db.failed = await GM_getValue(Config.DB_KEYS.FAILED, []);
        State.hideSaved = await GM_getValue(Config.DB_KEYS.HIDE, false);
        State.autoAddOnScroll = await GM_getValue(Config.DB_KEYS.AUTO_ADD, false); // Load the setting
        State.rememberScrollPosition = await GM_getValue(Config.DB_KEYS.REMEMBER_POS, false);
        State.autoResumeAfter429 = await GM_getValue(Config.DB_KEYS.AUTO_RESUME, false);
        State.autoRefreshEmptyPage = await GM_getValue(Config.DB_KEYS.AUTO_REFRESH_EMPTY, true); // 加载无商品自动刷新设置
        State.debugMode = await GM_getValue('fab_helper_debug_mode', false); // 加载调试模式设置
        State.currentSortOption = await GM_getValue('fab_helper_sort_option', 'title_desc'); // 加载排序设置
        State.isExecuting = await GM_getValue(Config.DB_KEYS.IS_EXECUTING, false); // Load the execution state

        const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
        if (persistedStatus && persistedStatus.status === 'RATE_LIMITED') {
            State.appStatus = 'RATE_LIMITED';
            State.rateLimitStartTime = persistedStatus.startTime;
            // 添加空值检查，防止persistedStatus.startTime为null
            const previousDuration = persistedStatus && persistedStatus.startTime ?
                ((Date.now() - persistedStatus.startTime) / 1000).toFixed(2) : '0.00';
            Utils.logger('warn', `Script starting in RATE_LIMITED state. 429 period has lasted at least ${previousDuration}s.`);
        }
        State.statusHistory = await GM_getValue(Config.DB_KEYS.STATUS_HISTORY, []);

        Utils.logger('info', Utils.getText('log_db_loaded'), `(Session) To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
    },
    // 添加保存待办列表的方法
    saveTodo: () => GM_setValue(Config.DB_KEYS.TODO, State.db.todo),
    saveDone: () => GM_setValue(Config.DB_KEYS.DONE, State.db.done),
    saveFailed: () => GM_setValue(Config.DB_KEYS.FAILED, State.db.failed),
    saveHidePref: () => GM_setValue(Config.DB_KEYS.HIDE, State.hideSaved),
    saveAutoAddPref: () => GM_setValue(Config.DB_KEYS.AUTO_ADD, State.autoAddOnScroll), // Save the setting
    saveRememberPosPref: () => GM_setValue(Config.DB_KEYS.REMEMBER_POS, State.rememberScrollPosition),
    saveAutoResumePref: () => GM_setValue(Config.DB_KEYS.AUTO_RESUME, State.autoResumeAfter429),
    saveAutoRefreshEmptyPref: () => GM_setValue(Config.DB_KEYS.AUTO_REFRESH_EMPTY, State.autoRefreshEmptyPage), // 保存无商品自动刷新设置
    saveExecutingState: () => GM_setValue(Config.DB_KEYS.IS_EXECUTING, State.isExecuting), // Save the execution state

    resetAllData: async () => {
        if (window.confirm(Utils.getText('confirm_clear_data'))) {
            // 清除待办列表
            await GM_deleteValue(Config.DB_KEYS.TODO);
            await GM_deleteValue(Config.DB_KEYS.DONE);
            await GM_deleteValue(Config.DB_KEYS.FAILED);
            State.db.todo = [];
            State.db.done = [];
            State.db.failed = [];
            Utils.logger('info', '所有脚本数据已重置。');
            if (UI) {
                UI.removeAllOverlays();
                UI.update();
            }
        }
    },

    isDone: (url) => {
        if (!url) return false;
        return State.db.done.includes(url.split('?')[0]);
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

        // The 'done' list can still use URLs for simplicity, as it's for display/hiding.
        const cleanUrl = task.url.split('?')[0];
        if (!Database.isDone(cleanUrl)) {
            State.db.done.push(cleanUrl);
            changed = true;
        }

        if (changed) {
            await Database.saveDone();
        }
    },
    markAsFailed: async (task, failureInfo = {}) => {
        if (!task || !task.uid) {
            Utils.logger('error', '标记任务失败，收到无效任务:', JSON.stringify(task));
            return;
        }

        // Remove from todo
        const initialTodoCount = State.db.todo.length;
        State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
        let changed = State.db.todo.length < initialTodoCount;

        // 构建包含详细失败信息的任务对象
        const failedTask = {
            ...task,
            failedAt: new Date().toISOString(),
            failureReason: failureInfo.reason || '未知原因',
            errorDetails: failureInfo.details || null,
            workerLogs: failureInfo.logs || [],
            retryCount: (task.retryCount || 0) + 1
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
        changed = true;

        if (changed) {
            await Database.saveTodo();
            await Database.saveFailed();
        }
    },
};
