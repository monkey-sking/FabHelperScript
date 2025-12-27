// ==UserScript==
// @name         Fab Helper
// @name:zh-CN   Fab Helper
// @name:en      Fab Helper
// @namespace    https://www.fab.com/
// @version      3.5.0-20251227052328
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
// @downloadURL https://update.greasyfork.org/scripts/541307/Fab%20Helper%20%28%E4%BC%98%E5%8C%96%E7%89%88%29.user.js
// @updateURL https://update.greasyfork.org/scripts/541307/Fab%20Helper%20%28%E4%BC%98%E5%8C%96%E7%89%88%29.meta.js
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

  // src/i18n/en.js
  var en = {
    // 基础UI
    hide: "Hide Done",
    show: "Show Done",
    sync: "Sync State",
    execute: "Start Tasks",
    executing: "Executing...",
    stopExecute: "Stop",
    added: "Done",
    failed: "Failed",
    todo: "To-Do",
    hidden: "Hidden",
    visible: "Visible",
    clearLog: "Clear Log",
    copyLog: "Copy Log",
    copied: "Copied!",
    tab_dashboard: "Dashboard",
    tab_settings: "Settings",
    tab_debug: "Debug",
    // 应用标题和标签
    app_title: "Fab Helper",
    free_label: "Free",
    operation_log: "\u{1F4DD} Operation Log",
    position_indicator: "\u{1F4CD} ",
    // 按钮文本
    clear_all_data: "\u{1F5D1}\uFE0F Clear All Data",
    debug_mode: "Debug Mode",
    page_diagnosis: "Page Diagnosis",
    copy_btn: "Copy",
    clear_btn: "Clear",
    copied_success: "Copied!",
    // 状态文本
    status_history: "Status Cycle History",
    script_startup: "Script Startup",
    normal_period: "Normal Operation",
    rate_limited_period: "Rate Limited",
    current_normal: "Current: Normal",
    current_rate_limited: "Current: Rate Limited",
    no_history: "No history records to display.",
    no_saved_position: "No saved position",
    // 状态历史详细信息
    time_label: "Time",
    info_label: "Info",
    ended_at: "Ended at",
    duration_label: "Duration",
    requests_label: "Requests",
    requests_unit: "times",
    unknown_duration: "Unknown",
    // 日志消息
    log_init: "Assistant is online!",
    log_db_loaded: "Reading archive...",
    log_exec_no_tasks: "To-Do list is empty.",
    log_verify_success: "Verified and added to library!",
    log_verify_fail: "Couldn't add. Will retry later.",
    log_429_error: "Request limit hit! Taking a 15s break...",
    log_no_failed_tasks: "No failed tasks to retry.",
    log_requeuing_tasks: "Re-queuing {0} failed tasks...",
    log_detail_page: "This is a detail or worker page. Halting main script execution.",
    log_copy_failed: "Failed to copy log:",
    log_auto_add_enabled: '"Auto add" is enabled. Will process all tasks in the current "To-Do" queue.',
    log_auto_add_toggle: "Infinite scroll auto add tasks {0}.",
    log_remember_pos_toggle: "Remember waterfall browsing position {0}.",
    log_auto_resume_toggle: "429 auto resume function {0}.",
    log_auto_resume_start: "\u{1F504} 429 auto resume activated! Will refresh page in {0} seconds to attempt recovery...",
    log_auto_resume_detect: "\u{1F504} Detected 429 error, will auto refresh page in {0} seconds to attempt recovery...",
    // 调试日志消息
    debug_save_cursor: "Saving new recovery point: {0}",
    debug_prepare_hide: "Preparing to hide {0} cards, will use longer delay...",
    debug_unprocessed_cards: "Detected {0} unprocessed or inconsistent cards, re-executing hide logic",
    debug_new_content_loading: "Detected new content loading, waiting for API requests to complete...",
    debug_process_new_content: "Starting to process newly loaded content...",
    debug_unprocessed_cards_simple: "Detected unprocessed cards, re-executing hide logic",
    debug_hide_completed: "Completed hiding all {0} cards",
    debug_visible_after_hide: "\u{1F441}\uFE0F Actual visible items after hiding: {0}, hidden items: {1}",
    debug_filter_owned: "Filtered out {0} owned items and {1} items already in todo list.",
    debug_api_wait_complete: "API wait completed, starting to process {0} cards...",
    debug_api_stopped: "API activity stopped for {0}ms, continuing to process cards.",
    debug_wait_api_response: "Starting to wait for API response, will process {0} cards after API activity stops...",
    debug_api_wait_in_progress: "API wait process already in progress, adding current {0} cards to wait queue.",
    debug_cached_items: "Cached {0} item data",
    debug_no_cards_to_check: "No cards need to be checked",
    // Fab DOM Refresh 相关
    fab_dom_api_complete: "API query completed, confirmed {0} owned items.",
    fab_dom_checking_status: "Checking status of {0} items...",
    fab_dom_add_to_waitlist: "Added {0} item IDs to wait list, current wait list size: {0}",
    fab_dom_unknown_status: "{0} items have unknown status, waiting for native web requests to update",
    // 状态监控
    status_monitor_all_hidden: "Detected all items hidden in normal state ({0} items)",
    // 空搜索结果
    empty_search_initial: "Page just loaded, might be initial request, not triggering rate limit",
    // 游标相关
    cursor_patched_url: "Patched URL",
    cursor_injecting: "Injecting cursor. Original",
    page_patcher_match: "-> \u2705 MATCH! URL will be patched",
    // 自动刷新相关
    auto_refresh_countdown: "\u23F1\uFE0F Auto refresh countdown: {0} seconds...",
    rate_limit_success_request: "Successful request during rate limit +1, current consecutive: {0}/{1}, source: {2}",
    rate_limit_no_visible_continue: "\u{1F504} No visible items on page and in rate limit state, will continue auto refresh.",
    rate_limit_no_visible_suggest: "\u{1F504} In rate limit state with no visible items, suggest refreshing page",
    status_check_summary: "\u{1F4CA} Status check - Actually visible: {0}, Total cards: {1}, Hidden items: {2}",
    refresh_plan_exists: "Refresh plan already in progress, not scheduling new refresh (429 auto recovery)",
    page_content_rate_limit_detected: "[Page Content Detection] Detected page showing rate limit error message!",
    last_moment_check_cancelled: "\u26A0\uFE0F Last moment check: refresh conditions not met, auto refresh cancelled.",
    refresh_cancelled_visible_items: "\u23F9\uFE0F Detected {0} visible items on page before refresh, auto refresh cancelled.",
    // 限速检测来源
    rate_limit_source_page_content: "Page Content Detection",
    rate_limit_source_global_call: "Global Call",
    // 日志标签
    log_tag_auto_add: "Auto Add",
    // 自动添加相关消息
    auto_add_api_timeout: "API wait timeout, waited {0}ms, will continue processing cards.",
    auto_add_api_error: "Error while waiting for API: {0}",
    auto_add_new_tasks: "Added {0} new tasks to queue.",
    // HTTP状态检测
    http_status_check_performance_api: "Using Performance API check, no longer sending HEAD requests",
    // 页面状态检测
    page_status_hidden_no_visible: "\u{1F441}\uFE0F Detected {0} hidden items on page, but no visible items",
    page_status_suggest_refresh: "\u{1F504} Detected {0} hidden items on page, but no visible items, suggest refreshing page",
    // 限速状态相关
    rate_limit_already_active: "Already in rate limit state, source: {0}, ignoring new rate limit trigger: {1}",
    xhr_detected_429: "[XHR] Detected 429 status code: {0}",
    // 状态历史消息
    history_cleared_new_session: "History cleared, new session started",
    status_history_cleared: "Status history cleared.",
    duplicate_normal_status_detected: "Detected duplicate normal status record, source: {0}",
    execution_status_changed: "Detected execution status change: {0}",
    status_executing: "Executing",
    status_stopped: "Stopped",
    // 状态历史UI文本
    status_duration_label: "Duration: ",
    status_requests_label: "Requests: ",
    status_ended_at_label: "Ended at: ",
    status_started_at_label: "Started at: ",
    status_ongoing_label: "Ongoing: ",
    status_unknown_time: "Unknown time",
    status_unknown_duration: "Unknown",
    // 启动时状态检测
    startup_rate_limited: "Script started in rate limited state. Rate limit has lasted at least {0}s, source: {1}",
    status_unknown_source: "Unknown",
    // 请求成功来源
    request_source_search_response: "Search Response Success",
    request_source_xhr_search: "XHR Search Success",
    request_source_xhr_item: "XHR Item Request",
    consecutive_success_exit: "Consecutive {0} successful requests ({1})",
    search_response_parse_failed: "Search response parsing failed: {0}",
    // 缓存清理和Fab DOM相关
    cache_cleanup_complete: "[Cache] Cleanup complete, current cache size: items={0}, owned status={1}, prices={2}",
    fab_dom_no_new_owned: "[Fab DOM Refresh] API query completed, no new owned items found.",
    // 状态报告UI标签
    status_time_label: "Time",
    status_info_label: "Info",
    // 隐性限速检测和API监控
    implicit_rate_limit_detection: "[Implicit Rate Limit Detection]",
    scroll_api_monitoring: "[Scroll API Monitoring]",
    task_execution_time: "Task execution time: {0} seconds",
    detected_rate_limit_error: "Detected rate limit error info: {0}",
    detected_possible_rate_limit_empty: "Detected possible rate limit situation (empty result): {0}",
    detected_possible_rate_limit_scroll: "Detected possible rate limit situation: no card count increase after {0} consecutive scrolls.",
    detected_api_429_status: "Detected API request status code 429: {0}",
    detected_api_rate_limit_content: "Detected API response content contains rate limit info: {0}",
    // 限速来源标识
    source_implicit_rate_limit: "Implicit Rate Limit Detection",
    source_scroll_api_monitoring: "Scroll API Monitoring",
    // 设置项
    setting_auto_refresh: "Auto refresh when no items visible",
    setting_auto_add_scroll: "Auto add tasks on infinite scroll",
    setting_remember_position: "Remember waterfall browsing position",
    setting_auto_resume_429: "Auto resume after 429 errors",
    setting_debug_tooltip: "Enable detailed logging for troubleshooting",
    // 状态文本
    status_enabled: "enabled",
    status_disabled: "disabled",
    // 确认对话框
    confirm_clear_data: "Are you sure you want to clear all locally stored script data (completed, failed, to-do lists)? This action cannot be undone!",
    confirm_open_failed: "Are you sure you want to open {0} failed items in new tabs?",
    confirm_clear_history: "Are you sure you want to clear all status history records?",
    // 错误提示
    error_api_refresh: "API refresh failed. Please check console for error details and confirm you are logged in.",
    // 工具提示
    tooltip_open_failed: "Click to open all failed items",
    tooltip_executing_progress: "Executing: {0}/{1} ({2}%)",
    tooltip_executing: "Executing",
    tooltip_start_tasks: "Click to start executing tasks",
    // 其他
    goto_page_label: "Page:",
    goto_page_btn: "Go",
    page_reset: "Page: 1",
    untitled: "Untitled",
    cursor_mode: "Cursor Mode",
    using_native_requests: "Using native web requests, waiting: {0}",
    worker_closed: "Worker tab closed before completion",
    // 脚本启动和初始化
    log_script_starting: "Script starting...",
    log_network_filter_deprecated: "NetworkFilter module deprecated, functionality handled by PagePatcher.",
    // 限速状态检查
    log_rate_limit_check_active: "Rate limit check already in progress, skipping",
    log_rate_limit_check_start: "Starting rate limit status check...",
    log_page_content_rate_limit: "Page content contains rate limit info, confirming still rate limited",
    log_use_performance_api: "Using Performance API to check recent requests, no longer sending active requests",
    log_detected_429_in_10s: "Detected 429 status in recent 10s, judging as rate limited",
    log_detected_success_in_10s: "Detected successful request in recent 10s, judging as normal",
    log_insufficient_info_status: "Insufficient info to judge rate limit status, maintaining current state",
    log_rate_limit_check_failed: "Rate limit status check failed: {0}",
    // 游标和位置
    log_cursor_initialized_with: "[Cursor] Initialized. Loaded saved cursor: {0}...",
    log_cursor_initialized_empty: "[Cursor] Initialized. No saved cursor found.",
    log_cursor_restore_failed: "[Cursor] Failed to restore cursor state:",
    log_cursor_interceptors_applied: "[Cursor] Network interceptors applied.",
    log_cursor_skip_known_position: "[Cursor] Skipping known position save: {0}",
    log_cursor_skip_backtrack: "[Cursor] Skipping backtrack position: {0} (current: {1}), sort: {2}",
    log_cursor_save_error: "[Cursor] Error saving cursor:",
    log_url_sort_changed: 'Detected URL sort parameter change from "{0}" to "{1}"',
    log_sort_changed_position_cleared: "Cleared saved position due to sort method change",
    log_sort_check_error: "Error checking URL sort parameter: {0}",
    log_position_cleared: "Cleared saved browsing position.",
    log_sort_ascending: "Ascending",
    log_sort_descending: "Descending",
    // XHR/Fetch 限速检测
    log_xhr_rate_limit_detect: "[XHR Rate Limit] Detected rate limit, response: {0}",
    log_list_end_normal: "[List End] Reached end of list, normal situation: {0}...",
    log_empty_search_with_filters: "[Empty Search] Empty result but has filters, may be normal: {0}...",
    log_empty_search_already_limited: "[Empty Search] Already rate limited, not triggering again: {0}...",
    log_empty_search_page_loading: "[Empty Search] Page still loading, may be initial request: {0}...",
    log_debounce_intercept: "[Debounce] \u{1F6A6} Intercepted scroll request. Applying {0}ms delay...",
    log_debounce_discard: "[Debounce] \u{1F5D1}\uFE0F Discarded previous pending request.",
    log_debounce_sending: "[Debounce] \u25B6\uFE0F Sending latest scroll request: {0}",
    log_fetch_detected_429: "[Fetch] Detected 429 status code: {0}",
    log_fetch_rate_limit_detect: "[Fetch Rate Limit] Detected rate limit, response: {0}...",
    log_fetch_list_end: "[Fetch List End] Reached end, normal: {0}...",
    log_fetch_empty_with_filters: "[Fetch Empty] Empty with filters, may be normal: {0}...",
    log_fetch_empty_already_limited: "[Fetch Empty] Already limited, not triggering: {0}...",
    log_fetch_empty_page_loading: "[Fetch Empty] Page loading, may be initial: {0}...",
    log_fetch_implicit_rate_limit: "[Fetch Implicit] Possible rate limit (empty): {0}...",
    log_json_parse_error: "JSON parse error: {0}",
    log_response_length: "Response length: {0}, first 100 chars: {1}",
    log_handling_rate_limit_error: "Error handling rate limit: {0}",
    // 执行控制
    log_execution_stopped_manually: "Execution manually stopped by user.",
    log_todo_cleared_scan: "To-do list cleared. Will scan and add only visible items.",
    log_scanning_loaded_items: "Scanning loaded items...",
    log_executor_running_queued: "Executor running, new tasks queued for processing.",
    log_todo_empty_scanning: "To-do list empty, scanning current page...",
    log_request_no_results_not_counted: "Request successful but no valid results, not counting. Source: {0}",
    log_not_rate_limited_ignore_exit: "Not rate limited, ignoring exit request: {0}",
    log_found_todo_auto_resume: "Found {0} to-do tasks, auto-resuming execution...",
    log_dispatching_wait: "Dispatching tasks, please wait...",
    log_rate_limited_continue_todo: "In rate limited state, but will continue executing to-do tasks...",
    log_detected_todo_no_workers: "Detected to-do tasks but no active workers, attempting retry...",
    // 数据库和同步
    log_db_sync_cleared_failed: "[Fab DB Sync] Cleared {0} manually completed items from failed list.",
    log_no_unowned_in_batch: "No unowned items found in this batch.",
    log_no_truly_free_after_verify: "Found unowned items, but none truly free after price verification.",
    log_429_scan_paused: "Detected 429 error, requesting too frequently. Will pause scanning.",
    // 工作线程
    log_worker_tabs_cleared: "Cleared all worker tab states.",
    log_worker_task_cleared_closing: "Task data cleared, worker tab will close.",
    log_worker_instance_cooperate: "Detected active instance [{0}], worker tab will cooperate.",
    log_other_instance_report_ignore: "Received report from other instance [{0}], current [{1}] will ignore.",
    // 失败和重试
    log_failed_list_empty: "Failed list empty, no action needed.",
    // 调试模式
    log_debug_mode_toggled: "Debug mode {0}. {1}",
    log_debug_mode_detail_info: "Will display detailed log information",
    log_no_history_to_copy: "No history to copy.",
    // 启动和恢复
    log_execution_state_inconsistent: "Execution state inconsistent, restoring from storage: {0}",
    log_invalid_worker_report: "Received invalid worker report. Missing workerId or task.",
    log_all_tasks_completed: "All tasks completed.",
    log_all_tasks_completed_rate_limited: "All tasks completed and rate limited, will refresh to recover...",
    log_recovery_probe_failed: "Recovery probe failed. Still rate limited, will continue refresh...",
    // 实例管理
    log_not_active_instance: "Current instance not active, not executing tasks.",
    log_no_active_instance_activating: "No active instance detected, instance [{0}] activated.",
    log_inactive_instance_taking_over: "Previous instance [{0}] inactive, taking over.",
    log_is_search_page_activated: "This is search page, instance [{0}] activated.",
    // 可见性和刷新
    log_no_visible_items_todo_workers: "Rate limited with {0} to-do and {1} workers, not auto-refreshing.",
    log_visible_items_detected_skipping: "\u23F9\uFE0F Detected {0} visible items, not refreshing to avoid interruption.",
    log_please_complete_tasks_first: "Please complete or cancel these tasks before refreshing.",
    log_display_mode_switched: "\u{1F441}\uFE0F Display mode switched, current page has {0} visible items",
    position_label: "Location",
    log_entering_rate_limit_from: "\u{1F6A8} Entering RATE LIMIT state from [{0}]! Normal period lasted {1}s with {2} requests.",
    log_entering_rate_limit_from_v2: "\u{1F6A8} RATE LIMIT DETECTED from [{0}]! Normal operation lasted {1}s with {2} successful search requests.",
    rate_limit_recovery_success: "\u2705 Rate limit appears to be lifted from [{0}]. The 429 period lasted {1}s.",
    fab_dom_refresh_complete: "[Fab DOM Refresh] Complete. Updated {0} visible card states.",
    auto_refresh_disabled_rate_limit: "\u26A0\uFE0F In rate limit state, auto refresh is disabled. Please manually refresh the page if needed.",
    // 页面诊断
    log_diagnosis_complete: "Page diagnosis complete, check console output",
    log_diagnosis_failed: "Page diagnosis failed: {0}",
    // Auto resume
    log_auto_resume_page_loading: "[Auto-Resume] Page loaded in rate limited state. Running recovery probe...",
    log_recovery_probe_success: "\u2705 Recovery probe succeeded! Rate limit lifted, continuing normal operations.",
    log_tasks_still_running: "Still have {0} tasks running, waiting for them to finish before refresh...",
    log_todo_tasks_waiting: "{0} to-do tasks waiting to execute, will try to continue execution...",
    countdown_refresh_source: "Recovery probe failed",
    failed_list_empty: "Failed list is empty, no action needed.",
    opening_failed_items: "Opening {0} failed items...",
    // 账号验证
    auth_error: "Session expired: CSRF token not found, please log in again",
    auth_error_alert: "Session expired: Please log in again before using the script"
  };

  // src/i18n/zh.js
  var zh = {
    // 基础UI
    hide: "\u9690\u85CF\u5DF2\u5F97",
    show: "\u663E\u793A\u5DF2\u5F97",
    sync: "\u540C\u6B65\u72B6\u6001",
    execute: "\u4E00\u952E\u5F00\u5237",
    executing: "\u6267\u884C\u4E2D...",
    stopExecute: "\u505C\u6B62",
    added: "\u5DF2\u5165\u5E93",
    failed: "\u5931\u8D25",
    todo: "\u5F85\u529E",
    hidden: "\u5DF2\u9690\u85CF",
    visible: "\u53EF\u89C1",
    clearLog: "\u6E05\u7A7A\u65E5\u5FD7",
    copyLog: "\u590D\u5236\u65E5\u5FD7",
    copied: "\u5DF2\u590D\u5236!",
    tab_dashboard: "\u4EEA\u8868\u76D8",
    tab_settings: "\u8BBE\u5B9A",
    tab_debug: "\u8C03\u8BD5",
    // 应用标题和标签
    app_title: "Fab Helper",
    free_label: "\u514D\u8D39",
    operation_log: "\u{1F4DD} \u64CD\u4F5C\u65E5\u5FD7",
    position_indicator: "\u{1F4CD} ",
    // 按钮文本
    clear_all_data: "\u{1F5D1}\uFE0F \u6E05\u7A7A\u6240\u6709\u5B58\u6863",
    debug_mode: "\u8C03\u8BD5\u6A21\u5F0F",
    page_diagnosis: "\u9875\u9762\u8BCA\u65AD",
    copy_btn: "\u590D\u5236",
    clear_btn: "\u6E05\u7A7A",
    copied_success: "\u5DF2\u590D\u5236!",
    // 状态文本
    status_history: "\u72B6\u6001\u5468\u671F\u5386\u53F2\u8BB0\u5F55",
    script_startup: "\u811A\u672C\u542F\u52A8",
    normal_period: "\u6B63\u5E38\u8FD0\u884C\u671F",
    rate_limited_period: "\u9650\u901F\u671F",
    current_normal: "\u5F53\u524D: \u6B63\u5E38\u8FD0\u884C",
    current_rate_limited: "\u5F53\u524D: \u9650\u901F\u4E2D",
    no_history: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5386\u53F2\u8BB0\u5F55\u3002",
    no_saved_position: "\u65E0\u4FDD\u5B58\u4F4D\u7F6E",
    // 状态历史详细信息
    time_label: "\u65F6\u95F4",
    info_label: "\u4FE1\u606F",
    ended_at: "\u7ED3\u675F\u4E8E",
    duration_label: "\u6301\u7EED",
    requests_label: "\u8BF7\u6C42",
    requests_unit: "\u6B21",
    unknown_duration: "\u672A\u77E5",
    // 日志消息
    log_init: "\u52A9\u624B\u5DF2\u4E0A\u7EBF\uFF01",
    log_db_loaded: "\u6B63\u5728\u8BFB\u53D6\u5B58\u6863...",
    log_exec_no_tasks: '"\u5F85\u529E"\u6E05\u5355\u662F\u7A7A\u7684\u3002',
    log_verify_success: "\u641E\u5B9A\uFF01\u5DF2\u6210\u529F\u5165\u5E93\u3002",
    log_verify_fail: "\u54CE\u5440\uFF0C\u8FD9\u4E2A\u6CA1\u52A0\u4E0A\u3002\u7A0D\u540E\u4F1A\u81EA\u52A8\u91CD\u8BD5\uFF01",
    log_429_error: "\u8BF7\u6C42\u592A\u5FEB\u88AB\u670D\u52A1\u5668\u9650\u901F\u4E86\uFF01\u4F11\u606F15\u79D2\u540E\u81EA\u52A8\u91CD\u8BD5...",
    log_no_failed_tasks: "\u6CA1\u6709\u5931\u8D25\u7684\u4EFB\u52A1\u9700\u8981\u91CD\u8BD5\u3002",
    log_requeuing_tasks: "\u6B63\u5728\u91CD\u65B0\u6392\u961F {0} \u4E2A\u5931\u8D25\u4EFB\u52A1...",
    log_detail_page: "\u8FD9\u662F\u8BE6\u60C5\u9875\u6216\u5DE5\u4F5C\u6807\u7B7E\u9875\u3002\u505C\u6B62\u4E3B\u811A\u672C\u6267\u884C\u3002",
    log_copy_failed: "\u590D\u5236\u65E5\u5FD7\u5931\u8D25:",
    log_auto_add_enabled: '"\u81EA\u52A8\u6DFB\u52A0"\u5DF2\u5F00\u542F\u3002\u5C06\u76F4\u63A5\u5904\u7406\u5F53\u524D"\u5F85\u529E"\u961F\u5217\u4E2D\u7684\u6240\u6709\u4EFB\u52A1\u3002',
    log_auto_add_toggle: "\u65E0\u9650\u6EDA\u52A8\u81EA\u52A8\u6DFB\u52A0\u4EFB\u52A1\u5DF2{0}\u3002",
    log_remember_pos_toggle: "\u8BB0\u4F4F\u7011\u5E03\u6D41\u6D4F\u89C8\u4F4D\u7F6E\u529F\u80FD\u5DF2{0}\u3002",
    log_auto_resume_toggle: "429\u540E\u81EA\u52A8\u6062\u590D\u529F\u80FD\u5DF2{0}\u3002",
    log_auto_resume_start: "\u{1F504} 429\u81EA\u52A8\u6062\u590D\u542F\u52A8\uFF01\u5C06\u5728{0}\u79D2\u540E\u5237\u65B0\u9875\u9762\u5C1D\u8BD5\u6062\u590D...",
    log_auto_resume_detect: "\u{1F504} \u68C0\u6D4B\u5230429\u9519\u8BEF\uFF0C\u5C06\u5728{0}\u79D2\u540E\u81EA\u52A8\u5237\u65B0\u9875\u9762\u5C1D\u8BD5\u6062\u590D...",
    // 调试日志消息
    debug_save_cursor: "\u4FDD\u5B58\u65B0\u7684\u6062\u590D\u70B9: {0}",
    debug_prepare_hide: "\u51C6\u5907\u9690\u85CF {0} \u5F20\u5361\u7247\uFF0C\u5C06\u4F7F\u7528\u66F4\u957F\u7684\u5EF6\u8FDF...",
    debug_unprocessed_cards: "\u68C0\u6D4B\u5230 {0} \u4E2A\u672A\u5904\u7406\u6216\u72B6\u6001\u4E0D\u4E00\u81F4\u7684\u5361\u7247\uFF0C\u91CD\u65B0\u6267\u884C\u9690\u85CF\u903B\u8F91",
    debug_new_content_loading: "\u68C0\u6D4B\u5230\u65B0\u5185\u5BB9\u52A0\u8F7D\uFF0C\u7B49\u5F85API\u8BF7\u6C42\u5B8C\u6210...",
    debug_process_new_content: "\u5F00\u59CB\u5904\u7406\u65B0\u52A0\u8F7D\u7684\u5185\u5BB9...",
    debug_unprocessed_cards_simple: "\u68C0\u6D4B\u5230\u672A\u5904\u7406\u7684\u5361\u7247\uFF0C\u91CD\u65B0\u6267\u884C\u9690\u85CF\u903B\u8F91",
    debug_hide_completed: "\u5DF2\u5B8C\u6210\u6240\u6709 {0} \u5F20\u5361\u7247\u7684\u9690\u85CF",
    debug_visible_after_hide: "\u{1F441}\uFE0F \u9690\u85CF\u540E\u5B9E\u9645\u53EF\u89C1\u5546\u54C1\u6570: {0}\uFF0C\u9690\u85CF\u5546\u54C1\u6570: {1}",
    debug_filter_owned: "\u8FC7\u6EE4\u6389 {0} \u4E2A\u5DF2\u5165\u5E93\u5546\u54C1\u548C {1} \u4E2A\u5DF2\u5728\u5F85\u529E\u5217\u8868\u4E2D\u7684\u5546\u54C1\u3002",
    debug_api_wait_complete: "API\u7B49\u5F85\u5B8C\u6210\uFF0C\u5F00\u59CB\u5904\u7406 {0} \u5F20\u5361\u7247...",
    debug_api_stopped: "API\u6D3B\u52A8\u5DF2\u505C\u6B62 {0}ms\uFF0C\u7EE7\u7EED\u5904\u7406\u5361\u7247\u3002",
    debug_wait_api_response: "\u5F00\u59CB\u7B49\u5F85API\u54CD\u5E94\uFF0C\u5C06\u5728API\u6D3B\u52A8\u505C\u6B62\u540E\u5904\u7406 {0} \u5F20\u5361\u7247...",
    debug_api_wait_in_progress: "\u5DF2\u6709API\u7B49\u5F85\u8FC7\u7A0B\u5728\u8FDB\u884C\uFF0C\u5C06\u5F53\u524D {0} \u5F20\u5361\u7247\u52A0\u5165\u7B49\u5F85\u961F\u5217\u3002",
    debug_cached_items: "\u5DF2\u7F13\u5B58 {0} \u4E2A\u5546\u54C1\u6570\u636E",
    debug_no_cards_to_check: "\u6CA1\u6709\u9700\u8981\u68C0\u67E5\u7684\u5361\u7247",
    // Fab DOM Refresh 相关
    fab_dom_api_complete: "API\u67E5\u8BE2\u5B8C\u6210\uFF0C\u5171\u786E\u8BA4 {0} \u4E2A\u5DF2\u62E5\u6709\u7684\u9879\u76EE\u3002",
    fab_dom_checking_status: "\u6B63\u5728\u68C0\u67E5 {0} \u4E2A\u9879\u76EE\u7684\u72B6\u6001...",
    fab_dom_add_to_waitlist: "\u6DFB\u52A0 {0} \u4E2A\u5546\u54C1ID\u5230\u7B49\u5F85\u5217\u8868\uFF0C\u5F53\u524D\u7B49\u5F85\u5217\u8868\u5927\u5C0F: {0}",
    fab_dom_unknown_status: "\u6709 {0} \u4E2A\u5546\u54C1\u72B6\u6001\u672A\u77E5\uFF0C\u7B49\u5F85\u7F51\u9875\u539F\u751F\u8BF7\u6C42\u66F4\u65B0",
    // 状态监控
    status_monitor_all_hidden: "\u68C0\u6D4B\u5230\u6B63\u5E38\u72B6\u6001\u4E0B\u6240\u6709\u5546\u54C1\u90FD\u88AB\u9690\u85CF ({0}\u4E2A)",
    // 空搜索结果
    empty_search_initial: "\u9875\u9762\u521A\u521A\u52A0\u8F7D\uFF0C\u53EF\u80FD\u662F\u521D\u59CB\u8BF7\u6C42\uFF0C\u4E0D\u89E6\u53D1\u9650\u901F",
    // 游标相关
    cursor_patched_url: "Patched URL",
    cursor_injecting: "Injecting cursor. Original",
    page_patcher_match: "-> \u2705 MATCH! URL will be patched",
    // 自动刷新相关
    auto_refresh_countdown: "\u23F1\uFE0F \u81EA\u52A8\u5237\u65B0\u5012\u8BA1\u65F6: {0} \u79D2...",
    rate_limit_success_request: "\u9650\u901F\u72B6\u6001\u4E0B\u6210\u529F\u8BF7\u6C42 +1\uFF0C\u5F53\u524D\u8FDE\u7EED\u6210\u529F: {0}/{1}\uFF0C\u6765\u6E90: {2}",
    rate_limit_no_visible_continue: "\u{1F504} \u9875\u9762\u4E0A\u6CA1\u6709\u53EF\u89C1\u5546\u54C1\u4E14\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u5C06\u7EE7\u7EED\u81EA\u52A8\u5237\u65B0\u3002",
    rate_limit_no_visible_suggest: "\u{1F504} \u5904\u4E8E\u9650\u901F\u72B6\u6001\u4E14\u6CA1\u6709\u53EF\u89C1\u5546\u54C1\uFF0C\u5EFA\u8BAE\u5237\u65B0\u9875\u9762",
    status_check_summary: "\u{1F4CA} \u72B6\u6001\u68C0\u67E5 - \u5B9E\u9645\u53EF\u89C1: {0}, \u603B\u5361\u7247: {1}, \u9690\u85CF\u5546\u54C1\u6570: {2}",
    refresh_plan_exists: "\u5DF2\u6709\u5237\u65B0\u8BA1\u5212\u6B63\u5728\u8FDB\u884C\u4E2D\uFF0C\u4E0D\u518D\u5B89\u6392\u65B0\u7684\u5237\u65B0 (429\u81EA\u52A8\u6062\u590D)",
    page_content_rate_limit_detected: "[\u9875\u9762\u5185\u5BB9\u68C0\u6D4B] \u68C0\u6D4B\u5230\u9875\u9762\u663E\u793A\u9650\u901F\u9519\u8BEF\u4FE1\u606F\uFF01",
    last_moment_check_cancelled: "\u26A0\uFE0F \u6700\u540E\u4E00\u523B\u68C0\u67E5\uFF1A\u5237\u65B0\u6761\u4EF6\u4E0D\u6EE1\u8DB3\uFF0C\u81EA\u52A8\u5237\u65B0\u5DF2\u53D6\u6D88\u3002",
    refresh_cancelled_visible_items: "\u23F9\uFE0F \u5237\u65B0\u524D\u68C0\u6D4B\u5230\u9875\u9762\u4E0A\u6709 {0} \u4E2A\u53EF\u89C1\u5546\u54C1\uFF0C\u5DF2\u53D6\u6D88\u81EA\u52A8\u5237\u65B0\u3002",
    // 限速检测来源
    rate_limit_source_page_content: "\u9875\u9762\u5185\u5BB9\u68C0\u6D4B",
    rate_limit_source_global_call: "\u5168\u5C40\u8C03\u7528",
    // 日志标签
    log_tag_auto_add: "\u81EA\u52A8\u6DFB\u52A0",
    // 自动添加相关消息
    auto_add_api_timeout: "API\u7B49\u5F85\u8D85\u65F6\uFF0C\u5DF2\u7B49\u5F85 {0}ms\uFF0C\u5C06\u7EE7\u7EED\u5904\u7406\u5361\u7247\u3002",
    auto_add_api_error: "\u7B49\u5F85API\u65F6\u51FA\u9519: {0}",
    auto_add_new_tasks: "\u65B0\u589E {0} \u4E2A\u4EFB\u52A1\u5230\u961F\u5217\u3002",
    // HTTP状态检测
    http_status_check_performance_api: "\u4F7F\u7528Performance API\u68C0\u67E5\uFF0C\u4E0D\u518D\u53D1\u9001HEAD\u8BF7\u6C42",
    // 页面状态检测
    page_status_hidden_no_visible: "\u{1F441}\uFE0F \u68C0\u6D4B\u5230\u9875\u9762\u4E0A\u6709 {0} \u4E2A\u9690\u85CF\u5546\u54C1\uFF0C\u4F46\u6CA1\u6709\u53EF\u89C1\u5546\u54C1",
    page_status_suggest_refresh: "\u{1F504} \u68C0\u6D4B\u5230\u9875\u9762\u4E0A\u6709 {0} \u4E2A\u9690\u85CF\u5546\u54C1\uFF0C\u4F46\u6CA1\u6709\u53EF\u89C1\u5546\u54C1\uFF0C\u5EFA\u8BAE\u5237\u65B0\u9875\u9762",
    // 限速状态相关
    rate_limit_already_active: "\u5DF2\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u6765\u6E90: {0}\uFF0C\u5FFD\u7565\u65B0\u7684\u9650\u901F\u89E6\u53D1: {1}",
    xhr_detected_429: "[XHR] \u68C0\u6D4B\u5230429\u72B6\u6001\u7801: {0}",
    // 状态历史消息
    history_cleared_new_session: "\u5386\u53F2\u8BB0\u5F55\u5DF2\u6E05\u7A7A\uFF0C\u65B0\u4F1A\u8BDD\u5F00\u59CB",
    status_history_cleared: "\u72B6\u6001\u5386\u53F2\u8BB0\u5F55\u5DF2\u6E05\u7A7A\u3002",
    duplicate_normal_status_detected: "\u68C0\u6D4B\u5230\u91CD\u590D\u7684\u6B63\u5E38\u72B6\u6001\u8BB0\u5F55\uFF0C\u6765\u6E90: {0}",
    execution_status_changed: "\u68C0\u6D4B\u5230\u6267\u884C\u72B6\u6001\u53D8\u5316\uFF1A{0}",
    status_executing: "\u6267\u884C\u4E2D",
    status_stopped: "\u5DF2\u505C\u6B62",
    // 状态历史UI文本
    status_duration_label: "\u6301\u7EED\u65F6\u95F4: ",
    status_requests_label: "\u671F\u95F4\u8BF7\u6C42\u6570: ",
    status_ended_at_label: "\u7ED3\u675F\u4E8E: ",
    status_started_at_label: "\u5F00\u59CB\u4E8E: ",
    status_ongoing_label: "\u5DF2\u6301\u7EED: ",
    status_unknown_time: "\u672A\u77E5\u65F6\u95F4",
    status_unknown_duration: "\u672A\u77E5",
    // 启动时状态检测
    startup_rate_limited: "\u811A\u672C\u542F\u52A8\u65F6\u5904\u4E8E\u9650\u901F\u72B6\u6001\u3002\u9650\u901F\u5DF2\u6301\u7EED\u81F3\u5C11 {0}s\uFF0C\u6765\u6E90: {1}",
    status_unknown_source: "\u672A\u77E5",
    // 请求成功来源
    request_source_search_response: "\u641C\u7D22\u54CD\u5E94\u6210\u529F",
    request_source_xhr_search: "XHR\u641C\u7D22\u6210\u529F",
    request_source_xhr_item: "XHR\u5546\u54C1\u8BF7\u6C42",
    consecutive_success_exit: "\u8FDE\u7EED{0}\u6B21\u6210\u529F\u8BF7\u6C42 ({1})",
    search_response_parse_failed: "\u641C\u7D22\u54CD\u5E94\u89E3\u6790\u5931\u8D25: {0}",
    // 缓存清理和Fab DOM相关
    cache_cleanup_complete: "[Cache] \u6E05\u7406\u5B8C\u6210\uFF0C\u5F53\u524D\u7F13\u5B58\u5927\u5C0F: \u5546\u54C1={0}, \u62E5\u6709\u72B6\u6001={1}, \u4EF7\u683C={2}",
    fab_dom_no_new_owned: "[Fab DOM Refresh] API\u67E5\u8BE2\u5B8C\u6210\uFF0C\u6CA1\u6709\u53D1\u73B0\u65B0\u7684\u5DF2\u62E5\u6709\u9879\u76EE\u3002",
    // 状态报告UI标签
    status_time_label: "\u65F6\u95F4",
    status_info_label: "\u4FE1\u606F",
    // 隐性限速检测和API监控
    implicit_rate_limit_detection: "[\u9690\u6027\u9650\u901F\u68C0\u6D4B]",
    scroll_api_monitoring: "[\u6EDA\u52A8API\u76D1\u63A7]",
    task_execution_time: "\u4EFB\u52A1\u6267\u884C\u65F6\u95F4: {0}\u79D2",
    detected_rate_limit_error: "\u68C0\u6D4B\u5230\u9650\u901F\u9519\u8BEF\u4FE1\u606F: {0}",
    detected_possible_rate_limit_empty: "\u68C0\u6D4B\u5230\u53EF\u80FD\u7684\u9650\u901F\u60C5\u51B5(\u7A7A\u7ED3\u679C): {0}",
    detected_possible_rate_limit_scroll: "\u68C0\u6D4B\u5230\u53EF\u80FD\u7684\u9650\u901F\u60C5\u51B5\uFF1A\u8FDE\u7EED{0}\u6B21\u6EDA\u52A8\u540E\u5361\u7247\u6570\u91CF\u672A\u589E\u52A0\u3002",
    detected_api_429_status: "\u68C0\u6D4B\u5230API\u8BF7\u6C42\u72B6\u6001\u7801\u4E3A429: {0}",
    detected_api_rate_limit_content: "\u68C0\u6D4B\u5230API\u54CD\u5E94\u5185\u5BB9\u5305\u542B\u9650\u901F\u4FE1\u606F: {0}",
    // 限速来源标识
    source_implicit_rate_limit: "\u9690\u6027\u9650\u901F\u68C0\u6D4B",
    source_scroll_api_monitoring: "\u6EDA\u52A8API\u76D1\u63A7",
    // 设置项
    setting_auto_refresh: "\u65E0\u5546\u54C1\u53EF\u89C1\u65F6\u81EA\u52A8\u5237\u65B0",
    setting_auto_add_scroll: "\u65E0\u9650\u6EDA\u52A8\u65F6\u81EA\u52A8\u6DFB\u52A0\u4EFB\u52A1",
    setting_remember_position: "\u8BB0\u4F4F\u7011\u5E03\u6D41\u6D4F\u89C8\u4F4D\u7F6E",
    setting_auto_resume_429: "429\u540E\u81EA\u52A8\u6062\u590D\u5E76\u7EE7\u7EED",
    setting_debug_tooltip: "\u542F\u7528\u8BE6\u7EC6\u65E5\u5FD7\u8BB0\u5F55\uFF0C\u7528\u4E8E\u6392\u67E5\u95EE\u9898",
    // 状态文本
    status_enabled: "\u5F00\u542F",
    status_disabled: "\u5173\u95ED",
    // 确认对话框
    confirm_clear_data: "\u60A8\u786E\u5B9A\u8981\u6E05\u7A7A\u6240\u6709\u672C\u5730\u5B58\u50A8\u7684\u811A\u672C\u6570\u636E\uFF08\u5DF2\u5B8C\u6210\u3001\u5931\u8D25\u3001\u5F85\u529E\u5217\u8868\uFF09\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u9006\uFF01",
    confirm_open_failed: "\u60A8\u786E\u5B9A\u8981\u5728\u65B0\u6807\u7B7E\u9875\u4E2D\u6253\u5F00 {0} \u4E2A\u5931\u8D25\u7684\u9879\u76EE\u5417\uFF1F",
    confirm_clear_history: "\u60A8\u786E\u5B9A\u8981\u6E05\u7A7A\u6240\u6709\u72B6\u6001\u5386\u53F2\u8BB0\u5F55\u5417\uFF1F",
    // 错误提示
    error_api_refresh: "API \u5237\u65B0\u5931\u8D25\u3002\u8BF7\u68C0\u67E5\u63A7\u5236\u53F0\u4E2D\u7684\u9519\u8BEF\u4FE1\u606F\uFF0C\u5E76\u786E\u8BA4\u60A8\u5DF2\u767B\u5F55\u3002",
    // 工具提示
    tooltip_open_failed: "\u70B9\u51FB\u6253\u5F00\u6240\u6709\u5931\u8D25\u7684\u9879\u76EE",
    tooltip_executing_progress: "\u6267\u884C\u4E2D: {0}/{1} ({2}%)",
    tooltip_executing: "\u6267\u884C\u4E2D",
    tooltip_start_tasks: "\u70B9\u51FB\u5F00\u59CB\u6267\u884C\u4EFB\u52A1",
    // 其他
    goto_page_label: "\u9875\u7801:",
    goto_page_btn: "\u8DF3\u8F6C",
    page_reset: "Page: 1",
    untitled: "Untitled",
    cursor_mode: "Cursor Mode",
    using_native_requests: "\u4F7F\u7528\u7F51\u9875\u539F\u751F\u8BF7\u6C42\uFF0C\u7B49\u5F85\u4E2D: {0}",
    worker_closed: "\u5DE5\u4F5C\u6807\u7B7E\u9875\u5728\u5B8C\u6210\u524D\u5173\u95ED",
    // 脚本启动和初始化
    log_script_starting: "\u811A\u672C\u5F00\u59CB\u8FD0\u884C...",
    log_network_filter_deprecated: "\u7F51\u7EDC\u8FC7\u6EE4\u5668(NetworkFilter)\u6A21\u5757\u5DF2\u5F03\u7528\uFF0C\u529F\u80FD\u7531\u8865\u4E01\u7A0B\u5E8F(PagePatcher)\u5904\u7406\u3002",
    // 限速状态检查
    log_rate_limit_check_active: "\u5DF2\u6709\u9650\u901F\u72B6\u6001\u68C0\u67E5\u6B63\u5728\u8FDB\u884C\uFF0C\u8DF3\u8FC7\u672C\u6B21\u68C0\u67E5",
    log_rate_limit_check_start: "\u5F00\u59CB\u68C0\u67E5\u9650\u901F\u72B6\u6001...",
    log_page_content_rate_limit: "\u9875\u9762\u5185\u5BB9\u5305\u542B\u9650\u901F\u4FE1\u606F\uFF0C\u786E\u8BA4\u4ECD\u5904\u4E8E\u9650\u901F\u72B6\u6001",
    log_use_performance_api: "\u4F7F\u7528Performance API\u68C0\u67E5\u6700\u8FD1\u7684\u7F51\u7EDC\u8BF7\u6C42\uFF0C\u4E0D\u518D\u4E3B\u52A8\u53D1\u9001API\u8BF7\u6C42",
    log_detected_429_in_10s: "\u68C0\u6D4B\u5230\u6700\u8FD110\u79D2\u5185\u6709429\u72B6\u6001\u7801\u7684\u8BF7\u6C42\uFF0C\u5224\u65AD\u4E3A\u9650\u901F\u72B6\u6001",
    log_detected_success_in_10s: "\u68C0\u6D4B\u5230\u6700\u8FD110\u79D2\u5185\u6709\u6210\u529F\u7684API\u8BF7\u6C42\uFF0C\u5224\u65AD\u4E3A\u6B63\u5E38\u72B6\u6001",
    log_insufficient_info_status: "\u6CA1\u6709\u8DB3\u591F\u7684\u4FE1\u606F\u5224\u65AD\u9650\u901F\u72B6\u6001\uFF0C\u4FDD\u6301\u5F53\u524D\u72B6\u6001",
    log_rate_limit_check_failed: "\u9650\u901F\u72B6\u6001\u68C0\u67E5\u5931\u8D25: {0}",
    // 游标和位置
    log_cursor_initialized_with: "[Cursor] \u521D\u59CB\u5316\u5B8C\u6210\u3002\u52A0\u8F7D\u5DF2\u4FDD\u5B58\u7684cursor: {0}...",
    log_cursor_initialized_empty: "[Cursor] \u521D\u59CB\u5316\u5B8C\u6210\u3002\u672A\u627E\u5230\u5DF2\u4FDD\u5B58\u7684cursor\u3002",
    log_cursor_restore_failed: "[Cursor] \u6062\u590Dcursor\u72B6\u6001\u5931\u8D25:",
    log_cursor_interceptors_applied: "[Cursor] \u7F51\u7EDC\u62E6\u622A\u5668\u5DF2\u5E94\u7528\u3002",
    log_cursor_skip_known_position: "[Cursor] \u8DF3\u8FC7\u5DF2\u77E5\u4F4D\u7F6E\u7684\u4FDD\u5B58: {0}",
    log_cursor_skip_backtrack: "[Cursor] \u8DF3\u8FC7\u56DE\u9000\u4F4D\u7F6E: {0} (\u5F53\u524D\u4F4D\u7F6E: {1}), \u6392\u5E8F: {2}",
    log_cursor_save_error: "[Cursor] \u4FDD\u5B58cursor\u65F6\u51FA\u9519:",
    log_url_sort_changed: '\u68C0\u6D4B\u5230URL\u6392\u5E8F\u53C2\u6570\u53D8\u66F4\uFF0C\u6392\u5E8F\u65B9\u5F0F\u5DF2\u4ECE"{0}"\u66F4\u6539\u4E3A"{1}"',
    log_sort_changed_position_cleared: "\u7531\u4E8E\u6392\u5E8F\u65B9\u5F0F\u53D8\u66F4\uFF0C\u5DF2\u6E05\u9664\u4FDD\u5B58\u7684\u6D4F\u89C8\u4F4D\u7F6E",
    log_sort_check_error: "\u68C0\u67E5URL\u6392\u5E8F\u53C2\u6570\u65F6\u51FA\u9519: {0}",
    log_position_cleared: "\u5DF2\u6E05\u9664\u5DF2\u4FDD\u5B58\u7684\u6D4F\u89C8\u4F4D\u7F6E\u3002",
    log_sort_ascending: "\u5347\u5E8F",
    log_sort_descending: "\u964D\u5E8F",
    // XHR/Fetch 限速检测
    log_xhr_rate_limit_detect: "[XHR\u9650\u901F\u68C0\u6D4B] \u68C0\u6D4B\u5230\u9650\u901F\u60C5\u51B5\uFF0C\u539F\u59CB\u54CD\u5E94: {0}",
    log_list_end_normal: "[\u5217\u8868\u672B\u5C3E] \u68C0\u6D4B\u5230\u5DF2\u5230\u8FBE\u5217\u8868\u672B\u5C3E\uFF0C\u8FD9\u662F\u6B63\u5E38\u60C5\u51B5\uFF0C\u4E0D\u89E6\u53D1\u9650\u901F: {0}...",
    log_empty_search_with_filters: "[\u7A7A\u641C\u7D22\u7ED3\u679C] \u68C0\u6D4B\u5230\u641C\u7D22\u7ED3\u679C\u4E3A\u7A7A\uFF0C\u4F46\u5305\u542B\u7279\u6B8A\u8FC7\u6EE4\u6761\u4EF6\uFF0C\u8FD9\u53EF\u80FD\u662F\u6B63\u5E38\u60C5\u51B5: {0}...",
    log_empty_search_already_limited: "[\u7A7A\u641C\u7D22\u7ED3\u679C] \u5DF2\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u4E0D\u91CD\u590D\u89E6\u53D1: {0}...",
    log_empty_search_page_loading: "[\u7A7A\u641C\u7D22\u7ED3\u679C] \u9875\u9762\u5C1A\u672A\u5B8C\u5168\u52A0\u8F7D\uFF0C\u53EF\u80FD\u662F\u521D\u59CB\u8BF7\u6C42\uFF0C\u4E0D\u89E6\u53D1\u9650\u901F: {0}...",
    log_debounce_intercept: "[Debounce] \u{1F6A6} \u62E6\u622A\u6EDA\u52A8\u8BF7\u6C42\u3002\u5E94\u7528{0}ms\u5EF6\u8FDF...",
    log_debounce_discard: "[Debounce] \u{1F5D1}\uFE0F \u4E22\u5F03\u4E4B\u524D\u7684\u6302\u8D77\u8BF7\u6C42\u3002",
    log_debounce_sending: "[Debounce] \u25B6\uFE0F \u53D1\u9001\u6700\u65B0\u6EDA\u52A8\u8BF7\u6C42: {0}",
    log_fetch_detected_429: "[Fetch] \u68C0\u6D4B\u5230429\u72B6\u6001\u7801: {0}",
    log_fetch_rate_limit_detect: "[Fetch\u9650\u901F\u68C0\u6D4B] \u68C0\u6D4B\u5230\u9650\u901F\u60C5\u51B5\uFF0C\u539F\u59CB\u54CD\u5E94: {0}...",
    log_fetch_list_end: "[Fetch\u5217\u8868\u672B\u5C3E] \u68C0\u6D4B\u5230\u5DF2\u5230\u8FBE\u5217\u8868\u672B\u5C3E\uFF0C\u8FD9\u662F\u6B63\u5E38\u60C5\u51B5\uFF0C\u4E0D\u89E6\u53D1\u9650\u901F: {0}...",
    log_fetch_empty_with_filters: "[Fetch\u7A7A\u641C\u7D22\u7ED3\u679C] \u68C0\u6D4B\u5230\u641C\u7D22\u7ED3\u679C\u4E3A\u7A7A\uFF0C\u4F46\u5305\u542B\u7279\u6B8A\u8FC7\u6EE4\u6761\u4EF6\uFF0C\u8FD9\u53EF\u80FD\u662F\u6B63\u5E38\u60C5\u51B5: {0}...",
    log_fetch_empty_already_limited: "[Fetch\u7A7A\u641C\u7D22\u7ED3\u679C] \u5DF2\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u4E0D\u91CD\u590D\u89E6\u53D1: {0}...",
    log_fetch_empty_page_loading: "[Fetch\u7A7A\u641C\u7D22\u7ED3\u679C] \u9875\u9762\u5C1A\u672A\u5B8C\u5168\u52A0\u8F7D\uFF0C\u53EF\u80FD\u662F\u521D\u59CB\u8BF7\u6C42\uFF0C\u4E0D\u89E6\u53D1\u9650\u901F: {0}...",
    log_fetch_implicit_rate_limit: "[Fetch\u9690\u6027\u9650\u901F] \u68C0\u6D4B\u5230\u53EF\u80FD\u7684\u9650\u901F\u60C5\u51B5(\u7A7A\u7ED3\u679C): {0}...",
    log_json_parse_error: "JSON\u89E3\u6790\u9519\u8BEF: {0}",
    log_response_length: "\u54CD\u5E94\u957F\u5EA6: {0}, \u524D100\u4E2A\u5B57\u7B26: {1}",
    log_handling_rate_limit_error: "\u5904\u7406\u9650\u901F\u65F6\u51FA\u9519: {0}",
    // 执行控制
    log_execution_stopped_manually: "\u6267\u884C\u5DF2\u7531\u7528\u6237\u624B\u52A8\u505C\u6B62\u3002",
    log_todo_cleared_scan: "\u5F85\u529E\u5217\u8868\u5DF2\u6E05\u7A7A\u3002\u73B0\u5728\u5C06\u626B\u63CF\u5E76\u4EC5\u6DFB\u52A0\u5F53\u524D\u53EF\u89C1\u7684\u9879\u76EE\u3002",
    log_scanning_loaded_items: "\u6B63\u5728\u626B\u63CF\u5DF2\u52A0\u8F7D\u5B8C\u6210\u7684\u5546\u54C1...",
    log_executor_running_queued: "\u6267\u884C\u5668\u5DF2\u5728\u8FD0\u884C\u4E2D\uFF0C\u65B0\u4EFB\u52A1\u5DF2\u52A0\u5165\u961F\u5217\u7B49\u5F85\u5904\u7406\u3002",
    log_todo_empty_scanning: "\u5F85\u529E\u6E05\u5355\u4E3A\u7A7A\uFF0C\u6B63\u5728\u626B\u63CF\u5F53\u524D\u9875\u9762...",
    log_request_no_results_not_counted: "\u8BF7\u6C42\u6210\u529F\u4F46\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7ED3\u679C\uFF0C\u4E0D\u8BA1\u5165\u8FDE\u7EED\u6210\u529F\u8BA1\u6570\u3002\u6765\u6E90: {0}",
    log_not_rate_limited_ignore_exit: "\u5F53\u524D\u4E0D\u662F\u9650\u901F\u72B6\u6001\uFF0C\u5FFD\u7565\u9000\u51FA\u9650\u901F\u8BF7\u6C42: {0}",
    log_found_todo_auto_resume: "\u53D1\u73B0 {0} \u4E2A\u5F85\u529E\u4EFB\u52A1\uFF0C\u81EA\u52A8\u6062\u590D\u6267\u884C...",
    log_dispatching_wait: "\u6B63\u5728\u6D3E\u53D1\u4EFB\u52A1\u4E2D\uFF0C\u8BF7\u7A0D\u5019...",
    log_rate_limited_continue_todo: "\u5F53\u524D\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u4F46\u4ECD\u5C06\u7EE7\u7EED\u6267\u884C\u5F85\u529E\u4EFB\u52A1...",
    log_detected_todo_no_workers: "\u68C0\u6D4B\u5230\u6709\u5F85\u529E\u4EFB\u52A1\u4F46\u6CA1\u6709\u6D3B\u52A8\u5DE5\u4F5C\u7EBF\u7A0B\uFF0C\u5C1D\u8BD5\u91CD\u65B0\u6267\u884C...",
    // 数据库和同步
    log_db_sync_cleared_failed: '[Fab DB Sync] \u4ECE"\u5931\u8D25"\u5217\u8868\u4E2D\u6E05\u9664\u4E86 {0} \u4E2A\u5DF2\u624B\u52A8\u5B8C\u6210\u7684\u5546\u54C1\u3002',
    log_no_unowned_in_batch: "\u672C\u6279\u6B21\u4E2D\u6CA1\u6709\u53D1\u73B0\u672A\u62E5\u6709\u7684\u5546\u54C1\u3002",
    log_no_truly_free_after_verify: "\u627E\u5230\u672A\u62E5\u6709\u7684\u5546\u54C1\uFF0C\u4F46\u4EF7\u683C\u9A8C\u8BC1\u540E\u6CA1\u6709\u771F\u6B63\u514D\u8D39\u7684\u5546\u54C1\u3002",
    log_429_scan_paused: "\u68C0\u6D4B\u5230429\u9519\u8BEF\uFF0C\u53EF\u80FD\u662F\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\u3002\u5C06\u6682\u505C\u626B\u63CF\u3002",
    // 工作线程
    log_worker_tabs_cleared: "\u5DF2\u6E05\u7406\u6240\u6709\u5DE5\u4F5C\u6807\u7B7E\u9875\u7684\u72B6\u6001\u3002",
    log_worker_task_cleared_closing: "\u4EFB\u52A1\u6570\u636E\u5DF2\u88AB\u6E05\u7406\uFF0C\u5DE5\u4F5C\u6807\u7B7E\u9875\u5C06\u5173\u95ED\u3002",
    log_worker_instance_cooperate: "\u68C0\u6D4B\u5230\u6D3B\u8DC3\u7684\u811A\u672C\u5B9E\u4F8B [{0}]\uFF0C\u5F53\u524D\u5DE5\u4F5C\u6807\u7B7E\u9875\u5C06\u4E0E\u4E4B\u534F\u4F5C\u3002",
    log_other_instance_report_ignore: "\u6536\u5230\u6765\u81EA\u5176\u4ED6\u5B9E\u4F8B [{0}] \u7684\u5DE5\u4F5C\u62A5\u544A\uFF0C\u5F53\u524D\u5B9E\u4F8B [{1}] \u5C06\u5FFD\u7565\u3002",
    // 失败和重试
    log_failed_list_empty: "\u5931\u8D25\u5217\u8868\u4E3A\u7A7A\uFF0C\u65E0\u9700\u64CD\u4F5C\u3002",
    // 调试模式
    log_debug_mode_toggled: "\u8C03\u8BD5\u6A21\u5F0F\u5DF2{0}\u3002{1}",
    log_debug_mode_detail_info: "\u5C06\u663E\u793A\u8BE6\u7EC6\u65E5\u5FD7\u4FE1\u606F",
    log_no_history_to_copy: "\u6CA1\u6709\u5386\u53F2\u8BB0\u5F55\u53EF\u4F9B\u590D\u5236\u3002",
    // 启动和恢复
    log_execution_state_inconsistent: "\u6267\u884C\u72B6\u6001\u4E0D\u4E00\u81F4\uFF0C\u4ECE\u5B58\u50A8\u4E2D\u6062\u590D\uFF1A{0}",
    log_invalid_worker_report: "\u6536\u5230\u65E0\u6548\u7684\u5DE5\u4F5C\u62A5\u544A\u3002\u7F3A\u5C11workerId\u6216task\u3002",
    log_all_tasks_completed: "\u6240\u6709\u4EFB\u52A1\u5DF2\u5B8C\u6210\u3002",
    log_all_tasks_completed_rate_limited: "\u6240\u6709\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF0C\u4E14\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u5C06\u5237\u65B0\u9875\u9762\u5C1D\u8BD5\u6062\u590D...",
    log_recovery_probe_failed: "\u6062\u590D\u63A2\u6D4B\u5931\u8D25\u3002\u4ECD\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u5C06\u7EE7\u7EED\u968F\u673A\u5237\u65B0...",
    // 实例管理
    log_not_active_instance: "\u5F53\u524D\u5B9E\u4F8B\u4E0D\u662F\u6D3B\u8DC3\u5B9E\u4F8B\uFF0C\u4E0D\u6267\u884C\u4EFB\u52A1\u3002",
    log_no_active_instance_activating: "\u6CA1\u6709\u68C0\u6D4B\u5230\u6D3B\u8DC3\u5B9E\u4F8B\uFF0C\u5F53\u524D\u5B9E\u4F8B [{0}] \u5DF2\u6FC0\u6D3B\u3002",
    log_inactive_instance_taking_over: "\u524D\u4E00\u4E2A\u5B9E\u4F8B [{0}] \u4E0D\u6D3B\u8DC3\uFF0C\u5F53\u524D\u5B9E\u4F8B\u63A5\u7BA1\u3002",
    log_is_search_page_activated: "\u5F53\u524D\u662F\u641C\u7D22\u9875\u9762\uFF0C\u5B9E\u4F8B [{0}] \u5DF2\u6FC0\u6D3B\u3002",
    // 可见性和刷新
    log_no_visible_items_todo_workers: "\u867D\u7136\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u4F46\u68C0\u6D4B\u5230\u6709 {0} \u4E2A\u5F85\u529E\u4EFB\u52A1\u548C {1} \u4E2A\u6D3B\u52A8\u5DE5\u4F5C\u7EBF\u7A0B\uFF0C\u6682\u4E0D\u81EA\u52A8\u5237\u65B0\u9875\u9762\u3002",
    log_visible_items_detected_skipping: "\u23F9\uFE0F \u68C0\u6D4B\u5230\u9875\u9762\u4E0A\u6709 {0} \u4E2A\u53EF\u89C1\u5546\u54C1\uFF0C\u4E0D\u89E6\u53D1\u81EA\u52A8\u5237\u65B0\u4EE5\u907F\u514D\u4E2D\u65AD\u6D4F\u89C8\u3002",
    log_please_complete_tasks_first: "\u8BF7\u624B\u52A8\u5B8C\u6210\u6216\u53D6\u6D88\u8FD9\u4E9B\u4EFB\u52A1\u540E\u518D\u5237\u65B0\u9875\u9762\u3002",
    log_display_mode_switched: "\u{1F441}\uFE0F \u663E\u793A\u6A21\u5F0F\u5DF2\u5207\u6362\uFF0C\u5F53\u524D\u9875\u9762\u6709 {0} \u4E2A\u53EF\u89C1\u5546\u54C1",
    position_label: "\u4F4D\u7F6E",
    log_entering_rate_limit_from: "\u{1F6A8} \u6765\u81EA [{0}] \u7684\u9650\u901F\u89E6\u53D1\uFF01\u6B63\u5E38\u8FD0\u884C\u671F\u6301\u7EED\u4E86 {1} \u79D2\uFF0C\u671F\u95F4\u6709 {2} \u6B21\u6210\u529F\u7684\u641C\u7D22\u8BF7\u6C42\u3002",
    log_entering_rate_limit_from_v2: "\u{1F6A8} \u4ECE [{0}] \u68C0\u6D4B\u5230\u9650\u901F\uFF01\u6B63\u5E38\u8FD0\u884C\u6301\u7EED\u4E86 {1} \u79D2\uFF0C\u5305\u542B {2} \u6B21\u6210\u529F\u641C\u7D22\u8BF7\u6C42\u3002",
    rate_limit_recovery_success: "\u2705 \u9650\u901F\u4F3C\u4E4E\u5DF2\u4ECE [{0}] \u89E3\u9664\u3002429 \u72B6\u6001\u6301\u7EED\u4E86 {1} \u79D2\u3002",
    fab_dom_refresh_complete: "[Fab DOM Refresh] \u5B8C\u6210\u3002\u66F4\u65B0\u4E86 {0} \u4E2A\u53EF\u89C1\u5361\u7247\u7684\u72B6\u6001\u3002",
    auto_refresh_disabled_rate_limit: "\u26A0\uFE0F \u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u81EA\u52A8\u5237\u65B0\u529F\u80FD\u5DF2\u5173\u95ED\uFF0C\u8BF7\u5728\u9700\u8981\u65F6\u624B\u52A8\u5237\u65B0\u9875\u9762\u3002",
    // 页面诊断
    log_diagnosis_complete: "\u9875\u9762\u8BCA\u65AD\u5B8C\u6210\uFF0C\u8BF7\u67E5\u770B\u63A7\u5236\u53F0\u8F93\u51FA",
    log_diagnosis_failed: "\u9875\u9762\u8BCA\u65AD\u5931\u8D25: {0}",
    // Auto resume
    log_auto_resume_page_loading: "[Auto-Resume] \u9875\u9762\u5728\u9650\u901F\u72B6\u6001\u4E0B\u52A0\u8F7D\u3002\u6B63\u5728\u8FDB\u884C\u6062\u590D\u63A2\u6D4B...",
    log_recovery_probe_success: "\u2705 \u6062\u590D\u63A2\u6D4B\u6210\u529F\uFF01\u9650\u901F\u5DF2\u89E3\u9664\uFF0C\u7EE7\u7EED\u6B63\u5E38\u64CD\u4F5C\u3002",
    log_tasks_still_running: "\u4ECD\u6709 {0} \u4E2A\u4EFB\u52A1\u5728\u6267\u884C\u4E2D\uFF0C\u7B49\u5F85\u5B83\u4EEC\u5B8C\u6210\u540E\u518D\u5237\u65B0...",
    log_todo_tasks_waiting: "\u6709 {0} \u4E2A\u5F85\u529E\u4EFB\u52A1\u7B49\u5F85\u6267\u884C\uFF0C\u5C06\u5C1D\u8BD5\u7EE7\u7EED\u6267\u884C...",
    countdown_refresh_source: "\u6062\u590D\u63A2\u6D4B\u5931\u8D25",
    failed_list_empty: "\u5931\u8D25\u5217\u8868\u4E3A\u7A7A\uFF0C\u65E0\u9700\u64CD\u4F5C\u3002",
    opening_failed_items: "\u6B63\u5728\u6253\u5F00 {0} \u4E2A\u5931\u8D25\u9879\u76EE...",
    // 账号验证
    auth_error: "\u8D26\u53F7\u5931\u6548\uFF1A\u672A\u627E\u5230 CSRF token\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
    auth_error_alert: "\u8D26\u53F7\u5931\u6548\uFF1A\u8BF7\u91CD\u65B0\u767B\u5F55\u540E\u518D\u4F7F\u7528\u811A\u672C"
  };

  // src/config.js
  var Config = {
    SCRIPT_NAME: "Fab Helper (\u4F18\u5316\u7248)",
    DB_VERSION: 3,
    DB_NAME: "fab_helper_db",
    MAX_CONCURRENT_WORKERS: 7,
    // 最大并发工作标签页数量
    WORKER_TIMEOUT: 3e4,
    // 工作标签页超时时间
    UI_CONTAINER_ID: "fab-helper-container",
    UI_LOG_ID: "fab-helper-log",
    DB_KEYS: {
      DONE: "fab_done_v8",
      FAILED: "fab_failed_v8",
      TODO: "fab_todo_v1",
      // 用于永久存储待办列表
      HIDE: "fab_hide_v8",
      AUTO_ADD: "fab_autoAdd_v8",
      // 自动添加设置键
      REMEMBER_POS: "fab_rememberPos_v8",
      LAST_CURSOR: "fab_lastCursor_v8",
      // Store only the cursor string
      WORKER_DONE: "fab_worker_done_v8",
      // This is the ONLY key workers use to report back.
      APP_STATUS: "fab_app_status_v1",
      // For tracking 429 rate limiting
      STATUS_HISTORY: "fab_status_history_v1",
      // 状态历史记录持久化
      AUTO_RESUME: "fab_auto_resume_v1",
      // 自动恢复功能设置
      IS_EXECUTING: "fab_is_executing_v1",
      // 执行状态保存
      AUTO_REFRESH_EMPTY: "fab_auto_refresh_empty_v1"
      // 无商品可见时自动刷新
      // 其他键值用于会话或主标签页持久化
    },
    SELECTORS: {
      card: "div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root",
      cardLink: 'a[href*="/listings/"]',
      addButton: 'button[aria-label*="Add to"], button[aria-label*="\u6DFB\u52A0\u81F3"], button[aria-label*="cart"]',
      rootElement: "#root",
      successBanner: 'div[class*="Toast-root"]',
      freeStatus: ".csZFzinF",
      ownedStatus: ".cUUvxo_s"
    },
    TEXTS: {
      en,
      zh
    },
    // Centralized keyword sets, based STRICTLY on the rules in FAB_HELPER_RULES.md
    OWNED_SUCCESS_CRITERIA: {
      // Check for an H2 tag with the specific success text.
      h2Text: ["\u5DF2\u4FDD\u5B58\u5728\u6211\u7684\u5E93\u4E2D", "Saved in My Library"],
      // Check for buttons/links with these texts.
      buttonTexts: ["\u5728\u6211\u7684\u5E93\u4E2D\u67E5\u770B", "View in My Library"],
      // Check for the temporary success popup (snackbar).
      snackbarText: ["\u4EA7\u54C1\u5DF2\u6DFB\u52A0\u81F3\u60A8\u7684\u5E93\u4E2D", "Product added to your library"]
    },
    ACQUISITION_TEXT_SET: /* @__PURE__ */ new Set(["\u6DFB\u52A0\u5230\u6211\u7684\u5E93", "Add to my library"]),
    // Kept for backward compatibility with recon logic.
    SAVED_TEXT_SET: /* @__PURE__ */ new Set(["\u5DF2\u4FDD\u5B58\u5728\u6211\u7684\u5E93\u4E2D", "Saved in My Library", "\u5728\u6211\u7684\u5E93\u4E2D", "In My Library"]),
    FREE_TEXT_SET: /* @__PURE__ */ new Set(["\u514D\u8D39", "Free", "\u8D77\u59CB\u4EF7\u683C \u514D\u8D39"]),
    // 添加一个实例ID，用于防止多实例运行
    INSTANCE_ID: "fab_instance_id_" + Math.random().toString(36).substring(2, 15)
  };

  // src/state.js
  var State = {
    db: {
      todo: [],
      // 待办任务列表
      done: [],
      // 已完成任务列表
      failed: []
      // 失败任务列表
    },
    hideSaved: false,
    // 是否隐藏已保存项目
    autoAddOnScroll: false,
    // 是否在滚动时自动添加任务
    rememberScrollPosition: false,
    // 是否记住滚动位置
    autoResumeAfter429: false,
    // 是否在429后自动恢复
    autoRefreshEmptyPage: true,
    // 新增：无商品可见时自动刷新（默认开启）
    debugMode: false,
    // 是否启用调试模式
    lang: "zh",
    // 当前语言，默认中文，会在detectLanguage中更新
    isExecuting: false,
    // 是否正在执行任务
    isRefreshScheduled: false,
    // 新增：标记是否已经安排了页面刷新
    isWorkerTab: false,
    // 是否是工作标签页
    totalTasks: 0,
    // API扫描的总任务数
    completedTasks: 0,
    // API扫描的已完成任务数
    isDispatchingTasks: false,
    // 新增：标记是否正在派发任务
    savedCursor: null,
    // Holds the loaded cursor for hijacking
    // --- NEW: State for 429 monitoring ---
    appStatus: "NORMAL",
    // 'NORMAL' or 'RATE_LIMITED'
    rateLimitStartTime: null,
    normalStartTime: Date.now(),
    successfulSearchCount: 0,
    statusHistory: [],
    // Holds the history of NORMAL/RATE_LIMITED periods
    // --- 限速恢复相关状态 ---
    consecutiveSuccessCount: 0,
    // 连续成功请求计数
    requiredSuccessCount: 3,
    // 退出限速需要的连续成功请求数
    lastLimitSource: "",
    // 最后一次限速的来源
    isCheckingRateLimit: false,
    // 是否正在检查限速状态
    // --- End New State ---
    showAdvanced: false,
    activeWorkers: 0,
    runningWorkers: {},
    // NEW: To track active workers for the watchdog { workerId: { task, startTime } }
    lastKnownHref: null,
    // To detect SPA navigation
    hiddenThisPageCount: 0,
    executionTotalTasks: 0,
    // For execution progress
    executionCompletedTasks: 0,
    // For execution progress
    executionFailedTasks: 0,
    // For execution progress
    watchdogTimer: null,
    // UI-related state
    uiExpanded: true,
    logs: [],
    valueChangeListeners: [],
    // For remembering scroll position
    knownCursors: /* @__PURE__ */ new Set(),
    lastSortMethod: null,
    // Session-level tracking (not persisted)
    sessionCompleted: /* @__PURE__ */ new Set(),
    sessionFailed: /* @__PURE__ */ new Set(),
    // 工作线程标签页任务ID
    workerTaskId: null,
    // 是否显示状态历史表格
    showStatusHistory: false
  };

  // src/modules/utils.js
  var UI = null;
  var setUIReference = /* @__PURE__ */ __name((uiModule) => {
    UI = uiModule;
  }, "setUIReference");
  var Utils = {
    logger: /* @__PURE__ */ __name((type, ...args) => {
      if (type === "debug") {
        if (!State.debugMode) {
          return;
        }
        console.log(`${Config.SCRIPT_NAME} [DEBUG]`, ...args);
        if (State.UI && State.UI.logPanel) {
          const logEntry = document.createElement("div");
          logEntry.style.cssText = "padding: 2px 4px; border-bottom: 1px solid #444; font-size: 11px; color: #888;";
          const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
          logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> <span style="color: #8a8;">[DEBUG]</span> ${args.join(" ")}`;
          State.UI.logPanel.prepend(logEntry);
          while (State.UI.logPanel.children.length > 100) {
            State.UI.logPanel.removeChild(State.UI.logPanel.lastChild);
          }
        }
        return;
      }
      if (State.isWorkerTab) {
        if (type === "error" || args.some((arg) => typeof arg === "string" && arg.includes("Worker"))) {
          console[type](`${Config.SCRIPT_NAME} [Worker]`, ...args);
        }
        return;
      }
      console[type](`${Config.SCRIPT_NAME}`, ...args);
      if (State.UI && State.UI.logPanel) {
        const logEntry = document.createElement("div");
        logEntry.style.cssText = "padding: 2px 4px; border-bottom: 1px solid #444; font-size: 11px;";
        const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${args.join(" ")}`;
        State.UI.logPanel.prepend(logEntry);
        while (State.UI.logPanel.children.length > 100) {
          State.UI.logPanel.removeChild(State.UI.logPanel.lastChild);
        }
      }
    }, "logger"),
    getText: /* @__PURE__ */ __name((key, ...args) => {
      let text = Config.TEXTS[State.lang]?.[key] || Config.TEXTS["en"]?.[key] || key;
      if (args.length > 0) {
        if (typeof args[0] === "object" && args[0] !== null) {
          const replacements = args[0];
          for (const placeholder in replacements) {
            text = text.replace(`%${placeholder}%`, replacements[placeholder]);
          }
        } else {
          args.forEach((arg, index) => {
            text = text.replace(new RegExp(`\\{${index}\\}`, "g"), arg);
          });
        }
      }
      return text;
    }, "getText"),
    detectLanguage: /* @__PURE__ */ __name(() => {
      const oldLang = State.lang;
      State.lang = window.location.href.includes("/zh-cn/") ? "zh" : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
      Utils.logger("info", `\u8BED\u8A00\u68C0\u6D4B: \u5730\u5740=${window.location.href}, \u68C0\u6D4B\u5230\u8BED\u8A00=${State.lang}${oldLang !== State.lang ? ` (\u4ECE${oldLang}\u5207\u6362)` : ""}`);
      if (oldLang !== State.lang && State.UI && State.UI.container && UI) {
        Utils.logger("info", `\u8BED\u8A00\u5DF2\u5207\u6362\u5230${State.lang}\uFF0C\u6B63\u5728\u66F4\u65B0\u754C\u9762...`);
        UI.update();
      }
    }, "detectLanguage"),
    waitForElement: /* @__PURE__ */ __name((selector, timeout = 5e3) => {
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
    }, "waitForElement"),
    waitForButtonEnabled: /* @__PURE__ */ __name((button, timeout = 5e3) => {
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          if (button && !button.disabled) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(interval);
          reject(new Error("Timeout waiting for button to be enabled."));
        }, timeout);
      });
    }, "waitForButtonEnabled"),
    // This function is now for UI display purposes only.
    getDisplayPageFromUrl: /* @__PURE__ */ __name((url) => {
      if (!url) return "1";
      try {
        const urlParams = new URLSearchParams(new URL(url).search);
        const cursor = urlParams.get("cursor");
        if (!cursor) return "1";
        if (cursor.startsWith("bz")) {
          const decoded = atob(cursor);
          const offsetMatch = decoded.match(/o=(\d+)/);
          if (offsetMatch && offsetMatch[1]) {
            const offset = parseInt(offsetMatch[1], 10);
            const pageSize = 24;
            const pageNum = Math.round(offset / pageSize + 1);
            return pageNum.toString();
          }
        }
        return "Cursor Mode";
      } catch (e) {
        return "...";
      }
    }, "getDisplayPageFromUrl"),
    getCookie: /* @__PURE__ */ __name((name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(";").shift();
      return null;
    }, "getCookie"),
    // Simulates a more forceful click by dispatching mouse events, which can succeed
    // where a simple .click() is ignored by a framework's event handling.
    deepClick: /* @__PURE__ */ __name((element) => {
      if (!element) return;
      setTimeout(() => {
        const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        Utils.logger("info", `Performing deep click on element: <${element.tagName.toLowerCase()} class="${element.className}">`);
        const pointerDownEvent = new PointerEvent("pointerdown", { view: pageWindow, bubbles: true, cancelable: true });
        const mouseDownEvent = new MouseEvent("mousedown", { view: pageWindow, bubbles: true, cancelable: true });
        const mouseUpEvent = new MouseEvent("mouseup", { view: pageWindow, bubbles: true, cancelable: true });
        element.dispatchEvent(pointerDownEvent);
        element.dispatchEvent(mouseDownEvent);
        element.dispatchEvent(mouseUpEvent);
        element.click();
      }, 50);
    }, "deepClick"),
    cleanup: /* @__PURE__ */ __name(() => {
      if (State.watchdogTimer) {
        clearInterval(State.watchdogTimer);
        State.watchdogTimer = null;
      }
      State.valueChangeListeners.forEach((id) => {
        try {
          GM_removeValueChangeListener(id);
        } catch (e) {
        }
      });
      State.valueChangeListeners = [];
    }, "cleanup"),
    // 添加游标解码函数
    decodeCursor: /* @__PURE__ */ __name((cursor) => {
      if (!cursor) return Utils.getText("no_saved_position");
      try {
        const decoded = atob(cursor);
        let match;
        if (decoded.includes("&p=")) {
          match = decoded.match(/&p=([^&]+)/);
        } else if (decoded.startsWith("p=")) {
          match = decoded.match(/p=([^&]+)/);
        }
        if (match && match[1]) {
          const itemName = decodeURIComponent(match[1].replace(/\+/g, " "));
          return `${Utils.getText("position_label")}: "${itemName}"`;
        }
        return `${Utils.getText("position_label")}: (Unknown)`;
      } catch (e) {
        Utils.logger("error", `Cursor decode failed: ${e.message}`);
        return `${Utils.getText("position_label")}: (Invalid)`;
      }
    }, "decodeCursor"),
    // Helper to extract just the item name from cursor
    getCursorItemName: /* @__PURE__ */ __name((cursor) => {
      if (!cursor) return null;
      try {
        const decoded = atob(cursor);
        let match;
        if (decoded.includes("&p=")) {
          match = decoded.match(/&p=([^&]+)/);
        } else if (decoded.startsWith("p=")) {
          match = decoded.match(/p=([^&]+)/);
        }
        if (match && match[1]) {
          return decodeURIComponent(match[1].replace(/\+/g, " "));
        }
      } catch (e) {
      }
      return null;
    }, "getCursorItemName"),
    // 账号验证函数
    checkAuthentication: /* @__PURE__ */ __name(() => {
      const csrfToken = Utils.getCookie("fab_csrftoken");
      if (!csrfToken) {
        Utils.logger("error", Utils.getText("auth_error"));
        if (State.isExecuting) {
          State.isExecuting = false;
          GM_setValue(Config.DB_KEYS.IS_EXECUTING, false);
        }
        if (State.UI && State.UI.execBtn) {
          State.UI.execBtn.textContent = Utils.getText("execute");
          State.UI.execBtn.disabled = true;
        }
        alert(Utils.getText("auth_error_alert"));
        return false;
      }
      return true;
    }, "checkAuthentication")
  };

  // src/modules/data-cache.js
  var DataCache = {
    // 商品数据缓存 - 键为商品ID，值为商品数据
    listings: /* @__PURE__ */ new Map(),
    // 拥有状态缓存 - 键为商品ID，值为拥有状态对象
    ownedStatus: /* @__PURE__ */ new Map(),
    // 价格缓存 - 键为报价ID，值为价格信息对象
    prices: /* @__PURE__ */ new Map(),
    // 等待网页原生请求更新的UID列表
    waitingList: /* @__PURE__ */ new Set(),
    // 缓存时间戳 - 用于判断缓存是否过期
    timestamps: {
      listings: /* @__PURE__ */ new Map(),
      ownedStatus: /* @__PURE__ */ new Map(),
      prices: /* @__PURE__ */ new Map()
    },
    // 缓存有效期（毫秒）
    TTL: 5 * 60 * 1e3,
    // 5分钟
    // 检查缓存是否有效
    isValid: /* @__PURE__ */ __name(function(type, key) {
      const timestamp = this.timestamps[type].get(key);
      return timestamp && Date.now() - timestamp < this.TTL;
    }, "isValid"),
    // 保存商品数据到缓存
    saveListings: /* @__PURE__ */ __name(function(items) {
      if (!Array.isArray(items)) return;
      const now = Date.now();
      items.forEach((item) => {
        if (item && item.uid) {
          this.listings.set(item.uid, item);
          this.timestamps.listings.set(item.uid, now);
        }
      });
    }, "saveListings"),
    // 添加到等待列表
    addToWaitingList: /* @__PURE__ */ __name(function(uids) {
      if (!uids || !Array.isArray(uids)) return;
      uids.forEach((uid) => this.waitingList.add(uid));
      Utils.logger("debug", `[Cache] ${Utils.getText("fab_dom_add_to_waitlist", uids.length, this.waitingList.size)}`);
    }, "addToWaitingList"),
    // 检查并从等待列表中移除
    checkWaitingList: /* @__PURE__ */ __name(function() {
      if (this.waitingList.size === 0) return;
      let removedCount = 0;
      for (const uid of this.waitingList) {
        if (this.ownedStatus.has(uid)) {
          this.waitingList.delete(uid);
          removedCount++;
        }
      }
      if (removedCount > 0) {
        Utils.logger("info", `[Cache] \u4ECE\u7B49\u5F85\u5217\u8868\u4E2D\u79FB\u9664\u4E86 ${removedCount} \u4E2A\u5DF2\u66F4\u65B0\u7684\u5546\u54C1ID\uFF0C\u5269\u4F59: ${this.waitingList.size}`);
      }
    }, "checkWaitingList"),
    // 保存拥有状态到缓存
    saveOwnedStatus: /* @__PURE__ */ __name(function(states) {
      if (!Array.isArray(states)) return;
      const now = Date.now();
      states.forEach((state) => {
        if (state && state.uid) {
          this.ownedStatus.set(state.uid, {
            acquired: !!state.acquired,
            lastUpdatedAt: state.lastUpdatedAt || (/* @__PURE__ */ new Date()).toISOString(),
            uid: state.uid
          });
          this.timestamps.ownedStatus.set(state.uid, now);
          if (this.waitingList.has(state.uid)) {
            this.waitingList.delete(state.uid);
          }
        }
      });
      if (states.length > 0) {
        this.checkWaitingList();
      }
    }, "saveOwnedStatus"),
    // 保存价格信息到缓存
    savePrices: /* @__PURE__ */ __name(function(offers) {
      if (!Array.isArray(offers)) return;
      const now = Date.now();
      offers.forEach((offer) => {
        if (offer && offer.offerId) {
          this.prices.set(offer.offerId, {
            offerId: offer.offerId,
            price: offer.price || 0,
            currencyCode: offer.currencyCode || "USD"
          });
          this.timestamps.prices.set(offer.offerId, now);
        }
      });
    }, "savePrices"),
    // 获取商品数据，如果缓存有效则使用缓存
    getListings: /* @__PURE__ */ __name(function(uids) {
      const result = [];
      const missing = [];
      uids.forEach((uid) => {
        if (this.isValid("listings", uid)) {
          result.push(this.listings.get(uid));
        } else {
          missing.push(uid);
        }
      });
      return { result, missing };
    }, "getListings"),
    // 获取拥有状态，如果缓存有效则使用缓存
    getOwnedStatus: /* @__PURE__ */ __name(function(uids) {
      const result = [];
      const missing = [];
      uids.forEach((uid) => {
        if (this.isValid("ownedStatus", uid)) {
          result.push(this.ownedStatus.get(uid));
        } else {
          missing.push(uid);
        }
      });
      return { result, missing };
    }, "getOwnedStatus"),
    // 获取价格信息，如果缓存有效则使用缓存
    getPrices: /* @__PURE__ */ __name(function(offerIds) {
      const result = [];
      const missing = [];
      offerIds.forEach((offerId) => {
        if (this.isValid("prices", offerId)) {
          result.push(this.prices.get(offerId));
        } else {
          missing.push(offerId);
        }
      });
      return { result, missing };
    }, "getPrices"),
    // 清理过期缓存
    cleanupExpired: /* @__PURE__ */ __name(function() {
      try {
        const now = Date.now();
        const cacheTypes = ["listings", "ownedStatus", "prices"];
        for (const type of cacheTypes) {
          for (const [key, timestamp] of this.timestamps[type].entries()) {
            if (now - timestamp > this.TTL) {
              this[type].delete(key);
              this.timestamps[type].delete(key);
            }
          }
        }
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("cache_cleanup_complete", this.listings.size, this.ownedStatus.size, this.prices.size));
        }
      } catch (e) {
        Utils.logger("error", `\u7F13\u5B58\u6E05\u7406\u5931\u8D25: ${e.message}`);
      }
    }, "cleanupExpired")
  };

  // src/modules/database.js
  var UI2 = null;
  var setUIReference2 = /* @__PURE__ */ __name((uiModule) => {
    UI2 = uiModule;
  }, "setUIReference");
  var Database = {
    load: /* @__PURE__ */ __name(async () => {
      State.db.todo = await GM_getValue(Config.DB_KEYS.TODO, []);
      State.db.done = await GM_getValue(Config.DB_KEYS.DONE, []);
      State.db.failed = await GM_getValue(Config.DB_KEYS.FAILED, []);
      State.hideSaved = await GM_getValue(Config.DB_KEYS.HIDE, false);
      State.autoAddOnScroll = await GM_getValue(Config.DB_KEYS.AUTO_ADD, false);
      State.rememberScrollPosition = await GM_getValue(Config.DB_KEYS.REMEMBER_POS, false);
      State.autoResumeAfter429 = await GM_getValue(Config.DB_KEYS.AUTO_RESUME, false);
      State.autoRefreshEmptyPage = await GM_getValue(Config.DB_KEYS.AUTO_REFRESH_EMPTY, true);
      State.debugMode = await GM_getValue("fab_helper_debug_mode", false);
      State.currentSortOption = await GM_getValue("fab_helper_sort_option", "title_desc");
      State.isExecuting = await GM_getValue(Config.DB_KEYS.IS_EXECUTING, false);
      const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
      if (persistedStatus && persistedStatus.status === "RATE_LIMITED") {
        State.appStatus = "RATE_LIMITED";
        State.rateLimitStartTime = persistedStatus.startTime;
        const previousDuration = persistedStatus && persistedStatus.startTime ? ((Date.now() - persistedStatus.startTime) / 1e3).toFixed(2) : "0.00";
        Utils.logger("warn", `Script starting in RATE_LIMITED state. 429 period has lasted at least ${previousDuration}s.`);
      }
      State.statusHistory = await GM_getValue(Config.DB_KEYS.STATUS_HISTORY, []);
      Utils.logger("info", Utils.getText("log_db_loaded"), `(Session) To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
    }, "load"),
    // 添加保存待办列表的方法
    saveTodo: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.TODO, State.db.todo), "saveTodo"),
    saveDone: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.DONE, State.db.done), "saveDone"),
    saveFailed: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.FAILED, State.db.failed), "saveFailed"),
    saveHidePref: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.HIDE, State.hideSaved), "saveHidePref"),
    saveAutoAddPref: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.AUTO_ADD, State.autoAddOnScroll), "saveAutoAddPref"),
    // Save the setting
    saveRememberPosPref: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.REMEMBER_POS, State.rememberScrollPosition), "saveRememberPosPref"),
    saveAutoResumePref: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.AUTO_RESUME, State.autoResumeAfter429), "saveAutoResumePref"),
    saveAutoRefreshEmptyPref: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.AUTO_REFRESH_EMPTY, State.autoRefreshEmptyPage), "saveAutoRefreshEmptyPref"),
    // 保存无商品自动刷新设置
    saveExecutingState: /* @__PURE__ */ __name(() => GM_setValue(Config.DB_KEYS.IS_EXECUTING, State.isExecuting), "saveExecutingState"),
    // Save the execution state
    resetAllData: /* @__PURE__ */ __name(async () => {
      if (window.confirm(Utils.getText("confirm_clear_data"))) {
        await GM_deleteValue(Config.DB_KEYS.TODO);
        await GM_deleteValue(Config.DB_KEYS.DONE);
        await GM_deleteValue(Config.DB_KEYS.FAILED);
        State.db.todo = [];
        State.db.done = [];
        State.db.failed = [];
        Utils.logger("info", "\u6240\u6709\u811A\u672C\u6570\u636E\u5DF2\u91CD\u7F6E\u3002");
        if (UI2) {
          UI2.removeAllOverlays();
          UI2.update();
        }
      }
    }, "resetAllData"),
    isDone: /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      return State.db.done.includes(url.split("?")[0]);
    }, "isDone"),
    isFailed: /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      const cleanUrl = url.split("?")[0];
      return State.db.failed.some((task) => task.url === cleanUrl);
    }, "isFailed"),
    isTodo: /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      const cleanUrl = url.split("?")[0];
      return State.db.todo.some((task) => task.url === cleanUrl);
    }, "isTodo"),
    markAsDone: /* @__PURE__ */ __name(async (task) => {
      if (!task || !task.uid) {
        Utils.logger("error", "\u6807\u8BB0\u4EFB\u52A1\u5B8C\u6210\u5931\u8D25\uFF0C\u6536\u5230\u65E0\u6548\u4EFB\u52A1:", JSON.stringify(task));
        return;
      }
      const initialTodoCount = State.db.todo.length;
      State.db.todo = State.db.todo.filter((t) => t.uid !== task.uid);
      if (State.db.todo.length !== initialTodoCount) {
        Database.saveTodo();
      }
      if (State.db.todo.length === initialTodoCount && initialTodoCount > 0) {
        Utils.logger("warn", "\u4EFB\u52A1\u672A\u80FD\u4ECE\u5F85\u529E\u5217\u8868\u4E2D\u79FB\u9664\uFF0C\u53EF\u80FD\u5DF2\u88AB\u5176\u4ED6\u64CD\u4F5C\u5904\u7406");
      }
      let changed = false;
      const cleanUrl = task.url.split("?")[0];
      if (!Database.isDone(cleanUrl)) {
        State.db.done.push(cleanUrl);
        changed = true;
      }
      if (changed) {
        await Database.saveDone();
      }
    }, "markAsDone"),
    markAsFailed: /* @__PURE__ */ __name(async (task) => {
      if (!task || !task.uid) {
        Utils.logger("error", "\u6807\u8BB0\u4EFB\u52A1\u5931\u8D25\uFF0C\u6536\u5230\u65E0\u6548\u4EFB\u52A1:", JSON.stringify(task));
        return;
      }
      const initialTodoCount = State.db.todo.length;
      State.db.todo = State.db.todo.filter((t) => t.uid !== task.uid);
      let changed = State.db.todo.length < initialTodoCount;
      if (!State.db.failed.some((f) => f.uid === task.uid)) {
        State.db.failed.push(task);
        changed = true;
      }
      if (changed) {
        await Database.saveFailed();
      }
    }, "markAsFailed")
  };

  // src/modules/rate-limit-manager.js
  var UI3 = null;
  var TaskRunner = null;
  var countdownRefresh = null;
  var setDependencies = /* @__PURE__ */ __name((deps) => {
    UI3 = deps.UI;
    TaskRunner = deps.TaskRunner;
    countdownRefresh = deps.countdownRefresh;
  }, "setDependencies");
  var RateLimitManager = {
    // 添加防止重复日志的变量
    _lastLogTime: 0,
    _lastLogType: null,
    _duplicateLogCount: 0,
    // 检查是否与最后一条记录重复
    isDuplicateRecord: /* @__PURE__ */ __name(function(newEntry) {
      if (State.statusHistory.length === 0) return false;
      const lastEntry = State.statusHistory[State.statusHistory.length - 1];
      if (lastEntry.type !== newEntry.type) return false;
      const lastTime = new Date(lastEntry.endTime).getTime();
      const newTime = new Date(newEntry.endTime).getTime();
      const timeDiff = Math.abs(newTime - lastTime);
      if (timeDiff < 1e4) {
        const durationDiff = Math.abs((lastEntry.duration || 0) - (newEntry.duration || 0));
        if (durationDiff < 5) {
          return true;
        }
      }
      return false;
    }, "isDuplicateRecord"),
    // 添加记录到历史，带去重检查
    addToHistory: /* @__PURE__ */ __name(async function(entry) {
      if (this.isDuplicateRecord(entry)) {
        Utils.logger("debug", `\u68C0\u6D4B\u5230\u91CD\u590D\u7684\u72B6\u6001\u8BB0\u5F55\uFF0C\u8DF3\u8FC7: ${entry.type} - ${entry.endTime}`);
        return false;
      }
      State.statusHistory.push(entry);
      if (State.statusHistory.length > 50) {
        State.statusHistory = State.statusHistory.slice(-50);
      }
      await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
      return true;
    }, "addToHistory"),
    // 进入限速状态
    enterRateLimitedState: /* @__PURE__ */ __name(async function(source = "\u672A\u77E5\u6765\u6E90") {
      if (State.appStatus === "RATE_LIMITED") {
        Utils.logger("info", Utils.getText("rate_limit_already_active", State.lastLimitSource, source));
        return false;
      }
      State.consecutiveSuccessCount = 0;
      State.lastLimitSource = source;
      const normalDuration = State.normalStartTime ? ((Date.now() - State.normalStartTime) / 1e3).toFixed(2) : "0.00";
      const logEntry = {
        type: "NORMAL",
        duration: parseFloat(normalDuration),
        requests: State.successfulSearchCount,
        endTime: (/* @__PURE__ */ new Date()).toISOString()
      };
      const wasAdded = await this.addToHistory(logEntry);
      if (wasAdded) {
        Utils.logger("error", Utils.getText("log_entering_rate_limit_from_v2", source, normalDuration, State.successfulSearchCount));
      } else {
        Utils.logger("debug", Utils.getText("duplicate_normal_status_detected", source));
      }
      State.appStatus = "RATE_LIMITED";
      State.rateLimitStartTime = Date.now();
      await GM_setValue(Config.DB_KEYS.APP_STATUS, {
        status: "RATE_LIMITED",
        startTime: State.rateLimitStartTime,
        source
      });
      if (UI3) {
        UI3.updateDebugTab();
        UI3.update();
      }
      const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;
      const hiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`).length;
      const actualVisibleCards = totalCards - hiddenCards;
      const visibleCountElement = document.getElementById("fab-status-visible");
      if (visibleCountElement) {
        visibleCountElement.textContent = actualVisibleCards.toString();
      }
      State.hiddenThisPageCount = hiddenCards;
      if (State.db.todo.length > 0 || State.activeWorkers > 0 || actualVisibleCards > 0) {
        if (actualVisibleCards > 0) {
          Utils.logger("info", `\u68C0\u6D4B\u5230\u9875\u9762\u4E0A\u6709 ${actualVisibleCards} \u4E2A\u53EF\u89C1\u5546\u54C1\uFF0C\u6682\u4E0D\u81EA\u52A8\u5237\u65B0\u9875\u9762\u3002`);
          Utils.logger("info", "\u5F53\u4ECD\u6709\u53EF\u89C1\u5546\u54C1\u65F6\u4E0D\u89E6\u53D1\u81EA\u52A8\u5237\u65B0\uFF0C\u4EE5\u907F\u514D\u4E2D\u65AD\u6D4F\u89C8\u3002");
        } else {
          Utils.logger("info", `\u68C0\u6D4B\u5230\u6709 ${State.db.todo.length} \u4E2A\u5F85\u529E\u4EFB\u52A1\u548C ${State.activeWorkers} \u4E2A\u6D3B\u52A8\u5DE5\u4F5C\u7EBF\u7A0B\uFF0C\u6682\u4E0D\u81EA\u52A8\u5237\u65B0\u9875\u9762\u3002`);
          Utils.logger("info", "\u8BF7\u624B\u52A8\u5B8C\u6210\u6216\u53D6\u6D88\u8FD9\u4E9B\u4EFB\u52A1\u540E\u518D\u5237\u65B0\u9875\u9762\u3002");
        }
        Utils.logger("warn", "\u26A0\uFE0F \u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u4F46\u4E0D\u6EE1\u8DB3\u81EA\u52A8\u5237\u65B0\u6761\u4EF6\uFF0C\u8BF7\u5728\u9700\u8981\u65F6\u624B\u52A8\u5237\u65B0\u9875\u9762\u3002");
      } else if (State.autoRefreshEmptyPage) {
        const randomDelay = 5e3 + Math.random() * 2e3;
        if (State.autoResumeAfter429) {
          Utils.logger("info", Utils.getText("log_auto_resume_start", randomDelay ? (randomDelay / 1e3).toFixed(1) : "\u672A\u77E5"));
        } else {
          Utils.logger("info", Utils.getText("log_auto_resume_detect", randomDelay ? (randomDelay / 1e3).toFixed(1) : "\u672A\u77E5"));
        }
        if (countdownRefresh) {
          countdownRefresh(randomDelay, "429\u81EA\u52A8\u6062\u590D");
        }
      } else {
        Utils.logger("info", Utils.getText("auto_refresh_disabled_rate_limit"));
      }
      return true;
    }, "enterRateLimitedState"),
    // 记录成功请求
    recordSuccessfulRequest: /* @__PURE__ */ __name(async function(source = "\u672A\u77E5\u6765\u6E90", hasResults = true) {
      if (hasResults) {
        State.successfulSearchCount++;
        if (UI3) UI3.updateDebugTab();
      }
      if (State.appStatus !== "RATE_LIMITED") {
        return;
      }
      if (!hasResults) {
        Utils.logger("info", `\u8BF7\u6C42\u6210\u529F\u4F46\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7ED3\u679C\uFF0C\u4E0D\u8BA1\u5165\u8FDE\u7EED\u6210\u529F\u8BA1\u6570\u3002\u6765\u6E90: ${source}`);
        State.consecutiveSuccessCount = 0;
        return;
      }
      State.consecutiveSuccessCount++;
      Utils.logger("info", Utils.getText("rate_limit_success_request", State.consecutiveSuccessCount, State.requiredSuccessCount, source));
      if (State.consecutiveSuccessCount >= State.requiredSuccessCount) {
        await this.exitRateLimitedState(Utils.getText("consecutive_success_exit", State.consecutiveSuccessCount, source));
      }
    }, "recordSuccessfulRequest"),
    // 退出限速状态
    exitRateLimitedState: /* @__PURE__ */ __name(async function(source = "\u672A\u77E5\u6765\u6E90") {
      if (State.appStatus !== "RATE_LIMITED") {
        Utils.logger("info", `\u5F53\u524D\u4E0D\u662F\u9650\u901F\u72B6\u6001\uFF0C\u5FFD\u7565\u9000\u51FA\u9650\u901F\u8BF7\u6C42: ${source}`);
        return false;
      }
      const rateLimitDuration = State.rateLimitStartTime ? ((Date.now() - State.rateLimitStartTime) / 1e3).toFixed(2) : "0.00";
      const logEntry = {
        type: "RATE_LIMITED",
        duration: parseFloat(rateLimitDuration),
        endTime: (/* @__PURE__ */ new Date()).toISOString(),
        source
      };
      const wasAdded = await this.addToHistory(logEntry);
      if (wasAdded) {
        Utils.logger("info", Utils.getText("rate_limit_recovery_success", source, rateLimitDuration));
      } else {
        Utils.logger("debug", `\u68C0\u6D4B\u5230\u91CD\u590D\u7684\u9650\u901F\u72B6\u6001\u8BB0\u5F55\uFF0C\u6765\u6E90: ${source}`);
      }
      State.appStatus = "NORMAL";
      State.rateLimitStartTime = null;
      State.normalStartTime = Date.now();
      State.consecutiveSuccessCount = 0;
      await GM_deleteValue(Config.DB_KEYS.APP_STATUS);
      if (UI3) {
        UI3.updateDebugTab();
        UI3.update();
      }
      if (State.db.todo.length > 0 && !State.isExecuting && TaskRunner) {
        Utils.logger("info", `\u53D1\u73B0 ${State.db.todo.length} \u4E2A\u5F85\u529E\u4EFB\u52A1\uFF0C\u81EA\u52A8\u6062\u590D\u6267\u884C...`);
        State.isExecuting = true;
        Database.saveExecutingState();
        TaskRunner.executeBatch();
      }
      return true;
    }, "exitRateLimitedState"),
    // 检查限速状态
    checkRateLimitStatus: /* @__PURE__ */ __name(async function() {
      if (State.isCheckingRateLimit) {
        Utils.logger("info", "\u5DF2\u6709\u9650\u901F\u72B6\u6001\u68C0\u67E5\u6B63\u5728\u8FDB\u884C\uFF0C\u8DF3\u8FC7\u672C\u6B21\u68C0\u67E5");
        return false;
      }
      State.isCheckingRateLimit = true;
      try {
        Utils.logger("info", Utils.getText("log_rate_limit_check_start"));
        const pageText = document.body.innerText || "";
        if (pageText.includes("Too many requests") || pageText.includes("rate limit") || pageText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
          Utils.logger("warn", "\u9875\u9762\u5185\u5BB9\u5305\u542B\u9650\u901F\u4FE1\u606F\uFF0C\u786E\u8BA4\u4ECD\u5904\u4E8E\u9650\u901F\u72B6\u6001");
          await this.enterRateLimitedState("\u9875\u9762\u5185\u5BB9\u68C0\u6D4B");
          return false;
        }
        Utils.logger("debug", "\u4F7F\u7528Performance API\u68C0\u67E5\u6700\u8FD1\u7684\u7F51\u7EDC\u8BF7\u6C42\uFF0C\u4E0D\u518D\u4E3B\u52A8\u53D1\u9001API\u8BF7\u6C42");
        if (window.performance && window.performance.getEntriesByType) {
          const recentRequests = window.performance.getEntriesByType("resource").filter((r) => r.name.includes("/i/listings/search") || r.name.includes("/i/users/me/listings-states")).filter((r) => Date.now() - r.startTime < 1e4);
          if (recentRequests.length > 0) {
            const has429 = recentRequests.some((r) => r.responseStatus === 429);
            if (has429) {
              Utils.logger("info", `\u68C0\u6D4B\u5230\u6700\u8FD110\u79D2\u5185\u6709429\u72B6\u6001\u7801\u7684\u8BF7\u6C42\uFF0C\u5224\u65AD\u4E3A\u9650\u901F\u72B6\u6001`);
              await this.enterRateLimitedState("Performance API\u68C0\u6D4B429");
              return false;
            }
            const hasSuccess = recentRequests.some((r) => r.responseStatus >= 200 && r.responseStatus < 300);
            if (hasSuccess) {
              Utils.logger("info", `\u68C0\u6D4B\u5230\u6700\u8FD110\u79D2\u5185\u6709\u6210\u529F\u7684API\u8BF7\u6C42\uFF0C\u5224\u65AD\u4E3A\u6B63\u5E38\u72B6\u6001`);
              await this.recordSuccessfulRequest("Performance API\u68C0\u6D4B\u6210\u529F", true);
              return true;
            }
          }
        }
        Utils.logger("info", Utils.getText("log_insufficient_info_status"));
        return State.appStatus === "NORMAL";
      } catch (e) {
        Utils.logger("error", `\u9650\u901F\u72B6\u6001\u68C0\u67E5\u5931\u8D25: ${e.message}`);
        return false;
      } finally {
        State.isCheckingRateLimit = false;
      }
    }, "checkRateLimitStatus")
  };

  // src/modules/page-patcher.js
  var PagePatcher = {
    _patchHasBeenApplied: false,
    _lastSeenCursor: null,
    _lastCheckedUrl: null,
    _bodyObserver: null,
    // State for request debouncing
    _debounceXhrTimer: null,
    _pendingXhr: null,
    async init() {
      try {
        const savedCursor = await GM_getValue(Config.DB_KEYS.LAST_CURSOR);
        if (savedCursor) {
          State.savedCursor = savedCursor;
          this._lastSeenCursor = savedCursor;
          Utils.logger("info", `[Cursor] Initialized. Loaded saved cursor: ${savedCursor.substring(0, 30)}...`);
        } else {
          Utils.logger("info", `[Cursor] Initialized. No saved cursor found.`);
        }
      } catch (e) {
        Utils.logger("warn", "[Cursor] Failed to restore cursor state:", e);
      }
      this.applyPatches();
      Utils.logger("info", "[Cursor] Network interceptors applied.");
      this.setupSortMonitor();
    },
    // 添加监听URL变化的方法，检测排序方式变更
    setupSortMonitor() {
      this.checkCurrentSortFromUrl();
      if (typeof MutationObserver !== "undefined") {
        const bodyObserver = new MutationObserver(() => {
          if (window.location.href !== this._lastCheckedUrl) {
            this._lastCheckedUrl = window.location.href;
            this.checkCurrentSortFromUrl();
            Utils.detectLanguage();
          }
        });
        bodyObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
        this._bodyObserver = bodyObserver;
      }
      window.addEventListener("popstate", () => {
        this.checkCurrentSortFromUrl();
        Utils.detectLanguage();
      });
      window.addEventListener("hashchange", () => {
        this.checkCurrentSortFromUrl();
        Utils.detectLanguage();
      });
      this._lastCheckedUrl = window.location.href;
    },
    // 从URL中检查当前排序方式并更新设置
    checkCurrentSortFromUrl() {
      try {
        const url = new URL(window.location.href);
        const sortParam = url.searchParams.get("sort_by");
        if (!sortParam) return;
        let matchedOption = null;
        if (State.sortOptions) {
          for (const [key, option] of Object.entries(State.sortOptions)) {
            if (option.value === sortParam) {
              matchedOption = key;
              break;
            }
          }
        }
        if (matchedOption && matchedOption !== State.currentSortOption) {
          const previousSort = State.currentSortOption;
          State.currentSortOption = matchedOption;
          GM_setValue("fab_helper_sort_option", State.currentSortOption);
          Utils.logger("info", Utils.getText(
            "log_url_sort_changed",
            State.sortOptions?.[previousSort]?.name || previousSort,
            State.sortOptions?.[State.currentSortOption]?.name || State.currentSortOption
          ));
          State.savedCursor = null;
          GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
          if (State.UI && State.UI.savedPositionDisplay) {
            State.UI.savedPositionDisplay.textContent = Utils.getText("no_saved_position");
          }
          Utils.logger("info", Utils.getText("log_sort_changed_position_cleared"));
        }
      } catch (e) {
        Utils.logger("warn", Utils.getText("log_sort_check_error", e.message));
      }
    },
    async handleSearchResponse(request) {
      if (request.status === 429) {
        await RateLimitManager.enterRateLimitedState("\u641C\u7D22\u54CD\u5E94429");
      } else if (request.status >= 200 && request.status < 300) {
        try {
          const responseText = request.responseText;
          if (responseText) {
            const data = JSON.parse(responseText);
            const hasResults = data && data.results && data.results.length > 0;
            await RateLimitManager.recordSuccessfulRequest(Utils.getText("request_source_search_response"), hasResults);
          }
        } catch (e) {
          Utils.logger("warn", Utils.getText("search_response_parse_failed", e.message));
        }
      }
    },
    isDebounceableSearch(url) {
      return typeof url === "string" && url.includes("/i/listings/search") && !url.includes("aggregate_on=") && !url.includes("count=0");
    },
    shouldPatchUrl(url) {
      if (typeof url !== "string") return false;
      if (this._patchHasBeenApplied) return false;
      if (!State.rememberScrollPosition || !State.savedCursor) return false;
      if (!url.includes("/i/listings/search")) return false;
      if (url.includes("aggregate_on=") || url.includes("count=0") || url.includes("in=wishlist")) return false;
      Utils.logger("info", Utils.getText("page_patcher_match") + ` URL: ${url}`);
      return true;
    },
    getPatchedUrl(originalUrl) {
      if (State.savedCursor) {
        const urlObj = new URL(originalUrl, window.location.origin);
        urlObj.searchParams.set("cursor", State.savedCursor);
        const modifiedUrl = urlObj.pathname + urlObj.search;
        Utils.logger("info", `[Cursor] ${Utils.getText("cursor_injecting")}: ${originalUrl}`);
        Utils.logger("info", `[Cursor] ${Utils.getText("cursor_patched_url")}: ${modifiedUrl}`);
        this._patchHasBeenApplied = true;
        return modifiedUrl;
      }
      return originalUrl;
    },
    saveLatestCursorFromUrl(url) {
      try {
        if (typeof url !== "string" || !url.includes("/i/listings/search") || !url.includes("cursor=")) return;
        const urlObj = new URL(url, window.location.origin);
        const newCursor = urlObj.searchParams.get("cursor");
        if (newCursor && newCursor !== this._lastSeenCursor) {
          let isValidPosition = true;
          let decodedCursor = "";
          try {
            decodedCursor = atob(newCursor);
            const filterKeywords = [
              "Nude+Tennis+Racket",
              "Nordic+Beach+Boulder",
              "Nordic+Beach+Rock"
            ];
            if (filterKeywords.some((keyword) => decodedCursor.includes(keyword))) {
              Utils.logger("info", Utils.getText("log_cursor_skip_known_position", decodedCursor));
              isValidPosition = false;
            }
            if (isValidPosition && this._lastSeenCursor) {
              try {
                let newItemName = "";
                let lastItemName = "";
                if (decodedCursor.includes("p=")) {
                  const match = decodedCursor.match(/p=([^&]+)/);
                  if (match && match[1]) {
                    newItemName = decodeURIComponent(match[1].replace(/\+/g, " "));
                  }
                }
                const lastDecoded = atob(this._lastSeenCursor);
                if (lastDecoded.includes("p=")) {
                  const match = lastDecoded.match(/p=([^&]+)/);
                  if (match && match[1]) {
                    lastItemName = decodeURIComponent(match[1].replace(/\+/g, " "));
                  }
                }
                if (newItemName && lastItemName) {
                  const getFirstWord = /* @__PURE__ */ __name((text) => text.trim().substring(0, 3), "getFirstWord");
                  const newFirstWord = getFirstWord(newItemName);
                  const lastFirstWord = getFirstWord(lastItemName);
                  const sortParam = urlObj.searchParams.get("sort_by") || "";
                  const isReverseSort = sortParam.startsWith("-");
                  if (isReverseSort && sortParam.includes("title") && newFirstWord > lastFirstWord || !isReverseSort && sortParam.includes("title") && newFirstWord < lastFirstWord) {
                    Utils.logger("info", Utils.getText(
                      "log_cursor_skip_backtrack",
                      newItemName,
                      lastItemName,
                      isReverseSort ? Utils.getText("log_sort_descending") : Utils.getText("log_sort_ascending")
                    ));
                    isValidPosition = false;
                  }
                }
              } catch (compareError) {
              }
            }
          } catch (decodeError) {
          }
          if (isValidPosition) {
            this._lastSeenCursor = newCursor;
            State.savedCursor = newCursor;
            GM_setValue(Config.DB_KEYS.LAST_CURSOR, newCursor);
            if (State.debugMode) {
              Utils.logger("debug", Utils.getText("debug_save_cursor", newCursor.substring(0, 30) + "..."));
            }
            if (State.UI && State.UI.savedPositionDisplay) {
              State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(newCursor);
            }
          }
        }
      } catch (e) {
        Utils.logger("warn", Utils.getText("log_cursor_save_error"), e);
      }
    },
    applyPatches() {
      const self = this;
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      const originalXhrSend = XMLHttpRequest.prototype.send;
      const DEBOUNCE_DELAY_MS = 350;
      const listenerAwareSend = /* @__PURE__ */ __name(function(...args) {
        const request = this;
        const onLoad = /* @__PURE__ */ __name(() => {
          request.removeEventListener("load", onLoad);
          if (typeof window.recordNetworkActivity === "function") {
            window.recordNetworkActivity();
          }
          if (request.status >= 200 && request.status < 300 && request._url && self.isDebounceableSearch(request._url)) {
            if (typeof window.recordNetworkRequest === "function") {
              window.recordNetworkRequest(Utils.getText("request_source_xhr_item"), true);
            }
          }
          if (request.status === 429 || request.status === "429" || request.status.toString() === "429") {
            Utils.logger("warn", Utils.getText("xhr_detected_429", request.responseURL || request._url));
            RateLimitManager.enterRateLimitedState(request.responseURL || request._url || "XHR\u54CD\u5E94429");
            return;
          }
          if (request.status >= 200 && request.status < 300) {
            try {
              const responseText = request.responseText;
              if (responseText) {
                if (responseText.includes("Too many requests") || responseText.includes("rate limit") || responseText.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                  Utils.logger("warn", Utils.getText("log_xhr_rate_limit_detect", responseText));
                  RateLimitManager.enterRateLimitedState("XHR\u54CD\u5E94\u5185\u5BB9\u9650\u901F");
                  return;
                }
                try {
                  const data = JSON.parse(responseText);
                  if (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit"))) {
                    Utils.logger("warn", Utils.getText("detected_rate_limit_error", JSON.stringify(data)));
                    RateLimitManager.enterRateLimitedState("XHR\u54CD\u5E94\u9650\u901F\u9519\u8BEF");
                    return;
                  }
                  if (data.results && data.results.length === 0 && self.isDebounceableSearch(request._url)) {
                    const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;
                    const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;
                    const urlObj = new URL(request._url, window.location.origin);
                    const params = urlObj.searchParams;
                    const hasSpecialFilters = params.has("query") || params.has("category") || params.has("subcategory") || params.has("tag");
                    if (isEndOfList) {
                      Utils.logger("info", Utils.getText("log_list_end_normal", JSON.stringify(data).substring(0, 200)));
                      RateLimitManager.recordSuccessfulRequest("XHR\u5217\u8868\u672B\u5C3E", true);
                      return;
                    } else if (isEmptySearch && hasSpecialFilters) {
                      Utils.logger("info", Utils.getText("log_empty_search_with_filters", JSON.stringify(data).substring(0, 200)));
                      RateLimitManager.recordSuccessfulRequest("XHR\u7A7A\u641C\u7D22\u7ED3\u679C", true);
                      return;
                    } else if (isEmptySearch && State.appStatus === "RATE_LIMITED") {
                      Utils.logger("info", Utils.getText("log_empty_search_already_limited", JSON.stringify(data).substring(0, 200)));
                      return;
                    } else if (isEmptySearch && document.readyState !== "complete") {
                      Utils.logger("info", Utils.getText("log_empty_search_page_loading", JSON.stringify(data).substring(0, 200)));
                      return;
                    } else if (isEmptySearch && Date.now() - (window.pageLoadTime || 0) < 5e3) {
                      Utils.logger("info", Utils.getText("empty_search_initial"));
                      return;
                    } else {
                      Utils.logger("warn", Utils.getText("detected_possible_rate_limit_empty", JSON.stringify(data).substring(0, 200)));
                      RateLimitManager.enterRateLimitedState("XHR\u54CD\u5E94\u7A7A\u7ED3\u679C");
                      return;
                    }
                  }
                  if (self.isDebounceableSearch(request._url) && data.results && data.results.length > 0) {
                    RateLimitManager.recordSuccessfulRequest(Utils.getText("request_source_xhr_search"), true);
                  }
                } catch (jsonError) {
                }
              }
            } catch (e) {
            }
          }
          if (self.isDebounceableSearch(request._url)) {
            self.handleSearchResponse(request);
          }
        }, "onLoad");
        request.addEventListener("load", onLoad);
        return originalXhrSend.apply(request, args);
      }, "listenerAwareSend");
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        let modifiedUrl = url;
        if (self.shouldPatchUrl(url)) {
          modifiedUrl = self.getPatchedUrl(url);
          this._isDebouncedSearch = false;
        } else if (self.isDebounceableSearch(url)) {
          self.saveLatestCursorFromUrl(url);
          this._isDebouncedSearch = true;
        } else {
          self.saveLatestCursorFromUrl(url);
        }
        this._url = modifiedUrl;
        return originalXhrOpen.apply(this, [method, modifiedUrl, ...args]);
      };
      XMLHttpRequest.prototype.send = function(...args) {
        if (!this._isDebouncedSearch) {
          return listenerAwareSend.apply(this, args);
        }
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("log_debounce_intercept", DEBOUNCE_DELAY_MS));
        }
        if (self._pendingXhr) {
          self._pendingXhr.abort();
          Utils.logger("info", Utils.getText("log_debounce_discard"));
        }
        clearTimeout(self._debounceXhrTimer);
        self._pendingXhr = this;
        self._debounceXhrTimer = setTimeout(() => {
          if (State.debugMode) {
            Utils.logger("debug", Utils.getText("log_debounce_sending", this._url));
          }
          listenerAwareSend.apply(self._pendingXhr, args);
          self._pendingXhr = null;
        }, DEBOUNCE_DELAY_MS);
      };
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        let url = typeof input === "string" ? input : input.url;
        let modifiedInput = input;
        if (self.shouldPatchUrl(url)) {
          const modifiedUrl = self.getPatchedUrl(url);
          if (typeof input === "string") {
            modifiedInput = modifiedUrl;
          } else {
            modifiedInput = new Request(modifiedUrl, input);
          }
        } else {
          self.saveLatestCursorFromUrl(url);
        }
        return originalFetch.apply(this, [modifiedInput, init]).then(async (response) => {
          if (typeof window.recordNetworkActivity === "function") {
            window.recordNetworkActivity();
          }
          if (response.status >= 200 && response.status < 300 && typeof url === "string" && self.isDebounceableSearch(url)) {
            if (typeof window.recordNetworkRequest === "function") {
              window.recordNetworkRequest("Fetch\u5546\u54C1\u8BF7\u6C42", true);
            }
          }
          if (response.status === 429 || response.status === "429" || response.status.toString() === "429") {
            response.clone();
            Utils.logger("warn", Utils.getText("log_fetch_detected_429", response.url));
            RateLimitManager.enterRateLimitedState("Fetch\u54CD\u5E94429").catch(
              (e) => Utils.logger("error", Utils.getText("log_handling_rate_limit_error", e.message))
            );
          }
          if (response.status >= 200 && response.status < 300) {
            try {
              const clonedResponse = response.clone();
              const text = await clonedResponse.text();
              if (text.includes("Too many requests") || text.includes("rate limit") || text.match(/\{\s*"detail"\s*:\s*"Too many requests"\s*\}/i)) {
                Utils.logger("warn", Utils.getText("log_fetch_rate_limit_detect", text.substring(0, 100)));
                RateLimitManager.enterRateLimitedState("Fetch\u54CD\u5E94\u5185\u5BB9\u9650\u901F").catch(
                  (e) => Utils.logger("error", Utils.getText("log_handling_rate_limit_error", e.message))
                );
                return response;
              }
              try {
                const data = JSON.parse(text);
                if (data.detail && (data.detail.includes("Too many requests") || data.detail.includes("rate limit"))) {
                  Utils.logger("warn", Utils.getText("detected_rate_limit_error", "API\u9650\u901F\u54CD\u5E94"));
                  RateLimitManager.enterRateLimitedState("API\u9650\u901F\u54CD\u5E94").catch(
                    (e) => Utils.logger("error", Utils.getText("log_handling_rate_limit_error", e.message))
                  );
                  return response;
                }
                const responseUrl = response.url || "";
                if (data.results && data.results.length === 0 && responseUrl.includes("/i/listings/search")) {
                  const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;
                  const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;
                  const urlObj = new URL(responseUrl, window.location.origin);
                  const params = urlObj.searchParams;
                  const hasSpecialFilters = params.has("query") || params.has("category") || params.has("subcategory") || params.has("tag");
                  if (isEndOfList) {
                    Utils.logger("info", Utils.getText("log_fetch_list_end", JSON.stringify(data).substring(0, 200)));
                    RateLimitManager.recordSuccessfulRequest("Fetch\u5217\u8868\u672B\u5C3E", true);
                  } else if (isEmptySearch && hasSpecialFilters) {
                    Utils.logger("info", Utils.getText("log_fetch_empty_with_filters", JSON.stringify(data).substring(0, 200)));
                    RateLimitManager.recordSuccessfulRequest("Fetch\u7A7A\u641C\u7D22\u7ED3\u679C", true);
                  } else if (isEmptySearch && State.appStatus === "RATE_LIMITED") {
                    Utils.logger("info", Utils.getText("log_fetch_empty_already_limited", JSON.stringify(data).substring(0, 200)));
                  } else if (isEmptySearch && document.readyState !== "complete") {
                    Utils.logger("info", Utils.getText("log_fetch_empty_page_loading", JSON.stringify(data).substring(0, 200)));
                  } else if (isEmptySearch && Date.now() - (window.pageLoadTime || 0) < 5e3) {
                    Utils.logger("info", Utils.getText("empty_search_initial"));
                  } else {
                    Utils.logger("warn", Utils.getText("log_fetch_implicit_rate_limit", JSON.stringify(data).substring(0, 200)));
                    RateLimitManager.enterRateLimitedState("Fetch\u54CD\u5E94\u7A7A\u7ED3\u679C").catch(
                      (e) => Utils.logger("error", Utils.getText("log_handling_rate_limit_error", e.message))
                    );
                  }
                }
              } catch (jsonError) {
                Utils.logger("debug", Utils.getText("log_json_parse_error", jsonError.message));
              }
            } catch (e) {
            }
          }
          return response;
        });
      };
    }
  };

  // src/modules/task-runner.js
  var TaskRunner2 = {
    // TODO: Extract full implementation from original file
    // Key methods to implement:
    // - execute()
    // - executeBatch()
    // - processDetailPage()
    // - scanPageForTasks()
    // - closeWorkerTab()
    // - setupDOMObserver()
    execute: /* @__PURE__ */ __name(async () => {
      Utils.logger("info", "[TaskRunner] Module placeholder - full implementation pending");
    }, "execute"),
    executeBatch: /* @__PURE__ */ __name(async () => {
      Utils.logger("info", "[TaskRunner] executeBatch placeholder");
    }, "executeBatch"),
    processDetailPage: /* @__PURE__ */ __name(async () => {
      Utils.logger("info", "[TaskRunner] processDetailPage placeholder");
    }, "processDetailPage")
  };

  // src/modules/ui.js
  State.UI = {
    container: null,
    logPanel: null,
    execBtn: null,
    hideBtn: null,
    statusDisplay: null
    // ... other UI elements
  };
  var UI4 = {
    // TODO: Extract full implementation from original file
    // Key methods to implement:
    // - init()
    // - update()
    // - createPanel()
    // - createStyles()
    // - updateDebugTab()
    // - removeAllOverlays()
    init: /* @__PURE__ */ __name(() => {
      Utils.logger("info", "[UI] Module placeholder - full implementation pending");
      State.UI.container = document.createElement("div");
      State.UI.container.id = Config.UI_CONTAINER_ID;
      document.body.appendChild(State.UI.container);
    }, "init"),
    update: /* @__PURE__ */ __name(() => {
    }, "update"),
    updateDebugTab: /* @__PURE__ */ __name(() => {
    }, "updateDebugTab"),
    removeAllOverlays: /* @__PURE__ */ __name(() => {
    }, "removeAllOverlays")
  };

  // src/modules/instance-manager.js
  var InstanceManager = {
    isActive: false,
    lastPingTime: 0,
    pingInterval: null,
    // 初始化实例管理
    init: /* @__PURE__ */ __name(async function() {
      try {
        const isSearchPage = window.location.href.includes("/search") || window.location.pathname === "/" || window.location.pathname === "/zh-cn/" || window.location.pathname === "/en/";
        if (isSearchPage) {
          this.isActive = true;
          await this.registerAsActive();
          Utils.logger("info", Utils.getText("log_instance_activated", Config.INSTANCE_ID));
          this.pingInterval = setInterval(() => this.ping(), 3e3);
          return true;
        }
        const activeInstance = await GM_getValue("fab_active_instance", null);
        const currentTime = Date.now();
        if (activeInstance && currentTime - activeInstance.lastPing < 1e4) {
          Utils.logger("info", Utils.getText("log_instance_collaborating", activeInstance.id));
          this.isActive = false;
          return true;
        } else {
          this.isActive = true;
          await this.registerAsActive();
          Utils.logger("info", Utils.getText("log_instance_no_active", Config.INSTANCE_ID));
          this.pingInterval = setInterval(() => this.ping(), 3e3);
          return true;
        }
      } catch (error) {
        Utils.logger("error", Utils.getText("log_instance_init_failed", error.message));
        this.isActive = true;
        return true;
      }
    }, "init"),
    // 注册为活跃实例
    registerAsActive: /* @__PURE__ */ __name(async function() {
      await GM_setValue("fab_active_instance", {
        id: Config.INSTANCE_ID,
        lastPing: Date.now()
      });
    }, "registerAsActive"),
    // 定期更新活跃状态
    ping: /* @__PURE__ */ __name(async function() {
      if (!this.isActive) return;
      this.lastPingTime = Date.now();
      await this.registerAsActive();
    }, "ping"),
    // 检查是否可以接管
    checkTakeover: /* @__PURE__ */ __name(async function() {
      if (this.isActive) return;
      try {
        const activeInstance = await GM_getValue("fab_active_instance", null);
        const currentTime = Date.now();
        if (!activeInstance || currentTime - activeInstance.lastPing > 1e4) {
          this.isActive = true;
          await this.registerAsActive();
          Utils.logger("info", Utils.getText("log_instance_takeover", Config.INSTANCE_ID));
          this.pingInterval = setInterval(() => this.ping(), 3e3);
          location.reload();
        } else {
          setTimeout(() => this.checkTakeover(), 5e3);
        }
      } catch (error) {
        Utils.logger("error", Utils.getText("log_instance_takeover_failed", error.message));
        setTimeout(() => this.checkTakeover(), 5e3);
      }
    }, "checkTakeover"),
    // 清理实例
    cleanup: /* @__PURE__ */ __name(function() {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }, "cleanup")
  };

  // src/index.js
  function countdownRefresh2(delayMs, source) {
    if (State.isRefreshScheduled) {
      Utils.logger("info", Utils.getText("refresh_plan_exists"));
      return;
    }
    State.isRefreshScheduled = true;
    const seconds = Math.ceil(delayMs / 1e3);
    Utils.logger("info", Utils.getText("auto_refresh_countdown", seconds));
    setTimeout(() => {
      const totalCards = document.querySelectorAll(Config.SELECTORS.card).length;
      const hiddenCards = document.querySelectorAll(`${Config.SELECTORS.card}[style*="display: none"]`).length;
      const visibleCards = totalCards - hiddenCards;
      if (visibleCards > 0) {
        Utils.logger("info", Utils.getText("refresh_cancelled_visible_items", visibleCards));
        State.isRefreshScheduled = false;
        return;
      }
      Utils.logger("info", `Refreshing page (source: ${source})...`);
      window.location.reload();
    }, delayMs);
  }
  __name(countdownRefresh2, "countdownRefresh");
  setUIReference(UI4);
  setUIReference2(UI4);
  setDependencies({
    UI: UI4,
    TaskRunner: TaskRunner2,
    countdownRefresh: countdownRefresh2
  });
  async function main() {
    window.pageLoadTime = Date.now();
    Utils.logger("info", Utils.getText("log_script_starting"));
    Utils.detectLanguage();
    if (!Utils.checkAuthentication()) {
      Utils.logger("error", "\u8D26\u53F7\u672A\u767B\u5F55\uFF0C\u811A\u672C\u505C\u6B62\u6267\u884C");
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const workerId = urlParams.get("workerId");
    if (workerId) {
      State.isWorkerTab = true;
      State.workerTaskId = workerId;
      await InstanceManager.init();
      Utils.logger("info", `\u5DE5\u4F5C\u6807\u7B7E\u9875\u521D\u59CB\u5316\u5B8C\u6210\uFF0C\u5F00\u59CB\u5904\u7406\u4EFB\u52A1...`);
      await TaskRunner2.processDetailPage();
      return;
    }
    await InstanceManager.init();
    await Database.load();
    const storedExecutingState = await GM_getValue(Config.DB_KEYS.IS_EXECUTING, false);
    if (State.isExecuting !== storedExecutingState) {
      Utils.logger("info", Utils.getText("log_execution_state_inconsistent", storedExecutingState ? "\u6267\u884C\u4E2D" : "\u5DF2\u505C\u6B62"));
      State.isExecuting = storedExecutingState;
    }
    const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
    if (persistedStatus && persistedStatus.status === "RATE_LIMITED") {
      State.appStatus = "RATE_LIMITED";
      State.rateLimitStartTime = persistedStatus.startTime;
      const previousDuration = persistedStatus && persistedStatus.startTime ? ((Date.now() - persistedStatus.startTime) / 1e3).toFixed(2) : "0.00";
      Utils.logger("warn", Utils.getText("startup_rate_limited", previousDuration, persistedStatus.source || Utils.getText("status_unknown_source")));
    }
    await PagePatcher.init();
    UI4.init();
    UI4.update();
    Utils.logger("info", Utils.getText("log_init"));
  }
  __name(main, "main");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
