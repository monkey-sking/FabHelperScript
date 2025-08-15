// ==UserScript==
// @name         Fab Helper (优化版)
// @name:zh-CN   Fab Helper (优化版)
// @name:en      Fab Helper (Optimized)
// @namespace    https://www.fab.com/
// @version      3.3.0-20250815160009
// @description  Fab Helper 优化版 - 减少API请求，提高性能，增强稳定性，修复限速刷新
// @description:zh-CN  Fab Helper 优化版 - 减少API请求，提高性能，增强稳定性，修复限速刷新
// @description:en  Fab Helper Optimized - Reduced API requests, improved performance, enhanced stability, fixed rate limit refresh
// @author       RunKing
// @match        https://www.fab.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=fab.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @connect      fab.com
// @connect      www.fab.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- 模块一: 配置与常量 ---
    const Config = {
        SCRIPT_NAME: 'Fab Helper (优化版)',
        DB_VERSION: 3,
        DB_NAME: 'fab_helper_db',
        MAX_WORKERS: 5, // Maximum number of concurrent worker tabs
        MAX_CONCURRENT_WORKERS: 7, // 最大并发工作标签页数量
        WORKER_TIMEOUT: 30000, // 工作标签页超时时间
        UI_CONTAINER_ID: 'fab-helper-container',
        UI_LOG_ID: 'fab-helper-log',
        DB_KEYS: {
            DONE: 'fab_done_v8',
            FAILED: 'fab_failed_v8',
            TODO: 'fab_todo_v1', // 用于永久存储待办列表
            HIDE: 'fab_hide_v8',
            AUTO_ADD: 'fab_autoAdd_v8', // 自动添加设置键
            REMEMBER_POS: 'fab_rememberPos_v8',
            LAST_CURSOR: 'fab_lastCursor_v8', // Store only the cursor string
            WORKER_DONE: 'fab_worker_done_v8', // This is the ONLY key workers use to report back.
            APP_STATUS: 'fab_app_status_v1', // For tracking 429 rate limiting
            STATUS_HISTORY: 'fab_status_history_v1', // 状态历史记录持久化
            AUTO_RESUME: 'fab_auto_resume_v1', // 自动恢复功能设置
            IS_EXECUTING: 'fab_is_executing_v1', // 执行状态保存
            AUTO_REFRESH_EMPTY: 'fab_auto_refresh_empty_v1', // 无商品可见时自动刷新
            // 其他键值用于会话或主标签页持久化
        },
        SELECTORS: {
            card: 'div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root',
            cardLink: 'a[href*="/listings/"]',
            addButton: 'button[aria-label*="Add to"], button[aria-label*="添加至"], button[aria-label*="cart"]',
            rootElement: '#root',
            successBanner: 'div[class*="Toast-root"]',
            freeStatus: '.csZFzinF',
            ownedStatus: '.cUUvxo_s'
        },
        TEXTS: {
            en: {
                // 基础UI
                hide: 'Hide Done', show: 'Show Done', sync: 'Sync State', execute: 'Start Tasks', executing: 'Executing...', stopExecute: 'Stop',
                added: 'Done', failed: 'Failed', todo: 'To-Do', hidden: 'Hidden', visible: 'Visible',
                clearLog: 'Clear Log', copyLog: 'Copy Log', copied: 'Copied!',
                tab_dashboard: 'Dashboard', tab_settings: 'Settings', tab_debug: 'Debug',

                // 应用标题和标签
                app_title: 'Fab Helper',
                free_label: 'Free',
                operation_log: '📝 Operation Log',
                position_indicator: '📍 ',

                // 按钮文本
                clear_all_data: '🗑️ Clear All Data',
                debug_mode: 'Debug Mode',
                page_diagnosis: 'Page Diagnosis',
                copy_btn: 'Copy',
                clear_btn: 'Clear',
                copied_success: 'Copied!',

                // 状态文本
                status_history: 'Status Cycle History',
                script_startup: 'Script Startup',
                normal_period: 'Normal Operation',
                rate_limited_period: 'Rate Limited',
                current_normal: 'Current: Normal',
                current_rate_limited: 'Current: Rate Limited',
                no_history: 'No history records to display.',
                no_saved_position: 'No saved position',

                // 状态历史详细信息
                time_label: 'Time',
                info_label: 'Info',
                ended_at: 'Ended at',
                duration_label: 'Duration',
                requests_label: 'Requests',
                requests_unit: 'times',
                unknown_duration: 'Unknown',

                // 日志消息
                log_init: 'Assistant is online!',
                log_db_loaded: 'Reading archive...',
                log_exec_no_tasks: 'To-Do list is empty.',
                log_verify_success: 'Verified and added to library!',
                log_verify_fail: "Couldn't add. Will retry later.",
                log_429_error: 'Request limit hit! Taking a 15s break...',
                log_recon_reset: 'Recon progress has been reset. Next scan will start from the beginning.',
                log_recon_active: 'Cannot reset progress while recon is active.',
                log_no_failed_tasks: 'No failed tasks to retry.',
                log_requeuing_tasks: 'Re-queuing {0} failed tasks...',
                log_detail_page: 'This is a detail or worker page. Halting main script execution.',
                log_copy_failed: 'Failed to copy log:',
                log_auto_add_enabled: '"Auto add" is enabled. Will process all tasks in the current "To-Do" queue.',
                log_auto_add_toggle: 'Infinite scroll auto add tasks {0}.',
                log_remember_pos_toggle: 'Remember waterfall browsing position {0}.',
                log_auto_resume_toggle: '429 auto resume function {0}.',
                log_auto_resume_start: '🔄 429 auto resume activated! Will refresh page in {0} seconds to attempt recovery...',
                log_auto_resume_detect: '🔄 Detected 429 error, will auto refresh page in {0} seconds to attempt recovery...',

                // 调试日志消息
                debug_save_cursor: 'Saving new recovery point: {0}',
                debug_prepare_hide: 'Preparing to hide {0} cards, will use longer delay...',
                debug_unprocessed_cards: 'Detected {0} unprocessed or inconsistent cards, re-executing hide logic',
                debug_new_content_loading: 'Detected new content loading, waiting for API requests to complete...',
                debug_process_new_content: 'Starting to process newly loaded content...',
                debug_unprocessed_cards_simple: 'Detected unprocessed cards, re-executing hide logic',
                debug_hide_completed: 'Completed hiding all {0} cards',
                debug_visible_after_hide: '👁️ Actual visible items after hiding: {0}, hidden items: {1}',
                debug_filter_owned: 'Filtered out {0} owned items and {1} items already in todo list.',
                debug_api_wait_complete: 'API wait completed, starting to process {0} cards...',
                debug_api_stopped: 'API activity stopped for {0}ms, continuing to process cards.',
                debug_wait_api_response: 'Starting to wait for API response, will process {0} cards after API activity stops...',
                debug_api_wait_in_progress: 'API wait process already in progress, adding current {0} cards to wait queue.',
                debug_cached_items: 'Cached {0} item data',
                debug_no_cards_to_check: 'No cards need to be checked',

                // Fab DOM Refresh 相关
                fab_dom_api_complete: 'API query completed, confirmed {0} owned items.',
                fab_dom_checking_status: 'Checking status of {0} items...',
                fab_dom_add_to_waitlist: 'Added {0} item IDs to wait list, current wait list size: {0}',
                fab_dom_unknown_status: '{0} items have unknown status, waiting for native web requests to update',

                // 状态监控
                status_monitor_all_hidden: 'Detected all items hidden in normal state ({0} items)',

                // 空搜索结果
                empty_search_initial: 'Page just loaded, might be initial request, not triggering rate limit',

                // 游标相关
                cursor_patched_url: 'Patched URL',
                cursor_injecting: 'Injecting cursor. Original',
                page_patcher_match: '-> ✅ MATCH! URL will be patched',

                // 自动刷新相关
                auto_refresh_countdown: '⏱️ Auto refresh countdown: {0} seconds...',
                rate_limit_success_request: 'Successful request during rate limit +1, current consecutive: {0}/{1}, source: {2}',
                rate_limit_no_visible_continue: '🔄 No visible items on page and in rate limit state, will continue auto refresh.',
                rate_limit_no_visible_suggest: '🔄 In rate limit state with no visible items, suggest refreshing page',
                status_check_summary: '📊 Status check - Actually visible: {0}, Total cards: {1}, Hidden items: {2}',
                refresh_plan_exists: 'Refresh plan already in progress, not scheduling new refresh (429 auto recovery)',
                page_content_rate_limit_detected: '[Page Content Detection] Detected page showing rate limit error message!',
                last_moment_check_cancelled: '⚠️ Last moment check: refresh conditions not met, auto refresh cancelled.',
                refresh_cancelled_visible_items: '⏹️ Detected {0} visible items on page before refresh, auto refresh cancelled.',

                // 限速检测来源
                rate_limit_source_page_content: 'Page Content Detection',
                rate_limit_source_global_call: 'Global Call',

                // 设置项
                setting_auto_refresh: 'Auto refresh when no items visible',
                setting_auto_add_scroll: 'Auto add tasks on infinite scroll',
                setting_remember_position: 'Remember waterfall browsing position',
                setting_auto_resume_429: 'Auto resume after 429 errors',
                setting_debug_tooltip: 'Enable detailed logging for troubleshooting',

                // 状态文本
                status_enabled: 'enabled',
                status_disabled: 'disabled',

                // 确认对话框
                confirm_clear_data: 'Are you sure you want to clear all locally stored script data (completed, failed, to-do lists)? This action cannot be undone!',
                confirm_open_failed: 'Are you sure you want to open {0} failed items in new tabs?',
                confirm_clear_history: 'Are you sure you want to clear all status history records?',

                // 错误提示
                error_api_refresh: 'API refresh failed. Please check console for error details and confirm you are logged in.',

                // 工具提示
                tooltip_open_failed: 'Click to open all failed items',
                tooltip_executing_progress: 'Executing: {0}/{1} ({2}%)',
                tooltip_executing: 'Executing',
                tooltip_start_tasks: 'Click to start executing tasks',

                // 其他
                goto_page_label: 'Page:',
                goto_page_btn: 'Go',
                page_reset: 'Page: 1',
                untitled: 'Untitled',
                cursor_mode: 'Cursor Mode',
                using_native_requests: 'Using native web requests, waiting: {0}',
                worker_closed: 'Worker tab closed before completion'
            },
            zh: {
                // 基础UI
                hide: '隐藏已得', show: '显示已得', sync: '同步状态', execute: '一键开刷', executing: '执行中...', stopExecute: '停止',
                added: '已入库', failed: '失败', todo: '待办', hidden: '已隐藏', visible: '可见',
                clearLog: '清空日志', copyLog: '复制日志', copied: '已复制!',
                tab_dashboard: '仪表盘', tab_settings: '设定', tab_debug: '调试',

                // 应用标题和标签
                app_title: 'Fab Helper',
                free_label: '免费',
                operation_log: '📝 操作日志',
                position_indicator: '📍 ',

                // 按钮文本
                clear_all_data: '🗑️ 清空所有存档',
                debug_mode: '调试模式',
                page_diagnosis: '页面诊断',
                copy_btn: '复制',
                clear_btn: '清空',
                copied_success: '已复制!',

                // 状态文本
                status_history: '状态周期历史记录',
                script_startup: '脚本启动',
                normal_period: '正常运行期',
                rate_limited_period: '限速期',
                current_normal: '当前: 正常运行',
                current_rate_limited: '当前: 限速中',
                no_history: '没有可显示的历史记录。',
                no_saved_position: '无保存位置',

                // 状态历史详细信息
                time_label: '时间',
                info_label: '信息',
                ended_at: '结束于',
                duration_label: '持续',
                requests_label: '请求',
                requests_unit: '次',
                unknown_duration: '未知',

                // 日志消息
                log_init: '助手已上线！',
                log_db_loaded: '正在读取存档...',
                log_exec_no_tasks: '"待办"清单是空的。',
                log_verify_success: '搞定！已成功入库。',
                log_verify_fail: '哎呀，这个没加上。稍后会自动重试！',
                log_429_error: '请求太快被服务器限速了！休息15秒后自动重试...',
                log_recon_reset: '重置进度已完成。下次扫描将从头开始。',
                log_recon_active: '扫描正在进行中，无法重置进度。',
                log_no_failed_tasks: '没有失败的任务需要重试。',
                log_requeuing_tasks: '正在重新排队 {0} 个失败任务...',
                log_detail_page: '这是详情页或工作标签页。停止主脚本执行。',
                log_copy_failed: '复制日志失败:',
                log_auto_add_enabled: '"自动添加"已开启。将直接处理当前"待办"队列中的所有任务。',
                log_auto_add_toggle: '无限滚动自动添加任务已{0}。',
                log_remember_pos_toggle: '记住瀑布流浏览位置功能已{0}。',
                log_auto_resume_toggle: '429后自动恢复功能已{0}。',
                log_auto_resume_start: '🔄 429自动恢复启动！将在{0}秒后刷新页面尝试恢复...',
                log_auto_resume_detect: '🔄 检测到429错误，将在{0}秒后自动刷新页面尝试恢复...',

                // 调试日志消息
                debug_save_cursor: '保存新的恢复点: {0}',
                debug_prepare_hide: '准备隐藏 {0} 张卡片，将使用更长的延迟...',
                debug_unprocessed_cards: '检测到 {0} 个未处理或状态不一致的卡片，重新执行隐藏逻辑',
                debug_new_content_loading: '检测到新内容加载，等待API请求完成...',
                debug_process_new_content: '开始处理新加载的内容...',
                debug_unprocessed_cards_simple: '检测到未处理的卡片，重新执行隐藏逻辑',
                debug_hide_completed: '已完成所有 {0} 张卡片的隐藏',
                debug_visible_after_hide: '👁️ 隐藏后实际可见商品数: {0}，隐藏商品数: {1}',
                debug_filter_owned: '过滤掉 {0} 个已入库商品和 {1} 个已在待办列表中的商品。',
                debug_api_wait_complete: 'API等待完成，开始处理 {0} 张卡片...',
                debug_api_stopped: 'API活动已停止 {0}ms，继续处理卡片。',
                debug_wait_api_response: '开始等待API响应，将在API活动停止后处理 {0} 张卡片...',
                debug_api_wait_in_progress: '已有API等待过程在进行，将当前 {0} 张卡片加入等待队列。',
                debug_cached_items: '已缓存 {0} 个商品数据',
                debug_no_cards_to_check: '没有需要检查的卡片',

                // Fab DOM Refresh 相关
                fab_dom_api_complete: 'API查询完成，共确认 {0} 个已拥有的项目。',
                fab_dom_checking_status: '正在检查 {0} 个项目的状态...',
                fab_dom_add_to_waitlist: '添加 {0} 个商品ID到等待列表，当前等待列表大小: {0}',
                fab_dom_unknown_status: '有 {0} 个商品状态未知，等待网页原生请求更新',

                // 状态监控
                status_monitor_all_hidden: '检测到正常状态下所有商品都被隐藏 ({0}个)',

                // 空搜索结果
                empty_search_initial: '页面刚刚加载，可能是初始请求，不触发限速',

                // 游标相关
                cursor_patched_url: 'Patched URL',
                cursor_injecting: 'Injecting cursor. Original',
                page_patcher_match: '-> ✅ MATCH! URL will be patched',

                // 自动刷新相关
                auto_refresh_countdown: '⏱️ 自动刷新倒计时: {0} 秒...',
                rate_limit_success_request: '限速状态下成功请求 +1，当前连续成功: {0}/{1}，来源: {2}',
                rate_limit_no_visible_continue: '🔄 页面上没有可见商品且处于限速状态，将继续自动刷新。',
                rate_limit_no_visible_suggest: '🔄 处于限速状态且没有可见商品，建议刷新页面',
                status_check_summary: '📊 状态检查 - 实际可见: {0}, 总卡片: {1}, 隐藏商品数: {2}',
                refresh_plan_exists: '已有刷新计划正在进行中，不再安排新的刷新 (429自动恢复)',
                page_content_rate_limit_detected: '[页面内容检测] 检测到页面显示限速错误信息！',
                last_moment_check_cancelled: '⚠️ 最后一刻检查：刷新条件不满足，自动刷新已取消。',
                refresh_cancelled_visible_items: '⏹️ 刷新前检测到页面上有 {0} 个可见商品，已取消自动刷新。',

                // 限速检测来源
                rate_limit_source_page_content: '页面内容检测',
                rate_limit_source_global_call: '全局调用',

                // 设置项
                setting_auto_refresh: '无商品可见时自动刷新',
                setting_auto_add_scroll: '无限滚动时自动添加任务',
                setting_remember_position: '记住瀑布流浏览位置',
                setting_auto_resume_429: '429后自动恢复并继续',
                setting_debug_tooltip: '启用详细日志记录，用于排查问题',

                // 状态文本
                status_enabled: '开启',
                status_disabled: '关闭',

                // 确认对话框
                confirm_clear_data: '您确定要清空所有本地存储的脚本数据（已完成、失败、待办列表）吗？此操作不可逆！',
                confirm_open_failed: '您确定要在新标签页中打开 {0} 个失败的项目吗？',
                confirm_clear_history: '您确定要清空所有状态历史记录吗？',

                // 错误提示
                error_api_refresh: 'API 刷新失败。请检查控制台中的错误信息，并确认您已登录。',

                // 工具提示
                tooltip_open_failed: '点击打开所有失败的项目',
                tooltip_executing_progress: '执行中: {0}/{1} ({2}%)',
                tooltip_executing: '执行中',
                tooltip_start_tasks: '点击开始执行任务',

                // 其他
                goto_page_label: '页码:',
                goto_page_btn: '跳转',
                page_reset: 'Page: 1',
                untitled: 'Untitled',
                cursor_mode: 'Cursor Mode',
                using_native_requests: '使用网页原生请求，等待中: {0}',
                worker_closed: '工作标签页在完成前关闭'
            }
        },
        // Centralized keyword sets, based STRICTLY on the rules in FAB_HELPER_RULES.md
        OWNED_SUCCESS_CRITERIA: {
            // Check for an H2 tag with the specific success text.
            h2Text: ['已保存在我的库中', 'Saved in My Library'],
            // Check for buttons/links with these texts.
            buttonTexts: ['在我的库中查看', 'View in My Library'],
            // Check for the temporary success popup (snackbar).
            snackbarText: ['产品已添加至您的库中', 'Product added to your library'],
        },
        ACQUISITION_TEXT_SET: new Set(['添加到我的库', 'Add to my library']),

        // Kept for backward compatibility with recon logic.
        SAVED_TEXT_SET: new Set(['已保存在我的库中', 'Saved in My Library', '在我的库中', 'In My Library']),
        FREE_TEXT_SET: new Set(['免费', 'Free', '起始价格 免费']),
        // 添加一个实例ID，用于防止多实例运行
        INSTANCE_ID: 'fab_instance_id_' + Math.random().toString(36).substring(2, 15),
    };

    // --- 模块二: 全局状态管理 ---
const State = {
    db: {
        todo: [],   // 待办任务列表
        done: [],   // 已完成任务列表
        failed: [], // 失败任务列表
    },
    hideSaved: false, // 是否隐藏已保存项目
    autoAddOnScroll: false, // 是否在滚动时自动添加任务
    rememberScrollPosition: false, // 是否记住滚动位置
    autoResumeAfter429: false, // 是否在429后自动恢复
    autoRefreshEmptyPage: true, // 新增：无商品可见时自动刷新（默认开启）
    debugMode: false, // 是否启用调试模式
    lang: 'zh', // 当前语言，默认中文，会在detectLanguage中更新
    isExecuting: false, // 是否正在执行任务
    isRefreshScheduled: false, // 新增：标记是否已经安排了页面刷新
        isWorkerTab: false, // 是否是工作标签页
        isReconning: false, // 是否正在进行API扫描
        lastReconUrl: '', // 最后一次API扫描的URL
        totalTasks: 0, // API扫描的总任务数
        completedTasks: 0, // API扫描的已完成任务数
        isDispatchingTasks: false, // 新增：标记是否正在派发任务
        savedCursor: null, // Holds the loaded cursor for hijacking
        // --- NEW: State for 429 monitoring ---
        appStatus: 'NORMAL', // 'NORMAL' or 'RATE_LIMITED'
        rateLimitStartTime: null,
        normalStartTime: Date.now(),
        successfulSearchCount: 0,
        statusHistory: [], // Holds the history of NORMAL/RATE_LIMITED periods
        autoResumeAfter429: false, // The new setting for the feature
        // --- 限速恢复相关状态 ---
        consecutiveSuccessCount: 0, // 连续成功请求计数
        requiredSuccessCount: 3, // 退出限速需要的连续成功请求数
        lastLimitSource: '', // 最后一次限速的来源
        isCheckingRateLimit: false, // 是否正在检查限速状态
        // --- End New State ---
        showAdvanced: false,
        activeWorkers: 0,
        runningWorkers: {}, // NEW: To track active workers for the watchdog { workerId: { task, startTime } }
        lastKnownHref: null, // To detect SPA navigation
        hiddenThisPageCount: 0,
        executionTotalTasks: 0, // For execution progress
        executionCompletedTasks: 0, // For execution progress
        executionFailedTasks: 0, // For execution progress
        watchdogTimer: null,
        // UI-related state
        UI: {
            container: null,
            logPanel: null,
            tabs: {}, // For tab buttons
            tabContents: {}, // For tab content panels
            progressContainer: null,
            progressText: null,
            progressBarFill: null,
            progressBar: null,
            statusTodo: null,
            statusDone: null,
            statusFailed: null,
            statusHidden: null,
            execBtn: null,
            hideBtn: null,
            syncBtn: null,
            statusVisible: null,
            debugContent: null,
            settingsVisible: false,
            historyVisible: false,
            historyTab: 'all',
            statusBarContainer: null,
            statusItems: {},
            savedPositionDisplay: null, // 新增：保存位置显示元素的引用
            // 排序选择器已移除
        },
        valueChangeListeners: [],
        sessionCompleted: new Set(), // Phase15: URLs completed this session
        isLogCollapsed: localStorage.getItem('fab_helper_log_collapsed') === 'true' || false, // 日志面板折叠状态
        hasRunDomPart: false,
        observerDebounceTimer: null,
        isObserverRunning: false, // New flag for the robust launcher
        lastKnownCardCount: 0,
        workerTaskId: null, // 新增：当前工作标签页的任务ID
        // 添加排序相关的状态
        sortOptions: {
            'relevance': { name: '相关度', value: '-relevance' },
            'rating': { name: '评分', value: '-rating' },
            'newest': { name: '最新', value: '-created_at' },
            'oldest': { name: '最旧', value: 'created_at' },
            'price_asc': { name: '价格 (从低到高)', value: 'price' },
            'price_desc': { name: '价格 (从高到低)', value: '-price' },
            'title_asc': { name: '标题 A-Z', value: 'title' },
            'title_desc': { name: '标题 Z-A', value: '-title' }
        },
        currentSortOption: 'title_desc', // 默认排序方式
    };

    // --- 模块三: 页面状态诊断工具 ---
    const PageDiagnostics = {
        // 诊断商品详情页面状态
        diagnoseDetailPage: () => {
            const report = {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                pageTitle: document.title,
                buttons: [],
                licenseOptions: [],
                priceInfo: {},
                ownedStatus: {},
                dynamicContent: {}
            };

            // 检测所有按钮
            const buttons = document.querySelectorAll('button');
            buttons.forEach((btn, index) => {
                const text = btn.textContent?.trim();
                const isVisible = btn.offsetParent !== null;
                const isDisabled = btn.disabled;
                const classes = btn.className;

                if (text) {
                    report.buttons.push({
                        index,
                        text,
                        isVisible,
                        isDisabled,
                        classes,
                        hasClickHandler: btn.onclick !== null
                    });
                }
            });

            // 检测许可选择相关元素
            const licenseElements = document.querySelectorAll('[class*="license"], [class*="License"], [role="option"]');
            licenseElements.forEach((elem, index) => {
                const text = elem.textContent?.trim();
                const isVisible = elem.offsetParent !== null;

                if (text) {
                    report.licenseOptions.push({
                        index,
                        text,
                        isVisible,
                        tagName: elem.tagName,
                        classes: elem.className,
                        role: elem.getAttribute('role')
                    });
                }
            });

            // 检测价格信息
            const priceElements = document.querySelectorAll('[class*="price"], [class*="Price"]');
            priceElements.forEach((elem, index) => {
                const text = elem.textContent?.trim();
                if (text) {
                    report.priceInfo[`price_${index}`] = {
                        text,
                        isVisible: elem.offsetParent !== null,
                        classes: elem.className
                    };
                }
            });

            // 检测拥有状态相关元素
            const ownedElements = document.querySelectorAll('h2, [class*="owned"], [class*="library"]');
            ownedElements.forEach((elem, index) => {
                const text = elem.textContent?.trim();
                if (text && (text.includes('库') || text.includes('Library') || text.includes('拥有') || text.includes('Owned'))) {
                    report.ownedStatus[`owned_${index}`] = {
                        text,
                        isVisible: elem.offsetParent !== null,
                        tagName: elem.tagName,
                        classes: elem.className
                    };
                }
            });

            return report;
        },

        // 输出诊断报告到日志
        logDiagnosticReport: (report) => {
            console.log('=== 页面状态诊断报告 ===');
            console.log(`页面: ${report.url}`);
            console.log(`标题: ${report.pageTitle}`);

            console.log(`--- 按钮信息 (${report.buttons.length}个) ---`);
            report.buttons.forEach(btn => {
                if (btn.isVisible) {
                    console.log(`按钮: "${btn.text}" (可见: ${btn.isVisible}, 禁用: ${btn.isDisabled})`);
                }
            });

            console.log(`--- 许可选项 (${report.licenseOptions.length}个) ---`);
            report.licenseOptions.forEach(opt => {
                if (opt.isVisible) {
                    console.log(`许可: "${opt.text}" (可见: ${opt.isVisible}, 角色: ${opt.role})`);
                }
            });

            console.log(`--- 价格信息 ---`);
            Object.entries(report.priceInfo).forEach(([, price]) => {
                if (price.isVisible) {
                    console.log(`价格: "${price.text}"`);
                }
            });

            console.log(`--- 拥有状态 ---`);
            Object.entries(report.ownedStatus).forEach(([, status]) => {
                if (status.isVisible) {
                    console.log(`状态: "${status.text}"`);
                }
            });

            console.log('=== 诊断报告结束 ===');
        }
    };

    // --- 模块四: 日志与工具函数 ---
    const Utils = {
        logger: (type, ...args) => {
            // 支持debug级别日志
            if (type === 'debug') {
                // 默认不在控制台显示debug级别日志，除非启用了调试模式
                if (State.debugMode) {
                    // 调试模式下在控制台输出日志，使用console.log而不是console.debug以确保可见性
                    console.log(`${Config.SCRIPT_NAME} [DEBUG]`, ...args);
                }
                // 无论是否调试模式，都记录到日志面板
                if (State.UI.logPanel) {
                    const logEntry = document.createElement('div');
                    logEntry.style.cssText = 'padding: 2px 4px; border-bottom: 1px solid #444; font-size: 11px; color: #888;';
                    const timestamp = new Date().toLocaleTimeString();
                    logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> <span style="color: #8a8;">[DEBUG]</span> ${args.join(' ')}`;
                    State.UI.logPanel.prepend(logEntry);
                    while (State.UI.logPanel.children.length > 100) {
                        State.UI.logPanel.removeChild(State.UI.logPanel.lastChild);
                    }
                }
                return;
            }

            // 在工作标签页中，只记录关键日志
            if (State.isWorkerTab) {
                if (type === 'error' || args.some(arg => typeof arg === 'string' && arg.includes('Worker'))) {
                    console[type](`${Config.SCRIPT_NAME} [Worker]`, ...args);
                }
                return;
            }

            console[type](`${Config.SCRIPT_NAME}`, ...args);
            // The actual logging to screen will be handled by the UI module
            // to keep modules decoupled.
            if (State.UI.logPanel) {
                const logEntry = document.createElement('div');
                logEntry.style.cssText = 'padding: 2px 4px; border-bottom: 1px solid #444; font-size: 11px;';
                const timestamp = new Date().toLocaleTimeString();
                logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${args.join(' ')}`;
                State.UI.logPanel.prepend(logEntry);
                while (State.UI.logPanel.children.length > 100) {
                    State.UI.logPanel.removeChild(State.UI.logPanel.lastChild);
                }
            }
        },
        getText: (key, ...args) => {
            let text = (Config.TEXTS[State.lang]?.[key]) || (Config.TEXTS['en']?.[key]) || key;

            // 支持两种格式的参数替换
            if (args.length > 0) {
                // 如果第一个参数是对象，使用 %placeholder% 格式
                if (typeof args[0] === 'object' && args[0] !== null) {
                    const replacements = args[0];
                    for (const placeholder in replacements) {
                        text = text.replace(`%${placeholder}%`, replacements[placeholder]);
                    }
                } else {
                    // 否则使用 {0}, {1}, {2} 格式
                    args.forEach((arg, index) => {
                        text = text.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
                    });
                }
            }

            return text;
        },
        detectLanguage: () => {
            const oldLang = State.lang;
            State.lang = window.location.href.includes('/zh-cn/') ? 'zh' : 'en';
            Utils.logger('info', `语言检测: 地址=${window.location.href}, 检测到语言=${State.lang}${oldLang !== State.lang ? ` (从${oldLang}切换)` : ''}`);

            // 如果语言发生了变化且UI已经创建，更新UI
            if (oldLang !== State.lang && State.UI.container) {
                Utils.logger('info', `语言已切换到${State.lang}，正在更新界面...`);
                UI.update();
            }
        },
        waitForElement: (selector, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    const element = document.querySelector(selector);
                    if (element) {
                        clearInterval(interval);
                        resolve(element);
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error(`Timeout waiting for selector: ${selector}`));
                }, timeout);
            });
        },
        waitForButtonEnabled: (button, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    if (button && !button.disabled) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error('Timeout waiting for button to be enabled.'));
                }, timeout);
            });
        },
        // This function is now for UI display purposes only.
        getDisplayPageFromUrl: (url) => {
            if (!url) return '1';
            try {
                const urlParams = new URLSearchParams(new URL(url).search);
                const cursor = urlParams.get('cursor');
                if (!cursor) return '1';

                // Try to decode offset-based cursors for a nice page number display.
                if (cursor.startsWith('bz')) {
                    const decoded = atob(cursor);
                    const offsetMatch = decoded.match(/o=(\d+)/);
                    if (offsetMatch && offsetMatch[1]) {
                        const offset = parseInt(offsetMatch[1], 10);
                        const pageSize = 24;
                        const pageNum = Math.round((offset / pageSize) + 1);
                        return pageNum.toString();
                    }
                }
                // For timestamp-based cursors, we can't calculate a page number.
                return 'Cursor Mode';
            } catch (e) {
                return '...';
            }
        },
        getCookie: (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        },
        // Simulates a more forceful click by dispatching mouse events, which can succeed
        // where a simple .click() is ignored by a framework's event handling.
        deepClick: (element) => {
            if (!element) return;
            // A small delay to ensure the browser's event loop is clear and any framework
            // event listeners on the element have had a chance to attach.
            setTimeout(() => {
            const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

            Utils.logger('info', `Performing deep click on element: <${element.tagName.toLowerCase()} class="${element.className}">`);

                // Add pointerdown for modern frameworks
                const pointerDownEvent = new PointerEvent('pointerdown', { view: pageWindow, bubbles: true, cancelable: true });
            const mouseDownEvent = new MouseEvent('mousedown', { view: pageWindow, bubbles: true, cancelable: true });
            const mouseUpEvent = new MouseEvent('mouseup', { view: pageWindow, bubbles: true, cancelable: true });

                element.dispatchEvent(pointerDownEvent);
            element.dispatchEvent(mouseDownEvent);
            element.dispatchEvent(mouseUpEvent);
            // Also trigger the standard click for maximum compatibility.
            element.click();
            }, 50); // 50ms delay
        },
        cleanup: () => {
            if (State.watchdogTimer) {
                clearInterval(State.watchdogTimer);
                State.watchdogTimer = null;
            }
            State.valueChangeListeners.forEach(id => {
                try {
                    GM_removeValueChangeListener(id);
                } catch (e) { /* Ignore errors */ }
            });
            State.valueChangeListeners = [];
        },
        // 添加游标解码函数
        decodeCursor: (cursor) => {
            if (!cursor) return '无保存位置';
            try {
                // Base64解码
                const decoded = atob(cursor);

                // 游标通常格式为: o=1&p=Item+Name 或 p=Item+Name
                // 主要提取p参数的值，通常包含项目名称
                let match;
                if (decoded.includes('&p=')) {
                    match = decoded.match(/&p=([^&]+)/);
                } else if (decoded.startsWith('p=')) {
                    match = decoded.match(/p=([^&]+)/);
                }

                if (match && match[1]) {
                    // 解码URI组件并替换+为空格
                    const itemName = decodeURIComponent(match[1].replace(/\+/g, ' '));
                    return `位置: "${itemName}"`;
                }

                return `位置: (已保存，但无法读取名称)`;
            } catch (e) {
                Utils.logger('error', `游标解码失败: ${e.message}`);
                return '位置: (格式无法解析)';
            }
        },
    };

    // --- DOM Creation Helpers (moved outside for broader scope) ---
    // 移除createOwnedElement函数，不再手动添加"已保存在我的库中"标记

    // createFreeElement函数已移除，不再使用

    // --- 新增: 数据缓存系统 ---
    const DataCache = {
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
        isValid: function(type, key) {
            const timestamp = this.timestamps[type].get(key);
            return timestamp && (Date.now() - timestamp < this.TTL);
        },

        // 保存商品数据到缓存
        saveListings: function(items) {
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
        addToWaitingList: function(uids) {
            if (!uids || !Array.isArray(uids)) return;
            uids.forEach(uid => this.waitingList.add(uid));
            Utils.logger('debug', `[Cache] ${Utils.getText('fab_dom_add_to_waitlist', uids.length, this.waitingList.size)}`);
        },

        // 检查并从等待列表中移除
        checkWaitingList: function() {
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
        saveOwnedStatus: function(states) {
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
        savePrices: function(offers) {
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
        getListings: function(uids) {
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
        getOwnedStatus: function(uids) {
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
        getPrices: function(offerIds) {
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
        cleanupExpired: function() {
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
                    Utils.logger('debug', `[Cache] 清理完成，当前缓存大小: 商品=${this.listings.size}, 拥有状态=${this.ownedStatus.size}, 价格=${this.prices.size}`);
                }
            } catch (e) {
                Utils.logger('error', `缓存清理失败: ${e.message}`);
            }
        }
    };

    // --- 模块四: 异步网络请求 ---
    const API = {
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
        checkItemsOwnership: async function(uids) {
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
        checkItemsPrices: async function(offerIds) {
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
        // ... Other API-related functions will go here ...
    };


    // --- 模块五: 数据库交互 ---
    const Database = {
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
                UI.removeAllOverlays();
                UI.update();
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
        markAsFailed: async (task) => {
            if (!task || !task.uid) {
                Utils.logger('error', '标记任务失败，收到无效任务:', JSON.stringify(task));
                return;
            }

            // Remove from todo
            const initialTodoCount = State.db.todo.length;
            State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
            let changed = State.db.todo.length < initialTodoCount;

            // Add to failed, ensuring no duplicates by UID
            if (!State.db.failed.some(f => f.uid === task.uid)) {
                State.db.failed.push(task); // Store the whole task object for potential retry
                changed = true;
            }

            if (changed) {
                await Database.saveFailed();
            }
        },
    };



    // 集中处理限速状态的函数
    const RateLimitManager = {
        // 添加防止重复日志的变量
        _lastLogTime: 0,
        _lastLogType: null,
        _duplicateLogCount: 0,

        // 检查是否与最后一条记录重复
        isDuplicateRecord: function(newEntry) {
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
        addToHistory: async function(entry) {
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
        enterRateLimitedState: async function(source = '未知来源') {
            // 如果已经处于限速状态，不需要重复处理
            if (State.appStatus === 'RATE_LIMITED') {
                Utils.logger('info', `已处于限速状态，来源: ${State.lastLimitSource}，忽略新的限速触发: ${source}`);
                return false;
            }

            // 重置连续成功计数
            State.consecutiveSuccessCount = 0;
            State.lastLimitSource = source;

            // 记录正常运行期的统计信息
            // 添加空值检查，防止normalStartTime为null
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
                Utils.logger('error', `🚨 RATE LIMIT DETECTED from [${source}]! Normal operation lasted ${normalDuration}s with ${State.successfulSearchCount} successful search requests.`);
            } else {
                Utils.logger('debug', `检测到重复的正常状态记录，来源: ${source}`);
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
            UI.updateDebugTab();
            UI.update();

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
            } else {
                // 无任务情况下，开始随机刷新
                // 缩短延迟时间为5-7秒，使恢复更快
                const randomDelay = 5000 + Math.random() * 2000;
                if (State.autoResumeAfter429) {
                    // 添加空值检查，防止randomDelay为null
                    Utils.logger('info', Utils.getText('log_auto_resume_start', randomDelay ? (randomDelay/1000).toFixed(1) : '未知'));
                } else {
                    // 添加空值检查，防止randomDelay为null
                    Utils.logger('info', Utils.getText('log_auto_resume_detect', randomDelay ? (randomDelay/1000).toFixed(1) : '未知'));
                }
                countdownRefresh(randomDelay, '429自动恢复');
            }

            return true;
        },

        // 记录成功请求
        recordSuccessfulRequest: async function(source = '未知来源', hasResults = true) {
            // 无论在什么状态下，总是增加成功请求计数 - 修复统计问题
            if (hasResults) {
                State.successfulSearchCount++;
                UI.updateDebugTab();
            }

            // 只有在限速状态下才需要记录连续成功
            if (State.appStatus !== 'RATE_LIMITED') {
                return;
            }

            // 如果请求没有返回有效结果，不计入连续成功
            if (!hasResults) {
                Utils.logger('info', `请求成功但没有返回有效结果，不计入连续成功计数。来源: ${source}`);
                State.consecutiveSuccessCount = 0;
                return;
            }

            // 增加连续成功计数
            State.consecutiveSuccessCount++;

            Utils.logger('info', Utils.getText('rate_limit_success_request', State.consecutiveSuccessCount, State.requiredSuccessCount, source));

            // 如果达到所需的连续成功数，退出限速状态
            if (State.consecutiveSuccessCount >= State.requiredSuccessCount) {
                await this.exitRateLimitedState(`连续${State.consecutiveSuccessCount}次成功请求 (${source})`);
            }
        },

        // 退出限速状态
        exitRateLimitedState: async function(source = '未知来源') {
            // 如果当前不是限速状态，不需要处理
            if (State.appStatus !== 'RATE_LIMITED') {
                Utils.logger('info', `当前不是限速状态，忽略退出限速请求: ${source}`);
                return false;
            }

            // 记录限速期的统计信息
            // 添加空值检查，防止rateLimitStartTime为null
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
                Utils.logger('info', `✅ Rate limit appears to be lifted from [${source}]. The 429 period lasted ${rateLimitDuration}s.`);
            } else {
                Utils.logger('debug', `检测到重复的限速状态记录，来源: ${source}`);
            }

            // 恢复到正常状态
            State.appStatus = 'NORMAL';
            State.rateLimitStartTime = null;
            State.normalStartTime = Date.now();
            // 不重置请求计数，保留累计值，这样每个正常期的请求数会累加起来
            // State.successfulSearchCount = 0;
            State.consecutiveSuccessCount = 0;

            // 删除存储的限速状态
            await GM_deleteValue(Config.DB_KEYS.APP_STATUS);

            // 更新UI
            UI.updateDebugTab();
            UI.update();

            // 如果有待办任务，继续执行
            if (State.db.todo.length > 0 && !State.isExecuting) {
                Utils.logger('info', `发现 ${State.db.todo.length} 个待办任务，自动恢复执行...`);
                State.isExecuting = true;
                Database.saveExecutingState();
                TaskRunner.executeBatch();
            }

            return true;
        },

        // 检查限速状态
        checkRateLimitStatus: async function() {
            // 如果已经在检查中，避免重复检查
            if (State.isCheckingRateLimit) {
                Utils.logger('info', '已有限速状态检查正在进行，跳过本次检查');
                return false;
            }

            State.isCheckingRateLimit = true;

            try {
                Utils.logger('info', '开始检查限速状态...');

                // 首先检查页面内容是否包含限速信息
                const pageText = document.body.innerText || '';
                if (pageText.includes('Too many requests') ||
                    pageText.includes('rate limit') ||
                    pageText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {

                    Utils.logger('warn', '页面内容包含限速信息，确认仍处于限速状态');
                    await this.enterRateLimitedState('页面内容检测');
                    return false;
                }

                // 使用Performance API检查最近的网络请求，而不是主动发送API请求
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
                Utils.logger('info', `没有足够的信息判断限速状态，保持当前状态`);
                return State.appStatus === 'NORMAL';
            } catch (e) {
                Utils.logger('error', `限速状态检查失败: ${e.message}`);
                return false;
            } finally {
                State.isCheckingRateLimit = false;
            }
        }
    };

    const PagePatcher = {
        _patchHasBeenApplied: false,
        _lastSeenCursor: null,
        // REMOVED: This state variable was the source of the bug.
        // _secondToLastSeenCursor: null,

        // --- NEW: State for request debouncing ---
        _debounceXhrTimer: null,
        _pendingXhr: null,

        async init() {
            // 初始化时，从存储中加载上次保存的cursor
            try {
                const savedCursor = await GM_getValue(Config.DB_KEYS.LAST_CURSOR);
                if (savedCursor) {
                    State.savedCursor = savedCursor;
                    this._lastSeenCursor = savedCursor;
                    Utils.logger('info', `[Cursor] Initialized. Loaded saved cursor: ${savedCursor.substring(0, 30)}...`);
                } else {
                    Utils.logger('info', `[Cursor] Initialized. No saved cursor found.`);
                }
            } catch (e) {
                Utils.logger('warn', '[Cursor] Failed to restore cursor state:', e);
            }

            // 应用拦截器
            this.applyPatches();
            Utils.logger('info', '[Cursor] Network interceptors applied.');

            // 监听URL变化，检测排序方式变更
            this.setupSortMonitor();
        },

        // 添加监听URL变化的方法，检测排序方式变更
        setupSortMonitor() {
            // 初始检查当前URL中的排序参数
            this.checkCurrentSortFromUrl();

            // 使用MutationObserver监听URL变化
            if (typeof MutationObserver !== 'undefined') {
                // 监听body变化，因为SPA应用可能不会触发popstate事件
                const bodyObserver = new MutationObserver(() => {
                    // 如果URL发生变化，检查排序参数和语言
                    if (window.location.href !== this._lastCheckedUrl) {
                        this._lastCheckedUrl = window.location.href;
                        this.checkCurrentSortFromUrl();
                        // 重新检测语言
                        Utils.detectLanguage();
                    }
                });

                bodyObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                // 保存引用以便后续可以断开
                this._bodyObserver = bodyObserver;
            }

            // 监听popstate事件（浏览器前进/后退按钮）
            window.addEventListener('popstate', () => {
                this.checkCurrentSortFromUrl();
                Utils.detectLanguage();
            });

            // 监听hashchange事件
            window.addEventListener('hashchange', () => {
                this.checkCurrentSortFromUrl();
                Utils.detectLanguage();
            });

            // 保存当前URL作为初始状态
            this._lastCheckedUrl = window.location.href;
        },

        // 从URL中检查当前排序方式并更新设置
        checkCurrentSortFromUrl() {
            try {
                const url = new URL(window.location.href);
                const sortParam = url.searchParams.get('sort_by');

                if (!sortParam) return; // 如果URL中没有排序参数，不做任何更改

                // 查找匹配的排序选项
                let matchedOption = null;
                for (const [key, option] of Object.entries(State.sortOptions)) {
                    if (option.value === sortParam) {
                        matchedOption = key;
                        break;
                    }
                }

                // 如果找到匹配的排序选项，且与当前选项不同，则更新
                if (matchedOption && matchedOption !== State.currentSortOption) {
                    const previousSort = State.currentSortOption;
                    State.currentSortOption = matchedOption;
                    GM_setValue('fab_helper_sort_option', State.currentSortOption);

                                         // 排序选择器UI已移除，不需要更新

                    Utils.logger('info', `检测到URL排序参数变更，排序方式已从"${State.sortOptions[previousSort].name}"更改为"${State.sortOptions[State.currentSortOption].name}"`);

                    // 清除已保存的浏览位置
                    State.savedCursor = null;
                    GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
                    if (State.UI.savedPositionDisplay) {
                        State.UI.savedPositionDisplay.textContent = Utils.getText('no_saved_position');
                    }
                    Utils.logger('info', '由于排序方式变更，已清除保存的浏览位置');
                }
            } catch (e) {
                Utils.logger('warn', `检查URL排序参数时出错: ${e.message}`);
            }
        },

        async handleSearchResponse(request) {
            if (request.status === 429) {
                // 使用统一的限速管理器处理限速情况
                await RateLimitManager.enterRateLimitedState('搜索响应429');
            } else if (request.status >= 200 && request.status < 300) {
                try {
                    // 检查响应是否包含有效数据
                    const responseText = request.responseText;
                    if (responseText) {
                        const data = JSON.parse(responseText);
                        const hasResults = data && data.results && data.results.length > 0;

                        // 记录成功请求，并传递是否有结果的信息
                        await RateLimitManager.recordSuccessfulRequest('搜索响应成功', hasResults);
                    }
                } catch (e) {
                    Utils.logger('warn', `搜索响应解析失败: ${e.message}`);
                }
            }
        },

        isDebounceableSearch(url) {
            return typeof url === 'string' && url.includes('/i/listings/search') && !url.includes('aggregate_on=') && !url.includes('count=0');
        },

        shouldPatchUrl(url) {
            if (typeof url !== 'string') return false;
            if (this._patchHasBeenApplied) return false;
            if (!State.rememberScrollPosition || !State.savedCursor) return false;
            if (!url.includes('/i/listings/search')) return false;
            if (url.includes('aggregate_on=') || url.includes('count=0') || url.includes('in=wishlist')) return false;
            // 同时支持sort_by=title和sort_by=-title的URL
            Utils.logger('info', `[PagePatcher] -> ✅ MATCH! URL will be patched: ${url}`);
            return true;
        },

        getPatchedUrl(originalUrl) {
            if (State.savedCursor) {
                const urlObj = new URL(originalUrl, window.location.origin);
                urlObj.searchParams.set('cursor', State.savedCursor);
                // 确保不改变原始URL中的sort_by参数，如果存在的话
                // 这样可以支持sort_by=-title（降序）和sort_by=title（升序）
                const modifiedUrl = urlObj.pathname + urlObj.search;
                // NEW: Logging for injection
                Utils.logger('info', `[Cursor] Injecting cursor. Original: ${originalUrl}`);
                Utils.logger('info', `[Cursor] Patched URL: ${modifiedUrl}`);
                this._patchHasBeenApplied = true; // This should be set here
                return modifiedUrl;
            }
                    return originalUrl;
        },

        saveLatestCursorFromUrl(url) {
            // 改进实现，确保不会保存过早的浏览位置
            try {
                if (typeof url !== 'string' || !url.includes('/i/listings/search') || !url.includes('cursor=')) return;
                const urlObj = new URL(url, window.location.origin);
                const newCursor = urlObj.searchParams.get('cursor');

                // 如果是有效的cursor且与上次的不同
                if (newCursor && newCursor !== this._lastSeenCursor) {
                    // 解码cursor，检查是否是有效的浏览位置
                    let isValidPosition = true;
                    let decodedCursor = '';

                    try {
                        decodedCursor = atob(newCursor);

                        // 1. 检查特定的过滤关键词列表
                        const filterKeywords = [
                            "Nude+Tennis+Racket",
                            "Nordic+Beach+Boulder",
                            "Nordic+Beach+Rock"
                        ];

                        // 检查是否包含任何需要过滤的关键词
                        if (filterKeywords.some(keyword => decodedCursor.includes(keyword))) {
                            Utils.logger('info', `[Cursor] 跳过已知位置的保存: ${decodedCursor}`);
                            isValidPosition = false;
                        }

                        // 2. 检查是否是已经滚动过的前面位置（直接检测首字母）
                        if (isValidPosition && this._lastSeenCursor) {
                            try {
                                // 从解码的cursor中提取物品名称
                                let newItemName = '';
                                let lastItemName = '';

                                // 提取当前cursor中的物品名
                                if (decodedCursor.includes("p=")) {
                                    const match = decodedCursor.match(/p=([^&]+)/);
                                    if (match && match[1]) {
                                        newItemName = decodeURIComponent(match[1].replace(/\+/g, ' '));
                                    }
                                }

                                // 提取上次保存cursor中的物品名
                                const lastDecoded = atob(this._lastSeenCursor);
                                if (lastDecoded.includes("p=")) {
                                    const match = lastDecoded.match(/p=([^&]+)/);
                                    if (match && match[1]) {
                                        lastItemName = decodeURIComponent(match[1].replace(/\+/g, ' '));
                                    }
                                }

                                // 提取首字母或首个单词进行比较
                                if (newItemName && lastItemName) {
                                    // 获取首个单词或首字母
                                    const getFirstWord = (text) => {
                                        // 优先获取前三个字母，如果不足三个则获取全部
                                        return text.trim().substring(0, 3);
                                    };

                                    const newFirstWord = getFirstWord(newItemName);
                                    const lastFirstWord = getFirstWord(lastItemName);

                                    // 检查URL中的排序参数
                                    const sortParam = urlObj.searchParams.get('sort_by') || '';
                                    const isReverseSort = sortParam.startsWith('-');

                                    // 根据排序方向决定比较逻辑
                                    // 如果是按标题排序：
                                    // - 升序排列(title)：如果新位置的首字母在字母表中排在当前位置前面，说明是回退了
                                    // - 降序排列(-title)：如果新位置的首字母在字母表中排在当前位置后面，说明是回退了
                                    if ((isReverseSort && sortParam.includes('title') && newFirstWord > lastFirstWord) ||
                                        (!isReverseSort && sortParam.includes('title') && newFirstWord < lastFirstWord)) {
                                        Utils.logger('info', `[Cursor] 跳过回退位置: ${newItemName} (当前位置: ${lastItemName}), 排序: ${isReverseSort ? '降序' : '升序'}`);
                                        isValidPosition = false;
                                    }
                                }
                            } catch (compareError) {
                                // 比较错误，继续正常流程
                            }
                        }
                    } catch (decodeError) {
                        // 解码错误，继续正常流程
                    }

                    // 只有是有效位置才保存
                    if (isValidPosition) {
                        this._lastSeenCursor = newCursor;
                        State.savedCursor = newCursor; // 立即更新状态

                        // 持久化保存cursor供下次页面加载使用
                        GM_setValue(Config.DB_KEYS.LAST_CURSOR, newCursor);

                        // 日志记录保存操作
                        if (State.debugMode) {
                            Utils.logger('debug', `[Cursor] ${Utils.getText('debug_save_cursor', newCursor.substring(0, 30) + '...')}`);
                        }

                        // 更新UI中的位置显示
                        if (State.UI.savedPositionDisplay) {
                            State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(newCursor);
                        }
                    }
                }
            } catch (e) {
                Utils.logger('warn', `[Cursor] 保存cursor时出错:`, e);
            }
        },

        applyPatches() {
            const self = this;
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            const originalXhrSend = XMLHttpRequest.prototype.send;
            const DEBOUNCE_DELAY_MS = 350; // Centralize debounce delay

            const listenerAwareSend = function(...args) {
                const request = this;
                // 为所有请求添加监听器
                const onLoad = () => {
                    request.removeEventListener("load", onLoad);

                    // 记录所有网络活动
                    if (typeof window.recordNetworkActivity === 'function') {
                        window.recordNetworkActivity();
                    }

                    // 只统计商品相关的请求，保持原有逻辑
                    if (request.status >= 200 && request.status < 300 &&
                        request._url && self.isDebounceableSearch(request._url)) {
                        // 只记录商品卡片相关请求
                        window.recordNetworkRequest('XHR商品请求', true);
                    }

                    // 对所有请求检查429错误
                    if (request.status === 429 || request.status === '429' || request.status.toString() === '429') {
                        Utils.logger('warn', `[XHR] 检测到429状态码: ${request.responseURL || request._url}`);
                        // 调用handleRateLimit函数处理限速情况
                        RateLimitManager.enterRateLimitedState(request.responseURL || request._url || 'XHR响应429');
                        return;
                    }

                    // 检查其他可能的限速情况（返回空结果或错误信息）
                    if (request.status >= 200 && request.status < 300) {
                        try {
                            const responseText = request.responseText;
                            if (responseText) {
                                // 先检查原始文本是否包含限速相关的关键词
                                if (responseText.includes("Too many requests") ||
                                    responseText.includes("rate limit") ||
                                    responseText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                                    Utils.logger('warn', `[XHR限速检测] 检测到限速情况，原始响应: ${responseText}`);
                                    RateLimitManager.enterRateLimitedState('XHR响应内容限速');
                                    return;
                                }

                                // 尝试解析JSON
                                try {
                                    const data = JSON.parse(responseText);

                                    // 检查是否返回了空结果或错误信息
                                    if (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit"))) {
                                        Utils.logger('warn', `[隐性限速检测] 检测到限速错误信息: ${JSON.stringify(data)}`);
                                        RateLimitManager.enterRateLimitedState('XHR响应限速错误');
                                        return;
                                    }

                                    // 检查是否返回了空结果
                                    if (data.results && data.results.length === 0 && self.isDebounceableSearch(request._url)) {
                                        // 情况1: 到达列表末尾的正常情况（next为null但previous不为null）
                                        const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;

                                        // 情况2: 完全空的结果集，但可能是正常的搜索结果为空
                                        const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;

                                        // 获取当前URL的参数
                                        const urlObj = new URL(request._url, window.location.origin);
                                        const params = urlObj.searchParams;

                                        // 检查是否有特殊的搜索参数（如果有特殊过滤条件，空结果可能是正常的）
                                        const hasSpecialFilters = params.has('query') || params.has('category') || params.has('subcategory') || params.has('tag');

                                        if (isEndOfList) {
                                            Utils.logger('info', `[列表末尾] 检测到已到达列表末尾，这是正常情况，不触发限速: ${JSON.stringify(data).substring(0, 200)}...`);
                                            // 记录成功请求，虽然没有结果，但这是正常情况
                                            RateLimitManager.recordSuccessfulRequest('XHR列表末尾', true);
                                            return;
                                        } else if (isEmptySearch && hasSpecialFilters) {
                                            Utils.logger('info', `[空搜索结果] 检测到搜索结果为空，但包含特殊过滤条件，这可能是正常情况: ${JSON.stringify(data).substring(0, 200)}...`);
                                            // 记录成功请求，虽然没有结果，但这可能是正常情况
                                            RateLimitManager.recordSuccessfulRequest('XHR空搜索结果', true);
                                            return;
                                        } else if (isEmptySearch && State.appStatus === 'RATE_LIMITED') {
                                            // 如果已经处于限速状态，不要重复触发
                                            Utils.logger('info', `[空搜索结果] 已处于限速状态，不重复触发: ${JSON.stringify(data).substring(0, 200)}...`);
                                            return;
                                        } else if (isEmptySearch && document.readyState !== 'complete') {
                                            // 如果页面尚未完全加载，可能是初始请求，不要立即触发限速
                                            Utils.logger('info', `[空搜索结果] 页面尚未完全加载，可能是初始请求，不触发限速: ${JSON.stringify(data).substring(0, 200)}...`);
                                            return;
                                        } else if (isEmptySearch && Date.now() - (window.pageLoadTime || 0) < 5000) {
                                            // 如果页面刚刚加载不到5秒，可能是初始请求，不要立即触发限速
                                            Utils.logger('info', `[空搜索结果] ${Utils.getText('empty_search_initial')}: ${JSON.stringify(data).substring(0, 200)}...`);
                                            return;
                                        } else {
                                            Utils.logger('warn', `[隐性限速检测] 检测到可能的限速情况(空结果): ${JSON.stringify(data).substring(0, 200)}...`);
                                            RateLimitManager.enterRateLimitedState('XHR响应空结果');
                                            return;
                                        }
                                    }

                                    // 如果是搜索请求且有结果，记录成功请求
                                    if (self.isDebounceableSearch(request._url) && data.results && data.results.length > 0) {
                                        RateLimitManager.recordSuccessfulRequest('XHR搜索成功', true);
                                    }
                                } catch (jsonError) {
                                    // JSON解析错误，忽略
                                }
                            }
                        } catch (e) {
                            // 解析错误，忽略
                        }
                    }

                    // 处理搜索请求的特殊逻辑（429检测等）
                    if (self.isDebounceableSearch(request._url)) {
                        self.handleSearchResponse(request);
                    }
                };
                request.addEventListener("load", onLoad);

                return originalXhrSend.apply(request, args);
            };

            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                let modifiedUrl = url;
                // Priority 1: Handle the "remember position" patch, which should not be debounced.
                if (self.shouldPatchUrl(url)) {
                    modifiedUrl = self.getPatchedUrl(url);
                    this._isDebouncedSearch = false; // Explicitly mark it as NOT debounced
                }
                // Priority 2: Tag all other infinite scroll requests to be debounced.
                else if (self.isDebounceableSearch(url)) {
                    self.saveLatestCursorFromUrl(url); // FIX: Ensure we save the cursor before debouncing.
                    this._isDebouncedSearch = true;
                }
                // Priority 3: All other requests just save the cursor.
                else {
                    self.saveLatestCursorFromUrl(url);
                }
                this._url = modifiedUrl;
                // We still call the original open, but the send will be intercepted.
                return originalXhrOpen.apply(this, [method, modifiedUrl, ...args]);
            };

            XMLHttpRequest.prototype.send = function(...args) {
                // If this is not a request we need to debounce, send it immediately.
                if (!this._isDebouncedSearch) {
                    // Still use the wrapper to catch responses for non-debounced search requests
                    return listenerAwareSend.apply(this, args);
                }

                // NEW: Use [Debounce] tag for clarity
                if (State.debugMode) {
                    Utils.logger('debug', `[Debounce] 🚦 Intercepted scroll request. Applying ${DEBOUNCE_DELAY_MS}ms delay...`);
                }

                // If there's a previously pending request, abort it.
                if (self._pendingXhr) {
                    self._pendingXhr.abort();
                    Utils.logger('info', `[Debounce] 🗑️ Discarded previous pending request.`);
                }
                // Clear any existing timer.
                clearTimeout(self._debounceXhrTimer);

                // Store the current request as the latest one.
                self._pendingXhr = this;

                // Set a timer to send the latest request after a period of inactivity.
                self._debounceXhrTimer = setTimeout(() => {
                    if (State.debugMode) {
                        Utils.logger('debug', `[Debounce] ▶️ Sending latest scroll request: ${this._url}`);
                    }
                    listenerAwareSend.apply(self._pendingXhr, args);
                    self._pendingXhr = null; // Clear after sending
                }, DEBOUNCE_DELAY_MS);
            };

            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
                let url = (typeof input === 'string') ? input : input.url;
                let modifiedInput = input;
                if (self.shouldPatchUrl(url)) {
                    const modifiedUrl = self.getPatchedUrl(url);
                        if (typeof input === 'string') {
                            modifiedInput = modifiedUrl;
                        } else {
                            modifiedInput = new Request(modifiedUrl, input);
                        }
                    } else {
                    self.saveLatestCursorFromUrl(url);
                    }

                // 拦截响应以检测429错误
                return originalFetch.apply(this, [modifiedInput, init])
                    .then(async response => {
                        // 记录所有网络活动
                        if (typeof window.recordNetworkActivity === 'function') {
                            window.recordNetworkActivity();
                        }

                        // 只统计商品相关的请求
                        if (response.status >= 200 && response.status < 300 &&
                            typeof url === 'string' && self.isDebounceableSearch(url)) {
                            window.recordNetworkRequest('Fetch商品请求', true);
                        }

                        // 检查429错误
                        if (response.status === 429 || response.status === '429' || response.status.toString() === '429') {
                            // 克隆响应以避免"已消费"错误
                            // 克隆响应以避免"已消费"错误（但这里不需要使用）
                            response.clone();
                            Utils.logger('warn', `[Fetch] 检测到429状态码: ${response.url}`);
                            // 使用RateLimitManager处理限速情况
                            RateLimitManager.enterRateLimitedState('Fetch响应429').catch(e =>
                                Utils.logger('error', `处理限速时出错: ${e.message}`)
                            );
                        }

                        // 检查其他可能的限速情况（返回空结果或错误信息）
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                // 克隆响应以避免"已消费"错误
                                const clonedResponse = response.clone();

                                // 先检查原始文本
                                const text = await clonedResponse.text();
                                if (text.includes("Too many requests") ||
                                    text.includes("rate limit") ||
                                    text.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                                    Utils.logger('warn', `[Fetch限速检测] 检测到限速情况，原始响应: ${text.substring(0, 100)}...`);
                                    RateLimitManager.enterRateLimitedState('Fetch响应内容限速').catch(e =>
                                        Utils.logger('error', `处理限速时出错: ${e.message}`)
                                    );
                                    return response;
                                }

                                        // 尝试解析JSON - 增强版
        try {
            const data = JSON.parse(text);

            // 检查明确的限速信息
            if (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit"))) {
                Utils.logger('warn', `[限速检测] 检测到API限速响应`);
                RateLimitManager.enterRateLimitedState('API限速响应').catch(e =>
                    Utils.logger('error', `处理限速时出错: ${e.message}`)
                );
                return;
            }

            // 检查是否返回了空结果
            const responseUrl = response.url || '';
            if (data.results && data.results.length === 0 && responseUrl.includes('/i/listings/search')) {
                // 情况1: 到达列表末尾的正常情况（next为null但previous不为null）
                const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;

                // 情况2: 完全空的结果集，但可能是正常的搜索结果为空
                const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;

                // 获取当前URL的参数
                const urlObj = new URL(responseUrl, window.location.origin);
                const params = urlObj.searchParams;

                // 检查是否有特殊的搜索参数（如果有特殊过滤条件，空结果可能是正常的）
                const hasSpecialFilters = params.has('query') || params.has('category') || params.has('subcategory') || params.has('tag');

                if (isEndOfList) {
                    Utils.logger('info', `[Fetch列表末尾] 检测到已到达列表末尾，这是正常情况，不触发限速: ${JSON.stringify(data).substring(0, 200)}...`);
                    // 记录成功请求，虽然没有结果，但这是正常情况
                    RateLimitManager.recordSuccessfulRequest('Fetch列表末尾', true);
                } else if (isEmptySearch && hasSpecialFilters) {
                    Utils.logger('info', `[Fetch空搜索结果] 检测到搜索结果为空，但包含特殊过滤条件，这可能是正常情况: ${JSON.stringify(data).substring(0, 200)}...`);
                    // 记录成功请求，虽然没有结果，但这可能是正常情况
                    RateLimitManager.recordSuccessfulRequest('Fetch空搜索结果', true);
                } else if (isEmptySearch && State.appStatus === 'RATE_LIMITED') {
                    // 如果已经处于限速状态，不要重复触发
                    Utils.logger('info', `[Fetch空搜索结果] 已处于限速状态，不重复触发: ${JSON.stringify(data).substring(0, 200)}...`);
                } else if (isEmptySearch && document.readyState !== 'complete') {
                    // 如果页面尚未完全加载，可能是初始请求，不要立即触发限速
                    Utils.logger('info', `[Fetch空搜索结果] 页面尚未完全加载，可能是初始请求，不触发限速: ${JSON.stringify(data).substring(0, 200)}...`);
                } else if (isEmptySearch && Date.now() - (window.pageLoadTime || 0) < 5000) {
                    // 如果页面刚刚加载不到5秒，可能是初始请求，不要立即触发限速
                    Utils.logger('info', `[Fetch空搜索结果] 页面刚刚加载，可能是初始请求，不触发限速: ${JSON.stringify(data).substring(0, 200)}...`);
                } else {
                    Utils.logger('warn', `[Fetch隐性限速] 检测到可能的限速情况(空结果): ${JSON.stringify(data).substring(0, 200)}...`);
                    RateLimitManager.enterRateLimitedState('Fetch响应空结果').catch(e =>
                        Utils.logger('error', `处理限速时出错: ${e.message}`)
                    );
                }
            }
        } catch (jsonError) {
            // JSON解析错误，忽略
            Utils.logger('debug', `JSON解析错误: ${jsonError.message}`);
            // 添加更多调试信息，帮助诊断问题
            if (responseText && responseText.length > 0) {
                Utils.logger('debug', `响应长度: ${responseText.length}, 前100个字符: ${responseText.substring(0, 100)}`);
            }
        }
                            } catch (e) {
                                // 解析错误，忽略
                            }
                        }

                        return response;
                });
            };
        }
    };


    // --- 模块七: 任务运行器与事件处理 (Task Runner & Event Handlers) ---
    const TaskRunner = {
        isCardFinished: (card) => {
            const link = card.querySelector(Config.SELECTORS.cardLink);
            // If there's no link, we can't get a URL to check against the DB.
            // In this case, rely only on visual cues.
            const url = link ? link.href.split('?')[0] : null;

            // 如果没有链接，无法获取UID，则只能依赖视觉提示
            if (!link) {
                // 检查是否有"已拥有"样式标记（绿色对勾图标）
                const icons = card.querySelectorAll('i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled');
                if (icons.length > 0) return true;

                // 检查是否有"已保存"文本
                const text = card.textContent || '';
                return text.includes("已保存在我的库中") ||
                       text.includes("已保存") ||
                       text.includes("Saved to My Library") ||
                       text.includes("In your library");
            }

            // 从链接中提取UID
            const uidMatch = link.href.match(/listings\/([a-f0-9-]+)/);
            if (!uidMatch || !uidMatch[1]) {
                return false;
            }

            const uid = uidMatch[1];

            // 优先使用缓存的API数据判断
            if (DataCache.ownedStatus.has(uid)) {
                const status = DataCache.ownedStatus.get(uid);
                if (status && status.acquired) {
                    return true;
                }
            }

            // 如果缓存中没有，则检查网页元素
            if (card.querySelector(Config.SELECTORS.ownedStatus) !== null) {
                // 找到了，将状态保存到缓存
                if (uid) {
                    DataCache.saveOwnedStatus([{
                        uid: uid,
                        acquired: true,
                        lastUpdatedAt: new Date().toISOString()
                    }]);
                }
                return true;
            }

            // 最后检查本地数据库
            if (url) {
                if (Database.isDone(url)) return true;
                if (Database.isFailed(url)) return true; // A failed item is also considered "finished" for skipping/hiding purposes.
                if (State.sessionCompleted.has(url)) return true;
            }

            return false;
        },
        // --- Toggles ---
        // This is the new main execution function, triggered by the "一键开刷" button.
        toggleExecution: () => {
            if (State.isExecuting) {
                // If it's running, stop it.
                State.isExecuting = false;
                // 保存执行状态
                Database.saveExecutingState();
                State.runningWorkers = {};
                State.activeWorkers = 0;
                State.executionTotalTasks = 0;
                State.executionCompletedTasks = 0;
                State.executionFailedTasks = 0;
                Utils.logger('info', '执行已由用户手动停止。');
                UI.update();
                return;
            }

            // NEW: Divert logic if auto-add is on. The observer populates the list,
            // so the button should just act as a "start" signal.
            if (State.autoAddOnScroll) {
                Utils.logger('info', Utils.getText('log_auto_add_enabled'));

                // 先检查当前页面上的卡片状态，更新数据库
                TaskRunner.checkVisibleCardsStatus().then(() => {
                    // 然后开始执行任务
                    TaskRunner.startExecution(); // This will use the existing todo list
                });
                return;
            }


            // --- BEHAVIOR CHANGE: From Accumulate to Overwrite Mode ---
            // As per user request for waterfall pages, clear the existing To-Do list before every scan.
            // This part now only runs when auto-add is OFF.
            State.db.todo = [];
            Utils.logger('info', '待办列表已清空。现在将扫描并仅添加当前可见的项目。');

            Utils.logger('info', '正在扫描已加载完成的商品...');
                const cards = document.querySelectorAll(Config.SELECTORS.card);
                const newlyAddedList = [];
                let alreadyInQueueCount = 0;
                let ownedCount = 0;
            let skippedCount = 0;

            const isCardSettled = (card) => {
                return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
            };

                cards.forEach(card => {
                // 正确的修复：直接检查元素的 display 样式。如果它是 'none'，就意味着它被隐藏了，应该跳过。
                if (card.style.display === 'none') {
                    return;
                }

                if (!isCardSettled(card)) {
                    skippedCount++;
                    return; // Skip unsettled cards
                }

                // UNIFIED LOGIC: Use the new single source of truth to check if the card is finished.
                if (TaskRunner.isCardFinished(card)) {
                        ownedCount++;
                        return;
                    }

                const link = card.querySelector(Config.SELECTORS.cardLink);
                const url = link ? link.href.split('?')[0] : null;
                if (!url) return; // Should be caught by isCardFinished, but good for safety.

                // The only check unique to adding is whether it's already in the 'todo' queue.
                    const isTodo = Database.isTodo(url);
                if (isTodo) {
                        alreadyInQueueCount++;
                        return;
                    }

                    const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || Utils.getText('untitled');
                    newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
                });

            if (skippedCount > 0) {
                Utils.logger('info', `已跳过 ${skippedCount} 个状态未加载的商品。`);
            }

                if (newlyAddedList.length > 0) {
                    State.db.todo.push(...newlyAddedList);
                    Utils.logger('info', `已将 ${newlyAddedList.length} 个新商品加入待办队列。`);
                }

                const actionableCount = State.db.todo.length;
                if (actionableCount > 0) {
                    if (newlyAddedList.length === 0 && alreadyInQueueCount > 0) {
                         Utils.logger('info', `本页的 ${alreadyInQueueCount} 个可领取商品已全部在待办或失败队列中。`);
                }

                    // 先检查当前页面上的卡片状态，更新数据库
                    TaskRunner.checkVisibleCardsStatus().then(() => {
                        // 然后开始执行任务
                    TaskRunner.startExecution();
                    });
            } else {
                 Utils.logger('info', `本页没有可领取的新商品 (已拥有: ${ownedCount} 个, 已跳过: ${skippedCount} 个)。`);
            UI.update();
            }
        },

        // This function starts the execution loop without scanning.
        startExecution: () => {
            // Case 1: Execution is already running. We just need to update the total task count.
            if (State.isExecuting) {
                const newTotal = State.db.todo.length;
                if (newTotal > State.executionTotalTasks) {
                    Utils.logger('info', `任务执行中，新任务已添加。总任务数更新为: ${newTotal}`);
                    State.executionTotalTasks = newTotal;
                    UI.update(); // Update the UI to reflect the new total.
                } else {
                    Utils.logger('info', '执行器已在运行中，新任务已加入队列等待处理。');
                }
                // IMPORTANT: Do not start a new execution loop. The current one will pick up the new tasks.
                return;
            }

            // Case 2: Starting a new execution from an idle state.
            if (State.db.todo.length === 0) {
                Utils.logger('debug', Utils.getText('log_exec_no_tasks'));
                return;
            }
            Utils.logger('info', `队列中有 ${State.db.todo.length} 个任务，即将开始执行...`);
            State.isExecuting = true;
            // 保存执行状态
            Database.saveExecutingState();
            State.executionTotalTasks = State.db.todo.length;
            State.executionCompletedTasks = 0;
            State.executionFailedTasks = 0;

            // 立即更新UI，确保按钮状态与执行状态一致
            UI.update();

            TaskRunner.executeBatch();
        },

        // 执行按钮的点击处理函数
        toggleExecution: () => {
            if (State.isExecuting) {
                TaskRunner.stop();
            } else {
                // 检查待办清单是否为空，如果为空则先扫描页面
                if (State.db.todo.length === 0) {
                    Utils.logger('info', '待办清单为空，正在扫描当前页面...');
                    // 使用主扫描函数，这会清空待办并添加新发现的商品
                    const cards = document.querySelectorAll(Config.SELECTORS.card);
                    const newlyAddedList = [];
                    let alreadyInQueueCount = 0;
                    let ownedCount = 0;
                    let skippedCount = 0;

                    const isCardSettled = (card) => {
                        return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
                    };

                    cards.forEach(card => {
                        // 检查元素是否被隐藏
                        if (card.style.display === 'none') {
                            return;
                        }

                        if (!isCardSettled(card)) {
                            skippedCount++;
                            return; // 跳过未加载完成的卡片
                        }

                        // 使用统一逻辑检查卡片是否已处理
                        if (TaskRunner.isCardFinished(card)) {
                            ownedCount++;
                            return;
                        }

                        const link = card.querySelector(Config.SELECTORS.cardLink);
                        const url = link ? link.href.split('?')[0] : null;
                        if (!url) return;

                        // 检查是否已在待办队列
                        const isTodo = Database.isTodo(url);
                        if (isTodo) {
                            alreadyInQueueCount++;
                            return;
                        }

                        const name = card.querySelector('a[aria-label*="创作的"]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || Utils.getText('untitled');
                        newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
                    });

                    if (skippedCount > 0) {
                        Utils.logger('info', `已跳过 ${skippedCount} 个状态未加载的商品。`);
                    }

                    if (newlyAddedList.length > 0) {
                        State.db.todo.push(...newlyAddedList);
                        Utils.logger('info', `已将 ${newlyAddedList.length} 个新商品加入待办队列。`);
                        // 保存待办列表到存储
                        Database.saveTodo();
                    } else {
                        Utils.logger('info', `本页没有可领取的新商品 (已拥有: ${ownedCount} 个, 已跳过: ${skippedCount} 个)。`);
                    }
                }

                // 然后开始执行
                TaskRunner.startExecution();
            }

            // 立即更新UI，确保按钮状态与执行状态一致
            UI.update();
        },
        toggleHideSaved: async () => {
            State.hideSaved = !State.hideSaved;
            await Database.saveHidePref();
            TaskRunner.runHideOrShow();

            // 如果关闭了隐藏功能，确保更新可见商品计数
            if (!State.hideSaved) {
                // 重新计算实际可见的商品数量
                const actualVisibleCount = document.querySelectorAll(`${Config.SELECTORS.card}:not([style*="display: none"])`).length;
                Utils.logger('info', `👁️ 显示模式已切换，当前页面有 ${actualVisibleCount} 个可见商品`);
            }

            UI.update();
        },

        toggleAutoAdd: async () => {
            if (State.isTogglingSetting) return;
            State.isTogglingSetting = true;

            State.autoAddOnScroll = !State.autoAddOnScroll;
            await Database.saveAutoAddPref();
            Utils.logger('info', Utils.getText('log_auto_add_toggle', State.autoAddOnScroll ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));
            // No need to call UI.update() as the visual state is handled by the component itself.

            setTimeout(() => { State.isTogglingSetting = false; }, 200);
        },

        toggleAutoResume: async () => {
            if (State.isTogglingSetting) return;
            State.isTogglingSetting = true;

            State.autoResumeAfter429 = !State.autoResumeAfter429;
            await Database.saveAutoResumePref();
            Utils.logger('info', Utils.getText('log_auto_resume_toggle', State.autoResumeAfter429 ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));

            setTimeout(() => { State.isTogglingSetting = false; }, 200);
        },

        toggleRememberPosition: async () => {
            if (State.isTogglingSetting) return;
            State.isTogglingSetting = true;

            State.rememberScrollPosition = !State.rememberScrollPosition;
            await Database.saveRememberPosPref();
            Utils.logger('info', Utils.getText('log_remember_pos_toggle', State.rememberScrollPosition ? Utils.getText('status_enabled') : Utils.getText('status_disabled')));

            if (!State.rememberScrollPosition) {
                await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
                // 重置PagePatcher中的状态
                PagePatcher._patchHasBeenApplied = false;
                PagePatcher._lastSeenCursor = null;
                State.savedCursor = null;
                Utils.logger('info', '已清除已保存的浏览位置。');

                // 更新UI中的位置显示
                if (State.UI.savedPositionDisplay) {
                    State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(null);
                }
            } else if (State.UI.savedPositionDisplay) {
                // 如果开启功能，更新显示当前保存的位置
                State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(State.savedCursor);
            }

            setTimeout(() => { State.isTogglingSetting = false; }, 200);
        },

        // 停止执行任务
        stop: () => {
            if (!State.isExecuting) return;

            State.isExecuting = false;
            // 保存执行状态
            Database.saveExecutingState();
            // 保存待办列表
            Database.saveTodo();

            // 清理任务和工作线程
            GM_deleteValue(Config.DB_KEYS.TASK);
            State.runningWorkers = {};
            State.activeWorkers = 0;
            State.executionTotalTasks = 0;
            State.executionCompletedTasks = 0;
            State.executionFailedTasks = 0;

            Utils.logger('info', '执行已由用户手动停止。');

            // 立即更新UI，确保按钮状态与执行状态一致
            UI.update();
        },

        runRecoveryProbe: async () => {
            const randomDelay = Math.floor(Math.random() * (30000 - 15000 + 1) + 15000); // 15-30 seconds
            Utils.logger('info', `[Auto-Recovery] In recovery mode. Probing connection in ${(randomDelay / 1000).toFixed(1)} seconds...`);

            setTimeout(async () => {
                Utils.logger('info', `[Auto-Recovery] Probing connection...`);
                try {
                    const csrfToken = Utils.getCookie('fab_csrftoken');
                    if (!csrfToken) throw new Error("CSRF token not found for probe.");
                    // Use a lightweight, known-good endpoint for the probe
                    const probeResponse = await API.gmFetch({
                        method: 'GET',
                        url: 'https://www.fab.com/i/users/context',
                        headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                    });

                    if (probeResponse.status === 429) {
                        throw new Error("Probe failed with 429. Still rate-limited.");
                    } else if (probeResponse.status >= 200 && probeResponse.status < 300) {
                        // SUCCESS!
                        // Manually create a fake request object to reuse the recovery logic in handleSearchResponse
                        await PagePatcher.handleSearchResponse({ status: 200 });
                        Utils.logger('info', `[Auto-Recovery] ✅ Connection restored! Auto-resuming operations...`);
                        TaskRunner.toggleExecution(); // Auto-start the process!
                    } else {
                        throw new Error(`Probe failed with unexpected status: ${probeResponse.status}`);
                    }
                } catch (e) {
                    Utils.logger('error', `[Auto-Recovery] ❌ ${e.message}. Scheduling next refresh...`);
                    setTimeout(() => location.reload(), 2000); // Wait 2s before next refresh
                }
            }, randomDelay);
        },

        resetReconProgress: async () => {
            if (State.isReconning) {
                Utils.logger('warn', Utils.getText('log_recon_active'));
                return;
            }
            await GM_deleteValue(Config.DB_KEYS.NEXT_URL);
            if (State.UI.reconProgressDisplay) {
                State.UI.reconProgressDisplay.textContent = Utils.getText('page_reset');
            }
            Utils.logger('info', Utils.getText('log_recon_reset'));
        },

        refreshVisibleStates: async () => {
            const API_ENDPOINT = 'https://www.fab.com/i/users/me/listings-states';
            const API_CHUNK_SIZE = 24; // Server-side limit

            const isElementInViewport = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
            };

            try {
                const csrfToken = Utils.getCookie('fab_csrftoken');
                if (!csrfToken) throw new Error('CSRF token not found. Are you logged in?');

                // Step 1: Gather all unique UIDs to check
                // 只收集可见的未入库商品
                const uidsFromVisibleCards = new Set([...document.querySelectorAll(Config.SELECTORS.card)]
                    .filter(isElementInViewport)
                    .filter(card => {
                        // 过滤掉已经确认入库的商品
                        const link = card.querySelector(Config.SELECTORS.cardLink);
                        if (!link) return false;
                        const url = link.href.split('?')[0];
                        return !Database.isDone(url);
                    })
                    .map(card => card.querySelector(Config.SELECTORS.cardLink)?.href.match(/listings\/([a-f0-9-]+)/)?.[1])
                    .filter(Boolean));

                // 收集已经入库失败的商品
                const uidsFromFailedList = new Set(State.db.failed.map(task => task.uid));

                // 合并两类商品ID
                const allUidsToCheck = Array.from(new Set([...uidsFromVisibleCards, ...uidsFromFailedList]));

                if (allUidsToCheck.length === 0) {
                    Utils.logger('info', '[Fab DOM Refresh] 没有未入库的可见商品或入库失败的商品需要检查。');
                    return;
                }
                Utils.logger('info', `[Fab DOM Refresh] 正在分批检查 ${uidsFromVisibleCards.size} 个未入库的可见商品和 ${uidsFromFailedList.size} 个入库失败的商品...`);

                // Step 2: Process UIDs in chunks
                const ownedUids = new Set();
                for (let i = 0; i < allUidsToCheck.length; i += API_CHUNK_SIZE) {
                    const chunk = allUidsToCheck.slice(i, i + API_CHUNK_SIZE);
                const apiUrl = new URL(API_ENDPOINT);
                    chunk.forEach(uid => apiUrl.searchParams.append('listing_ids', uid));

                    Utils.logger('info', `[Fab DOM Refresh] 正在处理批次 ${Math.floor(i / API_CHUNK_SIZE) + 1}... (${chunk.length}个项目)`);

                                    const response = await fetch(apiUrl.href, {
                        headers: { 'accept': 'application/json, text/plain, */*', 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                    });

                    if (!response.ok) {
                         Utils.logger('warn', `批次处理失败，状态码: ${response.status}。将跳过此批次。`);
                         continue; // Skip to next chunk
                    }

                    const rawData = await response.json();

                    // 使用API.extractStateData处理可能的不同格式的响应
                    const data = API.extractStateData(rawData, 'RefreshStates');

                    if (!data || !Array.isArray(data)) {
                        Utils.logger('warn', `API返回的数据格式异常: ${JSON.stringify(rawData).substring(0, 200)}...`);
                        continue; // Skip to next chunk if data format is unexpected
                    }

                    data.filter(item => item.acquired).forEach(item => ownedUids.add(item.uid));

                    // Add a small delay between chunks to be safe
                    if (allUidsToCheck.length > i + API_CHUNK_SIZE) {
                       await new Promise(r => setTimeout(r, 250));
                    }
                }

                Utils.logger('info', `[Fab DOM Refresh] ${Utils.getText('fab_dom_api_complete', ownedUids.size)}`);

                // Step 3: Update database based on all results
                let dbUpdated = false;
                const langPath = State.lang === 'zh' ? '/zh-cn' : '';
                if (ownedUids.size > 0) {
                    const initialFailedCount = State.db.failed.length;
                    State.db.failed = State.db.failed.filter(failedTask => !ownedUids.has(failedTask.uid));

                    if (State.db.failed.length < initialFailedCount) {
                        dbUpdated = true;
                        ownedUids.forEach(uid => {
                            const url = `${window.location.origin}${langPath}/listings/${uid}`;
                            if (!Database.isDone(url)) {
                                State.db.done.push(url);
                            }
                        });
                        Utils.logger('info', `[Fab DB Sync] 从"失败"列表中清除了 ${initialFailedCount - State.db.failed.length} 个已手动完成的商品。`);
                    }
                }

                // Step 3.5: Remove non-free items from the Failed list
                try {
                    const failedTasksSnapshot = [...State.db.failed];
                    Utils.logger('info', `[Fab DB Sync] 开始检查失败列表中的 ${failedTasksSnapshot.length} 个商品的价格状态...`);

                    if (failedTasksSnapshot.length > 0) {
                        // Map failed UID -> offerId (from cached listings)
                        const uidToOfferId = new Map();
                        let foundOfferIds = 0;
                        const missingCacheUids = [];

                        failedTasksSnapshot.forEach(task => {
                            const listing = DataCache.listings.get(task.uid);
                            const offerId = listing?.startingPrice?.offerId;
                            if (offerId) {
                                uidToOfferId.set(task.uid, offerId);
                                foundOfferIds++;
                            } else {
                                missingCacheUids.push(task.uid);
                                Utils.logger('debug', `[Fab DB Sync] 商品 ${task.uid} 没有找到缓存的商品信息或价格ID`);
                            }
                        });

                        Utils.logger('info', `[Fab DB Sync] 在 ${failedTasksSnapshot.length} 个失败商品中找到了 ${foundOfferIds} 个有价格ID的商品`);

                        // 对于没有缓存数据的商品，尝试重新获取信息
                        if (missingCacheUids.length > 0) {
                            Utils.logger('info', `[Fab DB Sync] 尝试为 ${missingCacheUids.length} 个缺失缓存的商品重新获取信息...`);

                            try {
                                const csrfToken = Utils.getCookie('fab_csrftoken');
                                if (csrfToken) {
                                    // 分批查询商品信息
                                    const SEARCH_CHUNK_SIZE = 5; // 每次查询5个商品
                                    for (let i = 0; i < missingCacheUids.length; i += SEARCH_CHUNK_SIZE) {
                                        const chunk = missingCacheUids.slice(i, i + SEARCH_CHUNK_SIZE);

                                        for (const uid of chunk) {
                                            try {
                                                const searchUrl = `https://www.fab.com/i/listings/search?q=${uid}`;
                                                const response = await fetch(searchUrl, {
                                                    headers: {
                                                        'accept': 'application/json, text/plain, */*',
                                                        'x-csrftoken': csrfToken,
                                                        'x-requested-with': 'XMLHttpRequest'
                                                    }
                                                });

                                                if (response.ok) {
                                                    const searchData = await response.json();
                                                    if (searchData.results && searchData.results.length > 0) {
                                                        // 找到匹配的商品
                                                        const matchedItem = searchData.results.find(item => item.uid === uid);
                                                        if (matchedItem && matchedItem.startingPrice?.offerId) {
                                                            // 缓存商品信息
                                                            DataCache.saveListings([matchedItem]);
                                                            // 添加到offerId映射
                                                            uidToOfferId.set(uid, matchedItem.startingPrice.offerId);
                                                            foundOfferIds++;
                                                            Utils.logger('debug', `[Fab DB Sync] 成功获取商品 ${uid} 的价格ID: ${matchedItem.startingPrice.offerId}`);
                                                        }
                                                    }
                                                }

                                                // 添加延迟避免请求过快
                                                await new Promise(r => setTimeout(r, 200));
                                            } catch (e) {
                                                Utils.logger('debug', `[Fab DB Sync] 获取商品 ${uid} 信息失败: ${e.message}`);
                                            }
                                        }
                                    }

                                    Utils.logger('info', `[Fab DB Sync] 重新获取完成，现在总共有 ${foundOfferIds} 个商品有价格ID`);
                                }
                            } catch (e) {
                                Utils.logger('warn', `[Fab DB Sync] 重新获取商品信息时出错: ${e.message}`);
                            }
                        }

                        const offerIds = Array.from(uidToOfferId.values());
                        if (offerIds.length > 0) {
                            const CHUNK = 50;
                            const nonFreeOfferIds = new Set();

                            Utils.logger('info', `[Fab DB Sync] 开始检查 ${offerIds.length} 个商品的价格...`);

                            for (let i = 0; i < offerIds.length; i += CHUNK) {
                                const chunk = offerIds.slice(i, i + CHUNK);
                                Utils.logger('info', `[Fab DB Sync] 检查价格批次 ${Math.floor(i / CHUNK) + 1}，包含 ${chunk.length} 个商品...`);

                                const prices = await API.checkItemsPrices(chunk);
                                Utils.logger('info', `[Fab DB Sync] 价格API返回了 ${prices.length} 个结果`);

                                prices.forEach(offer => {
                                    if (offer && typeof offer.price === 'number' && offer.price > 0) {
                                        nonFreeOfferIds.add(offer.offerId);
                                        Utils.logger('debug', `[Fab DB Sync] 发现付费商品: ${offer.offerId}, 价格: ${offer.price}`);
                                    } else if (offer) {
                                        Utils.logger('debug', `[Fab DB Sync] 发现免费商品: ${offer.offerId}, 价格: ${offer.price}`);
                                    }
                                });

                                // Gentle pacing to be safe
                                if (offerIds.length > i + CHUNK) {
                                    await new Promise(r => setTimeout(r, 150));
                                }
                            }

                            Utils.logger('info', `[Fab DB Sync] 价格检查完成，发现 ${nonFreeOfferIds.size} 个付费商品`);

                            if (nonFreeOfferIds.size > 0) {
                                const before = State.db.failed.length;
                                const removedItems = [];

                                State.db.failed = State.db.failed.filter(task => {
                                    const offerId = uidToOfferId.get(task.uid);
                                    const shouldRemove = offerId && nonFreeOfferIds.has(offerId);
                                    if (shouldRemove) {
                                        removedItems.push(`${task.name || task.uid} (${offerId})`);
                                    }
                                    // Remove only when we are sure it's not free (price > 0)
                                    return !offerId || !nonFreeOfferIds.has(offerId);
                                });

                                const removed = before - State.db.failed.length;
                                if (removed > 0) {
                                    dbUpdated = true;
                                    Utils.logger('info', `[Fab DB Sync] 从"失败"列表中移除了 ${removed} 个非免费商品:`);
                                    removedItems.forEach(item => Utils.logger('info', `  - ${item}`));
                                } else {
                                    Utils.logger('info', `[Fab DB Sync] 没有找到需要移除的付费商品`);
                                }
                            } else {
                                Utils.logger('info', `[Fab DB Sync] 没有发现付费商品，失败列表保持不变`);
                            }
                        } else {
                            Utils.logger('info', `[Fab DB Sync] 失败列表中的商品都没有找到价格ID，跳过价格检查`);
                        }
                    }
                } catch (e) {
                    Utils.logger('warn', `[Fab DB Sync] 检查失败项价格失败: ${e.message}`);
                }


                // Step 4: Update UI for visible cards
                const uidToCardMap = new Map([...document.querySelectorAll(Config.SELECTORS.card)]
                     .filter(isElementInViewport)
                     .map(card => {
                         const uid = card.querySelector(Config.SELECTORS.cardLink)?.href.match(/listings\/([a-f0-9-]+)/)?.[1];
                         return uid ? [uid, card] : null;
                     }).filter(Boolean));

                let updatedCount = 0;
                uidToCardMap.forEach((card, uid) => {
                    const isOwned = ownedUids.has(uid);

                    // 不再手动修改DOM元素，只更新计数
                    if (isOwned) {
                        updatedCount++;
                    }
                });

                if (dbUpdated) {
                    await Database.saveFailed();
                    await Database.saveDone();
                }

                Utils.logger('debug', `[Fab DOM Refresh] Complete. Updated ${updatedCount} visible card states.`);

                TaskRunner.runHideOrShow();

            } catch (e) {
                Utils.logger('error', '[Fab DOM Refresh] An error occurred:', e);
                alert(Utils.getText('error_api_refresh'));
            }
        },

        retryFailedTasks: async () => {
            if (State.db.failed.length === 0) {
                Utils.logger('info', Utils.getText('log_no_failed_tasks'));
                return;
            }
            const count = State.db.failed.length;
            Utils.logger('info', Utils.getText('log_requeuing_tasks', count));
            State.db.todo.push(...State.db.failed); // Append failed tasks to the end of the todo list
            State.db.failed = []; // Clear the failed list
            await Database.saveFailed();
            Utils.logger('info', `${count} tasks moved from Failed to To-Do list.`);
            UI.update(); // Force immediate UI update
        },

        // --- Core Logic Functions ---
        reconWithApi: async () => {
            if (!State.isReconning) return;

            try {
                // 不再主动发送API请求，而是使用网页原生请求的数据
                Utils.logger('info', `[优化] 不再主动发送API请求，而是使用网页原生请求的数据`);
                Utils.logger('info', `[优化] 当前等待列表中有 ${DataCache.waitingList.size} 个商品ID等待更新`);

                // 更新UI显示
                if (State.UI.reconProgressDisplay) {
                    State.UI.reconProgressDisplay.textContent = Utils.getText('using_native_requests', DataCache.waitingList.size);
                }

                // 结束扫描
                State.isReconning = false;
                await GM_deleteValue(Config.DB_KEYS.NEXT_URL);
                Utils.logger('info', Utils.getText('log_recon_end'));
                UI.update();
                return;




            } catch (error) {
                Utils.logger('error', `API扫描出错: ${error.message}`);
                if (error.message && error.message.includes('429')) {
                    Utils.logger('warn', '检测到429错误，可能是请求过于频繁。将暂停扫描。');
                    State.isReconning = false;
                }
                UI.update();
            }
        },

        // This is the watchdog timer that patrols for stalled workers.
        runWatchdog: () => {
            if (State.watchdogTimer) clearInterval(State.watchdogTimer); // Clear any existing timer

            State.watchdogTimer = setInterval(async () => {
                // 如果当前实例不是活跃实例，不执行监控
                if (!InstanceManager.isActive) return;

                if (!State.isExecuting || Object.keys(State.runningWorkers).length === 0) {
                    clearInterval(State.watchdogTimer);
                    State.watchdogTimer = null;
                    return;
                }

                const now = Date.now();
                const STALL_TIMEOUT = Config.WORKER_TIMEOUT; // 使用配置的超时时间
                const stalledWorkers = [];

                // 先收集所有超时的工作标签页，避免在循环中修改对象
                for (const workerId in State.runningWorkers) {
                    const workerInfo = State.runningWorkers[workerId];

                    // 只处理由当前实例创建的工作标签页
                    if (workerInfo.instanceId !== Config.INSTANCE_ID) continue;

                    if (now - workerInfo.startTime > STALL_TIMEOUT) {
                        stalledWorkers.push({
                            workerId,
                            task: workerInfo.task
                        });
                    }
                }

                // 如果有超时的工作标签页，处理它们
                if (stalledWorkers.length > 0) {
                    Utils.logger('warn', `发现 ${stalledWorkers.length} 个超时的工作标签页，正在清理...`);

                    // 逐个处理超时的工作标签页
                    for (const stalledWorker of stalledWorkers) {
                        const { workerId, task } = stalledWorker;

                        Utils.logger('error', `🚨 WATCHDOG: Worker [${workerId.substring(0,12)}] has stalled!`);

                        // 1. Remove from To-Do
                        State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
                        await Database.saveTodo();

                        // 2. Add to Failed
                        if (!State.db.failed.some(f => f.uid === task.uid)) {
                            State.db.failed.push(task);
                            await Database.saveFailed();
                        }
                        State.executionFailedTasks++;

                        // 3. Clean up worker
                        delete State.runningWorkers[workerId];
                        State.activeWorkers--;

                        // 删除任务数据
                        await GM_deleteValue(workerId);
                    }

                    Utils.logger('info', `已清理 ${stalledWorkers.length} 个超时的工作标签页。剩余活动工作标签页: ${State.activeWorkers}`);

                    // 4. Update UI
                    UI.update();

                    // 5. 延迟一段时间后继续派发任务
                    setTimeout(() => {
                        if (State.isExecuting && State.activeWorkers < Config.MAX_CONCURRENT_WORKERS && State.db.todo.length > 0) {
                        TaskRunner.executeBatch();
                    }
                    }, 2000);
                }
            }, 5000); // Check every 5 seconds
        },

        executeBatch: async () => {
            // 只有主页面才需要检查是否是活跃实例
            if (!State.isWorkerTab && !InstanceManager.isActive) {
                Utils.logger('warn', '当前实例不是活跃实例，不执行任务。');
                return;
            }

            if (!State.isExecuting) return;

            // 防止重复执行
            if (State.isDispatchingTasks) {
                Utils.logger('info', '正在派发任务中，请稍候...');
                return;
            }

            // 设置派发任务标志
            State.isDispatchingTasks = true;

            try {
            // Stop condition for the entire execution process
            if (State.db.todo.length === 0 && State.activeWorkers === 0) {
                Utils.logger('info', '✅ 🎉 All tasks have been completed!');
                State.isExecuting = false;
                    // 保存执行状态
                    Database.saveExecutingState();
                    // 保存待办列表（虽然为空，但仍需保存以更新存储）
                    Database.saveTodo();
                if (State.watchdogTimer) {
                    clearInterval(State.watchdogTimer);
                    State.watchdogTimer = null;
                }

                    // 关闭所有可能残留的工作标签页
                    TaskRunner.closeAllWorkerTabs();

                UI.update();
                    State.isDispatchingTasks = false;
                    return;
                }

                // 如果处于限速状态，记录日志但继续执行任务
                if (State.appStatus === 'RATE_LIMITED') {
                    Utils.logger('info', '当前处于限速状态，但仍将继续执行待办任务...');
                }

                // 限制最大活动工作标签页数量
                if (State.activeWorkers >= Config.MAX_CONCURRENT_WORKERS) {
                    Utils.logger('info', `已达到最大并发工作标签页数量 (${Config.MAX_CONCURRENT_WORKERS})，等待现有任务完成...`);
                    State.isDispatchingTasks = false;
                return;
            }

            // --- DISPATCHER FOR DETAIL TASKS ---
                // 创建一个当前正在执行的任务UID集合，用于防止重复派发
                const inFlightUIDs = new Set(Object.values(State.runningWorkers).map(w => w.task.uid));

                // 创建一个副本，避免在迭代过程中修改原数组
                const todoList = [...State.db.todo];
                let dispatchedCount = 0;

                // 创建一个集合，记录本次派发的任务UID
                const dispatchedUIDs = new Set();

                for (const task of todoList) {
                    if (State.activeWorkers >= Config.MAX_CONCURRENT_WORKERS) break;

                    // 如果任务已经在执行中，跳过
                    if (inFlightUIDs.has(task.uid) || dispatchedUIDs.has(task.uid)) {
                        Utils.logger('info', `任务 ${task.name} 已在执行中，跳过。`);
                        continue;
                    }

                    // 如果任务已经在完成列表中，从待办列表移除并跳过
                    if (Database.isDone(task.url)) {
                        Utils.logger('info', `任务 ${task.name} 已完成，从待办列表中移除。`);
                        State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);
                        Database.saveTodo();
                        continue;
                    }

                    // 记录本次派发的任务
                    dispatchedUIDs.add(task.uid);

                State.activeWorkers++;
                    dispatchedCount++;
                const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
                    State.runningWorkers[workerId] = {
                        task,
                        startTime: Date.now(),
                        instanceId: Config.INSTANCE_ID // 记录创建此工作标签页的实例ID
                    };

                Utils.logger('info', `🚀 Dispatching Worker [${workerId.substring(0, 12)}...] for: ${task.name}`);

                    await GM_setValue(workerId, {
                        task,
                        instanceId: Config.INSTANCE_ID // 在任务数据中也记录实例ID
                    });

                const workerUrl = new URL(task.url);
                workerUrl.searchParams.set('workerId', workerId);

                    // 使用active:false确保标签页在后台打开，并使用insert:true确保标签页在当前标签页之后打开
                    GM_openInTab(workerUrl.href, { active: false, insert: true });

                    // 等待一小段时间再派发下一个任务，避免浏览器同时打开太多标签页
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (dispatchedCount > 0) {
                    Utils.logger('info', `本批次派发了 ${dispatchedCount} 个任务。`);
                }

                if (!State.watchdogTimer && State.activeWorkers > 0) {
                    TaskRunner.runWatchdog();
                }

            UI.update();
            } finally {
                // 无论如何都要重置派发任务标志
                State.isDispatchingTasks = false;
            }
        },

        // 添加一个方法来关闭所有工作标签页
        closeAllWorkerTabs: () => {
            // 目前没有直接的方法可以关闭由GM_openInTab打开的标签页
            // 但我们可以清理相关的状态
            const workerIds = Object.keys(State.runningWorkers);
            if (workerIds.length > 0) {
                Utils.logger('info', `正在清理 ${workerIds.length} 个工作标签页的状态...`);

                for (const workerId of workerIds) {
                    GM_deleteValue(workerId);
                }

                State.runningWorkers = {};
                State.activeWorkers = 0;
                Utils.logger('info', '已清理所有工作标签页的状态。');
            }
        },

        processDetailPage: async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const workerId = urlParams.get('workerId');

            // If there's no workerId, this is not a worker tab, so we do nothing.
            if (!workerId) return;

            // 标记当前标签页为工作标签页，避免执行主脚本逻辑
            State.isWorkerTab = true;
            State.workerTaskId = workerId;

            // 记录工作标签页的启动时间
            const startTime = Date.now();
            let hasReported = false;
            let closeAttempted = false;

            // 设置一个定时器，确保工作标签页最终会关闭
            const forceCloseTimer = setTimeout(() => {
                if (!closeAttempted) {
                    console.log('强制关闭工作标签页');
                    try {
                        window.close();
                    } catch (e) {
                        console.error('关闭工作标签页失败:', e);
                    }
                }
            }, 60000); // 60秒后强制关闭

            try {
                // This is a safety check. If the main tab stops execution, it might delete the task.
                const payload = await GM_getValue(workerId);
                if (!payload || !payload.task) {
                    Utils.logger('info', '任务数据已被清理，工作标签页将关闭。');
                    closeWorkerTab();
                    return;
                }

                // 检查创建此工作标签页的实例ID是否与当前活跃实例一致
                const activeInstance = await GM_getValue('fab_active_instance', null);
                if (activeInstance && activeInstance.id !== payload.instanceId) {
                    Utils.logger('warn', `此工作标签页由实例 [${payload.instanceId}] 创建，但当前活跃实例是 [${activeInstance.id}]。将关闭此标签页。`);
                    await GM_deleteValue(workerId); // 清理任务数据
                    closeWorkerTab();
                    return;
                }

                const currentTask = payload.task;
                const logBuffer = [`[${workerId.substring(0, 12)}] Started: ${currentTask.name}`];
                let success = false;

                try {
                    // 等待页面加载完成
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // 执行页面状态诊断
                    logBuffer.push(`=== 页面状态诊断开始 ===`);
                    const diagnosticReport = PageDiagnostics.diagnoseDetailPage();

                    // 记录关键信息到日志缓冲区
                    logBuffer.push(`页面标题: ${diagnosticReport.pageTitle}`);
                    logBuffer.push(`可见按钮数量: ${diagnosticReport.buttons.filter(btn => btn.isVisible).length}`);

                    // 记录所有可见按钮
                    diagnosticReport.buttons.forEach(btn => {
                        if (btn.isVisible) {
                            logBuffer.push(`按钮: "${btn.text}" (禁用: ${btn.isDisabled})`);
                        }
                    });

                    // 记录价格信息
                    Object.entries(diagnosticReport.priceInfo).forEach(([, price]) => {
                        if (price.isVisible) {
                            logBuffer.push(`价格显示: "${price.text}"`);
                        }
                    });

                    // 记录许可选项
                    diagnosticReport.licenseOptions.forEach(opt => {
                        if (opt.isVisible) {
                            logBuffer.push(`许可选项: "${opt.text}"`);
                        }
                    });

                    logBuffer.push(`=== 页面状态诊断结束 ===`);
                    // API-First Ownership Check...
                    try {
                        const csrfToken = Utils.getCookie('fab_csrftoken');
                        if (!csrfToken) throw new Error("CSRF token not found for API check.");
                        const statesUrl = new URL('https://www.fab.com/i/users/me/listings-states');
                        statesUrl.searchParams.append('listing_ids', currentTask.uid);
                        const response = await API.gmFetch({
                            method: 'GET',
                            url: statesUrl.href,
                            headers: { 'x-csrftoken': csrfToken, 'x-requested-with': 'XMLHttpRequest' }
                        });

                        let statesData;
                        try {
                            statesData = JSON.parse(response.responseText);
                            if (!Array.isArray(statesData)) {
                                logBuffer.push('API返回的数据不是数组格式，这可能是API变更导致的');
                                // 尝试提取数组数据
                                statesData = API.extractStateData(statesData, 'SingleItemCheck');
                            }
                        } catch (e) {
                            logBuffer.push(`解析API响应失败: ${e.message}`);
                            statesData = [];
                        }

                        const isOwned = Array.isArray(statesData) && statesData.some(s => s && s.uid === currentTask.uid && s.acquired);
                        if (isOwned) {
                            logBuffer.push(`API check confirms item is already owned.`);
                            success = true;
                        } else {
                            logBuffer.push(`API check confirms item is not owned. Proceeding to UI interaction.`);
                        }
                    } catch (apiError) {
                        logBuffer.push(`API ownership check failed: ${apiError.message}. Falling back to UI-based check.`);
                    }

                    if (!success) {
                        try {
                            const isItemOwned = () => {
                                const criteria = Config.OWNED_SUCCESS_CRITERIA;
                                const snackbar = document.querySelector('.fabkit-Snackbar-root, div[class*="Toast-root"]');
                                if (snackbar && criteria.snackbarText.some(text => snackbar.textContent.includes(text))) return { owned: true, reason: `Snackbar text "${snackbar.textContent}"` };
                                const successHeader = document.querySelector('h2');
                                if (successHeader && criteria.h2Text.some(text => successHeader.textContent.includes(text))) return { owned: true, reason: `H2 text "${successHeader.textContent}"` };
                                const allButtons = [...document.querySelectorAll('button, a.fabkit-Button-root')];
                                const ownedButton = allButtons.find(btn => criteria.buttonTexts.some(keyword => btn.textContent.includes(keyword)));
                                if (ownedButton) return { owned: true, reason: `Button text "${ownedButton.textContent}"` };
                                return { owned: false };
                            };

                            const initialState = isItemOwned();
                            if (initialState.owned) {
                                logBuffer.push(`Item already owned on page load (UI Fallback PASS: ${initialState.reason}).`);
                                success = true;
                            } else {
                                // 检查是否需要选择许可证
                                const licenseButton = [...document.querySelectorAll('button')].find(btn =>
                                    btn.textContent.includes('选择许可') ||
                                    btn.textContent.includes('Select license')
                                );

                                if (licenseButton) {
                                    logBuffer.push(`Multi-license item detected. Setting up observer for dropdown.`);
                                    try {
                                        await new Promise((resolve, reject) => {
                                            const observer = new MutationObserver((mutationsList) => {
                                                for (const mutation of mutationsList) {
                                                    if (mutation.addedNodes.length > 0) {
                                                        for (const node of mutation.addedNodes) {
                                                            if (node.nodeType !== 1) continue;
                                                            // 查找"免费"或"个人"选项
                                                            const freeTextElement = Array.from(node.querySelectorAll('span, div')).find(el =>
                                                                Array.from(el.childNodes).some(cn => {
                                                                    if (cn.nodeType !== 3) return false;
                                                                    const text = cn.textContent.trim();
                                                                    return [...Config.FREE_TEXT_SET].some(freeWord => text === freeWord) ||
                                                                           text === '个人' || text === 'Personal';
                                                                })
                                                            );

                                                            if (freeTextElement) {
                                                                const clickableParent = freeTextElement.closest('[role="option"], button, label, input[type="radio"]');
                                                                if (clickableParent) {
                                                                    logBuffer.push(`Found free/personal license option, clicking it.`);
                                                                    Utils.deepClick(clickableParent);
                                                                    observer.disconnect();
                                                                    resolve();
                                                                    return;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            });

                                            observer.observe(document.body, { childList: true, subtree: true });
                                            logBuffer.push(`Clicking license button to open dropdown.`);
                                            Utils.deepClick(licenseButton); // First click attempt

                                            // 有时第一次点击可能不成功，1.5秒后再试一次
                                            setTimeout(() => {
                                                logBuffer.push(`Second attempt to click license button.`);
                                                Utils.deepClick(licenseButton);
                                            }, 1500);

                                            // 如果5秒内没有出现下拉菜单，则超时
                                            setTimeout(() => {
                                                observer.disconnect();
                                                reject(new Error('Timeout (5s): The free/personal option did not appear.'));
                                            }, 5000);
                                        });

                                        // 许可选择后等待UI更新
                                        logBuffer.push(`License selected, waiting for UI update.`);
                                        await new Promise(r => setTimeout(r, 1000));

                                        // 重新检查是否已拥有
                                        if (isItemOwned().owned) {
                                            logBuffer.push(`Item became owned after license selection.`);
                                            success = true;
                                        }
                                    } catch (licenseError) {
                                        logBuffer.push(`License selection failed: ${licenseError.message}`);
                                    }
                                }

                                // 如果许可选择后仍未成功，或者不需要选择许可，尝试点击添加按钮
                                if (!success) {
                                    // 首先尝试找标准的添加按钮
                                    let actionButton = [...document.querySelectorAll('button')].find(btn =>
                                        [...Config.ACQUISITION_TEXT_SET].some(keyword => btn.textContent.includes(keyword))
                                    );

                                    // 如果没有标准添加按钮，检查是否是限时免费商品
                                    if (!actionButton) {
                                        // 查找包含"免费/Free"和"-100%"的按钮（限时免费商品的许可按钮）
                                        actionButton = [...document.querySelectorAll('button')].find(btn => {
                                            const text = btn.textContent;
                                            const hasFreeText = [...Config.FREE_TEXT_SET].some(freeWord => text.includes(freeWord));
                                            const hasDiscount = text.includes('-100%');
                                            const hasPersonal = text.includes('个人') || text.includes('Personal');
                                            return hasFreeText && hasDiscount && hasPersonal;
                                        });

                                        if (actionButton) {
                                            logBuffer.push(`Found limited-time free license button: "${actionButton.textContent.trim()}"`);
                                        }
                                    }

                                    if (actionButton) {
                                        logBuffer.push(`Found add button, clicking it.`);
                                        Utils.deepClick(actionButton);

                                        // 等待添加操作完成
                                        try {
                                            await new Promise((resolve, reject) => {
                                                const timeout = 25000; // 25秒超时
                                                const interval = setInterval(() => {
                                                    const currentState = isItemOwned();
                                                    if (currentState.owned) {
                                                        logBuffer.push(`Item became owned after clicking add button: ${currentState.reason}`);
                                                        success = true;
                                                        clearInterval(interval);
                                                        resolve();
                                                    }
                                                }, 500); // 每500ms检查一次

                                                setTimeout(() => {
                                                    clearInterval(interval);
                                                    reject(new Error(`Timeout waiting for page to enter an 'owned' state.`));
                                                }, timeout);
                                            });
                                        } catch (timeoutError) {
                                            logBuffer.push(`Timeout waiting for ownership: ${timeoutError.message}`);
                                        }
                                    } else {
                                        logBuffer.push(`Could not find an add button.`);
                                    }
                                }
                            }
                        } catch (uiError) {
                            logBuffer.push(`UI interaction failed: ${uiError.message}`);
                        }
                    }
                } catch (error) {
                    logBuffer.push(`A critical error occurred: ${error.message}`);
                    success = false;
                } finally {
                    try {
                        // 标记为已报告
                        hasReported = true;

                        // 报告任务结果
                        await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                            workerId: workerId,
                            success: success,
                            logs: logBuffer,
                            task: currentTask,
                            instanceId: payload.instanceId,
                            executionTime: Date.now() - startTime
                        });
                    } catch (error) {
                        console.error('Error setting worker done value:', error);
                    }

                    try {
                        await GM_deleteValue(workerId); // 清理任务数据
                    } catch (error) {
                        console.error('Error deleting worker value:', error);
                    }

                    // 确保工作标签页在报告完成后关闭
                    closeWorkerTab();
                }
            } catch (error) {
                Utils.logger('error', `Worker tab error: ${error.message}`);
                closeWorkerTab();
            }

            // 关闭工作标签页的函数
            function closeWorkerTab() {
                closeAttempted = true;
                clearTimeout(forceCloseTimer);

                // 如果尚未报告结果，尝试报告失败
                if (!hasReported && workerId) {
                    try {
                        GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                            workerId: workerId,
                            success: false,
                            logs: [Utils.getText('worker_closed')],
                            task: payload?.task,
                            instanceId: payload?.instanceId,
                            executionTime: Date.now() - startTime
                        });
                    } catch (e) {
                        // 忽略错误
                    }
                }

                try {
                    window.close();
                } catch (error) {
                    Utils.logger('error', `关闭工作标签页失败: ${error.message}`);
                    // 如果关闭失败，尝试其他方法
                    try {
                        window.location.href = 'about:blank';
                    } catch (e) {
                        Utils.logger('error', `重定向失败: ${e.message}`);
                    }
                }
            }
        },

        // 删除这个未使用的函数
        // This function is now fully obsolete.
        // advanceDetailTask: async () => {},

            runHideOrShow: () => {
        // 无论是否在限速状态下，都应该执行隐藏功能
        State.hiddenThisPageCount = 0;
        const cards = document.querySelectorAll(Config.SELECTORS.card);

        // 添加一个计数器，用于跟踪实际隐藏的卡片数量
        let actuallyHidden = 0;

        // 首先检查是否有未加载完成的卡片
        let hasUnsettledCards = false;
        const unsettledCards = [];

        // 检查卡片是否已加载完成的函数
        const isCardSettled = (card) => {
            // 检查卡片是否有价格、免费标签或已拥有标签
            return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
        };

        // 检查是否有未加载完成的卡片
        cards.forEach(card => {
            if (!isCardSettled(card)) {
                hasUnsettledCards = true;
                unsettledCards.push(card);
            }
        });

        // 如果有未加载完成的卡片，延迟执行隐藏操作
        if (hasUnsettledCards && unsettledCards.length > 0) {
            Utils.logger('info', `检测到 ${unsettledCards.length} 张卡片尚未加载完成，延迟隐藏操作...`);

            // 设置一个较长的延迟，等待卡片加载完成
            setTimeout(() => {
                Utils.logger('info', `延迟后重新执行隐藏操作，确保卡片已加载完成`);
                TaskRunner.runHideOrShow();
            }, 2000); // 延迟2秒

            return; // 直接返回，等待下次执行
        }

        // 首先收集所有需要隐藏的卡片
        const cardsToHide = [];

        // 添加一个数据属性来标记已处理的卡片，避免重复处理
        cards.forEach(card => {
            // 检查卡片是否已经被处理过
            const isProcessed = card.getAttribute('data-fab-processed') === 'true';

            // 如果卡片已经被处理且已经隐藏，则不需要再次处理
            if (isProcessed && card.style.display === 'none') {
                State.hiddenThisPageCount++;
                return;
            }

            const isFinished = TaskRunner.isCardFinished(card);
            if (State.hideSaved && isFinished) {
                cardsToHide.push(card);
                State.hiddenThisPageCount++;

                // 标记卡片为已处理
                card.setAttribute('data-fab-processed', 'true');
            } else {
                // 如果不需要隐藏，也标记为已处理
                card.setAttribute('data-fab-processed', 'true');
            }
        });

        // 如果有需要隐藏的卡片，使用更长的初始延迟和更慢的隐藏速度
        if (cardsToHide.length > 0) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_prepare_hide', cardsToHide.length));
            }

            // 随机打乱卡片顺序，使隐藏更加随机
            cardsToHide.sort(() => Math.random() - 0.5);

            // 分批次隐藏卡片，每批次最多10张（减少批次大小）
            const batchSize = 10;
            const batches = Math.ceil(cardsToHide.length / batchSize);

            // 设置一个初始延迟，确保页面有足够时间加载
            const initialDelay = 1000; // 1秒的初始延迟

            for (let i = 0; i < batches; i++) {
                const start = i * batchSize;
                const end = Math.min(start + batchSize, cardsToHide.length);
                const currentBatch = cardsToHide.slice(start, end);

                // 为每个批次设置一个更长的延迟，增加延迟时间
                const batchDelay = initialDelay + i * 300 + Math.random() * 300;

                setTimeout(() => {
                    currentBatch.forEach((card, index) => {
                        // 为每张卡片设置一个更长的随机延迟
                        const cardDelay = index * 50 + Math.random() * 100;

                        setTimeout(() => {
                            card.style.display = 'none';
                            actuallyHidden++;

                            // 当所有卡片都隐藏后，更新UI
                            if (actuallyHidden === cardsToHide.length) {
                                if (State.debugMode) {
                                    Utils.logger('debug', Utils.getText('debug_hide_completed', actuallyHidden));
                                }
                                // 延迟更新UI，确保DOM已经完全更新
                                setTimeout(() => {
                                    UI.update();
                                    // 隐藏完成后检查可见性并决定是否刷新
                                    TaskRunner.checkVisibilityAndRefresh();
                                }, 300);
                            }
                        }, cardDelay);
                    });
                }, batchDelay);
            }
        }

        // 确保所有不应该隐藏的卡片都是可见的
        if (State.hideSaved) {
            // 找出所有不应该隐藏的卡片
            const visibleCards = Array.from(cards).filter(card => {
                // 不隐藏未完成的卡片
                return !TaskRunner.isCardFinished(card);
            });

            // 显示这些卡片（如果它们之前被隐藏了）
            visibleCards.forEach(card => {
                card.style.display = '';
            });

            // 只有在没有需要隐藏的卡片时才立即更新UI和检查可见性
            if (cardsToHide.length === 0) {
                UI.update();
                TaskRunner.checkVisibilityAndRefresh();
            }
        } else {
            // 如果没有隐藏功能，正常显示所有卡片并更新UI
            cards.forEach(card => {
                card.style.display = '';
            });
            UI.update();
        }
    },

    // 新增：检查可见性并决定是否刷新的方法
    checkVisibilityAndRefresh: () => {
        // 计算实际可见的商品数量
        const cards = document.querySelectorAll(Config.SELECTORS.card);

        // 重新检查所有卡片，确保隐藏状态正确
        let needsReprocessing = false;
        cards.forEach(card => {
            const isProcessed = card.getAttribute('data-fab-processed') === 'true';
            if (!isProcessed) {
                needsReprocessing = true;
            }
        });

        // 如果发现未处理的卡片，重新执行隐藏逻辑
        if (needsReprocessing) {
            if (State.debugMode) {
                Utils.logger('debug', Utils.getText('debug_unprocessed_cards_simple'));
            }
            setTimeout(() => {
                TaskRunner.runHideOrShow();
            }, 100);
            return;
        }

        // 使用更准确的方式检查元素是否可见
        const visibleCards = Array.from(cards).filter(card => {
            // 检查元素自身的display属性
            if (card.style.display === 'none') return false;

            // 检查是否被CSS规则隐藏
            const computedStyle = window.getComputedStyle(card);
            return computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
        }).length;

        // 更新真实的可见商品数量
        if (State.debugMode) {
            Utils.logger('debug', Utils.getText('debug_visible_after_hide', visibleCards, State.hiddenThisPageCount));
        }

        // 更新UI上显示的可见商品数
        const visibleCountElement = document.getElementById('fab-status-visible');
        if (visibleCountElement) {
            visibleCountElement.textContent = visibleCards.toString();
        }

        if (visibleCards === 0) {
            // 无可见商品，根据状态决定是否刷新
            if (State.appStatus === 'RATE_LIMITED' && State.autoRefreshEmptyPage) {
                // 如果已经安排了刷新，不要重复安排
                if (State.isRefreshScheduled) {
                    Utils.logger('info', Utils.getText('refresh_plan_exists').replace('(429自动恢复)', '(无商品可见)'));
                    return;
                }

                Utils.logger('info', '🔄 所有商品都已隐藏且处于限速状态，将在2秒后刷新页面...');

                // 标记已安排刷新
                State.isRefreshScheduled = true;

                setTimeout(() => {
                    // 再次检查实际可见的商品数量
                    const currentVisibleCards = Array.from(document.querySelectorAll(Config.SELECTORS.card))
                        .filter(card => card.style.display !== 'none').length;

                    // 检查是否有待办任务或活动工作线程
                    if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                        Utils.logger('info', `⏹️ 刷新取消，检测到 ${State.db.todo.length} 个待办任务和 ${State.activeWorkers} 个活动工作线程`);
                        State.isRefreshScheduled = false; // 重置刷新标记
                        return;
                    }

                    if (currentVisibleCards === 0 && State.appStatus === 'RATE_LIMITED' && State.autoRefreshEmptyPage) {
                        Utils.logger('info', '🔄 执行刷新...');
                        // 使用更可靠的刷新方式
                        window.location.href = window.location.href;
                    } else {
                        Utils.logger('info', `⏹️ 刷新取消，检测到 ${currentVisibleCards} 个可见商品`);
                        State.isRefreshScheduled = false; // 重置刷新标记
                    }
                }, 2000);
            } else if (State.appStatus === 'NORMAL' && State.hiddenThisPageCount > 0) {
                // 正常状态下也没有可见商品，可能是全部隐藏了
                // 只记录日志，不提示刷新，也不执行刷新
                Utils.logger('info', `👁️ 检测到页面上有 ${State.hiddenThisPageCount} 个隐藏商品，但没有可见商品`);
            }
        }
    },

        // 添加一个方法来检查并确保待办任务被执行
        ensureTasksAreExecuted: () => {
            // 如果没有待办任务，不需要执行
            if (State.db.todo.length === 0) return;

            // 如果已经在执行中，不需要重新启动
            if (State.isExecuting) {
                // 如果有待办任务但没有活动工作线程，可能是执行卡住了，尝试重新执行
                if (State.activeWorkers === 0) {
                    Utils.logger('info', '检测到有待办任务但没有活动工作线程，尝试重新执行...');
                    TaskRunner.executeBatch();
                }
                return;
            }

            // 如果有待办任务但没有执行，自动开始执行
            Utils.logger('info', `检测到有 ${State.db.todo.length} 个待办任务但未执行，自动开始执行...`);
            TaskRunner.startExecution();
        },

        // 添加一个方法来批量检查当前页面上所有可见卡片的状态
        checkVisibleCardsStatus: async () => {
            try {
                // 获取所有可见卡片
                const visibleCards = [...document.querySelectorAll(Config.SELECTORS.card)];

                // 如果没有可见卡片，直接返回
                if (visibleCards.length === 0) {
                    Utils.logger('info', '[Fab DOM Refresh] 没有可见的卡片需要刷新');
                    return;
                }

                // 首先检查是否有未加载完成的卡片
                let hasUnsettledCards = false;
                const unsettledCards = [];

                // 检查卡片是否已加载完成的函数
                const isCardSettled = (card) => {
                    // 检查卡片是否有价格、免费标签或已拥有标签
                    return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null;
                };

                // 检查是否有未加载完成的卡片
                visibleCards.forEach(card => {
                    if (!isCardSettled(card)) {
                        hasUnsettledCards = true;
                        unsettledCards.push(card);
                    }
                });

                // 如果有未加载完成的卡片，等待一段时间后再检查
                if (hasUnsettledCards && unsettledCards.length > 0) {
                    Utils.logger('info', `[Fab DOM Refresh] 检测到 ${unsettledCards.length} 张卡片尚未加载完成，等待加载...`);

                    // 等待一段时间后再次检查
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // 重新获取所有可见卡片
                    return TaskRunner.checkVisibleCardsStatus();
                }

                // 提取卡片的UID和DOM元素
                const allItems = [];
                let confirmedOwned = 0;

                visibleCards.forEach(card => {
                    const link = card.querySelector(Config.SELECTORS.cardLink);
                    const uidMatch = link?.href.match(/listings\/([a-f0-9-]+)/);

                    if (uidMatch && uidMatch[1]) {
                        const uid = uidMatch[1];
                        const url = link.href.split('?')[0]; // 移除查询参数

                        // 检查是否已经在已完成列表中
                        if (State.db.done.includes(url)) {
                            // 已经知道是已拥有的，不需要再次检查
                            return;
                        }

                        allItems.push({ uid, url, element: card });
                    }
                });

                // 如果没有需要检查的项目，直接返回
                if (allItems.length === 0) {
                    Utils.logger('debug', `[Fab DOM Refresh] ${Utils.getText('debug_no_cards_to_check')}`);
                    return;
                }

                Utils.logger('info', `[Fab DOM Refresh] ${Utils.getText('fab_dom_checking_status', allItems.length)}`);

                // 提取所有需要检查的商品ID
                const uids = allItems.map(item => item.uid);

                // 使用优化后的API函数检查拥有状态
                const statesData = await API.checkItemsOwnership(uids);

                // 创建已拥有商品ID的集合，便于快速查找
                const ownedUids = new Set(
                    statesData
                        .filter(state => state && state.acquired)
                        .map(state => state.uid)
                );

                // 处理结果
                for (const item of allItems) {
                    if (ownedUids.has(item.uid)) {
                        // 如果不在已完成列表中，添加
                        if (!State.db.done.includes(item.url)) {
                            State.db.done.push(item.url);
                            confirmedOwned++;

                            // 不再手动添加"已保存"标记，网页会自动更新
                        }

                        // 从失败列表中移除
                        State.db.failed = State.db.failed.filter(f => f.uid !== item.uid);

                        // 从待办列表中移除
                        State.db.todo = State.db.todo.filter(t => t.uid !== item.uid);
                    }
                }

                // 保存更改
                if (confirmedOwned > 0) {
                    await Database.saveDone();
                    await Database.saveFailed();
                    Utils.logger('info', `[Fab DOM Refresh] ${Utils.getText('fab_dom_api_complete', confirmedOwned)}`);

                    // 不立即执行隐藏，而是在调用方决定何时执行
                    Utils.logger('info', `[Fab DOM Refresh] Complete. Updated ${confirmedOwned} visible card states.`);
                } else {
                    Utils.logger('info', '[Fab DOM Refresh] API查询完成，没有发现新的已拥有项目。');
                }
            } catch (error) {
                Utils.logger('error', `[Fab DOM Refresh] 检查项目状态时出错: ${error.message}`);

                // 如果是429错误，进入限速状态并退出
                if (error.message && error.message.includes('429')) {
                    RateLimitManager.enterRateLimitedState('[Fab DOM Refresh] 429错误');
                }
            }
        },

                scanAndAddTasks: async (cards) => {
            // This function should ONLY ever run if auto-add is enabled.
            if (!State.autoAddOnScroll) return;

            // 创建一个状态追踪对象
            if (!window._apiWaitStatus) {
                window._apiWaitStatus = {
                    isWaiting: false,
                    pendingCards: [],
                    lastApiActivity: 0,
                    apiCheckInterval: null
                };
            }

            // 如果已经有等待过程在进行，将当前卡片加入队列
            if (window._apiWaitStatus.isWaiting) {
                window._apiWaitStatus.pendingCards = [...window._apiWaitStatus.pendingCards, ...cards];
                Utils.logger('info', `[自动添加] ${Utils.getText('debug_api_wait_in_progress', cards.length)}`);
                return;
            }

            // 标记开始等待API
            window._apiWaitStatus.isWaiting = true;
            window._apiWaitStatus.pendingCards = [...cards];
            window._apiWaitStatus.lastApiActivity = Date.now();

            if (State.debugMode) {
                Utils.logger('debug', `[自动添加] ${Utils.getText('debug_wait_api_response', cards.length)}`);
            }

            // 创建一个函数来检测API活动
            const waitForApiCompletion = () => {
                return new Promise((resolve) => {
                    // 清除之前的检查间隔
                    if (window._apiWaitStatus.apiCheckInterval) {
                        clearInterval(window._apiWaitStatus.apiCheckInterval);
                    }

                    // 设置一个最大等待时间（10秒）
                    const maxWaitTime = 10000;
                    const startTime = Date.now();

                    // 监听网络请求
                    const originalFetch = window.fetch;
                    window.fetch = function(...args) {
                        // 只关注商品状态相关的API请求
                        const url = args[0]?.toString() || '';
                        if (url.includes('/listings-states') || url.includes('/listings/search')) {
                            window._apiWaitStatus.lastApiActivity = Date.now();
                            Utils.logger('debug', `[API监控] 检测到API活动: ${url.substring(0, 50)}...`);
                        }
                        return originalFetch.apply(this, args);
                    };

                    // 检查API活动的间隔
                    window._apiWaitStatus.apiCheckInterval = setInterval(() => {
                        const now = Date.now();
                        const timeSinceLastActivity = now - window._apiWaitStatus.lastApiActivity;
                        const totalWaitTime = now - startTime;

                        // 如果超过最大等待时间，或者API活动停止超过2秒，则认为API已完成
                        if (totalWaitTime > maxWaitTime || timeSinceLastActivity > 2000) {
                            clearInterval(window._apiWaitStatus.apiCheckInterval);

                            // 恢复原始的fetch函数
                            window.fetch = originalFetch;

                            if (totalWaitTime > maxWaitTime) {
                                Utils.logger('warn', `[自动添加] API等待超时，已等待 ${totalWaitTime}ms，将继续处理卡片。`);
                            } else {
                                Utils.logger('debug', `[自动添加] ${Utils.getText('debug_api_stopped', timeSinceLastActivity)}`);
                            }

                            resolve();
                        }
                    }, 200); // 每200ms检查一次
                });
            };

            // 等待API完成
            try {
                await waitForApiCompletion();
            } catch (error) {
                Utils.logger('error', `[自动添加] 等待API时出错: ${error.message}`);
            }

            // 处理卡片
            const cardsToProcess = [...window._apiWaitStatus.pendingCards];
            window._apiWaitStatus.pendingCards = [];
            window._apiWaitStatus.isWaiting = false;

            if (State.debugMode) {
                Utils.logger('debug', `[自动添加] ${Utils.getText('debug_api_wait_complete', cardsToProcess.length)}`);
            }

            // 现在处理卡片
            const newlyAddedList = [];
            let skippedAlreadyOwned = 0;
            let skippedInTodo = 0;

            cardsToProcess.forEach(card => {
                const link = card.querySelector(Config.SELECTORS.cardLink);
                const url = link ? link.href.split('?')[0] : null;
                if (!url) return;

                // 1. 检查是否已经入库或在待办列表中
                // 更严格的检查，确保已入库的商品不会被添加到待办列表

                // 检查URL是否在完成列表中
                if (Database.isDone(url)) {
                    skippedAlreadyOwned++;
                    return;
                }

                // 检查URL是否在待办列表中
                if (Database.isTodo(url)) {
                    skippedInTodo++;
                    return;
                }

                // 检查卡片是否有"已保存"标记
                const text = card.textContent || '';
                if (text.includes("已保存在我的库中") ||
                    text.includes("已保存") ||
                    text.includes("Saved to My Library") ||
                    text.includes("In your library")) {
                    skippedAlreadyOwned++;
                    return;
                }

                // 检查卡片是否有成功图标
                const icons = card.querySelectorAll('i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled');
                if (icons.length > 0) {
                    skippedAlreadyOwned++;
                    return;
                }

                // 从链接中提取UID并检查缓存
                const uidMatch = url.match(/listings\/([a-f0-9-]+)/);
                if (uidMatch && uidMatch[1]) {
                    const uid = uidMatch[1];
                    // 检查缓存中是否标记为已拥有
                    if (DataCache.ownedStatus.has(uid)) {
                        const status = DataCache.ownedStatus.get(uid);
                        if (status && status.acquired) {
                            skippedAlreadyOwned++;
                            return;
                        }
                    }
                }

                // 2. Must be visibly "Free". This is the most critical filter.
                const isFree = card.querySelector(Config.SELECTORS.freeStatus) !== null;
                if (!isFree) {
                    return;
                }

                // If it passes all checks, it's a valid new task.
                const name = card.querySelector('a[aria-label*="创作的"], a[aria-label*="by "]')?.textContent.trim() || card.querySelector('a[href*="/listings/"]')?.textContent.trim() || Utils.getText('untitled');
                newlyAddedList.push({ name, url, type: 'detail', uid: url.split('/').pop() });
            });

            if (newlyAddedList.length > 0 || skippedAlreadyOwned > 0 || skippedInTodo > 0) {
                if (newlyAddedList.length > 0) {
                    State.db.todo.push(...newlyAddedList);
                    Utils.logger('info', `[自动添加] 新增 ${newlyAddedList.length} 个任务到队列。`);

                    // 保存待办列表到存储
                    Database.saveTodo();
                }

                // 添加详细的过滤信息日志
                if (skippedAlreadyOwned > 0 || skippedInTodo > 0) {
                    Utils.logger('debug', `[自动添加] ${Utils.getText('debug_filter_owned', skippedAlreadyOwned, skippedInTodo)}`);
                }

                // 如果已经在执行，只更新总数
                if (State.isExecuting) {
                    State.executionTotalTasks = State.db.todo.length;
                    // 确保任务继续执行
                    TaskRunner.executeBatch();
                } else if (State.autoAddOnScroll) {
                    // 如果启用了自动添加但尚未开始执行，自动开始执行
                    TaskRunner.startExecution();
                }

                UI.update();
            }
        },

        async handleRateLimit(url) {
            // 使用统一的限速管理器进入限速状态
            await RateLimitManager.enterRateLimitedState(url || '网络请求');
        },

        reportTaskDone: async (task, success) => {
            try {
                // 报告任务完成
                await GM_setValue(Config.DB_KEYS.WORKER_DONE, {
                    workerId: `worker_task_${task.uid}`,
                    success: success,
                    logs: [`任务${success ? '成功' : '失败'}: ${task.name || task.uid}`],
                    task: task,
                    instanceId: Config.INSTANCE_ID,
                    executionTime: 0
                });
                Utils.logger('info', `工作标签页报告任务${success ? '成功' : '失败'}: ${task.name || task.uid}`);
            } catch (error) {
                Utils.logger('error', `报告任务状态时出错: ${error.message}`);
            }
        },

        toggleAutoRefreshEmpty: async () => {
            if (State.isTogglingSetting) return;
            State.isTogglingSetting = true;

            State.autoRefreshEmptyPage = !State.autoRefreshEmptyPage;
            await Database.saveAutoRefreshEmptyPref();
            Utils.logger('info', `无商品可见时自动刷新功能已${State.autoRefreshEmptyPage ? '开启' : '关闭'}。`);

            setTimeout(() => { State.isTogglingSetting = false; }, 200);
        },
    };


    // --- 模块八: 用户界面 (User Interface) ---
    const UI = {
        create: () => {
            // New, more robust rule: A detail page is identified by the presence of a main "acquisition" button,
            // not by its URL, which can be inconsistent.
            const acquisitionButton = [...document.querySelectorAll('button')].find(btn =>
                [...Config.ACQUISITION_TEXT_SET].some(keyword => btn.textContent.includes(keyword))
            );

            // The "Download" button is another strong signal.
            const downloadTexts = ['下载', 'Download'];
            const downloadButton = [...document.querySelectorAll('a[href*="/download/"], button')].find(btn =>
                downloadTexts.some(text => btn.textContent.includes(text))
            );

            if (acquisitionButton || downloadButton) {
                 const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('workerId')) return false; // Explicitly return false for worker

                Utils.logger('info', "On a detail page (detected by action buttons), skipping UI creation.");
                return false; // Explicitly return false to halt further execution
            }

            if (document.getElementById(Config.UI_CONTAINER_ID)) return true; // Already created

            // --- Style Injection ---
            const styles = `
                :root {
                    --bg-color: rgba(28, 28, 30, 0.9);
                    --border-color: rgba(255, 255, 255, 0.15);
                    --text-color-primary: #f5f5f7;
                    --text-color-secondary: #a0a0a5;
                    --radius-l: 12px;
                    --radius-m: 8px;
                    --radius-s: 6px;
                    --blue: #007aff; --pink: #ff2d55; --green: #34c759;
                    --orange: #ff9500; --gray: #8e8e93; --dark-gray: #3a3a3c;
                    --blue-bg: rgba(0, 122, 255, 0.2);
                }
                #${Config.UI_CONTAINER_ID} {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: var(--bg-color);
                    backdrop-filter: blur(15px) saturate(1.8);
                    -webkit-backdrop-filter: blur(15px) saturate(1.8);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-l);
                    color: var(--text-color-primary);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    width: 300px;
                    font-size: 14px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                /* FINAL FIX: Apply a robust box model to all elements within the container */
                #${Config.UI_CONTAINER_ID} *, #${Config.UI_CONTAINER_ID} *::before, #${Config.UI_CONTAINER_ID} *::after {
                    box-sizing: border-box;
                }
                .fab-helper-tabs {
                    display: flex;
                    border-bottom: 1px solid var(--border-color);
                }
                .fab-helper-tabs button {
                    flex: 1;
                    padding: 10px 0;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    background: transparent;
                    border: none;
                    color: var(--text-color-secondary);
                    transition: color 0.2s, border-bottom 0.2s;
                    border-bottom: 2px solid transparent;
                    /* --- FIX: Center align tab text --- */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .fab-helper-tabs button.active {
                    color: var(--text-color-primary);
                    border-bottom: 2px solid var(--blue);
                }
                .fab-helper-tab-content {
                    padding: 12px;
                }
                .fab-helper-status-bar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    /* REMOVED: No longer needed at the bottom of the log */
                    /* margin-bottom: 12px; */
                }
                .fab-helper-status-item {
                    background: var(--dark-gray);
                    padding: 8px 6px;
                    border-radius: var(--radius-m);
                    font-size: 12px;
                    color: var(--text-color-secondary);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    gap: 2px;
                    min-width: 0;
                    flex-grow: 1;
                    /* This formula is now correct thanks to box-sizing: border-box */
                    flex-basis: calc((100% - 12px) / 3); /* (100% width - 2*6px gap) / 3 columns */
                }
                .fab-helper-status-label {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    white-space: nowrap;
                    /* REMOVED: No longer needed with a wrapping layout */
                }
                .fab-helper-status-item span {
                    display: block;
                    font-size: 18px;
                    font-weight: 600;
                    color: #fff;
                    margin-top: 0;
                }
                .fab-helper-execute-btn {
                    width: 100%;
                    border: none;
                    border-radius: var(--radius-m);
                    padding: 12px 14px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #fff;
                    background: var(--blue);
                    margin-bottom: 12px;
                    /* --- FIX: Center align button content --- */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px; /* Add space between icon and text */
                }
                .fab-helper-execute-btn.executing {
                    background: var(--pink);
                }
                .fab-helper-actions {
                    display: flex;
                    gap: 8px;
                }
                .fab-helper-actions button {
                    flex: 1; /* RESTORED: Distribute space equally */
                    min-width: 0; /* ADDED BACK: Crucial for flex shrinking */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    background: var(--dark-gray);
                    border: none;
                    border-radius: var(--radius-m);
                    color: var(--text-color-primary);
                    padding: 8px 6px; /* CRITICAL FIX: Reduced horizontal padding */
                    cursor: pointer;
                    transition: background-color 0.2s;
                    white-space: nowrap;
                    font-size: 13.5px;
                    font-weight: normal;
                }
                .fab-helper-actions button:hover {
                    background: #4a4a4c;
                }
                .fab-log-container {
                    padding: 0 12px 12px 12px;
                    /* FIX: Swapped border and margin from top to bottom */
                    border-bottom: 1px solid var(--border-color);
                    margin-bottom: 12px;
                }
                .fab-log-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    margin-top: 8px;
                }
                .fab-log-header span {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-color-secondary);
                }
                .fab-log-controls button {
                    background: transparent;
                    border: none;
                    color: var(--text-color-secondary);
                    cursor: pointer;
                    padding: 4px;
                    font-size: 18px;
                    line-height: 1;
                }
                #${Config.UI_LOG_ID} {
                    background: rgba(10,10,10,0.85);
                    color: #ddd;
                    font-size: 11px;
                    line-height: 1.4;
                    padding: 8px;
                    border-radius: var(--radius-m);
                    max-height: 150px;
                    overflow-y: auto;
                    min-height: 50px;
                    display: flex;
                    flex-direction: column-reverse;
                    box-shadow: inset 0 1px 4px rgba(0,0,0,0.2);
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.2);
                }

                /* 自定义滚动条样式 */
                #${Config.UI_LOG_ID}::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                #${Config.UI_LOG_ID}::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.2);
                    border-radius: 4px;
                }
                #${Config.UI_LOG_ID}::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.3);
                    border-radius: 4px;
                }
                #${Config.UI_LOG_ID}::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.5);
                }

                /* 添加状态周期历史记录的滚动条样式 */
                #${Config.UI_DEBUG_HISTORY_ID},
                .fab-debug-history-container {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.2);
                }

                #${Config.UI_DEBUG_HISTORY_ID}::-webkit-scrollbar,
                .fab-debug-history-container::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }

                #${Config.UI_DEBUG_HISTORY_ID}::-webkit-scrollbar-track,
                .fab-debug-history-container::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.2);
                    border-radius: 4px;
                }

                #${Config.UI_DEBUG_HISTORY_ID}::-webkit-scrollbar-thumb,
                .fab-debug-history-container::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.3);
                    border-radius: 4px;
                }

                #${Config.UI_DEBUG_HISTORY_ID}::-webkit-scrollbar-thumb:hover,
                .fab-debug-history-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.5);
                }
                @keyframes fab-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(0, 122, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0); }
                }
                .fab-helper-pulse {
                    animation: fab-pulse 2s infinite;
                }
                .fab-setting-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .fab-setting-row:last-child {
                    border-bottom: none;
                }
                .fab-setting-label {
                    font-size: 14px;
                }
                .fab-toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                .fab-toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .fab-toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: var(--dark-gray);
                    transition: .4s;
                    border-radius: 24px;
                }
                .fab-toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 20px;
                    width: 20px;
                    left: 2px;
                    bottom: 2px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }
                input:checked + .fab-toggle-slider {
                    background-color: var(--blue);
                }
                input:checked + .fab-toggle-slider:before {
                    transform: translateX(20px);
                }
            `;
            const styleSheet = document.createElement("style");
            // styleSheet.type = "text/css"; // 不再需要设置type属性
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);

            const container = document.createElement('div');
            container.id = Config.UI_CONTAINER_ID;
            State.UI.container = container;

            // --- Header with Version ---
            const header = document.createElement('div');
            header.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
            const title = document.createElement('span');
            title.textContent = Utils.getText('app_title');
            title.style.fontWeight = '600';
            const version = document.createElement('span');
            version.textContent = `v${GM_info.script.version}`;
            version.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); background: var(--dark-gray); padding: 2px 5px; border-radius: var(--radius-s);';
            header.append(title, version);
            container.appendChild(header);

            // --- Tab Controls ---
            const tabContainer = document.createElement('div');
            tabContainer.className = 'fab-helper-tabs';
            const tabs = ['dashboard', 'settings', 'debug'];
            tabs.forEach(tabName => {
                const btn = document.createElement('button');
                btn.textContent = Utils.getText(`tab_${tabName}`);
                btn.onclick = () => UI.switchTab(tabName);
                // 设置仪表盘标签为默认激活状态
                if (tabName === 'dashboard') {
                    btn.classList.add('active');
                }
                tabContainer.appendChild(btn);
                State.UI.tabs[tabName] = btn;
            });

            container.appendChild(tabContainer);

            // --- Dashboard Tab ---
            const dashboardContent = document.createElement('div');
            dashboardContent.className = 'fab-helper-tab-content';
            // 仪表盘标签页默认显示
            dashboardContent.style.display = 'block';
            State.UI.tabContents.dashboard = dashboardContent;

            const statusBar = document.createElement('div');
            statusBar.className = 'fab-helper-status-bar';

            const createStatusItem = (id, label, icon) => {
                const item = document.createElement('div');
                item.className = 'fab-helper-status-item';
                item.innerHTML = `<div class="fab-helper-status-label">${icon} ${label}</div><span id="${id}">0</span>`;
                return item;
            };
            State.UI.statusVisible = createStatusItem('fab-status-visible', Utils.getText('visible'), '👁️');
            State.UI.statusTodo = createStatusItem('fab-status-todo', Utils.getText('todo'), '📥');
            State.UI.statusDone = createStatusItem('fab-status-done', Utils.getText('added'), '✅');
            State.UI.statusFailed = createStatusItem('fab-status-failed', Utils.getText('failed'), '❌');
            State.UI.statusFailed.style.cursor = 'pointer';
            State.UI.statusFailed.title = Utils.getText('tooltip_open_failed');
            State.UI.statusFailed.onclick = () => {
                if (State.db.failed.length === 0) {
                    Utils.logger('info', '失败列表为空，无需操作。');
                    return;
                }
                if (window.confirm(Utils.getText('confirm_open_failed', State.db.failed.length))) {
                    Utils.logger('info', `正在打开 ${State.db.failed.length} 个失败项目...`);
                    State.db.failed.forEach(task => {
                        GM_openInTab(task.url, { active: false });
                    });
                }
            };
            State.UI.statusHidden = createStatusItem('fab-status-hidden', Utils.getText('hidden'), '🙈');
            statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed, State.UI.statusVisible, State.UI.statusHidden);

            State.UI.execBtn = document.createElement('button');
            State.UI.execBtn.className = 'fab-helper-execute-btn';
            State.UI.execBtn.onclick = TaskRunner.toggleExecution;

            // 根据State.isExecuting设置按钮初始状态
            if (State.isExecuting) {
                State.UI.execBtn.innerHTML = `<span>${Utils.getText('executing')}</span>`;
                State.UI.execBtn.classList.add('executing');
            } else {
                State.UI.execBtn.textContent = Utils.getText('execute');
                State.UI.execBtn.classList.remove('executing');
            }

            const actionButtons = document.createElement('div');
            actionButtons.className = 'fab-helper-actions';

            State.UI.syncBtn = document.createElement('button');
            State.UI.syncBtn.textContent = '🔄 ' + Utils.getText('sync');
            State.UI.syncBtn.onclick = TaskRunner.refreshVisibleStates;

            State.UI.hideBtn = document.createElement('button');
            State.UI.hideBtn.onclick = TaskRunner.toggleHideSaved;

            actionButtons.append(State.UI.syncBtn, State.UI.hideBtn);

            // --- Log Panel (created before other elements to be appended first) ---
            const logContainer = document.createElement('div');
            logContainer.className = 'fab-log-container';

            const logHeader = document.createElement('div');
            logHeader.className = 'fab-log-header';
            const logTitle = document.createElement('span');
            logTitle.textContent = Utils.getText('operation_log');
            const logControls = document.createElement('div');
            logControls.className = 'fab-log-controls';

            const copyLogBtn = document.createElement('button');
            copyLogBtn.innerHTML = '📄';
            copyLogBtn.title = Utils.getText('copyLog');
            copyLogBtn.onclick = () => {
                navigator.clipboard.writeText(State.UI.logPanel.innerText).then(() => {
                    const originalText = copyLogBtn.textContent;
                    copyLogBtn.textContent = '✅';
                    setTimeout(() => { copyLogBtn.textContent = originalText; }, 1500);
                }).catch(err => Utils.logger('error', 'Failed to copy log:', err));
            };

            const clearLogBtn = document.createElement('button');
            clearLogBtn.innerHTML = '🗑️';
            clearLogBtn.title = Utils.getText('clearLog');
            clearLogBtn.onclick = () => { State.UI.logPanel.innerHTML = ''; };

            logControls.append(copyLogBtn, clearLogBtn);
            logHeader.append(logTitle, logControls);

            State.UI.logPanel = document.createElement('div');
            State.UI.logPanel.id = Config.UI_LOG_ID;

            logContainer.append(logHeader, State.UI.logPanel);

            // 添加当前保存的浏览位置显示
            const positionContainer = document.createElement('div');
            positionContainer.className = 'fab-helper-position-container';
            positionContainer.style.cssText = 'margin: 8px 0; padding: 6px 8px; background-color: rgba(0,0,0,0.05); border-radius: 4px; font-size: 13px;';

            const positionIcon = document.createElement('span');
            positionIcon.textContent = Utils.getText('position_indicator');
            positionIcon.style.marginRight = '4px';

            const positionInfo = document.createElement('span');
            positionInfo.textContent = Utils.decodeCursor(State.savedCursor);

            // 保存引用以便后续更新
            State.UI.savedPositionDisplay = positionInfo;

            positionContainer.appendChild(positionIcon);
            positionContainer.appendChild(positionInfo);

            // Reorder elements for the new layout: Log first, then position, status, then buttons
            dashboardContent.append(logContainer, positionContainer, statusBar, State.UI.execBtn, actionButtons);

            container.appendChild(dashboardContent);

            // --- Settings Tab ---
            const settingsContent = document.createElement('div');
            settingsContent.className = 'fab-helper-tab-content';

            const createSettingRow = (labelText, stateKey) => {
                const row = document.createElement('div');
                row.className = 'fab-setting-row';

                const label = document.createElement('span');
                label.className = 'fab-setting-label';
                label.textContent = labelText;

                const switchContainer = document.createElement('label');
                switchContainer.className = 'fab-toggle-switch';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = State[stateKey];
                input.onchange = (e) => {
                    // Stop the event from doing anything weird, just in case.
                    e.stopPropagation();
                    e.preventDefault();

                    if(stateKey === 'autoAddOnScroll') {
                        TaskRunner.toggleAutoAdd();
                    } else if (stateKey === 'rememberScrollPosition') {
                        TaskRunner.toggleRememberPosition();
                    } else if (stateKey === 'autoResumeAfter429') {
                        TaskRunner.toggleAutoResume();
                    } else if (stateKey === 'autoRefreshEmptyPage') {
                        TaskRunner.toggleAutoRefreshEmpty();
                    }
                    // Manually sync the visual state of the checkbox since we prevented default action
                    e.target.checked = State[stateKey];
                };

                const slider = document.createElement('span');
                slider.className = 'fab-toggle-slider';

                switchContainer.append(input, slider);
                row.append(label, switchContainer);

                // 所有设置行都使用相同的布局
                row.appendChild(label);
                row.appendChild(switchContainer);

                return row;
            };

            const autoAddSetting = createSettingRow(Utils.getText('setting_auto_add_scroll'), 'autoAddOnScroll');
            settingsContent.appendChild(autoAddSetting);

            const rememberPosSetting = createSettingRow(Utils.getText('setting_remember_position'), 'rememberScrollPosition');
            settingsContent.appendChild(rememberPosSetting);

            const autoResumeSetting = createSettingRow(Utils.getText('setting_auto_resume_429'), 'autoResumeAfter429');
            settingsContent.appendChild(autoResumeSetting);

            const autoRefreshEmptySetting = createSettingRow(Utils.getText('setting_auto_refresh'), 'autoRefreshEmptyPage');
            settingsContent.appendChild(autoRefreshEmptySetting);

            const resetButton = document.createElement('button');
            resetButton.textContent = Utils.getText('clear_all_data');
            resetButton.style.cssText = 'width: 100%; margin-top: 15px; background-color: var(--pink); color: white; padding: 10px; border-radius: var(--radius-m); border: none; cursor: pointer;';
            resetButton.onclick = Database.resetAllData;
            settingsContent.appendChild(resetButton);

            // 添加调试模式切换按钮 - 使用自定义行而不是createSettingRow
            const debugModeRow = document.createElement('div');
            debugModeRow.className = 'fab-setting-row';
            debugModeRow.title = Utils.getText('setting_debug_tooltip');

            const debugLabel = document.createElement('span');
            debugLabel.className = 'fab-setting-label';
            debugLabel.textContent = Utils.getText('debug_mode');
            debugLabel.style.color = '#ff9800';

            const switchContainer = document.createElement('label');
            switchContainer.className = 'fab-toggle-switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = State.debugMode;
            input.onchange = (e) => {
                State.debugMode = e.target.checked;
                debugModeRow.classList.toggle('active', State.debugMode);
                Utils.logger('info', `调试模式已${State.debugMode ? '开启' : '关闭'}。${State.debugMode ? '将显示详细日志信息' : ''}`);
                GM_setValue('fab_helper_debug_mode', State.debugMode);
            };

            const slider = document.createElement('span');
            slider.className = 'fab-toggle-slider';

            switchContainer.append(input, slider);
            debugModeRow.append(debugLabel, switchContainer);
            debugModeRow.classList.toggle('active', State.debugMode);
            settingsContent.appendChild(debugModeRow);

                            // 排序选择已移除，改为自动从URL获取

              State.UI.tabContents.settings = settingsContent;
              container.appendChild(settingsContent);

            // 确保设置标签页默认隐藏
            settingsContent.style.display = 'none';

            // --- 调试标签页 ---
            const debugContent = document.createElement('div');
            debugContent.className = 'fab-helper-tab-content';
            // 确保调试标签页默认隐藏
            debugContent.style.display = 'none';
            // 初始化调试内容容器
            State.UI.debugContent = debugContent;

            const debugHeader = document.createElement('div');
            debugHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';

            const debugTitle = document.createElement('h4');
            debugTitle.textContent = Utils.getText('status_history');
            debugTitle.style.margin = '0';

            const debugControls = document.createElement('div');
            debugControls.style.cssText = 'display: flex; gap: 8px;';

            const copyHistoryBtn = document.createElement('button');
            copyHistoryBtn.textContent = Utils.getText('copy_btn');
            copyHistoryBtn.title = '复制详细历史记录';
            copyHistoryBtn.style.cssText = 'background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;';
            copyHistoryBtn.onclick = () => {
                if (State.statusHistory.length === 0) {
                    Utils.logger('info', '没有历史记录可供复制。');
                    return;
                }
                const formatEntry = (entry) => {
                    const date = new Date(entry.endTime).toLocaleString();

                    if (entry.type === 'STARTUP') {
                        return `🚀 ${Utils.getText('script_startup')}\n  - ${Utils.getText('time_label')}: ${date}\n  - ${Utils.getText('info_label')}: ${entry.message || ''}`;
                    } else {
                        const type = entry.type === 'NORMAL' ? `✅ ${Utils.getText('normal_period')}` : `🚨 ${Utils.getText('rate_limited_period')}`;
                        // 添加空值检查，防止toFixed错误
                        let details = `${Utils.getText('duration_label')}: ${entry.duration !== undefined && entry.duration !== null ? entry.duration.toFixed(2) : Utils.getText('unknown_duration')}s`;
                        if (entry.requests !== undefined) {
                            details += `, ${Utils.getText('requests_label')}: ${entry.requests}${Utils.getText('requests_unit')}`;
                        }
                        return `${type}\n  - ${Utils.getText('ended_at')}: ${date}\n  - ${details}`;
                    }
                };
                const fullLog = State.statusHistory.map(formatEntry).join('\n\n');
                navigator.clipboard.writeText(fullLog).then(() => {
                    const originalText = copyHistoryBtn.textContent;
                    copyHistoryBtn.textContent = Utils.getText('copied_success');
                    setTimeout(() => { copyHistoryBtn.textContent = originalText; }, 2000);
                }).catch(err => Utils.logger('error', Utils.getText('log_copy_failed'), err));
            };

            const clearHistoryBtn = document.createElement('button');
            clearHistoryBtn.textContent = Utils.getText('clear_btn');
            clearHistoryBtn.title = '清空历史记录';
            clearHistoryBtn.style.cssText = 'background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;';
            clearHistoryBtn.onclick = async () => {
                if (window.confirm(Utils.getText('confirm_clear_history'))) {
                    State.statusHistory = [];
                    await GM_deleteValue(Config.DB_KEYS.STATUS_HISTORY);

                    // 添加一个新的"当前会话"记录
                    const currentSessionEntry = {
                        type: 'STARTUP',
                        duration: 0,
                        endTime: new Date().toISOString(),
                        message: '历史记录已清空，新会话开始'
                    };
                    await RateLimitManager.addToHistory(currentSessionEntry);

                    UI.updateDebugTab();
                    Utils.logger('info', '状态历史记录已清空。');
                }
            };

            // 添加页面诊断按钮
            const diagnosisBtn = document.createElement('button');
            diagnosisBtn.textContent = Utils.getText('page_diagnosis');
            diagnosisBtn.className = 'fab-helper-btn';
            diagnosisBtn.style.cssText = 'margin-left: 10px; background: #2196F3; color: white;';
            diagnosisBtn.onclick = () => {
                try {
                    const report = PageDiagnostics.diagnoseDetailPage();
                    PageDiagnostics.logDiagnosticReport(report);
                    Utils.logger('info', '页面诊断完成，请查看控制台输出');
                } catch (error) {
                    Utils.logger('error', `页面诊断失败: ${error.message}`);
                }
            };

            debugControls.append(copyHistoryBtn, clearHistoryBtn, diagnosisBtn);
            debugHeader.append(debugTitle, debugControls);

            const historyListContainer = document.createElement('div');
            historyListContainer.style.cssText = 'max-height: 250px; overflow-y: auto; background: rgba(10,10,10,0.85); color: #ddd; padding: 8px; border-radius: var(--radius-m);';
            historyListContainer.className = 'fab-debug-history-container';
            // 将historyListContainer保存为State.UI.historyContainer，而不是debugContent
            State.UI.historyContainer = historyListContainer;

            debugContent.append(debugHeader, historyListContainer);
            State.UI.tabContents.debug = debugContent;
            // 确保调试标签页默认隐藏
            debugContent.style.display = 'none';
            container.appendChild(debugContent);

            document.body.appendChild(container);

            // --- BUG FIX: Explicitly return true on successful creation ---
            return true;
        },

        update: () => {
            if (!State.UI.container) return;

            // --- Update Static Text Elements (for language switching) ---
            // 更新应用标题
            const titleElement = State.UI.container.querySelector('span[style*="font-weight: 600"]');
            if (titleElement) {
                titleElement.textContent = Utils.getText('app_title');
            }

            // 更新标签页文本
            const tabs = ['dashboard', 'settings', 'debug'];
            tabs.forEach((tabName) => {
                const tabButton = State.UI.tabs[tabName];
                if (tabButton) {
                    tabButton.textContent = Utils.getText(`tab_${tabName}`);
                }
            });

            // 更新同步按钮文本
            if (State.UI.syncBtn) {
                State.UI.syncBtn.textContent = '🔄 ' + Utils.getText('sync');
            }

            // --- Update Status Numbers ---
            const todoCount = State.db.todo.length;
            const doneCount = State.db.done.length;
            const failedCount = State.db.failed.length;
            const visibleCount = document.querySelectorAll(Config.SELECTORS.card).length - State.hiddenThisPageCount;

            State.UI.statusTodo.querySelector('span').textContent = todoCount;
            State.UI.statusDone.querySelector('span').textContent = doneCount;
            State.UI.statusFailed.querySelector('span').textContent = failedCount;
            State.UI.statusHidden.querySelector('span').textContent = State.hiddenThisPageCount;
            State.UI.statusVisible.querySelector('span').textContent = visibleCount;

            // --- Update Button States ---
            // 确保按钮状态与State.isExecuting一致
            if (State.isExecuting) {
                State.UI.execBtn.innerHTML = `<span>${Utils.getText('executing')}</span>`;
                State.UI.execBtn.classList.add('executing');
                // 添加提示信息，显示当前执行状态
                if (State.executionTotalTasks > 0) {
                    const progress = State.executionCompletedTasks + State.executionFailedTasks;
                    const percentage = Math.round((progress / State.executionTotalTasks) * 100);
                    State.UI.execBtn.title = Utils.getText('tooltip_executing_progress', progress, State.executionTotalTasks, percentage);
                } else {
                    State.UI.execBtn.title = Utils.getText('tooltip_executing');
                }
            } else {
                State.UI.execBtn.textContent = Utils.getText('execute');
                State.UI.execBtn.classList.remove('executing');
                State.UI.execBtn.title = Utils.getText('tooltip_start_tasks');
            }

            State.UI.hideBtn.textContent = (State.hideSaved ? '🙈 ' : '👁️ ') + (State.hideSaved ? Utils.getText('show') : Utils.getText('hide'));
        },
        removeAllOverlays: () => {
            document.querySelectorAll(Config.SELECTORS.card).forEach(card => {
                const overlay = card.querySelector('.fab-helper-overlay');
                if (overlay) overlay.remove();
                card.style.opacity = '1';
            });
        },
        switchTab: (tabName) => {
            for (const name in State.UI.tabs) {
                State.UI.tabs[name].classList.toggle('active', name === tabName);
                State.UI.tabContents[name].style.display = name === tabName ? 'block' : 'none';
            }
        },
        updateDebugTab: () => {
            // 使用historyContainer而不是debugContent
            if (!State.UI.historyContainer) return;
            State.UI.historyContainer.innerHTML = ''; // Clear previous entries

            // 创建历史记录项
            const createHistoryItem = (entry) => {
                const item = document.createElement('div');
                item.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border-color);';

                const header = document.createElement('div');
                header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';

                let icon, color, titleText;

                if (entry.type === 'STARTUP') {
                    icon = '🚀';
                    color = 'var(--blue)';
                    titleText = Utils.getText('script_startup');
                } else if (entry.type === 'NORMAL') {
                    icon = '✅';
                    color = 'var(--green)';
                    titleText = Utils.getText('normal_period');
                } else { // RATE_LIMITED
                    icon = '🚨';
                    color = 'var(--orange)';
                    titleText = Utils.getText('rate_limited_period');
                }

                header.innerHTML = `<span style="font-size: 18px;">${icon}</span> <strong style="color: ${color};">${titleText}</strong>`;

                const details = document.createElement('div');
                details.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;';

                let detailsHtml = '';

                if (entry.type === 'STARTUP') {
                    detailsHtml = `<div>时间: ${new Date(entry.endTime).toLocaleString()}</div>`;
                    if (entry.message) {
                        detailsHtml += `<div>信息: <strong>${entry.message}</strong></div>`;
                    }
                } else {
                    // 添加空值检查，防止toFixed错误
                    const duration = entry.duration !== undefined && entry.duration !== null ?
                        entry.duration.toFixed(2) : '未知';
                    detailsHtml = `<div>持续时间: <strong>${duration}s</strong></div>`;
                    if (entry.requests !== undefined) {
                        detailsHtml += `<div>期间请求数: <strong>${entry.requests}</strong></div>`;
                    }
                    // 添加空值检查，防止日期错误
                    const endTime = entry.endTime ? new Date(entry.endTime).toLocaleString() : '未知时间';
                    detailsHtml += `<div>结束于: ${endTime}</div>`;
                }

                details.innerHTML = detailsHtml;

                item.append(header, details);
                return item;
            };

            // 创建当前状态项（即使没有历史记录也会显示）
            const createCurrentStatusItem = () => {
                if(State.appStatus === 'NORMAL' || State.appStatus === 'RATE_LIMITED') {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding: 8px; border-bottom: 1px solid var(--border-color); background: var(--blue-bg);';

                    const header = document.createElement('div');
                    header.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';

                    const icon = State.appStatus === 'NORMAL' ? '✅' : '🚨';
                    const color = State.appStatus === 'NORMAL' ? 'var(--green)' : 'var(--orange)';
                    const titleText = State.appStatus === 'NORMAL' ? Utils.getText('current_normal') : Utils.getText('current_rate_limited');

                    header.innerHTML = `<span style="font-size: 18px;">${icon}</span> <strong style="color: ${color};">${titleText}</strong>`;

                    const details = document.createElement('div');
                    details.style.cssText = 'font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;';

                    const startTime = State.appStatus === 'NORMAL' ? State.normalStartTime : State.rateLimitStartTime;
                    // 添加空值检查，防止startTime为null或undefined
                    const duration = startTime ? ((Date.now() - startTime) / 1000).toFixed(2) : '未知';

                    let detailsHtml = `<div>已持续: <strong>${duration}s</strong></div>`;
                    if (State.appStatus === 'NORMAL') {
                         detailsHtml += `<div>期间请求数: <strong>${State.successfulSearchCount}</strong></div>`;
                    }
                     // 添加空值检查，防止startTime为null
                     const startTimeDisplay = startTime ? new Date(startTime).toLocaleString() : '未知时间';
                     detailsHtml += `<div>开始于: ${startTimeDisplay}</div>`;
                    details.innerHTML = detailsHtml;

                    item.append(header, details);
                    State.UI.historyContainer.appendChild(item);
                }
            };

            // 添加当前状态项（始终显示）
            createCurrentStatusItem();

            // 如果没有历史记录，显示提示信息
            if (State.statusHistory.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.style.cssText = 'color: #888; text-align: center; padding: 20px;';
                emptyMessage.textContent = Utils.getText('no_history');
                State.UI.historyContainer.appendChild(emptyMessage);
                return;
            }

            // 显示历史记录（如果有）
            const reversedHistory = [...State.statusHistory].reverse();
            reversedHistory.forEach(entry => State.UI.historyContainer.appendChild(createHistoryItem(entry)));
        },
    };


    // --- 模块九: 主程序与初始化 (Main & Initialization) ---
    const InstanceManager = {
        isActive: false,
        lastPingTime: 0,
        pingInterval: null,

        // 初始化实例管理
        init: async function() {
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
                    Utils.logger('info', `当前是搜索页面，实例 [${Config.INSTANCE_ID}] 已激活。`);

                    // 启动ping机制，每3秒更新一次活跃状态
                    this.pingInterval = setInterval(() => this.ping(), 3000);
                    return true;
                }

                // 如果是工作标签页，检查是否有活跃实例
                const activeInstance = await GM_getValue('fab_active_instance', null);
                const currentTime = Date.now();

                if (activeInstance && (currentTime - activeInstance.lastPing < 10000)) {
                    // 如果有活跃实例且在10秒内有ping，则当前实例不活跃
                    Utils.logger('info', `检测到活跃的脚本实例 [${activeInstance.id}]，当前工作标签页将与之协作。`);
                    this.isActive = false;
                    return true; // 工作标签页也返回true，因为它需要执行自己的任务
                } else {
                    // 没有活跃实例或实例超时，当前实例成为活跃实例
                    this.isActive = true;
                    await this.registerAsActive();
                    Utils.logger('info', `没有检测到活跃实例，当前实例 [${Config.INSTANCE_ID}] 已激活。`);

                    // 启动ping机制，每3秒更新一次活跃状态
                    this.pingInterval = setInterval(() => this.ping(), 3000);
                    return true;
                }
            } catch (error) {
                Utils.logger('error', `实例管理初始化失败: ${error.message}`);
                // 出错时默认为活跃，避免脚本不工作
                this.isActive = true;
                return true;
            }
        },

        // 注册为活跃实例
        registerAsActive: async function() {
            await GM_setValue('fab_active_instance', {
                id: Config.INSTANCE_ID,
                lastPing: Date.now()
            });
        },

        // 定期更新活跃状态
        ping: async function() {
            if (!this.isActive) return;

            this.lastPingTime = Date.now();
            await this.registerAsActive();
        },

        // 检查是否可以接管
        checkTakeover: async function() {
            if (this.isActive) return;

            try {
                const activeInstance = await GM_getValue('fab_active_instance', null);
                const currentTime = Date.now();

                if (!activeInstance || (currentTime - activeInstance.lastPing > 10000)) {
                    // 如果没有活跃实例或实例超时，接管
                    this.isActive = true;
                    await this.registerAsActive();
                    Utils.logger('info', `之前的实例不再活跃，当前实例 [${Config.INSTANCE_ID}] 已接管。`);

                    // 启动ping机制
                    this.pingInterval = setInterval(() => this.ping(), 3000);

                    // 刷新页面以确保正确加载
                    location.reload();
                    } else {
                    // 继续等待
                    setTimeout(() => this.checkTakeover(), 5000);
                    }
            } catch (error) {
                Utils.logger('error', `接管检查失败: ${error.message}`);
                // 5秒后重试
                setTimeout(() => this.checkTakeover(), 5000);
            }
        },

        // 清理实例
        cleanup: function() {
            if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
            }
        }
    };

    async function main() {
        // 记录页面加载时间
        window.pageLoadTime = Date.now();

        Utils.logger('info', '脚本开始运行...');
        Utils.detectLanguage();

        // 检查是否是工作标签页
        const urlParams = new URLSearchParams(window.location.search);
        const workerId = urlParams.get('workerId');
        if (workerId) {
            // 如果是工作标签页，只执行工作标签页的逻辑，不执行主脚本逻辑
            State.isWorkerTab = true;
            State.workerTaskId = workerId;

            // 初始化实例管理，但不检查返回值，工作标签页总是需要执行自己的任务
            await InstanceManager.init();
            Utils.logger('info', `工作标签页初始化完成，开始处理任务...`);
            await TaskRunner.processDetailPage();
            return;
        }

        // 初始化实例管理
        await InstanceManager.init();

        // 主页面总是继续执行，不需要检查isActiveInstance
        await Database.load();

        // 确保执行状态与存储状态一致
        const storedExecutingState = await GM_getValue(Config.DB_KEYS.IS_EXECUTING, false);
        if (State.isExecuting !== storedExecutingState) {
            Utils.logger('info', `执行状态不一致，从存储中恢复：${storedExecutingState ? '执行中' : '已停止'}`);
            State.isExecuting = storedExecutingState;
        }

        // 从存储中恢复限速状态
        const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
        if (persistedStatus && persistedStatus.status === 'RATE_LIMITED') {
            State.appStatus = 'RATE_LIMITED';
            State.rateLimitStartTime = persistedStatus.startTime;
            // 添加空值检查，防止persistedStatus.startTime为null
            const previousDuration = persistedStatus && persistedStatus.startTime ?
                ((Date.now() - persistedStatus.startTime) / 1000).toFixed(2) : '0.00';
            Utils.logger('warn', `脚本启动时处于限速状态。限速已持续至少 ${previousDuration}s，来源: ${persistedStatus.source || '未知'}`);
        }

        // 初始化请求拦截器
        setupRequestInterceptors();

        await PagePatcher.init();

        // 检查是否有临时保存的待办任务（从429恢复）
        const tempTasks = await GM_getValue('temp_todo_tasks', null);
        if (tempTasks && tempTasks.length > 0) {
            Utils.logger('info', `从429恢复：找到 ${tempTasks.length} 个临时保存的待办任务，正在恢复...`);
            State.db.todo = tempTasks;
            await GM_deleteValue('temp_todo_tasks'); // 清除临时存储
        }

        // 添加工作标签页完成任务的监听器
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.WORKER_DONE, async (key, oldValue, newValue) => {
            if (!newValue) return; // 如果值被删除，忽略此事件

            try {
                // 删除值，防止重复处理
                await GM_deleteValue(Config.DB_KEYS.WORKER_DONE);

                const { workerId, success, task, logs, instanceId, executionTime } = newValue;

                // 检查是否由当前实例处理
                if (instanceId !== Config.INSTANCE_ID) {
                    Utils.logger('info', `收到来自其他实例 [${instanceId}] 的工作报告，当前实例 [${Config.INSTANCE_ID}] 将忽略。`);
             return;
        }

                if (!workerId || !task) {
                    Utils.logger('error', '收到无效的工作报告。缺少workerId或task。');
                    return;
                }

                // 记录执行时间（如果有）
                if (executionTime) {
                    // 添加空值检查，防止executionTime为null
                    Utils.logger('info', `任务执行时间: ${executionTime ? (executionTime / 1000).toFixed(2) : '未知'}秒`);
                }

                // 移除此工作标签页的记录
                if (State.runningWorkers[workerId]) {
                    delete State.runningWorkers[workerId];
                    State.activeWorkers--;
                }

                // 记录工作标签页的日志
                if (logs && logs.length) {
                    logs.forEach(log => Utils.logger('info', log));
                }

                // 处理任务结果
                if (success) {
                    Utils.logger('info', `✅ 任务完成: ${task.name}`);

                    // 从待办列表中移除此任务
                    const initialTodoCount = State.db.todo.length;
                    State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);

                    // 检查是否实际移除了任务
                    if (State.db.todo.length < initialTodoCount) {
                        Utils.logger('info', `已从待办列表中移除任务 ${task.name}`);
                    } else {
                        Utils.logger('warn', `任务 ${task.name} 不在待办列表中，可能已被其他工作标签页处理。`);
                            }

                    // 保存待办列表
                    await Database.saveTodo();

                    // 如果尚未在完成列表中，则添加
                    if (!State.db.done.includes(task.url)) {
                        State.db.done.push(task.url);
                        await Database.saveDone();
                    }

                    // 更新会话状态
                    State.sessionCompleted.add(task.url);

                    // 更新执行统计
                    State.executionCompletedTasks++;
                } else {
                    Utils.logger('warn', `❌ 任务失败: ${task.name}`);

                    // 从待办列表中移除此任务
                    State.db.todo = State.db.todo.filter(t => t.uid !== task.uid);

                    // 保存待办列表
                    await Database.saveTodo();

                    // 添加到失败列表（如果尚未存在）
                    if (!State.db.failed.some(f => f.uid === task.uid)) {
                        State.db.failed.push(task);
                        await Database.saveFailed();
                    }

                    // 更新执行统计
                    State.executionFailedTasks++;
                }

                // 更新UI
                UI.update();

                // 如果还有待办任务，继续执行
                if (State.isExecuting && State.activeWorkers < Config.MAX_CONCURRENT_WORKERS && State.db.todo.length > 0) {
                    // 延迟一小段时间再派发新任务，避免同时打开太多标签页
                    setTimeout(() => TaskRunner.executeBatch(), 1000);
                            }

                // 如果所有任务都已完成，停止执行
                if (State.isExecuting && State.db.todo.length === 0 && State.activeWorkers === 0) {
                    Utils.logger('info', '所有任务已完成。');
                    State.isExecuting = false;
                    // 保存执行状态
                    Database.saveExecutingState();
                    // 保存待办列表（虽然为空，但仍需保存以更新存储）
                    await Database.saveTodo();

                    // 如果处于限速状态且待办任务为0，触发页面刷新
                    if (State.appStatus === 'RATE_LIMITED') {
                        Utils.logger('info', '所有任务已完成，且处于限速状态，将刷新页面尝试恢复...');
                        const randomDelay = 3000 + Math.random() * 5000;
                        countdownRefresh(randomDelay, '任务完成后限速恢复');
                    }

            UI.update();
                }

                // 更新隐藏状态
            TaskRunner.runHideOrShow();
            } catch (error) {
                Utils.logger('error', `处理工作报告时出错: ${error.message}`);
            }
        }));

        // 添加执行状态变化监听器，确保UI状态与存储状态一致
        State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.IS_EXECUTING, (key, oldValue, newValue) => {
            // 如果当前不是工作标签页，且存储状态与当前状态不一致，则更新当前状态
            if (!State.isWorkerTab && State.isExecuting !== newValue) {
                Utils.logger('info', `检测到执行状态变化：${newValue ? '执行中' : '已停止'}`);
                State.isExecuting = newValue;
            UI.update();
            }
        }));

        // --- ROBUST LAUNCHER ---
        // This interval is launched from the clean userscript context and is less likely to be interfered with.
        // It will persistently try to launch the DOM-dependent part of the script.
        // 使用一个全局变量来防止多次初始化
        window._fabHelperLauncherActive = window._fabHelperLauncherActive || false;

        if (!window._fabHelperLauncherActive) {
            window._fabHelperLauncherActive = true;

            const launcherInterval = setInterval(() => {
                if (document.readyState === 'interactive' || document.readyState === 'complete') {
                    if (!State.hasRunDomPart) {
                        Utils.logger('info', '[Launcher] DOM is ready. Running main script logic...');
                        runDomDependentPart();
                    }
                    if (State.hasRunDomPart) {
                        clearInterval(launcherInterval);
                        window._fabHelperLauncherActive = false;
                        Utils.logger('debug', '[Launcher] Main logic has been launched or skipped. Launcher is now idle.');
                    }
                }
            }, 500); // 增加间隔到500ms，减少频繁检查
        } else {
            Utils.logger('info', '[Launcher] Another launcher is already active. Skipping initialization.');
        }

        // 添加无活动超时刷新功能
        let lastNetworkActivityTime = Date.now();

        // 记录网络活动的函数
        // 记录网络活动时间
        window.recordNetworkActivity = function() {
            lastNetworkActivityTime = Date.now();
        };

        // 记录网络请求
        window.recordNetworkRequest = function(source, isSuccess) {
            // 记录网络活动
            window.recordNetworkActivity();
        };

        // 定期检查是否长时间无活动
        setInterval(() => {
            // 只有在限速状态下才考虑无活动刷新
            if (State.appStatus === 'RATE_LIMITED') {
                const inactiveTime = Date.now() - lastNetworkActivityTime;
                // 如果超过30秒没有网络活动，强制刷新
                if (inactiveTime > 30000) {
                    Utils.logger('warn', `⚠️ 检测到在限速状态下 ${Math.floor(inactiveTime/1000)} 秒无网络活动，即将强制刷新页面...`);
                    // 使用延迟以便用户能看到日志
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                }
            }
        }, 5000); // 每5秒检查一次
    }

        async function runDomDependentPart() {
        if (State.hasRunDomPart) return;

        // 如果是工作标签页，不执行主脚本的DOM相关逻辑
        if (State.isWorkerTab) {
            State.hasRunDomPart = true; // 标记为已运行，避免重复检查
            return;
        }

        // The new, correct worker detection logic.
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('workerId')) {
            // 这里不需要再调用processDetailPage，因为main函数中已经处理了
            Utils.logger('info', `工作标签页DOM部分初始化，跳过UI创建`);
            State.hasRunDomPart = true; // Mark as run to stop the launcher
            return;
        }

        // --- NEW FLOW: Create the UI FIRST for immediate user feedback ---
        const uiCreated = UI.create();

        if (!uiCreated) {
            Utils.logger('info', Utils.getText('log_detail_page'));
            State.hasRunDomPart = true; // Mark as run to stop the launcher
            return;
        }

        // 初始化完成后，确保UI状态与执行状态一致
            UI.update();

        // 确保UI创建后立即更新调试标签页
        UI.update();
        UI.updateDebugTab();
        UI.switchTab('dashboard'); // 设置初始标签页

        State.hasRunDomPart = true; // Mark as run *after* successful UI creation

        // --- Dead on Arrival Check for initial 429 page load ---
        // 使enterRateLimitedState函数全局可访问，以便其他部分可以调用
        window.enterRateLimitedState = function(source = Utils.getText('rate_limit_source_global_call')) {
            // 使用统一的限速管理器进入限速状态
            RateLimitManager.enterRateLimitedState(source);
        };

        // 添加全局函数用于记录所有网络请求 - 简化版
        window.recordNetworkRequest = function(source = '网络请求', hasResults = true) {
            // 只记录成功请求，不再进行复杂的计数
            if (hasResults) {
                RateLimitManager.recordSuccessfulRequest(source, hasResults);
            }
        };

        // 添加页面内容检测功能，定期检查页面是否显示了限速错误信息
        setInterval(() => {
            // 如果已经处于限速状态，不需要检查
            if (State.appStatus === 'NORMAL') {
                // 检查页面内容是否包含限速错误信息
                const pageText = document.body.innerText || '';
                if (pageText.includes('Too many requests') ||
                    pageText.includes('rate limit') ||
                    pageText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {

                    Utils.logger('warn', Utils.getText('page_content_rate_limit_detected'));
                    RateLimitManager.enterRateLimitedState(Utils.getText('rate_limit_source_page_content'));
                }
            }
        }, 5000); // 每5秒检查一次

        const checkIsErrorPage = (title, text) => {
            const isCloudflareTitle = title.includes('Cloudflare') || title.includes('Attention Required');
            const is429Text = text.includes('429') ||
                              text.includes('Too Many Requests') ||
                              text.includes('Too many requests') ||
                              text.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i);
            if (isCloudflareTitle || is429Text) {
                Utils.logger('warn', `[页面加载] 检测到429错误页面: ${document.location.href}`);
                window.enterRateLimitedState('页面内容429检测');
                return true;
            }
            return false;
        };

        // 如果检测到错误页面，不要立即返回，而是继续尝试恢复
        const isErrorPage = checkIsErrorPage(document.title, document.body.innerText || '');
        // 不要在这里return，让代码继续执行到自动恢复部分

        // The auto-resume logic is preserved - always try to recover from 429
        if (State.appStatus === 'RATE_LIMITED') {
            Utils.logger('info', '[Auto-Resume] 页面在限速状态下加载。正在进行恢复探测...');

            // 使用统一的限速状态检查
            const isRecovered = await RateLimitManager.checkRateLimitStatus();

            if (isRecovered) {
                Utils.logger('info', '✅ 恢复探测成功！限速已解除，继续正常操作。');

                // 如果有待办任务，继续执行
                if (State.db.todo.length > 0 && !State.isExecuting) {
                    Utils.logger('info', `发现 ${State.db.todo.length} 个待办任务，自动恢复执行...`);
                    State.isExecuting = true;
                    Database.saveExecutingState();
                    TaskRunner.executeBatch();
                }
            } else {
                // 仍然处于限速状态，继续随机刷新
                Utils.logger('warn', '恢复探测失败。仍处于限速状态，将继续随机刷新...');

                // 如果有活动任务，等待它们完成
                if (State.activeWorkers > 0) {
                    Utils.logger('info', `仍有 ${State.activeWorkers} 个任务在执行中，等待它们完成后再刷新...`);
                } else if (State.db.todo.length > 0) {
                    // 如果有待办任务但没有活动任务，尝试继续执行
                    Utils.logger('info', `有 ${State.db.todo.length} 个待办任务等待执行，将尝试继续执行...`);
                    if (!State.isExecuting) {
                        State.isExecuting = true;
                        Database.saveExecutingState();
                        TaskRunner.executeBatch();
                    }
                } else {
                    // 没有任务，直接刷新
                    const randomDelay = 5000 + Math.random() * 10000;
                    countdownRefresh(randomDelay, '恢复探测失败');
                }
            }
        }

        // --- Observer setup is now directly inside runDomDependentPart ---
        const containerSelectors = [
            'main', '#main', '.AssetGrid-root', '.fabkit-responsive-grid-container'
        ];
        let targetNode = null;
        for (const selector of containerSelectors) {
            targetNode = document.querySelector(selector);
            if (targetNode) break;
        }
        if (!targetNode) targetNode = document.body;

        const observer = new MutationObserver((mutationsList) => {
            const hasNewContent = mutationsList.some(mutation =>
                [...mutation.addedNodes].some(node =>
                    node.nodeType === 1 && (node.matches(Config.SELECTORS.card) || node.querySelector(Config.SELECTORS.card))
                )
            );
            if (hasNewContent) {
                // 不再立即执行隐藏，而是等待一段时间，确保API请求完成

                // 延迟进行处理
                clearTimeout(State.observerDebounceTimer);
                State.observerDebounceTimer = setTimeout(() => {
                    if (State.debugMode) {
                        Utils.logger('debug', `[Observer] ${Utils.getText('debug_new_content_loading')}`);
                    }

                    // 首先等待一段较长的时间，确保API请求有足够时间完成
                    setTimeout(() => {
                        if (State.debugMode) {
                            Utils.logger('debug', `[Observer] ${Utils.getText('debug_process_new_content')}`);
                        }

                        // 执行一次状态检查，尝试更新卡片状态
                        TaskRunner.checkVisibleCardsStatus().then(() => {
                            // 状态检查后再次执行隐藏，确保新状态被应用
                            // 使用更长的延迟执行隐藏，确保DOM和API状态已完全更新
                            setTimeout(() => {
                                if (State.hideSaved) {
                                    TaskRunner.runHideOrShow();
                                }
                            }, 1000);

                            // 只在非限速状态下执行自动添加任务功能
                            if (State.appStatus === 'NORMAL' || State.autoAddOnScroll) {
                                // 异步调用scanAndAddTasks，但也增加延迟
                                setTimeout(() => {
                                    TaskRunner.scanAndAddTasks(document.querySelectorAll(Config.SELECTORS.card))
                                        .catch(error => Utils.logger('error', `自动添加任务失败: ${error.message}`));
                                }, 500);
                            }
                        }).catch(() => {
                            // 即使状态检查失败也执行隐藏，但延迟更长
                            setTimeout(() => {
                                if (State.hideSaved) {
                                    TaskRunner.runHideOrShow();
                                }
                            }, 1500);
                        });
                    }, 2000); // 等待2秒，确保API请求完成
                }, 500); // 增加防抖延迟
            }
        });

        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
        Utils.logger('debug', `✅ Core DOM observer is now active on <${targetNode.tagName.toLowerCase()}>.`);

        // 初始化时运行一次隐藏逻辑，确保页面加载时已有的内容能被正确处理
            TaskRunner.runHideOrShow();

            // 添加定期检查功能，确保所有卡片都被正确处理
            setInterval(() => {
                // 如果没有开启隐藏功能，不需要检查
                if (!State.hideSaved) return;

                // 检查是否有未处理的卡片
                const cards = document.querySelectorAll(Config.SELECTORS.card);
                let unprocessedCount = 0;

                cards.forEach(card => {
                    const isProcessed = card.getAttribute('data-fab-processed') === 'true';
                    if (!isProcessed) {
                        unprocessedCount++;
                    } else {
                        // 检查已处理的卡片是否状态正确
                        const isFinished = TaskRunner.isCardFinished(card);
                        const shouldBeHidden = isFinished && State.hideSaved;
                        const isHidden = card.style.display === 'none';

                        // 如果状态不一致，重置处理标记
                        if (shouldBeHidden !== isHidden) {
                            card.removeAttribute('data-fab-processed');
                            unprocessedCount++;
                        }
                    }
                });

                // 如果有未处理的卡片，重新执行隐藏逻辑
                if (unprocessedCount > 0) {
                    if (State.debugMode) {
                        Utils.logger('debug', Utils.getText('debug_unprocessed_cards', unprocessedCount));
                    }
                    TaskRunner.runHideOrShow();
                }
            }, 3000); // 每3秒检查一次

        // 添加定期检查功能，每10秒检查一次待办列表中的任务是否已经完成
        setInterval(() => {
            // 如果待办列表为空，不需要检查
            if (State.db.todo.length === 0) return;

            // 检查待办列表中的每个任务，看是否已经在"完成"列表中
            const initialTodoCount = State.db.todo.length;
            State.db.todo = State.db.todo.filter(task => {
                const url = task.url.split('?')[0];
                // 如果任务已经在"完成"列表中，则从待办列表中移除
                return !State.db.done.includes(url);
            });

            // 如果待办列表的数量发生了变化，更新UI
            if (State.db.todo.length < initialTodoCount) {
                Utils.logger('info', `[自动清理] 从待办列表中移除了 ${initialTodoCount - State.db.todo.length} 个已完成的任务。`);
                UI.update();
            }
        }, 10000);

        // 添加定期检查功能，检测是否请求不出新商品（隐性限速）
        let lastCardCount = document.querySelectorAll(Config.SELECTORS.card).length;
        let noNewCardsCounter = 0;
        let lastScrollY = window.scrollY;

        setInterval(() => {
            // 如果已经处于限速状态，不需要检查
            if (State.appStatus !== 'NORMAL') return;

            // 获取当前卡片数量
            const currentCardCount = document.querySelectorAll(Config.SELECTORS.card).length;

            // 如果滚动了但卡片数量没有增加，可能是隐性限速
            if (window.scrollY > lastScrollY + 100 && currentCardCount === lastCardCount) {
                noNewCardsCounter++;

                // 如果连续3次检查都没有新卡片，认为是隐性限速
                if (noNewCardsCounter >= 3) {
                    Utils.logger('warn', `[隐性限速检测] 检测到可能的限速情况：连续${noNewCardsCounter}次滚动后卡片数量未增加。`);
                    try {
                        // 使用RateLimitManager处理限速
                        RateLimitManager.enterRateLimitedState('隐性限速检测');
                    } catch (error) {
                        Utils.logger('error', `处理限速出错: ${error.message}`);
                        // 备选方案：直接刷新页面
                        const randomDelay = 5000 + Math.random() * 10000;
                        countdownRefresh(randomDelay, '隐性限速检测');
                    }
                    noNewCardsCounter = 0;
                }
            } else if (currentCardCount > lastCardCount) {
                // 有新卡片，重置计数器
                noNewCardsCounter = 0;
            }

            // 更新上次卡片数量和滚动位置
            lastCardCount = currentCardCount;
            lastScrollY = window.scrollY;
        }, 5000); // 每5秒检查一次

        // 添加页面内容检测功能，定期检查页面是否显示了限速错误信息
        setInterval(() => {
            // 如果已经处于限速状态，不需要检查
            if (State.appStatus !== 'NORMAL') return;

            // 检查页面内容是否包含限速错误信息
            const pageText = document.body.innerText || '';
            const jsonPattern = /\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i;

            if (pageText.match(jsonPattern) ||
                pageText.includes('Too many requests') ||
                pageText.includes('rate limit')) {

                Utils.logger('warn', Utils.getText('page_content_rate_limit_detected'));
                try {
                    // 直接使用全局函数，避免使用PagePatcher.handleRateLimit
                    if (typeof window.enterRateLimitedState === 'function') {
                        window.enterRateLimitedState();
                } else {
                        // 最后的备选方案：直接刷新页面
                        const randomDelay = 5000 + Math.random() * 10000;
                        countdownRefresh(randomDelay, '页面内容检测');
                }
                } catch (error) {
                    Utils.logger('error', `处理限速出错: ${error.message}`);
                    // 最后的备选方案：直接刷新页面
                    const randomDelay = 5000 + Math.random() * 10000;
                    countdownRefresh(randomDelay, '错误恢复');
                }
            }
        }, 3000); // 每3秒检查一次

        // 添加HTTP状态码检测功能，定期检查当前页面的HTTP状态码
        const checkHttpStatus = async () => {
            try {
                // 如果已经处于限速状态，不需要检查
                if (State.appStatus !== 'NORMAL') return;

                // 使用window.performance API检查最近的页面请求
                if (window.performance && window.performance.getEntriesByType) {
                    const navigationEntries = window.performance.getEntriesByType('navigation');
                    if (navigationEntries && navigationEntries.length > 0) {
                        const lastNavigation = navigationEntries[0];
                        if (lastNavigation.responseStatus === 429) {
                            Utils.logger('warn', `[HTTP状态检测] 检测到导航请求状态码为429！`);
                            if (typeof window.enterRateLimitedState === 'function') {
                                window.enterRateLimitedState();
                            } else {
                                const randomDelay = 5000 + Math.random() * 10000;
                                countdownRefresh(randomDelay, 'HTTP状态检测');
                            }
                            return;
                        }
                    }
                }

                // 不再发送HEAD请求，只使用Performance API
                Utils.logger('debug', `[HTTP状态检测] 使用Performance API检查，不再发送HEAD请求`);

                // 检查页面内容是否包含限速信息
                const pageText = document.body.innerText || '';
                if (pageText.includes('Too many requests') ||
                    pageText.includes('rate limit') ||
                    pageText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {

                    Utils.logger('warn', `[HTTP状态检测] 页面内容包含限速信息，判断为429状态`);
                    try {
                        // 直接使用全局函数，避免使用PagePatcher.handleRateLimit
                        if (typeof window.enterRateLimitedState === 'function') {
                            window.enterRateLimitedState();
                        } else {
                            // 最后的备选方案：直接刷新页面
                            const randomDelay = 5000 + Math.random() * 10000;
                            countdownRefresh(randomDelay, 'HTTP状态检测');
                        }
                    } catch (error) {
                        Utils.logger('error', `处理限速出错: ${error.message}`);
                        // 最后的备选方案：直接刷新页面
                        const randomDelay = 5000 + Math.random() * 10000;
                        countdownRefresh(randomDelay, '错误恢复');
                    }
                }
            } catch (error) {
                // 忽略错误
            }
        };

        // 每10秒检查一次HTTP状态码
        setInterval(checkHttpStatus, 10000);

        // 添加状态监控，定期检查页面状态
        const checkPageStatus = async () => {
            try {
                // 重新计算实际可见的商品数量，确保与DOM状态同步
                const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;

                // 使用更准确的方式检查元素是否可见
                const visibleCards = Array.from(document.querySelectorAll(Config.SELECTORS.card)).filter(card => {
                    // 检查元素自身的display属性
                    if (card.style.display === 'none') return false;

                    // 检查是否被CSS规则隐藏
                    const computedStyle = window.getComputedStyle(card);
                    return computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
                });

                const actualVisibleCards = visibleCards.length;
                const hiddenCards = totalCards - actualVisibleCards;

                // 更新UI显示的可见商品数量，确保UI与实际DOM状态一致
                const visibleCountElement = document.getElementById('fab-status-visible');
                if (visibleCountElement) {
                    visibleCountElement.textContent = actualVisibleCards.toString();
                }

                // 更新全局状态
                State.hiddenThisPageCount = hiddenCards;

                // 如果处于限速状态且没有可见商品，考虑刷新
                // 只有在明确开启了自动刷新功能时才触发
                if (State.appStatus === 'RATE_LIMITED' && actualVisibleCards === 0 && State.autoRefreshEmptyPage) {
                    // 如果已经有倒计时在运行，不要干扰它
                    if (window._pendingZeroVisibleRefresh || currentCountdownInterval || currentRefreshTimeout) {
                        return;
                    }

                    Utils.logger('info', `[状态监控] 检测到限速状态下没有可见商品且自动刷新已开启，准备刷新页面`);
                    const randomDelay = 3000 + Math.random() * 2000; // 3-5秒的短延迟
                    countdownRefresh(randomDelay, '限速状态无可见商品');
                    return;
                }

                // 移除正常状态下因隐藏商品而自动刷新的逻辑
                // 如果处于正常状态且所有商品都被隐藏，只记录日志，不触发刷新
                if (State.appStatus === 'NORMAL' && actualVisibleCards === 0 && hiddenCards > 25) {
                    Utils.logger('info', `[状态监控] ${Utils.getText('status_monitor_all_hidden', hiddenCards)}`);
                    return;
                }

                // 使用window.performance API检查最近的API请求
                if (window.performance && window.performance.getEntriesByType) {
                    const recentRequests = window.performance.getEntriesByType('resource')
                        .filter(r => r.name.includes('/i/listings/search') || r.name.includes('/i/users/me/listings-states'))
                        .filter(r => Date.now() - r.startTime < 15000); // 最近15秒内的请求

                    // 检查是否有429状态码的请求
                    const has429 = recentRequests.some(r => r.responseStatus === 429);
                    if (has429 && State.appStatus === 'NORMAL') {
                        Utils.logger('warn', `[状态监控] 检测到最近15秒内有429状态码的请求，进入限速状态`);
                        if (typeof window.enterRateLimitedState === 'function') {
                            window.enterRateLimitedState('性能API检测429');
                        }
                        return;
                    }

                    // 检查是否有成功的请求
                    const hasSuccess = recentRequests.some(r => r.responseStatus >= 200 && r.responseStatus < 300);
                    if (hasSuccess && State.appStatus === 'RATE_LIMITED' && State.consecutiveSuccessCount >= 2) {
                        Utils.logger('info', `[状态监控] 检测到最近15秒内有成功的API请求，尝试退出限速状态`);
                        if (typeof RateLimitManager.exitRateLimitedState === 'function') {
                            RateLimitManager.exitRateLimitedState('性能API检测成功');
                        }
                    }
                }
            } catch (error) {
                Utils.logger('error', `页面状态检查出错: ${error.message}`);
            }
        };

        // 每10秒检查一次页面状态
        setInterval(checkPageStatus, 10000);

        // 添加定期检查功能，确保待办任务能被执行
        setInterval(() => {
            // 如果没有待办任务，不需要检查
            if (State.db.todo.length === 0) return;

            // 确保任务被执行
            TaskRunner.ensureTasksAreExecuted();
        }, 5000); // 每5秒检查一次

        // 添加专门针对滚动加载API请求的拦截器
        const originalXMLHttpRequestSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(...args) {
            const xhr = this;

            // 添加额外的事件监听器，专门用于检测429错误
            xhr.addEventListener('load', function() {
                // 只检查listings/search相关的请求
                if (xhr._url && xhr._url.includes('/i/listings/search')) {
                    // 检查状态码
                    if (xhr.status === 429 || xhr.status === '429' || xhr.status.toString() === '429') {
                        Utils.logger('warn', `[滚动API监控] 检测到API请求状态码为429: ${xhr._url}`);
                        try {
                            // 直接使用全局函数，避免使用PagePatcher.handleRateLimit
                            if (typeof window.enterRateLimitedState === 'function') {
                                window.enterRateLimitedState();
                            } else {
                                // 最后的备选方案：直接刷新页面
                                const randomDelay = 5000 + Math.random() * 10000;
                                countdownRefresh(randomDelay, '滚动API监控');
                            }
                        } catch (error) {
                            Utils.logger('error', `处理限速出错: ${error.message}`);
                            // 最后的备选方案：直接刷新页面
                            const randomDelay = 5000 + Math.random() * 10000;
                            countdownRefresh(randomDelay, '错误恢复');
                        }
                        return;
                    }

                    // 检查响应内容
                    try {
                        const responseText = xhr.responseText;
                        if (responseText && (
                            responseText.includes('Too many requests') ||
                            responseText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)
                        )) {
                            Utils.logger('warn', `[滚动API监控] 检测到API响应内容包含限速信息: ${responseText}`);
                            try {
                                // 直接使用全局函数，避免使用PagePatcher.handleRateLimit
                                if (typeof window.enterRateLimitedState === 'function') {
                                    window.enterRateLimitedState();
                                } else {
                                    // 最后的备选方案：直接刷新页面
                                    const randomDelay = 5000 + Math.random() * 10000;
                                    countdownRefresh(randomDelay, '滚动API监控');
                                }
                            } catch (error) {
                                Utils.logger('error', `处理限速出错: ${error.message}`);
                                // 最后的备选方案：直接刷新页面
                                const randomDelay = 5000 + Math.random() * 10000;
                                countdownRefresh(randomDelay, '错误恢复');
                            }
                            return;
                        }
                    } catch (e) {
                        // 忽略错误
                    }
                }
            });

            return originalXMLHttpRequestSend.apply(this, args);
        };
    }

    main();

    // 添加一个通用的倒计时刷新函数
    // 使用一个全局变量来跟踪当前的倒计时，避免多个倒计时同时运行
    let currentCountdownInterval = null;
    let currentRefreshTimeout = null;

    const countdownRefresh = (delay, reason = '备选方案') => {
        // 如果已经安排了刷新，不要重复安排
        if (State.isRefreshScheduled) {
            Utils.logger('info', Utils.getText('refresh_plan_exists').replace('(429自动恢复)', `(${reason})`));
            return;
        }

        // 标记已安排刷新
        State.isRefreshScheduled = true;

        // 如果已经有倒计时在运行，先清除它
        if (currentCountdownInterval) {
            clearInterval(currentCountdownInterval);
            currentCountdownInterval = null;
        }
        if (currentRefreshTimeout) {
            clearTimeout(currentRefreshTimeout);
            currentRefreshTimeout = null;
        }

        // 添加空值检查，防止delay为null
        const seconds = delay ? (delay/1000).toFixed(1) : '未知';

        // 添加明显的倒计时日志
        Utils.logger('info', `🔄 ${reason}启动！将在 ${seconds} 秒后刷新页面尝试恢复...`);

        // 每秒更新倒计时日志
        let remainingSeconds = Math.ceil(delay/1000);
        currentCountdownInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                clearInterval(currentCountdownInterval);
                currentCountdownInterval = null;
                                    Utils.logger('info', `⏱️ 倒计时结束，正在刷新页面...`);
                } else {
                    Utils.logger('info', Utils.getText('auto_refresh_countdown', remainingSeconds));

                    // 如果用户手动取消了刷新标记
                    if (!State.isRefreshScheduled) {
                        Utils.logger('info', `⏹️ 检测到刷新已被取消，停止倒计时`);
                        clearInterval(currentCountdownInterval);
                        currentCountdownInterval = null;

                        if (currentRefreshTimeout) {
                            clearTimeout(currentRefreshTimeout);
                            currentRefreshTimeout = null;
                        }
                        return;
                    }

                // 每3秒重新检查一次条件
                if (remainingSeconds % 3 === 0) {
                    // 尝试使用优化后的API函数检查限速状态
                    checkRateLimitStatus().then(isNotLimited => {
                        if (isNotLimited) {
                            Utils.logger('info', `⏱️ 检测到API限速已解除，取消刷新...`);
                            clearInterval(currentCountdownInterval);
                            currentCountdownInterval = null;

                            if (currentRefreshTimeout) {
                                clearTimeout(currentRefreshTimeout);
                                currentRefreshTimeout = null;
                            }

                            // 重置刷新标记
                            State.isRefreshScheduled = false;

                            // 恢复正常状态
                            if (State.appStatus === 'RATE_LIMITED') {
                                RateLimitManager.exitRateLimitedState();
                            }

                            return;
                        }

                        // 如果是429限速状态，则检查可见商品是否为0
                        if (State.appStatus === 'RATE_LIMITED') {
                            // 使用UI上显示的可见商品数量作为判断依据
                            const actualVisibleCount = parseInt(document.getElementById('fab-status-visible')?.textContent || '0');

                            // 只检查是否有待办任务或活动工作线程
                            if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                                clearInterval(currentCountdownInterval);
                                clearTimeout(currentRefreshTimeout);
                                currentCountdownInterval = null;
                                currentRefreshTimeout = null;
                                // 重置刷新标记
                                State.isRefreshScheduled = false;
                                Utils.logger('info', `⏹️ 检测到有 ${State.db.todo.length} 个待办任务和 ${State.activeWorkers} 个活动工作线程，已取消自动刷新。`);
                                Utils.logger('warn', '⚠️ 刷新条件已变化，自动刷新已取消。');
                                return;
                            }

                            // 如果没有实际可见的商品，继续刷新
                            if (actualVisibleCount === 0) {
                                Utils.logger('info', Utils.getText('rate_limit_no_visible_continue'));
                            } else {
                                Utils.logger('info', `⏹️ 虽然处于限速状态，但页面上有 ${actualVisibleCount} 个可见商品，暂不刷新。`);
                                clearInterval(currentCountdownInterval);
                                clearTimeout(currentRefreshTimeout);
                                currentCountdownInterval = null;
                                currentRefreshTimeout = null;
                                return;
                            }
                        } else {
                            // 正常状态下，如果有可见商品、待办任务或活动工作线程，则取消刷新
                            // 使用UI上显示的可见商品数量
                            const visibleCount = parseInt(document.getElementById('fab-status-visible')?.textContent || '0');

                            if (State.db.todo.length > 0 || State.activeWorkers > 0 || visibleCount > 0) {
                                clearInterval(currentCountdownInterval);
                                clearTimeout(currentRefreshTimeout);
                                currentCountdownInterval = null;
                                currentRefreshTimeout = null;
                                // 重置刷新标记
                                State.isRefreshScheduled = false;

                                if (visibleCount > 0) {
                                    Utils.logger('info', `⏹️ 检测到页面上有 ${visibleCount} 个可见商品，已取消自动刷新。`);
                                } else {
                                    Utils.logger('info', `⏹️ 检测到有 ${State.db.todo.length} 个待办任务和 ${State.activeWorkers} 个活动工作线程，已取消自动刷新。`);
                                }
                                Utils.logger('warn', '⚠️ 刷新条件已变化，自动刷新已取消。');
                                return;
                            }
                        }
                    }).catch(e => {
                        if (State.debugMode) {
                            Utils.logger('debug', `检查限速状态出错: ${e.message}`);
                        }
                    });
                }
            }
        }, 1000);

        // 设置刷新定时器
        currentRefreshTimeout = setTimeout(() => {
            // 最后一次检查条件，确保在刷新前条件仍然满足
            // 使用UI上显示的可见商品数量
            const visibleCount = parseInt(document.getElementById('fab-status-visible')?.textContent || '0');

            // 如果是429限速状态，检查实际可见商品
            if (State.appStatus === 'RATE_LIMITED') {
                // 使用UI上显示的可见商品数量
                const actualVisibleCount = parseInt(document.getElementById('fab-status-visible')?.textContent || '0');

                // 只检查是否有待办任务或活动工作线程
                if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                    Utils.logger('info', `⏹️ 刷新前检测到有 ${State.db.todo.length} 个待办任务和 ${State.activeWorkers} 个活动工作线程，已取消自动刷新。`);
                    Utils.logger('warn', '⚠️ 最后一刻检查：刷新条件不满足，自动刷新已取消。');
                    State.isRefreshScheduled = false; // 重置刷新标记
                    return;
                }

                // 如果没有实际可见的商品，执行刷新
                if (actualVisibleCount === 0) {
                    Utils.logger('info', `🔄 页面上没有可见商品且处于限速状态，将执行自动刷新。`);
                    // 使用更可靠的刷新方式
                    window.location.href = window.location.href;
                } else {
                    Utils.logger('info', `⏹️ 虽然处于限速状态，但页面上有 ${actualVisibleCount} 个可见商品，取消自动刷新。`);
                    State.isRefreshScheduled = false; // 重置刷新标记
                    return;
                }
            } else {
                // 正常状态下的检查
                if (State.db.todo.length > 0 || State.activeWorkers > 0 || visibleCount > 0) {
                    if (visibleCount > 0) {
                        Utils.logger('info', `⏹️ 刷新前检测到页面上有 ${visibleCount} 个可见商品，已取消自动刷新。`);
                    } else {
                        Utils.logger('info', `⏹️ 刷新前检测到有 ${State.db.todo.length} 个待办任务和 ${State.activeWorkers} 个活动工作线程，已取消自动刷新。`);
                    }
                    Utils.logger('warn', '⚠️ 最后一刻检查：刷新条件不满足，自动刷新已取消。');
                    State.isRefreshScheduled = false; // 重置刷新标记
                } else {
                    // 所有条件都满足，执行刷新
                    // 使用更可靠的刷新方式
                    window.location.href = window.location.href;
                }
            }
        }, delay);
    };

    // 优化后的限速状态检查函数 - 完全依赖网站自身请求流量
    async function checkRateLimitStatus() {
        try {
            // 重新计算实际可见的商品数量，确保与DOM状态同步
            const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;
            const hiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`).length;
            const actualVisibleCards = totalCards - hiddenCards;

            // 更新UI显示的可见商品数量，确保UI与实际DOM状态一致
            const visibleCountElement = document.getElementById('fab-status-visible');
            if (visibleCountElement) {
                visibleCountElement.textContent = actualVisibleCards.toString();
            }

            // 使用实际DOM状态更新全局状态
            State.hiddenThisPageCount = hiddenCards;

            Utils.logger('info', Utils.getText('status_check_summary', actualVisibleCards, totalCards, hiddenCards));

            // 如果处于限速状态且没有可见商品，直接返回false触发刷新
            if (State.appStatus === 'RATE_LIMITED' && actualVisibleCards === 0) {
                Utils.logger('info', Utils.getText('rate_limit_no_visible_suggest'));
                return false;
            }

            // 即使在正常状态下，如果所有商品都被隐藏且隐藏的商品数量超过25个，也建议刷新
            if (actualVisibleCards === 0 && hiddenCards > 25) {
                Utils.logger('info', `🔄 检测到页面上有 ${hiddenCards} 个隐藏商品，但没有可见商品，建议刷新页面`);
                return false;
            }

            // 使用window.performance API检查最近的网络请求
            if (window.performance && window.performance.getEntriesByType) {
                const recentRequests = window.performance.getEntriesByType('resource')
                    .filter(r => r.name.includes('/i/listings/search') || r.name.includes('/i/users/me/listings-states'))
                    .filter(r => Date.now() - r.startTime < 10000); // 最近10秒内的请求

                // 如果有最近的请求，检查它们的状态
                if (recentRequests.length > 0) {
                    // 检查是否有429状态码的请求
                    const has429 = recentRequests.some(r => r.responseStatus === 429);
                    if (has429) {
                        Utils.logger('info', `📊 检测到最近10秒内有429状态码的请求，判断为限速状态`);
                        return false;
                    }

                    // 检查是否有成功的请求
                    const hasSuccess = recentRequests.some(r => r.responseStatus >= 200 && r.responseStatus < 300);
                    if (hasSuccess) {
                        Utils.logger('info', `📊 检测到最近10秒内有成功的API请求，判断为正常状态`);
                        return true;
                    }
                }

                // 如果没有最近的请求或者没有明确的成功/失败状态，保持当前状态
                return State.appStatus === 'NORMAL';
            }

            // 如果无法使用Performance API，根据当前状态返回
            // 在限速状态下返回false，表示需要刷新
            // 在正常状态下返回true，表示不需要刷新
            return State.appStatus === 'NORMAL';
        } catch (error) {
            Utils.logger('error', `检查限速状态出错: ${error.message}`);
            // 出错时保守处理，认为仍然处于限速状态
            return false;
        }
    }

    // 在页面卸载时清理实例
    window.addEventListener('beforeunload', () => {
        InstanceManager.cleanup();
        Utils.cleanup();
    });

    // 添加请求拦截器设置函数
    function setupRequestInterceptors() {
        try {
            // 设置XHR拦截器
            setupXHRInterceptor();

            // 设置Fetch拦截器
            setupFetchInterceptor();

            // 设置定期清理过期缓存的定时器
            setInterval(() => DataCache.cleanupExpired(), 60000); // 每分钟清理一次

            Utils.logger('info', '请求拦截和缓存系统已初始化');
        } catch (e) {
            Utils.logger('error', `初始化请求拦截器失败: ${e.message}`);
        }
    }

    // 设置XHR拦截器
    function setupXHRInterceptor() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(...args) {
            this._url = args[1]; // 保存URL以便后续使用
            return originalOpen.apply(this, args);
        };

        XMLHttpRequest.prototype.send = function(...args) {
            const xhr = this;

            // 只拦截相关API请求
            if (xhr._url && typeof xhr._url === 'string') {
                // 添加加载完成事件监听器
                xhr.addEventListener('load', function() {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        try {
                            const responseData = JSON.parse(xhr.responseText);

                            // 处理商品列表搜索响应
                            if (xhr._url.includes('/i/listings/search') && responseData.results && Array.isArray(responseData.results)) {
                                DataCache.saveListings(responseData.results);
                                if (State.debugMode) {
                                    Utils.logger('debug', `[Cache] ${Utils.getText('debug_cached_items', responseData.results.length)}`);
                                }
                            }
                            // 处理拥有状态响应
                            else if (xhr._url.includes('/i/users/me/listings-states')) {
                                if (Array.isArray(responseData)) {
                                    DataCache.saveOwnedStatus(responseData);
                                } else {
                                    const extractedData = API.extractStateData(responseData, 'XHRInterceptor');
                                    if (Array.isArray(extractedData) && extractedData.length > 0) {
                                        DataCache.saveOwnedStatus(extractedData);
                                    }
                                }
                            }
                            // 处理价格信息响应
                            else if (xhr._url.includes('/i/listings/prices-infos') && responseData.offers && Array.isArray(responseData.offers)) {
                                DataCache.savePrices(responseData.offers);
                            }
                        } catch (e) {
                            // 解析错误时只在调试模式下记录
                            if (State.debugMode) {
                                Utils.logger('debug', `[Cache] 解析响应失败: ${e.message}`);
                            }
                        }
                    }
                });
            }

            return originalSend.apply(this, args);
        };

        if (State.debugMode) {
            Utils.logger('debug', '[优化] XHR拦截器已设置');
        }
    }

    // 设置Fetch拦截器
    function setupFetchInterceptor() {
        const originalFetch = window.fetch;

        window.fetch = async function(...args) {
            const url = args[0]?.toString() || '';

            // 只拦截相关API请求
            if (url.includes('/i/listings/search') ||
                url.includes('/i/users/me/listings-states') ||
                url.includes('/i/listings/prices-infos')) {

                try {
                    // 执行原始fetch请求
                    const response = await originalFetch.apply(this, args);

                    // 如果请求成功，处理响应数据
                    if (response.ok) {
                        // 克隆响应以避免消耗原始响应
                        const clonedResponse = response.clone();

                        // 异步处理响应数据
                        clonedResponse.json().then(data => {
                            // 处理商品列表搜索响应 - 简化版
                            if (url.includes('/i/listings/search') && data.results && Array.isArray(data.results)) {
                                DataCache.saveListings(data.results);
                            }
                            // 处理拥有状态响应
                            else if (url.includes('/i/users/me/listings-states')) {
                                if (Array.isArray(data)) {
                                    Utils.logger('info', `[网页请求] 捕获到拥有状态API响应，包含 ${data.length} 个商品状态`);
                                    DataCache.saveOwnedStatus(data);
                                } else {
                                    const extractedData = API.extractStateData(data, 'FetchInterceptor');
                                    if (Array.isArray(extractedData) && extractedData.length > 0) {
                                        Utils.logger('info', `[网页请求] 捕获到拥有状态API响应，提取出 ${extractedData.length} 个商品状态`);
                                        DataCache.saveOwnedStatus(extractedData);
                                    }
                                }
                            }
                            // 处理价格信息响应
                            else if (url.includes('/i/listings/prices-infos') && data.offers && Array.isArray(data.offers)) {
                                DataCache.savePrices(data.offers);
                            }
                        }).catch((e) => {
                            // 解析错误时只在调试模式下记录
                            if (State.debugMode) {
                                Utils.logger('debug', `[Cache] Fetch: 解析响应失败: ${e.message}`);
                            }
                        });
                    }

                    // 返回原始响应
                    return response;
                } catch (e) {
                    // 请求错误，继续使用原始fetch
                    Utils.logger('error', `[Cache] Fetch拦截器错误: ${e.message}`);
                    return originalFetch.apply(this, args);
                }
            }

            // 非相关API请求，直接使用原始fetch
            return originalFetch.apply(this, args);
        };

        if (State.debugMode) {
            Utils.logger('debug', '[优化] Fetch拦截器已设置');
        }
    }

    // 添加一个函数，确保UI在刷新后能正确重新加载
    function ensureUILoaded() {
        // 检查UI是否已加载
        if (!document.getElementById(Config.UI_CONTAINER_ID)) {
            // 如果UI未加载，尝试重新初始化
            Utils.logger('warn', '检测到UI未加载，尝试重新初始化...');

            // 延迟执行，确保页面已完全加载
            setTimeout(() => {
                try {
                    // 重新执行初始化逻辑
                    runDomDependentPart();
                } catch (error) {
                    Utils.logger('error', `UI重新初始化失败: ${error.message}`);
                }
            }, 1000);
        }
    }

    // 添加页面加载完成后的检查
    window.addEventListener('load', () => {
        // 延迟检查，确保所有脚本都有机会执行
        setTimeout(ensureUILoaded, 2000);
    });

    // 添加可见性变化检查，处理标签页切换回来的情况
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // 页面变为可见时检查UI
            setTimeout(ensureUILoaded, 500);
        }
    });

})();