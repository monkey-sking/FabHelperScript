/**
 * Fab Helper - Main Entry Point
 * 
 * This is the main entry file that imports all modules and initializes the script.
 * Build with: npm run build
 */

// Core modules
import { Config } from './config.js';
import { State } from './state.js';

// Feature modules
import { Utils, setUIReference as setUtilsUIRef } from './modules/utils.js';
import { PageDiagnostics } from './modules/page-diagnostics.js';
import { DataCache } from './modules/data-cache.js';
import { API } from './modules/api.js';
import { Database, setUIReference as setDbUIRef } from './modules/database.js';
import { RateLimitManager, setDependencies as setRateLimitDeps } from './modules/rate-limit-manager.js';
import { PagePatcher, setUIReference as setPatcherUIRef } from './modules/page-patcher.js';
import { TaskRunner, setUIReference as setTaskRunnerUIRef } from './modules/task-runner.js';
import { UI } from './modules/ui.js';
import { InstanceManager } from './modules/instance-manager.js';

// Helper function for countdown refresh
function countdownRefresh(delayMs, source) {
    if (State.isRefreshScheduled) {
        Utils.logger('info', Utils.getText('refresh_plan_exists'));
        return;
    }

    State.isRefreshScheduled = true;
    const seconds = Math.ceil(delayMs / 1000);

    Utils.logger('info', Utils.getText('auto_refresh_countdown', seconds));

    setTimeout(() => {
        // Final check before refresh
        const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;
        const hiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`).length;
        const visibleCards = totalCards - hiddenCards;

        if (visibleCards > 0) {
            Utils.logger('info', Utils.getText('refresh_cancelled_visible_items', visibleCards));
            State.isRefreshScheduled = false;
            return;
        }

        Utils.logger('info', `Refreshing page (source: ${source})...`);
        window.location.reload();
    }, delayMs);
}

// Set up circular dependencies
setUtilsUIRef(UI);
setDbUIRef(UI);
setPatcherUIRef(UI);
setTaskRunnerUIRef(UI);
setRateLimitDeps({
    UI,
    TaskRunner,
    countdownRefresh
});

// Main initialization function
async function main() {
    // Record page load time
    window.pageLoadTime = Date.now();

    Utils.logger('info', Utils.getText('log_script_starting'));
    Utils.detectLanguage();

    // Check authentication
    if (!Utils.checkAuthentication()) {
        Utils.logger('error', '账号未登录，脚本停止执行');
        return;
    }

    // Check if this is a worker tab
    const urlParams = new URLSearchParams(window.location.search);
    const workerId = urlParams.get('workerId');
    if (workerId) {
        // Worker tab logic
        State.isWorkerTab = true;
        State.workerTaskId = workerId;

        await InstanceManager.init();
        Utils.logger('info', `工作标签页初始化完成，开始处理任务...`);
        await TaskRunner.processDetailPage();
        return;
    }

    // Initialize instance management
    await InstanceManager.init();

    // Main page continues execution
    await Database.load();

    // Ensure execution state matches storage
    const storedExecutingState = await GM_getValue(Config.DB_KEYS.IS_EXECUTING, false);
    if (State.isExecuting !== storedExecutingState) {
        Utils.logger('info', Utils.getText('log_execution_state_inconsistent', storedExecutingState ? '执行中' : '已停止'));
        State.isExecuting = storedExecutingState;
    }

    // Restore rate limit state from storage
    const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
    if (persistedStatus && persistedStatus.status === 'RATE_LIMITED') {
        State.appStatus = 'RATE_LIMITED';
        State.rateLimitStartTime = persistedStatus.startTime;
        const previousDuration = persistedStatus && persistedStatus.startTime ?
            ((Date.now() - persistedStatus.startTime) / 1000).toFixed(2) : '0.00';
        Utils.logger('warn', Utils.getText('startup_rate_limited', previousDuration, persistedStatus.source || Utils.getText('status_unknown_source')));
    }

    // Initialize page patcher (network interceptors)
    await PagePatcher.init();

    // Initialize UI
    UI.init();
    UI.update();

    Utils.logger('info', Utils.getText('log_init'));
}

// Run main function when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
