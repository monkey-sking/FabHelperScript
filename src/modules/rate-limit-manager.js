/**
 * Fab Helper - Rate Limit Manager
 */
import { Config } from '../config.js';
import { State } from '../state.js';
import { Utils } from './utils.js';
import { Database } from './database.js';

// Forward declarations for circular dependencies
let UI = null;
let TaskRunner = null;
let countdownRefresh = null;

export const setDependencies = (deps) => {
    UI = deps.UI;
    TaskRunner = deps.TaskRunner;
    countdownRefresh = deps.countdownRefresh;
};

export const RateLimitManager = {
    // 添加防止重复日志的变量
    _lastLogTime: 0,
    _lastLogType: null,
    _duplicateLogCount: 0,

    // 检查是否与最后一条记录重复
    isDuplicateRecord: function (newEntry) {
        if (State.statusHistory.length === 0) return false;

        const lastEntry = State.statusHistory[State.statusHistory.length - 1];

        // 检查类型是否相同
        if (lastEntry.type !== newEntry.type) return false;

        // 检查时间是否过于接近（10秒内）
        const lastTime = new Date(lastEntry.endTime).getTime();
        const newTime = new Date(newEntry.endTime).getTime();
        const timeDiff = Math.abs(newTime - lastTime);

        if (timeDiff < 10000) { // 10秒内
            // 如果是相同类型且时间很接近，检查持续时间是否相似
            const durationDiff = Math.abs((lastEntry.duration || 0) - (newEntry.duration || 0));
            if (durationDiff < 5) { // 持续时间差异小于5秒
                return true;
            }
        }

        return false;
    },

    // 添加记录到历史，带去重检查
    addToHistory: async function (entry) {
        // 检查是否重复
        if (this.isDuplicateRecord(entry)) {
            Utils.logger('debug', `检测到重复的状态记录，跳过: ${entry.type} - ${entry.endTime}`);
            return false;
        }

        // 添加到历史记录
        State.statusHistory.push(entry);

        // 限制历史记录数量，保留最近50条
        if (State.statusHistory.length > 50) {
            State.statusHistory = State.statusHistory.slice(-50);
        }

        // 保存到存储
        await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
        return true;
    },

    // 进入限速状态
    enterRateLimitedState: async function (source = '未知来源') {
        // 如果已经处于限速状态，不需要重复处理
        if (State.appStatus === 'RATE_LIMITED') {
            Utils.logger('info', Utils.getText('rate_limit_already_active', State.lastLimitSource, source));
            return false;
        }

        // 重置连续成功计数
        State.consecutiveSuccessCount = 0;
        State.lastLimitSource = source;

        // 记录正常运行期的统计信息
        const normalDuration = State.normalStartTime ? ((Date.now() - State.normalStartTime) / 1000).toFixed(2) : '0.00';

        // 创建正常运行期的记录
        const logEntry = {
            type: 'NORMAL',
            duration: parseFloat(normalDuration),
            requests: State.successfulSearchCount,
            endTime: new Date().toISOString()
        };

        // 使用新的去重方法添加到历史记录
        const wasAdded = await this.addToHistory(logEntry);

        if (wasAdded) {
            Utils.logger('error', Utils.getText('log_entering_rate_limit_from_v2', source, normalDuration, State.successfulSearchCount));
        } else {
            Utils.logger('debug', Utils.getText('duplicate_normal_status_detected', source));
        }

        // 切换到限速状态
        State.appStatus = 'RATE_LIMITED';
        State.rateLimitStartTime = Date.now();

        // 保存状态到存储
        await GM_setValue(Config.DB_KEYS.APP_STATUS, {
            status: 'RATE_LIMITED',
            startTime: State.rateLimitStartTime,
            source: source
        });

        // 更新UI
        if (UI) {
            UI.updateDebugTab();
            UI.update();
        }

        // 重新计算实际可见的商品数量，确保与DOM状态同步
        const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;
        const hiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`).length;
        const actualVisibleCards = totalCards - hiddenCards;

        // 更新UI显示的可见商品数量，确保UI与实际DOM状态一致
        const visibleCountElement = document.getElementById('fab-status-visible');
        if (visibleCountElement) {
            visibleCountElement.textContent = actualVisibleCards.toString();
        }

        // 更新全局状态
        State.hiddenThisPageCount = hiddenCards;

        // 检查是否有待办任务、活动工作线程，或者可见的商品数量不为0
        if (State.db.todo.length > 0 || State.activeWorkers > 0 || actualVisibleCards > 0) {
            if (actualVisibleCards > 0) {
                Utils.logger('info', `检测到页面上有 ${actualVisibleCards} 个可见商品，暂不自动刷新页面。`);
                Utils.logger('info', '当仍有可见商品时不触发自动刷新，以避免中断浏览。');
            } else {
                Utils.logger('info', `检测到有 ${State.db.todo.length} 个待办任务和 ${State.activeWorkers} 个活动工作线程，暂不自动刷新页面。`);
                Utils.logger('info', '请手动完成或取消这些任务后再刷新页面。');
            }

            // 显示明显提示
            Utils.logger('warn', '⚠️ 处于限速状态，但不满足自动刷新条件，请在需要时手动刷新页面。');
        } else if (State.autoRefreshEmptyPage) {
            // 只有在开启了自动刷新功能时才触发刷新
            // 429 Rate Limit Recovery: Wait 45-60 seconds to clear the rate limit window.
            const randomDelay = 45000 + Math.random() * 15000;
            if (State.autoResumeAfter429) {
                Utils.logger('info', Utils.getText('log_auto_resume_start', randomDelay ? (randomDelay / 1000).toFixed(1) : '未知'));
            } else {
                Utils.logger('info', Utils.getText('log_auto_resume_detect', randomDelay ? (randomDelay / 1000).toFixed(1) : '未知'));
            }
            if (countdownRefresh) {
                countdownRefresh(randomDelay, '429自动恢复');
            }
        } else {
            // 自动刷新功能已关闭
            Utils.logger('info', Utils.getText('auto_refresh_disabled_rate_limit'));
        }

        return true;
    },

    // 记录成功请求
    recordSuccessfulRequest: async function (source = '未知来源', hasResults = true) {
        // 无论在什么状态下，总是增加成功请求计数
        if (hasResults) {
            State.successfulSearchCount++;
            if (UI) UI.updateDebugTab();
        }

        // 只有在限速状态下才需要记录连续成功
        if (State.appStatus !== 'RATE_LIMITED') {
            return;
        }

        // --- PENALTY BOX LOGIC (强制冷静期) ---
        // If we are in RATE_LIMITED state, we MUST wait for at least 40 seconds.
        // During this time, any "success" is likely a fluke or cached response.
        // We ignore it to prevent premature exit triggering another 429 immediately.
        if (State.rateLimitStartTime) {
            const timeSinceRateLimit = Date.now() - State.rateLimitStartTime;
            if (timeSinceRateLimit < 40000) { // 40 seconds mandatory wait
                Utils.logger('debug', `处于限速强制冷静期 (${(timeSinceRateLimit / 1000).toFixed(1)}s < 40s)，忽略此次成功请求。`);
                return;
            }
        }


        // 如果请求没有返回有效结果，不计入连续成功
        if (!hasResults) {
            Utils.logger('debug', `请求成功但没有返回有效结果，不计入连续成功计数。来源: ${source}`);
            State.consecutiveSuccessCount = 0;
            return;
        }

        // 增加连续成功计数
        State.consecutiveSuccessCount++;

        // 每 3 次成功或者即将达到目标时记录一次 info 日志，平时记录 debug
        const isMilestone = State.consecutiveSuccessCount % 3 === 0 ||
            State.consecutiveSuccessCount >= State.requiredSuccessCount;

        const logMsg = Utils.getText('rate_limit_success_request', State.consecutiveSuccessCount, State.requiredSuccessCount, source);
        Utils.logger(isMilestone ? 'info' : 'debug', logMsg);

        // 如果达到所需的连续成功数，退出限速状态
        if (State.consecutiveSuccessCount >= State.requiredSuccessCount) {
            await this.exitRateLimitedState(Utils.getText('consecutive_success_exit', State.consecutiveSuccessCount, source));
        }
    },

    // 退出限速状态
    exitRateLimitedState: async function (source = '未知来源') {
        // 如果当前不是限速状态，不需要处理
        if (State.appStatus !== 'RATE_LIMITED') {
            Utils.logger('info', `当前不是限速状态，忽略退出限速请求: ${source}`);
            return false;
        }

        // 记录限速期的统计信息
        const rateLimitDuration = State.rateLimitStartTime ? ((Date.now() - State.rateLimitStartTime) / 1000).toFixed(2) : '0.00';

        // 创建限速期的记录
        const logEntry = {
            type: 'RATE_LIMITED',
            duration: parseFloat(rateLimitDuration),
            endTime: new Date().toISOString(),
            source: source
        };

        // 使用新的去重方法添加到历史记录
        const wasAdded = await this.addToHistory(logEntry);

        if (wasAdded) {
            Utils.logger('info', Utils.getText('rate_limit_recovery_success', source, rateLimitDuration));
        } else {
            Utils.logger('debug', `检测到重复的限速状态记录，来源: ${source}`);
        }

        // 恢复到正常状态
        State.appStatus = 'NORMAL';
        State.rateLimitStartTime = null;
        State.normalStartTime = Date.now();
        State.consecutiveSuccessCount = 0;

        // 删除存储的限速状态
        await GM_deleteValue(Config.DB_KEYS.APP_STATUS);

        // 更新UI
        if (UI) {
            UI.updateDebugTab();
            UI.update();
        }

        // 如果有待办任务，继续执行
        if (State.db.todo.length > 0 && !State.isExecuting && TaskRunner) {
            Utils.logger('info', `发现 ${State.db.todo.length} 个待办任务，自动恢复执行...`);
            State.isExecuting = true;
            Database.saveExecutingState();
            TaskRunner.executeBatch();
        }

        return true;
    },

    // 检查限速状态
    checkRateLimitStatus: async function () {
        // 如果已经在检查中，避免重复检查
        if (State.isCheckingRateLimit) {
            Utils.logger('info', '已有限速状态检查正在进行，跳过本次检查');
            return false;
        }

        State.isCheckingRateLimit = true;

        try {
            Utils.logger('debug', Utils.getText('log_rate_limit_check_start'));

            // 首先检查页面内容是否包含限速信息
            const pageText = document.body.innerText || '';
            if (pageText.includes('Too many requests') ||
                pageText.includes('rate limit') ||
                pageText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {

                Utils.logger('warn', '页面内容包含限速信息，确认仍处于限速状态');
                await this.enterRateLimitedState('页面内容检测');
                return false;
            }

            // 使用Performance API检查最近的网络请求
            Utils.logger('debug', '使用Performance API检查最近的网络请求，不再主动发送API请求');

            if (window.performance && window.performance.getEntriesByType) {
                const recentRequests = window.performance.getEntriesByType('resource')
                    .filter(r => r.name.includes('/i/listings/search') || r.name.includes('/i/users/me/listings-states'))
                    .filter(r => Date.now() - r.startTime < 10000); // 最近10秒内的请求

                // 如果有最近的请求，检查它们的状态
                if (recentRequests.length > 0) {
                    // 检查是否有429状态码的请求
                    const has429 = recentRequests.some(r => r.responseStatus === 429);
                    if (has429) {
                        Utils.logger('info', `检测到最近10秒内有429状态码的请求，判断为限速状态`);
                        await this.enterRateLimitedState('Performance API检测429');
                        return false;
                    }

                    // 检查是否有成功的请求
                    const hasSuccess = recentRequests.some(r => r.responseStatus >= 200 && r.responseStatus < 300);
                    if (hasSuccess) {
                        Utils.logger('info', `检测到最近10秒内有成功的API请求，判断为正常状态`);
                        await this.recordSuccessfulRequest('Performance API检测成功', true);
                        return true;
                    }
                }
            }

            // 如果没有足够的信息判断，保持当前状态
            Utils.logger('debug', Utils.getText('log_insufficient_info_status'));
            return State.appStatus === 'NORMAL';
        } catch (e) {
            Utils.logger('error', `限速状态检查失败: ${e.message}`);
            return false;
        } finally {
            State.isCheckingRateLimit = false;
        }
    }
};
