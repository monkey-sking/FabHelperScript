// ==UserScript==
// @name         Fab Helper
// @name:zh-CN   Fab Helper
// @name:en      Fab Helper
// @namespace    https://www.fab.com/
// @version      3.6.3-20261127-1551
// @description  Fab Helper 优化版 - 自动领取免费商品与 Bundle 集合，已拥有自动隐藏，人机验证安全提醒与暂停保护，后台多标签与 API 极速处理，智能限速恢复
// @description:zh-CN  Fab Helper 优化版 - 自动领取免费商品与 Bundle 集合，已拥有自动隐藏，人机验证安全提醒与暂停保护，后台多标签与 API 极速处理，智能限速恢复
// @description:en  Fab Helper Optimized - Auto-claim free items & bundles, auto-hide owned, captcha notification & safe pause, background multi-tab & fast API claims, smart rate-limit recovery
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
// @run-at       document-start
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
    execute: "Auto Claim",
    executing: "Stop Claim",
    stopExecute: "Stop Claim",
    retry_failed: "Retry",
    added: "Done",
    failed: "Failed",
    todo: "To-Do",
    hidden: "Filtered",
    visible: "Visible",
    clearLog: "Clear",
    copyLog: "Copy",
    copied: "Copied",
    tab_dashboard: "Dashboard",
    tab_settings: "Settings",
    tab_debug: "Debug",
    toast_all_tasks_completed: "\u{1F389} All tasks have been completed!",
    toast_reached_bottom: "\u{1F3C1} Reached the bottom of the list, all items scanned!",
    close: "Close",
    // 设置分组
    settings_group_general_filter: "General & Filters",
    settings_group_advanced_fallback: "Advanced & Fallback",
    // Mode-free dashboard strings
    exec_full_start: "Scan All Free Items",
    exec_full_resume: "Resume Scan",
    exec_full_resume_pct: "Resume Scan \xB7 {0}%",
    exec_full_stop: "Stop Scan",
    exec_fallback_start: "Scroll Scan (Fallback)",
    exec_fallback_stop: "Stop Scroll Scan",
    reset_checkpoint: "Restart",
    confirm_reset_checkpoint: "Clear the saved scan checkpoint and start over?",
    log_checkpoint_cleared: "Scan checkpoint cleared.",
    status_idle_auto: "Auto-claiming visible free items",
    status_idle_manual: "Click above to scan all free items",
    status_idle_fallback: "Fallback DOM scroll mode is active",
    status_checkpoint_pct: "Saved {1} / {2}",
    status_checkpoint_generic: "Unfinished scan checkpoint",
    status_scan_done: "Scan complete \xB7 {1} items",
    status_scan_partial: "Incomplete ({2} shards left) \xB7 {1} items",
    pill_auto_claim: "Auto-Claim",
    pill_hide_saved: "Hide Owned",
    pill_hide_paid: "Hide Paid",
    setting_dom_fallback: "DOM Scroll Fallback (if API fails)",
    setting_dom_fallback_tooltip: "Use fast API by default; enable only if API fails to fall back to DOM auto-scroll",
    setting_max_workers_desc_tooltip: "Worker tabs for bundles, CAPTCHA fallback, and DOM fallback mode (1-15, default 7)",
    setting_page_only_tooltip: "Only applies in DOM scroll fallback mode",
    tooltip_collapse_ui: "Collapse panel",
    tooltip_expand_ui: "Expand panel",
    log_auto_claim_visible_toggle: "Auto-claim {0}.",
    log_dom_fallback_toggle: "DOM scroll fallback mode {0}.",
    // 应用标题和标签
    app_title: "Fab Helper",
    free_label: "Free",
    operation_log: "Activity Log",
    position_indicator: "\u{1F4CD} ",
    // 按钮文本
    clear_all_data: "Clear All Local Data",
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
    api_pipeline_position: "No saved position",
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
    log_starting_execution: "Starting {0} pending tasks.",
    log_max_workers_reached: "Worker limit reached ({0}).",
    log_tasks_moved: "Moved {0} failed tasks back to the queue.",
    log_auto_add_toggle: "Infinite scroll auto add tasks {0}.",
    log_auto_scroll_toggle: "Auto-scroll page (auto scan all) {0}.",
    log_remember_pos_toggle: "Remember waterfall browsing position {0}.",
    log_auto_resume_toggle: "429 auto resume function {0}.",
    log_auto_resume_start: "\u{1F504} 429 auto resume activated! Will refresh page in {0} seconds to attempt recovery...",
    log_auto_resume_detect: "\u{1F504} Detected 429 error, will auto refresh page in {0} seconds to attempt recovery...",
    log_refresh_error: "Error during state synchronization:",
    log_unsettled_cards: "{0} cards are still loading. Will check again shortly.",
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
    log_all_hidden_rate_limited: "Rate limited with no visible items; scheduling one recovery refresh.",
    log_refresh_cancelled_tasks: "Detected {0} to-do tasks and {1} active workers; auto refresh cancelled.",
    log_refresh_cancelled_visible: "Detected {0} visible items before refresh; auto refresh cancelled.",
    log_refreshing: "No visible items and still rate limited; refreshing page.",
    rate_limit_no_visible_reason: "rate limited with no visible items",
    // 限速检测来源
    rate_limit_source_page_content: "Page Content Detection",
    rate_limit_source_global_call: "Global Call",
    // 日志标签
    log_tag_auto_add: "Auto Add",
    // 自动添加相关消息
    auto_add_api_timeout: "API wait timeout, waited {0}ms, will continue processing cards.",
    auto_add_api_error: "Error while waiting for API: {0}",
    auto_add_new_tasks: "Added {0} new tasks to queue.",
    auto_scroll_attempt: "[Auto Scroll] Queue empty, attempting to scroll down to load more... (Attempt {0}/{1})",
    auto_scroll_success: "[Auto Scroll] Successfully loaded and identified {0} new tasks, continuing...",
    auto_scroll_cards_loaded: "[Auto Scroll] Detected {0} new cards, continuing hide/scan and scroll...",
    auto_scroll_reached_bottom: "[Auto Scroll] Server confirmed no more items; auto-add succeeded, stopping scroll.",
    auto_scroll_no_new_items: "[Auto Scroll] No new eligible items found after {0} consecutive scrolls, stopping auto scroll.",
    auto_scroll_waiting: "[Auto Scroll] No new eligible items found, waiting for next scroll attempt...",
    auto_scroll_safety_stop: "[Auto Scroll] No new content for {0} consecutive rounds and no server end-of-list signal received; safety stop (auto-add success NOT confirmed, check network/API).",
    auto_scroll_resume_hidden: "[Auto Add] No visible items remain on page; scrolling to load next page and continue hiding/adding.",
    auto_scroll_resume_empty: "[Auto Add] Page has no cards and list is not at end; scheduling a recovery refresh.",
    memory_recycle_trigger: "[Memory Recycle] {0} cards accumulated on page (threshold {1}); reloading and resuming from the saved position (session recycle #{2}).",
    memory_recycle_resume: "[Memory Recycle] Reload complete; resuming scan from the saved cursor...",
    memory_recycle_disabled: "[Memory Recycle] List position moved back to the beginning after {0} recycles; auto recycle paused to avoid a reload loop (continuing on the current page).",
    memory_recycle_failed: "[Memory Recycle] Reload failed, continuing on the current page: {0}",
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
    setting_auto_refresh: "Auto Refresh Empty Page",
    setting_auto_add_scroll: "Auto Add on Scroll",
    setting_auto_scroll: "Auto Scroll Page",
    setting_fast_api_scan: "Fast API Scan",
    setting_fast_api_scan_tooltip: "Bypass DOM scrolling using parallel API shards & direct main-tab claiming",
    setting_api_scan_concurrency: "API Concurrency",
    setting_api_scan_concurrency_tooltip: "Parallel API scan shards (1-6, default 4)",
    setting_incremental_early_stop: "Incremental Early Stop",
    setting_incremental_early_stop_tooltip: "Active on -firstPublishedAt: stop after N consecutive all-owned pages",
    setting_incremental_stop_pages: "Stop Threshold (Pages)",
    setting_incremental_stop_pages_tooltip: "Consecutive all-owned pages before stopping incremental scan (1-50, default 5)",
    setting_remember_position: "Remember Position",
    setting_auto_resume_429: "Auto resume after 429 errors",
    setting_hide_discounted: "Filter Discounted Items",
    setting_hide_paid: "Filter Paid Items",
    setting_block_large_resources: "Block Large Resources",
    setting_max_workers: "Worker Tabs",
    setting_max_workers_tooltip: "Concurrent worker tabs (default 7)",
    setting_verification_notify: "Verification Alert",
    log_max_workers_changed: "Concurrent worker tabs set to: %s",
    log_fast_api_scan_toggle: "Fast API Scan {0}.",
    log_api_scan_concurrency_changed: "API scan concurrency set to: {0}",
    log_incremental_early_stop_toggle: "Incremental early stop {0}.",
    log_incremental_stop_pages_changed: "Incremental stop threshold set to: {0} pages",
    toast_fast_scan_completed: "\u26A1 Fast scan complete! Scanned {1} items, newly claimed {0}.",
    toast_fast_scan_early_stop: "\u26A1 Incremental scan complete! Consecutive owned pages reached (scanned {1}, claimed {0}).",
    toast_fast_scan_partial: "\u26A0\uFE0F Fast scan incomplete: scanned {1}, claimed {0}, {2} shard(s) failed. Checkpoint kept for resume.",
    fast_scan_status_paused: "\u26A1 Fast scan paused ({0}/{1} \xB7 checkpoint saved)",
    fast_scan_status_partial: "\u26A1 Incomplete \xB7 {1} scanned \xB7 {0} claimed \xB7 {2} failed shards (checkpoint saved)",
    fast_scan_status_completed: "\u26A1 Scan done \xB7 {1} scanned \xB7 {0} claimed",
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
    worker_captcha: "CAPTCHA / human verification detected (manual action needed)",
    log_keepalive_on: "Background keep-alive started (Worker heartbeat + freeze guard)",
    log_keepalive_failed: "Failed to start keep-alive: {0}",
    log_auto_retry: "\u21BB Auto-retry ({0}/{1}): {2}",
    keepalive_label: "KeepAlive",
    keepalive_dead: "\u26A0\uFE0Foff (CSP?)",
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
    clear_position_tooltip: "Reset position and refresh",
    confirm_reset_position: "Are you sure you want to clear the saved browsing position and refresh the page?",
    no_position_to_reset: "No saved browsing position.",
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
    log_cleared_from_failed: "Cleared {0} actually-owned items from the failed list.",
    log_failed_check_start: "Checking status of failed items (verifying local records and server status)...",
    log_failed_check_local: "[Local Check] Found {0} items already marked done locally, removing from failed list...",
    log_failed_check_network: "[Server Check] Querying server for acquisition status of remaining {0} items...",
    log_failed_check_network_confirmed: "[Server Check] Confirmed {0} items actually acquired, updating database...",
    log_failed_check_network_none: "[Server Check] No other acquired items detected.",
    log_failed_check_complete: "\u2728 Check complete! Removed {0} successfully acquired items from the failed list.",
    log_failed_check_all_done: "\u{1F389} All failed items are verified as acquired! Failed list is now empty.",
    confirm_open_failed_remaining: "Status check complete. {0} items are still not in library.\nDo you want to open these {0} failed items in new tabs for manual processing?",
    alert_failed_all_done: "All failed items are verified as acquired. No manual action needed!",
    // Wake/visibility recovery
    log_wake_recovery: "\u{1F514} Tab re-activated (lock screen / tab switch recovery). Checking execution state...",
    log_wake_cleanup_stale: "\u{1F9F9} Cleaned up {0} stale workers frozen by lock screen. Restarting execution.",
    log_wake_restarting: "\u25B6\uFE0F Re-activating execution ({0} pending tasks).",
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
    // 自动滚动挂起恢复
    log_auto_scroll_stuck_refresh: "\u26A0\uFE0F Auto-scroll failed to find new items consecutively while executing tasks, triggering auto page refresh to recover...",
    log_auto_scroll_stuck_96_refresh: "\u26A0\uFE0F Detected special scenario ({0} items hidden and no visible items, pagination stuck), saving temporary cursor, refreshing page to recover...",
    log_auto_scroll_stuck_recovery_failed: "Already tried to recover using the current cursor but still no new items. Assuming end of list has been reached, stopping refresh.",
    // 账号验证
    auth_error: "Session expired: CSRF token not found, please log in again",
    auth_error_alert: "Session expired: Please log in again before using the script",
    auth_session_invalid: "Login session is invalid. Please log in again before starting a run.",
    auth_worker_aborted: "Worker tab detected no active login; task processing aborted.",
    auth_scan_blocked: "Not logged in (or session expired). Scan skipped to avoid treating every paid item as free."
  };

  // src/i18n/zh.js
  var zh = {
    // 基础UI
    hide: "\u9690\u85CF\u5DF2\u5F97",
    show: "\u663E\u793A\u5DF2\u5F97",
    sync: "\u540C\u6B65\u72B6\u6001",
    execute: "\u4E00\u952E\u5165\u5E93",
    executing: "\u505C\u6B62\u5165\u5E93",
    stopExecute: "\u505C\u6B62\u5165\u5E93",
    retry_failed: "\u91CD\u8BD5",
    hideDiscounted: "\u9690\u85CF\u6253\u6298",
    showDiscounted: "\u663E\u793A\u6253\u6298",
    hidePaid: "\u9690\u85CF\u4ED8\u8D39",
    showPaid: "\u663E\u793A\u4ED8\u8D39",
    added: "\u5DF2\u5165\u5E93",
    failed: "\u5931\u8D25",
    todo: "\u5F85\u5165\u5E93",
    hidden: "\u5DF2\u6EE4",
    visible: "\u53EF\u89C1",
    clearLog: "\u6E05\u7A7A",
    copyLog: "\u590D\u5236",
    copied: "\u5DF2\u590D\u5236",
    tab_dashboard: "\u4EEA\u8868\u76D8",
    tab_settings: "\u8BBE\u5B9A",
    tab_debug: "\u8C03\u8BD5",
    toast_all_tasks_completed: "\u{1F389} \u6240\u6709\u4EFB\u52A1\u5DF2\u5904\u7406\u5B8C\u6210\uFF01",
    toast_reached_bottom: "\u{1F3C1} \u5DF2\u5230\u8FBE\u5546\u54C1\u5217\u8868\u5E95\u90E8\uFF0C\u5168\u90E8\u5546\u54C1\u626B\u63CF\u5B8C\u6BD5\uFF01",
    close: "\u5173\u95ED",
    // 设置分组
    settings_group_general_filter: "\u5E38\u89C4\u4E0E\u8FC7\u6EE4",
    settings_group_advanced_fallback: "\u9AD8\u7EA7\u4E0E\u5907\u7528\u65B9\u6848",
    // 零模式工作台文案
    exec_full_start: "\u5168\u7AD9\u626B\u63CF\u5165\u5E93",
    exec_full_resume: "\u7EE7\u7EED\u4E0A\u6B21\u626B\u63CF",
    exec_full_resume_pct: "\u7EE7\u7EED\u4E0A\u6B21\u626B\u63CF \xB7 {0}%",
    exec_full_stop: "\u505C\u6B62\u626B\u63CF",
    exec_fallback_start: "\u5F00\u59CB\u6EDA\u9875\u626B\u63CF (\u5907\u7528)",
    exec_fallback_stop: "\u505C\u6B62\u6EDA\u9875\u626B\u63CF",
    reset_checkpoint: "\u91CD\u626B",
    confirm_reset_checkpoint: "\u786E\u5B9A\u6E05\u9664\u4E0A\u6B21\u626B\u63CF\u65AD\u70B9\u5E76\u4ECE\u5934\u5F00\u59CB\u5417\uFF1F",
    log_checkpoint_cleared: "\u5DF2\u6E05\u9664\u626B\u63CF\u65AD\u70B9\u3002",
    status_idle_auto: "\u773C\u524D\u514D\u8D39\u81EA\u52A8\u9886\u8FD0\u884C\u4E2D",
    status_idle_manual: "\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u5168\u7AD9\u626B\u63CF\u5165\u5E93",
    status_idle_fallback: "\u5E94\u6025\u6EDA\u9875\u5907\u7528\u6A21\u5F0F\u5DF2\u542F\u7528",
    status_checkpoint_pct: "\u4E0A\u6B21\u8FDB\u5EA6 {1} / {2}",
    status_checkpoint_generic: "\u5B58\u5728\u672A\u5B8C\u6210\u65AD\u70B9",
    status_scan_done: "\u626B\u63CF\u5B8C\u6210 \xB7 {1} \u4EF6",
    status_scan_partial: "\u672A\u5B8C\u6574\uFF08\u5269 {2} \u5206\u7247\uFF09\xB7 {1} \u4EF6",
    pill_auto_claim: "\u81EA\u52A8\u9886\u672C\u9875",
    pill_hide_saved: "\u9690\u85CF\u5DF2\u62E5\u6709",
    pill_hide_paid: "\u9690\u85CF\u4ED8\u8D39",
    setting_dom_fallback: "\u5E94\u6025\u6EDA\u9875\u6A21\u5F0F\uFF08API \u5931\u6548\u5907\u7528\uFF09",
    setting_dom_fallback_tooltip: "\u9ED8\u8BA4\u8D70\u6781\u901F API\uFF1B\u4EC5\u5F53\u63A5\u53E3\u5931\u6548\u65F6\u5F00\u542F\uFF0C\u5207\u56DE\u65E7\u7248\u7F51\u9875\u81EA\u52A8\u6EDA\u9875 + \u8BE6\u60C5\u6807\u7B7E\u515C\u5E95",
    setting_max_workers_desc_tooltip: "Bundle\u3001\u4EBA\u673A\u9A8C\u8BC1\u515C\u5E95\u4E0E\u5E94\u6025\u6EDA\u9875\u6A21\u5F0F\u4F7F\u7528\u7684\u5E76\u53D1\u5DE5\u4F5C\u6807\u7B7E\u6570\uFF081-15\uFF0C\u9ED8\u8BA4 7\uFF09",
    setting_page_only_tooltip: "\u4EC5\u5728\u5E94\u6025\u6EDA\u9875\u5907\u7528\u6A21\u5F0F\u4E0B\u751F\u6548",
    tooltip_collapse_ui: "\u6536\u8D77\u9762\u677F",
    tooltip_expand_ui: "\u5C55\u5F00\u9762\u677F",
    log_auto_claim_visible_toggle: "\u81EA\u52A8\u9886\u672C\u9875\u5DF2{0}\u3002",
    log_dom_fallback_toggle: "\u5E94\u6025\u6EDA\u9875\u5907\u7528\u6A21\u5F0F\u5DF2{0}\u3002",
    // 应用标题和标签
    app_title: "Fab Helper",
    free_label: "\u514D\u8D39",
    operation_log: "\u8FD0\u884C\u65E5\u5FD7",
    position_indicator: "\u{1F4CD} ",
    // 按钮文本
    clear_all_data: "\u6E05\u7A7A\u6240\u6709\u672C\u5730\u5B58\u6863",
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
    api_pipeline_position: "\u65E0\u4FDD\u5B58\u4F4D\u7F6E",
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
    log_starting_execution: "\u5F00\u59CB\u6267\u884C {0} \u4E2A\u5F85\u529E\u4EFB\u52A1\u3002",
    log_max_workers_reached: "\u5DF2\u8FBE\u5230\u5DE5\u4F5C\u7EBF\u7A0B\u4E0A\u9650\uFF08{0}\uFF09\u3002",
    log_tasks_moved: "\u5DF2\u5C06 {0} \u4E2A\u5931\u8D25\u4EFB\u52A1\u79FB\u56DE\u5F85\u529E\u961F\u5217\u3002",
    log_auto_add_toggle: "\u65E0\u9650\u6EDA\u52A8\u81EA\u52A8\u6DFB\u52A0\u4EFB\u52A1\u5DF2{0}\u3002",
    log_auto_scroll_toggle: "\u81EA\u52A8\u6EDA\u52A8\u9875\u9762\uFF08\u81EA\u52A8\u626B\u63CF\u5168\u90E8\uFF09\u5DF2{0}\u3002",
    log_remember_pos_toggle: "\u8BB0\u4F4F\u7011\u5E03\u6D41\u6D4F\u89C8\u4F4D\u7F6E\u529F\u80FD\u5DF2{0}\u3002",
    log_auto_resume_toggle: "429\u540E\u81EA\u52A8\u6062\u590D\u529F\u80FD\u5DF2{0}\u3002",
    log_auto_resume_start: "\u{1F504} 429\u81EA\u52A8\u6062\u590D\u542F\u52A8\uFF01\u5C06\u5728{0}\u79D2\u540E\u5237\u65B0\u9875\u9762\u5C1D\u8BD5\u6062\u590D...",
    log_auto_resume_detect: "\u{1F504} \u68C0\u6D4B\u5230429\u9519\u8BEF\uFF0C\u5C06\u5728{0}\u79D2\u540E\u81EA\u52A8\u5237\u65B0\u9875\u9762\u5C1D\u8BD5\u6062\u590D...",
    log_refresh_error: "\u72B6\u6001\u540C\u6B65\u8FC7\u7A0B\u4E2D\u51FA\u9519:",
    log_unsettled_cards: "\u8FD8\u6709 {0} \u5F20\u5361\u7247\u6B63\u5728\u52A0\u8F7D\uFF0C\u7A0D\u540E\u518D\u68C0\u67E5\u3002",
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
    log_all_hidden_rate_limited: "\u9650\u901F\u72B6\u6001\u4E0B\u5F53\u524D\u6CA1\u6709\u53EF\u89C1\u5546\u54C1\uFF0C\u51C6\u5907\u5B89\u6392\u4E00\u6B21\u6062\u590D\u5237\u65B0\u3002",
    log_refresh_cancelled_tasks: "\u68C0\u6D4B\u5230\u6709 {0} \u4E2A\u5F85\u529E\u4EFB\u52A1\u548C {1} \u4E2A\u6D3B\u52A8\u5DE5\u4F5C\u7EBF\u7A0B\uFF0C\u5DF2\u53D6\u6D88\u81EA\u52A8\u5237\u65B0\u3002",
    log_refresh_cancelled_visible: "\u5237\u65B0\u524D\u68C0\u6D4B\u5230\u9875\u9762\u4E0A\u6709 {0} \u4E2A\u53EF\u89C1\u5546\u54C1\uFF0C\u5DF2\u53D6\u6D88\u81EA\u52A8\u5237\u65B0\u3002",
    log_refreshing: "\u9875\u9762\u4E0A\u6CA1\u6709\u53EF\u89C1\u5546\u54C1\u4E14\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u6B63\u5728\u5237\u65B0\u9875\u9762\u3002",
    rate_limit_no_visible_reason: "\u9650\u901F\u72B6\u6001\u65E0\u53EF\u89C1\u5546\u54C1",
    // 限速检测来源
    rate_limit_source_page_content: "\u9875\u9762\u5185\u5BB9\u68C0\u6D4B",
    rate_limit_source_global_call: "\u5168\u5C40\u8C03\u7528",
    // 日志标签
    log_tag_auto_add: "\u81EA\u52A8\u6DFB\u52A0",
    // 自动添加相关消息
    auto_add_api_timeout: "API\u7B49\u5F85\u8D85\u65F6\uFF0C\u5DF2\u7B49\u5F85 {0}ms\uFF0C\u5C06\u7EE7\u7EED\u5904\u7406\u5361\u7247\u3002",
    auto_add_api_error: "\u7B49\u5F85API\u65F6\u51FA\u9519: {0}",
    auto_add_new_tasks: "\u65B0\u589E {0} \u4E2A\u4EFB\u52A1\u5230\u961F\u5217\u3002",
    auto_scroll_attempt: "[\u81EA\u52A8\u6EDA\u52A8] \u961F\u5217\u5DF2\u7A7A\uFF0C\u5C1D\u8BD5\u5411\u4E0B\u6EDA\u52A8\u52A0\u8F7D\u66F4\u591A\u5546\u54C1... (\u5C1D\u8BD5 {0}/{1})",
    auto_scroll_success: "[\u81EA\u52A8\u6EDA\u52A8] \u6210\u529F\u52A0\u8F7D\u5E76\u8BC6\u522B\u5230 {0} \u4E2A\u65B0\u4EFB\u52A1\uFF0C\u7EE7\u7EED\u6267\u884C...",
    auto_scroll_cards_loaded: "[\u81EA\u52A8\u6EDA\u52A8] \u68C0\u6D4B\u5230 {0} \u5F20\u65B0\u5361\u7247\uFF0C\u7EE7\u7EED\u9690\u85CF/\u626B\u63CF\u5E76\u6EDA\u52A8...",
    auto_scroll_reached_bottom: "[\u81EA\u52A8\u6EDA\u52A8] \u670D\u52A1\u5668\u786E\u8BA4\u5DF2\u65E0\u66F4\u591A\u5546\u54C1\uFF0C\u81EA\u52A8\u5165\u5E93\u6210\u529F\uFF0C\u505C\u6B62\u6EDA\u52A8\u3002",
    auto_scroll_no_new_items: "[\u81EA\u52A8\u6EDA\u52A8] \u8FDE\u7EED {0} \u6B21\u6EDA\u52A8\u5747\u672A\u53D1\u73B0\u7B26\u5408\u6761\u4EF6\u7684\u65B0\u5546\u54C1\uFF0C\u505C\u6B62\u81EA\u52A8\u6EDA\u52A8\u3002",
    auto_scroll_waiting: "[\u81EA\u52A8\u6EDA\u52A8] \u672A\u53D1\u73B0\u7B26\u5408\u6761\u4EF6\u7684\u65B0\u5546\u54C1\uFF0C\u7B49\u5F85\u4E0B\u4E00\u6B21\u6EDA\u52A8\u5C1D\u8BD5...",
    auto_scroll_safety_stop: "[\u81EA\u52A8\u6EDA\u52A8] \u8FDE\u7EED {0} \u8F6E\u672A\u53D1\u73B0\u65B0\u5185\u5BB9\u4E14\u672A\u6536\u5230\u670D\u52A1\u5668\u5230\u5E95\u4FE1\u53F7\uFF0C\u5B89\u5168\u505C\u6B62\uFF08\u672A\u786E\u8BA4\u81EA\u52A8\u5165\u5E93\u6210\u529F\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC/\u63A5\u53E3\uFF09\u3002",
    auto_scroll_resume_hidden: "[\u81EA\u52A8\u5165\u5E93] \u9875\u9762\u5DF2\u65E0\u53EF\u89C1\u5546\u54C1\uFF0C\u4E3B\u52A8\u6EDA\u52A8\u52A0\u8F7D\u4E0B\u4E00\u9875\u7EE7\u7EED\u9690\u85CF/\u5165\u5E93\u3002",
    auto_scroll_resume_empty: "[\u81EA\u52A8\u5165\u5E93] \u9875\u9762\u6CA1\u6709\u5361\u7247\u4E14\u672A\u5230\u5217\u8868\u672B\u5C3E\uFF0C\u5B89\u6392\u4E00\u6B21\u6062\u590D\u5237\u65B0\u3002",
    memory_recycle_trigger: "[\u5185\u5B58\u56DE\u6536] \u9875\u9762\u5DF2\u7D2F\u79EF {0} \u5F20\u5361\u7247\uFF08\u9608\u503C {1}\uFF09\uFF0C\u5237\u65B0\u9875\u9762\u5E76\u4ECE\u4FDD\u5B58\u4F4D\u7F6E\u7EE7\u7EED\uFF08\u672C\u6B21\u4F1A\u8BDD\u7B2C {2} \u6B21\uFF09\u3002",
    memory_recycle_resume: "[\u5185\u5B58\u56DE\u6536] \u5237\u65B0\u5B8C\u6210\uFF0C\u6B63\u5728\u4ECE\u4E0A\u6B21\u4FDD\u5B58\u7684\u6E38\u6807\u4F4D\u7F6E\u7EE7\u7EED\u626B\u63CF...",
    memory_recycle_disabled: "[\u5185\u5B58\u56DE\u6536] \u8FDE\u7EED {0} \u6B21\u56DE\u6536\u540E\u5217\u8868\u4F4D\u7F6E\u53CD\u800C\u9000\u56DE\u5F00\u5934\uFF0C\u5DF2\u6682\u505C\u81EA\u52A8\u56DE\u6536\uFF0C\u907F\u514D\u5FAA\u73AF\u5237\u65B0\uFF08\u672C\u8F6E\u7EE7\u7EED\u5728\u5F53\u524D\u9875\u9762\u626B\u63CF\uFF09\u3002",
    memory_recycle_failed: "[\u5185\u5B58\u56DE\u6536] \u5237\u65B0\u5931\u8D25\uFF0C\u7EE7\u7EED\u5728\u5F53\u524D\u9875\u9762\u626B\u63CF: {0}",
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
    setting_auto_refresh: "\u7A7A\u9875\u81EA\u52A8\u5237\u65B0",
    setting_auto_add_scroll: "\u6EDA\u52A8\u81EA\u52A8\u5165\u5E93",
    setting_auto_resume_429: "429\u540E\u81EA\u52A8\u6062\u590D\u5E76\u7EE7\u7EED",
    setting_auto_scroll: "\u81EA\u52A8\u5411\u4E0B\u7FFB\u9875",
    setting_fast_api_scan: "\u6781\u901F API \u626B\u63CF",
    setting_fast_api_scan_tooltip: "\u8DF3\u8FC7 DOM \u6EDA\u52A8\uFF0C\u76F4\u63A5\u5E76\u53D1\u62C9\u53D6\u63A5\u53E3\u4E0E\u4E3B\u6807\u7B7E\u76F4\u9886\uFF08\u63D0\u901F 20x+\uFF09",
    setting_api_scan_concurrency: "API \u5E76\u53D1\u8DEF\u6570",
    setting_api_scan_concurrency_tooltip: "API \u5206\u7247\u5E76\u884C\u641C\u7D22\u8DEF\u6570\uFF081-6\uFF0C\u9ED8\u8BA4 4\uFF09",
    setting_incremental_early_stop: "\u8FFD\u65B0\u65E9\u505C",
    setting_incremental_early_stop_tooltip: "\u4EC5\u5728\u300C\u6700\u65B0\u53D1\u5E03\u5012\u5E8F\u300D\u4E0B\u751F\u6548\uFF1A\u8FDE\u7EED N \u9875\u5168\u5DF2\u62E5\u6709\u5373\u505C\u6B62",
    setting_incremental_stop_pages: "\u65E9\u505C\u9608\u503C(\u9875)",
    setting_incremental_stop_pages_tooltip: "\u8FDE\u7EED\u591A\u5C11\u9875\u5168\u5DF2\u62E5\u6709\u540E\u505C\u6B62\u8FFD\u65B0\u626B\u63CF\uFF081-50\uFF0C\u9ED8\u8BA4 5\uFF09",
    setting_remember_position: "\u8BB0\u5FC6\u6D4F\u89C8\u4F4D\u7F6E",
    setting_hide_discounted: "\u8FC7\u6EE4\u6253\u6298\u5546\u54C1",
    setting_hide_paid: "\u8FC7\u6EE4\u4ED8\u8D39\u5546\u54C1",
    setting_block_large_resources: "\u65E0\u56FE\u7701\u6D41\u6A21\u5F0F",
    setting_max_workers: "\u5E76\u53D1\u5DE5\u4F5C\u6807\u7B7E",
    setting_max_workers_tooltip: "\u5E76\u53D1 worker \u6807\u7B7E\u9875\u6570\u91CF\uFF08\u9ED8\u8BA4 7\uFF09",
    setting_verification_notify: "\u4EBA\u673A\u9A8C\u8BC1\u901A\u77E5",
    log_max_workers_changed: "\u5E76\u53D1\u5DE5\u4F5C\u6807\u7B7E\u9875\u6570\u91CF\u5DF2\u8BBE\u7F6E\u4E3A: %s",
    log_fast_api_scan_toggle: "\u6781\u901F API \u626B\u63CF\u5DF2{0}\u3002",
    log_api_scan_concurrency_changed: "API \u626B\u63CF\u5E76\u53D1\u8DEF\u6570\u5DF2\u8BBE\u7F6E\u4E3A: {0}",
    log_incremental_early_stop_toggle: "\u5012\u5E8F\u8FFD\u65B0\u65E9\u505C\u5DF2{0}\u3002",
    log_incremental_stop_pages_changed: "\u8FFD\u65B0\u65E9\u505C\u8FDE\u7EED\u5DF2\u62E5\u6709\u9875\u6570\u9608\u503C\u5DF2\u8BBE\u7F6E\u4E3A: {0}",
    toast_fast_scan_completed: "\u26A1 \u6781\u901F\u626B\u63CF\u5B8C\u6210\uFF01\u5171\u626B\u63CF {1} \u4E2A\u5546\u54C1\uFF0C\u672C\u6B21\u65B0\u9886 {0} \u4E2A\u3002",
    toast_fast_scan_early_stop: "\u26A1 \u589E\u91CF\u8FFD\u65B0\u5B8C\u6210\uFF01\u8FDE\u7EED\u591A\u9875\u5747\u5DF2\u5165\u5E93\uFF08\u626B\u63CF {1} \u4E2A\uFF0C\u65B0\u9886 {0} \u4E2A\uFF09\u3002",
    toast_fast_scan_partial: "\u26A0\uFE0F \u6781\u901F\u626B\u63CF\u672A\u5B8C\u6574\uFF1A\u5171\u626B\u63CF {1} \u4E2A\u5546\u54C1\uFF0C\u65B0\u9886 {0} \u4E2A\uFF0C\u6709 {2} \u4E2A\u5206\u7247\u8BF7\u6C42\u5931\u8D25\uFF0C\u5DF2\u4FDD\u7559\u65AD\u70B9\uFF0C\u70B9\u51FB\u53EF\u7EE7\u7EED\u8865\u626B\u3002",
    fast_scan_status_paused: "\u26A1 \u6781\u901F\u626B\u63CF\u5DF2\u6682\u505C ({0}/{1} \xB7 \u65AD\u70B9\u5DF2\u5B58)",
    fast_scan_status_partial: "\u26A1 \u626B\u63CF\u672A\u5B8C\u6574 \xB7 \u5171 {1} \u4EF6 \xB7 \u65B0\u9886 {0} \xB7 {2} \u5206\u7247\u5931\u8D25(\u5DF2\u5B58\u65AD\u70B9)",
    fast_scan_status_completed: "\u26A1 \u626B\u63CF\u5B8C\u6210 \xB7 \u5171 {1} \u4EF6 \xB7 \u65B0\u9886 {0}",
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
    worker_captcha: "\u68C0\u6D4B\u5230\u4EBA\u673A\u9A8C\u8BC1 / \u9700\u8981\u4EBA\u5DE5\u5904\u7406",
    log_keepalive_on: "\u540E\u53F0\u4FDD\u6D3B\u5DF2\u542F\u52A8\uFF08Worker \u5FC3\u8DF3 + \u9632\u51BB\u7ED3\uFF09",
    log_keepalive_failed: "\u540E\u53F0\u4FDD\u6D3B\u542F\u52A8\u5931\u8D25: {0}",
    log_auto_retry: "\u21BB \u81EA\u52A8\u91CD\u8BD5 ({0}/{1}): {2}",
    keepalive_label: "\u4FDD\u6D3B",
    keepalive_dead: "\u26A0\uFE0F\u672A\u542F\u52A8(\u7591\u88ABCSP\u62E6)",
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
    clear_position_tooltip: "\u91CD\u7F6E\u6D4F\u89C8\u4F4D\u7F6E\u5E76\u5237\u65B0",
    confirm_reset_position: "\u786E\u5B9A\u8981\u6E05\u9664\u5DF2\u4FDD\u5B58\u7684\u6D4F\u89C8\u4F4D\u7F6E\u5E76\u5237\u65B0\u9875\u9762\u5417\uFF1F",
    no_position_to_reset: "\u5F53\u524D\u6CA1\u6709\u4FDD\u5B58\u7684\u6D4F\u89C8\u4F4D\u7F6E\u3002",
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
    log_cleared_from_failed: "\u5DF2\u4ECE\u5931\u8D25\u5217\u8868\u4E2D\u6E05\u9664 {0} \u4E2A\u5B9E\u9645\u5DF2\u5165\u5E93\u7684\u5546\u54C1\u3002",
    log_failed_check_start: "\u6B63\u5728\u5BF9\u5931\u8D25\u9879\u76EE\u8FDB\u884C\u72B6\u6001\u68C0\u6D4B\uFF08\u6BD4\u5BF9\u672C\u5730\u8BB0\u5F55\u4E0E\u8054\u7F51\u72B6\u6001\uFF09...",
    log_failed_check_local: "[\u672C\u5730\u68C0\u6D4B] \u53D1\u73B0 {0} \u4E2A\u9879\u76EE\u5728\u672C\u5730\u5DF2\u6807\u8BB0\u5B8C\u6210\uFF0C\u6B63\u5728\u4ECE\u5931\u8D25\u5217\u8868\u4E2D\u79FB\u9664...",
    log_failed_check_network: "[\u8054\u7F51\u68C0\u6D4B] \u6B63\u5728\u5411\u670D\u52A1\u5668\u67E5\u8BE2\u5269\u4F59 {0} \u4E2A\u9879\u76EE\u7684\u5165\u5E93\u72B6\u6001...",
    log_failed_check_network_confirmed: "[\u8054\u7F51\u68C0\u6D4B] \u786E\u8BA4\u6709 {0} \u4E2A\u9879\u76EE\u5B9E\u9645\u5DF2\u88AB\u52A0\u5E93\uFF0C\u6B63\u5728\u66F4\u65B0\u6570\u636E\u5E93...",
    log_failed_check_network_none: "[\u8054\u7F51\u68C0\u6D4B] \u672A\u68C0\u6D4B\u5230\u5176\u4ED6\u5DF2\u52A0\u5E93\u9879\u76EE\u3002",
    log_failed_check_complete: "\u2728 \u68C0\u6D4B\u5B8C\u6210\uFF01\u5171\u5254\u9664\u4E86 {0} \u4E2A\u5DF2\u6210\u529F\u5165\u5E93\u7684\u9879\u76EE\u3002",
    log_failed_check_all_done: "\u{1F389} \u6240\u6709\u5931\u8D25\u9879\u76EE\u68C0\u6D4B\u5747\u5DF2\u786E\u8BA4\u5165\u5E93\uFF0C\u5931\u8D25\u5217\u8868\u5DF2\u6E05\u7A7A\uFF01",
    confirm_open_failed_remaining: "\u72B6\u6001\u6838\u5BF9\u5B8C\u6210\uFF0C\u4ECD\u6709 {0} \u4E2A\u5546\u54C1\u672A\u5165\u5E93\u3002\n\u662F\u5426\u5728\u65B0\u6807\u7B7E\u9875\u4E2D\u6253\u5F00\u8FD9 {0} \u4E2A\u5931\u8D25\u5546\u54C1\u4EE5\u4F9B\u624B\u52A8\u5904\u7406\uFF1F",
    alert_failed_all_done: "\u6240\u6709\u5931\u8D25\u9879\u76EE\u68C0\u6D4B\u5747\u5DF2\u786E\u8BA4\u5165\u5E93\uFF0C\u65E0\u9700\u624B\u52A8\u64CD\u4F5C\uFF01",
    // 锁屏/后台恢复
    log_wake_recovery: "\u{1F514} \u68C0\u6D4B\u5230\u6807\u7B7E\u9875\u91CD\u65B0\u6FC0\u6D3B\uFF08\u9501\u5C4F/\u5207\u6362\u540E\u6062\u590D\uFF09\uFF0C\u6B63\u5728\u68C0\u67E5\u6267\u884C\u72B6\u6001...",
    log_wake_cleanup_stale: "\u{1F9F9} \u6E05\u7406 {0} \u4E2A\u56E0\u9501\u5C4F\u51BB\u7ED3\u8D85\u65F6\u7684\u5DE5\u4F5C\u7EBF\u7A0B\uFF0C\u91CD\u65B0\u542F\u52A8\u6267\u884C\u3002",
    log_wake_restarting: "\u25B6\uFE0F \u91CD\u65B0\u6FC0\u6D3B\u6267\u884C\uFF08\u5171 {0} \u4E2A\u5F85\u529E\u4EFB\u52A1\uFF09\u3002",
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
    // 自动滚动挂起恢复
    log_auto_scroll_stuck_refresh: "\u26A0\uFE0F \u81EA\u52A8\u6EDA\u52A8\u8FDE\u7EED\u672A\u53D1\u73B0\u65B0\u5546\u54C1\uFF0C\u4E14\u6B63\u5728\u6267\u884C\u4EFB\u52A1\u4E2D\uFF0C\u89E6\u53D1\u81EA\u52A8\u9875\u9762\u5237\u65B0\u4EE5\u5C1D\u8BD5\u6062\u590D...",
    log_auto_scroll_stuck_96_refresh: "\u26A0\uFE0F \u76D1\u6D4B\u5230\u7279\u6B8A\u60C5\u666F\uFF08\u5DF2\u9690\u85CF {0} \u4E2A\u5546\u54C1\u4E14\u65E0\u53EF\u89C1\u5546\u54C1\uFF0C\u7FFB\u9875\u6302\u8D77\uFF09\uFF0C\u4FDD\u5B58\u4E34\u65F6\u6E38\u6807\uFF0C\u6B63\u5728\u5237\u65B0\u9875\u9762\u4EE5\u5C1D\u8BD5\u6062\u590D...",
    log_auto_scroll_stuck_recovery_failed: "\u5DF2\u5C1D\u8BD5\u8FC7\u4F7F\u7528\u5F53\u524D\u6E38\u6807\u6062\u590D\u4F46\u4F9D\u7136\u65E0\u65B0\u5546\u54C1\uFF0C\u5224\u5B9A\u4E3A\u5DF2\u5230\u8FBE\u5217\u8868\u672B\u5C3E\uFF0C\u505C\u6B62\u5237\u65B0\u3002",
    // 账号验证
    auth_error: "\u8D26\u53F7\u5931\u6548\uFF1A\u672A\u627E\u5230 CSRF token\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
    auth_error_alert: "\u8D26\u53F7\u5931\u6548\uFF1A\u8BF7\u91CD\u65B0\u767B\u5F55\u540E\u518D\u4F7F\u7528\u811A\u672C",
    auth_session_invalid: "\u68C0\u6D4B\u5230\u767B\u5F55\u4F1A\u8BDD\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u540E\u518D\u542F\u52A8\u4EFB\u52A1\u3002",
    auth_worker_aborted: "\u5DE5\u4F5C\u6807\u7B7E\u9875\u68C0\u6D4B\u5230\u672A\u767B\u5F55\uFF0C\u5DF2\u4E2D\u6B62\u4EFB\u52A1\u5904\u7406\u3002",
    auth_scan_blocked: "\u672A\u767B\u5F55\u6216\u4F1A\u8BDD\u5DF2\u5931\u6548\uFF0C\u672C\u6B21\u626B\u63CF\u88AB\u8DF3\u8FC7\uFF08\u907F\u514D\u628A\u6240\u6709\u5546\u54C1\u8BEF\u5224\u4E3A\u514D\u8D39\u7A7A\u8DD1\uFF09\u3002"
  };

  // src/config.js
  var Config = {
    SCRIPT_NAME: "Fab Helper (\u4F18\u5316\u7248)",
    DB_VERSION: 3,
    DB_NAME: "fab_helper_db",
    MAX_CONCURRENT_WORKERS: 7,
    // 最大并发工作标签页数量
    WORKER_TIMEOUT: 9e4,
    // 工作标签页超时时间(watchdog 判定卡死)。领取一般 <1min，留足余量避免误杀慢任务
    KEEPALIVE_TICK_MS: 2e3,
    // 后台保活心跳间隔(Web Worker postMessage 频率)
    ENABLE_FREEZE_GUARD: true,
    // 是否启用 WebRTC 防整页冻结(锁屏/最小化场景需要)
    // 主力领取走主标签 ApiClaim；仅 Bundle 或 5xx 兜底才开后台详情标签页，
    // 并通过 API_CLAIM_MIN_INTERVAL_MS 错开派发节拍，避免同时打满请求触发 429。
    USE_API_CLAIM: true,
    API_CLAIM_MAX_CONCURRENT_WORKERS: 7,
    API_CLAIM_MIN_INTERVAL_MS: 1200,
    DEFAULT_API_SCAN_CONCURRENCY: 4,
    MAX_API_SCAN_CONCURRENCY: 6,
    // 内存回收（分块刷新续跑，仅在应急滚页备用模式下启用）：
    // Fab 的搜索结果不是虚拟列表，滚动过的卡片会一直留在 DOM 里。
    // 页面生命周期内累积到阈值后，等队列/worker 空闲时刷新页面，靠已保存的 cursor 从原位置继续。
    MEMORY_RECYCLE_ENABLED: true,
    MEMORY_RECYCLE_CARD_THRESHOLD: 3e3,
    // 页面内卡片总数达到该值触发刷新；0 = 关闭
    MEMORY_RECYCLE_MIN_INTERVAL_MS: 45e3,
    // 两次回收的最小间隔（跨刷新，防抖动/防循环）
    MEMORY_RECYCLE_MAX_PER_SESSION: 30,
    // 单标签页会话最多回收次数，兜底防循环刷新
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
      AUTO_SCROLL: "fab_autoScroll_v1",
      // 自动滚动页面（应急备用扫描）开关键
      REMEMBER_POS: "fab_rememberPos_v8",
      LAST_CURSOR: "fab_lastCursor_v8",
      // Store only the cursor string
      // 每个 worker 使用独立的回传键（前缀 + workerId），避免多标签页并发完成时
      // 后者覆盖前者导致报告丢失 / 重复加库的竞态（旧版单键 WORKER_DONE 的 P0 根因）。
      WORKER_DONE_PREFIX: "fab_worker_done_v8_",
      // 历史遗留键，保留以兼容残存的旧值读取。
      WORKER_DONE: "fab_worker_done_v8",
      APP_STATUS: "fab_app_status_v1",
      // For tracking 429 rate limiting
      STATUS_HISTORY: "fab_status_history_v1",
      // 状态历史记录持久化
      AUTO_RESUME: "fab_auto_resume_v1",
      // 自动恢复功能设置
      IS_EXECUTING: "fab_is_executing_v1",
      // 执行状态保存
      AUTO_REFRESH_EMPTY: "fab_auto_refresh_empty_v1",
      // 无商品可见时自动刷新
      HIDE_DISCOUNTED: "fab_hideDiscounted_v8",
      // 隐藏打折的付费商品
      HIDE_PAID: "fab_hidePaid_v8",
      // 隐藏所有付费商品
      BLOCK_RESOURCES: "fab_block_resources_v1",
      // 禁用大资源设置键
      MAX_WORKERS: "fab_max_workers_v1",
      // 并发工作标签页数量设置键
      FAST_API_SCAN: "fab_fast_api_scan_v1",
      // 极速 API 分片扫描开关
      API_SCAN_CONCURRENCY: "fab_api_scan_concurrency_v1",
      // API 扫描并发路数 (1-6)
      AUTO_CLAIM_VISIBLE: "fab_auto_claim_visible_v1",
      // 浏览页面时自动领取眼前免费商品
      DOM_FALLBACK_MODE: "fab_dom_fallback_mode_v1",
      // 应急网页滚页备用模式开关
      FAST_SCAN_CHECKPOINT: "fab_fast_scan_checkpoint_v1",
      // 极速扫描断点进度
      UI_EXPANDED: "fab_ui_expanded_v1"
      // 主面板展开/收起状态
      // 其他键值用于会话或主标签页持久化
    },
    SELECTORS: {
      card: "div.fabkit-Stack-root.nTa5u2sc, div.AssetCard-root",
      cardLink: 'a[href*="/listings/"], a[href*="/bundles/"]',
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
      h2Text: ["\u5DF2\u4FDD\u5B58\u5728\u6211\u7684\u5E93\u4E2D", "Saved in My Library", "Saved in Library", "\u5DF2\u4FDD\u5B58\u5728\u5E93\u4E2D"],
      // Check for buttons/links with these texts.
      buttonTexts: ["\u5728\u6211\u7684\u5E93\u4E2D\u67E5\u770B", "View in My Library", "View in Library", "\u5728\u5E93\u4E2D\u67E5\u770B", "View in Account", "\u5728\u8D26\u6237\u4E2D\u67E5\u770B", "View in library"],
      // Check for the temporary success popup (snackbar).
      snackbarText: ["\u4EA7\u54C1\u5DF2\u6DFB\u52A0\u81F3\u60A8\u7684\u5E93\u4E2D", "Product added to your library", "Added to library", "\u5DF2\u6DFB\u52A0\u81F3\u60A8\u7684\u5E93\u4E2D", "\u5DF2\u52A0\u5165\u60A8\u7684\u5E93\u4E2D"]
    },
    ACQUISITION_TEXT_SET: /* @__PURE__ */ new Set([
      "\u6DFB\u52A0\u5230\u6211\u7684\u5E93",
      "Add to my library",
      "\u6DFB\u52A0\u5230\u5E93",
      "Add to Library",
      "Add to library",
      "\u52A0\u5165\u8D2D\u7269\u8F66",
      "Add to cart",
      "Add to Cart",
      "\u7ED3\u8D26",
      "Checkout",
      "\u7ACB\u5373\u83B7\u53D6",
      "Get it",
      "Get It",
      "\u514D\u8D39\u83B7\u53D6",
      "Get for free",
      "Get for Free",
      "Get Free",
      "Get free",
      "\u514D\u8D39\u9886\u53D6",
      "\u9886\u53D6",
      "\u83B7\u53D6",
      "\u5B8C\u6210\u8BA2\u5355",
      "Complete order",
      "Complete Order",
      "\u7ACB\u5373\u8D2D\u4E70",
      "Buy now",
      "Buy Now",
      "\u83B7\u53D6\u8D44\u6E90",
      "Get asset",
      "Get Asset",
      "Place order",
      "Place Order",
      "\u786E\u8BA4\u8BA2\u5355",
      "\u4E0B\u5355",
      "\u514D\u8D39\u4E0B\u5355",
      "Claim",
      "Claim for free",
      "Claim Item",
      "Claim item",
      "Claim free",
      "Add to Account",
      "Add to account",
      "\u6DFB\u52A0\u5230\u8D26\u6237"
    ]),
    // Kept for backward compatibility with recon logic.
    SAVED_TEXT_SET: /* @__PURE__ */ new Set([
      "\u5DF2\u4FDD\u5B58\u5728\u6211\u7684\u5E93\u4E2D",
      "Saved in My Library",
      "Saved in my library",
      "\u5DF2\u4FDD\u5B58\u5728\u5E93\u4E2D",
      "Saved in Library",
      "Saved in library",
      "\u5728\u6211\u7684\u5E93\u4E2D",
      "In My Library",
      "In my library",
      "\u5728\u5E93\u4E2D",
      "In Library",
      "In library",
      "\u5DF2\u5728\u5E93\u4E2D",
      "In Account",
      "In account",
      "\u5DF2\u5728\u8D26\u6237\u4E2D",
      "\u5DF2\u62E5\u6709",
      "\u5DF2\u4FDD\u5B58"
    ]),
    FREE_TEXT_SET: /* @__PURE__ */ new Set(["\u514D\u8D39", "Free", "Free*", "0.00", "\u8D77\u59CB\u4EF7\u683C \u514D\u8D39", "Starting at Free", "\u4F4E\u81F3 \u514D\u8D39"]),
    EXTERNAL_CTA_TEXT_SET: /* @__PURE__ */ new Set([
      "\u5728\u5916\u90E8\u7F51\u7AD9\u67E5\u770B",
      "View on external website"
    ]),
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
    // 是否在手动滚动时自动添加可见任务（不自动滚页）
    autoScroll: false,
    // 新增：脚本是否自动滚动页面以扫描全部商品（默认关，独立于 autoAddOnScroll）
    isAutoScrolling: false,
    // 是否正在自动滚动中
    autoScrollAttempts: 0,
    // 连续自动滚动未发现新任务的次数
    rememberScrollPosition: false,
    // 是否记住滚动位置
    autoResumeAfter429: false,
    // 是否在429后自动恢复
    autoRefreshEmptyPage: true,
    // 新增：无商品可见时自动刷新（默认开启）
    hideDiscountedPaid: false,
    // 是否隐藏打折的付费商品
    hidePaid: false,
    // 是否隐藏所有付费商品
    blockLargeResources: true,
    // 新增：是否在工作标签页中禁用图片/媒体等大资源以节省流量和并发
    maxWorkers: 7,
    // 并发工作标签页数量（默认7）
    // 极速 API 分片扫描 & 浏览自动领：默认 false 以保持未调用 Database.load() 的旧版 DOM 测试兼容；
    // 真实环境由 Database.load() 读取并默认开启。
    fastApiScan: false,
    apiScanConcurrency: 4,
    // API 极速扫描并发路数（1-6）
    autoClaimVisible: false,
    // 浏览页面时自动领取可见免费商品（真实环境由 Database.load 默认开启）
    domFallbackMode: false,
    // 应急网页滚页备用模式（默认关闭，仅在设定→高级中启用）
    fastScanStatus: null,
    // 极速扫描实时遥测状态
    fastScanCheckpointMeta: null,
    // 断点进度元数据 { itemsScanned, totalEstimated, pct }
    nativeFetch: null,
    // 页面未拦截前的原生 window.fetch 引用
    debugMode: false,
    // 是否启用调试模式
    lang: "zh",
    // 当前语言，默认中文，会在detectLanguage中更新
    isExecuting: false,
    // 是否正在执行任务
    manualVerificationPending: false,
    // 人工验证期间阻止自动扫描重新启动；只由执行按钮解除
    // 旧 worker 枚举 + ApiClaim 模式下的主标签派发节拍，避免多个 worker 同时 POST。
    apiClaimNextDispatchAt: 0,
    apiClaimDispatchTimer: null,
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
    isScanningTasks: false,
    // 新增：标记是否正在扫描任务，防止重复扫描
    processedCardUids: /* @__PURE__ */ new Set(),
    // 新增：已处理过的卡片UID，防止重复添加
    // --- 内存回收（分块刷新续跑）---
    // 页面内卡片累积到阈值后刷新页面释放 DOM，再靠游标续跑。这些标记只用于
    // 防重复触发/防循环，刷新后由模块初始化重新置位。
    memoryRecycleInFlight: false,
    memoryRecycleDisabled: false,
    totalScannedOwned: 0,
    // 累计扫描到的「已入库」卡片数。自动滚动用此做快照差值，
    // 解决「某页全部已入库时 DOM/scrollHeight/processedCardUids 三信号全盲」问题。
    savedCursor: null,
    // Holds the loaded cursor for hijacking (domFallbackMode only)
    isEndOfSearchList: false,
    // 标记搜索接口是否已经没有下一页游标（到达全站真实末尾）
    hasReachedBottomToastShown: false,
    // 标记是否已展示到底Toast，防止重复弹出
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
    // --- 登录态 ---
    isAuthenticated: false,
    // 当前是否检测到有效的登录态（fab_csrftoken cookie）
    // --- 恢复模式 ---
    isRecoveryMode: false,
    // 是否处于刷新恢复模式
    // --- End New State ---
    showAdvanced: false,
    activeWorkers: 0,
    runningWorkers: {},
    // NEW: To track active workers for the watchdog { workerId: { task, startTime } }
    lastKnownHref: null,
    // To detect SPA navigation
    hiddenThisPageCount: 0,
    cardCountCache: {
      total: 0,
      hidden: 0,
      visible: 0,
      dirty: true,
      documentRef: null,
      href: ""
    },
    lastHideModeKey: "",
    executionTotalTasks: 0,
    // For execution progress
    executionCompletedTasks: 0,
    // For execution progress
    executionFailedTasks: 0,
    // For execution progress
    watchdogTimer: null,
    // UI-related state
    uiExpanded: true,
    hasFastScanCheckpoint: false,
    settingsAdvancedOpen: false,
    logs: [],
    valueChangeListeners: [],
    // runDomDependentPart 中创建的定时器句柄，供 beforeunload 时统一清理，避免泄漏
    domIntervals: [],
    // 已为哪些 workerId 注册过回传监听，避免重复注册同一键
    registeredWorkerDoneKeys: /* @__PURE__ */ new Set(),
    // For remembering scroll position
    knownCursors: /* @__PURE__ */ new Set(),
    lastSortMethod: null,
    // Session-level tracking (not persisted)
    sessionCompleted: /* @__PURE__ */ new Set(),
    sessionFailed: /* @__PURE__ */ new Set(),
    // 工作线程标签页任务ID
    workerTaskId: null,
    // 是否显示状态历史表格
    showStatusHistory: false,
    // Launcher flag
    hasRunDomPart: false,
    // Observer debounce timer
    observerDebounceTimer: null,
    // Pending retry for hide/show while card status labels are still loading
    hideRetryTimer: null,
    // Pending retry for auto-add while card status labels are still loading
    autoAddRetryTimer: null,
    // UI element references - populated by UI.create()
    UI: {
      container: null,
      collapseBtn: null,
      headerLiveBadge: null,
      tabsContainer: null,
      tabs: {},
      tabContents: {},
      quickAutoClaimBtn: null,
      quickHideSavedBtn: null,
      quickHidePaidBtn: null,
      statusVisible: null,
      statusTodo: null,
      statusDone: null,
      statusFailed: null,
      statusHidden: null,
      execBtn: null,
      resetCheckpointBtn: null,
      retryFailedBtn: null,
      maxWorkersInput: null,
      apiScanConcurrencyInput: null,
      domFallbackCheckbox: null,
      domFallbackControls: null,
      rememberPositionCheckbox: null,
      debugModeCheckbox: null,
      settingsAdvancedToggle: null,
      settingsAdvancedBody: null,
      progressTrack: null,
      progressBar: null,
      statusKeepAlive: null,
      logPanel: null,
      savedPositionDisplay: null,
      fastScanStatusDisplay: null,
      debugContent: null,
      historyContainer: null
    }
  };

  // src/modules/utils.js
  var UI = null;
  var setUIReference = /* @__PURE__ */ __name((uiModule) => {
    UI = uiModule;
  }, "setUIReference");
  var Utils = {
    logger: /* @__PURE__ */ __name((type, ...args) => {
      if (State.isWorkerTab) {
        if (type === "error" || args.some((arg) => typeof arg === "string" && arg.includes("Worker"))) {
          console[type](`${Config.SCRIPT_NAME} [Worker]`, ...args);
        }
        return;
      }
      if (type === "debug") {
        if (!State.debugMode) {
          return;
        }
        console.log(`${Config.SCRIPT_NAME} [DEBUG]`, ...args);
      } else {
        console[type](`${Config.SCRIPT_NAME}`, ...args);
      }
      if (State.UI && State.UI.logPanel) {
        const messageText = args.join(" ");
        const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        const firstChild = State.UI.logPanel.firstChild;
        if (firstChild && firstChild.dataset.rawText === messageText) {
          const count = parseInt(firstChild.dataset.count || "1") + 1;
          firstChild.dataset.count = count.toString();
          const timeSpan = firstChild.querySelector(".log-timestamp");
          if (timeSpan) timeSpan.textContent = `[${timestamp}]`;
          const contentSpan = firstChild.querySelector(".log-content");
          if (contentSpan) {
            contentSpan.textContent = "";
            if (type === "debug") {
              const dbg = document.createElement("span");
              dbg.style.color = "#34c759";
              dbg.textContent = "[DEBUG] ";
              contentSpan.appendChild(dbg);
            }
            contentSpan.appendChild(document.createTextNode(messageText));
            const cnt = document.createElement("span");
            cnt.style.color = "#007aff";
            cnt.style.fontWeight = "bold";
            cnt.style.marginLeft = "4px";
            cnt.textContent = `(x${count})`;
            contentSpan.appendChild(cnt);
          }
        } else {
          const logEntry = document.createElement("div");
          logEntry.style.cssText = "padding: 2px 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;";
          logEntry.dataset.rawText = messageText;
          logEntry.dataset.count = "1";
          if (type === "error") {
            logEntry.style.color = "#ff3b30";
            logEntry.style.fontWeight = "500";
          } else if (type === "warn") {
            logEntry.style.color = "#ff9500";
            logEntry.style.fontWeight = "500";
          } else if (type === "debug") {
            logEntry.style.color = "#8e8e93";
          } else {
            logEntry.style.color = "#f5f5f7";
          }
          const timeSpan = document.createElement("span");
          timeSpan.className = "log-timestamp";
          timeSpan.style.color = "rgba(255, 255, 255, 0.4)";
          timeSpan.textContent = `[${timestamp}]`;
          logEntry.appendChild(timeSpan);
          logEntry.appendChild(document.createTextNode(" "));
          const contentSpan = document.createElement("span");
          contentSpan.className = "log-content";
          if (type === "debug") {
            const dbg = document.createElement("span");
            dbg.style.color = "#34c759";
            dbg.textContent = "[DEBUG] ";
            contentSpan.appendChild(dbg);
          }
          contentSpan.appendChild(document.createTextNode(messageText));
          logEntry.appendChild(contentSpan);
          State.UI.logPanel.prepend(logEntry);
        }
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
      Utils.logger("debug", `\u8BED\u8A00\u68C0\u6D4B: \u5730\u5740=${window.location.href}, \u68C0\u6D4B\u5230\u8BED\u8A00=${State.lang}${oldLang !== State.lang ? ` (\u4ECE${oldLang}\u5207\u6362)` : ""}`);
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
      try {
        element.focus();
      } catch (e) {
      }
      const ownWindow = element.ownerDocument && element.ownerDocument.defaultView || null;
      const pageWindow = ownWindow || (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
      const PointerEvt = pageWindow.PointerEvent || PointerEvent;
      const MouseEvt = pageWindow.MouseEvent || MouseEvent;
      const eventOptions = { view: pageWindow, bubbles: true, cancelable: true, composed: true, buttons: 1, button: 0 };
      try {
        element.dispatchEvent(new PointerEvt("pointerdown", eventOptions));
        element.dispatchEvent(new MouseEvt("mousedown", eventOptions));
        element.dispatchEvent(new PointerEvt("pointerup", eventOptions));
        element.dispatchEvent(new MouseEvt("mouseup", eventOptions));
        if (typeof element.click === "function") {
          element.click();
        }
      } catch (e) {
      }
      setTimeout(() => {
        try {
          if (typeof element.click === "function") {
            element.click();
          }
        } catch (e) {
        }
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
    // ... (existing helper methods) ...
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
          let itemName = decodeURIComponent(match[1].replace(/\+/g, " "));
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(itemName)) {
            try {
              const date = new Date(itemName);
              const dateStr = date.toLocaleDateString();
              const timeStr = date.toLocaleTimeString([], { hour12: false });
              itemName = `${dateStr} ${timeStr}`;
            } catch (e) {
            }
          }
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
    // 账号验证函数 - silent模式用于初始化时的检查，不弹出警告
    //
    // 判定顺序是刻意的：先看页面信号，拿不到才退回 cookie。
    // 实测（真实未登录会话）：fab_csrftoken 依然存在、/i/csrf 也照常返回 200，
    // 只有页面内嵌数据（_epicAccountId === ''、/i/users/me.isAnonymous === true）
    // 和 /i/users/me 的 401 能正确反映未登录。也就是说 cookie 单独不构成
    // 「已登录」的证据 —— 只看 cookie 会把未登录判成已登录，于是 task-runner
    // 那几道执行闸门全部放行，脚本逐条领取失败，事件日志里整份列表被一次性定型。
    checkAuthentication: /* @__PURE__ */ __name((silent = false, ctx = {}) => {
      const fromPage = Utils.detectLoginFromPage(ctx);
      const signedIn = fromPage !== null ? fromPage : Boolean(Utils.getCookie("fab_csrftoken"));
      if (!signedIn) {
        if (!silent) {
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
        }
        State.isAuthenticated = false;
        return false;
      }
      State.isAuthenticated = true;
      return true;
    }, "checkAuthentication"),
    // 从当前页面的 SSR 数据里同步读取登录态。fab.com 在每个页面都内嵌了：
    //   1. window._epicAccountId        — 已登录是真实 UUID，未登录是空字符串
    //   2. <script id="js-json-data-prefetched-data"> 里 "/i/users/me".isAnonymous
    //   3. 同一块 JSON 里的 result UUID — 全零（00000000-...）也代表匿名
    // 三者任一明确指向匿名 → 返回 false；任一明确指向已登录 → 返回 true；
    // 都拿不到 → 返回 null，留给调用方决定要不要走 API 兜底。
    detectLoginFromPage: /* @__PURE__ */ __name((ctx = {}) => {
      const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
      const win = ctx.window || (typeof window !== "undefined" ? window : null);
      const doc = ctx.document || (typeof document !== "undefined" ? document : null);
      try {
        if (win && Object.prototype.hasOwnProperty.call(win, "_epicAccountId")) {
          const id = win._epicAccountId;
          if (typeof id === "string") {
            if (id === "" || id === ZERO_UUID) return false;
            if (/^[0-9a-f-]{32,36}$/i.test(id)) return true;
          }
        }
      } catch (e) {
      }
      try {
        const tag = doc && doc.getElementById && doc.getElementById("js-json-data-prefetched-data");
        if (tag && tag.textContent) {
          const data = JSON.parse(tag.textContent);
          const userInfo = data && data["/i/users/me"];
          if (userInfo) {
            if (userInfo.isAnonymous === true) return false;
            if (userInfo.isAnonymous === false) return true;
            if (typeof userInfo.result === "string") {
              if (userInfo.result === ZERO_UUID) return false;
              if (/^[0-9a-f-]{32,36}$/i.test(userInfo.result)) return true;
            }
          }
        }
      } catch (e) {
      }
      return null;
    }, "detectLoginFromPage"),
    // 校验登录态。优先用页面 SSR 数据（同步、零网络、零 Cloudflare 风险），
    // 拿不到再退回 /i/users/me API 探测。结果缓存到 State.isAuthenticated。
    verifyServerSession: /* @__PURE__ */ __name(() => {
      const csrfToken = Utils.getCookie("fab_csrftoken");
      if (!csrfToken) {
        State.isAuthenticated = false;
        return Promise.resolve(false);
      }
      const fromPage = Utils.detectLoginFromPage();
      if (fromPage === true) {
        State.isAuthenticated = true;
        return Promise.resolve(true);
      }
      if (fromPage === false) {
        State.isAuthenticated = false;
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        try {
          GM_xmlhttpRequest({
            method: "GET",
            url: "https://www.fab.com/i/users/me",
            headers: { "x-csrftoken": csrfToken, "x-requested-with": "XMLHttpRequest" },
            anonymous: false,
            timeout: 5e3,
            onload: /* @__PURE__ */ __name((response) => {
              if (response.status === 401 || response.status === 403) {
                State.isAuthenticated = false;
                resolve(false);
                return;
              }
              if (response.status >= 200 && response.status < 300) {
                try {
                  const data = JSON.parse(response.responseText);
                  if (data && (data.id || data.uid || data.email || data.username || data.isAnonymous === false)) {
                    State.isAuthenticated = true;
                    resolve(true);
                    return;
                  }
                } catch (e) {
                }
                State.isAuthenticated = false;
                resolve(false);
                return;
              }
              resolve(State.isAuthenticated);
            }, "onload"),
            onerror: /* @__PURE__ */ __name(() => resolve(State.isAuthenticated), "onerror"),
            ontimeout: /* @__PURE__ */ __name(() => resolve(State.isAuthenticated), "ontimeout")
          });
        } catch (e) {
          resolve(State.isAuthenticated);
        }
      });
    }, "verifyServerSession"),
    // 强校验：cookie + 服务端 session 一起验。返回 boolean。
    // notify=true 时对用户提示并停止当前执行。
    ensureAuthenticated: /* @__PURE__ */ __name(async (notify = true) => {
      if (!Utils.checkAuthentication(true)) {
        if (notify) Utils.notifyAuthFailure();
        return false;
      }
      const sessionOk = await Utils.verifyServerSession();
      if (!sessionOk) {
        if (notify) Utils.notifyAuthFailure();
        return false;
      }
      return true;
    }, "ensureAuthenticated"),
    notifyAuthFailure: /* @__PURE__ */ __name(() => {
      Utils.logger("error", Utils.getText("auth_error"));
      if (State.isExecuting) {
        State.isExecuting = false;
        try {
          GM_setValue(Config.DB_KEYS.IS_EXECUTING, false);
        } catch (e) {
        }
      }
      if (State.UI && State.UI.execBtn) {
        State.UI.execBtn.textContent = Utils.getText("execute");
        State.UI.execBtn.disabled = true;
      }
      try {
        alert(Utils.getText("auth_error_alert"));
      } catch (e) {
      }
    }, "notifyAuthFailure"),
    // 将所有空白字符（包括换行、多个空格）统一替换为单个空格
    normalizeWhitespace: /* @__PURE__ */ __name((text) => {
      if (!text) return "";
      return text.replace(/\s+/g, " ").trim();
    }, "normalizeWhitespace"),
    // Broadened to find more clickable elements including inputs and divs/spans that look like buttons.
    // Also traverses into same-origin iframes.
    findAllButtonsWithShadow: /* @__PURE__ */ __name((root = document) => {
      const interactables = [];
      const visitedIframes = /* @__PURE__ */ new WeakSet();
      const traverse = /* @__PURE__ */ __name((node) => {
        if (!node) return;
        if (node.nodeType === 1) {
          if (node.shadowRoot) {
            traverse(node.shadowRoot);
          }
          if (node.tagName === "IFRAME" && !visitedIframes.has(node)) {
            visitedIframes.add(node);
            try {
              const iframeDoc = node.contentDocument || node.contentWindow?.document;
              if (iframeDoc) {
                Utils.logger("debug", `Traversing iframe: ${node.src || "(inline)"}`);
                traverse(iframeDoc.body || iframeDoc);
              }
            } catch (e) {
              Utils.logger("debug", `Cannot access cross-origin iframe: ${node.src}`);
            }
          }
          const tagName = node.tagName;
          const role = node.getAttribute && node.getAttribute("role");
          const type = node.getAttribute && node.getAttribute("type");
          const className = node.className && typeof node.className === "string" ? node.className.toLowerCase() : "";
          if (tagName === "BUTTON") {
            interactables.push(node);
          } else if (tagName === "A" && (role === "button" || className.includes("btn") || className.includes("button") || className.includes("fabkit"))) {
            interactables.push(node);
          } else if (tagName === "INPUT" && (type === "submit" || type === "button" || type === "reset")) {
            interactables.push(node);
          } else if (role === "button" || className.includes("button") || className.includes("btn") || className.includes("payment-order-confirm") || className.includes("place-order")) {
            interactables.push(node);
          }
        }
        let child = node.firstChild;
        while (child) {
          traverse(child);
          child = child.nextSibling;
        }
      }, "traverse");
      traverse(root);
      if (root === document) {
        try {
          const allIframes = document.querySelectorAll("iframe");
          allIframes.forEach((iframe) => {
            if (!visitedIframes.has(iframe)) {
              visitedIframes.add(iframe);
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                  Utils.logger("debug", `Top-level iframe search: ${iframe.src || "(inline)"}`);
                  traverse(iframeDoc.body || iframeDoc);
                }
              } catch (e) {
              }
            }
          });
        } catch (e) {
        }
      }
      return interactables;
    }, "findAllButtonsWithShadow")
  };

  // src/modules/data-cache.js
  var DataCache = {
    // 商品数据缓存 - 键为商品ID，值为商品数据
    listings: /* @__PURE__ */ new Map(),
    // 拥有状态缓存 - 键为商品ID，值为拥有状态对象
    ownedStatus: /* @__PURE__ */ new Map(),
    // 价格缓存 - 键为报价ID，值为价格信息对象
    prices: /* @__PURE__ */ new Map(),
    // Maps Fab offer ids back to listing uids so done listings can skip price requests.
    offerListingUids: /* @__PURE__ */ new Map(),
    // 等待网页原生请求更新的UID列表
    waitingList: /* @__PURE__ */ new Set(),
    // 缓存时间戳 - 用于判断缓存是否过期
    timestamps: {
      listings: /* @__PURE__ */ new Map(),
      ownedStatus: /* @__PURE__ */ new Map(),
      prices: /* @__PURE__ */ new Map(),
      offerListingUids: /* @__PURE__ */ new Map(),
      waitingList: /* @__PURE__ */ new Map()
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
          this.extractOfferIds(item).forEach((offerId) => {
            this.offerListingUids.set(offerId, item.uid);
            this.timestamps.offerListingUids.set(offerId, now);
          });
        }
      });
    }, "saveListings"),
    extractOfferIds: /* @__PURE__ */ __name(function(item) {
      const offerIds = /* @__PURE__ */ new Set();
      const add = /* @__PURE__ */ __name((value) => {
        if (typeof value === "string" && value) offerIds.add(value);
      }, "add");
      add(item.offerId);
      add(item.offer_id);
      add(item.defaultOfferId);
      add(item.default_offer_id);
      add(item.offer?.offerId);
      add(item.offer?.offer_id);
      add(item.defaultOffer?.offerId);
      add(item.defaultOffer?.offer_id);
      add(item.startingPrice?.offerId);
      add(item.startingPrice?.offer_id);
      add(item.starting_price?.offerId);
      add(item.starting_price?.offer_id);
      add(item.price?.offerId);
      add(item.price?.offer_id);
      add(item.priceInfo?.offerId);
      add(item.priceInfo?.offer_id);
      if (Array.isArray(item.offers)) {
        item.offers.forEach((offer) => {
          add(offer?.offerId);
          add(offer?.offer_id);
        });
      }
      if (Array.isArray(item.licenses)) {
        item.licenses.forEach((license) => {
          add(license?.offerId);
          add(license?.offer_id);
          add(license?.offer?.offerId);
          add(license?.offer?.offer_id);
        });
      }
      return Array.from(offerIds);
    }, "extractOfferIds"),
    getListingUidForOffer: /* @__PURE__ */ __name(function(offerId) {
      return this.offerListingUids.get(offerId) || "";
    }, "getListingUidForOffer"),
    // 添加到等待列表
    addToWaitingList: /* @__PURE__ */ __name(function(uids) {
      if (!uids || !Array.isArray(uids)) return;
      uids.forEach((uid) => {
        this.waitingList.add(uid);
        this.timestamps.waitingList.set(uid, Date.now());
      });
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
        for (const [offerId, ts] of this.timestamps.offerListingUids.entries()) {
          if (now - ts > this.TTL) {
            this.offerListingUids.delete(offerId);
            this.timestamps.offerListingUids.delete(offerId);
          }
        }
        for (const [uid, ts] of this.timestamps.waitingList.entries()) {
          if (now - ts > this.TTL) {
            this.waitingList.delete(uid);
            this.timestamps.waitingList.delete(uid);
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

  // src/modules/api.js
  var parseResponseHeader = /* @__PURE__ */ __name((headersText, name) => {
    if (!headersText) return null;
    const key = String(name).toLowerCase();
    for (const line of String(headersText).split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      if (line.slice(0, idx).trim().toLowerCase() === key) {
        return line.slice(idx + 1).trim();
      }
    }
    return null;
  }, "parseResponseHeader");
  var gmPostImpl = /* @__PURE__ */ __name(({ method, url, headers, data } = {}) => new Promise((resolve, reject) => {
    const nativeFetch = State.nativeFetch || (typeof window !== "undefined" && typeof window.fetch === "function" ? window.fetch.bind(window) : null);
    if (nativeFetch) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => controller && controller.abort(), 3e4);
      nativeFetch(url, {
        method: method || "POST",
        credentials: "include",
        headers: headers || {},
        body: data,
        ...controller ? { signal: controller.signal } : {}
      }).then(async (response) => {
        clearTimeout(timer);
        resolve({
          status: response.status,
          responseText: await response.text(),
          getResponseHeader: /* @__PURE__ */ __name((name) => response.headers.get(name), "getResponseHeader")
        });
      }).catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
      return;
    }
    API.gmFetch({
      method: method || "POST",
      url,
      headers,
      data,
      onload: /* @__PURE__ */ __name((res) => resolve({
        status: res.status,
        responseText: res.responseText,
        getResponseHeader: /* @__PURE__ */ __name((h) => parseResponseHeader(res.responseHeaders, h), "getResponseHeader")
      }), "onload"),
      onerror: /* @__PURE__ */ __name((err) => reject(err), "onerror"),
      ontimeout: /* @__PURE__ */ __name(() => reject(new Error("claim request timeout")), "ontimeout")
    });
  }), "gmPostImpl");
  var API = {
    gmFetch: /* @__PURE__ */ __name((options) => {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          anonymous: false,
          // Default to false to ensure cookies are sent
          ...options,
          onload: /* @__PURE__ */ __name((response) => resolve(response), "onload"),
          onerror: /* @__PURE__ */ __name((error) => reject(new Error(`GM_xmlhttpRequest error: ${error.statusText || "Unknown Error"}`)), "onerror"),
          ontimeout: /* @__PURE__ */ __name(() => reject(new Error("Request timed out.")), "ontimeout"),
          onabort: /* @__PURE__ */ __name(() => reject(new Error("Request aborted.")), "onabort")
        });
      });
    }, "gmFetch"),
    // 接口响应数据提取函数
    extractStateData: /* @__PURE__ */ __name((rawData, source = "") => {
      const dataType = Array.isArray(rawData) ? "Array" : typeof rawData;
      if (State.debugMode) {
        Utils.logger("debug", `[${source}] \u63A5\u53E3\u8FD4\u56DE\u6570\u636E\u7C7B\u578B: ${dataType}`);
      }
      if (Array.isArray(rawData)) {
        return rawData;
      }
      if (rawData && typeof rawData === "object") {
        const keys = Object.keys(rawData);
        if (State.debugMode) {
          Utils.logger("debug", `[${source}] \u63A5\u53E3\u8FD4\u56DE\u5BF9\u8C61\u952E: ${keys.join(", ")}`);
        }
        const possibleArrayFields = ["data", "results", "items", "listings", "states"];
        for (const field of possibleArrayFields) {
          if (rawData[field] && Array.isArray(rawData[field])) {
            Utils.logger("info", `[${source}] \u5728\u5B57\u6BB5 "${field}" \u4E2D\u627E\u5230\u6570\u7EC4\u6570\u636E`);
            return rawData[field];
          }
        }
        for (const key of keys) {
          if (Array.isArray(rawData[key])) {
            Utils.logger("info", `[${source}] \u5728\u5B57\u6BB5 "${key}" \u4E2D\u627E\u5230\u6570\u7EC4\u6570\u636E`);
            return rawData[key];
          }
        }
        if (rawData.uid && "acquired" in rawData) {
          Utils.logger("info", `[${source}] \u8FD4\u56DE\u7684\u662F\u5355\u4E2A\u9879\u76EE\u6570\u636E\uFF0C\u8F6C\u6362\u4E3A\u6570\u7EC4`);
          return [rawData];
        }
      }
      Utils.logger("warn", `[${source}] \u65E0\u6CD5\u4ECEAPI\u54CD\u5E94\u4E2D\u63D0\u53D6\u6570\u7EC4\u6570\u636E`);
      if (State.debugMode) {
        try {
          const preview = JSON.stringify(rawData).substring(0, 200);
          Utils.logger("debug", `[${source}] API\u54CD\u5E94\u9884\u89C8: ${preview}...`);
        } catch (e) {
          Utils.logger("debug", `[${source}] \u65E0\u6CD5\u5E8F\u5217\u5316API\u54CD\u5E94: ${e.message}`);
        }
      }
      return [];
    }, "extractStateData"),
    // 优化后的商品拥有状态检查函数 - 只使用缓存和网页原生请求的数据
    checkItemsOwnership: /* @__PURE__ */ __name(async function(uids) {
      if (!uids || uids.length === 0) return [];
      try {
        const { result: cachedResults, missing: missingUids } = DataCache.getOwnedStatus(uids);
        if (missingUids.length > 0) {
          Utils.logger("debug", Utils.getText("fab_dom_unknown_status", missingUids.length));
          DataCache.addToWaitingList(missingUids);
        }
        return cachedResults;
      } catch (e) {
        Utils.logger("error", `\u68C0\u67E5\u62E5\u6709\u72B6\u6001\u5931\u8D25: ${e.message}`);
        return [];
      }
    }, "checkItemsOwnership"),
    // 优化后的价格验证函数
    checkItemsPrices: /* @__PURE__ */ __name(async function(offerIds) {
      if (!offerIds || offerIds.length === 0) return [];
      try {
        const { result: cachedResults, missing: missingOfferIds } = DataCache.getPrices(offerIds);
        if (missingOfferIds.length === 0) {
          if (State.debugMode) {
            Utils.logger("info", `\u4F7F\u7528\u7F13\u5B58\u7684\u4EF7\u683C\u6570\u636E\uFF0C\u907F\u514DAPI\u8BF7\u6C42`);
          }
          return cachedResults;
        }
        if (State.debugMode) {
          Utils.logger("info", `\u5BF9 ${missingOfferIds.length} \u4E2A\u7F3A\u5931\u7684\u62A5\u4EF7ID\u53D1\u9001API\u8BF7\u6C42`);
        }
        const csrfToken = Utils.getCookie("fab_csrftoken");
        if (!csrfToken) {
          Utils.checkAuthentication();
          throw new Error("CSRF token not found");
        }
        const pricesUrl = new URL("https://www.fab.com/i/listings/prices-infos");
        missingOfferIds.forEach((offerId) => pricesUrl.searchParams.append("offer_ids", offerId));
        const response = await this.gmFetch({
          method: "GET",
          url: pricesUrl.href,
          headers: { "x-csrftoken": csrfToken, "x-requested-with": "XMLHttpRequest" }
        });
        try {
          const pricesData = JSON.parse(response.responseText);
          if (pricesData.offers && Array.isArray(pricesData.offers)) {
            DataCache.savePrices(pricesData.offers);
            return [...cachedResults, ...pricesData.offers];
          }
        } catch (e) {
          Utils.logger("error", `[\u4F18\u5316] \u89E3\u6790\u4EF7\u683CAPI\u54CD\u5E94\u5931\u8D25: ${e.message}`);
        }
        return cachedResults;
      } catch (e) {
        Utils.logger("error", `[\u4F18\u5316] \u83B7\u53D6\u4EF7\u683C\u4FE1\u606F\u5931\u8D25: ${e.message}`);
        return [];
      }
    }, "checkItemsPrices")
  };

  // src/modules/bundle-claim.js
  var isCheckoutPage = /* @__PURE__ */ __name((pathname) => /^\/payment(?:\/|$)/i.test(pathname || ""), "isCheckoutPage");
  var isConfirmedBundleTask = /* @__PURE__ */ __name((task) => {
    if (task?.isBundle === false) return false;
    if (task?.listingType === "bundle" || task?.isBundle === true) return true;
    return /\/(?:bundles)\//i.test(task?.url || "");
  }, "isConfirmedBundleTask");
  var isBundleTask = /* @__PURE__ */ __name((task) => {
    if (isConfirmedBundleTask(task)) return true;
    return !task?.listingType && task?.isBundle !== false && typeof task?.name === "string" && /\bbundle\b/i.test(task.name);
  }, "isBundleTask");
  function freeBundleOffers(listing) {
    if (listing?.listingType !== "bundle") return [];
    const offers = (listing.licenses || []).filter((license) => {
      const tier = license?.priceTier;
      const price = tier?.discountedPrice ?? tier?.price;
      const offerId = license?.offerId || license?.offer_id;
      const isFree = typeof price === "number" && price === 0 || tier?.effectiveDiscountPercentage === 100 || license?.isCc0 === true;
      return isFree && typeof offerId === "string" && offerId;
    }).map((license) => license.offerId || license.offer_id);
    if (offers.length > 0) return offers;
    const sp = listing?.startingPrice;
    if (sp) {
      const spPrice = sp.discountedPrice ?? sp.price;
      const spOffer = sp.offerId || sp.offer_id;
      if (typeof spPrice === "number" && spPrice === 0 && typeof spOffer === "string" && spOffer) {
        return [spOffer];
      }
    }
    return [];
  }
  __name(freeBundleOffers, "freeBundleOffers");
  function bundleCheckoutUrl(src, offers) {
    try {
      const url = new URL(src, "https://www.fab.com");
      if (url.origin !== "https://www.fab.com" || url.pathname !== "/payment/web/purchase") return null;
      const match = url.searchParams.get("offers")?.match(/^1-[a-f0-9]{32}-([a-f0-9]{32})--$/i);
      if (!match || !offers.includes(match[1])) return null;
      return url.href;
    } catch {
      return null;
    }
  }
  __name(bundleCheckoutUrl, "bundleCheckoutUrl");
  function isZeroPriceCheckout(text = "") {
    const amounts = [...text.matchAll(/(?:[$€£¥￥]|USD|EUR|GBP|CNY)\s*(\d[\d.,]*)/g)];
    return amounts.length > 0 && amounts.every((match) => /^0+(?:[.,]0+)?$/.test(match[1]));
  }
  __name(isZeroPriceCheckout, "isZeroPriceCheckout");
  var buttonText = /* @__PURE__ */ __name((button) => (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase(), "buttonText");
  var libraryLabels = /* @__PURE__ */ new Set(["add to library", "add to my library", "\u6DFB\u52A0\u5230\u5E93", "\u6DFB\u52A0\u5230\u6211\u7684\u5E93", "\u52A0\u5165\u6211\u7684\u5E93"]);
  async function acquireBundle(task, options = {}) {
    const doc = options.doc ?? document;
    const win = options.win ?? window;
    const api = options.api || API;
    const utils = options.utils || Utils;
    const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const now = options.now || Date.now;
    const log = options.log || (() => {
    });
    const fail = /* @__PURE__ */ __name((reason, extra = {}) => {
      log(`[Bundle] ${reason}`);
      return { success: false, reason, ...extra };
    }, "fail");
    const get = /* @__PURE__ */ __name(async (url) => {
      const response = await api.gmFetch({ method: "GET", url, headers: {
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
        "x-csrftoken": utils.getCookie("fab_csrftoken") || ""
      } });
      if (response.status === 429) {
        const err = new Error("\u63A5\u53E3\u8FD4\u56DE 429");
        err.rateLimited = true;
        const retry = response.getResponseHeader?.("retry-after") || response.responseHeaders?.match(/retry-after:\s*(\d+)/i)?.[1];
        err.retryAfterMs = retry ? Number(retry) * 1e3 : null;
        throw err;
      }
      if (response.status !== 200) throw new Error(`\u63A5\u53E3\u8FD4\u56DE ${response.status || "\u672A\u77E5\u72B6\u6001"}`);
      return JSON.parse(response.responseText);
    }, "get");
    const owned = /* @__PURE__ */ __name(async () => {
      const payload = await get(`https://www.fab.com/i/users/me/listings-states?listing_ids=${encodeURIComponent(task.uid)}`);
      const states = Array.isArray(payload) ? payload : api.extractStateData(payload, "BundleVerify");
      return Array.isArray(states) && states.some((state) => state?.uid === task.uid && state.acquired === true);
    }, "owned");
    try {
      if (!isBundleTask(task) && task?.listingType !== "bundle" && !task?.isBundle) return fail("\u4E0D\u662F bundle \u4EFB\u52A1");
      const listing = await get(`https://www.fab.com/i/listings/${encodeURIComponent(task.uid)}`);
      const listingType = typeof listing?.listingType === "string" ? listing.listingType : "";
      if (listingType === "bundle") {
        task.listingType = "bundle";
        task.isBundle = true;
      } else if (listingType) {
        task.listingType = listingType;
        task.isBundle = false;
        log(`[Bundle] \u63A5\u53E3\u7C7B\u578B\u4E3A ${listingType}\uFF0C\u4E0D\u662F bundle\uFF0C\u8F6C\u666E\u901A\u9886\u53D6\u6D41\u7A0B`);
        return { success: false, notBundle: true };
      }
      const offers = freeBundleOffers(listing);
      if (!offers.length) return fail("\u672A\u627E\u5230\u514D\u8D39\u8BB8\u53EF\uFF0C\u505C\u6B62\u9886\u53D6");
      if (await owned()) return { success: true };
      if (isCheckoutPage(new URL(win.location.href).pathname)) return fail("\u8BF7\u4ECE bundle \u8BE6\u60C5\u9875\u542F\u52A8\u9886\u53D6");
      const openDeadline = now() + 3e4;
      let clicked = false;
      let checkoutDoc = null;
      while (now() < openDeadline) {
        const frame = doc.querySelector('iframe[src*="/payment/web/purchase"]');
        if (frame) {
          if (!bundleCheckoutUrl(frame.getAttribute("src"), offers)) return fail("\u7ED3\u7B97\u94FE\u63A5\u4E0D\u662F\u6B64 bundle \u7684\u514D\u8D39\u8BB8\u53EF");
          try {
            checkoutDoc = frame.contentDocument;
          } catch {
            return fail("\u9700\u8981\u4EBA\u5DE5\u64CD\u4F5C\u8DE8\u57DF\u7ED3\u7B97\u9875\uFF0C\u5DF2\u4FDD\u7559\u9875\u9762", { manualRequired: true });
          }
          if (checkoutDoc?.body && checkoutDoc.querySelector("button")) break;
        }
        if (!clicked) {
          const sidebar = doc.querySelector('aside, [role="complementary"]');
          const button = [...sidebar?.querySelectorAll("button") || doc.querySelectorAll("button") || []].find((item) => !item.disabled && ["buy now", "\u7ACB\u5373\u8D2D\u4E70"].includes(buttonText(item)));
          if (button) {
            utils.deepClick(button);
            clicked = true;
            log("[Bundle] \u5DF2\u6253\u5F00\u5B98\u7F51\u514D\u8D39\u7ED3\u7B97\u5165\u53E3");
          }
        }
        await sleep(250);
      }
      if (!checkoutDoc?.body) return fail("\u672A\u80FD\u52A0\u8F7D bundle \u7ED3\u7B97\u9875");
      const deadline = now() + 45e3;
      let submitted = false;
      let nextVerifyAt = 0;
      while (now() < deadline) {
        const visibleText = checkoutDoc.body?.innerText || "";
        const captcha = [...checkoutDoc.querySelectorAll('iframe[title*="challenge"], iframe[src*="frame=challenge"]')].some((frame) => {
          const rect = frame.getBoundingClientRect();
          const style = checkoutDoc.defaultView?.getComputedStyle(frame);
          return rect.width > 0 && rect.height > 0 && style?.visibility !== "hidden" && style?.display !== "none";
        });
        if (captcha || /verify you are human|请完成安全验证|确认您是真人/i.test(visibleText)) {
          return fail("\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\u4EBA\u673A\u9A8C\u8BC1\uFF0C\u5DF2\u4FDD\u7559\u7ED3\u7B97\u9875", { manualRequired: true });
        }
        if ([...checkoutDoc.querySelectorAll('input[type="checkbox"]')].some((input) => !input.checked && (input.required || /agree|terms|eula|同意|协议/i.test(input.closest?.("label")?.textContent || "")))) {
          return fail("\u9700\u8981\u4EBA\u5DE5\u786E\u8BA4\u7ED3\u7B97\u6761\u6B3E\uFF0C\u5DF2\u4FDD\u7559\u7ED3\u7B97\u9875", { manualRequired: true });
        }
        if (!submitted) {
          const button = [...checkoutDoc.querySelectorAll("button")].find((item) => !item.disabled && libraryLabels.has(buttonText(item)));
          if (button) {
            if (!isZeroPriceCheckout(visibleText)) return fail("\u7ED3\u7B97\u9875\u672A\u786E\u8BA4\u96F6\u5143\u91D1\u989D\uFF0C\u505C\u6B62\u9886\u53D6");
            utils.deepClick(button);
            submitted = true;
            nextVerifyAt = now() + 2e3;
            log("[Bundle] \u5DF2\u70B9\u51FB\u96F6\u5143\u6DFB\u52A0\u5230\u5E93\uFF0C\u7B49\u5F85\u670D\u52A1\u7AEF\u786E\u8BA4");
          }
        } else if (now() >= nextVerifyAt) {
          if (await owned()) {
            log("[Bundle] \u670D\u52A1\u7AEF\u786E\u8BA4\u5DF2\u5165\u5E93");
            return { success: true };
          }
          nextVerifyAt = now() + 2e3;
        }
        await sleep(250);
      }
      return fail(submitted ? "\u7ED3\u7B97\u540E\u670D\u52A1\u7AEF\u672A\u786E\u8BA4\u5165\u5E93" : "\u7ED3\u7B97\u9875\u672A\u51FA\u73B0\u96F6\u5143\u6DFB\u52A0\u5230\u5E93\u6309\u94AE");
    } catch (error) {
      return fail(error.message, error.rateLimited ? { rateLimited: true, retryAfterMs: error.retryAfterMs } : {});
    }
  }
  __name(acquireBundle, "acquireBundle");

  // src/modules/page-diagnostics.js
  var PageDiagnostics = {
    // 诊断商品详情页面状态
    diagnoseDetailPage: /* @__PURE__ */ __name(() => {
      const report = {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        url: window.location.href,
        pageTitle: document.title,
        buttons: [],
        licenseOptions: [],
        priceInfo: {},
        ownedStatus: {},
        dynamicContent: {}
      };
      const buttons = document.querySelectorAll("button");
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
            role: elem.getAttribute("role")
          });
        }
      });
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
      const ownedElements = document.querySelectorAll('h2, [class*="owned"], [class*="library"]');
      ownedElements.forEach((elem, index) => {
        const text = elem.textContent?.trim();
        if (text && (text.includes("\u5E93") || text.includes("Library") || text.includes("\u62E5\u6709") || text.includes("Owned"))) {
          report.ownedStatus[`owned_${index}`] = {
            text,
            isVisible: elem.offsetParent !== null,
            tagName: elem.tagName,
            classes: elem.className
          };
        }
      });
      return report;
    }, "diagnoseDetailPage"),
    // 输出诊断报告到日志
    logDiagnosticReport: /* @__PURE__ */ __name((report) => {
      console.group("=== Fab Helper \u9875\u9762\u72B6\u6001\u8BCA\u65AD\u62A5\u544A ===");
      console.log(`\u9875\u9762: ${report.url}`);
      console.log(`\u6807\u9898: ${report.pageTitle}`);
      const visibleButtons2 = report.buttons.filter((b) => b.isVisible);
      if (visibleButtons2.length > 0) {
        console.log(`--- \u53EF\u89C1\u6309\u94AE (${visibleButtons2.length}) ---`);
        visibleButtons2.forEach((btn) => {
          console.log(`  [${btn.index}] "${btn.text}" (\u7981\u7528: ${btn.isDisabled}, \u7C7B: ${btn.classes.split(" ").slice(0, 2).join(" ")}...)`);
        });
      }
      const visibleLicenses = report.licenseOptions.filter((l) => l.isVisible);
      if (visibleLicenses.length > 0) {
        console.log(`--- \u53EF\u89C1\u8BB8\u53EF\u9009\u9879 (${visibleLicenses.length}) ---`);
        visibleLicenses.forEach((opt) => {
          console.log(`  [${opt.index}] "${opt.text}" (\u6807\u7B7E: ${opt.tagName}, \u89D2\u8272: ${opt.role || "\u65E0"})`);
        });
      }
      const visiblePrices = Object.values(report.priceInfo).filter((p) => p.isVisible);
      if (visiblePrices.length > 0) {
        console.log(`--- \u4EF7\u683C\u4FE1\u606F (${visiblePrices.length}) ---`);
        visiblePrices.forEach((p) => console.log(`  \u4EF7\u683C: "${p.text}"`));
      }
      const visibleOwned = Object.values(report.ownedStatus).filter((s) => s.isVisible);
      if (visibleOwned.length > 0) {
        console.log(`--- \u62E5\u6709\u72B6\u6001 (${visibleOwned.length}) ---`);
        visibleOwned.forEach((s) => console.log(`  \u72B6\u6001: "${s.text}"`));
      }
      console.groupEnd();
    }, "logDiagnosticReport")
  };

  // src/modules/rate-limit-detection.js
  var isLimitMessage = /* @__PURE__ */ __name((value) => typeof value === "string" && /^(?:(?:error|http)\s*[:\s-]*)?(?:429\b|too\s+many\s+requests\b|requests?\s+(?:was|were|has been)\s+throttled\b|rate[ _-]*limit(?:ed|[ _-]*(?:exceeded|reached))?(?:[.!:\s]|$)|请求过于频繁|请求被限流|请求次数过多)/i.test(value.trim()), "isLimitMessage");
  function isRateLimitedResponse(status, body) {
    if (Number(status) === 429) return true;
    let value = body;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return value.length < 2e3 && isLimitMessage(value);
      }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (["results", "items", "listings", "offers"].some((key) => Array.isArray(value[key]))) return false;
    return ["detail", "message", "error", "code"].some((key) => isLimitMessage(value[key]));
  }
  __name(isRateLimitedResponse, "isRateLimitedResponse");
  function isRateLimitedPage(title = "", text = "") {
    if (/^(?:(?:error|http)\s*)?429(?:\s*[-:]?\s*too many requests)?(?:\s*[|–-]\s*(?:fab|nginx|cloudflare))?$/i.test(title.trim()) || /^too many requests(?:\s*[|–-]\s*(?:fab|nginx|cloudflare))?$/i.test(title.trim())) return true;
    return text.length < 2e3 && isRateLimitedResponse(0, text);
  }
  __name(isRateLimitedPage, "isRateLimitedPage");

  // src/modules/rate-limit-manager.js
  var UI2 = null;
  var TaskRunner = null;
  var countdownRefresh = null;
  var setDependencies = /* @__PURE__ */ __name((deps) => {
    UI2 = deps.UI;
    TaskRunner = deps.TaskRunner;
    countdownRefresh = deps.countdownRefresh;
  }, "setDependencies");
  var RateLimitManager = {
    // 添加防止重复日志的变量
    _lastLogTime: 0,
    _lastLogType: null,
    _duplicateLogCount: 0,
    // 活跃心跳跟踪
    _lastActiveTime: 0,
    // 本实例上次写入活跃时间戳的时刻
    _trackingInterval: null,
    // 心跳 setInterval 句柄
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
      try {
        await GM_setValue(Config.DB_KEYS.STATUS_HISTORY, State.statusHistory);
      } catch (e) {
        Utils.logger("error", `\u4FDD\u5B58\u72B6\u6001\u5386\u53F2\u5931\u8D25: ${e.message}`);
      }
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
      if (UI2) {
        UI2.updateDebugTab();
        UI2.update();
      }
      const { visible: actualVisibleCards } = TaskRunner?.getCardCounts ? TaskRunner.getCardCounts() : { visible: document.querySelectorAll(Config.SELECTORS.card).length };
      const visibleCountElement = document.getElementById("fab-status-visible");
      if (visibleCountElement) {
        visibleCountElement.textContent = actualVisibleCards.toString();
      }
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
        const randomDelay = 45e3 + Math.random() * 15e3;
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
        if (UI2) UI2.updateDebugTab();
      }
      if (State.appStatus !== "RATE_LIMITED") {
        return;
      }
      if (State.rateLimitStartTime) {
        const timeSinceRateLimit = Date.now() - State.rateLimitStartTime;
        if (timeSinceRateLimit < 4e4) {
          Utils.logger("debug", `\u5904\u4E8E\u9650\u901F\u5F3A\u5236\u51B7\u9759\u671F (${(timeSinceRateLimit / 1e3).toFixed(1)}s < 40s)\uFF0C\u5FFD\u7565\u6B64\u6B21\u6210\u529F\u8BF7\u6C42\u3002`);
          return;
        }
      }
      if (!hasResults) {
        Utils.logger("debug", `\u8BF7\u6C42\u6210\u529F\u4F46\u6CA1\u6709\u8FD4\u56DE\u6709\u6548\u7ED3\u679C\uFF0C\u4E0D\u8BA1\u5165\u8FDE\u7EED\u6210\u529F\u8BA1\u6570\u3002\u6765\u6E90: ${source}`);
        State.consecutiveSuccessCount = 0;
        return;
      }
      State.consecutiveSuccessCount++;
      const isMilestone = State.consecutiveSuccessCount % 3 === 0 || State.consecutiveSuccessCount >= State.requiredSuccessCount;
      const logMsg = Utils.getText("rate_limit_success_request", State.consecutiveSuccessCount, State.requiredSuccessCount, source);
      Utils.logger(isMilestone ? "info" : "debug", logMsg);
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
      if (UI2) {
        UI2.updateDebugTab();
        UI2.update();
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
        Utils.logger("debug", Utils.getText("log_rate_limit_check_start"));
        let pageText = "";
        const uiContainer = document.getElementById(Config.UI_CONTAINER_ID);
        if (uiContainer) {
          const originalDisplay = uiContainer.style.display;
          uiContainer.style.display = "none";
          pageText = document.body.innerText || "";
          uiContainer.style.display = originalDisplay;
        } else {
          pageText = document.body.innerText || "";
        }
        if (isRateLimitedPage(document.title || "", pageText)) {
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
        if (State.appStatus === "RATE_LIMITED") {
          const cooldownPassed = State.rateLimitStartTime ? Date.now() - State.rateLimitStartTime > 4e4 : true;
          if (cooldownPassed) {
            Utils.logger("info", "\u9650\u901F\u51B7\u9759\u671F\u5DF2\u8FC7\uFF0C\u4E3B\u52A8\u53D1\u9001\u8F7B\u91CF\u63A2\u6D4B\u8BF7\u6C42\u4EE5\u786E\u8BA4\u72B6\u6001...");
            try {
              const csrfToken = Utils.getCookie("fab_csrftoken");
              if (csrfToken) {
                const response = await API.gmFetch({
                  method: "GET",
                  url: "https://www.fab.com/i/users/context",
                  headers: { "x-csrftoken": csrfToken, "x-requested-with": "XMLHttpRequest" }
                });
                if (response.status === 200) {
                  Utils.logger("info", "\u63A2\u6D4B\u8BF7\u6C42\u6210\u529F\uFF0CAPI\u9650\u901F\u5DF2\u89E3\u9664");
                  await this.exitRateLimitedState("\u63A2\u6D4B\u8BF7\u6C42\u6210\u529F");
                  return true;
                } else if (response.status === 429) {
                  Utils.logger("warn", "\u63A2\u6D4B\u8BF7\u6C42\u8FD4\u56DE429\uFF0C\u786E\u8BA4\u4ECD\u5904\u4E8E\u9650\u901F\u72B6\u6001");
                  State.rateLimitStartTime = Date.now();
                  await GM_setValue(Config.DB_KEYS.APP_STATUS, {
                    status: "RATE_LIMITED",
                    startTime: State.rateLimitStartTime,
                    source: "\u63A2\u6D4B\u8BF7\u6C42429"
                  });
                  return false;
                }
              }
            } catch (probeError) {
              Utils.logger("error", `\u63A2\u6D4B\u8BF7\u6C42\u53D1\u9001\u5931\u8D25: ${probeError.message}`);
            }
          }
        }
        Utils.logger("debug", Utils.getText("log_insufficient_info_status"));
        return State.appStatus === "NORMAL";
      } catch (e) {
        Utils.logger("error", `\u9650\u901F\u72B6\u6001\u68C0\u67E5\u5931\u8D25: ${e.message}`);
        return false;
      } finally {
        State.isCheckingRateLimit = false;
      }
    }, "checkRateLimitStatus"),
    /**
     * 检测不活动区间（浏览器关闭 / 标签页冻结），并修正限速期时长。
     * @param {boolean} isStartup - 是否为脚本启动时的首次检查
     */
    checkInactivity: /* @__PURE__ */ __name(async function(isStartup = false) {
      const GM_KEY = "fab_last_active_time";
      const now = Date.now();
      const lastActive = await GM_getValue(GM_KEY, 0);
      if (lastActive > 0) {
        const gap = now - lastActive;
        if (gap > 15e3 && State.appStatus === "RATE_LIMITED" && State.rateLimitStartTime) {
          if (gap > 12e4) {
            const activeDuration = lastActive > State.rateLimitStartTime ? ((lastActive - State.rateLimitStartTime) / 1e3).toFixed(2) : "0.00";
            Utils.logger(
              "warn",
              `[\u4F11\u7720\u68C0\u6D4B] \u68C0\u6D4B\u5230 ${(gap / 1e3).toFixed(0)}s \u4E0D\u6D3B\u52A8\u533A\u95F4\uFF08\u6D4F\u89C8\u5668\u5173\u95ED\u6216\u6807\u7B7E\u51BB\u7ED3\uFF09\uFF0C429 \u9650\u901F\u5DF2\u81EA\u7136\u6062\u590D\uFF0C\u6709\u6548\u9650\u901F\u65F6\u957F\u7EA6 ${activeDuration}s\uFF0C\u81EA\u52A8\u89E3\u9664\u9650\u901F\u72B6\u6001\u3002`
            );
            const logEntry = {
              type: "RATE_LIMITED",
              duration: parseFloat(activeDuration),
              endTime: new Date(lastActive).toISOString(),
              source: "\u4F11\u7720/\u5173\u95ED\u540E\u81EA\u52A8\u6062\u590D"
            };
            await this.addToHistory(logEntry);
            State.appStatus = "NORMAL";
            State.rateLimitStartTime = null;
            State.normalStartTime = now;
            State.consecutiveSuccessCount = 0;
            await GM_deleteValue(Config.DB_KEYS.APP_STATUS);
            if (UI2) {
              UI2.updateDebugTab();
              UI2.update();
            }
          } else {
            const oldStart = State.rateLimitStartTime;
            State.rateLimitStartTime += gap;
            Utils.logger(
              "debug",
              `[\u4F11\u7720\u68C0\u6D4B] \u68C0\u6D4B\u5230 ${(gap / 1e3).toFixed(0)}s \u4E0D\u6D3B\u52A8\u533A\u95F4\uFF0C\u9650\u901F\u5F00\u59CB\u65F6\u95F4\u7531 ${new Date(oldStart).toLocaleTimeString()} \u987A\u79FB\u81F3 ${new Date(State.rateLimitStartTime).toLocaleTimeString()}\u3002`
            );
            const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
            if (persistedStatus) {
              persistedStatus.startTime = State.rateLimitStartTime;
              await GM_setValue(Config.DB_KEYS.APP_STATUS, persistedStatus);
            }
          }
        } else if (gap > 15e3 && State.appStatus === "NORMAL" && State.normalStartTime) {
          State.normalStartTime += gap;
          Utils.logger(
            "debug",
            `[\u4F11\u7720\u68C0\u6D4B] \u6B63\u5E38\u72B6\u6001\u4E0B\u68C0\u6D4B\u5230 ${(gap / 1e3).toFixed(0)}s \u4E0D\u6D3B\u52A8\u533A\u95F4\uFF0C\u6B63\u5E38\u8FD0\u884C\u8BA1\u65F6\u5DF2\u987A\u79FB\u3002`
          );
        }
      }
      this._lastActiveTime = now;
      await GM_setValue(GM_KEY, now);
    }, "checkInactivity"),
    /** 启动周期性活跃心跳（每 2 秒更新一次时间戳，用于检测不活动区间）。幂等。 */
    startActivityTracking: /* @__PURE__ */ __name(function() {
      if (this._trackingInterval) return;
      this._trackingInterval = setInterval(async () => {
        const now = Date.now();
        this._lastActiveTime = now;
        try {
          await GM_setValue("fab_last_active_time", now);
        } catch (e) {
        }
      }, 2e3);
      Utils.logger("debug", "[\u6D3B\u8DC3\u5FC3\u8DF3] \u5DF2\u542F\u52A8\uFF0C\u6BCF 2s \u66F4\u65B0\u6D3B\u8DC3\u65F6\u95F4\u6233\u3002");
    }, "startActivityTracking"),
    /** 脚本启动时调用：加载持久化限速状态、执行启动时不活动检测、启动活跃心跳。 */
    initStatus: /* @__PURE__ */ __name(async function() {
      const persistedStatus = await GM_getValue(Config.DB_KEYS.APP_STATUS);
      if (persistedStatus && persistedStatus.status === "RATE_LIMITED") {
        State.appStatus = "RATE_LIMITED";
        State.rateLimitStartTime = persistedStatus.startTime;
        const rawDuration = persistedStatus.startTime ? ((Date.now() - persistedStatus.startTime) / 1e3).toFixed(2) : "0.00";
        Utils.logger("warn", Utils.getText("startup_rate_limited", rawDuration, persistedStatus.source || Utils.getText("status_unknown_source")));
      }
      await this.checkInactivity(true);
      this.startActivityTracking();
    }, "initStatus")
  };

  // src/modules/page-patcher.js
  var RESET_GUARD_KEY = "fab_helper_reset_guard";
  var RESET_GUARD_TTL_MS = 60 * 1e3;
  var RESET_GUARD_TOP_TOLERANCE_PX = 200;
  var PagePatcher = {
    _patchHasBeenApplied: false,
    _lastSeenCursor: null,
    _lastCheckedUrl: null,
    _bodyObserver: null,
    _isCursorSaveLocked: false,
    _isResetGuardActive: false,
    _resetGuardStartedAt: 0,
    _resetGuardForcedScrollRestoration: false,
    // State for request debouncing
    _debounceXhrTimer: null,
    _pendingXhr: null,
    _lastDebounceXhrFire: 0,
    lockCursorSaving() {
      this._isCursorSaveLocked = true;
    },
    unlockCursorSaving() {
      if (this._isResetGuardActive) return;
      this._isCursorSaveLocked = false;
    },
    armResetGuard() {
      this._isResetGuardActive = true;
      this._resetGuardStartedAt = Date.now();
      this._isCursorSaveLocked = true;
      if (typeof sessionStorage !== "undefined") {
        try {
          sessionStorage.setItem(RESET_GUARD_KEY, String(this._resetGuardStartedAt));
        } catch (e) {
        }
      }
      if (this._setScrollRestoration("manual")) {
        this._resetGuardForcedScrollRestoration = true;
      }
      Utils.logger("info", "[Guard] \u5DF2\u6E05\u9664\u4F4D\u7F6E\uFF1A\u5217\u8868\u56DE\u5230\u7B2C\u4E00\u9875\u524D\u6682\u505C\u8BB0\u5F55\u6EDA\u52A8\u4F4D\u7F6E");
    },
    // 刷新后初始化阶段检测守卫标记（页面变量不会跨刷新，必须借 sessionStorage）
    initResetGuard() {
      if (typeof sessionStorage === "undefined") return;
      let stamp = null;
      try {
        stamp = sessionStorage.getItem(RESET_GUARD_KEY);
      } catch (e) {
        return;
      }
      if (!stamp) return;
      if (State.isRecoveryMode) {
        this._clearResetGuardFlag();
        return;
      }
      const startedAt = Number(stamp) || Date.now();
      if (Date.now() - startedAt > RESET_GUARD_TTL_MS) {
        this._clearResetGuardFlag();
        return;
      }
      this._isResetGuardActive = true;
      this._resetGuardStartedAt = startedAt;
      this._isCursorSaveLocked = true;
      if (this._setScrollRestoration("manual")) {
        this._resetGuardForcedScrollRestoration = true;
      }
      Utils.logger("info", "[Guard] \u68C0\u6D4B\u5230\u4F4D\u7F6E\u5DF2\u91CD\u7F6E\uFF0C\u6682\u505C\u8BB0\u5F55\u76F4\u5230\u5217\u8868\u56DE\u5230\u7B2C\u4E00\u9875");
    },
    releaseResetGuard(reason) {
      if (!this._isResetGuardActive) return;
      this._isResetGuardActive = false;
      this._resetGuardStartedAt = 0;
      this._isCursorSaveLocked = false;
      this._clearResetGuardFlag();
      if (this._resetGuardForcedScrollRestoration) {
        this._resetGuardForcedScrollRestoration = false;
        this._restoreScrollRestorationWhenSettled();
      }
      Utils.logger("debug", `[Guard] \u6062\u590D\u8BB0\u5F55\u6EDA\u52A8\u4F4D\u7F6E (${reason})`);
    },
    // 第一个「不带 cursor=」的列表搜索说明列表真的从第一页重新加载了。此刻若页面
    // 已回到顶部，说明没有滚动还原的回放，可以恢复记录；否则保持守卫压住回放游标。
    observeResetGuard(url) {
      if (!this._isResetGuardActive) return;
      if (Date.now() - this._resetGuardStartedAt > RESET_GUARD_TTL_MS) {
        this.releaseResetGuard("guard timeout");
        return;
      }
      if (typeof url !== "string" || !url.includes("/i/listings/search")) return;
      if (url.includes("cursor=")) return;
      if (this._currentScrollY() > RESET_GUARD_TOP_TOLERANCE_PX) return;
      this.releaseResetGuard("list reloaded from page 1");
    },
    _clearResetGuardFlag() {
      if (typeof sessionStorage === "undefined") return;
      try {
        sessionStorage.removeItem(RESET_GUARD_KEY);
      } catch (e) {
      }
    },
    _setScrollRestoration(mode) {
      try {
        if (typeof history !== "undefined" && history) {
          history.scrollRestoration = mode;
          return true;
        }
      } catch (e) {
      }
      return false;
    },
    // 等本次加载的滚动还原决策走完再交还浏览器默认行为
    _restoreScrollRestorationWhenSettled() {
      const revert = /* @__PURE__ */ __name(() => this._setScrollRestoration("auto"), "revert");
      if (typeof document !== "undefined" && document && document.readyState === "complete") {
        setTimeout(revert, 2e3);
      } else if (typeof window !== "undefined" && window && typeof window.addEventListener === "function") {
        window.addEventListener("load", () => setTimeout(revert, 2e3), { once: true });
      } else {
        revert();
      }
    },
    _currentScrollY() {
      try {
        if (typeof window !== "undefined" && window) {
          if (typeof window.scrollY === "number") return window.scrollY;
          if (typeof window.pageYOffset === "number") return window.pageYOffset;
        }
      } catch (e) {
      }
      return 0;
    },
    // 自动扫描依赖位置记录来恢复进度。仅在应急滚页备用模式或用户显式开启「记住位置」时启用，
    // 绝不因主力 API 扫描 (State.isExecuting) 而误触 DOM 游标保存/注入。
    isPositionTrackingEnabled() {
      return Boolean(State.domFallbackMode || State.rememberScrollPosition || State.autoScroll || State.autoAddOnScroll);
    },
    async init() {
      this._isCursorSaveLocked = false;
      try {
        const savedCursor = await GM_getValue(Config.DB_KEYS.LAST_CURSOR);
        if (savedCursor) {
          State.savedCursor = savedCursor;
          this._lastSeenCursor = savedCursor;
          Utils.logger("debug", `[Cursor] Initialized. Loaded saved cursor: ${savedCursor.substring(0, 30)}...`);
        } else {
          Utils.logger("debug", `[Cursor] Initialized. No saved cursor found.`);
        }
        if (typeof sessionStorage !== "undefined") {
          const recoveryCursor = sessionStorage.getItem("fab_helper_recovery_cursor");
          if (recoveryCursor) {
            State.savedCursor = recoveryCursor;
            this._lastSeenCursor = recoveryCursor;
            State.isRecoveryMode = true;
            Utils.logger("info", `[Recovery] \u68C0\u6D4B\u5230\u4E34\u65F6\u6062\u590D\u6E38\u6807\uFF0C\u5C06\u5728\u521D\u6B21\u52A0\u8F7D\u65F6\u5F3A\u5236\u6062\u590D\u4F4D\u7F6E`);
          }
        }
      } catch (e) {
        Utils.logger("warn", "[Cursor] Failed to restore cursor state:", e);
      }
      this.initResetGuard();
      this.applyPatches();
      Utils.logger("debug", "[Cursor] Network interceptors applied.");
      this.setupSortMonitor();
    },
    // 添加监听URL变化的方法，检测排序方式和筛选条件变更
    setupSortMonitor() {
      this.checkUrlChanges();
      if (typeof MutationObserver !== "undefined") {
        const bodyObserver = new MutationObserver(() => {
          if (window.location.href !== this._lastCheckedUrl) {
            this._lastCheckedUrl = window.location.href;
            this.checkUrlChanges();
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
        this.checkUrlChanges();
        Utils.detectLanguage();
      });
      window.addEventListener("hashchange", () => {
        this.checkUrlChanges();
        Utils.detectLanguage();
      });
      this._lastCheckedUrl = window.location.href;
    },
    // 检查URL变化（排序、搜索词、分类等）并重置状态
    checkUrlChanges() {
      try {
        const url = new URL(window.location.href);
        const isSearchOrList = url.pathname.includes("/search") || url.pathname === "/" || url.pathname === "/zh-cn/" || url.pathname === "/en/" || url.pathname.includes("/sellers/");
        if (!isSearchOrList) {
          return;
        }
        const currentSort = url.searchParams.get("sort_by");
        const currentQuery = url.searchParams.get("query") || url.searchParams.get("q");
        const currentCategory = url.searchParams.get("category");
        if (currentSort) {
          let matchedOption = null;
          if (State.sortOptions) {
            for (const [key, option] of Object.entries(State.sortOptions)) {
              if (option.value === currentSort) {
                matchedOption = key;
                break;
              }
            }
          }
          if (matchedOption && matchedOption !== State.currentSortOption) {
            const previousSort = State.currentSortOption;
            State.currentSortOption = matchedOption;
            GM_setValue("fab_helper_sort_option", State.currentSortOption);
            Utils.logger("debug", Utils.getText(
              "log_url_sort_changed",
              State.sortOptions?.[previousSort]?.name || previousSort,
              State.sortOptions?.[State.currentSortOption]?.name || State.currentSortOption
            ));
            this.clearSavedPosition("Sort change");
          }
        }
        if (this._lastParams) {
          if (this._lastParams.query !== currentQuery || this._lastParams.category !== currentCategory) {
            this.clearSavedPosition("Search/Filter change");
          }
        }
        this._lastParams = {
          query: currentQuery,
          category: currentCategory,
          sort: currentSort
        };
      } catch (e) {
        Utils.logger("warn", Utils.getText("log_sort_check_error", e.message));
      }
    },
    // 辅助方法：清除位置
    async clearSavedPosition(reason) {
      this.lockCursorSaving();
      State.savedCursor = null;
      this._lastSeenCursor = null;
      this._patchHasBeenApplied = false;
      State.isRecoveryMode = false;
      try {
        await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
        await GM_deleteValue(Config.DB_KEYS.API_CURSOR);
        await GM_deleteValue(Config.DB_KEYS.API_CURSOR_SAVED_AT);
        await GM_deleteValue(Config.DB_KEYS.FAST_SCAN_CHECKPOINT);
      } catch (e) {
        Utils.logger("warn", "[Cursor] Failed to delete stored cursor:", e);
      }
      if (typeof sessionStorage !== "undefined") {
        try {
          sessionStorage.removeItem("fab_helper_recovery_cursor");
          sessionStorage.removeItem("fab_helper_last_recovery_cursor");
        } catch (e) {
        }
      }
      if (State.UI && State.UI.savedPositionDisplay) {
        State.apiCursor = null;
        State.UI.savedPositionDisplay.textContent = Utils.getText("no_saved_position");
      }
      Utils.logger("info", `${Utils.getText("log_sort_changed_position_cleared")} (${reason})`);
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
    isListingSearch(url) {
      if (typeof url !== "string" || !url.includes("/i/listings/search")) return false;
      if (url.includes("aggregate_on=") || url.includes("count=0")) return false;
      return true;
    },
    isDebounceableSearch(url) {
      if (!this.isListingSearch(url)) return false;
      try {
        const urlObj = new URL(url, window.location.origin);
        if (urlObj.searchParams.has("cursor")) return false;
      } catch (e) {
        if (url.includes("cursor=")) return false;
      }
      return true;
    },
    shouldPatchUrl(url) {
      if (typeof url !== "string") return false;
      if (this._patchHasBeenApplied || this._isCursorSaveLocked) return false;
      if (!url.includes("/i/listings/search")) return false;
      if (url.includes("aggregate_on=") || url.includes("count=0") || url.includes("in=wishlist")) return false;
      if (State.isRecoveryMode && State.savedCursor) {
        return true;
      }
      if (!this.isPositionTrackingEnabled() || !State.savedCursor) return false;
      Utils.logger("debug", Utils.getText("page_patcher_match") + ` URL: ${url}`);
      return true;
    },
    getPatchedUrl(originalUrl) {
      if (State.savedCursor) {
        const urlObj = new URL(originalUrl, window.location.origin);
        urlObj.searchParams.set("cursor", State.savedCursor);
        const modifiedUrl = urlObj.pathname + urlObj.search;
        Utils.logger("debug", `[Cursor] ${Utils.getText("cursor_injecting")}: ${originalUrl}`);
        Utils.logger("debug", `[Cursor] ${Utils.getText("cursor_patched_url")}: ${modifiedUrl}`);
        this._patchHasBeenApplied = true;
        if (State.isRecoveryMode) {
          State.isRecoveryMode = false;
          try {
            sessionStorage.removeItem("fab_helper_recovery_cursor");
            Utils.logger("debug", `[Recovery] \u4E34\u65F6\u6062\u590D\u6E38\u6807\u5DF2\u6D88\u8D39\u5E76\u6E05\u9664`);
          } catch (e) {
          }
        }
        if (State.UI && State.UI.savedPositionDisplay) {
          const container = State.UI.savedPositionDisplay.parentElement;
          if (container) {
            const originalBg = container.style.backgroundColor;
            const originalColor = container.style.color;
            container.style.transition = "background-color 0.5s, color 0.5s";
            container.style.backgroundColor = "rgba(52, 199, 89, 0.2)";
            container.style.color = "var(--green)";
            setTimeout(() => {
              container.style.backgroundColor = originalBg;
              container.style.color = originalColor;
            }, 5e3);
          }
        }
        return modifiedUrl;
      }
      return originalUrl;
    },
    saveLatestCursorFromUrl(url) {
      try {
        if (!this.isPositionTrackingEnabled() || this._isCursorSaveLocked) return;
        if (typeof url !== "string" || !url.includes("/i/listings/search") || !url.includes("cursor=")) return;
        const urlObj = new URL(url, window.location.origin);
        const newCursor = urlObj.searchParams.get("cursor");
        if (newCursor && newCursor !== this._lastSeenCursor) {
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
      } catch (e) {
        Utils.logger("warn", Utils.getText("log_cursor_save_error"), e);
      }
    },
    // Fab 的无限滚动有时只在响应体的 cursors.next 返回下一页游标，
    // 不会立刻拼进下一次请求 URL。直接从响应保存，避免页面持续加载但位置始终为空。
    saveCursorFromSearchPayload(payload) {
      if (!payload || typeof payload !== "object") return;
      const next = payload.cursors && payload.cursors.next != null ? payload.cursors.next : typeof payload.next === "string" ? payload.next : null;
      if (next == null || next === "") return;
      if (typeof next === "string" && next.includes("cursor=")) {
        this.saveLatestCursorFromUrl(next);
        return;
      }
      this.saveLatestCursorFromUrl(
        `${window.location.origin}/i/listings/search?cursor=${encodeURIComponent(String(next))}`
      );
    },
    applyPatches() {
      const self = this;
      const originalXhrOpen = XMLHttpRequest.prototype.open;
      const originalXhrSend = XMLHttpRequest.prototype.send;
      const DEBOUNCE_DELAY_MS = 350;
      const LEADING_EDGE_QUIET_MS = 1500;
      const listenerAwareSend = /* @__PURE__ */ __name(function(...args) {
        const request = this;
        const onLoad = /* @__PURE__ */ __name(() => {
          request.removeEventListener("load", onLoad);
          if (typeof window.recordNetworkActivity === "function") {
            window.recordNetworkActivity();
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
                if (isRateLimitedResponse(request.status, responseText)) {
                  Utils.logger("warn", Utils.getText("log_xhr_rate_limit_detect", responseText.substring(0, 200)));
                  RateLimitManager.enterRateLimitedState("XHR\u54CD\u5E94\u5185\u5BB9\u9650\u901F");
                  return;
                }
                try {
                  const data = JSON.parse(responseText);
                  if (request._url && request._url.includes("/i/listings/search")) {
                    self.saveCursorFromSearchPayload(data);
                  }
                  if (data.results && data.results.length === 0 && self.isListingSearch(request._url)) {
                    const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;
                    const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;
                    const urlObj = new URL(request._url, window.location.origin);
                    const params = urlObj.searchParams;
                    const nonFilteringParams = /* @__PURE__ */ new Set(["cursor", "count", "limit", "offset", "workerId"]);
                    const hasSpecialFilters = Array.from(params.keys()).some((key) => !nonFilteringParams.has(key));
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
                      Utils.logger("debug", "\u641C\u7D22\u8FD4\u56DE\u7A7A\u7ED3\u679C\uFF0C\u7B49\u5F85\u5217\u8868\u72B6\u6001\u66F4\u65B0\uFF1B\u6CA1\u6709\u9650\u901F\u9519\u8BEF\u8BC1\u636E\u3002");
                      return;
                    }
                  }
                } catch (jsonError) {
                }
              }
            } catch (e) {
            }
          }
          if (self.isListingSearch(request._url)) {
            self.handleSearchResponse(request);
          }
        }, "onLoad");
        request.addEventListener("load", onLoad);
        return originalXhrSend.apply(request, args);
      }, "listenerAwareSend");
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        let modifiedUrl = url;
        self.observeResetGuard(url);
        if (self.shouldPatchUrl(url)) {
          modifiedUrl = self.getPatchedUrl(url);
          this._isDebouncedSearch = false;
        } else if (self.isDebounceableSearch(url)) {
          if (typeof url === "string" && !url.includes("cursor=") && !State.savedCursor) {
            self.unlockCursorSaving();
          }
          self.saveLatestCursorFromUrl(url);
          this._isDebouncedSearch = true;
        } else {
          if (typeof url === "string" && url.includes("/i/listings/search") && !url.includes("cursor=") && !State.savedCursor) {
            self.unlockCursorSaving();
          }
          self.saveLatestCursorFromUrl(url);
          this._isDebouncedSearch = false;
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
        const now = Date.now();
        const sendArgs = args;
        const sendNow = /* @__PURE__ */ __name(() => {
          if (State.debugMode) {
            Utils.logger("debug", Utils.getText("log_debounce_sending", self._pendingXhr && self._pendingXhr._url));
          }
          self._lastDebounceXhrFire = Date.now();
          const xhr = self._pendingXhr;
          self._pendingXhr = null;
          listenerAwareSend.apply(xhr, sendArgs);
        }, "sendNow");
        if (now - self._lastDebounceXhrFire >= LEADING_EDGE_QUIET_MS) {
          sendNow();
        } else {
          self._debounceXhrTimer = setTimeout(sendNow, DEBOUNCE_DELAY_MS);
        }
      };
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        let url = typeof input === "string" ? input : input.url;
        let modifiedInput = input;
        self.observeResetGuard(url);
        if (self.shouldPatchUrl(url)) {
          const modifiedUrl = self.getPatchedUrl(url);
          if (typeof input === "string") {
            modifiedInput = modifiedUrl;
          } else {
            modifiedInput = new Request(modifiedUrl, input);
          }
        } else {
          if (typeof url === "string" && url.includes("/i/listings/search") && !url.includes("cursor=") && !State.savedCursor) {
            self.unlockCursorSaving();
          }
          self.saveLatestCursorFromUrl(url);
        }
        return originalFetch.apply(this, [modifiedInput, init]).then((response) => {
          if (typeof window.recordNetworkActivity === "function") {
            window.recordNetworkActivity();
          }
          if (response.status === 429 || response.status === "429" || response.status.toString() === "429") {
            response.clone();
            Utils.logger("warn", Utils.getText("log_fetch_detected_429", response.url));
            RateLimitManager.enterRateLimitedState("Fetch\u54CD\u5E94429").catch(
              (e) => Utils.logger("error", Utils.getText("log_handling_rate_limit_error", e.message))
            );
          }
          if (response.status >= 200 && response.status < 300) {
            response.clone().text().then((text) => {
              if (isRateLimitedResponse(response.status, text)) {
                Utils.logger("warn", Utils.getText("log_fetch_rate_limit_detect", text.substring(0, 100)));
                RateLimitManager.enterRateLimitedState("Fetch\u54CD\u5E94\u5185\u5BB9\u9650\u901F").catch(
                  (e) => Utils.logger("error", Utils.getText("log_handling_rate_limit_error", e.message))
                );
                return response;
              }
              try {
                const data = JSON.parse(text);
                if (url.includes("/i/listings/search")) {
                  self.saveCursorFromSearchPayload(data);
                  if (self.isListingSearch(url)) {
                    RateLimitManager.recordSuccessfulRequest("Fetch\u641C\u7D22\u54CD\u5E94", Array.isArray(data.results) && data.results.length > 0);
                  }
                }
                const responseUrl = response.url || "";
                if (data.results && data.results.length === 0 && responseUrl.includes("/i/listings/search")) {
                  const isEndOfList = data.next === null && data.previous !== null && data.cursors && data.cursors.next === null && data.cursors.previous !== null;
                  const isEmptySearch = data.next === null && data.previous === null && data.cursors && data.cursors.next === null && data.cursors.previous === null;
                  const urlObj = new URL(responseUrl, window.location.origin);
                  const params = urlObj.searchParams;
                  const nonFilteringParams = /* @__PURE__ */ new Set(["cursor", "count", "limit", "offset", "workerId"]);
                  const hasSpecialFilters = Array.from(params.keys()).some((key) => !nonFilteringParams.has(key));
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
                    Utils.logger("debug", "\u641C\u7D22\u8FD4\u56DE\u7A7A\u7ED3\u679C\uFF0C\u7B49\u5F85\u5217\u8868\u72B6\u6001\u66F4\u65B0\uFF1B\u6CA1\u6709\u9650\u901F\u9519\u8BEF\u8BC1\u636E\u3002");
                  }
                }
              } catch (jsonError) {
                Utils.logger("debug", Utils.getText("log_json_parse_error", jsonError.message));
              }
            }).catch(() => {
            });
          }
          return response;
        });
      };
    }
  };

  // src/modules/database.js
  var UI3 = null;
  var setUIReference2 = /* @__PURE__ */ __name((uiModule) => {
    UI3 = uiModule;
  }, "setUIReference");
  var Database = {
    normalizeListingUrl: /* @__PURE__ */ __name((url) => {
      if (!url) return "";
      const cleanUrl = String(url).split("?")[0].toLowerCase();
      const uidMatch = cleanUrl.match(/\/(?:listings|bundles)\/([^/?#]+)/i);
      if (uidMatch && uidMatch[1]) {
        return `https://www.fab.com/listings/${uidMatch[1].toLowerCase()}`;
      }
      return cleanUrl;
    }, "normalizeListingUrl"),
    // 归一化 url 的 Set，避免 isDone 在热路径上对每个 done 项重复 normalize（O(n²)）。
    doneSet: /* @__PURE__ */ new Set(),
    // State.db.done 的数组引用，用于 O(1) 检测「直接重赋值」（测试/直接赋值加载），
    // 命中即从数组重建 doneSet；生产路径只经 normalizeDoneList/addDoneUrl 写入，无需重建。
    _doneRef: null,
    // 单独记录最近一次已就地 normalize 过的 State.db.done 引用，确保外部直接赋值未规范化数组后
    // 首次写入时能做一次归一化，同时避免 5 万条数据下每次 addDoneUrl 重复 O(N) 重建。
    _normalizedRef: null,
    _saveDoneTimer: null,
    _saveDoneDirty: false,
    // 存储读写兜底：单个 GM_* 失败（如存储写满/序列化失败）不应中断主流程。
    _safeGet: /* @__PURE__ */ __name(async (key, def) => {
      try {
        return await GM_getValue(key, def);
      } catch (e) {
        Utils.logger("error", `\u8BFB\u53D6\u5B58\u50A8\u5931\u8D25 [${key}]: ${e.message}`);
        return def;
      }
    }, "_safeGet"),
    _safeSet: /* @__PURE__ */ __name((key, val) => {
      try {
        GM_setValue(key, val);
      } catch (e) {
        Utils.logger("error", `\u5199\u5165\u5B58\u50A8\u5931\u8D25 [${key}]: ${e.message}`);
      }
    }, "_safeSet"),
    getListingUid: /* @__PURE__ */ __name((url) => {
      if (!url) return "";
      const uidMatch = String(url).split("?")[0].match(/\/(?:listings|bundles)\/([^/?#]+)/i);
      return uidMatch && uidMatch[1] ? uidMatch[1].toLowerCase() : "";
    }, "getListingUid"),
    seedDoneOwnedStatusCache: /* @__PURE__ */ __name(() => {
      const states = State.db.done.map((url) => Database.getListingUid(url)).filter(Boolean).map((uid) => ({
        uid,
        acquired: true,
        lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }));
      DataCache.saveOwnedStatus(states);
      return states.length;
    }, "seedDoneOwnedStatusCache"),
    normalizeDoneList: /* @__PURE__ */ __name(() => {
      const normalized = [];
      const seen = /* @__PURE__ */ new Set();
      State.db.done.forEach((url) => {
        const cleanUrl = Database.normalizeListingUrl(url);
        if (!cleanUrl || seen.has(cleanUrl)) return;
        seen.add(cleanUrl);
        normalized.push(cleanUrl);
      });
      const changed = normalized.length !== State.db.done.length || normalized.some((url, index) => url !== State.db.done[index]);
      State.db.done = normalized;
      Database.doneSet = new Set(normalized);
      Database._doneRef = State.db.done;
      Database._normalizedRef = State.db.done;
      return changed;
    }, "normalizeDoneList"),
    addDoneUrl: /* @__PURE__ */ __name((url) => {
      const normalizedChanged = Database._normalizedRef !== State.db.done ? Database.normalizeDoneList() : false;
      const cleanUrl = Database.normalizeListingUrl(url);
      if (!cleanUrl) return normalizedChanged;
      if (Database.doneSet.has(cleanUrl)) return normalizedChanged;
      State.db.done.push(cleanUrl);
      Database.doneSet.add(cleanUrl);
      const uid = Database.getListingUid(cleanUrl);
      if (uid) {
        DataCache.saveOwnedStatus([{
          uid,
          acquired: true,
          lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }]);
      }
      return true;
    }, "addDoneUrl"),
    addDoneUrls: /* @__PURE__ */ __name((urls) => {
      const normalizedChanged = Database._normalizedRef !== State.db.done ? Database.normalizeDoneList() : false;
      if (!Array.isArray(urls) || urls.length === 0) {
        return { added: 0, changed: normalizedChanged };
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const cacheUpdates = [];
      let added = 0;
      for (const rawUrl of urls) {
        const cleanUrl = Database.normalizeListingUrl(rawUrl);
        if (!cleanUrl || Database.doneSet.has(cleanUrl)) continue;
        State.db.done.push(cleanUrl);
        Database.doneSet.add(cleanUrl);
        added += 1;
        const uid = Database.getListingUid(cleanUrl);
        if (uid) {
          cacheUpdates.push({
            uid,
            acquired: true,
            lastUpdatedAt: nowIso
          });
        }
      }
      if (cacheUpdates.length > 0) {
        DataCache.saveOwnedStatus(cacheUpdates);
      }
      return { added, changed: normalizedChanged || added > 0 };
    }, "addDoneUrls"),
    load: /* @__PURE__ */ __name(async () => {
      const rawTodo = await Database._safeGet(Config.DB_KEYS.TODO, []);
      State.db.todo = Array.isArray(rawTodo) ? rawTodo.filter((t) => t && Database.getListingUid(t.url)) : [];
      State.db.done = await Database._safeGet(Config.DB_KEYS.DONE, []);
      State.db.failed = await Database._safeGet(Config.DB_KEYS.FAILED, []);
      State.hideSaved = await Database._safeGet(Config.DB_KEYS.HIDE, false);
      State.autoAddOnScroll = await Database._safeGet(Config.DB_KEYS.AUTO_ADD, false);
      State.rememberScrollPosition = await Database._safeGet(Config.DB_KEYS.REMEMBER_POS, false);
      State.autoResumeAfter429 = await Database._safeGet(Config.DB_KEYS.AUTO_RESUME, false);
      State.autoRefreshEmptyPage = await Database._safeGet(Config.DB_KEYS.AUTO_REFRESH_EMPTY, true);
      State.hideDiscountedPaid = await Database._safeGet(Config.DB_KEYS.HIDE_DISCOUNTED, false);
      State.hidePaid = await Database._safeGet(Config.DB_KEYS.HIDE_PAID, false);
      State.blockLargeResources = await Database._safeGet(Config.DB_KEYS.BLOCK_RESOURCES, true);
      State.maxWorkers = await Database._safeGet(Config.DB_KEYS.MAX_WORKERS, Config.API_CLAIM_MAX_CONCURRENT_WORKERS);
      State.domFallbackMode = Boolean(await Database._safeGet(Config.DB_KEYS.DOM_FALLBACK_MODE, false));
      State.fastApiScan = !State.domFallbackMode;
      State.autoClaimVisible = Boolean(await Database._safeGet(Config.DB_KEYS.AUTO_CLAIM_VISIBLE, true));
      if (State.domFallbackMode) {
        State.autoScroll = true;
      }
      const loadedScanConc = Number(await Database._safeGet(
        Config.DB_KEYS.API_SCAN_CONCURRENCY,
        Config.DEFAULT_API_SCAN_CONCURRENCY
      ));
      State.apiScanConcurrency = Math.max(
        1,
        Math.min(
          Config.MAX_API_SCAN_CONCURRENCY,
          Number.isFinite(loadedScanConc) ? Math.floor(loadedScanConc) : Config.DEFAULT_API_SCAN_CONCURRENCY
        )
      );
      State.debugMode = await Database._safeGet("fab_helper_debug_mode", false);
      State.uiExpanded = Boolean(await Database._safeGet(Config.DB_KEYS.UI_EXPANDED, true));
      const savedCheckpoint = await Database._safeGet(Config.DB_KEYS.FAST_SCAN_CHECKPOINT, null);
      const hasCheckpoint = Boolean(
        savedCheckpoint && (Array.isArray(savedCheckpoint.slices) && savedCheckpoint.slices.some((s) => !s.done) || Array.isArray(savedCheckpoint.pendingUnknowns) && savedCheckpoint.pendingUnknowns.length > 0 || Array.isArray(savedCheckpoint.pendingClaims) && savedCheckpoint.pendingClaims.length > 0)
      );
      State.hasFastScanCheckpoint = hasCheckpoint;
      if (hasCheckpoint) {
        const itemsScanned = Number(savedCheckpoint?.stats?.itemsScanned) || 0;
        const totalEstimated = Number(savedCheckpoint?.stats?.totalEstimated || savedCheckpoint?.totalEstimated) || 0;
        const pct = totalEstimated > 0 ? Math.min(99, Math.max(1, Math.round(itemsScanned / totalEstimated * 100))) : null;
        State.fastScanCheckpointMeta = { itemsScanned, totalEstimated, pct };
      } else {
        State.fastScanCheckpointMeta = null;
      }
      State.currentSortOption = await Database._safeGet("fab_helper_sort_option", "title_desc");
      const storedExecuting = Boolean(await Database._safeGet(Config.DB_KEYS.IS_EXECUTING, false));
      if (!State.domFallbackMode) {
        State.isExecuting = false;
        if (storedExecuting) {
          Database._safeSet(Config.DB_KEYS.IS_EXECUTING, false);
        }
      } else {
        State.isExecuting = storedExecuting;
      }
      State.statusHistory = await Database._safeGet(Config.DB_KEYS.STATUS_HISTORY, []);
      if (Database.normalizeDoneList()) {
        await Database.saveDone();
      }
      Database.seedDoneOwnedStatusCache();
      Utils.logger("info", Utils.getText("log_db_loaded"), `(Session) To-Do: ${State.db.todo.length}, Done: ${State.db.done.length}, Failed: ${State.db.failed.length}`);
    }, "load"),
    // 添加保存待办列表的方法
    saveTodo: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.TODO, State.db.todo), "saveTodo"),
    saveDone: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.DONE, State.db.done), "saveDone"),
    scheduleSaveDone: /* @__PURE__ */ __name((delayMs = 2e3) => {
      Database._saveDoneDirty = true;
      if (Database._saveDoneTimer) return;
      Database._saveDoneTimer = setTimeout(() => {
        Database.flushSaveDone();
      }, delayMs);
    }, "scheduleSaveDone"),
    flushSaveDone: /* @__PURE__ */ __name(async () => {
      if (Database._saveDoneTimer) {
        clearTimeout(Database._saveDoneTimer);
        Database._saveDoneTimer = null;
      }
      if (!Database._saveDoneDirty) return;
      Database._saveDoneDirty = false;
      return Database.saveDone();
    }, "flushSaveDone"),
    saveFailed: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.FAILED, State.db.failed), "saveFailed"),
    saveHidePref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.HIDE, State.hideSaved), "saveHidePref"),
    saveAutoAddPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.AUTO_ADD, State.autoAddOnScroll), "saveAutoAddPref"),
    // Save the setting
    saveAutoScrollPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.AUTO_SCROLL, State.autoScroll), "saveAutoScrollPref"),
    // 保存自动滚动页面开关
    saveRememberPosPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.REMEMBER_POS, State.rememberScrollPosition), "saveRememberPosPref"),
    saveAutoResumePref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.AUTO_RESUME, State.autoResumeAfter429), "saveAutoResumePref"),
    saveAutoRefreshEmptyPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.AUTO_REFRESH_EMPTY, State.autoRefreshEmptyPage), "saveAutoRefreshEmptyPref"),
    // 保存无商品自动刷新设置
    saveHideDiscountedPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.HIDE_DISCOUNTED, State.hideDiscountedPaid), "saveHideDiscountedPref"),
    // 保存隐藏打折付费设置
    saveHidePaidPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.HIDE_PAID, State.hidePaid), "saveHidePaidPref"),
    // 保存隐藏所有付费设置
    saveBlockResourcesPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.BLOCK_RESOURCES, State.blockLargeResources), "saveBlockResourcesPref"),
    // 保存禁用大资源设置
    saveMaxWorkersPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.MAX_WORKERS, State.maxWorkers), "saveMaxWorkersPref"),
    // 保存并发工作标签页设置
    saveFastApiScanPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.FAST_API_SCAN, State.fastApiScan), "saveFastApiScanPref"),
    saveApiScanConcurrencyPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.API_SCAN_CONCURRENCY, State.apiScanConcurrency), "saveApiScanConcurrencyPref"),
    saveAutoClaimVisiblePref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.AUTO_CLAIM_VISIBLE, State.autoClaimVisible), "saveAutoClaimVisiblePref"),
    saveDomFallbackModePref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.DOM_FALLBACK_MODE, State.domFallbackMode), "saveDomFallbackModePref"),
    saveUiExpandedPref: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.UI_EXPANDED, State.uiExpanded), "saveUiExpandedPref"),
    saveExecutingState: /* @__PURE__ */ __name(() => Database._safeSet(Config.DB_KEYS.IS_EXECUTING, State.isExecuting), "saveExecutingState"),
    // Save the execution state
    resetAllData: /* @__PURE__ */ __name(async () => {
      if (window.confirm(Utils.getText("confirm_clear_data"))) {
        if (Database._saveDoneTimer) {
          clearTimeout(Database._saveDoneTimer);
          Database._saveDoneTimer = null;
        }
        Database._saveDoneDirty = false;
        await GM_deleteValue(Config.DB_KEYS.TODO);
        await GM_deleteValue(Config.DB_KEYS.DONE);
        await GM_deleteValue(Config.DB_KEYS.FAILED);
        await GM_deleteValue(Config.DB_KEYS.HIDE_DISCOUNTED);
        await GM_deleteValue(Config.DB_KEYS.HIDE_PAID);
        await GM_deleteValue(Config.DB_KEYS.BLOCK_RESOURCES);
        await GM_deleteValue(Config.DB_KEYS.MAX_WORKERS);
        await GM_deleteValue(Config.DB_KEYS.FAST_API_SCAN);
        await GM_deleteValue(Config.DB_KEYS.API_SCAN_CONCURRENCY);
        await GM_deleteValue(Config.DB_KEYS.AUTO_CLAIM_VISIBLE);
        await GM_deleteValue(Config.DB_KEYS.DOM_FALLBACK_MODE);
        await GM_deleteValue(Config.DB_KEYS.FAST_SCAN_CHECKPOINT);
        await PagePatcher.clearSavedPosition("Reset all data");
        State.db.todo = [];
        State.db.done = [];
        Database.doneSet = /* @__PURE__ */ new Set();
        Database._doneRef = State.db.done;
        Database._normalizedRef = State.db.done;
        State.db.failed = [];
        State.blockLargeResources = true;
        State.maxWorkers = Config.API_CLAIM_MAX_CONCURRENT_WORKERS;
        State.domFallbackMode = false;
        State.fastApiScan = true;
        State.autoClaimVisible = true;
        State.autoScroll = false;
        State.apiScanConcurrency = Config.DEFAULT_API_SCAN_CONCURRENCY;
        State.fastScanStatus = null;
        State.fastScanCheckpointMeta = null;
        State.hasFastScanCheckpoint = false;
        Utils.logger("info", "\u6240\u6709\u811A\u672C\u6570\u636E\uFF08\u5305\u62EC\u6EDA\u52A8\u8BB0\u5FC6\u4E0E\u5927\u8D44\u6E90\u7981\u7528\u8BBE\u7F6E\uFF09\u5DF2\u91CD\u7F6E\u3002");
        if (UI3) {
          UI3.removeAllOverlays();
          UI3.update();
        }
      }
    }, "resetAllData"),
    isDone: /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      const cleanUrl = Database.normalizeListingUrl(url);
      if (Database._doneRef !== State.db.done) {
        Database.doneSet = new Set(State.db.done.map((u) => Database.normalizeListingUrl(u)));
        Database._doneRef = State.db.done;
      }
      return Database.doneSet.has(cleanUrl);
    }, "isDone"),
    isFailed: /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      const cleanUrl = Database.normalizeListingUrl(url);
      return State.db.failed.some((task) => Database.normalizeListingUrl(task.url) === cleanUrl);
    }, "isFailed"),
    isTodo: /* @__PURE__ */ __name((url) => {
      if (!url) return false;
      const cleanUrl = Database.normalizeListingUrl(url);
      return State.db.todo.some((task) => Database.normalizeListingUrl(task.url) === cleanUrl);
    }, "isTodo"),
    markAsDone: /* @__PURE__ */ __name(async (task, { deferSave = false } = {}) => {
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
      const initialFailedCount = State.db.failed.length;
      State.db.failed = State.db.failed.filter((failedTask) => failedTask.uid !== task.uid);
      if (State.db.failed.length !== initialFailedCount) {
        changed = true;
        await Database.saveFailed();
      }
      if (Database.addDoneUrl(task.url)) {
        changed = true;
      }
      if (changed) {
        if (deferSave) {
          Database.scheduleSaveDone();
        } else {
          await Database.saveDone();
        }
      }
    }, "markAsDone"),
    // 根据失败原因判定自动重试上限：
    //  - 人机验证/适配类：重试无意义且会招更多风控 → 0 次，直接进失败列表
    //  - 环境类(超时/被远程判死/唤醒清理)：值得自动重试 → 3 次
    //  - 其他(可能只是页面没加载好)：给 1 次机会
    getMaxRetry: /* @__PURE__ */ __name((reason) => {
      if (!reason) return 1;
      if (/人机验证|captcha|需要人工|verification/i.test(reason)) return 0;
      if (/(?:接口返回|HTTP)\s*(?:400|401|403|404)\b|未找到免费许可|服务端内部错误|500 Internal error|服务端返回错误提示/i.test(reason)) return 0;
      if (/超时|Watchdog|完成前关闭|closed before|Timeout|唤醒/i.test(reason)) return 3;
      return 1;
    }, "getMaxRetry"),
    // 返回 { retried: bool }。retried=true 表示已按归因自动放回待办重试，未计入最终失败；
    // 调用方据此决定是否累加 executionFailedTasks。
    markAsFailed: /* @__PURE__ */ __name(async (task, failureInfo = {}) => {
      if (!task || !task.uid) {
        Utils.logger("error", "\u6807\u8BB0\u4EFB\u52A1\u5931\u8D25\uFF0C\u6536\u5230\u65E0\u6548\u4EFB\u52A1:", JSON.stringify(task));
        return { retried: false };
      }
      const reason = failureInfo.reason || "\u672A\u77E5\u539F\u56E0";
      const nextRetry = (task.retryCount || 0) + 1;
      const maxRetry = Database.getMaxRetry(reason);
      State.db.todo = State.db.todo.filter((t) => t.uid !== task.uid);
      if (nextRetry <= maxRetry) {
        State.db.todo.push({ ...task, retryCount: nextRetry });
        Utils.logger("info", Utils.getText("log_auto_retry", nextRetry, maxRetry, task.name) + ` [${reason}]`);
        await Database.saveTodo();
        if (UI3) UI3.update();
        return { retried: true };
      }
      const failedTask = {
        ...task,
        failedAt: (/* @__PURE__ */ new Date()).toISOString(),
        failureReason: reason,
        errorDetails: failureInfo.details || null,
        workerLogs: failureInfo.logs || [],
        retryCount: nextRetry
      };
      Utils.logger("warn", `\u{1F4CB} \u4EFB\u52A1\u5931\u8D25\u8BE6\u60C5:`);
      Utils.logger("warn", `   - \u4EFB\u52A1\u540D\u79F0: ${task.name}`);
      Utils.logger("warn", `   - \u4EFB\u52A1UID: ${task.uid}`);
      Utils.logger("warn", `   - \u5931\u8D25\u539F\u56E0: ${failedTask.failureReason}`);
      Utils.logger("warn", `   - \u91CD\u8BD5\u6B21\u6570: ${failedTask.retryCount}`);
      if (failedTask.errorDetails) {
        Utils.logger("warn", `   - \u9519\u8BEF\u8BE6\u60C5: ${JSON.stringify(failedTask.errorDetails)}`);
      }
      if (failedTask.workerLogs && failedTask.workerLogs.length > 0) {
        Utils.logger("warn", `   - \u5DE5\u4F5C\u7EBF\u7A0B\u65E5\u5FD7 (${failedTask.workerLogs.length} \u6761):`);
        failedTask.workerLogs.slice(-5).forEach((log, i) => {
          Utils.logger("warn", `     ${i + 1}. ${log}`);
        });
      }
      const existingIndex = State.db.failed.findIndex((f) => f.uid === task.uid);
      if (existingIndex >= 0) {
        State.db.failed[existingIndex] = failedTask;
        Utils.logger("debug", `\u66F4\u65B0\u4E86\u5DF2\u5B58\u5728\u7684\u5931\u8D25\u8BB0\u5F55: ${task.name}`);
      } else {
        State.db.failed.push(failedTask);
      }
      await Database.saveTodo();
      await Database.saveFailed();
      return { retried: false };
    }, "markAsFailed")
  };

  // src/modules/instance-manager.js
  var InstanceManager = {
    isActive: false,
    lastPingTime: 0,
    pingInterval: null,
    // 初始化实例管理
    init: /* @__PURE__ */ __name(async function() {
      try {
        if (new URLSearchParams(window.location.search).has("workerId")) {
          this.isActive = false;
          return true;
        }
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
    }, "cleanup"),
    // 手动强制激活（用于用户手动开始任务时）
    activate: /* @__PURE__ */ __name(async function() {
      if (this.isActive) return;
      this.isActive = true;
      await this.registerAsActive();
      Utils.logger("info", Utils.getText("log_instance_activated", Config.INSTANCE_ID));
      if (!this.pingInterval) {
        this.pingInterval = setInterval(() => this.ping(), 3e3);
      }
    }, "activate")
  };

  // src/modules/keepalive.js
  var KeepAlive = {
    _worker: null,
    _workerUrl: null,
    _tickCb: null,
    _running: false,
    _lastTickAt: null,
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
        const intervalMs = Config.KEEPALIVE_TICK_MS || 2e3;
        const workerSrc = "let n=0;setInterval(function(){postMessage(++n);}," + intervalMs + ");";
        const blob = new Blob([workerSrc], { type: "application/javascript" });
        this._workerUrl = URL.createObjectURL(blob);
        this._worker = new Worker(this._workerUrl);
        this._worker.onmessage = () => {
          this._lastTickAt = Date.now();
          try {
            const r = this._tickCb && this._tickCb();
            if (r && typeof r.catch === "function") {
              r.catch((e) => console.error("[Fab Helper] keepalive tick error:", e));
            }
          } catch (e) {
            console.error("[Fab Helper] keepalive tick error:", e);
          }
        };
        Utils.logger("debug", Utils.getText("log_keepalive_on"));
      } catch (e) {
        Utils.logger("warn", Utils.getText("log_keepalive_failed", e.message));
      }
    },
    _stopHeartbeat() {
      if (this._worker) {
        try {
          this._worker.terminate();
        } catch (e) {
        }
        this._worker = null;
      }
      if (this._workerUrl) {
        try {
          URL.revokeObjectURL(this._workerUrl);
        } catch (e) {
        }
        this._workerUrl = null;
      }
    },
    async _startFreezeGuard() {
      if (this._pc1 || typeof RTCPeerConnection === "undefined") return;
      try {
        const pc1 = new RTCPeerConnection();
        const pc2 = new RTCPeerConnection();
        this._pc1 = pc1;
        this._pc2 = pc2;
        pc1.onicecandidate = (e) => {
          if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {
          });
        };
        pc2.onicecandidate = (e) => {
          if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {
          });
        };
        this._dc = pc1.createDataChannel("fab-keepalive");
        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(offer);
        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(answer);
      } catch (e) {
        Utils.logger("warn", Utils.getText("log_keepalive_failed", e.message));
        this._stopFreezeGuard();
      }
    },
    _stopFreezeGuard() {
      try {
        if (this._dc) this._dc.close();
      } catch (e) {
      }
      try {
        if (this._pc1) this._pc1.close();
      } catch (e) {
      }
      try {
        if (this._pc2) this._pc2.close();
      } catch (e) {
      }
      this._dc = null;
      this._pc1 = null;
      this._pc2 = null;
    },
    /** 由心跳驱动，偶尔通过 data channel 发一下保持活跃 */
    poke() {
      try {
        if (this._dc && this._dc.readyState === "open") this._dc.send("p");
      } catch (e) {
      }
    },
    /** 返回保活运行状态，供 UI 展示、用于实测验证(尤其判断 Worker 是否被 CSP 拦) */
    getStatus() {
      return {
        running: this._running,
        heartbeatAlive: !!this._worker,
        lastTickAgoMs: this._lastTickAt ? Date.now() - this._lastTickAt : null,
        freezeGuard: this._dc ? this._dc.readyState : this._pc1 ? "connecting" : "off"
      };
    }
  };

  // src/modules/captcha-detection.js
  var CAPTCHA_IFRAME_SELECTORS = [
    'iframe[src*="hcaptcha"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="captcha"]',
    'iframe[src*="turnstile"]',
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="arkoselabs"]',
    'iframe[title*="challenge" i]',
    'iframe[src*="frame=challenge" i]',
    'iframe[title*="reCAPTCHA" i]',
    'iframe[title*="Cloudflare" i]'
  ];
  var CAPTCHA_TEXT_REGEX = /(?:人机验证|确认您是真人|请完成安全验证|我不是机器人|安全检查|verify (?:that )?you are human|i(?:'m| am) not a robot|checking your browser|complete the security check|unusual traffic|challenge-running|cf-turnstile)/i;
  function isCaptchaPresent(doc) {
    if (!doc) return false;
    try {
      const frames = doc.querySelectorAll(CAPTCHA_IFRAME_SELECTORS.join(", "));
      for (const frame of frames) {
        const rect = frame.getBoundingClientRect ? frame.getBoundingClientRect() : { width: 0, height: 0 };
        const win = frame.ownerDocument?.defaultView || doc.defaultView;
        const style = win?.getComputedStyle ? win.getComputedStyle(frame) : null;
        const isVisible = rect.width > 0 && rect.height > 0 && style?.visibility !== "hidden" && style?.display !== "none";
        if (isVisible) return true;
      }
      const text = doc.body && doc.body.innerText || "";
      return CAPTCHA_TEXT_REGEX.test(text);
    } catch {
      return false;
    }
  }
  __name(isCaptchaPresent, "isCaptchaPresent");

  // src/modules/detail-claim.js
  var KEY_ELEMENT_SELECTOR = 'button, a.fabkit-Button-root, [role="button"], a[class*="Button"], a[class*="button"]';
  var ACTION_BUTTON_SELECTOR = 'button, .fabkit-Button-root, [role="button"], [class*="Button"], [class*="button"], a[href]';
  var OWNED_BADGE_TEXTS = [
    "\u5DF2\u4FDD\u5B58\u5728\u6211\u7684\u5E93\u4E2D",
    "Saved in My Library",
    "Saved in library",
    "\u5DF2\u4FDD\u5B58\u5728\u5E93\u4E2D"
  ];
  var CHECKOUT_KEYWORDS = [
    "place order",
    "\u4E0B\u5355",
    "checkout",
    "\u7ED3\u8D26",
    "complete order",
    "\u5B8C\u6210\u8BA2\u5355",
    "confirm",
    "\u786E\u8BA4",
    "claim",
    "\u9886\u53D6",
    "get",
    "\u83B7\u53D6",
    "pay",
    "\u652F\u4ED8"
  ];
  var DEFAULT_SLEEP = /* @__PURE__ */ __name((ms) => new Promise((resolve) => setTimeout(resolve, ms)), "DEFAULT_SLEEP");
  var noop = /* @__PURE__ */ __name(() => {
  }, "noop");
  var normalizeContext = /* @__PURE__ */ __name((options = {}) => ({
    doc: options.doc ?? (typeof document !== "undefined" ? document : null),
    win: options.win ?? (typeof window !== "undefined" ? window : null),
    utils: options.utils || Utils,
    api: options.api || API,
    diagnostics: options.diagnostics || PageDiagnostics,
    // TaskRunner 必须显式传入：task-runner 会 import 本模块，反向 import 会成环
    taskRunner: options.taskRunner || null,
    MutationObserver: options.MutationObserver || (typeof globalThis !== "undefined" ? globalThis.MutationObserver : null),
    sleep: options.sleep || DEFAULT_SLEEP,
    setTimeoutFn: options.setTimeoutFn || ((fn, ms) => setTimeout(fn, ms)),
    clearTimeoutFn: options.clearTimeoutFn || ((id) => clearTimeout(id)),
    setIntervalFn: options.setIntervalFn || ((fn, ms) => setInterval(fn, ms)),
    clearIntervalFn: options.clearIntervalFn || ((id) => clearInterval(id)),
    now: options.now || (() => Date.now())
  }), "normalizeContext");
  var waitForPageReady = /* @__PURE__ */ __name(async (ctx) => {
    const { doc, sleep, now } = ctx;
    const maxWait = 15e3;
    const startAt = now();
    let lastState = "";
    while (now() - startAt < maxWait) {
      const currentState = doc?.readyState;
      const hasMainContent = doc?.querySelector('main, .product-detail, [class*="listing"], [class*="detail"]');
      const hasButtons = (doc?.querySelectorAll(KEY_ELEMENT_SELECTOR)?.length || 0) > 0;
      const hasTitle = doc?.querySelector("h1, .fabkit-Heading--xl");
      if (currentState !== lastState) {
        ctx.log(`\u9875\u9762\u72B6\u6001: ${currentState}`);
        lastState = currentState;
      }
      const isReadyState = currentState === "interactive" || currentState === "complete";
      if (isReadyState && hasMainContent && (hasButtons || hasTitle)) {
        ctx.log(`\u9875\u9762\u5C31\u7EEA\u68C0\u6D4B\u901A\u8FC7: readyState=${currentState}, hasContent=true`);
        return true;
      }
      await sleep(100);
    }
    ctx.log(`\u9875\u9762\u5C31\u7EEA\u68C0\u6D4B\u8D85\u65F6 (${maxWait}ms)\uFF0C\u7EE7\u7EED\u5C1D\u8BD5\u64CD\u4F5C`);
    return false;
  }, "waitForPageReady");
  var waitForKeyElement = /* @__PURE__ */ __name(async (ctx, maxWait = 2e3) => {
    const matchKey = /* @__PURE__ */ __name(() => {
      const buttons = ctx.doc?.querySelectorAll(KEY_ELEMENT_SELECTOR) || [];
      for (const btn of buttons) {
        const text = ctx.utils.normalizeWhitespace(btn.textContent || "");
        if (!text) continue;
        const lower = text.toLowerCase();
        if ([...Config.ACQUISITION_TEXT_SET].some((k) => lower.includes(k.toLowerCase()))) return true;
        if ([...Config.SAVED_TEXT_SET].some((k) => lower.includes(k.toLowerCase()))) return true;
        if ([...Config.EXTERNAL_CTA_TEXT_SET].some((k) => lower.includes(k.toLowerCase()))) return true;
      }
      const bodyText = ctx.doc?.body && ctx.doc.body.textContent;
      if (bodyText) {
        for (const phrase of Config.SAVED_TEXT_SET) {
          if (bodyText.includes(phrase)) return true;
        }
      }
      return false;
    }, "matchKey");
    if (matchKey()) return;
    if (!ctx.MutationObserver || !ctx.doc?.body) {
      await ctx.sleep(maxWait);
      return;
    }
    await new Promise((resolve) => {
      let done = false;
      const finish = /* @__PURE__ */ __name(() => {
        if (done) return;
        done = true;
        try {
          observer.disconnect();
        } catch (e) {
        }
        clearTimeout(timer);
        resolve();
      }, "finish");
      const observer = new ctx.MutationObserver(() => {
        if (matchKey()) finish();
      });
      observer.observe(ctx.doc.body, { childList: true, subtree: true });
      const timer = ctx.setTimeoutFn(finish, maxWait);
    });
  }, "waitForKeyElement");
  var dismissAdultWarning = /* @__PURE__ */ __name(async (ctx) => {
    const heading = ctx.doc?.querySelector(".fabkit-Heading--xl");
    if (!heading) return;
    const text = heading.textContent || "";
    if (!text.includes("\u6210\u4EBA\u5185\u5BB9") && !text.includes("Adult Content") && !text.includes("Mature Content")) return;
    ctx.log('\u68C0\u6D4B\u5230\u6210\u4EBA\u5185\u5BB9\u8B66\u544A\u5BF9\u8BDD\u6846\uFF0C\u81EA\u52A8\u70B9\u51FB"\u7EE7\u7EED"\u6309\u94AE...');
    const continueButton = [...ctx.doc.querySelectorAll("button.fabkit-Button--primary") || []].find((btn) => (btn.textContent || "").includes("\u7EE7\u7EED") || (btn.textContent || "").includes("Continue"));
    if (!continueButton) return;
    ctx.utils.deepClick(continueButton);
    ctx.log('\u5DF2\u70B9\u51FB"\u7EE7\u7EED"\u6309\u94AE\uFF0C\u7B49\u5F85\u9875\u9762\u52A0\u8F7D...');
    await ctx.sleep(2e3);
  }, "dismissAdultWarning");
  var checkOwnedViaApi = /* @__PURE__ */ __name(async (ctx, task, push) => {
    try {
      const csrfToken = ctx.utils.getCookie("fab_csrftoken");
      if (!csrfToken) throw new Error("CSRF token not found for API check.");
      const statesUrl = new URL("https://www.fab.com/i/users/me/listings-states");
      statesUrl.searchParams.append("listing_ids", task.uid);
      const response = await ctx.api.gmFetch({
        method: "GET",
        url: statesUrl.href,
        headers: { "x-csrftoken": csrfToken, "x-requested-with": "XMLHttpRequest" }
      });
      let statesData;
      try {
        statesData = JSON.parse(response.responseText);
        if (!Array.isArray(statesData)) {
          statesData = ctx.api.extractStateData(statesData, "SingleItemCheck");
        }
      } catch (e) {
        push(`\u89E3\u6790API\u54CD\u5E94\u5931\u8D25: ${e.message}`);
        statesData = [];
      }
      const isOwned = Array.isArray(statesData) && statesData.some((s) => s && s.uid === task.uid && s.acquired);
      if (isOwned) {
        push("API check confirms item is already owned.");
        return true;
      }
      push("API check confirms item is not owned. Proceeding to UI interaction.");
    } catch (apiError) {
      push(`API ownership check failed: ${apiError.message}. Falling back to UI-based check.`);
    }
    return false;
  }, "checkOwnedViaApi");
  var ERROR_TOAST_SELECTOR = '.fabkit-Snackbar-root, div[class*="Toast-root"], [role="alert"]';
  var ERROR_TOAST_PATTERNS = /ooops|an error occurred|something went wrong|try again later|发生错误|出错了|内部错误|请稍后再试/i;
  var detectErrorToastOnPage = /* @__PURE__ */ __name((ctx) => {
    const { doc, win, utils } = ctx;
    const ownedSnacks = Config.OWNED_SUCCESS_CRITERIA?.snackbarText || [];
    const nodes = doc?.querySelectorAll?.(ERROR_TOAST_SELECTOR) || [];
    for (const el of nodes) {
      const style = win && win.getComputedStyle ? win.getComputedStyle(el) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) continue;
      const text = utils.normalizeWhitespace(el.textContent || "");
      if (!text) continue;
      if (ownedSnacks.some((okText) => text.includes(okText))) continue;
      if (ERROR_TOAST_PATTERNS.test(text)) {
        return { found: true, text };
      }
    }
    return { found: false };
  }, "detectErrorToastOnPage");
  var detectOwnedOnPage = /* @__PURE__ */ __name((ctx) => {
    const { doc, utils } = ctx;
    const criteria = Config.OWNED_SUCCESS_CRITERIA;
    const snackbar = doc?.querySelector('.fabkit-Snackbar-root, div[class*="Toast-root"]');
    if (snackbar && criteria.snackbarText.some((t) => snackbar.textContent.includes(t))) {
      return { owned: true, reason: `Snackbar text "${snackbar.textContent}"` };
    }
    const allButtons = [...doc?.querySelectorAll(KEY_ELEMENT_SELECTOR) || []];
    const ownedButton = allButtons.find((btn) => criteria.buttonTexts.some((k) => btn.textContent.includes(k)));
    if (ownedButton) return { owned: true, reason: `Button text "${ownedButton.textContent}"` };
    const ownedBadge = allButtons.find((btn) => {
      const text = utils.normalizeWhitespace(btn.textContent || "");
      return OWNED_BADGE_TEXTS.includes(text);
    });
    if (ownedBadge) return { owned: true, reason: `Badge text "${ownedBadge.textContent}"` };
    return { owned: false };
  }, "detectOwnedOnPage");
  var visibleButtons = /* @__PURE__ */ __name((ctx) => {
    const { doc, win } = ctx;
    return [...doc?.querySelectorAll(ACTION_BUTTON_SELECTOR) || []].filter((btn) => {
      const text = (btn.textContent || "").trim();
      const style = win && win.getComputedStyle ? win.getComputedStyle(btn) : null;
      const isHidden = style && (style.display === "none" || style.visibility === "hidden");
      return text.length > 0 && !isHidden;
    });
  }, "visibleButtons");
  var logButtonDiagnostics = /* @__PURE__ */ __name((ctx, push) => {
    const allVisibleButtons = visibleButtons(ctx);
    const criticalKeywords = [
      ...Config.ACQUISITION_TEXT_SET,
      ...Config.FREE_TEXT_SET,
      "\u8BB8\u53EF",
      "License",
      "Select",
      "\u9009\u62E9",
      "Add",
      "\u6DFB\u52A0",
      "Library",
      "\u5E93"
    ];
    const criticalButtons = allVisibleButtons.filter((btn) => criticalKeywords.some((key) => (btn.textContent || "").includes(key)));
    push(`=== \u6309\u94AE\u68C0\u6D4B: \u53EF\u89C1=${allVisibleButtons.length}, \u5173\u952E=${criticalButtons.length} ===`);
    if (criticalButtons.length > 0) {
      criticalButtons.slice(0, 5).forEach((btn, i) => {
        push(`  \u5173\u952E\u6309\u94AE${i + 1}: "${(btn.textContent || "").trim().substring(0, 40)}"`);
      });
    } else if (allVisibleButtons.length > 0) {
      allVisibleButtons.slice(0, 3).forEach((btn, i) => {
        push(`  \u6309\u94AE${i + 1}: "${(btn.textContent || "").trim().substring(0, 40)}"`);
      });
    }
  }, "logButtonDiagnostics");
  var selectFreeLicense = /* @__PURE__ */ __name(async (ctx, push, isItemOwned) => {
    const licenseButton = visibleButtons(ctx).find((btn) => {
      const text = ctx.utils.normalizeWhitespace(btn.textContent || "");
      return text.includes("\u9009\u62E9\u8BB8\u53EF") || text.includes("Select license") || btn.getAttribute("aria-haspopup") === "true" && ctx.taskRunner?.isFreeCard?.(btn);
    });
    if (!licenseButton) return false;
    push("Multi-license item detected. Setting up observer for dropdown.");
    try {
      await new Promise((resolve, reject) => {
        const observer = new ctx.MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            for (const node of mutation.addedNodes || []) {
              if (node.nodeType !== 1) continue;
              const clickableParent = ctx.taskRunner?.findFreeLicenseOption?.(node);
              if (clickableParent) {
                push("Found explicit free license option, clicking it.");
                ctx.utils.deepClick(clickableParent);
                observer.disconnect();
                resolve();
                return;
              }
            }
          }
        });
        observer.observe(ctx.doc.body, { childList: true, subtree: true });
        push("Clicking license button to open dropdown.");
        ctx.utils.deepClick(licenseButton);
        const retryTimer = ctx.setTimeoutFn(() => {
          push("Second attempt to click license button.");
          ctx.utils.deepClick(licenseButton);
        }, 1500);
        ctx.setTimeoutFn(() => {
          ctx.clearTimeoutFn(retryTimer);
          observer.disconnect();
          reject(new Error("Timeout (5s): The free/personal option did not appear."));
        }, 5e3);
      });
      push("License selected, waiting for UI update.");
      await ctx.sleep(2e3);
      if (isItemOwned().owned) {
        push("Item became owned after license selection.");
        return true;
      }
    } catch (licenseError) {
      push(`License selection failed: ${licenseError.message}`);
    }
    return false;
  }, "selectFreeLicense");
  var findActionButton = /* @__PURE__ */ __name(async (ctx) => {
    const startAt = ctx.now();
    const maxWait = 8e3;
    while (ctx.now() - startAt < maxWait) {
      const freshButtons = visibleButtons(ctx);
      let actionButton = freshButtons.find((btn) => {
        const text = ctx.utils.normalizeWhitespace(btn.textContent || "").toLowerCase();
        return [...Config.ACQUISITION_TEXT_SET].some((keyword) => text.includes(keyword.toLowerCase()));
      });
      if (!actionButton) {
        actionButton = freshButtons.find((btn) => {
          const text = ctx.utils.normalizeWhitespace(btn.textContent || "");
          const hasFreeText = [...Config.FREE_TEXT_SET].some((freeWord) => text.includes(freeWord));
          const hasDiscount = /-\s*100\s*%\s*(?:OFF|折扣)?/i.test(text);
          const hasPersonal = text.includes("\u4E2A\u4EBA") || text.includes("Personal");
          return hasFreeText && hasDiscount && hasPersonal;
        });
      }
      if (!actionButton) {
        actionButton = freshButtons.find((btn) => {
          const text = (btn.textContent || "").toLowerCase();
          return text.includes("add") && text.includes("library") || text.includes("\u6DFB\u52A0") && text.includes("\u5E93");
        });
      }
      if (actionButton) return actionButton;
      await ctx.sleep(400);
    }
    return null;
  }, "findActionButton");
  var findCheckoutButton = /* @__PURE__ */ __name((ctx) => {
    const { doc, win, utils } = ctx;
    const allButtonsWithShadow = utils.findAllButtonsWithShadow(doc);
    const byClass = allButtonsWithShadow.find((btn) => btn.classList?.contains("payment-order-confirm__btn"));
    if (byClass) return byClass;
    return allButtonsWithShadow.find((btn) => {
      const text = utils.normalizeWhitespace(btn.textContent || "").toLowerCase();
      if (text.includes("buy now") || text.includes("\u7ACB\u5373\u8D2D\u4E70")) return false;
      const isCheckoutContext = btn.ownerDocument !== doc || Boolean(win?.location?.pathname?.includes("/payment/"));
      if (isCheckoutContext) {
        return text.includes("add to library") || text.includes("\u6DFB\u52A0\u5230\u5E93") || text.includes("add to account") || text.includes("\u6DFB\u52A0\u5230\u8D26\u6237");
      }
      return CHECKOUT_KEYWORDS.some((kw) => text.includes(kw));
    });
  }, "findCheckoutButton");
  var waitForOwnedAfterClick = /* @__PURE__ */ __name(async (ctx, push, isItemOwned) => {
    const timeout = 6e4;
    const startAt = ctx.now();
    return new Promise((resolve) => {
      let settled = false;
      let interval = null;
      const finish = /* @__PURE__ */ __name((ok) => {
        if (settled) return;
        settled = true;
        if (interval !== null) ctx.clearIntervalFn(interval);
        resolve(ok);
      }, "finish");
      interval = ctx.setIntervalFn(() => {
        const currentState = isItemOwned();
        if (currentState.owned) {
          push(`Successfully owned (UI Match: ${currentState.reason})`);
          finish(true);
          return;
        }
        if (isCaptchaPresent(ctx.doc)) {
          push("\u70B9\u51FB\u540E\u68C0\u6D4B\u5230\u4EBA\u673A\u9A8C\u8BC1\uFF0C\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\u9A8C\u8BC1");
          finish({ success: false, manualRequired: true });
          return;
        }
        const errorToast = detectErrorToastOnPage(ctx);
        if (errorToast.found) {
          push(`Fab \u670D\u52A1\u7AEF\u8FD4\u56DE\u9519\u8BEF\u63D0\u793A\uFF0C\u65E0\u6CD5\u5165\u5E93: ${errorToast.text}`);
          finish({ success: false, serverError: true });
          return;
        }
        const checkoutBtn = findCheckoutButton(ctx);
        if (checkoutBtn && !checkoutBtn.disabled) {
          const lastClickTime = parseInt(checkoutBtn.dataset?.lastClickTime || "0", 10);
          const nowMs = ctx.now();
          if (nowMs - lastClickTime > 2e3) {
            push(`Found checkout/place order button [${(checkoutBtn.textContent || "").trim()}], clicking it.`);
            checkoutBtn.dataset.lastClickTime = nowMs.toString();
            ctx.utils.deepClick(checkoutBtn);
          }
        }
        if (ctx.now() - startAt > timeout) {
          push(`Timeout waiting for ownership: Timeout waiting for page to enter an 'owned' state. (UI might be stuck)`);
          finish(false);
        }
      }, 500);
    });
  }, "waitForOwnedAfterClick");
  var acquireOnDetailPage = /* @__PURE__ */ __name(async (task, options = {}) => {
    const ctx = normalizeContext(options);
    const pushFn = options.log || noop;
    const logs = [];
    const push = /* @__PURE__ */ __name((msg) => {
      logs.push(msg);
      try {
        pushFn(msg);
      } catch (e) {
      }
    }, "push");
    ctx.log = push;
    let success = false;
    let manualRequired = false;
    let serverError = false;
    try {
      if (isCaptchaPresent(ctx.doc)) {
        push("\u68C0\u6D4B\u5230\u4EBA\u673A\u9A8C\u8BC1 / \u5B89\u5168\u68C0\u67E5\uFF0C\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\u9A8C\u8BC1");
        return { success: false, manualRequired: true, logs };
      }
      const pageReady = await waitForPageReady(ctx);
      if (!pageReady) {
        push("\u26A0\uFE0F \u8B66\u544A: \u9875\u9762\u53EF\u80FD\u672A\u5B8C\u5168\u52A0\u8F7D\uFF0C\u8FD9\u53EF\u80FD\u5BFC\u81F4\u64CD\u4F5C\u5931\u8D25");
      }
      if (isCaptchaPresent(ctx.doc)) {
        push("\u68C0\u6D4B\u5230\u4EBA\u673A\u9A8C\u8BC1 / \u5B89\u5168\u68C0\u67E5\uFF0C\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\u9A8C\u8BC1");
        return { success: false, manualRequired: true, logs };
      }
      await waitForKeyElement(ctx);
      await dismissAdultWarning(ctx);
      if (isCaptchaPresent(ctx.doc)) {
        push("\u68C0\u6D4B\u5230\u4EBA\u673A\u9A8C\u8BC1 / \u5B89\u5168\u68C0\u67E5\uFF0C\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\u9A8C\u8BC1");
        return { success: false, manualRequired: true, logs };
      }
      push("=== \u9875\u9762\u72B6\u6001\u8BCA\u65AD\u5F00\u59CB ===");
      try {
        const report = ctx.diagnostics.diagnoseDetailPage();
        push(`\u9875\u9762\u6807\u9898: ${report.pageTitle}`);
        push(`\u53EF\u89C1\u6309\u94AE\u6570\u91CF: ${report.buttons.filter((btn) => btn.isVisible).length}`);
      } catch (e) {
        push(`\u9875\u9762\u8BCA\u65AD\u5931\u8D25: ${e.message}`);
      }
      push("=== \u9875\u9762\u72B6\u6001\u8BCA\u65AD\u7ED3\u675F ===");
      success = await checkOwnedViaApi(ctx, task, push);
      if (!success) {
        const uiResult = await claimViaUi(ctx, push);
        if (typeof uiResult === "object") {
          success = Boolean(uiResult.success);
          manualRequired = Boolean(uiResult.manualRequired);
          serverError = Boolean(uiResult.serverError);
        } else {
          success = Boolean(uiResult);
        }
      }
      if (!success && isCaptchaPresent(ctx.doc)) {
        manualRequired = true;
        push("\u68C0\u6D4B\u5230\u4EBA\u673A\u9A8C\u8BC1 / \u5B89\u5168\u68C0\u67E5\uFF0C\u9700\u8981\u4EBA\u5DE5\u5B8C\u6210\u9A8C\u8BC1");
      }
    } catch (error) {
      push(`A critical error occurred: ${error.message}`);
      success = false;
    }
    return { success, manualRequired, serverError, logs };
  }, "acquireOnDetailPage");
  async function claimViaUi(ctx, push) {
    const isItemOwned = /* @__PURE__ */ __name(() => detectOwnedOnPage(ctx), "isItemOwned");
    const initialState = isItemOwned();
    if (initialState.owned) {
      push(`Item already owned on page load (UI Fallback PASS: ${initialState.reason}).`);
      return true;
    }
    const externalState = ctx.taskRunner?.getExternalProductState?.(ctx.doc) || { handled: false };
    if (externalState.handled) {
      push(`Detected non-purchasable external listing (${externalState.reason}). Marking task as handled.`);
      return true;
    }
    logButtonDiagnostics(ctx, push);
    if (await selectFreeLicense(ctx, push, isItemOwned)) return true;
    const actionButton = await findActionButton(ctx);
    if (!actionButton) {
      push("Could not find an add button.");
      return false;
    }
    push(`Found add button [${(actionButton.textContent || "").trim().substring(0, 30)}], clicking it.`);
    ctx.utils.deepClick(actionButton);
    return await waitForOwnedAfterClick(ctx, push, isItemOwned);
  }
  __name(claimViaUi, "claimViaUi");

  // src/modules/claim-strategy.js
  var CLAIM_RESULT = {
    SUCCESS: "success",
    FAILURE: "failure",
    SKIPPED: "skipped",
    // 主动跳过：付费 / 外部站 / 不可购买
    RATE_LIMITED: "rate_limited",
    // 撞上 429，需退避
    UNAVAILABLE: "unavailable"
    // 该策略不可用，应由 Executor 尝试下一个
  };
  var FAB_CLAIM_ENDPOINT = "https://www.fab.com/i/listings/{uid}/add-to-library";
  var FAB_LISTING_ENDPOINT = "https://www.fab.com/i/listings/{uid}";
  var multipartBody = /* @__PURE__ */ __name((fields, boundary = "----FabHelperFormBoundary") => {
    const lines = [];
    Object.keys(fields || {}).forEach((key) => {
      lines.push(`--${boundary}`);
      lines.push(`Content-Disposition: form-data; name="${key}"`);
      lines.push("");
      lines.push(String(fields[key]));
    });
    lines.push(`--${boundary}--`);
    lines.push("");
    return lines.join("\r\n");
  }, "multipartBody");
  var isTierFree = /* @__PURE__ */ __name((tier) => {
    if (!tier) return false;
    if (typeof tier === "number") return tier === 0;
    if (typeof tier === "object") {
      const effectivePrice = tier.discountedPrice ?? tier.price;
      if (typeof effectivePrice === "number" && Number(effectivePrice) === 0) return true;
      if (tier.effectiveDiscountPercentage === 100) return true;
    }
    return false;
  }, "isTierFree");
  var isLicenseFree = /* @__PURE__ */ __name((l) => {
    if (!l) return false;
    const offerId = l.offerId || l.offer_id;
    if (!offerId) return false;
    if (l.isCc0 === true) return true;
    if (isTierFree(l.priceTier)) return true;
    if (typeof l.price === "number" && l.price === 0) return true;
    if (typeof l.discountedPrice === "number" && l.discountedPrice === 0) return true;
    return false;
  }, "isLicenseFree");
  var pickFreeOfferId = /* @__PURE__ */ __name((listing) => {
    if (!listing) return null;
    const list = Array.isArray(listing.licenses) ? listing.licenses : [];
    const free = list.filter(isLicenseFree);
    if (free.length > 0) {
      const pro = free.find((l) => l.slug === "professional");
      const picked = pro || free[0];
      return picked.offerId || picked.offer_id;
    }
    const sp = listing.startingPrice;
    if (sp) {
      const offerId = sp.offerId || sp.offer_id;
      if (offerId && (isTierFree(sp) || sp.price === 0 || sp.discountedPrice === 0 || sp.effectiveDiscountPercentage === 100)) {
        return offerId;
      }
    }
    const topOfferId = listing.offerId || listing.offer_id;
    if (topOfferId && (listing.isFree === true || listing.price === 0 || listing.discountedPrice === 0)) {
      return topOfferId;
    }
    return null;
  }, "pickFreeOfferId");
  var parseRetryAfterMs = /* @__PURE__ */ __name((res) => {
    if (!res) return null;
    let raw = null;
    if (typeof res.getResponseHeader === "function") {
      raw = res.getResponseHeader("retry-after");
    }
    if (raw == null || raw === "") {
      const match = String(res.responseHeaders || "").match(/retry-after:\s*(\d+)/i);
      raw = match ? match[1] : null;
    }
    if (raw == null || raw === "") return null;
    const ms = Number(raw) * 1e3;
    return Number.isFinite(ms) ? ms : null;
  }, "parseRetryAfterMs");
  var classifyListingGetResponse = /* @__PURE__ */ __name((res) => {
    if (!res) {
      return { kind: "retryable", reason: "\u8BE6\u60C5\u63A5\u53E3\u65E0\u54CD\u5E94" };
    }
    const status = Number(res.status);
    const statusLabel = Number.isFinite(status) && status > 0 ? String(status) : "\u672A\u77E5\u72B6\u6001";
    if (status === 429) {
      return {
        kind: "rate_limited",
        reason: "\u8BE6\u60C5\u63A5\u53E3\u8FD4\u56DE 429",
        retryAfterMs: parseRetryAfterMs(res)
      };
    }
    if (status === 200) return { kind: "ok" };
    return { kind: "retryable", reason: `\u8BE6\u60C5\u63A5\u53E3\u8FD4\u56DE ${statusLabel}` };
  }, "classifyListingGetResponse");
  var ApiClaim = {
    name: "api",
    endpoint: FAB_CLAIM_ENDPOINT,
    method: "POST",
    boundary: "----FabHelperFormBoundary",
    buildBody: null,
    resolveOfferId: null,
    // 可注入：(task) => offerId | null
    fetchImpl: null,
    // 可注入，便于测试与替换传输层
    configure: /* @__PURE__ */ __name(({ endpoint, method, buildBody, resolveOfferId, fetchImpl, boundary } = {}) => {
      if (endpoint) ApiClaim.endpoint = endpoint;
      if (method) ApiClaim.method = method;
      if (boundary) ApiClaim.boundary = boundary;
      if (typeof buildBody === "function" || buildBody === null) ApiClaim.buildBody = buildBody;
      if (typeof resolveOfferId === "function" || resolveOfferId === null) ApiClaim.resolveOfferId = resolveOfferId;
      if (typeof fetchImpl === "function" || fetchImpl === null) ApiClaim.fetchImpl = fetchImpl;
    }, "configure"),
    isAvailable: /* @__PURE__ */ __name(() => Boolean(ApiClaim.endpoint) && typeof ApiClaim.fetchImpl === "function", "isAvailable"),
    /** 端点模板里的 {uid} 换成真实 uid。 */
    _url: /* @__PURE__ */ __name((task) => String(ApiClaim.endpoint).replace(/\{uid\}/g, encodeURIComponent(task && task.uid)), "_url"),
    _lastResolvedListing: null,
    /**
     * 解析 offer_id。
     * 快路径：搜索结果自带 startingPrice.offerId，而免费商品的最低价档就是
     * 免费档，可以直接用，省掉每件商品一次详情请求。
     * 慢路径：拿不到时才回源详情页，按免费 + 优先 professional 挑。
     */
    _resolveOfferId: /* @__PURE__ */ __name(async (task) => {
      ApiClaim._lastResolvedListing = null;
      if (typeof ApiClaim.resolveOfferId === "function") return ApiClaim.resolveOfferId(task);
      if (task && task.offerId) return task.offerId;
      let res;
      try {
        res = await ApiClaim.fetchImpl({
          method: "GET",
          url: String(FAB_LISTING_ENDPOINT).replace(/\{uid\}/g, encodeURIComponent(task && task.uid)),
          headers: { accept: "application/json" }
        });
      } catch (e) {
        const err = new Error(`\u89E3\u6790 offer_id \u5931\u8D25: ${e.message}`);
        err.retryable = true;
        throw err;
      }
      const classified = classifyListingGetResponse(res);
      if (classified.kind !== "ok") {
        const err = new Error(classified.reason);
        if (classified.kind === "rate_limited") {
          err.rateLimited = true;
          err.retryAfterMs = classified.retryAfterMs;
        } else {
          err.retryable = true;
        }
        throw err;
      }
      try {
        const listing = JSON.parse(res.responseText);
        ApiClaim._lastResolvedListing = listing;
        return pickFreeOfferId(listing);
      } catch (e) {
        const err = new Error(`\u89E3\u6790 offer_id \u5931\u8D25: ${e.message}`);
        err.retryable = true;
        throw err;
      }
    }, "_resolveOfferId"),
    claim: /* @__PURE__ */ __name(async (task) => {
      if (isConfirmedBundleTask(task)) {
        return { result: CLAIM_RESULT.UNAVAILABLE, reason: "Bundle \u9700\u8981\u5B98\u7F51\u96F6\u5143\u7ED3\u7B97\u6D41\u7A0B", retryable: false, isBundle: true };
      }
      if (!ApiClaim.isAvailable()) {
        return { result: CLAIM_RESULT.UNAVAILABLE, reason: "\u9886\u53D6\u7AEF\u70B9\u672A\u914D\u7F6E" };
      }
      const csrfToken = Utils.getCookie("fab_csrftoken");
      if (!csrfToken) {
        return {
          result: CLAIM_RESULT.FAILURE,
          reason: "\u7F3A\u5C11 CSRF token\uFF0C\u672A\u767B\u5F55\u6216\u4F1A\u8BDD\u5DF2\u5931\u6548",
          retryable: false
        };
      }
      let offerId = null;
      try {
        offerId = await ApiClaim._resolveOfferId(task);
      } catch (e) {
        if (e && e.rateLimited) {
          return {
            result: CLAIM_RESULT.RATE_LIMITED,
            reason: e.message || "\u8BE6\u60C5\u63A5\u53E3\u8FD4\u56DE 429",
            retryAfterMs: Number.isFinite(e.retryAfterMs) ? e.retryAfterMs : null
          };
        }
        return {
          result: CLAIM_RESULT.FAILURE,
          reason: e && e.message || "\u89E3\u6790 offer_id \u5931\u8D25",
          retryable: !e || e.retryable !== false
        };
      }
      const resolvedListing = ApiClaim._lastResolvedListing;
      if (resolvedListing && isConfirmedBundleTask(resolvedListing)) {
        return {
          result: CLAIM_RESULT.UNAVAILABLE,
          reason: "Bundle \u9700\u8981\u5B98\u7F51\u96F6\u5143\u7ED3\u7B97\u6D41\u7A0B",
          retryable: false,
          isBundle: true
        };
      }
      if (!offerId) {
        return {
          result: CLAIM_RESULT.FAILURE,
          reason: "\u672A\u627E\u5230\u514D\u8D39\u8BB8\u53EF\u7684 offer_id",
          retryable: false
        };
      }
      const built = typeof ApiClaim.buildBody === "function" ? ApiClaim.buildBody({ ...task, offerId }) : { offer_id: offerId };
      const isString = typeof built === "string";
      const body = isString ? built : built && typeof built.body === "string" ? built.body : multipartBody(built, ApiClaim.boundary);
      const contentType = !isString && built && built.contentType ? built.contentType : `multipart/form-data; boundary=${ApiClaim.boundary}`;
      let response;
      try {
        response = await ApiClaim.fetchImpl({
          method: ApiClaim.method,
          url: ApiClaim._url(task),
          headers: {
            "content-type": contentType,
            "x-csrftoken": csrfToken,
            "x-requested-with": "XMLHttpRequest"
          },
          data: body
        });
      } catch (e) {
        return { result: CLAIM_RESULT.FAILURE, reason: `\u8BF7\u6C42\u5F02\u5E38: ${e.message}`, retryable: true };
      }
      const status = response && response.status;
      if (status === 429) {
        const raw = response.getResponseHeader ? response.getResponseHeader("retry-after") : null;
        const retryAfterMs = raw ? Number(raw) * 1e3 : null;
        return {
          result: CLAIM_RESULT.RATE_LIMITED,
          reason: "\u63A5\u53E3\u8FD4\u56DE 429",
          retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : null
        };
      }
      if (status >= 200 && status < 300) return { result: CLAIM_RESULT.SUCCESS, reason: "" };
      if (status === 401) {
        return { result: CLAIM_RESULT.FAILURE, reason: "\u63A5\u53E3\u8FD4\u56DE 401\uFF0C\u672A\u767B\u5F55\u6216\u4F1A\u8BDD\u5DF2\u5931\u6548", retryable: false };
      }
      if (status === 403 || status === 404) {
        return { result: CLAIM_RESULT.FAILURE, reason: `\u63A5\u53E3\u8FD4\u56DE ${status}`, retryable: false };
      }
      if (status === 400) {
        return { result: CLAIM_RESULT.FAILURE, reason: "\u63A5\u53E3\u8FD4\u56DE 400\uFF0C\u8BF7\u6C42\u4F53\u53EF\u80FD\u88AB\u62D2\u7EDD", retryable: false };
      }
      if (status >= 500) {
        if (isFabInternalServerError(response)) {
          return {
            result: CLAIM_RESULT.FAILURE,
            reason: "\u63A5\u53E3\u8FD4\u56DE 500 (Fab \u670D\u52A1\u7AEF\u5185\u90E8\u9519\u8BEF)",
            retryable: true,
            status,
            serverInternalError: true
          };
        }
        return { result: CLAIM_RESULT.FAILURE, reason: `\u63A5\u53E3\u8FD4\u56DE ${status}`, retryable: true, status };
      }
      return {
        result: CLAIM_RESULT.FAILURE,
        reason: `\u63A5\u53E3\u8FD4\u56DE ${status || "\u672A\u77E5\u72B6\u6001"}`,
        retryable: false
      };
    }, "claim")
  };
  var isFabInternalServerError = /* @__PURE__ */ __name((response) => {
    if (!response || Number(response.status) !== 500) return false;
    const text = String(response.responseText || "").trim();
    if (!text) return false;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.detail === "string" && /internal error/i.test(parsed.detail)) {
        return true;
      }
    } catch (_e) {
    }
    return /"detail"\s*:\s*"Internal error"/i.test(text);
  }, "isFabInternalServerError");

  // src/modules/verification-notifications.js
  var VerificationNotifications = {
    sent: /* @__PURE__ */ new Set(),
    permission: /* @__PURE__ */ __name(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission, "permission"),
    enableAndTest: /* @__PURE__ */ __name(async (lang = "zh") => {
      if (typeof Notification === "undefined") return "unsupported";
      try {
        const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
        if (permission === "granted") {
          VerificationNotifications.show({ lang, test: true });
        }
        return permission;
      } catch {
        return "unavailable";
      }
    }, "enableAndTest"),
    show: /* @__PURE__ */ __name(({ task, workerId, lang = "zh", test = false, win = globalThis.window } = {}) => {
      if (VerificationNotifications.permission() !== "granted") return false;
      const key = workerId || task?.uid;
      if (!test && key && VerificationNotifications.sent.has(key)) return false;
      const zh2 = lang === "zh";
      try {
        const notification = new Notification(
          test ? zh2 ? "Fab Helper\uFF1A\u901A\u77E5\u5DF2\u5F00\u542F" : "Fab Helper: notifications enabled" : zh2 ? "Fab Helper\uFF1A\u9700\u8981\u624B\u52A8\u9A8C\u8BC1" : "Fab Helper: verification needed",
          {
            body: test ? zh2 ? "\u9047\u5230\u4EBA\u673A\u9A8C\u8BC1\u65F6\u4F1A\u5728\u6B64\u63D0\u9192\u60A8\u3002" : "You will be notified when manual verification is needed." : `${task?.name || "Fab"}
${zh2 ? "\u8BF7\u5207\u6362\u5230\u6807\u9898\u542B\u3010\u9700\u9A8C\u8BC1\u3011\u7684\u6807\u7B7E\u9875\uFF0C\u624B\u52A8\u5B8C\u6210\u9A8C\u8BC1\uFF0C\u518D\u56DE\u4E3B\u9762\u677F\u7EE7\u7EED\u3002" : "The verification tab is kept open. Complete it manually, then resume from the main panel."}`,
            tag: test ? "fab-helper-notification-test" : `fab-helper-verify-${key || Date.now()}`,
            requireInteraction: !test
          }
        );
        notification.onclick = () => {
          try {
            win?.focus();
          } catch {
          }
          notification.close();
        };
        if (!test && key) {
          VerificationNotifications.sent.add(key);
          if (VerificationNotifications.sent.size > 100) {
            VerificationNotifications.sent.delete(VerificationNotifications.sent.values().next().value);
          }
        }
        return true;
      } catch {
        return false;
      }
    }, "show")
  };

  // src/modules/listing-source.js
  var SEARCH_PATH = "/i/listings/search";
  var _SearchError = class _SearchError extends Error {
    constructor(message, { status = 0, retryAfterMs = null, url = "" } = {}) {
      super(message);
      this.name = "SearchError";
      this.status = status;
      this.retryAfterMs = retryAfterMs;
      this.url = url;
    }
  };
  __name(_SearchError, "SearchError");
  var SearchError = _SearchError;
  var FREE_POLICY = {
    // 只认服务端 isFree 标记。会漏掉 Personal/Professional 的 $0 商品。
    FLAG_ONLY: "flag_only",
    // 只认有效价格为 0。
    PRICE_ONLY: "price_only",
    // 并集：两者任一命中即视为可领取。与现行 DOM 判据行为最接近，默认采用。
    FLAG_OR_PRICE: "flag_or_price"
  };
  var ListingSource = {
    deps: {
      // (url, { headers }) => Promise<{ status, responseText } | Response>
      fetchImpl: null,
      // 覆盖 URL 构造（测试或特殊页面用）
      buildUrl: null,
      // 覆盖基础查询参数，默认取下方 baseParams
      getBaseParams: null,
      // 覆盖请求头（默认带 cookie + csrf）
      getHeaders: null
    },
    // 与抓包原文一致。若用户改了页面筛选条件，上层应覆盖 getBaseParams。
    // 默认按首次发布时间倒序（-firstPublishedAt），与用户在页面上的实际筛选一致：
    // 新发布的免费商品排在最前，便于增量领取（连续遇到已拥有即可停止）。
    baseParams: { is_free: "1", sort_by: "-firstPublishedAt" },
    freePolicy: FREE_POLICY.FLAG_OR_PRICE,
    // 观测计数
    stats: { pagesFetched: 0, itemsSeen: 0, malformedPages: 0 },
    configure: /* @__PURE__ */ __name(({ fetchImpl, buildUrl, getBaseParams, getHeaders, baseParams, freePolicy } = {}) => {
      if (typeof fetchImpl === "function" || fetchImpl === null) ListingSource.deps.fetchImpl = fetchImpl;
      if (typeof buildUrl === "function" || buildUrl === null) ListingSource.deps.buildUrl = buildUrl;
      if (typeof getBaseParams === "function" || getBaseParams === null) ListingSource.deps.getBaseParams = getBaseParams;
      if (typeof getHeaders === "function" || getHeaders === null) ListingSource.deps.getHeaders = getHeaders;
      if (baseParams && typeof baseParams === "object") ListingSource.baseParams = { ...baseParams };
      if (freePolicy) ListingSource.freePolicy = freePolicy;
    }, "configure"),
    reset: /* @__PURE__ */ __name(() => {
      ListingSource.stats = { pagesFetched: 0, itemsSeen: 0, malformedPages: 0 };
    }, "reset"),
    /**
     * 折算实际应付价格：有折扣价时以折扣价为准。
     * 返回 null 表示「价格未知」——未知绝不等于免费。
     */
    effectivePrice: /* @__PURE__ */ __name((item) => {
      if (!item) return null;
      if (Number.isFinite(item.discountedPrice)) return item.discountedPrice;
      if (Number.isFinite(item.price)) return item.price;
      return null;
    }, "effectivePrice"),
    /**
     * 是否可领取（免费）。判据随策略而变，见 FREE_POLICY 注释。
     * 注意：本方法只回答「是否免费」，不回答「是否已入库」——后者由事件日志负责。
     */
    isClaimable: /* @__PURE__ */ __name((item) => {
      if (!item || !item.uid) return false;
      const price = ListingSource.effectivePrice(item);
      switch (ListingSource.freePolicy) {
        case FREE_POLICY.FLAG_ONLY:
          return item.isFreeFlag === true;
        case FREE_POLICY.PRICE_ONLY:
          return price === 0;
        case FREE_POLICY.FLAG_OR_PRICE:
        default:
          return item.isFreeFlag === true || price === 0 || item.effectiveDiscountPercentage === 100;
      }
    }, "isClaimable"),
    /**
     * 单个商品 JSON → 规范化任务对象。
     * 字段缺失一律降级为空值而不是抛错：Fab 的响应允许大量字段为 null，
     * 一条脏数据不该让整页作废。
     */
    normalize: /* @__PURE__ */ __name((raw) => {
      if (!raw || typeof raw !== "object" || !raw.uid) return null;
      const uid = String(raw.uid).trim().toLowerCase();
      if (!uid) return null;
      const sp = raw.startingPrice && typeof raw.startingPrice === "object" ? raw.startingPrice : {};
      const numOrNull = /* @__PURE__ */ __name((v) => typeof v === "number" && Number.isFinite(v) ? v : null, "numOrNull");
      const licenses = Array.isArray(raw.licenses) ? raw.licenses : [];
      const offerIds = [];
      const pushOffer = /* @__PURE__ */ __name((v) => {
        if (typeof v === "string" && v && !offerIds.includes(v)) offerIds.push(v);
      }, "pushOffer");
      pushOffer(sp.offerId);
      pushOffer(raw.offerId);
      licenses.forEach((l) => pushOffer(l && l.offerId));
      const rawPublishedAt = raw.firstPublishedAt || raw.publishedAt;
      const parsedTs = rawPublishedAt ? Date.parse(String(rawPublishedAt)) : NaN;
      return {
        uid,
        url: `https://www.fab.com/${raw.listingType === "bundle" ? "bundles" : "listings"}/${uid}`,
        name: typeof raw.title === "string" ? raw.title : "",
        offerId: offerIds[0] || "",
        offerIds,
        price: numOrNull(sp.price),
        discountedPrice: numOrNull(sp.discountedPrice),
        effectiveDiscountPercentage: numOrNull(sp.effectiveDiscountPercentage),
        currency: typeof sp.currencyCode === "string" ? sp.currencyCode : "",
        isFreeFlag: raw.isFree === true,
        isDiscounted: raw.isDiscounted === true,
        publishedAtMs: Number.isFinite(parsedTs) ? parsedTs : null,
        licenses: licenses.map((l) => ({
          name: l && typeof l.name === "string" ? l.name : "",
          isCc0: !!(l && l.isCc0),
          uid: l && l.uid ? String(l.uid) : ""
        })),
        listingType: typeof raw.listingType === "string" ? raw.listingType : "",
        seller: raw.user && typeof raw.user.sellerName === "string" ? raw.user.sellerName : ""
      };
    }, "normalize"),
    /**
     * 从完整 URL 中抠出 cursor 参数。
     * 响应里 cursors.next 与顶层 next 同时存在，优先用前者；
     * 但当 cursors 缺失时，这是唯一的翻页依据。
     */
    _cursorFromUrl: /* @__PURE__ */ __name((url) => {
      try {
        const u = new URL(String(url), "https://www.fab.com");
        return u.searchParams.get("cursor");
      } catch (e) {
        return null;
      }
    }, "_cursorFromUrl"),
    /**
     * 解析一页响应。
     * 「是否到底」的唯一权威信号是 cursors.next === null —— 与 index.js 中
     * State.isEndOfSearchList 的判定口径保持一致，不靠本地猜。
     */
    parsePage: /* @__PURE__ */ __name((payload) => {
      if (!payload || typeof payload !== "object") {
        ListingSource.stats.malformedPages += 1;
        return { items: [], nextCursor: null, isEnd: true, malformed: true };
      }
      const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload.results) ? payload.results : [];
      const items = rawItems.map(ListingSource.normalize).filter(Boolean);
      ListingSource.stats.itemsSeen += items.length;
      let nextCursor = null;
      if (payload.cursors && payload.cursors.next != null) {
        nextCursor = String(payload.cursors.next);
      } else if (payload.next != null) {
        nextCursor = ListingSource._cursorFromUrl(payload.next);
      }
      return {
        items,
        nextCursor: nextCursor || null,
        isEnd: !nextCursor,
        malformed: false
      };
    }, "parsePage"),
    /** 构造搜索 URL。cursor 为 null 时即为首页。 */
    buildUrl: /* @__PURE__ */ __name((cursor = null) => {
      const getBase = ListingSource.deps.getBaseParams;
      const base = typeof getBase === "function" ? getBase() || {} : ListingSource.baseParams || {};
      const params = new URLSearchParams();
      Object.keys(base).forEach((k) => {
        const v = base[k];
        if (v !== null && v !== void 0 && v !== "") params.set(k, String(v));
      });
      if (cursor) params.set("cursor", cursor);
      return `https://www.fab.com${SEARCH_PATH}?${params.toString()}`;
    }, "buildUrl"),
    _defaultHeaders: /* @__PURE__ */ __name(() => {
      const headers = { "x-requested-with": "XMLHttpRequest", "accept": "application/json" };
      try {
        const token = Utils.getCookie("fab_csrftoken");
        if (token) headers["x-csrftoken"] = token;
      } catch (e) {
      }
      return headers;
    }, "_defaultHeaders"),
    /** Retry-After 优先取调用方给的毫秒数，其次解析响应头（秒 → 毫秒）。 */
    _parseRetryAfter: /* @__PURE__ */ __name((res) => {
      if (!res) return null;
      if (Number.isFinite(res.retryAfterMs)) return res.retryAfterMs;
      const match = String(res.responseHeaders || "").match(/retry-after:\s*(\d+)/i);
      return match ? Number(match[1]) * 1e3 : null;
    }, "_parseRetryAfter"),
    /**
     * 拉取一页。失败抛 SearchError，由上层决定退避还是终止。
     * 这里刻意不做重试 —— 重试节奏属于流水线与限速器的职责，
     * 在每一层都加退避会导致实际等待时间成倍叠加。
     */
    fetchPage: /* @__PURE__ */ __name(async (cursor = null) => {
      const fetchImpl = ListingSource.deps.fetchImpl;
      if (typeof fetchImpl !== "function") {
        throw new SearchError("\u672A\u914D\u7F6E fetchImpl", { status: 0 });
      }
      const buildUrl = ListingSource.deps.buildUrl || ListingSource.buildUrl;
      const url = buildUrl(cursor);
      const getHeaders = ListingSource.deps.getHeaders || ListingSource._defaultHeaders;
      const res = await fetchImpl(url, { headers: getHeaders() });
      if (!res) throw new SearchError("\u641C\u7D22\u63A5\u53E3\u65E0\u54CD\u5E94", { status: 0, url });
      const status = Number(res.status) || 0;
      if (status === 429) {
        throw new SearchError("\u641C\u7D22\u63A5\u53E3\u9650\u901F", {
          status,
          retryAfterMs: ListingSource._parseRetryAfter(res),
          url
        });
      }
      if (status < 200 || status >= 300) {
        throw new SearchError(`\u641C\u7D22\u63A5\u53E3\u8FD4\u56DE ${status}`, { status, url });
      }
      let text = res.responseText;
      if (text === void 0 && typeof res.text === "function") text = await res.text();
      let payload = null;
      try {
        payload = JSON.parse(text == null ? "" : text);
      } catch (e) {
        throw new SearchError("\u641C\u7D22\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON", { status, url });
      }
      const page = ListingSource.parsePage(payload);
      ListingSource.stats.pagesFetched += 1;
      return { ...page, url };
    }, "fetchPage")
  };

  // src/modules/fast-scanner.js
  var DAY_MS = 24 * 60 * 60 * 1e3;
  var SEARCH_PATH2 = "/i/listings/search";
  var STATES_PATH = "/i/users/me/listings-states";
  var STATES_MAX_IDS = 24;
  var CHECKPOINT_INTERVAL_MS = 5e3;
  var OVERLAP_MS = 1e3;
  var defaultSleep = /* @__PURE__ */ __name((ms) => new Promise((resolve) => setTimeout(resolve, ms)), "defaultSleep");
  var encodeBase64 = /* @__PURE__ */ __name((text) => {
    if (typeof btoa === "function") return btoa(text);
    if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64");
    throw new Error("Base64 encoder unavailable");
  }, "encodeBase64");
  var decodeBase64 = /* @__PURE__ */ __name((encoded) => {
    if (typeof atob === "function") return atob(encoded);
    if (typeof Buffer !== "undefined") return Buffer.from(encoded, "base64").toString("utf8");
    throw new Error("Base64 decoder unavailable");
  }, "decodeBase64");
  var formatPlus0000Iso = /* @__PURE__ */ __name((ms) => {
    const iso = new Date(ms).toISOString();
    return iso.replace(/Z$/, "+00:00");
  }, "formatPlus0000Iso");
  var parseHeaderValue = /* @__PURE__ */ __name((res, name) => {
    if (!res) return null;
    if (typeof res.getResponseHeader === "function") {
      const val = res.getResponseHeader(name);
      if (val != null && val !== "") return val;
    }
    if (res.headers && typeof res.headers.get === "function") {
      const val = res.headers.get(name);
      if (val != null && val !== "") return val;
    }
    const rawHeaders = String(res.responseHeaders || "");
    if (!rawHeaders) return null;
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = rawHeaders.match(new RegExp(`^${escaped}:\\s*(.+)$`, "im"));
    return match ? match[1].trim() : null;
  }, "parseHeaderValue");
  var parseRetryAfterMs2 = /* @__PURE__ */ __name((res) => {
    if (!res) return null;
    if (Number.isFinite(res.retryAfterMs)) return res.retryAfterMs;
    const raw = parseHeaderValue(res, "retry-after");
    if (raw == null || raw === "") return null;
    const sec = Number(raw);
    if (Number.isFinite(sec) && sec >= 0) return sec * 1e3;
    const ts = Date.parse(raw);
    if (Number.isFinite(ts)) return Math.max(0, ts - Date.now());
    return null;
  }, "parseRetryAfterMs");
  var extractSearchParamsFromUrl = /* @__PURE__ */ __name((href) => {
    const ignored = /* @__PURE__ */ new Set(["lang", "cursor", "workerId", "fab_claim_frame"]);
    const params = {};
    try {
      const u = new URL(
        href || "https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt",
        "https://www.fab.com"
      );
      const keys = [];
      for (const k of u.searchParams.keys()) {
        if (ignored.has(k) || keys.includes(k)) continue;
        keys.push(k);
      }
      for (const k of keys) {
        const values = u.searchParams.getAll(k).filter((v) => v !== "");
        if (values.length === 0) continue;
        params[k] = values.length > 1 ? values : values[0];
      }
    } catch (_e) {
    }
    if (Object.keys(params).length === 0) {
      return { is_free: "1", sort_by: "-firstPublishedAt" };
    }
    return params;
  }, "extractSearchParamsFromUrl");
  var buildQueryKey = /* @__PURE__ */ __name((params = {}) => {
    const parts = [];
    Object.keys(params || {}).sort().forEach((k) => {
      const v = params[k];
      if (v === null || v === void 0 || v === "") return;
      if (Array.isArray(v)) {
        [...v].map(String).sort().forEach((item) => {
          parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(item)}`);
        });
      } else {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    });
    return parts.join("&");
  }, "buildQueryKey");
  var encodeTimeCursor = /* @__PURE__ */ __name((isoOrMs) => {
    let ms;
    if (typeof isoOrMs === "number") {
      ms = isoOrMs;
    } else if (isoOrMs instanceof Date) {
      ms = isoOrMs.getTime();
    } else {
      ms = Date.parse(String(isoOrMs));
    }
    if (!Number.isFinite(ms)) {
      throw new Error(`Invalid timestamp for cursor: ${isoOrMs}`);
    }
    const formatted = formatPlus0000Iso(ms);
    return encodeBase64(`o=0&p=${encodeURIComponent(formatted)}`);
  }, "encodeTimeCursor");
  var decodeTimeCursorMs = /* @__PURE__ */ __name((cursor) => {
    if (!cursor || typeof cursor !== "string") return null;
    try {
      const decoded = decodeBase64(cursor);
      const match = decoded.match(/(?:^|&)p=([^&]+)/);
      if (!match || !match[1]) return null;
      const val = decodeURIComponent(match[1].replace(/\+/g, " "));
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return null;
      const ts = Date.parse(val);
      return Number.isFinite(ts) ? ts : null;
    } catch (_e) {
      return null;
    }
  }, "decodeTimeCursorMs");
  var buildTimeSlices = /* @__PURE__ */ __name((newestMs, oldestMs, concurrency = 4, initialNextCursor = null) => {
    if (!Number.isFinite(newestMs) || !Number.isFinite(oldestMs) || newestMs <= oldestMs) {
      return [{
        id: "time-0",
        extraParams: null,
        upperMs: Number.isFinite(newestMs) ? newestMs : null,
        lowerMs: null,
        cursor: initialNextCursor || null,
        done: false,
        pages: 0
      }];
    }
    const minSlices = Math.max(12, Math.max(1, Number(concurrency) || 4) * 3);
    const totalSpan = newestMs - oldestMs;
    if (totalSpan < minSlices * 6e4) {
      return [{
        id: "time-0",
        extraParams: null,
        upperMs: newestMs,
        lowerMs: null,
        cursor: initialNextCursor || null,
        done: false,
        pages: 0
      }];
    }
    const recentWindowMs = 912 * DAY_MS;
    const recentFloorMs = Math.max(oldestMs, newestMs - recentWindowMs);
    const boundaries = [newestMs];
    if (recentFloorMs > oldestMs && totalSpan > 120 * DAY_MS) {
      const recentSpan = newestMs - recentFloorMs;
      const olderSpan = recentFloorMs - oldestMs;
      const recentCount = Math.max(8, Math.ceil(minSlices * 0.7));
      const olderCount = Math.max(4, minSlices - recentCount);
      const recentStep = Math.max(6e4, Math.floor(recentSpan / recentCount));
      for (let i = 1; i < recentCount; i++) {
        boundaries.push(newestMs - i * recentStep);
      }
      boundaries.push(recentFloorMs);
      const olderStep = Math.max(6e4, Math.floor(olderSpan / olderCount));
      for (let i = 1; i < olderCount; i++) {
        const b = recentFloorMs - i * olderStep;
        if (b > oldestMs + 6e4) boundaries.push(b);
      }
    } else {
      const step = Math.max(6e4, Math.floor(totalSpan / minSlices));
      for (let i = 1; i < minSlices; i++) {
        const b = newestMs - i * step;
        if (b > oldestMs + 6e4) boundaries.push(b);
      }
    }
    const unique = [];
    for (const b of boundaries) {
      if (unique.length === 0 || b < unique[unique.length - 1] - 1e3) {
        unique.push(b);
      }
    }
    const slices = [];
    for (let i = 0; i < unique.length; i++) {
      const upperMs = unique[i];
      const lowerMs = i === unique.length - 1 ? null : unique[i + 1];
      const cursor = i === 0 ? initialNextCursor || null : encodeTimeCursor(upperMs);
      slices.push({
        id: `time-${i}`,
        extraParams: null,
        upperMs,
        lowerMs,
        cursor,
        done: false,
        pages: 0
      });
    }
    return slices;
  }, "buildTimeSlices");
  var defaultFetchPageImpl = /* @__PURE__ */ __name(async (url, { headers, rawFetch } = {}) => {
    const fetchFn = typeof rawFetch === "function" ? rawFetch : typeof window !== "undefined" && typeof window.fetch === "function" ? window.fetch.bind(window) : null;
    if (fetchFn) {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 3e4) : null;
      try {
        const res2 = await fetchFn(url, {
          method: "GET",
          credentials: "include",
          headers: { accept: "application/json", ...headers || {} },
          ...controller ? { signal: controller.signal } : {}
        });
        const responseText = await res2.text();
        return {
          status: res2.status,
          responseText,
          getResponseHeader: /* @__PURE__ */ __name((name) => res2.headers?.get?.(name) ?? null, "getResponseHeader")
        };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    const res = await API.gmFetch({
      method: "GET",
      url,
      timeout: 3e4,
      headers: { accept: "application/json", ...headers || {} }
    });
    return {
      status: res.status,
      responseText: res.responseText,
      responseHeaders: res.responseHeaders
    };
  }, "defaultFetchPageImpl");
  var createFastScanner = /* @__PURE__ */ __name((deps = {}) => {
    const getDatabase = /* @__PURE__ */ __name(() => deps.database || Database, "getDatabase");
    const getApiClaim = /* @__PURE__ */ __name(() => deps.apiClaim || ApiClaim, "getApiClaim");
    const getListingSource = /* @__PURE__ */ __name(() => deps.listingSource || ListingSource, "getListingSource");
    const getDataCache = /* @__PURE__ */ __name(() => deps.dataCache || DataCache, "getDataCache");
    const getState = /* @__PURE__ */ __name(() => deps.state || State, "getState");
    const getConfig = /* @__PURE__ */ __name(() => deps.config || Config, "getConfig");
    const getUtils = /* @__PURE__ */ __name(() => deps.utils || Utils, "getUtils");
    const sleep = deps.sleep || defaultSleep;
    const nowFn = deps.now || (() => Date.now());
    const getHref = deps.getHref || (() => typeof window !== "undefined" && window.location ? window.location.href : "https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt");
    const getHeaders = deps.getHeaders || (() => ListingSource._defaultHeaders());
    let onUiUpdate = deps.onUiUpdate || (() => {
    });
    let onToast = deps.onToast || (() => {
    });
    let onAuthFailure = deps.onAuthFailure || (() => {
    });
    let onItemClaimed = deps.onItemClaimed || (() => {
    });
    const onRecordNetwork = deps.onRecordNetwork || (() => {
      try {
        if (typeof window !== "undefined" && typeof window.recordNetworkActivity === "function") {
          window.recordNetworkActivity();
        }
      } catch (_e) {
      }
    });
    let enqueueFallbackFn = deps.enqueueWorkerFallback || null;
    const gmGet = deps.gmGetValue || ((k, def) => typeof GM_getValue === "function" ? GM_getValue(k, def) : Promise.resolve(def));
    const gmSet = deps.gmSetValue || ((k, v) => typeof GM_setValue === "function" ? GM_setValue(k, v) : Promise.resolve());
    const gmDelete = deps.gmDeleteValue || ((k) => typeof GM_deleteValue === "function" ? GM_deleteValue(k) : Promise.resolve());
    const claimIntervalMs = Number.isFinite(deps.claimIntervalMs) ? deps.claimIntervalMs : 400;
    const rateLimitBaseBackoffMs = Number.isFinite(deps.rateLimitBaseBackoffMs) ? deps.rateLimitBaseBackoffMs : 15e3;
    const checkpointIntervalMs = Number.isFinite(deps.checkpointIntervalMs) ? deps.checkpointIntervalMs : CHECKPOINT_INTERVAL_MS;
    const claimWorkersCount = Number.isFinite(deps.claimWorkers) ? Math.max(1, deps.claimWorkers) : 2;
    const uiThrottleMs = Number.isFinite(deps.uiThrottleMs) ? deps.uiThrottleMs : 200;
    const unknownFlushDelayMs = Number.isFinite(deps.unknownFlushDelayMs) ? Math.max(0, deps.unknownFlushDelayMs) : 300;
    const quickHeadPages = Number.isFinite(deps.quickHeadPages) ? Math.max(0, Math.floor(deps.quickHeadPages)) : 3;
    const quickDiscountedMaxPages = Number.isFinite(deps.quickDiscountedMaxPages) ? Math.max(0, Math.floor(deps.quickDiscountedMaxPages)) : 10;
    let running = false;
    let stopped = false;
    let hardStopped = false;
    let drainingBeforeStop = false;
    let authAborted = false;
    let earlyStopped = false;
    let calibratedDescPrefetched = false;
    let activeRunPromise = null;
    let unknownFlushTimer = null;
    let configuredConcurrency = 4;
    let activeConcurrency = 4;
    let pauseUntil = 0;
    let penaltyCount = 0;
    let extraDelayMs = 0;
    let cleanStreak = 0;
    let currentQueryKey = "";
    let currentBaseParams = {};
    let currentHeadUpperMs = null;
    let resumedFromCheckpoint = false;
    let currentMode = "sequential";
    let currentSlices = [];
    let currentStats = null;
    let seenUids = /* @__PURE__ */ new Set();
    let unknownBuffer = [];
    let inFlightStateChunks = /* @__PURE__ */ new Set();
    let statesFlushChain = Promise.resolve();
    let claimQueue = [];
    let inFlightClaimTasks = /* @__PURE__ */ new Set();
    let claimWaiters = [];
    let activeClaimsInFlight = 0;
    let lastClaimAt = 0;
    let slowPathLock = Promise.resolve();
    let consecutiveOwnedPages = 0;
    let lastUiAt = 0;
    let lastCheckpointAt = 0;
    let currentPhase = "idle";
    let workerSlotWaiters = [];
    const sightClaimSet = /* @__PURE__ */ new Set();
    let sightClaimInFlightCount = 0;
    let sightClaimChain = Promise.resolve();
    const notifyItemClaimed = /* @__PURE__ */ __name((item, source = "claimed") => {
      try {
        onItemClaimed(item, source);
      } catch (_e) {
      }
    }, "notifyItemClaimed");
    const wakeWorkerSlots = /* @__PURE__ */ __name(() => {
      while (workerSlotWaiters.length > 0) {
        const resolve = workerSlotWaiters.shift();
        resolve();
      }
    }, "wakeWorkerSlots");
    const noteHeadTimestamp = /* @__PURE__ */ __name((ms) => {
      if (Number.isFinite(ms)) {
        currentHeadUpperMs = currentHeadUpperMs == null ? ms : Math.max(currentHeadUpperMs, ms);
      }
    }, "noteHeadTimestamp");
    const clearUnknownFlushTimer = /* @__PURE__ */ __name(() => {
      if (unknownFlushTimer !== null) {
        clearTimeout(unknownFlushTimer);
        unknownFlushTimer = null;
      }
    }, "clearUnknownFlushTimer");
    const isClaimAborted = /* @__PURE__ */ __name(() => hardStopped || authAborted || stopped && !drainingBeforeStop, "isClaimAborted");
    const resetRunVars = /* @__PURE__ */ __name(() => {
      clearUnknownFlushTimer();
      stopped = false;
      hardStopped = false;
      drainingBeforeStop = false;
      authAborted = false;
      earlyStopped = false;
      calibratedDescPrefetched = false;
      pauseUntil = 0;
      penaltyCount = 0;
      extraDelayMs = 0;
      cleanStreak = 0;
      currentQueryKey = "";
      currentBaseParams = {};
      currentHeadUpperMs = null;
      resumedFromCheckpoint = false;
      currentMode = "sequential";
      currentSlices = [];
      seenUids = /* @__PURE__ */ new Set();
      unknownBuffer = [];
      inFlightStateChunks = /* @__PURE__ */ new Set();
      statesFlushChain = Promise.resolve();
      claimQueue = [];
      inFlightClaimTasks = /* @__PURE__ */ new Set();
      claimWaiters = [];
      activeClaimsInFlight = 0;
      lastClaimAt = 0;
      slowPathLock = Promise.resolve();
      consecutiveOwnedPages = 0;
      lastUiAt = 0;
      lastCheckpointAt = 0;
      currentPhase = "idle";
      workerSlotWaiters = [];
      currentStats = {
        pagesFetched: 0,
        itemsScanned: 0,
        totalEstimated: 0,
        skippedLocal: 0,
        skippedNonFree: 0,
        skippedFailed: 0,
        confirmedOwnedServer: 0,
        claimedDirect: 0,
        queuedFallback: 0,
        failed: 0,
        pageErrors: 0,
        failedSlices: 0,
        startedAt: nowFn(),
        finishedAt: null
      };
    }, "resetRunVars");
    resetRunVars();
    const doFetch = /* @__PURE__ */ __name(async (url) => {
      onRecordNetwork();
      const headers = getHeaders();
      if (typeof deps.fetchImpl === "function") {
        return deps.fetchImpl(url, { headers });
      }
      const rawFetch = getState().nativeFetch || null;
      return defaultFetchPageImpl(url, { headers, rawFetch });
    }, "doFetch");
    const buildSnapshot = /* @__PURE__ */ __name(() => {
      const now = nowFn();
      const elapsedSec = Math.max(1e-3, ((currentStats.finishedAt || now) - currentStats.startedAt) / 1e3);
      const inFlightStateCount = Array.from(inFlightStateChunks).reduce((sum, chunk) => sum + chunk.length, 0);
      const pendingCount = unknownBuffer.length + inFlightStateCount + claimQueue.length + activeClaimsInFlight + sightClaimInFlightCount;
      return {
        running,
        phase: currentPhase,
        mode: currentMode,
        configuredConcurrency,
        activeConcurrency,
        pagesFetched: currentStats.pagesFetched,
        itemsScanned: currentStats.itemsScanned,
        totalEstimated: currentStats.totalEstimated,
        itemsPerSec: Math.round(currentStats.itemsScanned / elapsedSec),
        pendingCount,
        skippedLocal: currentStats.skippedLocal,
        skippedNonFree: currentStats.skippedNonFree,
        skippedFailed: currentStats.skippedFailed,
        confirmedOwnedServer: currentStats.confirmedOwnedServer,
        claimedDirect: currentStats.claimedDirect,
        queuedFallback: currentStats.queuedFallback,
        failed: currentStats.failed,
        pageErrors: currentStats.pageErrors,
        incompleteSlices: currentSlices.filter((s) => !s.done).length,
        resumedFromCheckpoint,
        consecutiveOwnedPages,
        earlyStopped,
        rateLimitedUntil: pauseUntil > now ? pauseUntil : 0,
        startedAt: currentStats.startedAt,
        finishedAt: currentStats.finishedAt
      };
    }, "buildSnapshot");
    const syncStatus = /* @__PURE__ */ __name((force = false) => {
      const now = nowFn();
      getState().fastScanStatus = buildSnapshot();
      if (force || now - lastUiAt >= uiThrottleMs) {
        lastUiAt = now;
        try {
          onUiUpdate(getState().fastScanStatus);
        } catch (_e) {
        }
      }
    }, "syncStatus");
    const logMsg = /* @__PURE__ */ __name((level, msg) => {
      try {
        getUtils().logger(level, msg);
      } catch (_e) {
      }
    }, "logMsg");
    const waitRateGate = /* @__PURE__ */ __name(async ({ allowDrain = false } = {}) => {
      const shouldAbort = /* @__PURE__ */ __name(() => allowDrain ? isClaimAborted() : stopped || authAborted, "shouldAbort");
      while (!shouldAbort()) {
        const now = nowFn();
        if (now < pauseUntil) {
          if (allowDrain && drainingBeforeStop) {
            hardStopped = true;
            drainingBeforeStop = false;
            return false;
          }
          currentPhase = "rate_limited";
          syncStatus();
          const waitMs = Math.min(250, Math.max(1, pauseUntil - now));
          await sleep(waitMs);
          continue;
        }
        if (currentPhase === "rate_limited") {
          currentPhase = "scanning";
          syncStatus(true);
        }
        if (extraDelayMs > 0) {
          await sleep(extraDelayMs);
        }
        return true;
      }
      return false;
    }, "waitRateGate");
    const noteSuccess = /* @__PURE__ */ __name(() => {
      cleanStreak += 1;
      if (cleanStreak >= 40) {
        cleanStreak = 0;
        penaltyCount = 0;
        if (extraDelayMs > 0) {
          extraDelayMs = Math.max(0, extraDelayMs - 50);
        }
      }
    }, "noteSuccess");
    const handleRateLimit = /* @__PURE__ */ __name(async (retryAfterMs = null, source = "search") => {
      const now = nowFn();
      penaltyCount += 1;
      cleanStreak = 0;
      const backoffMs = retryAfterMs != null && Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : Math.min(6e5, rateLimitBaseBackoffMs * Math.pow(2, penaltyCount - 1));
      const targetUntil = now + backoffMs;
      const wasExtended = targetUntil > pauseUntil;
      pauseUntil = Math.max(pauseUntil, targetUntil);
      if (wasExtended) {
        activeConcurrency = Math.max(1, activeConcurrency - 1);
        extraDelayMs = Math.min(1e3, extraDelayMs + 150);
        currentPhase = "rate_limited";
        logMsg("warn", `[FastScanner] ${source} \u89E6\u53D1 429 \u9650\u901F\uFF0C\u5168\u8DEF\u6682\u505C ${Math.ceil(backoffMs / 1e3)}s\uFF0C\u5E76\u53D1\u964D\u81F3 ${activeConcurrency} \u8DEF\u3002`);
        syncStatus(true);
      }
    }, "handleRateLimit");
    const buildSearchUrl = /* @__PURE__ */ __name((baseParams, cursor = null, extraParams = null) => {
      const merged = { ...baseParams || {}, ...extraParams || {} };
      const sp = new URLSearchParams();
      Object.keys(merged).forEach((k) => {
        const v = merged[k];
        if (v === null || v === void 0 || v === "") return;
        if (Array.isArray(v)) {
          v.forEach((item) => sp.append(k, String(item)));
        } else {
          sp.set(k, String(v));
        }
      });
      if (cursor) sp.set("cursor", cursor);
      return `https://www.fab.com${SEARCH_PATH2}?${sp.toString()}`;
    }, "buildSearchUrl");
    const toPendingClaimPayload = /* @__PURE__ */ __name((item) => ({
      uid: item.uid,
      url: item.url,
      name: item.name || "Untitled",
      offerId: item.offerId || "",
      offerIds: Array.isArray(item.offerIds) ? item.offerIds : [],
      listingType: item.listingType || "",
      isBundle: Boolean(item.isBundle || item.listingType === "bundle"),
      needsDiscountVerify: Boolean(item.needsDiscountVerify)
    }), "toPendingClaimPayload");
    const dedupePending = /* @__PURE__ */ __name((items, mapFn) => {
      const db = getDatabase();
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const it of items) {
        if (!it || !it.uid || seen.has(it.uid)) continue;
        if (it.url && db.isDone(it.url)) continue;
        seen.add(it.uid);
        out.push(mapFn(it));
      }
      return out;
    }, "dedupePending");
    const buildCheckpointPayload = /* @__PURE__ */ __name(() => ({
      version: 1,
      queryKey: currentQueryKey,
      mode: currentMode,
      headUpperMs: currentHeadUpperMs,
      totalEstimated: currentStats.totalEstimated,
      slices: currentSlices.map(({ inProgress, failedThisRun, ...rest }) => rest),
      pendingUnknowns: dedupePending(
        [...Array.from(inFlightStateChunks).flat(), ...unknownBuffer],
        (item) => ({
          uid: item.uid,
          url: item.url,
          name: item.name || "Untitled",
          offerId: item.offerId || "",
          offerIds: Array.isArray(item.offerIds) ? item.offerIds : [],
          listingType: item.listingType || "",
          needsDiscountVerify: Boolean(item.needsDiscountVerify)
        })
      ),
      pendingClaims: dedupePending(
        [...Array.from(inFlightClaimTasks), ...claimQueue],
        toPendingClaimPayload
      ),
      stats: {
        pagesFetched: currentStats.pagesFetched,
        itemsScanned: currentStats.itemsScanned,
        totalEstimated: currentStats.totalEstimated,
        skippedLocal: currentStats.skippedLocal,
        skippedNonFree: currentStats.skippedNonFree,
        skippedFailed: currentStats.skippedFailed,
        confirmedOwnedServer: currentStats.confirmedOwnedServer,
        claimedDirect: currentStats.claimedDirect,
        queuedFallback: currentStats.queuedFallback,
        failed: currentStats.failed
      },
      savedAt: nowFn()
    }), "buildCheckpointPayload");
    const saveCheckpoint = /* @__PURE__ */ __name(async (force = false) => {
      if (currentMode === "incremental") return;
      const now = nowFn();
      if (!force && now - lastCheckpointAt < checkpointIntervalMs) return;
      lastCheckpointAt = now;
      try {
        const payload = buildCheckpointPayload();
        await gmSet(getConfig().DB_KEYS.FAST_SCAN_CHECKPOINT, payload);
        const st = getState();
        st.hasFastScanCheckpoint = true;
        const totalEst = Number(payload.totalEstimated) || 0;
        const scanned = Number(payload.stats?.itemsScanned) || 0;
        st.fastScanCheckpointMeta = {
          itemsScanned: scanned,
          totalEstimated: totalEst,
          pct: totalEst > 0 ? Math.min(99, Math.max(1, Math.round(scanned / totalEst * 100))) : null
        };
      } catch (_e) {
      }
    }, "saveCheckpoint");
    const clearCheckpoint = /* @__PURE__ */ __name(async () => {
      try {
        await gmDelete(getConfig().DB_KEYS.FAST_SCAN_CHECKPOINT);
        const st = getState();
        st.hasFastScanCheckpoint = false;
        st.fastScanCheckpointMeta = null;
      } catch (_e) {
      }
    }, "clearCheckpoint");
    const wakeClaimWorkers = /* @__PURE__ */ __name(() => {
      while (claimWaiters.length > 0) {
        const resolve = claimWaiters.shift();
        resolve();
      }
    }, "wakeClaimWorkers");
    const enqueueClaim = /* @__PURE__ */ __name((item) => {
      claimQueue.push({
        uid: item.uid,
        url: item.url,
        name: item.name || "Untitled",
        offerId: item.offerId || "",
        offerIds: Array.isArray(item.offerIds) ? item.offerIds : [],
        listingType: item.listingType || "",
        isBundle: item.listingType === "bundle",
        needsDiscountVerify: Boolean(item.needsDiscountVerify)
      });
      wakeClaimWorkers();
    }, "enqueueClaim");
    const routeToFallback = /* @__PURE__ */ __name(async (task) => {
      currentStats.queuedFallback += 1;
      if (typeof enqueueFallbackFn === "function") {
        await enqueueFallbackFn(task);
        return;
      }
      const db = getDatabase();
      const st = getState();
      if (!Array.isArray(st.db.todo)) st.db.todo = [];
      const cleanTarget = db.normalizeListingUrl(task.url);
      const alreadyTodo = st.db.todo.some((t) => t.uid === task.uid || db.normalizeListingUrl(t.url) === cleanTarget);
      const alreadyRunning = Object.values(st.runningWorkers || {}).some((w) => w?.task?.uid === task.uid);
      if (!alreadyTodo && !alreadyRunning) {
        st.db.todo.push(task);
        await db.saveTodo();
      }
    }, "routeToFallback");
    const checkStatesChunk = /* @__PURE__ */ __name(async (chunk) => {
      if (!chunk || chunk.length === 0) return { ownedCount: 0, unownedCount: 0 };
      const db = getDatabase();
      const u = new URL(`https://www.fab.com${STATES_PATH}`);
      chunk.forEach((item) => u.searchParams.append("listing_ids", item.uid));
      inFlightStateChunks.add(chunk);
      try {
        let attempts = 0;
        while (!isClaimAborted()) {
          const okToRun = await waitRateGate({ allowDrain: true });
          if (!okToRun) {
            unknownBuffer.unshift(...chunk);
            return { ownedCount: 0, unownedCount: 0 };
          }
          attempts += 1;
          let res;
          try {
            res = await doFetch(u.toString());
          } catch (_err) {
            if (isClaimAborted()) {
              unknownBuffer.unshift(...chunk);
              return { ownedCount: 0, unownedCount: 0 };
            }
            if (attempts < 2) {
              await sleep(Math.min(500, rateLimitBaseBackoffMs));
              continue;
            }
            chunk.forEach((item) => enqueueClaim(item));
            return { ownedCount: 0, unownedCount: chunk.length };
          }
          if (isClaimAborted()) {
            unknownBuffer.unshift(...chunk);
            return { ownedCount: 0, unownedCount: 0 };
          }
          const status = Number(res?.status) || 0;
          if (status === 429) {
            await handleRateLimit(parseRetryAfterMs2(res), "listings-states");
            continue;
          }
          if (status === 401 || status === 403) {
            authAborted = true;
            currentPhase = "error";
            onAuthFailure();
            return { ownedCount: 0, unownedCount: 0 };
          }
          if (status >= 200 && status < 300) {
            noteSuccess();
            let raw = null;
            try {
              raw = JSON.parse(res.responseText || "[]");
            } catch (_e) {
              raw = [];
            }
            const states = Array.isArray(raw) ? raw : API.extractStateData(raw, "FastScanner") || [];
            const acquiredSet = new Set(
              states.filter((s) => s && s.acquired && s.uid).map((s) => String(s.uid).toLowerCase())
            );
            const ownedUrls = [];
            const ownedItems = [];
            const unownedItems = [];
            chunk.forEach((item) => {
              if (acquiredSet.has(item.uid)) {
                ownedUrls.push(item.url);
                ownedItems.push(item);
              } else {
                unownedItems.push(item);
              }
            });
            if (ownedUrls.length > 0) {
              db.addDoneUrls(ownedUrls);
              db.scheduleSaveDone();
              currentStats.confirmedOwnedServer += ownedUrls.length;
              ownedItems.forEach((item) => notifyItemClaimed(item, "server-owned"));
            }
            unownedItems.forEach((item) => enqueueClaim(item));
            syncStatus();
            return { ownedCount: ownedUrls.length, unownedCount: unownedItems.length };
          }
          if (attempts < 2) {
            await sleep(Math.min(500, rateLimitBaseBackoffMs));
            continue;
          }
          chunk.forEach((item) => enqueueClaim(item));
          return { ownedCount: 0, unownedCount: chunk.length };
        }
        unknownBuffer.unshift(...chunk);
        return { ownedCount: 0, unownedCount: 0 };
      } finally {
        inFlightStateChunks.delete(chunk);
      }
    }, "checkStatesChunk");
    const scheduleUnknownFlush = /* @__PURE__ */ __name(() => {
      if (isClaimAborted() || stopped || unknownBuffer.length === 0) return;
      if (unknownFlushDelayMs <= 0) {
        flushUnknownBuffer(true);
        return;
      }
      if (unknownFlushTimer !== null) return;
      unknownFlushTimer = setTimeout(() => {
        unknownFlushTimer = null;
        if (!isClaimAborted() && unknownBuffer.length > 0) {
          flushUnknownBuffer(true);
        }
      }, unknownFlushDelayMs);
      unknownFlushTimer?.unref?.();
    }, "scheduleUnknownFlush");
    const flushUnknownBuffer = /* @__PURE__ */ __name((drainAll = false) => {
      if (drainAll) {
        clearUnknownFlushTimer();
      }
      const job = /* @__PURE__ */ __name(async () => {
        let ownedTotal = 0;
        let unownedTotal = 0;
        while (unknownBuffer.length > 0 && !isClaimAborted()) {
          if (!drainAll && unknownBuffer.length < STATES_MAX_IDS) break;
          const chunk = unknownBuffer.splice(0, STATES_MAX_IDS);
          const res = await checkStatesChunk(chunk);
          ownedTotal += res.ownedCount;
          unownedTotal += res.unownedCount;
        }
        if (unknownBuffer.length === 0) {
          clearUnknownFlushTimer();
        } else if (!stopped && !isClaimAborted()) {
          scheduleUnknownFlush();
        }
        return { ownedTotal, unownedTotal };
      }, "job");
      const next = statesFlushChain.then(job, job);
      statesFlushChain = next.catch(() => ({ ownedTotal: 0, unownedTotal: 0 }));
      return next;
    }, "flushUnknownBuffer");
    const processPageItems = /* @__PURE__ */ __name(async (items, { flushImmediately = false, trackHeadTimestamp = true } = {}) => {
      const db = getDatabase();
      const ls = getListingSource();
      const cache = getDataCache();
      const isFreeQuery = String(currentBaseParams?.is_free || "") === "1";
      const isTimeDesc = currentBaseParams?.sort_by === "-firstPublishedAt";
      let addedToUnknown = 0;
      for (const item of items || []) {
        if (!item || !item.uid) continue;
        if (trackHeadTimestamp && isTimeDesc && Number.isFinite(item.publishedAtMs)) {
          noteHeadTimestamp(item.publishedAtMs);
        }
        if (seenUids.has(item.uid)) continue;
        seenUids.add(item.uid);
        currentStats.itemsScanned += 1;
        let queueItem = item;
        if (!ls.isClaimable(item)) {
          const maybeDiscountedFree = isFreeQuery && item.isDiscounted === true && item.discountedPrice == null && item.effectiveDiscountPercentage == null;
          if (!maybeDiscountedFree) {
            currentStats.skippedNonFree += 1;
            continue;
          }
          queueItem = { ...item, offerId: "", needsDiscountVerify: true };
        }
        if (db.isDone(item.url)) {
          currentStats.skippedLocal += 1;
          continue;
        }
        if (db.isFailed(item.url)) {
          currentStats.skippedFailed += 1;
          continue;
        }
        if (queueItem.offerId) {
          cache.offerListingUids.set(queueItem.offerId, queueItem.uid);
        }
        unknownBuffer.push(queueItem);
        addedToUnknown += 1;
      }
      if (flushImmediately) {
        return flushUnknownBuffer(true);
      }
      if (unknownBuffer.length >= STATES_MAX_IDS) {
        await flushUnknownBuffer(false);
        if (unknownBuffer.length > 0 && !stopped) {
          scheduleUnknownFlush();
        }
      } else if (unknownBuffer.length > 0 && !stopped) {
        scheduleUnknownFlush();
        syncStatus();
      } else if (addedToUnknown === 0) {
        syncStatus();
      }
      return { ownedTotal: 0, unownedTotal: 0 };
    }, "processPageItems");
    const runClaimWithSlowPathGuard = /* @__PURE__ */ __name(async (task, apiClaim) => {
      if (task.offerId) {
        return apiClaim.claim(task);
      }
      const exec = /* @__PURE__ */ __name(() => apiClaim.claim(task), "exec");
      const run = slowPathLock.then(exec, exec);
      slowPathLock = run.catch(() => {
      });
      return run;
    }, "runClaimWithSlowPathGuard");
    const runClaimLoop = /* @__PURE__ */ __name(async (scanDoneRef) => {
      const db = getDatabase();
      const apiClaim = getApiClaim();
      const cfg = getConfig();
      const st = getState();
      while (true) {
        if (isClaimAborted()) break;
        if (claimQueue.length === 0) {
          if (scanDoneRef.done) break;
          await new Promise((resolve) => {
            claimWaiters.push(resolve);
          });
          continue;
        }
        const task = claimQueue.shift();
        if (!task) continue;
        if (db.isDone(task.url)) continue;
        activeClaimsInFlight += 1;
        inFlightClaimTasks.add(task);
        try {
          if (isConfirmedBundleTask(task)) {
            await routeToFallback(task);
            syncStatus();
            continue;
          }
          const canApiClaim = Boolean(cfg.USE_API_CLAIM && typeof apiClaim.isAvailable === "function" && apiClaim.isAvailable());
          if (!canApiClaim) {
            await routeToFallback(task);
            syncStatus();
            continue;
          }
          const gateOk = await waitRateGate({ allowDrain: true });
          if (!gateOk) {
            claimQueue.unshift(task);
            break;
          }
          if (claimIntervalMs > 0) {
            const sinceLast = nowFn() - lastClaimAt;
            if (sinceLast < claimIntervalMs) {
              await sleep(claimIntervalMs - sinceLast);
            }
            lastClaimAt = nowFn();
          }
          let outcome = await runClaimWithSlowPathGuard(task, apiClaim);
          if (outcome.serverInternalError && task.offerId) {
            outcome = await runClaimWithSlowPathGuard({ ...task, offerId: "" }, apiClaim);
          }
          if (outcome.result === CLAIM_RESULT.SUCCESS) {
            noteSuccess();
            await db.markAsDone(task, { deferSave: true });
            st.sessionCompleted?.add(db.normalizeListingUrl(task.url));
            currentStats.claimedDirect += 1;
            notifyItemClaimed(task, "claimed");
            syncStatus(true);
          } else if (outcome.result === CLAIM_RESULT.RATE_LIMITED) {
            await handleRateLimit(outcome.retryAfterMs, "add-to-library");
            const retries = (task._claimRateRetries || 0) + 1;
            if (retries <= 5) {
              task._claimRateRetries = retries;
              claimQueue.push(task);
            } else {
              const reason = `\u8FDE\u7EED\u9650\u901F ${retries - 1} \u6B21\uFF0C\u653E\u5F03\u8BE5\u5546\u54C1`;
              logMsg("warn", `[FastScanner] \u9886\u53D6\u5931\u8D25 (${task.name || task.uid}): ${reason}`);
              const failRes = await db.markAsFailed(task, { reason });
              if (failRes && failRes.retried) {
                currentStats.queuedFallback += 1;
              } else {
                currentStats.failed += 1;
              }
              syncStatus(true);
            }
          } else if (outcome.isBundle) {
            task.listingType = "bundle";
            task.isBundle = true;
            await routeToFallback(task);
            syncStatus();
          } else if (outcome.serverInternalError) {
            const reason = "Fab \u670D\u52A1\u7AEF\u5185\u90E8\u9519\u8BEF (500 Internal error)\uFF0C\u5B98\u7F51\u6309\u94AE\u4EA6\u65E0\u6CD5\u5165\u5E93";
            logMsg("warn", `[FastScanner] \u9886\u53D6\u5931\u8D25 (${task.name || task.uid}): ${reason}`);
            const failRes = await db.markAsFailed(task, { reason });
            if (failRes && failRes.retried) {
              currentStats.queuedFallback += 1;
            } else {
              currentStats.failed += 1;
            }
            syncStatus(true);
          } else if (outcome.result === CLAIM_RESULT.UNAVAILABLE || outcome.retryable === true) {
            await routeToFallback(task);
            syncStatus();
          } else {
            const reason = outcome.reason || "\u9886\u53D6\u5931\u8D25";
            if (/CSRF|401|未登录|会话/i.test(reason)) {
              authAborted = true;
              currentPhase = "error";
              onAuthFailure();
              break;
            }
            if (task.needsDiscountVerify && /未找到免费许可/.test(reason)) {
              currentStats.skippedNonFree += 1;
              logMsg("debug", `[FastScanner] \u6298\u6263\u5546\u54C1\u590D\u6838\u975E 100% \u514D\u8D39\uFF0C\u5DF2\u8DF3\u8FC7 (${task.name || task.uid})`);
              syncStatus();
              continue;
            }
            logMsg("warn", `[FastScanner] \u9886\u53D6\u5931\u8D25 (${task.name || task.uid}): ${reason}`);
            const failRes = await db.markAsFailed(task, { reason });
            if (failRes && failRes.retried) {
              currentStats.queuedFallback += 1;
            } else {
              currentStats.failed += 1;
            }
            syncStatus(true);
          }
        } finally {
          inFlightClaimTasks.delete(task);
          activeClaimsInFlight -= 1;
        }
      }
    }, "runClaimLoop");
    const fetchSearchPageRaw = /* @__PURE__ */ __name(async (url, label = "search") => {
      let networkFailures = 0;
      while (!stopped && !authAborted) {
        const gateOk = await waitRateGate();
        if (!gateOk) return { aborted: true };
        let res;
        try {
          res = await doFetch(url);
        } catch (err) {
          networkFailures += 1;
          currentStats.pageErrors += 1;
          if (networkFailures >= 3) {
            return { error: err };
          }
          await sleep(Math.min(2e3 * networkFailures, Math.max(50, rateLimitBaseBackoffMs)));
          continue;
        }
        const status = Number(res?.status) || 0;
        if (status === 429) {
          await handleRateLimit(parseRetryAfterMs2(res), label);
          continue;
        }
        if (status === 401 || status === 403) {
          authAborted = true;
          currentPhase = "error";
          onAuthFailure();
          return { aborted: true };
        }
        if (status >= 200 && status < 300) {
          noteSuccess();
          try {
            const json = JSON.parse(res.responseText || "{}");
            return { ok: true, json };
          } catch (e) {
            networkFailures += 1;
            if (networkFailures >= 3) return { error: e };
            await sleep(Math.min(500, rateLimitBaseBackoffMs));
            continue;
          }
        }
        networkFailures += 1;
        currentStats.pageErrors += 1;
        if (networkFailures >= 3) {
          return { error: new Error(`Search HTTP ${status}`) };
        }
        await sleep(Math.min(1e3 * networkFailures, Math.max(50, rateLimitBaseBackoffMs)));
      }
      return { aborted: true };
    }, "fetchSearchPageRaw");
    const calibrateRun = /* @__PURE__ */ __name(async (baseParams, opts) => {
      const ls = getListingSource();
      const cfg = getConfig();
      const incrementalMode = Boolean(opts.incrementalEarlyStop && baseParams.sort_by === "-firstPublishedAt");
      const targetConcurrency = incrementalMode ? 1 : configuredConcurrency;
      if (!incrementalMode && opts.resumeCheckpoint !== false) {
        try {
          const db = getDatabase();
          const saved = await gmGet(cfg.DB_KEYS.FAST_SCAN_CHECKPOINT, null);
          const pendingUnknowns = Array.isArray(saved?.pendingUnknowns) ? saved.pendingUnknowns : [];
          const pendingClaims = Array.isArray(saved?.pendingClaims) ? saved.pendingClaims : [];
          const hasUnfinishedSlices = Array.isArray(saved?.slices) && saved.slices.some((s) => !s.done);
          if (saved && saved.queryKey === currentQueryKey && (hasUnfinishedSlices || pendingUnknowns.length > 0 || pendingClaims.length > 0)) {
            resumedFromCheckpoint = true;
            currentMode = saved.mode || "time-shards";
            currentSlices = Array.isArray(saved.slices) ? saved.slices.map((s) => ({ ...s, inProgress: false, failedThisRun: false })) : [];
            pendingUnknowns.forEach((item) => {
              if (!item || !item.uid || seenUids.has(item.uid) || db.isDone(item.url)) return;
              seenUids.add(item.uid);
              unknownBuffer.push(item);
            });
            pendingClaims.forEach((task) => {
              if (!task || !task.uid || seenUids.has(task.uid) || db.isDone(task.url)) return;
              seenUids.add(task.uid);
              claimQueue.push(toPendingClaimPayload(task));
            });
            if (saved.stats) {
              currentStats.totalEstimated = saved.stats.totalEstimated || saved.totalEstimated || 0;
              currentStats.pagesFetched = saved.stats.pagesFetched || 0;
              currentStats.itemsScanned = saved.stats.itemsScanned || 0;
              currentStats.skippedLocal = saved.stats.skippedLocal || 0;
              currentStats.skippedNonFree = saved.stats.skippedNonFree || 0;
              currentStats.skippedFailed = saved.stats.skippedFailed || 0;
              currentStats.confirmedOwnedServer = saved.stats.confirmedOwnedServer || 0;
              currentStats.claimedDirect = saved.stats.claimedDirect || 0;
              currentStats.queuedFallback = saved.stats.queuedFallback || 0;
              currentStats.failed = saved.stats.failed || 0;
            }
            let prevHeadMs = Number.isFinite(saved.headUpperMs) ? saved.headUpperMs : null;
            if (prevHeadMs == null) {
              for (const s of currentSlices) {
                if (Number.isFinite(s?.upperMs)) {
                  prevHeadMs = prevHeadMs == null ? s.upperMs : Math.max(prevHeadMs, s.upperMs);
                }
                const cMs = decodeTimeCursorMs(s?.cursor);
                if (Number.isFinite(cMs)) {
                  prevHeadMs = prevHeadMs == null ? cMs : Math.max(prevHeadMs, cMs);
                }
              }
            }
            if (prevHeadMs == null && Number.isFinite(saved.savedAt)) {
              prevHeadMs = saved.savedAt;
            }
            let addedHeadSlice = false;
            if (baseParams.sort_by === "-firstPublishedAt" && Number.isFinite(prevHeadMs)) {
              currentHeadUpperMs = prevHeadMs;
              currentSlices.unshift({
                id: `time-head-${nowFn()}`,
                extraParams: null,
                upperMs: null,
                lowerMs: prevHeadMs,
                cursor: null,
                done: false,
                inProgress: false,
                failedThisRun: false,
                pages: 0
              });
              addedHeadSlice = true;
            }
            logMsg(
              "info",
              `[FastScanner] \u68C0\u6D4B\u5230\u672A\u5B8C\u6210\u7684\u65AD\u70B9\uFF0C\u6062\u590D\u626B\u63CF\uFF08\u5269\u4F59 ${currentSlices.filter((s) => !s.done).length} \u4E2A\u5206\u7247\uFF0C\u5F85\u5904\u7406 ${unknownBuffer.length + claimQueue.length} \u9879` + (addedHeadSlice ? "\uFF0C\u5DF2\u8FFD\u52A0\u5934\u90E8\u8865\u626B\u5206\u7247\u8986\u76D6\u65AD\u70B9\u671F\u95F4\u65B0\u54C1" : "") + "\uFF09\u3002"
            );
            return;
          }
        } catch (_e) {
        }
      }
      let listingTypes = [];
      const aggUrl = buildSearchUrl(baseParams, null, { count: "0", aggregate_on: "listing_type" });
      const aggRes = await fetchSearchPageRaw(aggUrl, "aggregate");
      if (aggRes.aborted) return;
      if (aggRes.ok && aggRes.json) {
        const buckets = aggRes.json?.aggregations?.listingType?.buckets || aggRes.json?.aggregations?.listing_type?.buckets || {};
        const entries = Object.entries(buckets).map(([type, info]) => ({ type, count: Number(info?.docCount ?? info?.doc_count) || 0 })).filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
        currentStats.totalEstimated = entries.reduce((sum, e) => sum + e.count, 0);
        listingTypes = entries.map((e) => e.type);
      }
      if (incrementalMode) {
        currentMode = "incremental";
        currentSlices = [{
          id: "inc-0",
          extraParams: null,
          upperMs: null,
          lowerMs: null,
          cursor: null,
          done: false,
          inProgress: false,
          pages: 0
        }];
        return;
      }
      if (targetConcurrency > 1 && baseParams.sort_by === "-firstPublishedAt") {
        const descUrl = buildSearchUrl(baseParams, null);
        const ascUrl = buildSearchUrl({ ...baseParams, sort_by: "firstPublishedAt" }, null);
        const [descRes, ascRes] = await Promise.all([
          fetchSearchPageRaw(descUrl, "calibrate-desc"),
          fetchSearchPageRaw(ascUrl, "calibrate-asc")
        ]);
        if (descRes.aborted || ascRes.aborted) return;
        let descPage = null;
        if (descRes.ok) {
          calibratedDescPrefetched = true;
          descPage = ls.parsePage(descRes.json);
          currentStats.pagesFetched += 1;
          await processPageItems(descPage.items, { flushImmediately: false });
        }
        let ascPage = null;
        if (ascRes.ok) {
          ascPage = ls.parsePage(ascRes.json);
          currentStats.pagesFetched += 1;
          await processPageItems(ascPage.items, { flushImmediately: false });
        }
        if (descPage && !descPage.nextCursor) {
          currentMode = "time-shards";
          currentSlices = [];
          return;
        }
        const topMs = decodeTimeCursorMs(descPage?.nextCursor);
        const bottomMs = decodeTimeCursorMs(ascPage?.nextCursor);
        noteHeadTimestamp(topMs);
        if (topMs != null && bottomMs != null && topMs > bottomMs) {
          currentMode = "time-shards";
          currentSlices = buildTimeSlices(topMs, bottomMs, targetConcurrency, descPage.nextCursor).map((s) => ({ ...s, inProgress: false, failedThisRun: false }));
        } else {
          currentMode = "sequential";
          currentSlices = [{
            id: "seq-0",
            extraParams: null,
            upperMs: topMs,
            lowerMs: null,
            cursor: descPage?.nextCursor || null,
            done: false,
            inProgress: false,
            failedThisRun: false,
            pages: 0
          }];
        }
        return;
      }
      const shardableTypes = listingTypes.filter((t) => t !== "bundle");
      if (targetConcurrency > 1 && !baseParams.listing_types && shardableTypes.length > 1) {
        currentMode = "type-shards";
        currentSlices = shardableTypes.map((t) => ({
          id: `type-${t}`,
          extraParams: { listing_types: t },
          upperMs: null,
          lowerMs: null,
          cursor: null,
          done: false,
          inProgress: false,
          failedThisRun: false,
          pages: 0
        }));
        return;
      }
      currentMode = "sequential";
      currentSlices = [{
        id: "seq-0",
        extraParams: null,
        upperMs: null,
        lowerMs: null,
        cursor: null,
        done: false,
        inProgress: false,
        failedThisRun: false,
        pages: 0
      }];
    }, "calibrateRun");
    const stepSlicePage = /* @__PURE__ */ __name(async (slice, baseParams, { flushImmediately = false } = {}) => {
      const ls = getListingSource();
      const url = buildSearchUrl(baseParams, slice.cursor, slice.extraParams);
      const res = await fetchSearchPageRaw(url, slice.id);
      if (res.aborted || stopped || authAborted) return { aborted: true };
      if (res.error) {
        logMsg("warn", `[FastScanner] \u5206\u7247 ${slice.id} \u8BF7\u6C42\u8FDE\u7EED\u5931\u8D25\uFF0C\u4FDD\u7559\u65AD\u70B9\u5F85\u7EED\u626B: ${res.error.message}`);
        slice.failedThisRun = true;
        slice.lastError = res.error.message || "Search error";
        currentStats.failedSlices += 1;
        return { error: res.error };
      }
      const page = ls.parsePage(res.json);
      slice.pages += 1;
      currentStats.pagesFetched += 1;
      const pageResult = await processPageItems(page.items, { flushImmediately });
      if (stopped || authAborted) return { aborted: true };
      if (baseParams.sort_by === "-firstPublishedAt" && page.nextCursor) {
        noteHeadTimestamp(decodeTimeCursorMs(page.nextCursor));
      }
      if (!page.nextCursor) {
        slice.cursor = null;
        slice.done = true;
      } else if (slice.lowerMs != null) {
        const nextMs = decodeTimeCursorMs(page.nextCursor);
        if (nextMs != null && nextMs < slice.lowerMs - OVERLAP_MS) {
          slice.cursor = null;
          slice.done = true;
        } else {
          slice.cursor = page.nextCursor;
        }
      } else {
        slice.cursor = page.nextCursor;
      }
      return { ok: true, page, pageResult };
    }, "stepSlicePage");
    const runQuickPrepass = /* @__PURE__ */ __name(async (baseParams) => {
      if (String(baseParams?.is_discounted || "") !== "1" && quickDiscountedMaxPages > 0) {
        let pageIdx = 0;
        let discCursor = null;
        while (pageIdx < quickDiscountedMaxPages && !stopped && !authAborted) {
          const discUrl = buildSearchUrl(baseParams, discCursor, {
            is_free: "1",
            is_discounted: "1",
            sort_by: "-firstPublishedAt"
          });
          const res = await fetchSearchPageRaw(discUrl, "prepass-discounted");
          if (res.aborted || res.error || stopped || authAborted) break;
          const page = getListingSource().parsePage(res.json);
          currentStats.pagesFetched += 1;
          pageIdx += 1;
          await processPageItems(page.items, { flushImmediately: true, trackHeadTimestamp: false });
          syncStatus();
          if (!page.nextCursor) break;
          discCursor = page.nextCursor;
        }
      }
      if (stopped || authAborted) return;
      await flushUnknownBuffer(true);
      const headSteps = Math.max(0, quickHeadPages - (calibratedDescPrefetched ? 1 : 0));
      if (headSteps > 0 && currentSlices.length > 0 && (currentMode === "time-shards" || currentMode === "sequential")) {
        const headSlice = currentSlices[0];
        for (let i = 0; i < headSteps && !stopped && !authAborted && !headSlice.done && !headSlice.failedThisRun; i += 1) {
          const stepRes = await stepSlicePage(headSlice, baseParams, { flushImmediately: true });
          if (stepRes.aborted || stepRes.error) break;
          syncStatus();
          await saveCheckpoint(false);
        }
      }
      if (!isClaimAborted()) {
        await flushUnknownBuffer(true);
        while (!isClaimAborted() && (claimQueue.length > 0 || activeClaimsInFlight > 0)) {
          await sleep(20);
        }
      }
    }, "runQuickPrepass");
    const runScanWorker = /* @__PURE__ */ __name(async (workerIdx, baseParams, stopPages) => {
      while (!stopped && !authAborted && !earlyStopped) {
        if (workerIdx >= activeConcurrency) {
          const remaining = currentSlices.some((s) => !s.done && !s.failedThisRun);
          if (!remaining) break;
          await new Promise((resolve) => {
            workerSlotWaiters.push(resolve);
          });
          continue;
        }
        const slice = currentSlices.find((s) => !s.done && !s.inProgress && !s.failedThisRun);
        if (!slice) {
          const anyInProgress = currentSlices.some((s) => !s.done && !s.failedThisRun && s.inProgress);
          if (!anyInProgress) break;
          await new Promise((resolve) => {
            workerSlotWaiters.push(resolve);
          });
          continue;
        }
        slice.inProgress = true;
        try {
          while (!stopped && !authAborted && !earlyStopped && !slice.done && !slice.failedThisRun) {
            if (workerIdx >= activeConcurrency) {
              break;
            }
            const isIncremental = currentMode === "incremental";
            const stepRes = await stepSlicePage(slice, baseParams, { flushImmediately: isIncremental });
            if (stepRes.aborted || stepRes.error || stopped || authAborted) break;
            const { page, pageResult } = stepRes;
            if (isIncremental && page.items.length > 0) {
              if (pageResult.unownedTotal === 0) {
                consecutiveOwnedPages += 1;
              } else {
                consecutiveOwnedPages = 0;
              }
              if (consecutiveOwnedPages >= stopPages) {
                earlyStopped = true;
                slice.done = true;
              }
            }
            syncStatus();
            await saveCheckpoint(false);
          }
        } finally {
          slice.inProgress = false;
          wakeWorkerSlots();
        }
      }
    }, "runScanWorker");
    const start = /* @__PURE__ */ __name(async (options = {}) => {
      if (running && activeRunPromise) return activeRunPromise;
      const st = getState();
      const cfg = getConfig();
      const db = getDatabase();
      resetRunVars();
      running = true;
      const reqConc = Number.isFinite(options.concurrency) ? options.concurrency : Number(st.apiScanConcurrency) || cfg.DEFAULT_API_SCAN_CONCURRENCY || 4;
      configuredConcurrency = Math.max(1, Math.min(cfg.MAX_API_SCAN_CONCURRENCY || 6, Math.floor(reqConc)));
      activeConcurrency = configuredConcurrency;
      const incEnabled = options.incrementalEarlyStop !== void 0 ? Boolean(options.incrementalEarlyStop) : Boolean(st.incrementalEarlyStop);
      const stopPages = Math.max(1, Math.min(50, Math.floor(
        Number.isFinite(options.incrementalStopPages) ? options.incrementalStopPages : Number(st.incrementalStopPages) || cfg.DEFAULT_INCREMENTAL_STOP_PAGES || 5
      )));
      const rawBaseParams = options.globalFreeScan ? { is_free: "1", sort_by: "-firstPublishedAt" } : options.baseParams || extractSearchParamsFromUrl(getHref());
      const baseParams = { ...rawBaseParams };
      if (!options.preserveQuery && baseParams.is_free === void 0) {
        baseParams.is_free = "1";
        logMsg("info", "[FastScanner] \u5F53\u524D\u9875\u9762\u672A\u643A\u5E26 is_free=1\uFF0C\u5DF2\u81EA\u52A8\u9650\u5B9A\u4EC5\u626B\u63CF\u514D\u8D39\u5546\u54C1\u3002");
      }
      if (!options.preserveSort && baseParams.sort_by !== "-firstPublishedAt") {
        baseParams.sort_by = "-firstPublishedAt";
        logMsg(
          "info",
          incEnabled ? "[FastScanner] \u8FFD\u65B0\u6A21\u5F0F\u5DF2\u81EA\u52A8\u6309\u6700\u65B0\u53D1\u5E03\u5012\u5E8F (-firstPublishedAt) \u626B\u63CF\uFF08\u4FDD\u7559\u5F53\u524D\u7B5B\u9009\uFF09" : "[FastScanner] \u5168\u91CF\u626B\u63CF\u5DF2\u81EA\u52A8\u5207\u6362\u4E3A\u6309\u6700\u65B0\u53D1\u5E03\u5012\u5E8F (-firstPublishedAt) \u65F6\u95F4\u5206\u7247\uFF08\u907F\u514D\u9ED8\u8BA4\u6392\u5E8F\u89E6\u53D1 Fab \u4E07\u6761\u5206\u9875\u4E0A\u9650\uFF09"
        );
      }
      currentBaseParams = baseParams;
      currentQueryKey = buildQueryKey(baseParams);
      currentPhase = "calibrating";
      syncStatus(true);
      const runWork = /* @__PURE__ */ __name(async () => {
        const scanDoneRef = { done: false };
        let claimLoops = [];
        try {
          claimLoops = Array.from({ length: claimWorkersCount }, () => runClaimLoop(scanDoneRef));
          if (Array.isArray(options.priorityItems) && options.priorityItems.length > 0) {
            const addedPriority = enqueuePriorityItems(options.priorityItems, { flush: false });
            if (addedPriority > 0) {
              logMsg("info", `[FastScanner] \u4F18\u5148\u6838\u9A8C\u5E76\u9886\u53D6\u5F53\u524D\u9875\u9762\u53EF\u89C1\u514D\u8D39\u5546\u54C1 (${addedPriority} \u9879)...`);
              await flushUnknownBuffer(true);
              while (!isClaimAborted() && (claimQueue.length > 0 || activeClaimsInFlight > 0)) {
                await sleep(20);
              }
            }
          }
          await calibrateRun(baseParams, {
            incrementalEarlyStop: incEnabled,
            resumeCheckpoint: options.resumeCheckpoint
          });
          if (stopped || authAborted) {
            scanDoneRef.done = true;
            wakeClaimWorkers();
            await Promise.all(claimLoops);
            return buildSnapshot();
          }
          const quickPrepassEnabled = !incEnabled && (options.quickPrepass !== void 0 ? Boolean(options.quickPrepass) : Boolean(options.globalFreeScan));
          if (quickPrepassEnabled) {
            currentPhase = "prepass";
            syncStatus(true);
            logMsg("info", "[FastScanner] \u524D\u7F6E\u5FEB\u7B5B\uFF1A\u4F18\u5148\u6838\u9A8C\u5168\u7AD9\u9650\u514D\u6298\u6263\u6C60\u4E0E\u6700\u65B0\u4E0A\u67B6\u514D\u8D39\u54C1...");
            await runQuickPrepass(baseParams);
          }
          if (!stopped && !authAborted) {
            currentPhase = "scanning";
            logMsg(
              "info",
              `[FastScanner] \u5F00\u59CB\u6781\u901F\u626B\u63CF (${currentMode}, ${activeConcurrency} \u8DEF\u5E76\u53D1` + (currentStats.totalEstimated > 0 ? `, \u9884\u8BA1 ${currentStats.totalEstimated} \u4EF6` : "") + (incEnabled && currentMode === "incremental" ? `, \u8FDE\u7EED ${stopPages} \u9875\u5DF2\u62E5\u6709\u65E9\u505C` : "") + ")"
            );
            syncStatus(true);
          }
          if (!stopped && !authAborted && currentSlices.some((s) => !s.done)) {
            const spawnCount = currentMode === "incremental" ? 1 : Math.min(cfg.MAX_API_SCAN_CONCURRENCY || 6, Math.max(configuredConcurrency, 1), Math.max(1, currentSlices.length));
            const scanWorkers = Array.from(
              { length: spawnCount },
              (_, idx) => runScanWorker(idx, baseParams, stopPages)
            );
            await Promise.all(scanWorkers);
          }
          if ((!stopped || drainingBeforeStop) && !hardStopped && !authAborted) {
            currentPhase = stopped ? "paused" : "draining";
            syncStatus(true);
            await flushUnknownBuffer(true);
          }
          scanDoneRef.done = true;
          wakeClaimWorkers();
          await Promise.all(claimLoops);
          drainingBeforeStop = false;
          await db.flushSaveDone();
          currentStats.finishedAt = nowFn();
          const incompleteSlices = currentSlices.filter((s) => !s.done).length;
          if (stopped) {
            currentPhase = "paused";
            await saveCheckpoint(true);
          } else if (authAborted) {
            currentPhase = "error";
            await saveCheckpoint(true);
          } else if (!earlyStopped && incompleteSlices > 0) {
            currentPhase = "partial";
            await saveCheckpoint(true);
            const summary = buildSnapshot();
            const toastMsg = getUtils().getText(
              "toast_fast_scan_partial",
              summary.claimedDirect,
              summary.itemsScanned,
              incompleteSlices
            );
            logMsg(
              "warn",
              `[FastScanner] \u626B\u63CF\u672A\u5B8C\u6574\uFF08${incompleteSlices} \u4E2A\u5206\u7247\u5931\u8D25\u5DF2\u4FDD\u7559\u65AD\u70B9\uFF09\uFF1A\u626B\u63CF ${summary.itemsScanned}\uFF0C\u65B0\u9886 ${summary.claimedDirect}\uFF0C\u672C\u5730\u5DF2\u9886\u8DF3\u8FC7 ${summary.skippedLocal}\uFF0C\u670D\u52A1\u7AEF\u5DF2\u62E5\u6709 ${summary.confirmedOwnedServer}\uFF0C\u975E\u514D\u8D39\u8DF3\u8FC7 ${summary.skippedNonFree}\uFF0C\u5931\u8D25\u5217\u8868\u8DF3\u8FC7 ${summary.skippedFailed}\uFF0C\u8F6C\u540E\u53F0\u961F\u5217 ${summary.queuedFallback}\uFF0C\u9886\u53D6\u5931\u8D25 ${summary.failed}`
            );
            onToast(toastMsg, true);
          } else {
            currentPhase = "completed";
            if (currentMode !== "incremental") {
              await clearCheckpoint();
            }
            const summary = buildSnapshot();
            const toastMsg = earlyStopped ? getUtils().getText("toast_fast_scan_early_stop", summary.claimedDirect, summary.itemsScanned) : getUtils().getText("toast_fast_scan_completed", summary.claimedDirect, summary.itemsScanned);
            logMsg(
              "info",
              `[FastScanner] ${toastMsg}\uFF08\u660E\u7EC6\uFF1A\u672C\u5730\u8DF3\u8FC7 ${summary.skippedLocal}\uFF0C\u670D\u52A1\u7AEF\u5DF2\u62E5\u6709 ${summary.confirmedOwnedServer}\uFF0C\u975E\u514D\u8D39\u8DF3\u8FC7 ${summary.skippedNonFree}\uFF0C\u5931\u8D25\u5217\u8868\u8DF3\u8FC7 ${summary.skippedFailed}\uFF0C\u8F6C\u540E\u53F0\u961F\u5217 ${summary.queuedFallback}\uFF0C\u9886\u53D6\u5931\u8D25 ${summary.failed}\uFF09`
            );
            onToast(toastMsg, true);
          }
          syncStatus(true);
          return buildSnapshot();
        } catch (err) {
          currentStats.finishedAt = nowFn();
          currentPhase = "error";
          logMsg("error", `[FastScanner] \u626B\u63CF\u5F02\u5E38: ${err.message}`);
          await db.flushSaveDone();
          await saveCheckpoint(true);
          syncStatus(true);
          throw err;
        } finally {
          clearUnknownFlushTimer();
          drainingBeforeStop = false;
          scanDoneRef.done = true;
          wakeClaimWorkers();
          if (claimLoops.length > 0) {
            try {
              await Promise.all(claimLoops);
            } catch (_e) {
            }
          }
          running = false;
          activeRunPromise = null;
          syncStatus(true);
        }
      }, "runWork");
      activeRunPromise = runWork();
      return activeRunPromise;
    }, "start");
    const stop = /* @__PURE__ */ __name(async (opts = {}) => {
      if (!running && !activeRunPromise) return;
      clearUnknownFlushTimer();
      const pendingCount = unknownBuffer.length + claimQueue.length + activeClaimsInFlight + inFlightStateChunks.size;
      const canDrain = Boolean(opts?.drainDiscovered) && !stopped && !authAborted && nowFn() >= pauseUntil && unknownBuffer.length + claimQueue.length <= STATES_MAX_IDS && pendingCount > 0;
      stopped = true;
      drainingBeforeStop = canDrain;
      hardStopped = !canDrain;
      currentPhase = "paused";
      wakeClaimWorkers();
      wakeWorkerSlots();
      syncStatus(true);
      if (!canDrain) {
        saveCheckpoint(true);
        getDatabase().flushSaveDone();
      }
      if (activeRunPromise) {
        try {
          await activeRunPromise;
        } catch (_e) {
        }
      }
      await getDatabase().flushSaveDone();
      await saveCheckpoint(true);
    }, "stop");
    const setConcurrency = /* @__PURE__ */ __name((count) => {
      const cfg = getConfig();
      const safe = Math.max(1, Math.min(cfg.MAX_API_SCAN_CONCURRENCY || 6, Math.floor(Number(count) || 4)));
      configuredConcurrency = safe;
      activeConcurrency = Math.min(activeConcurrency, safe) || safe;
      if (currentMode !== "incremental") {
        activeConcurrency = safe;
      }
      wakeWorkerSlots();
      syncStatus(true);
      return safe;
    }, "setConcurrency");
    const normalizeStandaloneItem = /* @__PURE__ */ __name((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const url = raw.url ? String(raw.url).split("?")[0] : "";
      const uidMatch = raw.uid || url.match(/(?:listings|bundles)\/([a-f0-9-]+)/i)?.[1] || "";
      const uid = String(uidMatch).trim().toLowerCase();
      if (!uid) return null;
      const isBundle = Boolean(raw.isBundle || raw.listingType === "bundle" || url.includes("/bundles/"));
      const canonicalUrl = url || `https://www.fab.com/${isBundle ? "bundles" : "listings"}/${uid}`;
      return {
        uid,
        url: canonicalUrl,
        name: raw.name || raw.title || "Untitled",
        offerId: raw.offerId || "",
        offerIds: Array.isArray(raw.offerIds) ? raw.offerIds : [],
        listingType: raw.listingType || (isBundle ? "bundle" : ""),
        isBundle,
        needsDiscountVerify: Boolean(raw.needsDiscountVerify)
      };
    }, "normalizeStandaloneItem");
    const enqueuePriorityItems = /* @__PURE__ */ __name((items = [], { flush = true } = {}) => {
      if (!running || stopped || authAborted || !Array.isArray(items) || items.length === 0) return 0;
      const db = getDatabase();
      const cache = getDataCache();
      const fresh = [];
      for (const raw of items) {
        const item = normalizeStandaloneItem(raw);
        if (!item || seenUids.has(item.uid)) continue;
        if (db.isDone(item.url) || db.isFailed(item.url)) continue;
        seenUids.add(item.uid);
        if (item.offerId) {
          cache.offerListingUids.set(item.offerId, item.uid);
        }
        fresh.push(item);
      }
      if (fresh.length > 0) {
        unknownBuffer.unshift(...fresh);
        if (flush) flushUnknownBuffer(true);
        syncStatus(true);
      }
      return fresh.length;
    }, "enqueuePriorityItems");
    const claimVisibleItems = /* @__PURE__ */ __name((items = []) => {
      if (!Array.isArray(items) || items.length === 0) {
        return Promise.resolve({ queued: 0, claimed: 0, owned: 0, fallback: 0, failed: 0 });
      }
      if (running) {
        const queued = enqueuePriorityItems(items);
        return Promise.resolve({ queued, claimed: 0, owned: 0, fallback: 0, failed: 0 });
      }
      const job = /* @__PURE__ */ __name(async () => {
        if (running) {
          const queued = enqueuePriorityItems(items);
          return { queued, claimed: 0, owned: 0, fallback: 0, failed: 0 };
        }
        const db = getDatabase();
        const cache = getDataCache();
        const apiClaim = getApiClaim();
        const cfg = getConfig();
        const st = getState();
        const fresh = [];
        for (const raw of items) {
          const item = normalizeStandaloneItem(raw);
          if (!item) continue;
          if (sightClaimSet.has(item.uid) || db.isDone(item.url) || db.isFailed(item.url)) continue;
          sightClaimSet.add(item.uid);
          if (item.offerId) {
            cache.offerListingUids.set(item.offerId, item.uid);
          }
          fresh.push(item);
        }
        if (fresh.length === 0) {
          return { queued: 0, claimed: 0, owned: 0, fallback: 0, failed: 0 };
        }
        sightClaimInFlightCount += fresh.length;
        try {
          try {
            onUiUpdate(buildSnapshot());
          } catch (_e) {
          }
          let owned = 0;
          let claimed = 0;
          let fallback = 0;
          let failed = 0;
          const unowned = [];
          let sightAuthAborted = false;
          for (let i = 0; i < fresh.length && !sightAuthAborted; i += STATES_MAX_IDS) {
            const chunk = fresh.slice(i, i + STATES_MAX_IDS);
            const u = new URL(`https://www.fab.com${STATES_PATH}`);
            chunk.forEach((item) => u.searchParams.append("listing_ids", item.uid));
            let resolved = false;
            for (let attempt = 0; attempt < 2 && !resolved && !sightAuthAborted; attempt += 1) {
              const now = nowFn();
              if (now < pauseUntil) {
                await sleep(Math.min(2e3, pauseUntil - now));
              }
              let res;
              try {
                res = await doFetch(u.toString());
              } catch (_e) {
                await sleep(Math.min(500, rateLimitBaseBackoffMs));
                continue;
              }
              const status = Number(res?.status) || 0;
              if (status === 429) {
                await handleRateLimit(parseRetryAfterMs2(res), "visible-states");
                continue;
              }
              if (status === 401 || status === 403) {
                sightAuthAborted = true;
                onAuthFailure();
                break;
              }
              if (status >= 200 && status < 300) {
                resolved = true;
                let raw = [];
                try {
                  raw = JSON.parse(res.responseText || "[]");
                } catch (_e) {
                  raw = [];
                }
                const states = Array.isArray(raw) ? raw : API.extractStateData(raw, "FastScanner") || [];
                const acquiredSet = new Set(
                  states.filter((s) => s && s.acquired && s.uid).map((s) => String(s.uid).toLowerCase())
                );
                const ownedUrls = [];
                const ownedItems = [];
                chunk.forEach((item) => {
                  if (acquiredSet.has(item.uid)) {
                    ownedUrls.push(item.url);
                    ownedItems.push(item);
                  } else {
                    unowned.push(item);
                  }
                });
                if (ownedUrls.length > 0) {
                  db.addDoneUrls(ownedUrls);
                  db.scheduleSaveDone();
                  owned += ownedUrls.length;
                  ownedItems.forEach((it) => notifyItemClaimed(it, "server-owned"));
                }
              } else {
                await sleep(Math.min(500, rateLimitBaseBackoffMs));
              }
            }
            if (!resolved && !sightAuthAborted) {
              unowned.push(...chunk);
            }
          }
          for (let idx = 0; idx < unowned.length && !sightAuthAborted; idx += 1) {
            const task = unowned[idx];
            if (db.isDone(task.url)) continue;
            if (isConfirmedBundleTask(task)) {
              await routeToFallback(task);
              fallback += 1;
              continue;
            }
            const canApiClaim = Boolean(cfg.USE_API_CLAIM && typeof apiClaim.isAvailable === "function" && apiClaim.isAvailable());
            if (!canApiClaim) {
              await routeToFallback(task);
              fallback += 1;
              continue;
            }
            const now = nowFn();
            if (now < pauseUntil) {
              await sleep(Math.min(2e3, pauseUntil - now));
            }
            if (claimIntervalMs > 0) {
              const sinceLast = nowFn() - lastClaimAt;
              if (sinceLast < claimIntervalMs) {
                await sleep(claimIntervalMs - sinceLast);
              }
              lastClaimAt = nowFn();
            }
            let outcome = await runClaimWithSlowPathGuard(task, apiClaim);
            if (outcome.serverInternalError && task.offerId) {
              outcome = await runClaimWithSlowPathGuard({ ...task, offerId: "" }, apiClaim);
            }
            if (outcome.result === CLAIM_RESULT.SUCCESS) {
              noteSuccess();
              await db.markAsDone(task, { deferSave: true });
              st.sessionCompleted?.add(db.normalizeListingUrl(task.url));
              claimed += 1;
              notifyItemClaimed(task, "claimed");
              logMsg("info", `\u2713 \u81EA\u52A8\u5165\u5E93 \xB7 ${task.name}`);
            } else if (outcome.result === CLAIM_RESULT.RATE_LIMITED) {
              await handleRateLimit(outcome.retryAfterMs, "visible-claim");
              const retries = (task._sightRateRetries || 0) + 1;
              if (retries <= 2) {
                task._sightRateRetries = retries;
                unowned.push(task);
              } else {
                const failRes = await db.markAsFailed(task, { reason: `\u9650\u901F\u91CD\u8BD5\u5931\u8D25 (${retries - 1} \u6B21)` });
                if (failRes && failRes.retried) fallback += 1;
                else failed += 1;
              }
            } else if (outcome.isBundle) {
              task.listingType = "bundle";
              task.isBundle = true;
              await routeToFallback(task);
              fallback += 1;
            } else if (outcome.serverInternalError) {
              const failRes = await db.markAsFailed(task, { reason: "Fab \u670D\u52A1\u7AEF\u5185\u90E8\u9519\u8BEF (500 Internal error)\uFF0C\u5B98\u7F51\u6309\u94AE\u4EA6\u65E0\u6CD5\u5165\u5E93" });
              if (failRes && failRes.retried) fallback += 1;
              else failed += 1;
            } else if (outcome.result === CLAIM_RESULT.UNAVAILABLE || outcome.retryable === true) {
              await routeToFallback(task);
              fallback += 1;
            } else {
              const reason = outcome.reason || "\u9886\u53D6\u5931\u8D25";
              if (/CSRF|401|未登录|会话/i.test(reason)) {
                sightAuthAborted = true;
                onAuthFailure();
                break;
              }
              if (task.needsDiscountVerify && /未找到免费许可/.test(reason)) {
                continue;
              }
              const failRes = await db.markAsFailed(task, { reason });
              if (failRes && failRes.retried) fallback += 1;
              else failed += 1;
            }
          }
          await db.flushSaveDone();
          try {
            onUiUpdate(buildSnapshot());
          } catch (_e) {
          }
          return { queued: 0, claimed, owned, fallback, failed };
        } finally {
          fresh.forEach((it) => sightClaimSet.delete(it.uid));
          sightClaimInFlightCount = Math.max(0, sightClaimInFlightCount - fresh.length);
          try {
            onUiUpdate(buildSnapshot());
          } catch (_e) {
          }
        }
      }, "job");
      const run = sightClaimChain.then(job, job);
      sightClaimChain = run.catch(() => {
      });
      return run;
    }, "claimVisibleItems");
    const configure = /* @__PURE__ */ __name((nextDeps = {}) => {
      if (typeof nextDeps.onUiUpdate === "function") onUiUpdate = nextDeps.onUiUpdate;
      if (typeof nextDeps.onToast === "function") onToast = nextDeps.onToast;
      if (typeof nextDeps.onAuthFailure === "function") onAuthFailure = nextDeps.onAuthFailure;
      if (typeof nextDeps.onItemClaimed === "function") onItemClaimed = nextDeps.onItemClaimed;
      if (typeof nextDeps.enqueueWorkerFallback === "function") enqueueFallbackFn = nextDeps.enqueueWorkerFallback;
    }, "configure");
    return {
      configure,
      start,
      stop,
      clearCheckpoint,
      setConcurrency,
      enqueuePriorityItems,
      claimVisibleItems,
      isRunning: /* @__PURE__ */ __name(() => running, "isRunning"),
      getStatus: /* @__PURE__ */ __name(() => buildSnapshot(), "getStatus")
    };
  }, "createFastScanner");
  var FastScanner = createFastScanner();

  // src/modules/task-runner.js
  var enrichTaskFromCache = /* @__PURE__ */ __name((uid, baseTask) => {
    const cachedListing = uid ? DataCache.listings.get(uid) : null;
    if (!cachedListing) return baseTask;
    const cachedOfferId = cachedListing?.startingPrice?.offerId || cachedListing?.startingPrice?.offer_id || cachedListing?.offerId || "";
    const cachedListingType = typeof cachedListing?.listingType === "string" ? cachedListing.listingType : "";
    return {
      ...baseTask,
      ...cachedOfferId ? { offerId: cachedOfferId } : {},
      ...cachedListingType ? { listingType: cachedListingType } : {}
    };
  }, "enrichTaskFromCache");
  var _realSetTimeout = typeof setTimeout === "function" ? setTimeout : (cb) => {
    try {
      cb();
    } catch (_e) {
    }
  };
  var MEM_RECYCLE_KEYS = {
    COUNT: "fab_helper_mem_recycle_count_v1",
    LAST_AT: "fab_helper_mem_recycle_last_at_v1",
    LAST_CURSOR: "fab_helper_mem_recycle_last_cursor_v1",
    STRIKES: "fab_helper_mem_recycle_strikes_v1",
    PENDING: "fab_helper_mem_recycle_pending_v1"
  };
  var UI4 = null;
  var countdownRefresh2 = null;
  var reloadPage = /* @__PURE__ */ __name(() => {
    if (typeof location !== "undefined" && typeof location.reload === "function") {
      location.reload();
    }
  }, "reloadPage");
  var registerWorkerDoneListener = null;
  function setUIReference3(uiModule) {
    UI4 = uiModule;
  }
  __name(setUIReference3, "setUIReference");
  function setDependencies2(deps = {}) {
    countdownRefresh2 = deps.countdownRefresh || countdownRefresh2;
    registerWorkerDoneListener = deps.registerWorkerDoneListener || registerWorkerDoneListener;
    reloadPage = deps.reloadPage || reloadPage;
  }
  __name(setDependencies2, "setDependencies");
  var TaskRunner2 = {
    findFreeLicenseOption: /* @__PURE__ */ __name((root) => {
      if (!root || typeof root.querySelectorAll !== "function") {
        return null;
      }
      const candidates = Array.from(root.querySelectorAll("span, div")).map((el) => {
        const text = Utils.normalizeWhitespace(el.textContent || "");
        const clickTarget = el.closest('[role="option"], button, label, input[type="radio"]');
        return { text, clickTarget };
      }).filter((candidate) => candidate.text && candidate.clickTarget);
      const hasExplicitFreeSignal = /* @__PURE__ */ __name((text) => {
        const cleanText = text.replace(/royalty\s*-?\s*free/gi, "");
        return [...Config.FREE_TEXT_SET].some((freeWord) => cleanText.includes(freeWord));
      }, "hasExplicitFreeSignal");
      const explicitFree = candidates.find((candidate) => hasExplicitFreeSignal(candidate.text));
      if (explicitFree) {
        return explicitFree.clickTarget;
      }
      const personalFree = candidates.find((candidate) => {
        const isPersonal = candidate.text.includes("\u4E2A\u4EBA") || candidate.text.includes("Personal");
        return isPersonal && hasExplicitFreeSignal(candidate.text);
      });
      return personalFree ? personalFree.clickTarget : null;
    }, "findFreeLicenseOption"),
    getExternalProductState: /* @__PURE__ */ __name((root = document) => {
      if (!root || typeof root.querySelectorAll !== "function") {
        return { handled: false };
      }
      try {
        const buttons = root.querySelectorAll('button, a.fabkit-Button-root, [role="button"], a[class*="Button"], a[class*="button"]');
        if (buttons && buttons.length > 0) {
          const hasAcquisitionButton = [...buttons].some((btn) => {
            const text2 = Utils.normalizeWhitespace(btn?.textContent || "").toLowerCase();
            return [...Config.ACQUISITION_TEXT_SET].some((k) => text2.includes(k.toLowerCase()));
          });
          if (hasAcquisitionButton) {
            return { handled: false };
          }
        }
      } catch (e) {
      }
      const currentHref = typeof window !== "undefined" && window.location?.href ? window.location.href : "https://www.fab.com/";
      const currentHostname = typeof window !== "undefined" && window.location?.hostname ? window.location.hostname : "www.fab.com";
      let links = [];
      try {
        links = [...root.querySelectorAll("a[href]")];
      } catch (e) {
        return { handled: false };
      }
      const externalLink = links.find((link) => {
        const text2 = Utils.normalizeWhitespace(link.textContent || "");
        if (!text2 || ![...Config.EXTERNAL_CTA_TEXT_SET].some((label) => text2.includes(label))) {
          return false;
        }
        const rect = typeof link.getBoundingClientRect === "function" ? link.getBoundingClientRect() : { width: 1, height: 1 };
        if (rect.width === 0 || rect.height === 0) {
          return false;
        }
        try {
          const href = link.href || link.getAttribute?.("href");
          if (!href) return false;
          const targetUrl = new URL(href, currentHref);
          return targetUrl.hostname !== currentHostname;
        } catch (error) {
          return false;
        }
      });
      if (!externalLink) {
        return { handled: false };
      }
      const text = Utils.normalizeWhitespace(externalLink.textContent || "");
      return {
        handled: true,
        reason: `External CTA "${text}"`,
        href: externalLink.href || externalLink.getAttribute?.("href") || ""
      };
    }, "getExternalProductState"),
    hasSavedLibraryText: /* @__PURE__ */ __name((card) => {
      const cardText = Utils.normalizeWhitespace(card.textContent || "");
      return [...Config.SAVED_TEXT_SET].some((savedText) => cardText.includes(savedText));
    }, "hasSavedLibraryText"),
    hasPositivePriceText: /* @__PURE__ */ __name((text) => {
      const regex = /(?:[$¥€£₩₹₪₫₱฿]|USD|EUR|CNY|GBP|JPY|CAD|AUD)\s*(\d+(?:[.,]\d{1,2})?)\b|\b(\d+(?:[.,]\d{1,2})?)\s*(?:[$¥€£₩₹₪₫₱฿]|USD|EUR|CNY|GBP|JPY|CAD|AUD)/gi;
      const priceMatches = Utils.normalizeWhitespace(text || "").match(regex);
      if (!priceMatches) return false;
      return priceMatches.some((priceStr) => {
        let cleanStr = priceStr.replace(/[$¥€£₩₹₪₫₱฿]|USD|EUR|CNY|GBP|JPY|CAD|AUD/gi, "").trim();
        if (cleanStr.includes(",")) {
          if (/,\d{3}(?:\.|$)/.test(cleanStr)) {
            cleanStr = cleanStr.replace(/,/g, "");
          } else {
            cleanStr = cleanStr.replace(",", ".");
          }
        }
        const numValue = parseFloat(cleanStr);
        return !isNaN(numValue) && numValue > 0;
      });
    }, "hasPositivePriceText"),
    isCardSettled: /* @__PURE__ */ __name((card) => {
      const link = card.querySelector(Config.SELECTORS.cardLink);
      const url = link ? link.href.split("?")[0] : null;
      return card.querySelector(`${Config.SELECTORS.freeStatus}, ${Config.SELECTORS.ownedStatus}`) !== null || TaskRunner2.hasSavedLibraryText(card) || TaskRunner2.isFreeCard(card) || TaskRunner2.hasPositivePriceText(card.textContent || "") || url && (Database.isDone(url) || Database.isFailed(url) || State.sessionCompleted.has(Database.normalizeListingUrl(url)));
    }, "isCardSettled"),
    // Check if a card is finished (owned, done, or failed)
    isCardFinished: /* @__PURE__ */ __name((card) => {
      const link = card.querySelector(Config.SELECTORS.cardLink);
      const url = link ? link.href.split("?")[0] : null;
      const hasSavedText = TaskRunner2.hasSavedLibraryText(card);
      if (!link) {
        const icons = card.querySelectorAll("i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled");
        if (icons.length > 0) return true;
        return hasSavedText;
      }
      const uidMatch = link.href.match(/(?:listings|bundles)\/([a-f0-9-]+)/i);
      if (!uidMatch || !uidMatch[1]) return false;
      const uid = uidMatch[1];
      if (DataCache.ownedStatus.has(uid)) {
        const status = DataCache.ownedStatus.get(uid);
        if (status && status.acquired) return true;
      }
      if (card.querySelector(Config.SELECTORS.ownedStatus) !== null || hasSavedText) {
        if (uid) {
          DataCache.saveOwnedStatus([{
            uid,
            acquired: true,
            lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }]);
        }
        return true;
      }
      if (url) {
        if (Database.isDone(url)) return true;
        if (Database.isFailed(url)) return true;
        if (State.sessionCompleted.has(Database.normalizeListingUrl(url))) return true;
      }
      return false;
    }, "isCardFinished"),
    // Check if a card represents a free item
    isFreeCard: /* @__PURE__ */ __name((card) => {
      const rawText = card.textContent || "";
      const cardText = Utils.normalizeWhitespace(rawText);
      const cleanText = cardText.replace(/royalty\s*-?\s*free/gi, "");
      const hasFreeKeyword = [...Config.FREE_TEXT_SET].some((freeWord) => cleanText.includes(freeWord));
      const has100PercentDiscount = /-\s*100\s*%\s*(?:OFF|折扣)?/i.test(cleanText);
      const hasPositivePrice = TaskRunner2.hasPositivePriceText(cardText);
      if (hasPositivePrice) {
        if (!has100PercentDiscount && !hasFreeKeyword) {
          return false;
        }
      }
      return hasFreeKeyword || has100PercentDiscount;
    }, "isFreeCard"),
    // Check if a card is a discounted paid item
    isDiscountedPaidCard: /* @__PURE__ */ __name((card) => {
      if (TaskRunner2.isFreeCard(card)) return false;
      const rawText = card.textContent || "";
      const cardText = Utils.normalizeWhitespace(rawText);
      const hasDiscountTag = /-\d+%/.test(cardText) || cardText.includes("% off") || cardText.includes("% Off");
      if (!hasDiscountTag) return false;
      return TaskRunner2.hasPositivePriceText(cardText);
    }, "isDiscountedPaidCard"),
    syncClaimedCardToDom: /* @__PURE__ */ __name((uidOrUrl) => {
      if (!uidOrUrl) return 0;
      const raw = String(uidOrUrl).trim();
      const uid = (raw.match(/(?:listings|bundles)\/([a-f0-9-]+)/i)?.[1] || raw).toLowerCase();
      if (!uid) return 0;
      DataCache.saveOwnedStatus([{
        uid,
        acquired: true,
        lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }]);
      if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return 0;
      }
      const badgeText = State.lang === "zh" ? "\u2705 \u5DF2\u4FDD\u5B58\u5728\u6211\u7684\u5E93\u4E2D" : "\u2705 Saved in My Library";
      const cards = [...document.querySelectorAll(Config.SELECTORS.card)];
      const isInsideOrContainsLink = /* @__PURE__ */ __name((el) => {
        if (!el) return false;
        if (el.tagName === "A") return true;
        if (typeof el.querySelector === "function" && el.querySelector("a[href]")) return true;
        if (typeof el.closest === "function" && el.closest("a[href]")) return true;
        let cur = el.parentElement;
        while (cur) {
          if (cur.tagName === "A") return true;
          cur = cur.parentElement;
        }
        return false;
      }, "isInsideOrContainsLink");
      const prefixedFreeRe = /^(?:起始价格\s*免费|低至\s*免费|Starting at\s*Free|From\s*Free|选择许可.*免费.*)/i;
      const plainFreeRe = /^(?:起始价格\s*免费|低至\s*免费|Starting at\s*Free|From\s*Free|选择许可.*免费.*|免费|Free\*?|\$?0\.00|-\s*100\s*%(?:\s*OFF|\s*折扣)?)(?:\s*-\s*100\s*%(?:\s*OFF|\s*折扣)?)?$/i;
      let updated = 0;
      cards.forEach((card) => {
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const href = link ? link.href || link.getAttribute?.("href") || "" : "";
        const cardUid = href.match(/(?:listings|bundles)\/([a-f0-9-]+)/i)?.[1]?.toLowerCase() || "";
        if (cardUid !== uid) return;
        card.removeAttribute("data-fab-processed");
        updated += 1;
        if (!TaskRunner2.hasSavedLibraryText(card) && !card.querySelector('[data-fab-owned-badge="true"]')) {
          const badgeEl = document.createElement("span");
          badgeEl.className = "fab-helper-owned-inline";
          badgeEl.setAttribute("data-fab-owned-badge", "true");
          badgeEl.textContent = badgeText;
          let targetNode = card.querySelector(Config.SELECTORS.freeStatus);
          if (!targetNode || isInsideOrContainsLink(targetNode)) {
            targetNode = null;
            const descendants = [...card.querySelectorAll("*")];
            let prefixedMatch = null;
            let plainMatch = null;
            for (const el of descendants) {
              if (isInsideOrContainsLink(el)) continue;
              const text = Utils.normalizeWhitespace(el.textContent || "");
              if (!text || text.length > 48) continue;
              if (prefixedFreeRe.test(text) && plainFreeRe.test(text)) {
                if (!prefixedMatch) prefixedMatch = el;
              } else if (plainFreeRe.test(text)) {
                plainMatch = el;
              }
            }
            targetNode = prefixedMatch || plainMatch;
          }
          if (targetNode) {
            targetNode.innerHTML = "";
            targetNode.textContent = "";
            targetNode.appendChild(badgeEl);
          } else {
            card.appendChild(badgeEl);
          }
        }
      });
      if (updated > 0) {
        TaskRunner2.invalidateCardCountCache();
        if (State.hideSaved) {
          TaskRunner2.scheduleHideOrShow();
        } else if (UI4) {
          UI4.update();
        }
      }
      return updated;
    }, "syncClaimedCardToDom"),
    collectVisibleFreeTasks: /* @__PURE__ */ __name(() => {
      if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
        return [];
      }
      const cards = [...document.querySelectorAll(TaskRunner2.getVisibleCardSelector())];
      const tasks = [];
      const seen = /* @__PURE__ */ new Set();
      cards.forEach((card) => {
        if (TaskRunner2.isCardHidden(card)) return;
        if (!TaskRunner2.isCardSettled(card)) return;
        if (TaskRunner2.isCardFinished(card)) return;
        if (!TaskRunner2.isFreeCard(card)) return;
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const rawHref = link ? link.href || link.getAttribute?.("href") || "" : "";
        if (!rawHref) return;
        const uidMatch = rawHref.match(/\/(listings|bundles)\/([^/?#]+)/i);
        if (!uidMatch) return;
        const kind = uidMatch[1].toLowerCase();
        const uid = uidMatch[2].toLowerCase();
        if (seen.has(uid)) return;
        seen.add(uid);
        const url = `https://www.fab.com/${kind}/${uid}`;
        if (Database.isDone(url) || Database.isFailed(url) || Database.isTodo(url)) return;
        const name = card.querySelector('a[aria-label*="\u521B\u4F5C\u7684"], a[aria-label*="by "]')?.textContent.trim() || link?.textContent.trim() || Utils.getText("untitled");
        const isBundle = kind === "bundles";
        tasks.push(enrichTaskFromCache(uid, {
          uid,
          name,
          url,
          type: "detail",
          listingType: isBundle ? "bundle" : "",
          isBundle
        }));
      });
      return tasks;
    }, "collectVisibleFreeTasks"),
    claimVisibleDomCards: /* @__PURE__ */ __name(async () => {
      if (State.isWorkerTab || State.manualVerificationPending || State.appStatus === "RATE_LIMITED") {
        return { queued: 0, claimed: 0, owned: 0 };
      }
      if (!Utils.checkAuthentication(true)) {
        return { queued: 0, claimed: 0, owned: 0 };
      }
      const tasks = TaskRunner2.collectVisibleFreeTasks();
      if (tasks.length === 0) {
        return { queued: 0, claimed: 0, owned: 0 };
      }
      FastScanner.configure({
        onUiUpdate: /* @__PURE__ */ __name(() => {
          if (UI4) UI4.update();
        }, "onUiUpdate"),
        onToast: /* @__PURE__ */ __name((msg, persist) => {
          if (UI4 && typeof UI4.showToast === "function") UI4.showToast(msg, persist);
        }, "onToast"),
        onAuthFailure: /* @__PURE__ */ __name(() => {
          Utils.notifyAuthFailure();
          TaskRunner2.stop();
        }, "onAuthFailure"),
        onItemClaimed: /* @__PURE__ */ __name((item) => TaskRunner2.syncClaimedCardToDom(item?.uid || item?.url), "onItemClaimed"),
        enqueueWorkerFallback: /* @__PURE__ */ __name((task) => TaskRunner2.enqueueWorkerFallback(task), "enqueueWorkerFallback")
      });
      return FastScanner.claimVisibleItems(tasks);
    }, "claimVisibleDomCards"),
    // Toggle execution state
    enqueueWorkerFallback: /* @__PURE__ */ __name(async (task) => {
      if (!task || !task.uid) return false;
      if (!Array.isArray(State.db.todo)) State.db.todo = [];
      const cleanUrl = Database.normalizeListingUrl(task.url);
      const alreadyTodo = State.db.todo.some(
        (t) => t.uid === task.uid || Database.normalizeListingUrl(t.url) === cleanUrl
      );
      const alreadyRunning = Object.values(State.runningWorkers || {}).some((w) => w?.task?.uid === task.uid);
      if (alreadyTodo || alreadyRunning) return false;
      State.db.todo.push(task);
      await Database.saveTodo();
      if (State.isExecuting && TaskRunner2.hasDispatchSlot()) {
        TaskRunner2.executeBatch();
      }
      if (UI4) UI4.update();
      return true;
    }, "enqueueWorkerFallback"),
    startFastScan: /* @__PURE__ */ __name(async () => {
      if (typeof InstanceManager !== "undefined" && InstanceManager.activate) {
        InstanceManager.activate();
      }
      FastScanner.configure({
        onUiUpdate: /* @__PURE__ */ __name(() => {
          if (UI4) UI4.update();
        }, "onUiUpdate"),
        onToast: /* @__PURE__ */ __name((msg, persist) => {
          if (UI4 && typeof UI4.showToast === "function") UI4.showToast(msg, persist);
        }, "onToast"),
        onAuthFailure: /* @__PURE__ */ __name(() => {
          Utils.notifyAuthFailure();
          TaskRunner2.stop();
        }, "onAuthFailure"),
        onItemClaimed: /* @__PURE__ */ __name((item) => TaskRunner2.syncClaimedCardToDom(item?.uid || item?.url), "onItemClaimed"),
        enqueueWorkerFallback: /* @__PURE__ */ __name((task) => TaskRunner2.enqueueWorkerFallback(task), "enqueueWorkerFallback")
      });
      const priorityItems = TaskRunner2.collectVisibleFreeTasks();
      KeepAlive.start();
      State.isExecuting = true;
      Database.saveExecutingState();
      if (UI4) UI4.update();
      try {
        const summary = await FastScanner.start({
          globalFreeScan: true,
          priorityItems
        });
        if (summary?.phase === "completed") {
          State.hasFastScanCheckpoint = false;
          State.fastScanCheckpointMeta = null;
        }
        if (!State.isExecuting) return summary;
        if (State.db.todo.length > 0 || State.activeWorkers > 0) {
          if (TaskRunner2.hasDispatchSlot() && State.db.todo.length > 0) {
            TaskRunner2.executeBatch();
          }
        } else {
          State.isExecuting = false;
          Database.saveExecutingState();
          KeepAlive.stop();
          await Database.flushSaveDone();
        }
        if (UI4) UI4.update();
        return summary;
      } catch (error) {
        if (State.isExecuting && State.db.todo.length === 0 && State.activeWorkers === 0) {
          State.isExecuting = false;
          Database.saveExecutingState();
          KeepAlive.stop();
        }
        await Database.flushSaveDone();
        if (UI4) UI4.update();
        throw error;
      }
    }, "startFastScan"),
    toggleExecution: /* @__PURE__ */ __name(async () => {
      if (!Utils.checkAuthentication()) return;
      if (State.isExecuting || FastScanner.isRunning()) {
        if (FastScanner.isRunning()) {
          await FastScanner.stop({ drainDiscovered: true });
        }
        State.isExecuting = false;
        Database.saveExecutingState();
        await Database.flushSaveDone();
        KeepAlive.stop();
        State.runningWorkers = {};
        State.activeWorkers = 0;
        State.executionTotalTasks = 0;
        State.executionCompletedTasks = 0;
        State.executionFailedTasks = 0;
        State.processedCardUids = /* @__PURE__ */ new Set();
        State.knownCursors = /* @__PURE__ */ new Set();
        State.sessionCompleted = /* @__PURE__ */ new Set();
        State.sessionFailed = /* @__PURE__ */ new Set();
        State.autoScrollAttempts = 0;
        Utils.logger("info", Utils.getText("log_execution_stopped"));
        if (UI4) UI4.update();
        return;
      }
      State.manualVerificationPending = false;
      const sessionOk = await Utils.verifyServerSession();
      if (!sessionOk) {
        Utils.notifyAuthFailure();
        return;
      }
      if (!State.domFallbackMode) {
        return await TaskRunner2.startFastScan();
      }
      if (State.autoAddOnScroll || State.autoScroll) {
        Utils.logger("info", Utils.getText("log_auto_add_enabled"));
        Utils.logger("debug", "\u542F\u52A8\u4EFB\u52A1\u524D\u6B63\u5728\u786E\u8BA4\u5F53\u524D\u9875\u9762\u5546\u54C1\u8BC6\u522B\u72B6\u6001...");
        TaskRunner2.checkVisibleCardsStatus().then(() => {
          Utils.logger("debug", "\u6B63\u5728\u626B\u63CF\u5F53\u524D\u9875\u9762\u7B26\u5408\u6761\u4EF6\u7684\u5546\u54C1...");
          TaskRunner2.scanAndAddTasks(document.querySelectorAll(TaskRunner2.getVisibleCardSelector())).then(() => {
            TaskRunner2.startExecution();
          });
        });
        return;
      }
      State.db.todo = [];
      Utils.logger("info", Utils.getText("log_todo_cleared"));
      Utils.logger("debug", Utils.getText("log_scanning_items"));
      const cards = document.querySelectorAll(TaskRunner2.getVisibleCardSelector());
      const newlyAddedList = [];
      let alreadyInQueueCount = 0;
      let ownedCount = 0;
      let skippedCount = 0;
      cards.forEach((card) => {
        if (TaskRunner2.isCardHidden(card)) return;
        if (!TaskRunner2.isCardSettled(card)) {
          skippedCount++;
          return;
        }
        if (TaskRunner2.isCardFinished(card)) {
          ownedCount++;
          return;
        }
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const url = link ? link.href.split("?")[0] : null;
        if (!url) return;
        if (Database.isTodo(url)) {
          alreadyInQueueCount++;
          return;
        }
        if (!TaskRunner2.isFreeCard(card)) return;
        const name = card.querySelector('a[aria-label*="\u521B\u4F5C\u7684"]')?.textContent.trim() || card.querySelector(Config.SELECTORS.cardLink)?.textContent.trim() || Utils.getText("untitled");
        const uid = url.split("/").pop();
        newlyAddedList.push(enrichTaskFromCache(uid, { name, url, type: "detail", uid }));
      });
      if (skippedCount > 0) {
        Utils.logger("debug", Utils.getText("log_skipped_unsettled", skippedCount));
      }
      if (newlyAddedList.length > 0) {
        State.db.todo.push(...newlyAddedList);
        Utils.logger("info", Utils.getText("log_added_to_queue", newlyAddedList.length));
      }
      const actionableCount = State.db.todo.length;
      if (actionableCount > 0) {
        if (newlyAddedList.length === 0 && alreadyInQueueCount > 0) {
          Utils.logger("info", Utils.getText("log_all_in_queue", alreadyInQueueCount));
        }
        TaskRunner2.checkVisibleCardsStatus().then(() => {
          TaskRunner2.startExecution();
        });
      } else {
        Utils.logger("info", Utils.getText("log_no_new_items", ownedCount, skippedCount));
        if (UI4) UI4.update();
      }
    }, "toggleExecution"),
    // Start execution without scanning
    startExecution: /* @__PURE__ */ __name(() => {
      if (State.manualVerificationPending) return;
      if (State.isExecuting) {
        const newTotal = State.db.todo.length;
        if (newTotal > State.executionTotalTasks) {
          Utils.logger("info", Utils.getText("log_new_tasks_added", newTotal));
          State.executionTotalTasks = newTotal;
          if (UI4) UI4.update();
        } else {
          Utils.logger("info", Utils.getText("log_executor_running"));
        }
        return;
      }
      if (State.db.todo.length === 0) {
        Utils.logger("debug", Utils.getText("log_exec_no_tasks"));
        return;
      }
      Utils.logger("info", Utils.getText("log_starting_execution", State.db.todo.length));
      if (typeof InstanceManager !== "undefined" && InstanceManager.activate) {
        InstanceManager.activate();
      }
      KeepAlive.start();
      State.isExecuting = true;
      Database.saveExecutingState();
      State.executionTotalTasks = State.db.todo.length;
      State.executionCompletedTasks = 0;
      State.executionFailedTasks = 0;
      State.autoScrollAttempts = 0;
      if (UI4) UI4.update();
      TaskRunner2.executeBatch();
    }, "startExecution"),
    // Toggle hide saved items
    toggleHideSaved: /* @__PURE__ */ __name(async () => {
      State.hideSaved = !State.hideSaved;
      await Database.saveHidePref();
      TaskRunner2.runHideOrShow();
      if (!State.hideSaved) {
        const { visible: actualVisibleCount } = TaskRunner2.getCardCounts(true);
        Utils.logger("info", Utils.getText("log_display_mode_switched", actualVisibleCount));
      }
      if (UI4) UI4.update();
    }, "toggleHideSaved"),
    toggleAutoAdd: /* @__PURE__ */ __name(async () => {
      if (State.isTogglingSetting) return;
      State.isTogglingSetting = true;
      State.autoAddOnScroll = !State.autoAddOnScroll;
      await Database.saveAutoAddPref();
      Utils.logger("info", Utils.getText("log_auto_add_toggle", State.autoAddOnScroll ? Utils.getText("status_enabled") : Utils.getText("status_disabled")));
      setTimeout(() => {
        State.isTogglingSetting = false;
      }, 200);
    }, "toggleAutoAdd"),
    // 切换「脚本自动滚动页面以扫描全部」开关（默认关，独立于 autoAddOnScroll）
    toggleAutoScroll: /* @__PURE__ */ __name(async () => {
      if (State.isTogglingSetting) return;
      State.isTogglingSetting = true;
      State.autoScroll = !State.autoScroll;
      if (State.autoScroll) {
        State.isEndOfSearchList = false;
        State.autoScrollAttempts = 0;
        State.hasReachedBottomToastShown = false;
      }
      await Database.saveAutoScrollPref();
      Utils.logger("info", Utils.getText("log_auto_scroll_toggle", State.autoScroll ? Utils.getText("status_enabled") : Utils.getText("status_disabled")));
      setTimeout(() => {
        State.isTogglingSetting = false;
      }, 200);
    }, "toggleAutoScroll"),
    toggleAutoResume: /* @__PURE__ */ __name(async () => {
      if (State.isTogglingSetting) return;
      State.isTogglingSetting = true;
      State.autoResumeAfter429 = !State.autoResumeAfter429;
      await Database.saveAutoResumePref();
      Utils.logger("info", Utils.getText("log_auto_resume_toggle", State.autoResumeAfter429 ? Utils.getText("status_enabled") : Utils.getText("status_disabled")));
      setTimeout(() => {
        State.isTogglingSetting = false;
      }, 200);
    }, "toggleAutoResume"),
    toggleRememberPosition: /* @__PURE__ */ __name(async () => {
      if (State.isTogglingSetting) return;
      State.isTogglingSetting = true;
      State.rememberScrollPosition = !State.rememberScrollPosition;
      await Database.saveRememberPosPref();
      Utils.logger("info", Utils.getText("log_remember_pos_toggle", State.rememberScrollPosition ? Utils.getText("status_enabled") : Utils.getText("status_disabled")));
      if (!State.rememberScrollPosition) {
        if (typeof PagePatcher !== "undefined" && PagePatcher.clearSavedPosition) {
          await PagePatcher.clearSavedPosition("Remember position disabled");
        } else {
          await GM_deleteValue(Config.DB_KEYS.LAST_CURSOR);
          if (typeof sessionStorage !== "undefined") {
            try {
              sessionStorage.removeItem("fab_helper_recovery_cursor");
              sessionStorage.removeItem("fab_helper_last_recovery_cursor");
            } catch (e) {
            }
          }
          State.savedCursor = null;
        }
      } else {
        if (typeof PagePatcher !== "undefined" && PagePatcher.releaseResetGuard) {
          PagePatcher.releaseResetGuard("remember position enabled");
        }
        if (typeof PagePatcher !== "undefined" && PagePatcher.unlockCursorSaving) {
          PagePatcher.unlockCursorSaving();
        }
        if (State.UI && State.UI.savedPositionDisplay) {
          State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(State.savedCursor);
        }
      }
      setTimeout(() => {
        State.isTogglingSetting = false;
      }, 200);
    }, "toggleRememberPosition"),
    toggleAutoRefreshEmpty: /* @__PURE__ */ __name(async () => {
      if (State.isTogglingSetting) return;
      State.isTogglingSetting = true;
      State.autoRefreshEmptyPage = !State.autoRefreshEmptyPage;
      await Database.saveAutoRefreshEmptyPref();
      Utils.logger("info", Utils.getText("log_auto_refresh_toggle", State.autoRefreshEmptyPage ? Utils.getText("status_enabled") : Utils.getText("status_disabled")));
      setTimeout(() => {
        State.isTogglingSetting = false;
      }, 200);
    }, "toggleAutoRefreshEmpty"),
    toggleHideDiscountedPaid: /* @__PURE__ */ __name(async () => {
      State.hideDiscountedPaid = !State.hideDiscountedPaid;
      await Database.saveHideDiscountedPref();
      TaskRunner2.runHideOrShow();
      if (State.hideDiscountedPaid) {
        Utils.logger("info", "\u5DF2\u5F00\u542F\u9690\u85CF\u6253\u6298\u4ED8\u8D39\u5546\u54C1");
      } else {
        Utils.logger("info", "\u5DF2\u5173\u95ED\u9690\u85CF\u6253\u6298\u4ED8\u8D39\u5546\u54C1");
      }
      if (UI4) UI4.update();
    }, "toggleHideDiscountedPaid"),
    toggleHidePaid: /* @__PURE__ */ __name(async () => {
      State.hidePaid = !State.hidePaid;
      await Database.saveHidePaidPref();
      TaskRunner2.runHideOrShow();
      if (State.hidePaid) {
        Utils.logger("info", "\u5DF2\u5F00\u542F\u9690\u85CF\u4ED8\u8D39\u5546\u54C1");
      } else {
        Utils.logger("info", "\u5DF2\u5173\u95ED\u9690\u85CF\u4ED8\u8D39\u5546\u54C1");
      }
      if (UI4) UI4.update();
    }, "toggleHidePaid"),
    toggleBlockResources: /* @__PURE__ */ __name(async () => {
      State.blockLargeResources = !State.blockLargeResources;
      await Database.saveBlockResourcesPref();
      if (State.blockLargeResources) {
        Utils.logger("info", "\u5DF2\u5F00\u542F\u5DE5\u4F5C\u6807\u7B7E\u9875\u5927\u8D44\u6E90\u8FC7\u6EE4");
      } else {
        Utils.logger("info", "\u5DF2\u5173\u95ED\u5DE5\u4F5C\u6807\u7B7E\u9875\u5927\u8D44\u6E90\u8FC7\u6EE4");
      }
      if (UI4) UI4.update();
    }, "toggleBlockResources"),
    setMaxWorkers: /* @__PURE__ */ __name(async (count) => {
      const parsed = parseInt(count, 10);
      const safeVal = Math.max(1, Math.min(15, Number.isFinite(parsed) ? parsed : 7));
      State.maxWorkers = safeVal;
      await Database.saveMaxWorkersPref();
      Utils.logger("info", Utils.getText("log_max_workers_changed", safeVal));
      if (State.isExecuting && TaskRunner2.hasDispatchSlot()) {
        TaskRunner2.executeBatch();
      }
      if (UI4) UI4.update();
      return safeVal;
    }, "setMaxWorkers"),
    toggleAutoClaimVisible: /* @__PURE__ */ __name(async () => {
      State.autoClaimVisible = !State.autoClaimVisible;
      await Database.saveAutoClaimVisiblePref();
      Utils.logger(
        "info",
        Utils.getText("log_auto_claim_visible_toggle", State.autoClaimVisible ? Utils.getText("status_enabled") : Utils.getText("status_disabled"))
      );
      if (UI4) UI4.update();
      if (State.autoClaimVisible && !State.domFallbackMode) {
        TaskRunner2.claimVisibleDomCards().catch((e) => Utils.logger("debug", `[\u6D4F\u89C8\u81EA\u52A8\u9886] \u626B\u63CF\u5931\u8D25: ${e.message}`));
      }
      return State.autoClaimVisible;
    }, "toggleAutoClaimVisible"),
    setDomFallbackMode: /* @__PURE__ */ __name(async (enabled) => {
      const next = Boolean(enabled);
      if (State.isExecuting || FastScanner.isRunning()) {
        if (FastScanner.isRunning()) {
          await FastScanner.stop();
        }
        TaskRunner2.stop();
      }
      State.domFallbackMode = next;
      State.fastApiScan = !next;
      State.autoScroll = next;
      if (next) {
        State.isEndOfSearchList = false;
        State.autoScrollAttempts = 0;
        State.hasReachedBottomToastShown = false;
      }
      await Database.saveDomFallbackModePref();
      await Database.saveFastApiScanPref();
      await Database.saveAutoScrollPref();
      Utils.logger(
        "info",
        Utils.getText("log_dom_fallback_toggle", next ? Utils.getText("status_enabled") : Utils.getText("status_disabled"))
      );
      if (UI4) UI4.update();
      return next;
    }, "setDomFallbackMode"),
    setApiScanConcurrency: /* @__PURE__ */ __name(async (count) => {
      const parsed = parseInt(count, 10);
      const maxConc = Config.MAX_API_SCAN_CONCURRENCY || 6;
      const defConc = Config.DEFAULT_API_SCAN_CONCURRENCY || 4;
      const safeVal = Math.max(1, Math.min(maxConc, Number.isFinite(parsed) ? parsed : defConc));
      State.apiScanConcurrency = safeVal;
      await Database.saveApiScanConcurrencyPref();
      FastScanner.setConcurrency(safeVal);
      Utils.logger("info", Utils.getText("log_api_scan_concurrency_changed", safeVal));
      if (UI4) UI4.update();
      return safeVal;
    }, "setApiScanConcurrency"),
    stop: /* @__PURE__ */ __name(() => {
      if (FastScanner.isRunning()) {
        FastScanner.stop();
      }
      if (!State.isExecuting) return;
      State.isExecuting = false;
      Database.saveExecutingState();
      Database.saveTodo();
      KeepAlive.stop();
      State.runningWorkers = {};
      State.activeWorkers = 0;
      State.executionTotalTasks = 0;
      State.executionCompletedTasks = 0;
      State.executionFailedTasks = 0;
      State.processedCardUids = /* @__PURE__ */ new Set();
      State.knownCursors = /* @__PURE__ */ new Set();
      State.sessionCompleted = /* @__PURE__ */ new Set();
      State.sessionFailed = /* @__PURE__ */ new Set();
      State.autoScrollAttempts = 0;
      Utils.logger("info", Utils.getText("log_execution_stopped"));
      if (UI4) UI4.update();
    }, "stop"),
    runRecoveryProbe: /* @__PURE__ */ __name(async () => {
      const randomDelay = Math.floor(Math.random() * (3e4 - 15e3 + 1) + 15e3);
      Utils.logger("info", Utils.getText("log_recovery_probe", (randomDelay / 1e3).toFixed(1)));
      setTimeout(async () => {
        Utils.logger("info", Utils.getText("log_probing_connection"));
        try {
          const csrfToken = Utils.getCookie("fab_csrftoken");
          if (!csrfToken) {
            Utils.checkAuthentication();
            throw new Error("CSRF token not found for probe.");
          }
          const probeResponse = await API.gmFetch({
            method: "GET",
            url: "https://www.fab.com/i/users/context",
            headers: { "x-csrftoken": csrfToken, "x-requested-with": "XMLHttpRequest" }
          });
          if (probeResponse.status === 429) {
            throw new Error("Probe failed with 429. Still rate-limited.");
          } else if (probeResponse.status >= 200 && probeResponse.status < 300) {
            await PagePatcher.handleSearchResponse({ status: 200 });
            Utils.logger("info", Utils.getText("log_connection_restored"));
            TaskRunner2.toggleExecution();
          } else {
            throw new Error(`Probe failed with unexpected status: ${probeResponse.status}`);
          }
        } catch (e) {
          Utils.logger("error", Utils.getText("log_recovery_failed", e.message));
          setTimeout(() => location.reload(), 2e3);
        }
      }, randomDelay);
    }, "runRecoveryProbe"),
    refreshVisibleStates: /* @__PURE__ */ __name(async () => {
      const API_ENDPOINT = "https://www.fab.com/i/users/me/listings-states";
      const API_CHUNK_SIZE = 24;
      const isElementInViewport = /* @__PURE__ */ __name((el) => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
      }, "isElementInViewport");
      try {
        const csrfToken = Utils.getCookie("fab_csrftoken");
        if (!csrfToken) {
          Utils.checkAuthentication();
          throw new Error("CSRF token not found. Are you logged in?");
        }
        const uidsFromVisibleCards = new Set([...document.querySelectorAll(TaskRunner2.getVisibleCardSelector())].filter(isElementInViewport).filter((card) => {
          const link = card.querySelector(Config.SELECTORS.cardLink);
          if (!link) return false;
          const url = link.href.split("?")[0];
          return !Database.isDone(url) && !Database.isTodo(url) && TaskRunner2.isFreeCard(card);
        }).map((card) => card.querySelector(Config.SELECTORS.cardLink)?.href.match(/(?:listings|bundles)\/([a-f0-9-]+)/i)?.[1]).filter(Boolean));
        const uidsFromFailedList = new Set(State.db.failed.map((task) => task.uid));
        const allUidsToCheck = Array.from(/* @__PURE__ */ new Set([...uidsFromVisibleCards, ...uidsFromFailedList]));
        if (allUidsToCheck.length === 0) {
          Utils.logger("info", Utils.getText("log_no_items_to_check"));
          return;
        }
        Utils.logger("debug", Utils.getText("log_checking_items", uidsFromVisibleCards.size, uidsFromFailedList.size));
        const ownedUids = /* @__PURE__ */ new Set();
        for (let i = 0; i < allUidsToCheck.length; i += API_CHUNK_SIZE) {
          const chunk = allUidsToCheck.slice(i, i + API_CHUNK_SIZE);
          const apiUrl = new URL(API_ENDPOINT);
          chunk.forEach((uid) => apiUrl.searchParams.append("listing_ids", uid));
          Utils.logger("debug", Utils.getText("log_processing_batch", Math.floor(i / API_CHUNK_SIZE) + 1, chunk.length));
          const response = await fetch(apiUrl.href, {
            headers: { "accept": "application/json, text/plain, */*", "x-csrftoken": csrfToken, "x-requested-with": "XMLHttpRequest" }
          });
          if (!response.ok) {
            Utils.logger("warn", Utils.getText("log_batch_failed", response.status));
            continue;
          }
          const rawData = await response.json();
          const data = API.extractStateData(rawData, "RefreshStates");
          if (!data || !Array.isArray(data)) {
            Utils.logger("warn", Utils.getText("log_unexpected_data_format"));
            continue;
          }
          data.filter((item) => item.acquired).forEach((item) => ownedUids.add(item.uid));
          if (allUidsToCheck.length > i + API_CHUNK_SIZE) {
            await new Promise((r) => setTimeout(r, 250));
          }
        }
        Utils.logger("debug", Utils.getText("fab_dom_api_complete", ownedUids.size));
        let dbUpdated = false;
        const langPath = State.lang === "zh" ? "/zh-cn" : "";
        if (ownedUids.size > 0) {
          const initialFailedCount = State.db.failed.length;
          State.db.failed = State.db.failed.filter((failedTask) => !ownedUids.has(failedTask.uid));
          if (State.db.failed.length < initialFailedCount) {
            dbUpdated = true;
            ownedUids.forEach((uid) => {
              const url = `${window.location.origin}${langPath}/listings/${uid}`;
              Database.addDoneUrl(url);
            });
            Utils.logger("info", Utils.getText("log_cleared_from_failed", initialFailedCount - State.db.failed.length));
          }
          ownedUids.forEach((uid) => {
            TaskRunner2.syncClaimedCardToDom(uid);
          });
        }
        if (dbUpdated) {
          await Database.saveFailed();
          await Database.saveDone();
        }
        TaskRunner2.runHideOrShow();
      } catch (e) {
        Utils.logger("error", Utils.getText("log_refresh_error"), e);
      }
    }, "refreshVisibleStates"),
    retryFailedTasks: /* @__PURE__ */ __name(async () => {
      if (State.db.failed.length === 0) {
        Utils.logger("info", Utils.getText("log_no_failed_tasks"));
        return;
      }
      const count = State.db.failed.length;
      Utils.logger("info", Utils.getText("log_requeuing_tasks", count));
      State.db.todo.push(...State.db.failed);
      State.db.failed = [];
      await Database.saveFailed();
      Utils.logger("info", Utils.getText("log_tasks_moved", count));
      if (UI4) UI4.update();
    }, "retryFailedTasks"),
    // 检查并清理超时(卡死)的 worker。被 watchdog 定时器与后台心跳(KeepAlive)共同调用。
    // 抽成独立方法，是为了让主线程定时器被后台节流时，心跳也能驱动这套清理。
    // 返回被清理的 worker 数量。
    checkStalledWorkers: /* @__PURE__ */ __name(async () => {
      if (!State.isExecuting) return 0;
      const now = Date.now();
      const STALL_TIMEOUT = Config.WORKER_TIMEOUT;
      const stalledWorkers = [];
      for (const workerId in State.runningWorkers) {
        const workerInfo = State.runningWorkers[workerId];
        if (!workerInfo) continue;
        if (workerInfo.instanceId !== Config.INSTANCE_ID) continue;
        if (now - workerInfo.startTime > STALL_TIMEOUT) {
          stalledWorkers.push({ workerId, task: workerInfo.task });
        }
      }
      if (stalledWorkers.length === 0) return 0;
      Utils.logger("warn", Utils.getText("log_stalled_workers", stalledWorkers.length));
      for (const stalledWorker of stalledWorkers) {
        const { workerId, task } = stalledWorker;
        const workerInfo = State.runningWorkers[workerId];
        const stallDuration = workerInfo ? ((Date.now() - workerInfo.startTime) / 1e3).toFixed(2) : "\u672A\u77E5";
        Utils.logger("error", Utils.getText("log_watchdog_stalled", workerId.substring(0, 12)));
        const _failRes = await Database.markAsFailed(task, {
          reason: "\u5DE5\u4F5C\u7EBF\u7A0B\u8D85\u65F6 (Watchdog)",
          logs: [`Worker ${workerId.substring(0, 12)} \u8D85\u65F6`, `\u8D85\u65F6\u65F6\u957F: ${stallDuration}s`],
          details: {
            workerId,
            stallDuration: `${stallDuration}s`,
            timeout: `${Config.WORKER_TIMEOUT / 1e3}s`
          }
        });
        if (!_failRes || !_failRes.retried) State.executionFailedTasks++;
        delete State.runningWorkers[workerId];
        State.activeWorkers = Math.max(0, State.activeWorkers - 1);
        await GM_deleteValue(workerId);
      }
      Utils.logger("info", Utils.getText("log_cleaned_workers", stalledWorkers.length, State.activeWorkers));
      if (UI4) UI4.update();
      return stalledWorkers.length;
    }, "checkStalledWorkers"),
    runWatchdog: /* @__PURE__ */ __name(() => {
      if (State.watchdogTimer) clearInterval(State.watchdogTimer);
      State.watchdogTimer = setInterval(async () => {
        if (!InstanceManager.isActive) return;
        if (!State.isExecuting || Object.keys(State.runningWorkers).length === 0) {
          clearInterval(State.watchdogTimer);
          State.watchdogTimer = null;
          return;
        }
        const cleaned = await TaskRunner2.checkStalledWorkers();
        if (cleaned > 0) {
          setTimeout(() => {
            if (State.isExecuting && TaskRunner2.hasDispatchSlot() && State.db.todo.length > 0) {
              TaskRunner2.executeBatch();
            }
          }, 2e3);
        }
      }, 5e3);
    }, "runWatchdog"),
    maxDispatchSlots: /* @__PURE__ */ __name(() => {
      if (State.maxWorkers !== void 0 && State.maxWorkers !== null) {
        const configured = Number(State.maxWorkers);
        if (Number.isFinite(configured) && configured >= 1) {
          return Math.max(1, Math.min(15, Math.floor(configured)));
        }
      }
      if (Config.USE_API_CLAIM && ApiClaim.isAvailable()) {
        return Math.max(1, Number(Config.API_CLAIM_MAX_CONCURRENT_WORKERS) || 1);
      }
      return Config.MAX_CONCURRENT_WORKERS;
    }, "maxDispatchSlots"),
    hasDispatchSlot: /* @__PURE__ */ __name(() => State.activeWorkers < TaskRunner2.maxDispatchSlots(), "hasDispatchSlot"),
    executeBatch: /* @__PURE__ */ __name(async () => {
      if (!Utils.checkAuthentication()) return;
      if (!State.isWorkerTab && !InstanceManager.isActive) {
        Utils.logger("warn", Utils.getText("log_not_active_instance"));
        return;
      }
      if (!State.isExecuting) return;
      if (State.appStatus === "RATE_LIMITED") {
        Utils.logger("info", Utils.getText("log_rate_limited_continue"));
        return;
      }
      const apiClaimMode = Config.USE_API_CLAIM && ApiClaim.isAvailable();
      if (apiClaimMode && Date.now() < State.apiClaimNextDispatchAt) {
        const waitMs = Math.max(0, State.apiClaimNextDispatchAt - Date.now());
        if (!State.apiClaimDispatchTimer) {
          State.apiClaimDispatchTimer = setTimeout(() => {
            State.apiClaimDispatchTimer = null;
            TaskRunner2.executeBatch();
          }, waitMs);
        }
        return;
      }
      if (State.isDispatchingTasks) {
        Utils.logger("debug", "Task dispatching already in progress, skipping executeBatch.");
        return;
      }
      State.isDispatchingTasks = true;
      try {
        if (State.db.todo.length === 0 && State.activeWorkers === 0) {
          if (FastScanner.isRunning()) {
            State.isDispatchingTasks = false;
            return;
          }
          if (State.fastApiScan) {
            await TaskRunner2.stopExecutionAndSettle();
            State.isDispatchingTasks = false;
            return;
          }
          if (State.autoScroll) {
            State.isDispatchingTasks = false;
            TaskRunner2.attemptAutoScroll();
            return;
          }
          await TaskRunner2.stopExecutionAndSettle();
          State.isDispatchingTasks = false;
          return;
        }
        const maxConcurrentWorkers = TaskRunner2.maxDispatchSlots();
        if (State.activeWorkers >= maxConcurrentWorkers) {
          Utils.logger("info", Utils.getText("log_max_workers_reached", maxConcurrentWorkers));
          State.isDispatchingTasks = false;
          return;
        }
        const inFlightUIDs = new Set(Object.values(State.runningWorkers).map((w) => w.task.uid));
        const todoList = [...State.db.todo];
        let dispatchedCount = 0;
        const dispatchedUIDs = /* @__PURE__ */ new Set();
        const slotsAvailable = maxConcurrentWorkers - State.activeWorkers;
        const tasksToDispatch = [];
        for (const task of todoList) {
          if (tasksToDispatch.length >= slotsAvailable) break;
          if (inFlightUIDs.has(task.uid) || dispatchedUIDs.has(task.uid)) {
            Utils.logger("debug", Utils.getText("log_task_already_running", task.name));
            continue;
          }
          if (Database.isDone(task.url)) {
            Utils.logger("debug", Utils.getText("log_task_already_done", task.name));
            State.db.todo = State.db.todo.filter((t) => t.uid !== task.uid);
            Database.saveTodo();
            continue;
          }
          tasksToDispatch.push(task);
        }
        for (const task of tasksToDispatch) {
          dispatchedUIDs.add(task.uid);
          State.activeWorkers++;
          dispatchedCount++;
          const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          State.runningWorkers[workerId] = {
            task,
            startTime: Date.now(),
            instanceId: Config.INSTANCE_ID
          };
          Utils.logger("debug", Utils.getText("log_dispatching_worker", workerId.substring(0, 12), task.name));
          const workerUrl = new URL(task.url);
          workerUrl.searchParams.set("workerId", workerId);
          await GM_setValue(workerId, {
            task,
            instanceId: Config.INSTANCE_ID
          });
          if (typeof registerWorkerDoneListener === "function") {
            registerWorkerDoneListener(workerId);
          }
          if (apiClaimMode) {
            State.apiClaimNextDispatchAt = Date.now() + Math.max(
              0,
              Number(Config.API_CLAIM_MIN_INTERVAL_MS) || 0
            );
          }
          GM_openInTab(workerUrl.href, { active: false, insert: true });
        }
        if (dispatchedCount > 0) {
          Utils.logger("debug", Utils.getText("log_batch_dispatched", dispatchedCount));
        }
        if (!State.watchdogTimer && State.activeWorkers > 0) {
          TaskRunner2.runWatchdog();
        }
        if (UI4) UI4.update();
      } finally {
        State.isDispatchingTasks = false;
      }
    }, "executeBatch"),
    closeAllWorkerTabs: /* @__PURE__ */ __name(() => {
      if (State.apiClaimDispatchTimer) {
        clearTimeout(State.apiClaimDispatchTimer);
        State.apiClaimDispatchTimer = null;
      }
      State.apiClaimNextDispatchAt = 0;
      const workerIds = Object.keys(State.runningWorkers);
      if (workerIds.length > 0) {
        Utils.logger("debug", Utils.getText("log_cleaning_workers_state", workerIds.length));
        for (const workerId of workerIds) {
          GM_deleteValue(workerId);
        }
        State.runningWorkers = {};
        State.activeWorkers = 0;
        Utils.logger("info", Utils.getText("log_workers_cleaned"));
      }
    }, "closeAllWorkerTabs"),
    processDetailPage: /* @__PURE__ */ __name(async () => {
      if (!Utils.checkAuthentication()) return;
      const urlParams = new URLSearchParams(window.location.search);
      const workerId = urlParams.get("workerId");
      if (!workerId) return;
      State.isWorkerTab = true;
      State.workerTaskId = workerId;
      const startTime = Date.now();
      let hasReported = false;
      let closeAttempted = false;
      let payload = null;
      const forceCloseTimer = setTimeout(() => {
        if (!closeAttempted) {
          console.log("\u5DE5\u4F5C\u6807\u7B7E\u9875\u8D85\u65F6\uFF0C\u4E3B\u52A8\u4E0A\u62A5\u5E76\u5173\u95ED");
          closeWorkerTab();
        }
      }, Math.max(1e4, Config.WORKER_TIMEOUT - 5e3));
      function closeWorkerTab() {
        closeAttempted = true;
        clearTimeout(forceCloseTimer);
        if (!hasReported && workerId) {
          try {
            GM_setValue(Config.DB_KEYS.WORKER_DONE_PREFIX + workerId, {
              workerId,
              success: false,
              logs: [Utils.getText("worker_closed")],
              task: payload?.task,
              instanceId: payload?.instanceId,
              executionTime: Date.now() - startTime
            });
          } catch (e) {
          }
        }
        try {
          window.close();
        } catch (error) {
          Utils.logger("error", Utils.getText("log_close_worker_failed", error.message));
          try {
            window.location.href = "about:blank";
          } catch (e) {
          }
        }
      }
      __name(closeWorkerTab, "closeWorkerTab");
      try {
        payload = await GM_getValue(workerId);
        let readRetries = 6;
        while ((!payload || !payload.task) && readRetries-- > 0) {
          await new Promise((r) => setTimeout(r, 400));
          payload = await GM_getValue(workerId);
        }
        if (!payload || !payload.task) {
          Utils.logger("info", Utils.getText("log_task_data_cleaned"));
          closeWorkerTab();
          return;
        }
        const currentTask = payload.task;
        const logBuffer = [`[${workerId.substring(0, 12)}] Started: ${currentTask.name}`];
        let success = false;
        let rateLimited = false;
        let retryAfterMs = null;
        let manualRequired = false;
        let bundleResult = null;
        const claimNormally = /* @__PURE__ */ __name(async (allowBundleRedirect = true) => {
          if (Config.USE_API_CLAIM && ApiClaim.isAvailable()) {
            const apiResult = await ApiClaim.claim(currentTask);
            success = apiResult.result === CLAIM_RESULT.SUCCESS;
            if (apiResult.result === CLAIM_RESULT.RATE_LIMITED) {
              rateLimited = true;
              retryAfterMs = apiResult.retryAfterMs || null;
            } else if (apiResult.isBundle) {
              if (!allowBundleRedirect) {
                logBuffer.push("[API\u5165\u5E93] \u63A5\u53E3\u53CD\u590D\u5224\u5B9A\u4E3A Bundle\uFF0C\u505C\u6B62\u81EA\u52A8\u91CD\u8BD5\u4EE5\u907F\u514D\u6B7B\u5FAA\u73AF\u3002");
              } else {
                logBuffer.push("[API\u5165\u5E93] \u8BC6\u522B\u4E3A Bundle \u5546\u54C1\uFF0C\u8F6C\u5165\u5B98\u7F51\u96F6\u5143\u7ED3\u7B97\u6D41\u7A0B\u3002");
                currentTask.listingType = "bundle";
                currentTask.isBundle = true;
                bundleResult = await acquireBundle(currentTask, { log: /* @__PURE__ */ __name((msg) => logBuffer.push(msg), "log") });
                success = bundleResult.success;
                rateLimited = Boolean(bundleResult.rateLimited);
                retryAfterMs = bundleResult.retryAfterMs || null;
                if (bundleResult?.manualRequired) manualRequired = true;
              }
            } else if (!success) {
              logBuffer.push(`[API\u5165\u5E93] ${apiResult.reason || "\u672A\u5B8C\u6210"}\uFF0C\u5C1D\u8BD5\u56DE\u843D DOM \u9886\u53D6\u3002`);
              const claimResult = await acquireOnDetailPage(currentTask, {
                taskRunner: TaskRunner2,
                log: /* @__PURE__ */ __name((msg) => logBuffer.push(msg), "log")
              });
              success = claimResult.success;
              if (claimResult?.manualRequired) manualRequired = true;
            }
          } else {
            const claimResult = await acquireOnDetailPage(currentTask, {
              taskRunner: TaskRunner2,
              log: /* @__PURE__ */ __name((msg) => logBuffer.push(msg), "log")
            });
            success = claimResult.success;
            if (claimResult?.manualRequired) manualRequired = true;
          }
        }, "claimNormally");
        try {
          if (isBundleTask(currentTask)) {
            bundleResult = await acquireBundle(currentTask, { log: /* @__PURE__ */ __name((msg) => logBuffer.push(msg), "log") });
            if (bundleResult?.notBundle) {
              logBuffer.push("[Bundle] \u8BE5\u5546\u54C1\u6807\u9898\u542B Bundle\uFF0C\u4F46\u63A5\u53E3\u7C7B\u578B\u662F\u666E\u901A\u5546\u54C1\uFF0C\u6539\u7528\u666E\u901A\u9886\u53D6\u6D41\u7A0B\u3002");
              await claimNormally(false);
            } else {
              success = bundleResult.success;
              rateLimited = Boolean(bundleResult.rateLimited);
              retryAfterMs = bundleResult.retryAfterMs || null;
              if (bundleResult?.manualRequired) manualRequired = true;
            }
          } else {
            await claimNormally();
          }
        } catch (error) {
          logBuffer.push(`A critical error occurred: ${error.message}`);
          success = false;
        } finally {
          if (!success) {
            try {
              if (manualRequired || isCaptchaPresent(document)) {
                manualRequired = true;
                if (!logBuffer.some((l) => l.includes(Utils.getText("worker_captcha")))) {
                  logBuffer.push(Utils.getText("worker_captcha"));
                }
              }
            } catch (e) {
            }
          }
          try {
            hasReported = true;
            await GM_setValue(Config.DB_KEYS.WORKER_DONE_PREFIX + workerId, {
              workerId,
              success,
              rateLimited,
              retryAfterMs,
              manualRequired,
              logs: logBuffer,
              task: currentTask,
              instanceId: payload.instanceId,
              executionTime: Date.now() - startTime
            });
          } catch (error) {
            console.error("Error setting worker done value:", error);
          }
          try {
            await GM_deleteValue(workerId);
          } catch (error) {
            console.error("Error deleting worker value:", error);
          }
          if (manualRequired) {
            clearTimeout(forceCloseTimer);
            if (!VerificationNotifications.show({ task: currentTask, workerId, lang: State.lang })) {
              Utils.logger("warn", State.lang === "zh" ? "\u9A8C\u8BC1\u6807\u7B7E\u9875\u5DF2\u4FDD\u7559\uFF1B\u8BF7\u5728\u8BBE\u5B9A\u4E2D\u5F00\u542F\u6D4F\u89C8\u5668\u9A8C\u8BC1\u901A\u77E5\u3002" : "Verification tab kept open; enable verification notifications in Settings.");
            }
            try {
              document.title = `\u26A0\uFE0F\u3010\u9700\u9A8C\u8BC1\u3011${document.title}`;
              const banner = document.createElement("div");
              banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:999999;background:#e53935;color:#fff;font-size:16px;font-weight:bold;padding:12px 20px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.5);";
              banner.textContent = "\u{1F6A8} [Fab Helper] \u68C0\u6D4B\u5230\u5B89\u5168\u4EBA\u673A\u9A8C\u8BC1\uFF0C\u5DF2\u4E3A\u60A8\u4FDD\u7559\u6B64\u6807\u7B7E\u9875\u3002\u8BF7\u5728\u6B64\u9875\u9762\u5B8C\u6210\u9A8C\u8BC1\u540E\u56DE\u5230\u4E3B\u9875\u7EE7\u7EED\u3002";
              document.body?.appendChild(banner);
            } catch (e) {
            }
          } else {
            closeWorkerTab();
          }
        }
      } catch (error) {
        Utils.logger("error", `Worker tab error: ${error.message}`);
        closeWorkerTab();
      }
    }, "processDetailPage"),
    // 节流标记：100ms 内多次调用只执行一次，消除 Observer/timer 风暴
    selectorWithSuffix: /* @__PURE__ */ __name((selector, suffix) => {
      return selector.split(",").map((part) => `${part.trim()}${suffix}`).join(", ");
    }, "selectorWithSuffix"),
    getVisibleCardSelector: /* @__PURE__ */ __name(() => {
      return TaskRunner2.selectorWithSuffix(Config.SELECTORS.card, ':not([data-fab-hidden="true"])');
    }, "getVisibleCardSelector"),
    isHideModeActive: /* @__PURE__ */ __name(() => {
      return State.hideSaved || State.hideDiscountedPaid || State.hidePaid;
    }, "isHideModeActive"),
    getHideModeKey: /* @__PURE__ */ __name(() => {
      return [
        State.hideSaved ? "saved" : "",
        State.hideDiscountedPaid ? "discounted" : "",
        State.hidePaid ? "paid" : ""
      ].join("|");
    }, "getHideModeKey"),
    isCardHidden: /* @__PURE__ */ __name((card) => {
      return card?.getAttribute?.("data-fab-hidden") === "true";
    }, "isCardHidden"),
    invalidateCardCountCache: /* @__PURE__ */ __name(() => {
      State.cardCountCache.dirty = true;
    }, "invalidateCardCountCache"),
    refreshCardCountCache: /* @__PURE__ */ __name((cardsArg = null) => {
      if (typeof document === "undefined") {
        State.cardCountCache.total = 0;
        State.cardCountCache.hidden = 0;
        State.cardCountCache.visible = 0;
        State.cardCountCache.dirty = false;
        State.cardCountCache.documentRef = null;
        State.cardCountCache.href = "";
        State.hiddenThisPageCount = 0;
        return { total: 0, hidden: 0, visible: 0 };
      }
      const cards = cardsArg ? Array.from(cardsArg) : Array.from(document.querySelectorAll(Config.SELECTORS.card));
      cards.forEach((card) => card.setAttribute?.("data-fab-card", "true"));
      const hidden = cards.reduce((count, card) => count + (TaskRunner2.isCardHidden(card) ? 1 : 0), 0);
      const total = cards.length;
      const visible = total - hidden;
      State.cardCountCache.total = total;
      State.cardCountCache.hidden = hidden;
      State.cardCountCache.visible = visible;
      State.cardCountCache.dirty = false;
      State.cardCountCache.documentRef = document;
      State.cardCountCache.href = typeof window !== "undefined" ? window.location?.href || "" : "";
      State.hiddenThisPageCount = hidden;
      return { total, hidden, visible };
    }, "refreshCardCountCache"),
    getCardCounts: /* @__PURE__ */ __name((forceRefresh = false) => {
      const cache = State.cardCountCache;
      const href = typeof window !== "undefined" ? window.location?.href || "" : "";
      const documentChanged = typeof document !== "undefined" && cache.documentRef !== document;
      const hrefChanged = cache.href !== href;
      if (forceRefresh || cache.dirty || documentChanged || hrefChanged) {
        return TaskRunner2.refreshCardCountCache();
      }
      return {
        total: cache.total,
        hidden: cache.hidden,
        visible: cache.visible
      };
    }, "getCardCounts"),
    adjustCardCountCacheHidden: /* @__PURE__ */ __name((delta) => {
      const cache = State.cardCountCache;
      if (cache.dirty) return;
      cache.hidden = Math.max(0, cache.hidden + delta);
      cache.visible = Math.max(0, cache.total - cache.hidden);
      State.hiddenThisPageCount = cache.hidden;
    }, "adjustCardCountCacheHidden"),
    setCardHidden: /* @__PURE__ */ __name((card, hidden) => {
      if (!card) return;
      const wasHidden = TaskRunner2.isCardHidden(card);
      card.setAttribute?.("data-fab-card", "true");
      if (hidden) {
        if (card.style) card.style.display = "none";
        card.setAttribute?.("data-fab-hidden", "true");
      } else {
        if (card.style) card.style.display = "";
        card.removeAttribute?.("data-fab-hidden");
      }
      const isHidden = TaskRunner2.isCardHidden(card);
      if (wasHidden !== isHidden) {
        TaskRunner2.adjustCardCountCacheHidden(isHidden ? 1 : -1);
      }
    }, "setCardHidden"),
    resetHiddenCardState: /* @__PURE__ */ __name((cardsArg) => {
      Array.from(cardsArg || []).forEach((card) => {
        card.removeAttribute?.("data-fab-processed");
        TaskRunner2.setCardHidden(card, false);
      });
    }, "resetHiddenCardState"),
    shouldHideCard: /* @__PURE__ */ __name((card) => {
      const isFinished = State.hideSaved && TaskRunner2.isCardFinished(card);
      const isDiscountedPaid = State.hideDiscountedPaid && TaskRunner2.isDiscountedPaidCard(card);
      const isPaidAndHidden = State.hidePaid && !TaskRunner2.isFreeCard(card);
      return isFinished || isDiscountedPaid || isPaidAndHidden;
    }, "shouldHideCard"),
    _runHideOrShowTimer: null,
    scheduleHideOrShow: /* @__PURE__ */ __name(() => {
      if (TaskRunner2._runHideOrShowTimer) return;
      TaskRunner2._runHideOrShowTimer = setTimeout(() => {
        TaskRunner2._runHideOrShowTimer = null;
        TaskRunner2.runHideOrShow();
      }, 100);
    }, "scheduleHideOrShow"),
    runHideOrShow: /* @__PURE__ */ __name(() => {
      if (TaskRunner2._runHideOrShowTimer) {
        clearTimeout(TaskRunner2._runHideOrShowTimer);
        TaskRunner2._runHideOrShowTimer = null;
      }
      if (!TaskRunner2.isHideModeActive()) {
        const allCards2 = document.querySelectorAll(Config.SELECTORS.card);
        TaskRunner2.refreshCardCountCache(allCards2);
        TaskRunner2.resetHiddenCardState(allCards2);
        State.lastHideModeKey = TaskRunner2.getHideModeKey();
        if (UI4) UI4.update();
        return;
      }
      const allCards = document.querySelectorAll(Config.SELECTORS.card);
      TaskRunner2.refreshCardCountCache(allCards);
      const hideModeKey = TaskRunner2.getHideModeKey();
      if (State.lastHideModeKey !== hideModeKey) {
        State.lastHideModeKey = hideModeKey;
        TaskRunner2.resetHiddenCardState(allCards);
      }
      const cards = document.querySelectorAll(TaskRunner2.getVisibleCardSelector());
      let actuallyHidden = 0;
      let hasUnsettledCards = false;
      const unsettledCards = [];
      cards.forEach((card) => {
        if (card.getAttribute("data-fab-processed") === "true" && TaskRunner2.isCardHidden(card)) {
          TaskRunner2.setCardHidden(card, true);
          return;
        }
        if (!TaskRunner2.isCardSettled(card)) {
          hasUnsettledCards = true;
          unsettledCards.push(card);
        }
      });
      if (hasUnsettledCards && unsettledCards.length > 0) {
        if (State.hideRetryTimer) return;
        Utils.logger("debug", Utils.getText("log_unsettled_cards", unsettledCards.length));
        State.hideRetryTimer = setTimeout(() => {
          State.hideRetryTimer = null;
          TaskRunner2.runHideOrShow();
        }, 2e3);
      } else if (State.hideRetryTimer) {
        clearTimeout(State.hideRetryTimer);
        State.hideRetryTimer = null;
      }
      const cardsToHide = [];
      cards.forEach((card) => {
        if (!TaskRunner2.isCardSettled(card)) {
          return;
        }
        if (TaskRunner2.isCardHidden(card)) {
          if (card.getAttribute("data-fab-scroll-placeholder") === "true") return;
          TaskRunner2.setCardHidden(card, true);
          return;
        }
        card.setAttribute("data-fab-processed", "true");
        const link = card.querySelector(Config.SELECTORS.cardLink);
        const href = link ? link.getAttribute?.("href") || link.href : null;
        if (href) {
          const uid = href.split("/").pop().split("?")[0];
          State.processedCardUids.add(uid);
        }
        if (TaskRunner2.shouldHideCard(card)) {
          cardsToHide.push(card);
        }
      });
      if (cardsToHide.length > 0) {
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("debug_prepare_hide", cardsToHide.length));
        }
        cardsToHide.sort(() => Math.random() - 0.5);
        if (cardsToHide.length > 30) {
          const FRAME_BATCH = 20;
          let offset = 0;
          const hideNextFrame = /* @__PURE__ */ __name(() => {
            const end = Math.min(offset + FRAME_BATCH, cardsToHide.length);
            for (let i = offset; i < end; i++) {
              TaskRunner2.setCardHidden(cardsToHide[i], true);
              actuallyHidden++;
            }
            offset = end;
            if (offset < cardsToHide.length) {
              requestAnimationFrame(hideNextFrame);
            } else {
              if (State.debugMode) {
                Utils.logger("debug", Utils.getText("debug_hide_completed", actuallyHidden));
              }
              setTimeout(() => {
                if (UI4) UI4.update();
                TaskRunner2.checkVisibilityAndRefresh();
              }, 300);
            }
          }, "hideNextFrame");
          requestAnimationFrame(hideNextFrame);
        } else {
          const batchSize = 10;
          const batches = Math.ceil(cardsToHide.length / batchSize);
          const initialDelay = 200;
          for (let i = 0; i < batches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, cardsToHide.length);
            const currentBatch = cardsToHide.slice(start, end);
            const batchDelay = initialDelay + i * 300 + Math.random() * 300;
            const isLastBatch = i === batches - 1;
            setTimeout(() => {
              let batchHidden = 0;
              currentBatch.forEach((card, index) => {
                const cardDelay = index * 50 + Math.random() * 100;
                setTimeout(() => {
                  TaskRunner2.setCardHidden(card, true);
                  actuallyHidden++;
                  batchHidden++;
                  if (batchHidden === currentBatch.length) {
                    if (UI4) UI4.update();
                    if (isLastBatch) {
                      if (State.debugMode) {
                        Utils.logger("debug", Utils.getText("debug_hide_completed", actuallyHidden));
                      }
                      setTimeout(() => {
                        TaskRunner2.checkVisibilityAndRefresh();
                      }, 300);
                    }
                  }
                }, cardDelay);
              });
            }, batchDelay);
          }
        }
      }
      if (cardsToHide.length === 0) {
        if (UI4) UI4.update();
        TaskRunner2.checkVisibilityAndRefresh();
      }
      return;
    }, "runHideOrShow"),
    checkVisibilityAndRefresh: /* @__PURE__ */ __name(() => {
      const cards = document.querySelectorAll(TaskRunner2.getVisibleCardSelector());
      let needsReprocessing = false;
      cards.forEach((card) => {
        const isProcessed = card.getAttribute("data-fab-processed") === "true";
        if (!isProcessed && TaskRunner2.isCardSettled(card)) needsReprocessing = true;
      });
      if (needsReprocessing) {
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("debug_unprocessed_cards_simple"));
        }
        setTimeout(() => TaskRunner2.runHideOrShow(), 100);
        return;
      }
      const { visible: visibleCards } = TaskRunner2.getCardCounts();
      if (State.debugMode) {
        Utils.logger("debug", Utils.getText("debug_visible_after_hide", visibleCards, State.hiddenThisPageCount));
      }
      if (UI4) UI4.update();
      if (visibleCards === 0) {
        if (State.appStatus === "RATE_LIMITED" && State.autoRefreshEmptyPage) {
          if (State.isRefreshScheduled) {
            Utils.logger("debug", Utils.getText("refresh_plan_exists"));
            return;
          }
          if (State.db.todo.length > 0 || State.activeWorkers > 0) {
            Utils.logger("debug", Utils.getText("log_refresh_cancelled_tasks", State.db.todo.length, State.activeWorkers));
            return;
          }
          Utils.logger("info", Utils.getText("log_all_hidden_rate_limited"));
          const randomDelay = 3e3 + Math.random() * 2e3;
          if (countdownRefresh2) {
            countdownRefresh2(randomDelay, Utils.getText("rate_limit_no_visible_reason"));
          }
        } else if (State.appStatus === "NORMAL" && State.hiddenThisPageCount > 0) {
          Utils.logger("debug", Utils.getText("page_status_hidden_no_visible", State.hiddenThisPageCount));
          if (!State.fastApiScan && (State.autoScroll || State.autoAddOnScroll)) {
            TaskRunner2.attemptAutoScroll();
          }
        }
      }
    }, "checkVisibilityAndRefresh"),
    ensureTasksAreExecuted: /* @__PURE__ */ __name(() => {
      if (State.db.todo.length === 0) return;
      if (State.isExecuting) {
        if (State.activeWorkers === 0) {
          Utils.logger("info", Utils.getText("log_ensure_tasks"));
          TaskRunner2.executeBatch();
        }
        return;
      }
      Utils.logger("info", Utils.getText("log_auto_start_execution", State.db.todo.length));
      TaskRunner2.startExecution();
    }, "ensureTasksAreExecuted"),
    checkVisibleCardsStatus: /* @__PURE__ */ __name(async () => {
      if (State.isCheckingStatus) {
        return;
      }
      State.isCheckingStatus = true;
      try {
        const visibleCards = [...document.querySelectorAll(TaskRunner2.getVisibleCardSelector())];
        if (visibleCards.length === 0) {
          return;
        }
        let hasUnsettledCards = false;
        const unsettledCards = [];
        visibleCards.forEach((card) => {
          if (!TaskRunner2.isCardSettled(card)) {
            hasUnsettledCards = true;
            unsettledCards.push(card);
          }
        });
        if (hasUnsettledCards && unsettledCards.length > 0) {
        }
        const allItems = [];
        let confirmedOwned = 0;
        visibleCards.forEach((card) => {
          const link = card.querySelector(Config.SELECTORS.cardLink);
          const uidMatch = link?.href.match(/(?:listings|bundles)\/([a-f0-9-]+)/i);
          if (uidMatch && uidMatch[1]) {
            const uid = uidMatch[1];
            const url = link.href.split("?")[0];
            if (Database.isDone(url)) return;
            allItems.push({ uid, url, element: card });
          }
        });
        if (allItems.length === 0) {
          return;
        }
        Utils.logger("debug", Utils.getText("fab_dom_checking_status", allItems.length));
        const uids = allItems.map((item) => item.uid);
        const statesData = await API.checkItemsOwnership(uids);
        const ownedUids = new Set(
          statesData.filter((state) => state && state.acquired).map((state) => state.uid)
        );
        for (const item of allItems) {
          if (ownedUids.has(item.uid)) {
            if (Database.addDoneUrl(item.url)) {
              confirmedOwned++;
            }
            State.db.failed = State.db.failed.filter((f) => f.uid !== item.uid);
            State.db.todo = State.db.todo.filter((t) => t.uid !== item.uid);
          }
        }
        if (confirmedOwned > 0) {
          await Database.saveDone();
          await Database.saveFailed();
          Utils.logger("debug", Utils.getText("fab_dom_api_complete", confirmedOwned));
          Utils.logger("debug", Utils.getText("fab_dom_refresh_complete", confirmedOwned));
          if (UI4) UI4.update();
          if (State.hideSaved || State.hideDiscountedPaid || State.hidePaid) {
            TaskRunner2.runHideOrShow();
          }
        } else {
          Utils.logger("debug", Utils.getText("fab_dom_no_new_owned"));
        }
      } catch (error) {
        Utils.logger("error", Utils.getText("log_check_status_error", error.message));
        if (error.message && error.message.includes("429")) {
          RateLimitManager.enterRateLimitedState("[Fab DOM Refresh] 429\u9519\u8BEF");
        }
      } finally {
        State.isCheckingStatus = false;
      }
    }, "checkVisibleCardsStatus"),
    scanAndAddTasks: /* @__PURE__ */ __name(async (cards) => {
      if (State.fastApiScan || FastScanner.isRunning()) return;
      if (!State.autoAddOnScroll && !State.autoScroll) return;
      if (!State.isAuthenticated) {
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("auth_scan_blocked"));
        }
        return;
      }
      if (State.isScanningTasks) {
        Utils.logger("debug", `\u5DF2\u6709\u626B\u63CF\u4EFB\u52A1\u8FDB\u884C\u4E2D\uFF0C\u8DF3\u8FC7\u672C\u6B21\u8C03\u7528 (${cards.length} \u5F20\u5361\u7247)`);
        return;
      }
      State.isScanningTasks = true;
      try {
        if (!window._apiWaitStatus) {
          window._apiWaitStatus = {
            isWaiting: false,
            pendingCards: [],
            lastApiActivity: 0,
            apiCheckInterval: null
          };
        }
        if (window._apiWaitStatus.isWaiting) {
          window._apiWaitStatus.pendingCards = [...window._apiWaitStatus.pendingCards, ...cards];
          Utils.logger("info", Utils.getText("debug_api_wait_in_progress", cards.length));
          return;
        }
        window._apiWaitStatus.isWaiting = true;
        window._apiWaitStatus.pendingCards = [...cards];
        window._apiWaitStatus.lastApiActivity = Date.now();
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("debug_wait_api_response", cards.length));
        }
        const waitForApiCompletion = /* @__PURE__ */ __name(() => {
          return new Promise((resolve) => {
            if (window._apiWaitStatus.apiCheckInterval) {
              clearInterval(window._apiWaitStatus.apiCheckInterval);
              window._apiWaitStatus.apiCheckInterval = null;
            }
            const maxWaitTime = 1e4;
            const startTime = Date.now();
            window._apiWaitStatus.apiCheckInterval = setInterval(() => {
              const now = Date.now();
              const timeSinceLastActivity = now - window._apiWaitStatus.lastApiActivity;
              const totalWaitTime = now - startTime;
              if (totalWaitTime > maxWaitTime || timeSinceLastActivity > 2e3) {
                clearInterval(window._apiWaitStatus.apiCheckInterval);
                window._apiWaitStatus.apiCheckInterval = null;
                resolve();
              }
            }, 200);
          });
        }, "waitForApiCompletion");
        try {
          await waitForApiCompletion();
        } catch (error) {
          Utils.logger("error", Utils.getText("auto_add_api_error", error.message));
        }
        const cardsToProcess = [...window._apiWaitStatus.pendingCards];
        window._apiWaitStatus.pendingCards = [];
        window._apiWaitStatus.isWaiting = false;
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("debug_api_wait_complete", cardsToProcess.length));
        }
        const newlyAddedList = [];
        let skippedAlreadyOwned = 0;
        let skippedInTodo = 0;
        let skippedUnsettled = 0;
        cardsToProcess.forEach((card) => {
          const link = card.querySelector(Config.SELECTORS.cardLink);
          const rawHref = link ? link.href : "";
          if (!rawHref) return;
          const uidMatch = rawHref.match(/\/(listings|bundles)\/([a-f0-9-]{32,36})(?:[/?#]|$)/i);
          if (!uidMatch) return;
          const uid = uidMatch[2].toLowerCase();
          const url = `https://www.fab.com/${uidMatch[1].toLowerCase()}/${uid}`;
          if (!TaskRunner2.isCardSettled(card)) {
            skippedUnsettled++;
            return;
          }
          if (Database.isDone(url)) {
            skippedAlreadyOwned++;
            return;
          }
          if (Database.isTodo(url)) {
            skippedInTodo++;
            return;
          }
          if (Database.isFailed(url)) return;
          const text = card.textContent || "";
          if (text.includes("\u5DF2\u4FDD\u5B58\u5728\u6211\u7684\u5E93\u4E2D") || text.includes("\u5DF2\u4FDD\u5B58") || text.includes("Saved to My Library") || text.includes("In your library")) {
            skippedAlreadyOwned++;
            return;
          }
          const icons = card.querySelectorAll("i.fabkit-Icon--intent-success, i.edsicon-check-circle-filled");
          if (icons.length > 0) {
            skippedAlreadyOwned++;
            return;
          }
          if (DataCache.ownedStatus.has(uid)) {
            const status = DataCache.ownedStatus.get(uid);
            if (status && status.acquired) {
              skippedAlreadyOwned++;
              return;
            }
          }
          if (!TaskRunner2.isFreeCard(card)) return;
          const name = card.querySelector('a[aria-label*="\u521B\u4F5C\u7684"], a[aria-label*="by "]')?.textContent.trim() || card.querySelector(Config.SELECTORS.cardLink)?.textContent.trim() || Utils.getText("untitled");
          newlyAddedList.push(enrichTaskFromCache(uid, { name, url, type: "detail", uid }));
        });
        if (skippedUnsettled > 0 && !State.autoAddRetryTimer) {
          State.autoAddRetryTimer = setTimeout(() => {
            State.autoAddRetryTimer = null;
            if (!State.fastApiScan && (State.autoAddOnScroll || State.autoScroll)) {
              TaskRunner2.scanAndAddTasks(document.querySelectorAll(TaskRunner2.getVisibleCardSelector())).catch((error) => Utils.logger("error", `\u81EA\u52A8\u6DFB\u52A0\u91CD\u8BD5\u5931\u8D25: ${error.message}`));
            }
          }, 2e3);
        } else if (skippedUnsettled === 0 && State.autoAddRetryTimer) {
          clearTimeout(State.autoAddRetryTimer);
          State.autoAddRetryTimer = null;
        }
        if (newlyAddedList.length > 0 || skippedAlreadyOwned > 0 || skippedInTodo > 0) {
          if (newlyAddedList.length > 0) {
            const existingUids = new Set(State.db.todo.map((t) => t.uid));
            const existingUrls = new Set(State.db.todo.map((t) => t.url.split("?")[0]));
            const uniqueNewTasks = newlyAddedList.filter((task) => {
              const cleanUrl = task.url.split("?")[0];
              const isDuplicate = existingUids.has(task.uid) || existingUrls.has(cleanUrl);
              if (isDuplicate) {
                Utils.logger("debug", `\u8DF3\u8FC7\u91CD\u590D\u4EFB\u52A1: ${task.name} (uid: ${task.uid})`);
              }
              return !isDuplicate;
            });
            if (uniqueNewTasks.length > 0) {
              State.db.todo.push(...uniqueNewTasks);
              Utils.logger("info", Utils.getText("auto_add_new_tasks", uniqueNewTasks.length));
              if (uniqueNewTasks.length < newlyAddedList.length) {
                Utils.logger("debug", `\u8FC7\u6EE4\u4E86 ${newlyAddedList.length - uniqueNewTasks.length} \u4E2A\u91CD\u590D\u4EFB\u52A1`);
              }
              Database.saveTodo();
              State.autoScrollAttempts = 0;
            } else {
              Utils.logger("debug", `\u6240\u6709 ${newlyAddedList.length} \u4E2A\u4EFB\u52A1\u90FD\u662F\u91CD\u590D\u7684\uFF0C\u5DF2\u8DF3\u8FC7`);
            }
          }
          if (skippedAlreadyOwned > 0 || skippedInTodo > 0) {
            Utils.logger("debug", Utils.getText("debug_filter_owned", skippedAlreadyOwned, skippedInTodo));
            State.totalScannedOwned += skippedAlreadyOwned;
          }
          if (State.isExecuting) {
            State.executionTotalTasks = State.db.todo.length;
            TaskRunner2.executeBatch();
          } else if (State.autoAddOnScroll || State.autoScroll) {
            TaskRunner2.startExecution();
          }
          if (UI4) UI4.update();
        }
      } finally {
        State.isScanningTasks = false;
        TaskRunner2.maybeRecycleMemory();
      }
    }, "scanAndAddTasks"),
    handleRateLimit: /* @__PURE__ */ __name(async (url) => {
      await RateLimitManager.enterRateLimitedState(url || "\u7F51\u7EDC\u8BF7\u6C42");
    }, "handleRateLimit"),
    reportTaskDone: /* @__PURE__ */ __name(async (task, success) => {
      try {
        const reportWorkerId = `worker_task_${task.uid}`;
        if (typeof registerWorkerDoneListener === "function") {
          registerWorkerDoneListener(reportWorkerId);
        }
        await GM_setValue(Config.DB_KEYS.WORKER_DONE_PREFIX + reportWorkerId, {
          workerId: reportWorkerId,
          success,
          logs: [Utils.getText("task_report", success ? Utils.getText("task_success") : Utils.getText("task_failed"), task.name || task.uid)],
          task,
          instanceId: Config.INSTANCE_ID,
          executionTime: 0
        });
        Utils.logger("info", Utils.getText("task_report", success ? Utils.getText("task_success") : Utils.getText("task_failed"), task.name || task.uid));
      } catch (error) {
        Utils.logger("error", Utils.getText("log_report_error", error.message));
      }
    }, "reportTaskDone"),
    onQueueCompleted: null,
    stopExecutionAndSettle: /* @__PURE__ */ __name(async () => {
      if (State.watchdogTimer) {
        clearInterval(State.watchdogTimer);
        State.watchdogTimer = null;
      }
      KeepAlive.stop();
      TaskRunner2.closeAllWorkerTabs();
      if (typeof TaskRunner2.onQueueCompleted === "function") {
        await TaskRunner2.onQueueCompleted();
      } else {
        Utils.logger("info", Utils.getText("log_all_tasks_completed"));
        State.isExecuting = false;
        Database.saveExecutingState();
        Database.saveTodo();
        if (UI4) UI4.update();
      }
    }, "stopExecutionAndSettle"),
    // ===== 内存回收：分块刷新续跑 =====
    // Fab 搜索结果是「只追加」的普通列表：滚动加载过的卡片不会回收，11,893 张免费卡
    // 就留下 15.5 万 DOM 节点 / 单渲染进程约 2GB。全站 4 万+ 一次跑完会线性涨到
    // 6-7GB（此前已出现 V8 OOM）。因此每累积 N 张卡片、等队列与 worker 都空闲时
    // 刷新一次页面，用已有的 cursor 注入从原位置续跑，把峰值压回阈值附近。
    getDomCardCount: /* @__PURE__ */ __name(() => {
      try {
        if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return 0;
        return document.querySelectorAll(`${Config.SELECTORS.card}, [data-fab-card="true"], [data-fab-hidden="true"], [data-fab-processed="true"]`).length;
      } catch (_e) {
        return 0;
      }
    }, "getDomCardCount"),
    _sessionGet: /* @__PURE__ */ __name((key) => {
      try {
        if (typeof sessionStorage === "undefined") return null;
        return sessionStorage.getItem(key);
      } catch (_e) {
        return null;
      }
    }, "_sessionGet"),
    _sessionSet: /* @__PURE__ */ __name((key, value) => {
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, String(value));
      } catch (_e) {
      }
    }, "_sessionSet"),
    _sessionRemove: /* @__PURE__ */ __name((key) => {
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
      } catch (_e) {
      }
    }, "_sessionRemove"),
    // 从游标里解析排序时间（Fab 按 -firstPublishedAt 倒序，游标里带最后一条的 ISO 时间）。
    // 仅用于判断「续跑是不是退回了列表开头」，解析失败返回 null，不影响主流程。
    cursorSortTimestamp: /* @__PURE__ */ __name((cursor) => {
      if (!cursor || typeof atob !== "function") return null;
      try {
        const decoded = atob(cursor);
        const match = decoded.match(/(?:^|&)p=([^&]+)/);
        if (!match || !match[1]) return null;
        const value = decodeURIComponent(match[1].replace(/\+/g, " "));
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return null;
        const ts = Date.parse(value);
        return Number.isFinite(ts) ? ts : null;
      } catch (_e) {
        return null;
      }
    }, "cursorSortTimestamp"),
    // 防循环：连续两次回收后游标时间反而变晚，说明列表被从头重载（cursor 未生效）。
    _noteMemoryRecycleProgress: /* @__PURE__ */ __name((currentCursor) => {
      const prevCursor = TaskRunner2._sessionGet(MEM_RECYCLE_KEYS.LAST_CURSOR);
      if (!prevCursor || !currentCursor) return;
      const prevTs = TaskRunner2.cursorSortTimestamp(prevCursor);
      const curTs = TaskRunner2.cursorSortTimestamp(currentCursor);
      if (prevTs === null || curTs === null) return;
      const strikes = Number(TaskRunner2._sessionGet(MEM_RECYCLE_KEYS.STRIKES)) || 0;
      if (curTs > prevTs + 6e4) {
        const next = strikes + 1;
        TaskRunner2._sessionSet(MEM_RECYCLE_KEYS.STRIKES, next);
        if (next >= 2) {
          State.memoryRecycleDisabled = true;
          Utils.logger("warn", Utils.getText("memory_recycle_disabled", next));
        }
        return;
      }
      if (strikes > 0) TaskRunner2._sessionSet(MEM_RECYCLE_KEYS.STRIKES, 0);
    }, "_noteMemoryRecycleProgress"),
    canRecycleMemory: /* @__PURE__ */ __name((cardCount) => {
      const threshold = Number(Config.MEMORY_RECYCLE_CARD_THRESHOLD) || 0;
      if (!Config.MEMORY_RECYCLE_ENABLED || threshold <= 0) return false;
      if (State.memoryRecycleDisabled || State.memoryRecycleInFlight) return false;
      if (!State.autoScroll) return false;
      if (State.appStatus !== "NORMAL" || State.manualVerificationPending) return false;
      if (State.isAutoScrolling || State.isScanningTasks || State.isDispatchingTasks) return false;
      if (State.isRefreshScheduled || State.isRecoveryMode) return false;
      if (State.isEndOfSearchList) return false;
      if (State.db.todo.length > 0 || State.activeWorkers > 0) return false;
      if (!State.savedCursor) return false;
      const now = Date.now();
      const lastAt = Number(TaskRunner2._sessionGet(MEM_RECYCLE_KEYS.LAST_AT)) || 0;
      if (lastAt && now - lastAt < Config.MEMORY_RECYCLE_MIN_INTERVAL_MS) return false;
      const used = Number(TaskRunner2._sessionGet(MEM_RECYCLE_KEYS.COUNT)) || 0;
      if (used >= Config.MEMORY_RECYCLE_MAX_PER_SESSION) return false;
      const count = typeof cardCount === "number" ? cardCount : TaskRunner2.getDomCardCount();
      return count >= threshold;
    }, "canRecycleMemory"),
    maybeRecycleMemory: /* @__PURE__ */ __name(() => {
      try {
        if (!TaskRunner2.canRecycleMemory()) return false;
        TaskRunner2._noteMemoryRecycleProgress(State.savedCursor);
        if (State.memoryRecycleDisabled) return false;
        const cardCount = TaskRunner2.getDomCardCount();
        State.memoryRecycleInFlight = true;
        const used = (Number(TaskRunner2._sessionGet(MEM_RECYCLE_KEYS.COUNT)) || 0) + 1;
        TaskRunner2._sessionSet(MEM_RECYCLE_KEYS.COUNT, used);
        TaskRunner2._sessionSet(MEM_RECYCLE_KEYS.LAST_AT, Date.now());
        TaskRunner2._sessionSet(MEM_RECYCLE_KEYS.LAST_CURSOR, State.savedCursor);
        TaskRunner2._sessionSet(MEM_RECYCLE_KEYS.PENDING, "1");
        Utils.logger("info", Utils.getText(
          "memory_recycle_trigger",
          cardCount,
          Number(Config.MEMORY_RECYCLE_CARD_THRESHOLD),
          used
        ));
        reloadPage();
        return true;
      } catch (error) {
        State.memoryRecycleInFlight = false;
        Utils.logger("warn", Utils.getText("memory_recycle_failed", error.message));
        return false;
      }
    }, "maybeRecycleMemory"),
    // 刷新后由主流程调用：消费 pending 标记并主动续跑。正常滚动循环通常也能自己
    // 接上（初始扫描 -> executeBatch -> attemptAutoScroll），但某些页首屏没有
    // 新任务/已入库卡时不会触发，必须显式接管一次。
    resumeAfterMemoryRecycle: /* @__PURE__ */ __name(() => {
      if (TaskRunner2._sessionGet(MEM_RECYCLE_KEYS.PENDING) !== "1") return false;
      TaskRunner2._sessionRemove(MEM_RECYCLE_KEYS.PENDING);
      if (!State.autoScroll || State.isWorkerTab) return false;
      Utils.logger("info", Utils.getText("memory_recycle_resume"));
      setTimeout(() => {
        if (!State.autoScroll) return;
        if (State.isEndOfSearchList) return;
        if (State.db.todo.length > 0) {
          TaskRunner2.startExecution();
          return;
        }
        TaskRunner2.attemptAutoScroll();
      }, 6e3);
      return true;
    }, "resumeAfterMemoryRecycle"),
    attemptAutoScroll: /* @__PURE__ */ __name(async () => {
      if (State.manualVerificationPending) return;
      if (State.appStatus === "RATE_LIMITED") return;
      if (FastScanner.isRunning()) return;
      if (State.isAutoScrolling) return;
      State.isAutoScrolling = true;
      if (typeof State.autoScrollAttempts === "undefined") {
        State.autoScrollAttempts = 0;
      }
      const maxScrollAttempts = 6;
      Utils.logger("info", Utils.getText("auto_scroll_attempt", State.autoScrollAttempts + 1, maxScrollAttempts));
      const getCurrentCardTotal = /* @__PURE__ */ __name(() => {
        try {
          return TaskRunner2.getCardCounts(true).total;
        } catch (_error) {
          return 0;
        }
      }, "getCurrentCardTotal");
      const previousCardTotal = getCurrentCardTotal();
      const previousProcessedTotal = State.processedCardUids.size;
      const previousScannedOwned = State.totalScannedOwned;
      const previousScrollHeight = typeof document !== "undefined" && document.documentElement ? document.documentElement.scrollHeight : 0;
      const previousScrollY = typeof window !== "undefined" ? window.scrollY : 0;
      const doScroll = /* @__PURE__ */ __name(async () => {
        if (typeof window === "undefined") return;
        const doc = typeof document !== "undefined" && document.documentElement ? document.documentElement : null;
        const innerH = window.innerHeight || 800;
        const PLACEHOLDER_COUNT = 3;
        let placeholderCards = [];
        const startHeight = doc ? doc.scrollHeight : 0;
        const isPageCollapsed = doc && doc.scrollHeight < innerH * 1.5;
        if (isPageCollapsed && doc) {
          const allHidden = Array.from(doc.querySelectorAll(
            `${Config.SELECTORS.card}[data-fab-hidden="true"]`
          ));
          placeholderCards = allHidden.slice(-PLACEHOLDER_COUNT);
          placeholderCards.forEach((card) => {
            card.style.display = "";
            card.style.visibility = "hidden";
            card.style.pointerEvents = "none";
            card.setAttribute("data-fab-scroll-placeholder", "true");
          });
          if (placeholderCards.length > 0) {
            Utils.logger("debug", `[\u81EA\u52A8\u6EDA\u52A8] \u9875\u9762\u584C\u9677\uFF0C\u4E34\u65F6\u6062\u590D ${placeholderCards.length} \u5F20\u5360\u4F4D\u5361\u4EE5\u89E6\u53D1 sentinel`);
            await new Promise((r) => _realSetTimeout(r, 50));
          }
        }
        const steps = 6;
        const remaining = (doc ? doc.scrollHeight : 0) - (window.scrollY || 0);
        const stepSize = Math.max(300, Math.floor(remaining / steps));
        for (let i = 1; i <= steps; i++) {
          if (typeof window.scrollBy === "function") {
            window.scrollBy(0, stepSize);
          } else if (typeof window.scrollTo === "function") {
            window.scrollTo(0, (window.scrollY || 0) + stepSize);
          }
          await new Promise((r) => _realSetTimeout(r, 350));
        }
        if (typeof window.scrollTo === "function" && doc) {
          window.scrollTo(0, doc.scrollHeight);
          await new Promise((r) => _realSetTimeout(r, 350));
        }
        if (doc) {
          const maxScroll = doc.scrollHeight - innerH;
          const atBottom = (window.scrollY || 0) >= maxScroll - 50;
          if (atBottom) {
            const upBy = Math.round(innerH * 1.2);
            window.scrollTo(0, Math.max(0, (window.scrollY || 0) - upBy));
            await new Promise((r) => _realSetTimeout(r, 500));
            window.scrollTo(0, doc.scrollHeight);
            await new Promise((r) => _realSetTimeout(r, 500));
          }
        }
        placeholderCards.forEach((card) => {
          card.style.display = "none";
          card.style.visibility = "";
          card.style.pointerEvents = "";
          card.removeAttribute("data-fab-scroll-placeholder");
        });
        return startHeight;
      }, "doScroll");
      await doScroll();
      setTimeout(async () => {
        State.isAutoScrolling = false;
        if (TaskRunner2.maybeRecycleMemory()) return;
        const currentScrollHeight = typeof document !== "undefined" && document.documentElement ? document.documentElement.scrollHeight : 0;
        const currentScrollY = typeof window !== "undefined" ? window.scrollY : 0;
        const newTodoCount = State.db.todo.length;
        const currentCardTotal = getCurrentCardTotal();
        if (newTodoCount > 0) {
          Utils.logger("info", Utils.getText("auto_scroll_success", newTodoCount));
          if (!State.isExecuting) {
            TaskRunner2.startExecution();
          }
          return;
        }
        const currentProcessedTotal = State.processedCardUids.size;
        const newProcessedCount = currentProcessedTotal - previousProcessedTotal;
        const newDomCardCount = currentCardTotal - previousCardTotal;
        const newScannedOwnedCount = State.totalScannedOwned - previousScannedOwned;
        const scrollHeightGrew = currentScrollHeight > previousScrollHeight + 2;
        if (newProcessedCount > 0 || newDomCardCount > 0 || scrollHeightGrew || newScannedOwnedCount > 0) {
          State.autoScrollAttempts = 0;
          const loadedCount = newProcessedCount > 0 ? newProcessedCount : newScannedOwnedCount > 0 ? newScannedOwnedCount : newDomCardCount > 0 ? newDomCardCount : currentScrollHeight - previousScrollHeight;
          Utils.logger("debug", Utils.getText("auto_scroll_cards_loaded", loadedCount));
          TaskRunner2.runHideOrShow();
          TaskRunner2.attemptAutoScroll();
          return;
        }
        if (State.isEndOfSearchList) {
          Utils.logger("info", Utils.getText("auto_scroll_reached_bottom"));
          if (UI4 && typeof UI4.showToast === "function" && !State.hasReachedBottomToastShown) {
            State.hasReachedBottomToastShown = true;
            UI4.showToast(Utils.getText("toast_reached_bottom"), true);
          }
          State.isAutoScrolling = false;
          const workersStillBusy = State.activeWorkers > 0 || State.db.todo.length > 0;
          if (State.isExecuting && !workersStillBusy) {
            await TaskRunner2.stopExecutionAndSettle();
          } else {
            State.autoScrollAttempts = 0;
            if (State.isExecuting && State.db.todo.length > 0) {
              setTimeout(() => TaskRunner2.executeBatch(), 200);
            }
          }
          return;
        }
        State.autoScrollAttempts++;
        if (State.autoScrollAttempts >= maxScrollAttempts) {
          Utils.logger("warn", Utils.getText("auto_scroll_safety_stop", maxScrollAttempts));
          State.autoScrollAttempts = 0;
          State.isAutoScrolling = false;
          return;
        }
        if (State.autoScroll || TaskRunner2.isHideModeActive()) {
          Utils.logger("debug", Utils.getText("auto_scroll_waiting"));
          TaskRunner2.attemptAutoScroll();
          return;
        }
        State.isAutoScrolling = false;
      }, 3e3);
    }, "attemptAutoScroll")
  };

  // src/modules/ui.js
  var TaskRunner3 = null;
  function setTaskRunnerReference(taskRunnerModule) {
    TaskRunner3 = taskRunnerModule;
  }
  __name(setTaskRunnerReference, "setTaskRunnerReference");
  var UI5 = {
    init: /* @__PURE__ */ __name(() => {
      return UI5.create();
    }, "init"),
    create: /* @__PURE__ */ __name(() => {
      const acquisitionButton = [...document.querySelectorAll("button")].find(
        (btn) => [...Config.ACQUISITION_TEXT_SET].some((keyword) => btn.textContent.includes(keyword))
      );
      const downloadTexts = ["\u4E0B\u8F7D", "Download"];
      const downloadButton = [...document.querySelectorAll('a[href*="/download/"], button')].find(
        (btn) => downloadTexts.some((text) => btn.textContent.includes(text))
      );
      if (acquisitionButton || downloadButton) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("workerId")) return false;
        Utils.logger("info", "On a detail page (detected by action buttons), skipping UI creation.");
        return false;
      }
      if (document.getElementById(Config.UI_CONTAINER_ID)) return true;
      const styles = `
            :root {
                --bg-color: rgba(20, 21, 26, 0.92);
                --card-bg: rgba(255, 255, 255, 0.04);
                --card-bg-recessed: rgba(0, 0, 0, 0.28);
                --card-border: rgba(255, 255, 255, 0.075);
                --border-color: rgba(255, 255, 255, 0.11);
                --text-color-primary: #f5f5f7;
                --text-color-secondary: #8e8e96;
                --radius-l: 14px;
                --radius-m: 9px;
                --radius-s: 6px;
                --blue: #0a84ff; --pink: #ff453a; --green: #32d74b;
                --orange: #ffd60a; --gray: #8e8e93; --dark-gray: #3a3a3c;
                --blue-bg: rgba(10, 132, 255, 0.18);
            }
            #${Config.UI_CONTAINER_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                background: var(--bg-color);
                backdrop-filter: blur(20px) saturate(1.8);
                -webkit-backdrop-filter: blur(20px) saturate(1.8);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-l);
                color: var(--text-color-primary);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                width: 336px;
                max-width: calc(100vw - 24px);
                font-size: 13px;
                font-variant-numeric: tabular-nums;
                box-shadow: 0 12px 40px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.09);
            }
            #${Config.UI_CONTAINER_ID} *, #${Config.UI_CONTAINER_ID} *::before, #${Config.UI_CONTAINER_ID} *::after {
                box-sizing: border-box;
            }
            #${Config.UI_CONTAINER_ID} button:focus-visible,
            #${Config.UI_CONTAINER_ID} input:focus-visible {
                outline: 2px solid var(--blue);
                outline-offset: 1px;
            }
            #${Config.UI_CONTAINER_ID}.fab-helper-collapsed .fab-helper-tabs,
            #${Config.UI_CONTAINER_ID}.fab-helper-collapsed .fab-helper-tab-content {
                display: none !important;
            }
            .fab-helper-header {
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }
            #${Config.UI_CONTAINER_ID}.fab-helper-collapsed .fab-helper-header {
                border-bottom: none;
            }
            .fab-header-brand {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }
            .fab-header-version {
                font-size: 11px;
                color: var(--text-color-secondary);
                background: rgba(255, 255, 255, 0.07);
                padding: 1px 5px;
                border-radius: var(--radius-s);
            }
            .fab-header-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            .fab-header-live-badge {
                display: none;
                font-size: 11px;
                font-weight: 600;
                color: var(--text-color-primary);
                background: var(--blue-bg);
                border: 1px solid rgba(10, 132, 255, 0.4);
                padding: 2px 7px;
                border-radius: 999px;
                white-space: nowrap;
            }
            .fab-collapse-btn {
                width: 24px;
                height: 24px;
                border-radius: var(--radius-s);
                border: 1px solid var(--card-border);
                background: var(--card-bg);
                color: var(--text-color-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                line-height: 1;
                padding: 0;
                transition: background-color 0.15s, color 0.15s;
            }
            .fab-collapse-btn:hover {
                background: rgba(255, 255, 255, 0.12);
                color: var(--text-color-primary);
            }
            .fab-helper-tabs {
                display: flex;
                border-bottom: 1px solid var(--border-color);
            }
            .fab-helper-tabs button {
                flex: 1;
                padding: 8px 0;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                background: transparent;
                border: none;
                color: var(--text-color-secondary);
                transition: color 0.2s, border-bottom 0.2s;
                border-bottom: 2px solid transparent;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .fab-helper-tabs button.active {
                color: var(--text-color-primary);
                border-bottom: 2px solid var(--blue);
            }
            .fab-helper-tab-content {
                padding: 10px 12px 12px;
                max-height: min(72vh, 540px);
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
            }
            .fab-helper-tab-content::-webkit-scrollbar {
                width: 6px;
            }
            .fab-helper-tab-content::-webkit-scrollbar-track {
                background: transparent;
            }
            .fab-helper-tab-content::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.22);
                border-radius: 3px;
            }
            .fab-helper-owned-inline {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                color: #30d158;
                font-weight: 600;
                font-size: 12px;
                line-height: 1.3;
            }
            .fab-primary-action-row {
                display: flex;
                gap: 6px;
                align-items: stretch;
                margin-bottom: 9px;
            }
            .fab-reset-checkpoint-btn {
                flex: 0 0 auto;
                padding: 0 12px;
                border-radius: var(--radius-m);
                border: 1px solid var(--card-border);
                background: var(--card-bg);
                color: var(--text-color-primary);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
                transition: background-color 0.15s, border-color 0.15s;
            }
            .fab-reset-checkpoint-btn:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
            }
            .fab-reset-checkpoint-btn:disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }
            .fab-progress-card {
                background: rgba(255, 255, 255, 0.035);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                padding: 9px 11px;
                margin-bottom: 9px;
            }
            .fab-progress-head {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                gap: 8px;
            }
            .fab-progress-title {
                font-size: 12px;
                font-weight: 500;
                color: var(--text-color-primary);
                font-variant-numeric: tabular-nums;
            }
            .fab-progress-pct {
                font-size: 13px;
                font-weight: 700;
                color: #fff;
                font-variant-numeric: tabular-nums;
                flex-shrink: 0;
            }
            .fab-progress-pct.is-success {
                color: var(--green);
            }
            .fab-progress-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                font-size: 11.5px;
                color: var(--text-color-secondary);
                margin-top: 2px;
            }
            .fab-progress-meta-left.is-warn {
                color: var(--orange);
                font-weight: 500;
            }
            .fab-progress-meta-right {
                font-variant-numeric: tabular-nums;
            }
            .fab-progress-meta-right.is-success {
                color: var(--green);
                font-weight: 600;
            }
            .fab-quick-pills {
                display: flex;
                gap: 6px;
                margin-bottom: 10px;
            }
            .fab-pill-btn {
                flex: 1;
                min-width: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 7px 6px;
                border-radius: var(--radius-m);
                border: 1px solid var(--card-border);
                background: rgba(255, 255, 255, 0.025);
                color: var(--text-color-secondary);
                font-size: 11.5px;
                font-weight: 500;
                cursor: pointer;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: background-color 0.15s, border-color 0.15s, color 0.15s;
            }
            .fab-pill-btn:hover {
                color: var(--text-color-primary);
                background: rgba(255, 255, 255, 0.07);
            }
            .fab-pill-btn.active {
                background: rgba(255, 255, 255, 0.085);
                border-color: rgba(255, 255, 255, 0.18);
                color: var(--text-color-primary);
                font-weight: 600;
            }
            .fab-pill-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.22);
                flex-shrink: 0;
                transition: background-color 0.15s, box-shadow 0.15s;
            }
            .fab-pill-btn.active .fab-pill-dot {
                background: var(--green);
                box-shadow: 0 0 6px rgba(50, 215, 75, 0.65);
            }
            .fab-pill-text {
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .fab-retry-inline-btn {
                display: none;
                align-items: center;
                justify-content: center;
                padding: 1px 6px;
                border-radius: 999px;
                border: 1px solid rgba(255, 69, 58, 0.38);
                background: rgba(255, 69, 58, 0.18);
                color: #ff6961;
                font-size: 10.5px;
                font-weight: 600;
                line-height: 1.3;
                cursor: pointer;
                flex-shrink: 0;
                transition: background-color 0.15s;
            }
            .fab-retry-inline-btn:hover {
                background: rgba(255, 69, 58, 0.3);
            }
            .fab-helper-status-bar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 9px;
            }
            .fab-helper-status-item {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                padding: 8px 10px;
                border-radius: var(--radius-m);
                font-size: 11px;
                color: var(--text-color-secondary);
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: flex-start;
                gap: 4px;
                min-width: 0;
                transition: border-color 0.2s, background-color 0.2s;
            }
            .fab-helper-status-item.grid-3 {
                flex-grow: 1;
                flex-basis: calc((100% - 12px) / 3);
            }
            .fab-helper-status-item.grid-2 {
                flex-grow: 1;
                flex-basis: calc((100% - 6px) / 2);
            }
            .fab-helper-status-item.has-failed {
                border-color: rgba(255, 69, 58, 0.36);
                background: rgba(255, 69, 58, 0.07);
            }
            .fab-status-head {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 4px;
            }
            .fab-helper-status-label {
                display: flex;
                align-items: center;
                gap: 4px;
                white-space: nowrap;
                font-size: 11px;
                color: var(--text-color-secondary);
            }
            .fab-helper-status-item > span {
                display: block;
                font-size: 17px;
                font-weight: 650;
                color: #fff;
                line-height: 1.15;
                font-variant-numeric: tabular-nums;
            }
            .fab-helper-execute-btn {
                flex: 1;
                min-width: 0;
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: var(--radius-m);
                padding: 9px 14px;
                font-size: 13.5px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
                color: #fff;
                background: linear-gradient(180deg, #1f8fff 0%, #0071e3 100%);
                margin-bottom: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 7px;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 2px 8px rgba(0, 113, 227, 0.28);
            }
            .fab-helper-execute-btn:hover {
                filter: brightness(1.06);
            }
            .fab-helper-execute-btn.executing {
                background: rgba(255, 69, 58, 0.14);
                border-color: rgba(255, 69, 58, 0.38);
                color: #ff6961;
                box-shadow: none;
                animation: none;
            }
            .fab-helper-execute-btn.executing::before {
                content: '';
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #ff6961;
                flex-shrink: 0;
            }
            .fab-progress-track {
                width: 100%;
                height: 5px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 999px;
                margin: 7px 0 6px;
                overflow: hidden;
                display: none;
            }
            .fab-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #0a84ff, #32ade6);
                width: 0%;
                transition: width 0.3s ease;
                border-radius: 999px;
            }
            .fab-helper-actions {
                display: flex;
                gap: 6px;
                margin-bottom: 8px;
            }
            .fab-helper-actions button {
                flex: 1;
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                color: var(--text-color-primary);
                padding: 7px 6px;
                cursor: pointer;
                transition: background-color 0.2s, border-color 0.2s;
                white-space: nowrap;
                font-size: 12px;
                font-weight: normal;
            }
            .fab-helper-actions button:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.18);
            }
            .fab-helper-actions button:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .fab-helper-position-container {
                margin-top: 4px;
                padding: 4px 7px;
                background: var(--card-bg-recessed);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: var(--radius-s);
                font-size: 11.5px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .fab-helper-keepalive-status {
                font-size: 11px;
                opacity: 0.85;
                margin: 0 2px 6px 2px;
                display: none;
            }
            .fab-log-container {
                margin-top: 6px;
                border-top: 1px solid var(--border-color);
                padding-top: 6px;
            }
            .fab-log-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                cursor: pointer;
                user-select: none;
            }
            .fab-log-header span {
                font-size: 12px;
                font-weight: 500;
                color: var(--text-color-secondary);
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .fab-log-controls {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .fab-log-controls button {
                background: transparent;
                border: none;
                color: var(--text-color-secondary);
                cursor: pointer;
                padding: 2px 5px;
                border-radius: 4px;
                font-size: 11px;
                line-height: 1.2;
                transition: color 0.15s, background-color 0.15s;
            }
            .fab-log-controls button:hover {
                color: var(--text-color-primary);
                background: rgba(255, 255, 255, 0.08);
            }
            #${Config.UI_LOG_ID} {
                background: rgba(10, 10, 12, 0.85);
                color: #e0e0e4;
                font-size: 11px;
                line-height: 1.4;
                padding: 7px 8px;
                border-radius: var(--radius-m);
                max-height: 120px;
                overflow-y: auto;
                min-height: 44px;
                display: flex;
                flex-direction: column-reverse;
                box-shadow: inset 0 1px 4px rgba(0,0,0,0.3);
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.2) rgba(0,0,0,0.2);
            }
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
            .fab-setting-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                padding: 6px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            }
            .fab-setting-row:last-child {
                border-bottom: none;
            }
            .fab-setting-label {
                font-size: 12.5px;
                color: var(--text-color-primary);
            }
            .fab-card-group {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                padding: 8px 10px;
                margin-bottom: 8px;
            }
            .fab-card-group:last-child {
                margin-bottom: 0;
            }
            .fab-card-group-title {
                font-size: 11px;
                font-weight: 600;
                color: var(--text-color-secondary);
                margin-bottom: 6px;
            }
            .fab-collapsible-card {
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: var(--radius-m);
                overflow: hidden;
            }
            .fab-collapsible-toggle {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                border: none;
                background: transparent;
                color: var(--text-color-secondary);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                text-align: left;
            }
            .fab-collapsible-toggle:hover {
                color: var(--text-color-primary);
            }
            .fab-collapsible-body {
                padding: 0 10px 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }
            .fab-stepper-btn {
                width: 24px;
                height: 24px;
                border-radius: var(--radius-s);
                border: 1px solid var(--border-color);
                background: var(--dark-gray);
                color: var(--text-color-primary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                line-height: 1;
                transition: background 0.15s;
            }
            .fab-stepper-btn:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            .fab-stepper-input {
                width: 40px;
                height: 24px;
                text-align: center;
                border-radius: var(--radius-s);
                border: 1px solid var(--border-color);
                background: rgba(0, 0, 0, 0.3);
                color: var(--text-color-primary);
                font-weight: 600;
                font-size: 13px;
                -moz-appearance: textfield;
            }
            .fab-danger-btn {
                width: 100%;
                margin-top: 6px;
                background-color: rgba(255, 55, 95, 0.16);
                color: var(--pink);
                border: 1px solid rgba(255, 55, 95, 0.4);
                padding: 7px 10px;
                border-radius: var(--radius-m);
                font-size: 12.5px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            .fab-danger-btn:hover {
                background-color: var(--pink);
                color: #fff;
            }
            .fab-toggle-switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 22px;
                flex-shrink: 0;
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
                transition: .25s;
                border-radius: 22px;
            }
            .fab-toggle-slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .25s;
                border-radius: 50%;
            }
            input:checked + .fab-toggle-slider {
                background-color: var(--blue);
            }
            input:checked + .fab-toggle-slider:before {
                transform: translateX(18px);
            }
            .fab-debug-history-container {
                scrollbar-width: thin;
                scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.2);
            }
            .fab-debug-history-container::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            .fab-debug-history-container::-webkit-scrollbar-track {
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
            }
            .fab-debug-history-container::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.3);
                border-radius: 4px;
            }
            .fab-helper-toast-container {
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .fab-helper-toast {
                pointer-events: auto;
                background: var(--bg-color);
                backdrop-filter: blur(15px) saturate(1.8);
                -webkit-backdrop-filter: blur(15px) saturate(1.8);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-m);
                padding: 12px 16px;
                color: var(--text-color-primary);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                min-width: 250px;
                max-width: 350px;
                animation: fab-helper-slide-in 0.3s ease-out;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .fab-helper-toast-content {
                flex: 1;
                font-size: 13px;
                line-height: 1.4;
            }
            .fab-helper-toast-close {
                cursor: pointer;
                background: transparent;
                border: none;
                color: var(--text-color-secondary);
                font-size: 18px;
                font-weight: bold;
                padding: 0 4px;
                line-height: 1;
                transition: color 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .fab-helper-toast-close:hover {
                color: var(--pink);
            }
            @keyframes fab-helper-slide-in {
                from {
                    transform: translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @media (prefers-reduced-motion: reduce) {
                #${Config.UI_CONTAINER_ID} *,
                .fab-helper-toast {
                    animation: none !important;
                    transition: none !important;
                }
            }
        `;
      const styleSheet = document.createElement("style");
      styleSheet.innerText = styles;
      document.head.appendChild(styleSheet);
      const container = document.createElement("div");
      container.id = Config.UI_CONTAINER_ID;
      State.UI.container = container;
      State.UI.i18nBindings = [];
      const bindText = /* @__PURE__ */ __name((el, key, prefix = "", suffix = "") => {
        State.UI.i18nBindings.push({ el, key, prefix, suffix });
        el.textContent = `${prefix}${Utils.getText(key)}${suffix}`;
        return el;
      }, "bindText");
      const createSettingRow = /* @__PURE__ */ __name((labelKey, stateKey, tooltipKey = null, uiRefKey = null) => {
        const row = document.createElement("div");
        row.className = "fab-setting-row";
        if (tooltipKey) row.title = Utils.getText(tooltipKey);
        const label = document.createElement("span");
        label.className = "fab-setting-label";
        bindText(label, labelKey);
        const switchContainer = document.createElement("label");
        switchContainer.className = "fab-toggle-switch";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = Boolean(State[stateKey]);
        input.onchange = async (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!TaskRunner3) return;
          if (stateKey === "domFallbackMode") {
            await TaskRunner3.setDomFallbackMode(!State.domFallbackMode);
          } else if (stateKey === "autoAddOnScroll") {
            TaskRunner3.toggleAutoAdd();
          } else if (stateKey === "autoScroll") {
            TaskRunner3.toggleAutoScroll();
          } else if (stateKey === "rememberScrollPosition") {
            await TaskRunner3.toggleRememberPosition();
          } else if (stateKey === "autoResumeAfter429") {
            TaskRunner3.toggleAutoResume();
          } else if (stateKey === "autoRefreshEmptyPage") {
            TaskRunner3.toggleAutoRefreshEmpty();
          } else if (stateKey === "hideDiscountedPaid") {
            TaskRunner3.toggleHideDiscountedPaid();
          } else if (stateKey === "hidePaid") {
            TaskRunner3.toggleHidePaid();
          } else if (stateKey === "blockLargeResources") {
            TaskRunner3.toggleBlockResources();
          }
          e.target.checked = Boolean(State[stateKey]);
          UI5.update();
        };
        const slider = document.createElement("span");
        slider.className = "fab-toggle-slider";
        if (uiRefKey) {
          State.UI[uiRefKey] = input;
        }
        switchContainer.append(input, slider);
        row.append(label, switchContainer);
        return row;
      }, "createSettingRow");
      const createNumberSettingRow = /* @__PURE__ */ __name((labelKey, stateKey, min, max, tooltipKey, options = {}) => {
        const { onChange, uiRefKey, defaultValue } = options;
        const row = document.createElement("div");
        row.className = "fab-setting-row";
        if (tooltipKey) row.title = Utils.getText(tooltipKey);
        const label = document.createElement("span");
        label.className = "fab-setting-label";
        bindText(label, labelKey);
        const controlContainer = document.createElement("div");
        controlContainer.style.cssText = "display: flex; align-items: center; gap: 6px;";
        const minusBtn = document.createElement("button");
        minusBtn.type = "button";
        minusBtn.className = "fab-stepper-btn";
        minusBtn.textContent = "\u2212";
        const valueInput = document.createElement("input");
        valueInput.type = "number";
        valueInput.min = String(min);
        valueInput.max = String(max);
        valueInput.value = State[stateKey] ?? defaultValue ?? min;
        valueInput.className = "fab-stepper-input";
        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "fab-stepper-btn";
        plusBtn.textContent = "+";
        const applyVal = /* @__PURE__ */ __name(async (val) => {
          const parsed = Math.floor(Number(val));
          const target = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : min));
          valueInput.value = target;
          if (typeof onChange === "function") {
            await onChange(target);
          } else {
            State[stateKey] = target;
          }
        }, "applyVal");
        minusBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          applyVal((Number(valueInput.value) || min) - 1);
        };
        plusBtn.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          applyVal((Number(valueInput.value) || min) + 1);
        };
        valueInput.onchange = (e) => {
          e.stopPropagation();
          applyVal(Number(e.target.value) || min);
        };
        if (uiRefKey) {
          State.UI[uiRefKey] = valueInput;
        }
        controlContainer.append(minusBtn, valueInput, plusBtn);
        row.append(label, controlContainer);
        return row;
      }, "createNumberSettingRow");
      const createCardGroup = /* @__PURE__ */ __name((titleKey) => {
        const card = document.createElement("div");
        card.className = "fab-card-group";
        const cardTitle = document.createElement("div");
        cardTitle.className = "fab-card-group-title";
        bindText(cardTitle, titleKey);
        card.appendChild(cardTitle);
        return card;
      }, "createCardGroup");
      const header = document.createElement("div");
      header.className = "fab-helper-header";
      const brand = document.createElement("div");
      brand.className = "fab-header-brand";
      const title = document.createElement("span");
      bindText(title, "app_title");
      title.style.fontWeight = "600";
      const version = document.createElement("span");
      version.className = "fab-header-version";
      const scriptVersion = globalThis.GM_info?.script?.version || "";
      version.textContent = scriptVersion ? `v${scriptVersion}` : "";
      brand.append(title, version);
      const headerActions = document.createElement("div");
      headerActions.className = "fab-header-actions";
      const headerLiveBadge = document.createElement("span");
      headerLiveBadge.className = "fab-header-live-badge";
      State.UI.headerLiveBadge = headerLiveBadge;
      const collapseBtn = document.createElement("button");
      collapseBtn.type = "button";
      collapseBtn.className = "fab-collapse-btn";
      collapseBtn.onclick = () => {
        State.uiExpanded = !State.uiExpanded;
        Database.saveUiExpandedPref();
        UI5.update();
      };
      State.UI.collapseBtn = collapseBtn;
      headerActions.append(headerLiveBadge, collapseBtn);
      header.append(brand, headerActions);
      container.appendChild(header);
      const tabContainer = document.createElement("div");
      tabContainer.className = "fab-helper-tabs";
      State.UI.tabsContainer = tabContainer;
      const tabs = ["dashboard", "settings", "debug"];
      State.activeTab = State.activeTab || "dashboard";
      tabs.forEach((tabName) => {
        const btn = document.createElement("button");
        btn.type = "button";
        bindText(btn, `tab_${tabName}`);
        btn.onclick = () => UI5.switchTab(tabName);
        if (tabName === State.activeTab) btn.classList.add("active");
        tabContainer.appendChild(btn);
        State.UI.tabs[tabName] = btn;
      });
      container.appendChild(tabContainer);
      const dashboardContent = document.createElement("div");
      dashboardContent.className = "fab-helper-tab-content";
      dashboardContent.style.display = "block";
      State.UI.tabContents.dashboard = dashboardContent;
      const primaryRow = document.createElement("div");
      primaryRow.className = "fab-primary-action-row";
      State.UI.execBtn = document.createElement("button");
      State.UI.execBtn.type = "button";
      State.UI.execBtn.className = "fab-helper-execute-btn";
      State.UI.execBtn.onclick = () => TaskRunner3 && TaskRunner3.toggleExecution();
      State.UI.resetCheckpointBtn = document.createElement("button");
      State.UI.resetCheckpointBtn.type = "button";
      State.UI.resetCheckpointBtn.className = "fab-reset-checkpoint-btn";
      bindText(State.UI.resetCheckpointBtn, "reset_checkpoint");
      State.UI.resetCheckpointBtn.style.display = "none";
      State.UI.resetCheckpointBtn.onclick = async () => {
        if (State.isExecuting || FastScanner.isRunning()) return;
        if (!State.hasFastScanCheckpoint && !State.fastScanStatus) return;
        if (window.confirm(Utils.getText("confirm_reset_checkpoint"))) {
          await FastScanner.clearCheckpoint();
          State.fastScanStatus = null;
          State.fastScanCheckpointMeta = null;
          State.hasFastScanCheckpoint = false;
          Utils.logger("info", Utils.getText("log_checkpoint_cleared"));
          UI5.update();
        }
      };
      primaryRow.append(State.UI.execBtn, State.UI.resetCheckpointBtn);
      const progressCard = document.createElement("div");
      progressCard.className = "fab-progress-card";
      progressCard.style.display = "none";
      const progressHead = document.createElement("div");
      progressHead.className = "fab-progress-head";
      const progressTitle = document.createElement("span");
      progressTitle.className = "fab-progress-title";
      const progressPct = document.createElement("span");
      progressPct.className = "fab-progress-pct";
      progressHead.append(progressTitle, progressPct);
      const progressTrack = document.createElement("div");
      progressTrack.className = "fab-progress-track";
      const progressBar = document.createElement("div");
      progressBar.className = "fab-progress-bar";
      progressTrack.appendChild(progressBar);
      State.UI.progressTrack = progressTrack;
      State.UI.progressBar = progressBar;
      const progressMeta = document.createElement("div");
      progressMeta.className = "fab-progress-meta";
      const progressMetaLeft = document.createElement("span");
      progressMetaLeft.className = "fab-progress-meta-left";
      const progressMetaRight = document.createElement("span");
      progressMetaRight.className = "fab-progress-meta-right";
      progressMeta.append(progressMetaLeft, progressMetaRight);
      progressCard.append(progressHead, progressTrack, progressMeta);
      progressCard._titleEl = progressTitle;
      progressCard._pctEl = progressPct;
      progressCard._metaLeftEl = progressMetaLeft;
      progressCard._metaRightEl = progressMetaRight;
      State.UI.fastScanStatusDisplay = progressCard;
      State.UI.statusKeepAlive = document.createElement("div");
      State.UI.statusKeepAlive.className = "fab-helper-keepalive-status";
      State.UI.statusKeepAlive.title = "\u540E\u53F0\u4FDD\u6D3B\uFF1A\u2665\u5FC3\u8DF3(Worker,\u4E0D\u88AB\u8282\u6D41) + \u2744\uFE0F\u9632\u51BB\u7ED3(WebRTC)\u3002\u540E\u53F0/\u9501\u5C4F\u65F6\u5E94\u6301\u7EED\u5237\u65B0\uFF1B\u82E5\u663E\u793A\u672A\u542F\u52A8\u8BF4\u660E Worker \u88AB\u9875\u9762 CSP \u62E6\u622A";
      const statusBar = document.createElement("div");
      statusBar.className = "fab-helper-status-bar";
      const createStatusItem = /* @__PURE__ */ __name((id, labelKey, gridClass = "grid-3") => {
        const item = document.createElement("div");
        item.className = `fab-helper-status-item ${gridClass}`;
        const headDiv = document.createElement("div");
        headDiv.className = "fab-status-head";
        const labelDiv = document.createElement("div");
        labelDiv.className = "fab-helper-status-label";
        bindText(labelDiv, labelKey);
        headDiv.appendChild(labelDiv);
        const valSpan = document.createElement("span");
        valSpan.id = id;
        valSpan.textContent = "0";
        item.append(headDiv, valSpan);
        item._headEl = headDiv;
        item._valueEl = valSpan;
        return item;
      }, "createStatusItem");
      State.UI.statusTodo = createStatusItem("fab-status-todo", "todo", "grid-3");
      State.UI.statusDone = createStatusItem("fab-status-done", "added", "grid-3");
      State.UI.statusFailed = createStatusItem("fab-status-failed", "failed", "grid-3");
      State.UI.statusFailed.style.cursor = "pointer";
      State.UI.statusFailed.title = Utils.getText("tooltip_open_failed");
      State.UI.statusFailed.onclick = () => {
        if (State.db.failed.length === 0) {
          Utils.logger("info", Utils.getText("failed_list_empty"));
          return;
        }
        if (window.confirm(Utils.getText("confirm_open_failed", State.db.failed.length))) {
          Utils.logger("info", Utils.getText("opening_failed_items", State.db.failed.length));
          State.db.failed.forEach((task) => {
            GM_openInTab(task.url, { active: false });
          });
        }
      };
      State.UI.retryFailedBtn = document.createElement("button");
      State.UI.retryFailedBtn.type = "button";
      State.UI.retryFailedBtn.className = "fab-retry-inline-btn";
      State.UI.retryFailedBtn.style.display = "none";
      bindText(State.UI.retryFailedBtn, "retry_failed");
      State.UI.retryFailedBtn.onclick = (e) => {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        if (TaskRunner3) TaskRunner3.retryFailedTasks();
      };
      State.UI.statusFailed._headEl.appendChild(State.UI.retryFailedBtn);
      statusBar.append(State.UI.statusTodo, State.UI.statusDone, State.UI.statusFailed);
      const quickPills = document.createElement("div");
      quickPills.className = "fab-quick-pills";
      const makeQuickPill = /* @__PURE__ */ __name((labelKey, onClick) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "fab-pill-btn";
        const dot = document.createElement("span");
        dot.className = "fab-pill-dot";
        const textSpan = document.createElement("span");
        textSpan.className = "fab-pill-text";
        bindText(textSpan, labelKey);
        btn.append(dot, textSpan);
        btn._textEl = textSpan;
        btn.onclick = onClick;
        return btn;
      }, "makeQuickPill");
      State.UI.quickAutoClaimBtn = makeQuickPill("pill_auto_claim", () => TaskRunner3 && TaskRunner3.toggleAutoClaimVisible());
      State.UI.quickHideSavedBtn = makeQuickPill("pill_hide_saved", () => TaskRunner3 && TaskRunner3.toggleHideSaved());
      State.UI.quickHidePaidBtn = makeQuickPill("pill_hide_paid", () => TaskRunner3 && TaskRunner3.toggleHidePaid());
      quickPills.append(State.UI.quickAutoClaimBtn, State.UI.quickHideSavedBtn, State.UI.quickHidePaidBtn);
      const logContainer = document.createElement("div");
      logContainer.className = "fab-log-container";
      const logHeader = document.createElement("div");
      logHeader.className = "fab-log-header";
      const logTitle = document.createElement("span");
      const toggleArrow = document.createElement("span");
      toggleArrow.textContent = "\u25BE";
      toggleArrow.style.transition = "transform 0.2s";
      const logTitleText = document.createElement("span");
      bindText(logTitleText, "operation_log");
      logTitle.append(toggleArrow, logTitleText);
      const logControls = document.createElement("div");
      logControls.className = "fab-log-controls";
      const copyLogBtn = document.createElement("button");
      copyLogBtn.type = "button";
      bindText(copyLogBtn, "copyLog");
      copyLogBtn.title = Utils.getText("copyLog");
      copyLogBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(State.UI.logPanel.innerText).then(() => {
          copyLogBtn.textContent = Utils.getText("copied");
          setTimeout(() => {
            copyLogBtn.textContent = Utils.getText("copyLog");
          }, 1500);
        }).catch((err) => Utils.logger("error", "Failed to copy log:", err));
      };
      const clearLogBtn = document.createElement("button");
      clearLogBtn.type = "button";
      bindText(clearLogBtn, "clearLog");
      clearLogBtn.title = Utils.getText("clearLog");
      clearLogBtn.onclick = (e) => {
        e.stopPropagation();
        State.UI.logPanel.innerHTML = "";
      };
      logControls.append(copyLogBtn, clearLogBtn);
      logHeader.append(logTitle, logControls);
      State.UI.logPanel = document.createElement("div");
      State.UI.logPanel.id = Config.UI_LOG_ID;
      let isLogOpen = true;
      logHeader.onclick = () => {
        isLogOpen = !isLogOpen;
        State.UI.logPanel.style.display = isLogOpen ? "flex" : "none";
        toggleArrow.style.transform = isLogOpen ? "rotate(0deg)" : "rotate(-90deg)";
      };
      logContainer.append(logHeader, State.UI.logPanel);
      dashboardContent.append(
        primaryRow,
        progressCard,
        State.UI.statusKeepAlive,
        statusBar,
        quickPills,
        logContainer
      );
      container.appendChild(dashboardContent);
      const settingsContent = document.createElement("div");
      settingsContent.className = "fab-helper-tab-content";
      settingsContent.style.display = "none";
      const groupGeneralFilter = createCardGroup("settings_group_general_filter");
      groupGeneralFilter.appendChild(createSettingRow("setting_hide_discounted", "hideDiscountedPaid"));
      groupGeneralFilter.appendChild(createNumberSettingRow(
        "setting_api_scan_concurrency",
        "apiScanConcurrency",
        1,
        Config.MAX_API_SCAN_CONCURRENCY || 6,
        "setting_api_scan_concurrency_tooltip",
        {
          onChange: /* @__PURE__ */ __name((v) => TaskRunner3 && TaskRunner3.setApiScanConcurrency(v), "onChange"),
          uiRefKey: "apiScanConcurrencyInput",
          defaultValue: Config.DEFAULT_API_SCAN_CONCURRENCY || 4
        }
      ));
      groupGeneralFilter.appendChild(createSettingRow("setting_block_large_resources", "blockLargeResources"));
      const notificationRow = document.createElement("div");
      notificationRow.className = "fab-setting-row";
      const notificationLabel = document.createElement("span");
      notificationLabel.className = "fab-setting-label";
      bindText(notificationLabel, "setting_verification_notify");
      const notificationButton = document.createElement("button");
      notificationButton.type = "button";
      notificationButton.style.cssText = "padding: 4px 8px; font-size: 12px; cursor: pointer; border-radius: var(--radius-m); border: 1px solid var(--border-color); background: var(--dark-gray); color: var(--text-color-primary);";
      const renderNotificationPermission = /* @__PURE__ */ __name((permission = VerificationNotifications.permission()) => {
        const zh2 = State.lang === "zh";
        const labels = zh2 ? { granted: "\u6D4B\u8BD5\u901A\u77E5", default: "\u5F00\u542F\u5E76\u6D4B\u8BD5", denied: "\u5DF2\u88AB\u963B\u6B62", unsupported: "\u4E0D\u652F\u6301", unavailable: "\u91CD\u8BD5" } : { granted: "Test alert", default: "Enable & test", denied: "Blocked", unsupported: "Unsupported", unavailable: "Retry" };
        notificationButton.textContent = labels[permission] || labels.unavailable;
        notificationButton.disabled = permission === "unsupported";
        notificationButton.title = zh2 ? "\u5141\u8BB8\u901A\u77E5\u540E\uFF0C\u9047\u5230\u9A8C\u8BC1\u4F1A\u63D0\u9192\u60A8\u3002\u82E5\u88AB\u963B\u6B62\uFF0C\u8BF7\u5728\u7F51\u7AD9\u8BBE\u7F6E\u4E2D\u5141\u8BB8\u901A\u77E5\u3002" : "Allow notifications for verification alerts. If blocked, enable notifications in site settings.";
      }, "renderNotificationPermission");
      renderNotificationPermission();
      notificationButton.onclick = async () => {
        const permission = await VerificationNotifications.enableAndTest(State.lang);
        renderNotificationPermission(permission);
        if (permission !== "granted") Utils.logger("warn", notificationButton.title);
      };
      notificationRow.append(notificationLabel, notificationButton);
      groupGeneralFilter.appendChild(notificationRow);
      settingsContent.appendChild(groupGeneralFilter);
      const advancedCard = document.createElement("div");
      advancedCard.className = "fab-collapsible-card";
      const advancedToggle = document.createElement("button");
      advancedToggle.type = "button";
      advancedToggle.className = "fab-collapsible-toggle";
      const advancedTitle = document.createElement("span");
      bindText(advancedTitle, "settings_group_advanced_fallback");
      const advancedChevron = document.createElement("span");
      advancedChevron.textContent = State.settingsAdvancedOpen ? "\u25BE" : "\u25B8";
      advancedToggle.append(advancedTitle, advancedChevron);
      advancedToggle.setAttribute("aria-expanded", State.settingsAdvancedOpen ? "true" : "false");
      const advancedBody = document.createElement("div");
      advancedBody.className = "fab-collapsible-body";
      advancedBody.style.display = State.settingsAdvancedOpen ? "block" : "none";
      advancedBody.appendChild(createSettingRow(
        "setting_dom_fallback",
        "domFallbackMode",
        "setting_dom_fallback_tooltip",
        "domFallbackCheckbox"
      ));
      const fallbackControls = document.createElement("div");
      fallbackControls.style.display = State.domFallbackMode ? "block" : "none";
      fallbackControls.appendChild(createSettingRow(
        "setting_remember_position",
        "rememberScrollPosition",
        "setting_page_only_tooltip",
        "rememberPositionCheckbox"
      ));
      const positionContainer = document.createElement("div");
      positionContainer.className = "fab-helper-position-container";
      const positionIcon = document.createElement("span");
      positionIcon.textContent = Utils.getText("position_indicator");
      positionIcon.style.marginRight = "2px";
      const positionInfo = document.createElement("span");
      positionInfo.textContent = Utils.decodeCursor(State.savedCursor);
      positionInfo.style.cssText = "flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
      State.UI.savedPositionDisplay = positionInfo;
      const clearPositionBtn = document.createElement("button");
      clearPositionBtn.type = "button";
      clearPositionBtn.textContent = "\u21BA";
      clearPositionBtn.title = Utils.getText("clear_position_tooltip");
      clearPositionBtn.style.cssText = "background: none; border: none; cursor: pointer; margin-left: auto; font-size: 14px; padding: 0 4px; opacity: 0.7; transition: opacity 0.2s; color: var(--text-color-primary);";
      clearPositionBtn.onmouseover = () => {
        clearPositionBtn.style.opacity = "1";
      };
      clearPositionBtn.onmouseout = () => {
        clearPositionBtn.style.opacity = "0.7";
      };
      clearPositionBtn.onclick = async () => {
        const hasRecoveryCursor = typeof sessionStorage !== "undefined" && (sessionStorage.getItem("fab_helper_recovery_cursor") || sessionStorage.getItem("fab_helper_last_recovery_cursor"));
        if (State.savedCursor || PagePatcher._lastSeenCursor || hasRecoveryCursor) {
          PagePatcher.lockCursorSaving();
          if (confirm(Utils.getText("confirm_reset_position"))) {
            await PagePatcher.clearSavedPosition("User UI Reset");
            PagePatcher.armResetGuard();
            try {
              window.scrollTo(0, 0);
            } catch (e) {
            }
            try {
              const url = new URL(window.location.href);
              if (url.searchParams.has("cursor")) {
                url.searchParams.delete("cursor");
                window.location.href = url.toString();
                return;
              }
            } catch (e) {
            }
            window.location.reload();
          } else {
            PagePatcher.unlockCursorSaving();
          }
        } else {
          Utils.logger("info", Utils.getText("no_position_to_reset"));
        }
      };
      positionContainer.append(positionIcon, positionInfo, clearPositionBtn);
      fallbackControls.appendChild(positionContainer);
      State.UI.domFallbackControls = fallbackControls;
      advancedBody.appendChild(fallbackControls);
      advancedBody.appendChild(createNumberSettingRow(
        "setting_max_workers",
        "maxWorkers",
        1,
        15,
        "setting_max_workers_desc_tooltip",
        {
          onChange: /* @__PURE__ */ __name((v) => TaskRunner3 && TaskRunner3.setMaxWorkers(v), "onChange"),
          uiRefKey: "maxWorkersInput",
          defaultValue: 7
        }
      ));
      advancedBody.appendChild(createSettingRow("setting_auto_resume_429", "autoResumeAfter429"));
      advancedBody.appendChild(createSettingRow("setting_auto_refresh", "autoRefreshEmptyPage"));
      const resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.className = "fab-danger-btn";
      bindText(resetButton, "clear_all_data");
      resetButton.onclick = Database.resetAllData;
      advancedBody.appendChild(resetButton);
      advancedToggle.onclick = () => {
        State.settingsAdvancedOpen = !State.settingsAdvancedOpen;
        advancedBody.style.display = State.settingsAdvancedOpen ? "block" : "none";
        advancedChevron.textContent = State.settingsAdvancedOpen ? "\u25BE" : "\u25B8";
        advancedToggle.setAttribute("aria-expanded", State.settingsAdvancedOpen ? "true" : "false");
      };
      State.UI.settingsAdvancedToggle = advancedToggle;
      State.UI.settingsAdvancedBody = advancedBody;
      advancedCard.append(advancedToggle, advancedBody);
      settingsContent.appendChild(advancedCard);
      State.UI.tabContents.settings = settingsContent;
      container.appendChild(settingsContent);
      const debugContent = document.createElement("div");
      debugContent.className = "fab-helper-tab-content";
      debugContent.style.display = "none";
      State.UI.debugContent = debugContent;
      State.UI.tabContents.debug = debugContent;
      const debugModeCard = document.createElement("div");
      debugModeCard.className = "fab-card-group";
      const debugModeRow = document.createElement("div");
      debugModeRow.className = "fab-setting-row";
      debugModeRow.title = Utils.getText("setting_debug_tooltip");
      const debugLabel = document.createElement("span");
      debugLabel.className = "fab-setting-label";
      bindText(debugLabel, "debug_mode");
      debugLabel.style.color = "#ff9f0a";
      const debugSwitchContainer = document.createElement("label");
      debugSwitchContainer.className = "fab-toggle-switch";
      const debugInput = document.createElement("input");
      debugInput.type = "checkbox";
      debugInput.checked = Boolean(State.debugMode);
      debugInput.onchange = (e) => {
        State.debugMode = e.target.checked;
        debugModeRow.classList.toggle("active", State.debugMode);
        Utils.logger(
          "info",
          Utils.getText(
            "log_debug_mode_toggled",
            State.debugMode ? Utils.getText("status_enabled") : Utils.getText("status_disabled"),
            State.debugMode ? Utils.getText("log_debug_mode_detail_info") : ""
          )
        );
        GM_setValue("fab_helper_debug_mode", State.debugMode);
      };
      State.UI.debugModeCheckbox = debugInput;
      const debugSlider = document.createElement("span");
      debugSlider.className = "fab-toggle-slider";
      debugSwitchContainer.append(debugInput, debugSlider);
      debugModeRow.append(debugLabel, debugSwitchContainer);
      debugModeRow.classList.toggle("active", Boolean(State.debugMode));
      debugModeCard.appendChild(debugModeRow);
      debugContent.appendChild(debugModeCard);
      const debugHeader = document.createElement("div");
      debugHeader.style.cssText = "display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px;";
      const debugTitle = document.createElement("h4");
      bindText(debugTitle, "status_history");
      debugTitle.style.cssText = "margin: 0; font-size: 14px; white-space: nowrap;";
      const debugControls = document.createElement("div");
      debugControls.style.cssText = "display: flex; gap: 6px; flex-wrap: wrap;";
      const copyHistoryBtn = document.createElement("button");
      copyHistoryBtn.type = "button";
      bindText(copyHistoryBtn, "copy_btn");
      copyHistoryBtn.title = "\u590D\u5236\u8BE6\u7EC6\u5386\u53F2\u8BB0\u5F55";
      copyHistoryBtn.style.cssText = "background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;";
      copyHistoryBtn.onclick = () => {
        if (State.statusHistory.length === 0) {
          Utils.logger("info", Utils.getText("no_history_to_copy"));
          return;
        }
        const formatEntry = /* @__PURE__ */ __name((entry) => {
          const date = new Date(entry.endTime).toLocaleString();
          if (entry.type === "STARTUP") {
            return `\u{1F680} ${Utils.getText("script_startup")}
  - ${Utils.getText("time_label")}: ${date}
  - ${Utils.getText("info_label")}: ${entry.message || ""}`;
          } else {
            const type = entry.type === "NORMAL" ? `\u2705 ${Utils.getText("normal_period")}` : `\u{1F6A8} ${Utils.getText("rate_limited_period")}`;
            let details = `${Utils.getText("duration_label")}: ${entry.duration !== void 0 && entry.duration !== null ? entry.duration.toFixed(2) : Utils.getText("unknown_duration")}s`;
            if (entry.requests !== void 0) {
              details += `, ${Utils.getText("requests_label")}: ${entry.requests}${Utils.getText("requests_unit")}`;
            }
            return `${type}
  - ${Utils.getText("ended_at")}: ${date}
  - ${details}`;
          }
        }, "formatEntry");
        const fullLog = State.statusHistory.map(formatEntry).join("\n\n");
        navigator.clipboard.writeText(fullLog).then(() => {
          const originalText = copyHistoryBtn.textContent;
          copyHistoryBtn.textContent = Utils.getText("copied_success");
          setTimeout(() => {
            copyHistoryBtn.textContent = originalText;
          }, 2e3);
        }).catch((err) => Utils.logger("error", Utils.getText("log_copy_failed"), err));
      };
      const clearHistoryBtn = document.createElement("button");
      clearHistoryBtn.type = "button";
      bindText(clearHistoryBtn, "clear_btn");
      clearHistoryBtn.title = "\u6E05\u7A7A\u5386\u53F2\u8BB0\u5F55";
      clearHistoryBtn.style.cssText = "background: var(--dark-gray); border: 1px solid var(--border-color); color: var(--text-color-secondary); padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer;";
      clearHistoryBtn.onclick = async () => {
        if (window.confirm(Utils.getText("confirm_clear_history"))) {
          State.statusHistory = [];
          await GM_deleteValue(Config.DB_KEYS.STATUS_HISTORY);
          const currentSessionEntry = {
            type: "STARTUP",
            duration: 0,
            endTime: (/* @__PURE__ */ new Date()).toISOString(),
            message: Utils.getText("history_cleared_new_session")
          };
          await RateLimitManager.addToHistory(currentSessionEntry);
          UI5.updateDebugTab();
          Utils.logger("info", Utils.getText("status_history_cleared"));
        }
      };
      const diagnosisBtn = document.createElement("button");
      diagnosisBtn.type = "button";
      bindText(diagnosisBtn, "page_diagnosis");
      diagnosisBtn.style.cssText = "background: var(--blue); border: 1px solid rgba(255,255,255,0.18); color: white; padding: 4px 8px; border-radius: var(--radius-m); cursor: pointer; white-space: nowrap;";
      diagnosisBtn.onclick = () => {
        try {
          const report = PageDiagnostics.diagnoseDetailPage();
          PageDiagnostics.logDiagnosticReport(report);
          Utils.logger("info", Utils.getText("log_diagnosis_complete"));
        } catch (error) {
          Utils.logger("error", Utils.getText("log_diagnosis_failed", error.message));
        }
      };
      debugControls.append(copyHistoryBtn, clearHistoryBtn, diagnosisBtn);
      debugHeader.append(debugTitle, debugControls);
      const historyListContainer = document.createElement("div");
      historyListContainer.style.cssText = "max-height: 250px; overflow-y: auto; background: rgba(10,10,10,0.85); color: #ddd; padding: 8px; border-radius: var(--radius-m);";
      historyListContainer.className = "fab-debug-history-container";
      State.UI.historyContainer = historyListContainer;
      debugContent.append(debugHeader, historyListContainer);
      container.appendChild(debugContent);
      document.body.appendChild(container);
      UI5.update();
      return true;
    }, "create"),
    update: /* @__PURE__ */ __name(() => {
      if (!State.UI.container) return;
      if (Array.isArray(State.UI.i18nBindings)) {
        State.UI.i18nBindings.forEach(({ el, key, prefix = "", suffix = "" }) => {
          if (el) el.textContent = `${prefix}${Utils.getText(key)}${suffix}`;
        });
      }
      const isFallback = Boolean(State.domFallbackMode);
      const isRunning = Boolean(State.isExecuting || FastScanner.isRunning());
      const fs = State.fastScanStatus;
      const expanded = Boolean(State.uiExpanded);
      const hasCheckpoint = !isFallback && Boolean(
        State.hasFastScanCheckpoint || fs?.phase === "paused" || fs?.phase === "partial"
      );
      const getCheckpointPct = /* @__PURE__ */ __name(() => {
        if (fs && fs.totalEstimated > 0 && Number.isFinite(fs.itemsScanned)) {
          return Math.min(99, Math.max(1, Math.round(fs.itemsScanned / fs.totalEstimated * 100)));
        }
        if (State.fastScanCheckpointMeta && Number.isFinite(State.fastScanCheckpointMeta.pct)) {
          return State.fastScanCheckpointMeta.pct;
        }
        return null;
      }, "getCheckpointPct");
      State.UI.container.classList.toggle("fab-helper-collapsed", !expanded);
      if (State.UI.tabsContainer) {
        State.UI.tabsContainer.style.display = expanded ? "flex" : "none";
      }
      const activeTab = State.activeTab || "dashboard";
      for (const name in State.UI.tabContents) {
        if (State.UI.tabContents[name]) {
          State.UI.tabContents[name].style.display = expanded && name === activeTab ? "block" : "none";
        }
      }
      if (State.UI.collapseBtn) {
        State.UI.collapseBtn.textContent = expanded ? "\u2212" : "+";
        State.UI.collapseBtn.title = Utils.getText(expanded ? "tooltip_collapse_ui" : "tooltip_expand_ui");
        State.UI.collapseBtn.setAttribute("aria-label", State.UI.collapseBtn.title);
        State.UI.collapseBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
      }
      if (State.UI.headerLiveBadge) {
        let badgeText = "";
        const fastRunning = FastScanner.isRunning() || Boolean(fs?.running);
        if (!expanded) {
          if (fastRunning && fs) {
            if (fs.totalEstimated > 0) {
              const pct = Math.min(100, Math.round(fs.itemsScanned / fs.totalEstimated * 100));
              badgeText = `\u26A1 ${pct}%`;
            } else {
              badgeText = `\u26A1 ${fs.itemsScanned.toLocaleString()}`;
            }
          } else if (isRunning) {
            badgeText = State.executionTotalTasks > 0 ? `${State.executionCompletedTasks + State.executionFailedTasks}/${State.executionTotalTasks}` : State.lang === "zh" ? "\u6267\u884C\u4E2D" : "Running";
          } else if (hasCheckpoint) {
            const pct = getCheckpointPct();
            badgeText = pct != null ? `\u25B6 ${pct}%` : State.lang === "zh" ? "\u26A1 \u65AD\u70B9" : "\u26A1 Paused";
          }
        }
        State.UI.headerLiveBadge.textContent = badgeText;
        State.UI.headerLiveBadge.style.display = badgeText ? "inline-flex" : "none";
      }
      if (State.UI.fastScanStatusDisplay) {
        const card = State.UI.fastScanStatusDisplay;
        const titleEl = card._titleEl;
        const pctEl = card._pctEl;
        const metaLeftEl = card._metaLeftEl;
        const metaRightEl = card._metaRightEl;
        const zh2 = State.lang === "zh";
        const setTrack = /* @__PURE__ */ __name((show, pct) => {
          if (!State.UI.progressTrack || !State.UI.progressBar) return;
          State.UI.progressTrack.style.display = show ? "block" : "none";
          State.UI.progressBar.style.width = show ? `${Math.min(100, Math.max(0, pct || 0))}%` : "0%";
        }, "setTrack");
        const setClaimedMeta = /* @__PURE__ */ __name((claimedCount) => {
          if (!metaRightEl) return;
          const n = Number(claimedCount) || 0;
          metaRightEl.textContent = zh2 ? n > 0 ? `\u65B0\u5165\u5E93 +${n}` : "\u65B0\u5165\u5E93 0" : n > 0 ? `+${n} claimed` : "0 claimed";
          metaRightEl.classList.toggle("is-success", n > 0);
        }, "setClaimedMeta");
        if (pctEl) pctEl.classList.remove("is-success");
        if (metaLeftEl) metaLeftEl.classList.remove("is-warn");
        if (metaRightEl) metaRightEl.classList.remove("is-success");
        if (isFallback) {
          card.style.display = "block";
          const total = State.executionTotalTasks;
          const done = State.executionCompletedTasks + State.executionFailedTasks;
          if (isRunning && total > 0) {
            const pct = Math.min(100, Math.round(done / total * 100));
            if (titleEl) titleEl.textContent = `${done.toLocaleString()} / ${total.toLocaleString()}`;
            if (pctEl) pctEl.textContent = `${pct}%`;
            setTrack(true, pct);
          } else if (isRunning) {
            if (titleEl) titleEl.textContent = zh2 ? "\u6B63\u5728\u6EDA\u9875\u626B\u63CF\u5F53\u524D\u5217\u8868" : "Scrolling list";
            if (pctEl) pctEl.textContent = "";
            setTrack(false, 0);
          } else {
            if (titleEl) titleEl.textContent = Utils.getText("status_idle_fallback");
            if (pctEl) pctEl.textContent = "";
            setTrack(false, 0);
          }
          if (metaLeftEl) metaLeftEl.textContent = zh2 ? "\u5E94\u6025\u6EDA\u9875\u5907\u7528\u6A21\u5F0F" : "DOM scroll fallback";
          if (metaRightEl) metaRightEl.textContent = "";
        } else if (fs && fs.running) {
          card.style.display = "block";
          const hasTotal = fs.totalEstimated > 0;
          const pct = hasTotal ? Math.min(100, Math.round(fs.itemsScanned / fs.totalEstimated * 100)) : null;
          if (titleEl) {
            titleEl.textContent = hasTotal ? `${fs.itemsScanned.toLocaleString()} / ${fs.totalEstimated.toLocaleString()}` : fs.itemsScanned.toLocaleString();
          }
          if (pctEl) pctEl.textContent = pct != null ? `${pct}%` : "";
          setTrack(pct != null, pct || 0);
          const rateLimited = fs.rateLimitedUntil > Date.now();
          if (metaLeftEl) {
            metaLeftEl.textContent = rateLimited ? zh2 ? "\u9650\u901F\u7B49\u5F85\u4E2D" : "Rate limited" : fs.phase === "prepass" ? zh2 ? "\u524D\u7F6E\u5FEB\u7B5B\u4E2D" : "Quick pre-scan" : zh2 ? `${fs.itemsPerSec} \u4EF6/\u79D2` : `${fs.itemsPerSec}/s`;
            metaLeftEl.classList.toggle("is-warn", rateLimited);
          }
          setClaimedMeta(fs.claimedDirect);
        } else if (fs && fs.phase === "completed") {
          card.style.display = "block";
          if (titleEl) titleEl.textContent = Utils.getText("status_scan_done", fs.claimedDirect, fs.itemsScanned.toLocaleString());
          if (pctEl) {
            pctEl.textContent = "100%";
            pctEl.classList.add("is-success");
          }
          setTrack(true, 100);
          if (metaLeftEl) {
            metaLeftEl.textContent = fs.failed > 0 ? zh2 ? `\u5931\u8D25 ${fs.failed} \u9879` : `${fs.failed} failed` : zh2 ? "\u5168\u90E8\u6838\u5BF9\u5B8C\u6BD5" : "All verified";
          }
          setClaimedMeta(fs.claimedDirect);
        } else if (fs && fs.phase === "partial") {
          card.style.display = "block";
          const pct = getCheckpointPct();
          if (titleEl) {
            titleEl.textContent = Utils.getText(
              "status_scan_partial",
              fs.claimedDirect,
              fs.itemsScanned.toLocaleString(),
              fs.incompleteSlices || 1
            );
          }
          if (pctEl) pctEl.textContent = pct != null ? `${pct}%` : "";
          setTrack(pct != null, pct || 0);
          if (metaLeftEl) metaLeftEl.textContent = zh2 ? "\u5DF2\u4FDD\u5B58\u65AD\u70B9\uFF0C\u53EF\u7EE7\u7EED\u8865\u626B" : "Checkpoint saved";
          setClaimedMeta(fs.claimedDirect);
        } else if (hasCheckpoint) {
          card.style.display = "block";
          const pct = getCheckpointPct();
          const scanned = fs?.itemsScanned ?? State.fastScanCheckpointMeta?.itemsScanned ?? 0;
          const total = fs?.totalEstimated ?? State.fastScanCheckpointMeta?.totalEstimated ?? 0;
          if (titleEl) {
            titleEl.textContent = total > 0 ? Utils.getText("status_checkpoint_pct", pct || 0, Number(scanned).toLocaleString(), Number(total).toLocaleString()) : Utils.getText("status_checkpoint_generic");
          }
          if (pctEl) pctEl.textContent = pct != null ? `${pct}%` : "";
          setTrack(pct != null, pct || 0);
          if (metaLeftEl) metaLeftEl.textContent = zh2 ? "\u53EF\u7EE7\u7EED\u6216\u70B9\u53F3\u4FA7\u91CD\u626B" : "Resume or restart";
          if (metaRightEl) metaRightEl.textContent = "";
        } else {
          card.style.display = "none";
          setTrack(false, 0);
        }
      }
      const todoCount = State.db.todo.length + (fs && fs.running ? fs.pendingCount || 0 : 0);
      const doneCount = State.db.done.length;
      const failedCount = State.db.failed.length;
      const setStatusCount = /* @__PURE__ */ __name((item, val) => {
        if (!item) return;
        const span = item._valueEl || item.querySelector("span");
        if (span) span.textContent = Number(val || 0).toLocaleString();
      }, "setStatusCount");
      setStatusCount(State.UI.statusTodo, todoCount);
      setStatusCount(State.UI.statusDone, doneCount);
      setStatusCount(State.UI.statusFailed, failedCount);
      if (State.UI.statusFailed) {
        State.UI.statusFailed.classList.toggle("has-failed", failedCount > 0);
      }
      if (State.UI.execBtn) {
        if (isRunning) {
          State.UI.execBtn.textContent = Utils.getText(isFallback ? "exec_fallback_stop" : "exec_full_stop");
          State.UI.execBtn.classList.add("executing");
          if (!isFallback && FastScanner.isRunning() && fs && fs.totalEstimated > 0) {
            const percentage = Math.min(100, Math.round(fs.itemsScanned / fs.totalEstimated * 100));
            State.UI.execBtn.title = Utils.getText("tooltip_executing_progress", fs.itemsScanned, fs.totalEstimated, percentage);
          } else if (State.executionTotalTasks > 0) {
            const progress = State.executionCompletedTasks + State.executionFailedTasks;
            const percentage = Math.round(progress / State.executionTotalTasks * 100);
            State.UI.execBtn.title = Utils.getText("tooltip_executing_progress", progress, State.executionTotalTasks, percentage);
          } else {
            State.UI.execBtn.title = Utils.getText("tooltip_executing");
          }
        } else {
          if (isFallback) {
            State.UI.execBtn.textContent = Utils.getText("exec_fallback_start");
          } else if (hasCheckpoint) {
            const pct = getCheckpointPct();
            State.UI.execBtn.textContent = pct != null ? Utils.getText("exec_full_resume_pct", pct) : Utils.getText("exec_full_resume");
          } else {
            State.UI.execBtn.textContent = Utils.getText("exec_full_start");
          }
          State.UI.execBtn.classList.remove("executing");
          State.UI.execBtn.title = Utils.getText("tooltip_start_tasks");
        }
      }
      if (State.UI.resetCheckpointBtn) {
        const showRestart = !isRunning && !isFallback && hasCheckpoint;
        State.UI.resetCheckpointBtn.style.display = showRestart ? "" : "none";
        State.UI.resetCheckpointBtn.disabled = !showRestart;
      }
      if (State.UI.statusKeepAlive) {
        if (!isRunning) {
          State.UI.statusKeepAlive.style.display = "none";
        } else {
          State.UI.statusKeepAlive.style.display = "";
          const ka = KeepAlive.getStatus();
          if (!ka.heartbeatAlive) {
            State.UI.statusKeepAlive.textContent = `\u{1F6E1}\uFE0F ${Utils.getText("keepalive_label")}: ${Utils.getText("keepalive_dead")}`;
          } else {
            const ago = ka.lastTickAgoMs == null ? "?" : Math.round(ka.lastTickAgoMs / 1e3);
            const fg = ka.freezeGuard === "open" ? "\u2744\uFE0Fon" : ka.freezeGuard === "off" ? "\u2744\uFE0Foff" : "\u2744\uFE0F\u2026";
            State.UI.statusKeepAlive.textContent = `\u{1F6E1}\uFE0F ${Utils.getText("keepalive_label")}: \u2665${ago}s \xB7 ${fg}`;
          }
        }
      }
      if (State.UI.retryFailedBtn) {
        State.UI.retryFailedBtn.style.display = failedCount > 0 ? "inline-flex" : "none";
        State.UI.retryFailedBtn.textContent = Utils.getText("retry_failed");
        State.UI.retryFailedBtn.disabled = failedCount === 0;
        State.UI.retryFailedBtn.title = failedCount > 0 ? `${Utils.getText("retry_failed")} (${failedCount})` : Utils.getText("no_failed_tasks");
      }
      const syncPill = /* @__PURE__ */ __name((btn, active) => {
        if (!btn) return;
        const on = Boolean(active);
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }, "syncPill");
      syncPill(State.UI.quickAutoClaimBtn, State.autoClaimVisible);
      syncPill(State.UI.quickHideSavedBtn, State.hideSaved);
      syncPill(State.UI.quickHidePaidBtn, State.hidePaid);
      if (State.UI.domFallbackCheckbox) {
        State.UI.domFallbackCheckbox.checked = isFallback;
      }
      if (State.UI.domFallbackControls) {
        State.UI.domFallbackControls.style.display = isFallback ? "block" : "none";
      }
      if (State.UI.savedPositionDisplay) {
        State.UI.savedPositionDisplay.textContent = Utils.decodeCursor(State.savedCursor);
      }
      if (State.UI.maxWorkersInput && document.activeElement !== State.UI.maxWorkersInput) {
        State.UI.maxWorkersInput.value = State.maxWorkers;
      }
      if (State.UI.apiScanConcurrencyInput && document.activeElement !== State.UI.apiScanConcurrencyInput) {
        State.UI.apiScanConcurrencyInput.value = State.apiScanConcurrency;
      }
      if (State.UI.rememberPositionCheckbox) {
        State.UI.rememberPositionCheckbox.checked = Boolean(State.rememberScrollPosition);
      }
      if (State.UI.debugModeCheckbox) {
        State.UI.debugModeCheckbox.checked = Boolean(State.debugMode);
      }
    }, "update"),
    removeAllOverlays: /* @__PURE__ */ __name(() => {
      document.querySelectorAll(Config.SELECTORS.card).forEach((card) => {
        const overlay = card.querySelector(".fab-helper-overlay");
        if (overlay) overlay.remove();
        card.style.opacity = "1";
      });
    }, "removeAllOverlays"),
    showToast: /* @__PURE__ */ __name((message, isPersistent = false) => {
      let container = document.getElementById("fab-helper-toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "fab-helper-toast-container";
        container.className = "fab-helper-toast-container";
        document.body.appendChild(container);
      }
      const existingToasts = container.querySelectorAll(".fab-helper-toast");
      for (const existing of existingToasts) {
        if (existing.querySelector(".fab-helper-toast-content")?.textContent === message) {
          return;
        }
      }
      const toast = document.createElement("div");
      toast.className = "fab-helper-toast";
      const content = document.createElement("div");
      content.className = "fab-helper-toast-content";
      content.textContent = message;
      toast.appendChild(content);
      const closeBtn = document.createElement("button");
      closeBtn.className = "fab-helper-toast-close";
      closeBtn.innerHTML = "&times;";
      closeBtn.title = Utils.getText("close") || "Close";
      closeBtn.onclick = () => {
        toast.style.animation = "none";
        toast.style.transition = "opacity 0.2s, transform 0.2s";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 200);
      };
      toast.appendChild(closeBtn);
      container.appendChild(toast);
      if (!isPersistent) {
        setTimeout(() => {
          if (toast.parentNode) {
            closeBtn.click();
          }
        }, 5e3);
      }
    }, "showToast"),
    switchTab: /* @__PURE__ */ __name((tabName) => {
      State.activeTab = tabName;
      if (!State.uiExpanded) {
        State.uiExpanded = true;
        Database.saveUiExpandedPref();
      }
      for (const name in State.UI.tabs) {
        if (State.UI.tabs[name]) {
          State.UI.tabs[name].classList.toggle("active", name === tabName);
        }
        if (State.UI.tabContents[name]) {
          State.UI.tabContents[name].style.display = name === tabName ? "block" : "none";
        }
      }
      if (tabName === "debug") {
        UI5.updateDebugTab();
      }
      UI5.update();
    }, "switchTab"),
    updateDebugTab: /* @__PURE__ */ __name(() => {
      if (!State.UI.historyContainer) return;
      State.UI.historyContainer.innerHTML = "";
      const createHistoryItem = /* @__PURE__ */ __name((entry) => {
        const item = document.createElement("div");
        item.style.cssText = "padding: 8px; margin-bottom: 8px; background: rgba(50,50,55,0.5); border-radius: 6px; border-left: 3px solid;";
        if (entry.type === "STARTUP") {
          item.style.borderLeftColor = "#2196F3";
          item.innerHTML = `
                    <div style="font-weight: 500; color: #fff;">\u{1F680} ${Utils.getText("script_startup")}</div>
                    <div style="font-size: 12px; color: var(--text-color-secondary); padding-left: 22px;">
                        <div>${Utils.getText("time_label")}: ${new Date(entry.endTime).toLocaleString()}</div>
                        ${entry.message ? `<div>${Utils.getText("info_label")}: ${entry.message}</div>` : ""}
                    </div>
                `;
        } else {
          const isNormal = entry.type === "NORMAL";
          item.style.borderLeftColor = isNormal ? "var(--green)" : "var(--orange)";
          const icon = isNormal ? "\u2705" : "\u{1F6A8}";
          const title = isNormal ? Utils.getText("normal_period") : Utils.getText("rate_limited_period");
          const durationText = entry.duration !== void 0 && entry.duration !== null ? entry.duration.toFixed(2) : Utils.getText("unknown_duration");
          let detailsHtml = `<div>${Utils.getText("duration_label")}: <strong>${durationText}s</strong></div>`;
          if (entry.requests !== void 0) {
            detailsHtml += `<div>${Utils.getText("requests_label")}: <strong>${entry.requests}</strong>${Utils.getText("requests_unit")}</div>`;
          }
          detailsHtml += `<div>${Utils.getText("ended_at")}: ${new Date(entry.endTime).toLocaleString()}</div>`;
          item.innerHTML = `
                    <div style="font-weight: 500; color: #fff;"><span style="font-size: 18px;">${icon}</span> ${title}</div>
                    <div style="font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;">${detailsHtml}</div>
                `;
        }
        return item;
      }, "createHistoryItem");
      const createCurrentStatusItem = /* @__PURE__ */ __name(() => {
        const item = document.createElement("div");
        item.style.cssText = "padding: 12px; margin-bottom: 10px; background: rgba(0,122,255,0.15); border-radius: 8px; border: 1px solid rgba(0,122,255,0.3);";
        const header = document.createElement("div");
        header.style.cssText = "display: flex; align-items: center; gap: 8px;";
        const icon = State.appStatus === "NORMAL" ? "\u2705" : "\u{1F6A8}";
        const color = State.appStatus === "NORMAL" ? "var(--green)" : "var(--orange)";
        const titleText = State.appStatus === "NORMAL" ? Utils.getText("current_normal") : Utils.getText("current_rate_limited");
        header.innerHTML = `<span style="font-size: 18px;">${icon}</span> <strong style="color: ${color};">${titleText}</strong>`;
        const details = document.createElement("div");
        details.style.cssText = "font-size: 12px; color: var(--text-color-secondary); padding-left: 26px;";
        const startTime = State.appStatus === "NORMAL" ? State.normalStartTime : State.rateLimitStartTime;
        const duration = startTime ? ((Date.now() - startTime) / 1e3).toFixed(2) : Utils.getText("status_unknown_duration");
        let detailsHtml = `<div>${Utils.getText("status_ongoing_label")}<strong>${duration}s</strong></div>`;
        if (State.appStatus === "NORMAL") {
          detailsHtml += `<div>${Utils.getText("status_requests_label")}<strong>${State.successfulSearchCount}</strong></div>`;
        }
        const startTimeDisplay = startTime ? new Date(startTime).toLocaleString() : Utils.getText("status_unknown_time");
        detailsHtml += `<div>${Utils.getText("status_started_at_label")}${startTimeDisplay}</div>`;
        details.innerHTML = detailsHtml;
        item.append(header, details);
        State.UI.historyContainer.appendChild(item);
      }, "createCurrentStatusItem");
      createCurrentStatusItem();
      if (State.statusHistory.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.style.cssText = "color: #888; text-align: center; padding: 20px;";
        emptyMessage.textContent = Utils.getText("no_history");
        State.UI.historyContainer.appendChild(emptyMessage);
        return;
      }
      const reversedHistory = [...State.statusHistory].reverse();
      reversedHistory.forEach((entry) => State.UI.historyContainer.appendChild(createHistoryItem(entry)));
    }, "updateDebugTab")
  };

  // src/index.js
  (function() {
    try {
      if (isCheckoutPage(typeof window !== "undefined" ? window.location?.pathname : "")) return;
      const blockEnabled = typeof GM_getValue !== "undefined" ? GM_getValue("fab_block_resources_v1", true) : true;
      if (blockEnabled) {
        const meta = document.createElement("meta");
        meta.httpEquiv = "Content-Security-Policy";
        meta.content = "img-src 'none'; media-src 'none'; font-src 'none'; frame-src 'self' https://*.hcaptcha.com https://*.recaptcha.net https://*.google.com https://challenges.cloudflare.com; child-src 'self' https://*.hcaptcha.com https://*.recaptcha.net https://*.google.com https://challenges.cloudflare.com;";
        const appendCspToHead = /* @__PURE__ */ __name(() => {
          if (!document.head || meta.isConnected) return false;
          document.head.appendChild(meta);
          return true;
        }, "appendCspToHead");
        if (!appendCspToHead()) {
          const onHeadReady = /* @__PURE__ */ __name(() => {
            if (appendCspToHead()) {
              document.removeEventListener("DOMContentLoaded", onHeadReady);
            }
          }, "onHeadReady");
          document.addEventListener("DOMContentLoaded", onHeadReady, { once: true });
          if (document.documentElement && typeof MutationObserver !== "undefined") {
            const headObserver = new MutationObserver(() => {
              if (appendCspToHead()) headObserver.disconnect();
            });
            headObserver.observe(document.documentElement, { childList: true });
          }
        }
        const style = document.createElement("style");
        style.textContent = `
                img, source, picture, video, iframe:not([src*="/payment/web/purchase"]):not([src*="hcaptcha"]):not([src*="recaptcha"]):not([src*="captcha"]):not([src*="turnstile"]):not([src*="challenges.cloudflare.com"]):not([src*="arkoselabs"]):not([data-fab-claim-frame]), [style*="background-image"] {
                    display: none !important;
                    background-image: none !important;
                }
            `;
        if (document.documentElement) {
          document.documentElement.appendChild(style);
        } else {
          document.appendChild(style);
        }
        const blockImage = /* @__PURE__ */ __name((el) => {
          if (el.tagName === "IMG") {
            if (el.src && !el.src.startsWith("data:")) {
              el.setAttribute("data-original-src", el.src);
              el.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            }
            if (el.srcset) {
              el.setAttribute("data-original-srcset", el.srcset);
              el.srcset = "";
            }
          } else if (el.tagName === "SOURCE") {
            if (el.srcset) {
              el.setAttribute("data-original-srcset", el.srcset);
              el.srcset = "";
            }
          }
        }, "blockImage");
        const traverseAndBlock = /* @__PURE__ */ __name((node) => {
          if (node.nodeType !== 1) return;
          if (node.tagName === "IMG" || node.tagName === "SOURCE") {
            blockImage(node);
          }
          const descendants = node.querySelectorAll("img, source");
          descendants.forEach(blockImage);
        }, "traverseAndBlock");
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              traverseAndBlock(node);
            }
          }
        });
        observer.observe(document.documentElement || document, {
          childList: true,
          subtree: true
        });
        window.addEventListener("load", () => {
          setTimeout(() => {
            try {
              observer.disconnect();
            } catch (e) {
            }
          }, 2e3);
        }, { once: true });
        console.log("[Fab Helper] Injected CSP, CSS, and MutationObserver to block images/media/iframes/fonts.");
      }
    } catch (e) {
      console.error("[Fab Helper] Failed to inject CSP:", e);
    }
  })();
  var currentCountdownInterval = null;
  var currentRefreshTimeout = null;
  function countdownRefresh3(delay, reason = "\u5907\u9009\u65B9\u6848") {
    if (State.isRefreshScheduled) {
      Utils.logger("debug", Utils.getText("refresh_plan_exists").replace("(429\u81EA\u52A8\u6062\u590D)", `(${reason})`));
      return;
    }
    State.isRefreshScheduled = true;
    if (currentCountdownInterval) {
      clearInterval(currentCountdownInterval);
      currentCountdownInterval = null;
    }
    if (currentRefreshTimeout) {
      clearTimeout(currentRefreshTimeout);
      currentRefreshTimeout = null;
    }
    const seconds = delay ? (delay / 1e3).toFixed(1) : "\u672A\u77E5";
    Utils.logger("debug", `\u{1F504} ${reason}\u542F\u52A8\uFF01\u5C06\u5728 ${seconds} \u79D2\u540E\u5237\u65B0\u9875\u9762\u5C1D\u8BD5\u6062\u590D...`);
    let remainingSeconds = Math.ceil(delay / 1e3);
    currentCountdownInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(currentCountdownInterval);
        currentCountdownInterval = null;
        Utils.logger("debug", `\u23F1\uFE0F \u5012\u8BA1\u65F6\u7ED3\u675F\uFF0C\u6B63\u5728\u5237\u65B0\u9875\u9762...`);
      } else {
        Utils.logger("debug", Utils.getText("auto_refresh_countdown", remainingSeconds));
        if (!State.isRefreshScheduled) {
          Utils.logger("debug", `\u23F9\uFE0F \u68C0\u6D4B\u5230\u5237\u65B0\u5DF2\u88AB\u53D6\u6D88\uFF0C\u505C\u6B62\u5012\u8BA1\u65F6`);
          clearInterval(currentCountdownInterval);
          currentCountdownInterval = null;
          if (currentRefreshTimeout) {
            clearTimeout(currentRefreshTimeout);
            currentRefreshTimeout = null;
          }
          return;
        }
        if (remainingSeconds % 3 === 0) {
          checkRateLimitStatus().then((isNotLimited) => {
            if (isNotLimited) {
              Utils.logger("debug", `\u23F1\uFE0F \u68C0\u6D4B\u5230API\u9650\u901F\u5DF2\u89E3\u9664\uFF0C\u53D6\u6D88\u5237\u65B0...`);
              clearInterval(currentCountdownInterval);
              currentCountdownInterval = null;
              if (currentRefreshTimeout) {
                clearTimeout(currentRefreshTimeout);
                currentRefreshTimeout = null;
              }
              State.isRefreshScheduled = false;
              if (State.appStatus === "RATE_LIMITED") {
                RateLimitManager.exitRateLimitedState();
              }
              return;
            }
            if (State.appStatus === "RATE_LIMITED") {
              const actualVisibleCount = parseInt(document.getElementById("fab-status-visible")?.textContent || "0");
              if (State.db.todo.length > 0 || State.activeWorkers > 0) {
                clearInterval(currentCountdownInterval);
                clearTimeout(currentRefreshTimeout);
                currentCountdownInterval = null;
                currentRefreshTimeout = null;
                State.isRefreshScheduled = false;
                Utils.logger("info", `\u23F9\uFE0F \u68C0\u6D4B\u5230\u6709 ${State.db.todo.length} \u4E2A\u5F85\u529E\u4EFB\u52A1\u548C ${State.activeWorkers} \u4E2A\u6D3B\u52A8\u5DE5\u4F5C\u7EBF\u7A0B\uFF0C\u5DF2\u53D6\u6D88\u81EA\u52A8\u5237\u65B0\u3002`);
                return;
              }
            } else {
              const visibleCount = parseInt(document.getElementById("fab-status-visible")?.textContent || "0");
              if (State.db.todo.length > 0 || State.activeWorkers > 0 || visibleCount > 0) {
                clearInterval(currentCountdownInterval);
                clearTimeout(currentRefreshTimeout);
                currentCountdownInterval = null;
                currentRefreshTimeout = null;
                State.isRefreshScheduled = false;
                Utils.logger("warn", "\u26A0\uFE0F \u5237\u65B0\u6761\u4EF6\u5DF2\u53D8\u5316\uFF0C\u81EA\u52A8\u5237\u65B0\u5DF2\u53D6\u6D88\u3002");
                return;
              }
            }
          }).catch(() => {
          });
        }
      }
    }, 1e3);
    currentRefreshTimeout = setTimeout(() => {
      const visibleCount = parseInt(document.getElementById("fab-status-visible")?.textContent || "0");
      if (State.appStatus === "RATE_LIMITED") {
        if (State.db.todo.length > 0 || State.activeWorkers > 0) {
          Utils.logger("warn", "\u26A0\uFE0F \u6700\u540E\u4E00\u523B\u68C0\u67E5\uFF1A\u5237\u65B0\u6761\u4EF6\u4E0D\u6EE1\u8DB3\uFF0C\u81EA\u52A8\u5237\u65B0\u5DF2\u53D6\u6D88\u3002");
          State.isRefreshScheduled = false;
          return;
        }
        if (visibleCount === 0) {
          Utils.logger("info", `\u{1F504} \u9875\u9762\u4E0A\u6CA1\u6709\u53EF\u89C1\u5546\u54C1\u4E14\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u5C06\u6267\u884C\u81EA\u52A8\u5237\u65B0\u3002`);
          window.location.href = window.location.href;
        } else {
          State.isRefreshScheduled = false;
          return;
        }
      } else {
        if (State.db.todo.length > 0 || State.activeWorkers > 0 || visibleCount > 0) {
          Utils.logger("warn", "\u26A0\uFE0F \u6700\u540E\u4E00\u523B\u68C0\u67E5\uFF1A\u5237\u65B0\u6761\u4EF6\u4E0D\u6EE1\u8DB3\uFF0C\u81EA\u52A8\u5237\u65B0\u5DF2\u53D6\u6D88\u3002");
          State.isRefreshScheduled = false;
        } else {
          window.location.href = window.location.href;
        }
      }
    }, delay);
  }
  __name(countdownRefresh3, "countdownRefresh");
  async function checkRateLimitStatus() {
    try {
      const { hidden: hiddenCards, visible: actualVisibleCards } = TaskRunner2.getCardCounts();
      const visibleCountElement = document.getElementById("fab-status-visible");
      if (visibleCountElement) {
        visibleCountElement.textContent = actualVisibleCards.toString();
      }
      if (State.appStatus === "RATE_LIMITED" && actualVisibleCards === 0) {
        return false;
      }
      if (actualVisibleCards === 0 && hiddenCards > 25) {
        return false;
      }
      if (window.performance && window.performance.getEntriesByType) {
        const recentRequests = window.performance.getEntriesByType("resource").filter((r) => r.name.includes("/i/listings/search") || r.name.includes("/i/users/me/listings-states")).filter((r) => Date.now() - r.startTime < 1e4);
        if (recentRequests.length > 0) {
          const has429 = recentRequests.some((r) => r.responseStatus === 429);
          if (has429) return false;
          const hasSuccess = recentRequests.some((r) => r.responseStatus >= 200 && r.responseStatus < 300);
          if (hasSuccess) return true;
        }
        return State.appStatus === "NORMAL";
      }
      return State.appStatus === "NORMAL";
    } catch (error) {
      Utils.logger("error", `\u68C0\u67E5\u9650\u901F\u72B6\u6001\u51FA\u9519: ${error.message}`);
      return false;
    }
  }
  __name(checkRateLimitStatus, "checkRateLimitStatus");
  setUIReference(UI5);
  setUIReference2(UI5);
  setUIReference3(UI5);
  setDependencies2({
    countdownRefresh: countdownRefresh3,
    registerWorkerDoneListener: registerWorkerDoneListener2
  });
  setTaskRunnerReference(TaskRunner2);
  setDependencies({
    UI: UI5,
    TaskRunner: TaskRunner2,
    countdownRefresh: countdownRefresh3
  });
  var _autoClaimVisibleTimer = null;
  function scheduleAutoClaimVisible(delayMs = 500) {
    if (!State.autoClaimVisible || State.domFallbackMode || State.isWorkerTab) return;
    if (State.manualVerificationPending || State.appStatus === "RATE_LIMITED") return;
    clearTimeout(_autoClaimVisibleTimer);
    _autoClaimVisibleTimer = setTimeout(() => {
      _autoClaimVisibleTimer = null;
      if (!State.autoClaimVisible || State.domFallbackMode || State.isWorkerTab) return;
      TaskRunner2.claimVisibleDomCards().catch((e) => {
        Utils.logger("debug", `[\u6D4F\u89C8\u81EA\u52A8\u9886] \u626B\u63CF\u5931\u8D25: ${e.message}`);
      });
    }, delayMs);
  }
  __name(scheduleAutoClaimVisible, "scheduleAutoClaimVisible");
  var _ownedStatusUpdateTimer = null;
  function triggerOwnedStatusUpdate() {
    if (State.isWorkerTab) return;
    clearTimeout(_ownedStatusUpdateTimer);
    _ownedStatusUpdateTimer = setTimeout(() => {
      if (State.hideSaved) {
        try {
          TaskRunner2.scheduleHideOrShow();
        } catch (e) {
          Utils.logger("debug", `[ownedStatus] scheduleHideOrShow\u5931\u8D25: ${e.message}`);
        }
      }
      try {
        TaskRunner2.checkVisibleCardsStatus().then(() => {
          scheduleAutoClaimVisible(300);
        }).catch(() => {
        });
      } catch (e) {
        Utils.logger("debug", `[ownedStatus] \u72B6\u6001\u68C0\u67E5\u5931\u8D25: ${e.message}`);
      }
    }, 50);
  }
  __name(triggerOwnedStatusUpdate, "triggerOwnedStatusUpdate");
  function parseListingsStatesUrl(urlString) {
    try {
      const urlObj = new URL(urlString, window.location.origin);
      const uids = [];
      let paramName = "listing_ids";
      if (urlObj.searchParams.has("listing_ids")) {
        uids.push(...urlObj.searchParams.getAll("listing_ids"));
        paramName = "listing_ids";
      } else if (urlObj.searchParams.has("listing_uids")) {
        uids.push(...urlObj.searchParams.getAll("listing_uids"));
        paramName = "listing_uids";
      }
      return { uids, paramName, urlObj };
    } catch (e) {
      return { uids: [], paramName: "listing_ids", urlObj: null };
    }
  }
  __name(parseListingsStatesUrl, "parseListingsStatesUrl");
  function createOwnedStateResponses(uids) {
    return uids.map((uid) => ({
      uid,
      acquired: true,
      lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
  __name(createOwnedStateResponses, "createOwnedStateResponses");
  function defineMockXhrProperty(xhr, name, value) {
    try {
      Object.defineProperty(xhr, name, {
        get: /* @__PURE__ */ __name(() => value, "get"),
        configurable: true
      });
    } catch (e) {
    }
  }
  __name(defineMockXhrProperty, "defineMockXhrProperty");
  function dispatchMockXhrEvent(xhr, type) {
    try {
      xhr.dispatchEvent(new Event(type));
    } catch (e) {
    }
  }
  __name(dispatchMockXhrEvent, "dispatchMockXhrEvent");
  function respondWithMockListingsStates(xhr, uids) {
    const mockResponses = createOwnedStateResponses(uids);
    const responseText = JSON.stringify(mockResponses);
    DataCache.saveOwnedStatus(mockResponses);
    triggerOwnedStatusUpdate();
    defineMockXhrProperty(xhr, "readyState", 4);
    defineMockXhrProperty(xhr, "status", 200);
    defineMockXhrProperty(xhr, "statusText", "OK");
    defineMockXhrProperty(xhr, "responseURL", xhr._url || "");
    defineMockXhrProperty(xhr, "responseText", responseText);
    defineMockXhrProperty(xhr, "response", xhr.responseType === "json" ? mockResponses : responseText);
    setTimeout(() => {
      dispatchMockXhrEvent(xhr, "readystatechange");
      dispatchMockXhrEvent(xhr, "load");
      dispatchMockXhrEvent(xhr, "loadend");
    }, 0);
  }
  __name(respondWithMockListingsStates, "respondWithMockListingsStates");
  function parsePricesInfoUrl(urlString) {
    try {
      const urlObj = new URL(urlString, window.location.origin);
      return {
        offerIds: urlObj.searchParams.getAll("offer_ids"),
        urlObj
      };
    } catch (e) {
      return { offerIds: [], urlObj: null };
    }
  }
  __name(parsePricesInfoUrl, "parsePricesInfoUrl");
  function splitDoneOfferIds(offerIds) {
    const doneOfferIds = [];
    const activeOfferIds = [];
    offerIds.forEach((offerId) => {
      const listingUid = DataCache.getListingUidForOffer(offerId);
      if (listingUid && Database.isDone(`https://www.fab.com/listings/${listingUid}`)) {
        doneOfferIds.push(offerId);
      } else {
        activeOfferIds.push(offerId);
      }
    });
    return { doneOfferIds, activeOfferIds };
  }
  __name(splitDoneOfferIds, "splitDoneOfferIds");
  function createEmptyPricesResponse() {
    return { offers: [] };
  }
  __name(createEmptyPricesResponse, "createEmptyPricesResponse");
  function createPricesResponse(offerIds) {
    const { result: cachedOffers } = DataCache.getPrices(offerIds);
    return { offers: cachedOffers };
  }
  __name(createPricesResponse, "createPricesResponse");
  function respondWithMockPricesInfo(xhr, offerIds = []) {
    const responseData = offerIds.length > 0 ? createPricesResponse(offerIds) : createEmptyPricesResponse();
    const responseText = JSON.stringify(responseData);
    defineMockXhrProperty(xhr, "readyState", 4);
    defineMockXhrProperty(xhr, "status", 200);
    defineMockXhrProperty(xhr, "statusText", "OK");
    defineMockXhrProperty(xhr, "responseURL", xhr._url || "");
    defineMockXhrProperty(xhr, "responseText", responseText);
    defineMockXhrProperty(xhr, "response", xhr.responseType === "json" ? responseData : responseText);
    setTimeout(() => {
      dispatchMockXhrEvent(xhr, "readystatechange");
      dispatchMockXhrEvent(xhr, "load");
      dispatchMockXhrEvent(xhr, "loadend");
    }, 0);
  }
  __name(respondWithMockPricesInfo, "respondWithMockPricesInfo");
  function setupXHRInterceptor() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (url && typeof url === "string" && url.includes("/i/users/me/listings-states")) {
        const { uids, paramName, urlObj } = parseListingsStatesUrl(url);
        if (uids.length > 0) {
          const doneUids = [];
          const activeUids = [];
          uids.forEach((uid) => {
            const itemUrl = `https://www.fab.com/listings/${uid}`;
            if (Database.isDone(itemUrl)) {
              doneUids.push(uid);
            } else {
              activeUids.push(uid);
            }
          });
          if (doneUids.length > 0) {
            this._doneUids = doneUids;
            this._allUids = uids;
            this._paramName = paramName;
            if (activeUids.length > 0) {
              urlObj.searchParams.delete(paramName);
              activeUids.forEach((uid) => urlObj.searchParams.append(paramName, uid));
              url = urlObj.toString();
              Utils.logger("debug", `[XHR Intercept] \u8FC7\u6EE4\u5DF2\u5165\u5E93\u5546\u54C1: \u539F\u8BF7\u6C42 ${uids.length} \u4E2A, \u8FC7\u6EE4 ${doneUids.length} \u4E2A, \u5B9E\u9645\u8BF7\u6C42 ${activeUids.length} \u4E2A`);
            } else {
              this._allDoneLocalResponse = true;
              Utils.logger("debug", `[XHR Intercept] \u6240\u6709 ${uids.length} \u4E2A\u5546\u54C1\u5747\u5DF2\u672C\u5730\u5165\u5E93\uFF0C\u8F6C\u6362\u4E3A\u5355 ID \u5360\u4F4D\u8BF7\u6C42`);
            }
          }
        }
      } else if (url && typeof url === "string" && url.includes("/i/listings/prices-infos")) {
        const { offerIds, urlObj } = parsePricesInfoUrl(url);
        if (offerIds.length > 0) {
          const { doneOfferIds, activeOfferIds } = splitDoneOfferIds(offerIds);
          if (doneOfferIds.length > 0) {
            this._donePriceOfferIds = doneOfferIds;
            if (activeOfferIds.length > 0) {
              urlObj.searchParams.delete("offer_ids");
              activeOfferIds.forEach((offerId) => urlObj.searchParams.append("offer_ids", offerId));
              url = urlObj.toString();
              Utils.logger("debug", `[XHR Intercept] Filtered done listing price requests: original=${offerIds.length}, skipped=${doneOfferIds.length}, requested=${activeOfferIds.length}`);
            } else {
              this._allDonePricesLocalResponse = true;
              Utils.logger("debug", `[XHR Intercept] Skipped ${offerIds.length} price requests for local done listings`);
            }
          }
        }
      }
      this._url = url;
      return originalOpen.apply(this, [method, url, ...args]);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      if (xhr._allDoneLocalResponse && xhr._allUids && xhr._allUids.length > 0) {
        respondWithMockListingsStates(xhr, xhr._allUids);
        return;
      }
      if (xhr._allDonePricesLocalResponse && xhr._donePriceOfferIds && xhr._donePriceOfferIds.length > 0) {
        respondWithMockPricesInfo(xhr, xhr._donePriceOfferIds);
        return;
      }
      if (xhr._url && typeof xhr._url === "string") {
        if (xhr._url.includes("/i/listings/search") && typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
          try {
            if (!xhr._url.includes("cursor=")) {
              State.isEndOfSearchList = false;
              State.hasReachedBottomToastShown = false;
            }
            window.dispatchEvent(new CustomEvent("fab-helper-listings-request"));
          } catch (e) {
            Utils.logger("debug", `[XHR\u62E6\u622A] \u6D3E\u53D1\u641C\u7D22\u8BF7\u6C42\u4E8B\u4EF6\u5931\u8D25: ${e.message}`);
          }
        }
        xhr.addEventListener("readystatechange", function() {
          if (xhr.readyState === 4 && xhr.status === 200 && xhr._doneUids && xhr._doneUids.length > 0) {
            try {
              const originalText = xhr.responseText;
              const rawData = JSON.parse(originalText);
              const serverResults = Array.isArray(rawData) ? rawData : API.extractStateData(rawData, "XHRInterceptor") || [];
              const mockDoneResponses = createOwnedStateResponses(xhr._doneUids);
              const mergedResults = [...serverResults, ...mockDoneResponses];
              DataCache.saveOwnedStatus(mergedResults);
              triggerOwnedStatusUpdate();
              const mergedText = JSON.stringify(mergedResults);
              Object.defineProperty(xhr, "responseText", { get: /* @__PURE__ */ __name(() => mergedText, "get"), configurable: true });
              Object.defineProperty(xhr, "response", {
                get: /* @__PURE__ */ __name(() => {
                  if (xhr.responseType === "json") {
                    return mergedResults;
                  }
                  return mergedText;
                }, "get"),
                configurable: true
              });
            } catch (e) {
              Utils.logger("error", `XHR \u72B6\u6001\u62E6\u622A\u5408\u5E76\u5931\u8D25: ${e.message}`);
            }
          }
        });
        xhr.addEventListener("load", function() {
          if (xhr.readyState === 4 && xhr.status === 200 && !xhr._doneUids) {
            try {
              const responseData = JSON.parse(xhr.responseText);
              if (xhr._url.includes("/i/listings/search") && responseData.results && Array.isArray(responseData.results)) {
                DataCache.saveListings(responseData.results);
                if (responseData.cursors) {
                  State.isEndOfSearchList = responseData.cursors.next === null;
                } else if (typeof responseData.next !== "undefined") {
                  State.isEndOfSearchList = responseData.next === null;
                }
              } else if (xhr._url.includes("/i/users/me/listings-states")) {
                if (Array.isArray(responseData)) {
                  DataCache.saveOwnedStatus(responseData);
                  triggerOwnedStatusUpdate();
                } else {
                  const extractedData = API.extractStateData(responseData, "XHRInterceptor");
                  if (Array.isArray(extractedData) && extractedData.length > 0) {
                    DataCache.saveOwnedStatus(extractedData);
                    triggerOwnedStatusUpdate();
                  }
                }
              } else if (xhr._url.includes("/i/listings/prices-infos") && responseData.offers && Array.isArray(responseData.offers)) {
                DataCache.savePrices(responseData.offers);
              }
            } catch (e) {
              Utils.logger("debug", `[XHR\u62E6\u622A] \u5904\u7406\u54CD\u5E94\u6570\u636E\u5931\u8D25: ${e.message}`);
            }
          }
          if (xhr._url && xhr._url.includes("/i/listings/search")) {
            if (xhr.status === 429) {
              Utils.logger("warn", Utils.getText("detected_api_429_status", xhr._url));
              if (typeof window.enterRateLimitedState === "function") {
                window.enterRateLimitedState();
              }
            }
          }
        });
      }
      return originalSend.apply(this, args);
    };
  }
  __name(setupXHRInterceptor, "setupXHRInterceptor");
  function setupFetchInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      let url = args[0]?.toString() || "";
      if (url.includes("/i/users/me/listings-states")) {
        const { uids, paramName, urlObj } = parseListingsStatesUrl(url);
        if (uids.length > 0) {
          const doneUids = [];
          const activeUids = [];
          uids.forEach((uid) => {
            const itemUrl = `https://www.fab.com/listings/${uid}`;
            if (Database.isDone(itemUrl)) {
              doneUids.push(uid);
            } else {
              activeUids.push(uid);
            }
          });
          if (doneUids.length > 0) {
            const mockDoneResponses = createOwnedStateResponses(doneUids);
            if (activeUids.length === 0) {
              Utils.logger("info", `[Fetch Intercept] \u6240\u6709 ${uids.length} \u4E2A\u5546\u54C1\u5747\u5DF2\u672C\u5730\u5165\u5E93\uFF0C\u5B8C\u5168\u7ED5\u8FC7\u7F51\u7EDC\u8BF7\u6C42`);
              DataCache.saveOwnedStatus(mockDoneResponses);
              triggerOwnedStatusUpdate();
              return new Response(JSON.stringify(mockDoneResponses), {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "application/json" }
              });
            }
            urlObj.searchParams.delete(paramName);
            activeUids.forEach((uid) => urlObj.searchParams.append(paramName, uid));
            url = urlObj.toString();
            args[0] = url;
            Utils.logger("debug", `[Fetch Intercept] \u8FC7\u6EE4\u5DF2\u5165\u5E93\u5546\u54C1: \u539F\u8BF7\u6C42 ${uids.length} \u4E2A, \u8FC7\u6EE4 ${doneUids.length} \u4E2A, \u5B9E\u9645\u8BF7\u6C42 ${activeUids.length} \u4E2A`);
            if (window._apiWaitStatus) {
              window._apiWaitStatus.lastApiActivity = Date.now();
            }
            try {
              const response = await originalFetch.apply(this, args);
              if (response.ok) {
                const clonedResponse = response.clone();
                const rawData = await clonedResponse.json();
                const serverResults = Array.isArray(rawData) ? rawData : API.extractStateData(rawData, "FetchInterceptor") || [];
                const mergedResults = [...serverResults, ...mockDoneResponses];
                DataCache.saveOwnedStatus(mergedResults);
                triggerOwnedStatusUpdate();
                return new Response(JSON.stringify(mergedResults), {
                  status: response.status,
                  statusText: response.statusText,
                  headers: response.headers
                });
              }
              return response;
            } catch (e) {
              Utils.logger("error", `\u62E6\u622A fetch listings-states \u5931\u8D25\uFF0C\u4F7F\u7528\u539F\u59CB fetch \u56DE\u9000: ${e.message}`);
              return originalFetch.apply(this, args);
            }
          }
        }
      }
      if (url.includes("/i/listings/prices-infos")) {
        const { offerIds, urlObj } = parsePricesInfoUrl(url);
        if (offerIds.length > 0) {
          const { doneOfferIds, activeOfferIds } = splitDoneOfferIds(offerIds);
          if (doneOfferIds.length > 0) {
            if (activeOfferIds.length === 0) {
              Utils.logger("debug", `[Fetch Intercept] Skipped ${offerIds.length} price requests for local done listings`);
              return new Response(JSON.stringify(createPricesResponse(doneOfferIds)), {
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "application/json" }
              });
            }
            urlObj.searchParams.delete("offer_ids");
            activeOfferIds.forEach((offerId) => urlObj.searchParams.append("offer_ids", offerId));
            url = urlObj.toString();
            args[0] = url;
            Utils.logger("debug", `[Fetch Intercept] Filtered done listing price requests: original=${offerIds.length}, skipped=${doneOfferIds.length}, requested=${activeOfferIds.length}`);
          }
        }
      }
      if (url.includes("/i/listings/search") || url.includes("/i/users/me/listings-states") || url.includes("/i/listings/prices-infos")) {
        if (url.includes("/i/listings/search") && typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
          try {
            if (!url.includes("cursor=")) {
              State.isEndOfSearchList = false;
              State.hasReachedBottomToastShown = false;
            }
            window.dispatchEvent(new CustomEvent("fab-helper-listings-request"));
          } catch (e) {
            Utils.logger("debug", `[fetch\u62E6\u622A] \u6D3E\u53D1\u641C\u7D22\u8BF7\u6C42\u4E8B\u4EF6\u5931\u8D25: ${e.message}`);
          }
        }
        if (window._apiWaitStatus) {
          window._apiWaitStatus.lastApiActivity = Date.now();
        }
        try {
          const response = await originalFetch.apply(this, args);
          if (response.status === 429) {
            Utils.logger("warn", `[fetch\u62E6\u622A] \u68C0\u6D4B\u5230429\u54CD\u5E94: ${url}`);
            RateLimitManager.enterRateLimitedState("fetch\u63A5\u53E3429\u68C0\u6D4B");
          }
          if (response.ok) {
            const clonedResponse = response.clone();
            clonedResponse.json().then((data) => {
              if (url.includes("/i/listings/search") && data.results && Array.isArray(data.results)) {
                DataCache.saveListings(data.results);
                if (data.cursors) {
                  State.isEndOfSearchList = data.cursors.next === null;
                } else if (typeof data.next !== "undefined") {
                  State.isEndOfSearchList = data.next === null;
                }
              } else if (url.includes("/i/users/me/listings-states")) {
                if (Array.isArray(data)) {
                  DataCache.saveOwnedStatus(data);
                  triggerOwnedStatusUpdate();
                } else {
                  const extractedData = API.extractStateData(data, "FetchInterceptor");
                  if (Array.isArray(extractedData) && extractedData.length > 0) {
                    DataCache.saveOwnedStatus(extractedData);
                    triggerOwnedStatusUpdate();
                  }
                }
              } else if (url.includes("/i/listings/prices-infos") && data.offers && Array.isArray(data.offers)) {
                DataCache.savePrices(data.offers);
              }
            }).catch(() => {
            });
          }
          return response;
        } catch (e) {
          return originalFetch.apply(this, args);
        }
      }
      return originalFetch.apply(this, args);
    };
  }
  __name(setupFetchInterceptor, "setupFetchInterceptor");
  function setupRequestInterceptors() {
    try {
      setupXHRInterceptor();
      setupFetchInterceptor();
      State.domIntervals.push(setInterval(() => DataCache.cleanupExpired(), 6e4));
      Utils.logger("debug", "\u8BF7\u6C42\u62E6\u622A\u548C\u7F13\u5B58\u7CFB\u7EDF\u5DF2\u521D\u59CB\u5316");
    } catch (e) {
      Utils.logger("error", `\u521D\u59CB\u5316\u8BF7\u6C42\u62E6\u622A\u5668\u5931\u8D25: ${e.message}`);
    }
  }
  __name(setupRequestInterceptors, "setupRequestInterceptors");
  async function runDomDependentPart() {
    if (isCheckoutPage(window.location.pathname)) return;
    if (State.hasRunDomPart) return;
    if (State.domIntervals && State.domIntervals.length) {
      State.domIntervals.forEach((id) => {
        try {
          clearInterval(id);
        } catch (e) {
        }
      });
      State.domIntervals = [];
    }
    if (State.isWorkerTab) {
      State.hasRunDomPart = true;
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("workerId")) {
      Utils.logger("debug", `\u5DE5\u4F5C\u6807\u7B7E\u9875DOM\u90E8\u5206\u521D\u59CB\u5316\uFF0C\u8DF3\u8FC7UI\u521B\u5EFA`);
      State.hasRunDomPart = true;
      return;
    }
    const uiCreated = UI5.create();
    if (!uiCreated) {
      Utils.logger("info", Utils.getText("log_detail_page"));
      State.hasRunDomPart = true;
      return;
    }
    UI5.update();
    UI5.updateDebugTab();
    UI5.switchTab("dashboard");
    State.hasRunDomPart = true;
    window.enterRateLimitedState = function(source = Utils.getText("rate_limit_source_global_call")) {
      RateLimitManager.enterRateLimitedState(source);
    };
    window.recordNetworkRequest = function(source = "\u7F51\u7EDC\u8BF7\u6C42", hasResults = true) {
      if (hasResults) {
        RateLimitManager.recordSuccessfulRequest(source, hasResults);
      }
    };
    State.domIntervals.push(setInterval(() => {
      if (State.appStatus === "NORMAL") {
        let pageText = "";
        const uiContainer = document.getElementById(Config.UI_CONTAINER_ID);
        if (uiContainer) {
          const originalDisplay = uiContainer.style.display;
          uiContainer.style.display = "none";
          pageText = document.body.innerText || "";
          uiContainer.style.display = originalDisplay;
        } else {
          pageText = document.body.innerText || "";
        }
        if (isRateLimitedPage(document.title || "", pageText)) {
          Utils.logger("warn", Utils.getText("page_content_rate_limit_detected"));
          RateLimitManager.enterRateLimitedState(Utils.getText("rate_limit_source_page_content"));
        }
      }
    }, 5e3));
    const checkIsErrorPage = /* @__PURE__ */ __name((title, text) => {
      if (isRateLimitedPage(title, text)) {
        Utils.logger("warn", `[\u9875\u9762\u52A0\u8F7D] \u68C0\u6D4B\u5230429\u9519\u8BEF\u9875\u9762`);
        window.enterRateLimitedState("\u9875\u9762\u5185\u5BB9429\u68C0\u6D4B");
        return true;
      }
      return false;
    }, "checkIsErrorPage");
    checkIsErrorPage(document.title, document.body.innerText || "");
    if (State.appStatus === "RATE_LIMITED") {
      Utils.logger("debug", Utils.getText("log_auto_resume_page_loading"));
      const isRecovered = await RateLimitManager.checkRateLimitStatus();
      if (isRecovered) {
        Utils.logger("info", Utils.getText("log_recovery_probe_success"));
        if (State.appStatus === "RATE_LIMITED") {
          await RateLimitManager.exitRateLimitedState("\u9875\u9762\u52A0\u8F7D\u63A2\u6D4B\u6210\u529F");
        }
        if (State.db.todo.length > 0 && !State.isExecuting) {
          Utils.logger("info", Utils.getText("log_found_todo_auto_resume", State.db.todo.length));
          State.isExecuting = true;
          Database.saveExecutingState();
          TaskRunner2.executeBatch();
        }
      } else {
        Utils.logger("warn", Utils.getText("log_recovery_probe_failed"));
        if (State.activeWorkers === 0 && State.db.todo.length === 0) {
          const randomDelay = 5e3 + Math.random() * 1e4;
          countdownRefresh3(randomDelay, Utils.getText("countdown_refresh_source"));
        }
      }
    }
    const containerSelectors = ["main", "#main", ".AssetGrid-root", ".fabkit-responsive-grid-container"];
    let targetNode = null;
    for (const selector of containerSelectors) {
      targetNode = document.querySelector(selector);
      if (targetNode) break;
    }
    if (!targetNode) targetNode = document.body;
    const observer = new MutationObserver((mutationsList) => {
      const hasNewContent = mutationsList.some(
        (mutation) => [...mutation.addedNodes].some(
          (node) => node.nodeType === 1 && (node.matches(Config.SELECTORS.card) || node.querySelector(Config.SELECTORS.card))
        )
      );
      if (hasNewContent) {
        TaskRunner2.invalidateCardCountCache();
        clearTimeout(State.observerDebounceTimer);
        State.observerDebounceTimer = setTimeout(() => {
          if (State.debugMode) {
            Utils.logger("debug", `[Observer] ${Utils.getText("debug_new_content_loading")}`);
          }
          const shouldProcessNewCards = State.hideSaved || State.hideDiscountedPaid || State.hidePaid || State.autoClaimVisible && !State.domFallbackMode || State.domFallbackMode && (State.autoAddOnScroll || State.autoScroll) || State.isExecuting || State.db.todo.length > 0;
          if (!shouldProcessNewCards) return;
          TaskRunner2.checkVisibleCardsStatus().then(() => {
            if (State.hideSaved || State.hideDiscountedPaid || State.hidePaid) {
              TaskRunner2.scheduleHideOrShow();
            }
            if (State.autoClaimVisible && !State.domFallbackMode) {
              scheduleAutoClaimVisible(500);
            }
            if (State.domFallbackMode && (State.autoAddOnScroll || State.autoScroll)) {
              TaskRunner2.scanAndAddTasks(document.querySelectorAll(TaskRunner2.getVisibleCardSelector())).catch((error) => Utils.logger("error", `\u81EA\u52A8\u6DFB\u52A0\u4EFB\u52A1\u5931\u8D25: ${error.message}`));
            }
          }).catch(() => {
            if (State.hideSaved || State.hideDiscountedPaid || State.hidePaid) {
              TaskRunner2.scheduleHideOrShow();
            }
          });
        }, 300);
      }
    });
    observer.observe(targetNode, { childList: true, subtree: true });
    Utils.logger("debug", `\u2705 Core DOM observer is now active on <${targetNode.tagName.toLowerCase()}>.`);
    TaskRunner2.runHideOrShow();
    if (State.autoClaimVisible && !State.domFallbackMode) {
      if (!State.manualVerificationPending && State.appStatus === "NORMAL" && State.isAuthenticated) {
        setTimeout(() => {
          scheduleAutoClaimVisible(0);
        }, 1500);
      }
    } else if (State.domFallbackMode && (State.autoAddOnScroll || State.autoScroll)) {
      setTimeout(() => {
        Utils.logger("debug", "\u9875\u9762\u52A0\u8F7D\u5B8C\u6210\uFF0C\u6B63\u5728\u6267\u884C\u521D\u59CB\u5546\u54C1\u626B\u63CF...");
        TaskRunner2.scanAndAddTasks(document.querySelectorAll(TaskRunner2.getVisibleCardSelector())).catch((error) => Utils.logger("error", `\u521D\u59CB\u626B\u63CF\u4EFB\u52A1\u5931\u8D25: ${error.message}`));
      }, 3e3);
    }
    TaskRunner2.resumeAfterMemoryRecycle();
    State.domIntervals.push(setInterval(() => {
      if (!State.hideSaved && !State.hideDiscountedPaid && !State.hidePaid) return;
      const cards = document.querySelectorAll(TaskRunner2.getVisibleCardSelector());
      let unprocessedCount = 0;
      cards.forEach((card) => {
        if (card.getAttribute("data-fab-processed") === "true" && TaskRunner2.isCardHidden(card)) return;
        const isProcessed = card.getAttribute("data-fab-processed") === "true";
        if (!isProcessed) {
          unprocessedCount++;
        } else {
          const shouldBeHidden = TaskRunner2.shouldHideCard(card);
          const isHidden = TaskRunner2.isCardHidden(card);
          if (shouldBeHidden !== isHidden) {
            card.removeAttribute("data-fab-processed");
            unprocessedCount++;
          }
        }
      });
      if (unprocessedCount > 0) {
        if (State.debugMode) {
          Utils.logger("debug", Utils.getText("debug_unprocessed_cards", unprocessedCount));
        }
        TaskRunner2.scheduleHideOrShow();
      }
    }, 1e4));
    State.domIntervals.push(setInterval(() => {
      if (State.db.todo.length === 0) return;
      const initialTodoCount = State.db.todo.length;
      State.db.todo = State.db.todo.filter((task) => {
        const url = task.url.split("?")[0];
        return !Database.isDone(url);
      });
      if (State.db.todo.length < initialTodoCount) {
        Utils.logger("info", `[\u81EA\u52A8\u6E05\u7406] \u4ECE\u5F85\u529E\u5217\u8868\u4E2D\u79FB\u9664\u4E86 ${initialTodoCount - State.db.todo.length} \u4E2A\u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1\u3002`);
        UI5.update();
      }
    }, 1e4));
    State.domIntervals.push(setInterval(async () => {
      try {
        if (UI5) UI5.update();
        const { visible: actualVisibleCards } = TaskRunner2.getCardCounts();
        if (State.appStatus === "RATE_LIMITED" && actualVisibleCards === 0 && State.autoRefreshEmptyPage) {
          if (!State.isRefreshScheduled && !currentCountdownInterval && !currentRefreshTimeout) {
            Utils.logger("debug", Utils.getText("log_all_hidden_rate_limited"));
            const randomDelay = 3e3 + Math.random() * 2e3;
            countdownRefresh3(randomDelay, Utils.getText("rate_limit_no_visible_reason"));
          }
        } else if (State.appStatus === "RATE_LIMITED") {
          if (!State.isRefreshScheduled && !currentCountdownInterval && !currentRefreshTimeout && !State.isCheckingRateLimit) {
            RateLimitManager.checkRateLimitStatus().catch((err) => Utils.logger("error", `\u9650\u901F\u72B6\u6001\u5468\u671F\u68C0\u67E5\u5931\u8D25: ${err.message}`));
          }
        } else if (State.appStatus === "NORMAL" && actualVisibleCards === 0 && !State.isEndOfSearchList && State.domFallbackMode && (State.autoAddOnScroll || State.autoScroll) && !State.isAutoScrolling && !FastScanner.isRunning()) {
          const { hidden: actualHidden } = TaskRunner2.getCardCounts(true);
          if (actualHidden > 0) {
            Utils.logger("info", Utils.getText("auto_scroll_resume_hidden", actualHidden));
            TaskRunner2.attemptAutoScroll();
          } else if (State.autoRefreshEmptyPage && !State.isRefreshScheduled && !currentCountdownInterval && !currentRefreshTimeout) {
            Utils.logger("info", Utils.getText("auto_scroll_resume_empty"));
            const randomDelay = 3e3 + Math.random() * 2e3;
            countdownRefresh3(randomDelay, Utils.getText("rate_limit_no_visible_reason"));
          }
        }
        TaskRunner2.maybeRecycleMemory();
      } catch (error) {
        Utils.logger("error", `\u9875\u9762\u72B6\u6001\u68C0\u67E5\u51FA\u9519: ${error.message}`);
      }
    }, 1e4));
    State.domIntervals.push(setInterval(() => {
      if (State.db.todo.length === 0) return;
      TaskRunner2.ensureTasksAreExecuted();
    }, 5e3));
    State.domIntervals.push(setInterval(async () => {
      try {
        if (State.appStatus !== "NORMAL") return;
        if (window.performance && window.performance.getEntriesByType) {
          const navigationEntries = window.performance.getEntriesByType("navigation");
          if (navigationEntries && navigationEntries.length > 0) {
            const lastNavigation = navigationEntries[0];
            if (lastNavigation.responseStatus === 429) {
              Utils.logger("warn", `[HTTP\u72B6\u6001\u68C0\u6D4B] \u68C0\u6D4B\u5230\u5BFC\u822A\u8BF7\u6C42\u72B6\u6001\u7801\u4E3A429\uFF01`);
              if (typeof window.enterRateLimitedState === "function") {
                window.enterRateLimitedState();
              }
            }
          }
        }
      } catch (error) {
      }
    }, 1e4));
  }
  __name(runDomDependentPart, "runDomDependentPart");
  function ensureUILoaded() {
    if (isCheckoutPage(window.location.pathname)) return;
    if (!document.getElementById(Config.UI_CONTAINER_ID)) {
      Utils.logger("warn", "\u68C0\u6D4B\u5230UI\u672A\u52A0\u8F7D\uFF0C\u5C1D\u8BD5\u91CD\u65B0\u521D\u59CB\u5316...");
      setTimeout(() => {
        try {
          runDomDependentPart();
        } catch (error) {
          Utils.logger("error", `UI\u91CD\u65B0\u521D\u59CB\u5316\u5931\u8D25: ${error.message}`);
        }
      }, 1e3);
    }
  }
  __name(ensureUILoaded, "ensureUILoaded");
  async function main() {
    if (isCheckoutPage(window.location.pathname)) {
      return;
    }
    window.pageLoadTime = Date.now();
    TaskRunner2.onQueueCompleted = async () => {
      State.isExecuting = false;
      Database.saveExecutingState();
      await Database.saveTodo();
      if (!State.autoAddOnScroll && !State.autoScroll || State.isEndOfSearchList || State.fastApiScan) {
        Utils.logger("info", "\u6240\u6709\u4EFB\u52A1\u5DF2\u5B8C\u6210\u3002");
        if (UI5 && typeof UI5.showToast === "function") {
          UI5.showToast(Utils.getText("toast_all_tasks_completed"), true);
        }
      } else {
        Utils.logger("debug", "\u5F53\u524D\u6279\u6B21\u4EFB\u52A1\u5DF2\u5904\u7406\u5B8C\u6BD5\uFF0C\u7EE7\u7EED\u6EDA\u52A8\u52A0\u8F7D\u4E0B\u4E00\u6279\u5546\u54C1...");
      }
      if (State.appStatus === "RATE_LIMITED") {
        Utils.logger("info", "\u6240\u6709\u4EFB\u52A1\u5DF2\u5B8C\u6210\uFF0C\u4E14\u5904\u4E8E\u9650\u901F\u72B6\u6001\uFF0C\u5C06\u5237\u65B0\u9875\u9762\u5C1D\u8BD5\u6062\u590D...");
        const randomDelay = 3e3 + Math.random() * 5e3;
        countdownRefresh3(randomDelay, "\u4EFB\u52A1\u5B8C\u6210\u540E\u9650\u901F\u6062\u590D");
      }
      UI5.update();
    };
    Utils.logger("info", Utils.getText("log_script_starting"));
    Utils.detectLanguage();
    const signedIn = Utils.checkAuthentication(true);
    if (!signedIn) {
      Utils.logger("warn", "\u8D26\u53F7\u672A\u767B\u5F55\uFF0C\u90E8\u5206\u529F\u80FD\u53EF\u80FD\u53D7\u9650");
      State.isAuthenticated = false;
    } else {
      State.isAuthenticated = true;
    }
    if (Config.USE_API_CLAIM) {
      ApiClaim.configure({ endpoint: FAB_CLAIM_ENDPOINT, fetchImpl: gmPostImpl });
    }
    const urlParams = new URLSearchParams(window.location.search);
    const workerId = urlParams.get("workerId");
    if (workerId) {
      State.isWorkerTab = true;
      State.workerTaskId = workerId;
      if (!signedIn) {
        Utils.logger("error", Utils.getText("auth_worker_aborted"));
        return;
      }
      await InstanceManager.init();
      Utils.logger("info", `\u5DE5\u4F5C\u6807\u7B7E\u9875\u521D\u59CB\u5316\u5B8C\u6210\uFF0C\u5F00\u59CB\u5904\u7406\u4EFB\u52A1...`);
      await TaskRunner2.processDetailPage();
      return;
    }
    await InstanceManager.init();
    await Database.load();
    KeepAlive.setTick(async () => {
      if (State.isWorkerTab || !State.isExecuting && !FastScanner.isRunning()) {
        KeepAlive.stop();
        return;
      }
      InstanceManager.ping();
      KeepAlive.poke();
      await TaskRunner2.checkStalledWorkers();
      if (State.isExecuting && TaskRunner2.hasDispatchSlot() && State.db.todo.length > 0) {
        TaskRunner2.executeBatch();
      }
    });
    if (signedIn) {
      Utils.verifyServerSession().then((ok) => {
        if (!ok) {
          Utils.logger("warn", Utils.getText("auth_session_invalid"));
          State.isAuthenticated = false;
        }
      });
    }
    const storedExecutingState = await GM_getValue(Config.DB_KEYS.IS_EXECUTING, false);
    if (State.isExecuting !== storedExecutingState) {
      Utils.logger("info", Utils.getText("log_execution_state_inconsistent", storedExecutingState ? "\u6267\u884C\u4E2D" : "\u5DF2\u505C\u6B62"));
      State.isExecuting = storedExecutingState;
    }
    await RateLimitManager.initStatus();
    if (!State.nativeFetch && typeof window !== "undefined" && typeof window.fetch === "function") {
      State.nativeFetch = window.fetch.bind(window);
    }
    setupRequestInterceptors();
    await PagePatcher.init();
    const tempTasks = await GM_getValue("temp_todo_tasks", null);
    if (tempTasks && tempTasks.length > 0) {
      Utils.logger("info", `\u4ECE429\u6062\u590D\uFF1A\u627E\u5230 ${tempTasks.length} \u4E2A\u4E34\u65F6\u4FDD\u5B58\u7684\u5F85\u529E\u4EFB\u52A1\uFF0C\u6B63\u5728\u6062\u590D...`);
      State.db.todo = tempTasks;
      await GM_deleteValue("temp_todo_tasks");
    }
    State.valueChangeListeners.push(GM_addValueChangeListener(Config.DB_KEYS.IS_EXECUTING, (key, oldValue, newValue) => {
      if (!State.isWorkerTab && State.isExecuting !== newValue) {
        Utils.logger("info", Utils.getText("execution_status_changed", newValue ? Utils.getText("status_executing") : Utils.getText("status_stopped")));
        State.isExecuting = newValue;
        UI5.update();
      }
    }));
    window._fabHelperLauncherActive = window._fabHelperLauncherActive || false;
    if (!window._fabHelperLauncherActive) {
      window._fabHelperLauncherActive = true;
      const launcherInterval = setInterval(() => {
        if (document.readyState === "interactive" || document.readyState === "complete") {
          if (!State.hasRunDomPart) {
            Utils.logger("info", "[Launcher] DOM is ready. Running main script logic...");
            (async () => {
              try {
                await runDomDependentPart();
              } catch (e) {
                Utils.logger("error", `[Launcher] Error in runDomDependentPart: ${e.message}`);
                console.error("[Fab Helper] runDomDependentPart error:", e);
                State.hasRunDomPart = true;
              }
            })();
          }
          if (State.hasRunDomPart) {
            clearInterval(launcherInterval);
            window._fabHelperLauncherActive = false;
            Utils.logger("debug", "[Launcher] Main logic has been launched or skipped. Launcher is now idle.");
          }
        }
      }, 500);
    }
    let lastNetworkActivityTime = Date.now();
    window.recordNetworkActivity = function() {
      lastNetworkActivityTime = Date.now();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          lastNetworkActivityTime = Date.now();
          Utils.logger("debug", "[Visibility] \u9875\u9762\u91CD\u65B0\u53EF\u89C1\uFF0C\u91CD\u7F6E\u65E0\u7F51\u7EDC\u6D3B\u52A8\u8BA1\u65F6\u3002");
        }
      });
    }
    State.domIntervals.push(setInterval(() => {
      if (State.domFallbackMode && State.appStatus === "NORMAL" && State.isExecuting && !FastScanner.isRunning() && (State.db.todo.length > 0 || State.activeWorkers > 0)) {
        const inactiveTime = Date.now() - lastNetworkActivityTime;
        if (inactiveTime > 3e4) {
          Utils.logger("warn", `\u26A0\uFE0F \u68C0\u6D4B\u5230\u5728\u4EFB\u52A1\u6267\u884C\u72B6\u6001\u4E0B\u5DF2\u6301\u7EED ${Math.floor(inactiveTime / 1e3)} \u79D2\u65E0\u7F51\u7EDC\u6D3B\u52A8\uFF0C\u5373\u5C06\u5F3A\u5236\u5237\u65B0\u9875\u9762\u4EE5\u6062\u590D\u4EFB\u52A1...`);
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    }, 5e3));
    Utils.logger("info", Utils.getText("log_init"));
  }
  __name(main, "main");
  function registerWorkerDoneListener2(workerId) {
    if (!workerId) return;
    if (State.registeredWorkerDoneKeys.has(workerId)) return;
    const key = Config.DB_KEYS.WORKER_DONE_PREFIX + workerId;
    State.registeredWorkerDoneKeys.add(workerId);
    const listenerId = GM_addValueChangeListener(key, async (k, oldValue, newValue) => {
      if (!newValue) return;
      try {
        await GM_deleteValue(key);
        State.registeredWorkerDoneKeys.delete(workerId);
        const { workerId: wid, success, rateLimited, retryAfterMs, task, logs, instanceId, executionTime } = newValue;
        if (instanceId !== Config.INSTANCE_ID) {
          Utils.logger("info", `\u6536\u5230\u6765\u81EA\u5176\u4ED6\u5B9E\u4F8B [${instanceId}] \u7684\u5DE5\u4F5C\u62A5\u544A\uFF0C\u5F53\u524D\u5B9E\u4F8B [${Config.INSTANCE_ID}] \u5C06\u5FFD\u7565\u3002`);
          return;
        }
        if (!wid || !task) {
          Utils.logger("error", "\u6536\u5230\u65E0\u6548\u7684\u5DE5\u4F5C\u62A5\u544A\u3002\u7F3A\u5C11workerId\u6216task\u3002");
          return;
        }
        if (State.runningWorkers[wid]) {
          delete State.runningWorkers[wid];
          State.activeWorkers--;
        }
        if (logs && logs.length) {
          logs.forEach((log) => {
            Utils.logger("debug", log);
          });
        }
        const isZh = State.lang === "zh";
        const timeSuffix = executionTime ? ` (${Utils.getText("task_execution_time", (executionTime / 1e3).toFixed(2))})` : "";
        if (success) {
          const successMsg = isZh ? `\u2705 \u4EFB\u52A1\u5B8C\u6210: ${task.name}` : `\u2705 Task completed: ${task.name}`;
          Utils.logger("info", successMsg + timeSuffix);
          await Database.markAsDone(task);
          State.sessionCompleted.add(Database.normalizeListingUrl(task.url));
          State.executionCompletedTasks++;
          TaskRunner2.syncClaimedCardToDom(task.uid || task.url);
        } else {
          if (rateLimited) {
            const retryHint = Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? `\uFF0C\u670D\u52A1\u7AEF\u5EFA\u8BAE\u7B49\u5F85 ${Math.ceil(retryAfterMs / 1e3)} \u79D2` : "";
            Utils.logger("warn", `[API\u5165\u5E93] \u6536\u5230 429${retryHint}\uFF1B\u6682\u505C\u65B0 worker \u6D3E\u53D1\u5E76\u8FDB\u5165\u6062\u590D\u68C0\u67E5\u3002`);
            await RateLimitManager.enterRateLimitedState("ApiClaim 429");
          }
          const isManualRequired = Boolean(newValue.manualRequired) || logs && logs.some((l) => l.includes(Utils.getText("worker_captcha")) || l.includes("\u4EBA\u673A\u9A8C\u8BC1") || l.includes("CAPTCHA"));
          if (isManualRequired) {
            State.manualVerificationPending = true;
            Utils.logger("warn", "\u{1F6A8} \u68C0\u6D4B\u5230\u5B89\u5168\u4EBA\u673A\u9A8C\u8BC1\uFF01\u5DF2\u81EA\u52A8\u6682\u505C\u4EFB\u52A1\u6267\u884C\u5E76\u4FDD\u7559\u9A8C\u8BC1\u6807\u7B7E\u9875\uFF0C\u8BF7\u5728\u5DF2\u6253\u5F00\u7684\u6807\u7B7E\u9875\u4E2D\u5B8C\u6210\u9A8C\u8BC1\u540E\u518D\u6B21\u70B9\u51FB\u300C\u4E00\u952E\u5F00\u5237\u300D\u3002");
            if (State.isExecuting) {
              State.isExecuting = false;
              Database.saveExecutingState();
            }
          }
          const errorLog = logs && logs.length ? logs.find((log) => log.includes(Utils.getText("worker_captcha"))) || logs.find((log) => log.includes("\u670D\u52A1\u7AEF") || log.includes("500") || log.includes("Error") || log.includes("Timeout") || log.includes("failed") || log.includes("Critical")) || logs[logs.length - 1] : isZh ? "\u5DE5\u4F5C\u6807\u7B7E\u9875\u62A5\u544A\u5931\u8D25" : "Worker tab reported failure";
          const cleanError = errorLog ? errorLog.replace(/^\[[a-f0-9-]+\]\s*/i, "") : isZh ? "\u672A\u77E5\u539F\u56E0" : "Unknown reason";
          const failMsg = isZh ? `\u274C \u4EFB\u52A1\u5931\u8D25: ${task.name} (${cleanError})` : `\u274C Task failed: ${task.name} (${cleanError})`;
          Utils.logger("warn", failMsg + timeSuffix);
          if (isManualRequired) {
            if (!Database.isTodo(task.url)) {
              State.db.todo.unshift(task);
              await Database.saveTodo();
            }
          } else {
            const _failRes = await Database.markAsFailed(task, {
              reason: cleanError,
              logs: logs || [],
              details: {
                executionTime: executionTime ? `${(executionTime / 1e3).toFixed(2)}s` : "\u672A\u77E5",
                workerId: wid,
                instanceId
              }
            });
            if (!_failRes || !_failRes.retried) State.executionFailedTasks++;
          }
        }
        UI5.update();
        if (State.isExecuting && TaskRunner2.hasDispatchSlot() && State.db.todo.length > 0) {
          setTimeout(() => TaskRunner2.executeBatch(), 200);
        }
        if (State.isExecuting && State.db.todo.length === 0 && State.activeWorkers === 0) {
          if (FastScanner.isRunning()) {
          } else if (!State.domFallbackMode) {
            await TaskRunner2.stopExecutionAndSettle();
          } else if (State.autoScroll) {
            TaskRunner2.attemptAutoScroll();
          } else {
            await TaskRunner2.stopExecutionAndSettle();
          }
        }
        TaskRunner2.runHideOrShow();
      } catch (error) {
        Utils.logger("error", `\u5904\u7406\u5DE5\u4F5C\u62A5\u544A\u65F6\u51FA\u9519: ${error.message}`);
      }
    });
    State.valueChangeListeners.push(listenerId);
  }
  __name(registerWorkerDoneListener2, "registerWorkerDoneListener");
  window.addEventListener("beforeunload", () => {
    Database.flushSaveDone();
    if (FastScanner.isRunning()) {
      FastScanner.stop();
    }
    if (State.domIntervals && State.domIntervals.length) {
      State.domIntervals.forEach((id) => {
        try {
          clearInterval(id);
        } catch (e) {
        }
      });
      State.domIntervals = [];
    }
    if (State.valueChangeListeners && State.valueChangeListeners.length) {
      State.valueChangeListeners.forEach((id) => {
        try {
          if (typeof GM_removeValueChangeListener === "function") GM_removeValueChangeListener(id);
        } catch (e) {
        }
      });
      State.valueChangeListeners = [];
    }
    InstanceManager.cleanup();
    Utils.cleanup();
  });
  window.addEventListener("load", () => {
    setTimeout(ensureUILoaded, 2e3);
  });
  async function handleWakeRecovery() {
    if (State.isWorkerTab) return;
    if (!State.domFallbackMode && State.activeWorkers === 0 && State.db.todo.length === 0) return;
    if (!State.isExecuting && State.db.todo.length === 0) return;
    Utils.logger("info", Utils.getText("log_wake_recovery"));
    await RateLimitManager.checkInactivity(false);
    const cleaned = await TaskRunner2.checkStalledWorkers();
    if (cleaned > 0) {
      Utils.logger("warn", Utils.getText("log_wake_cleanup_stale", cleaned));
    }
    if (State.db.todo.length > 0) {
      if (!State.isExecuting) {
        Utils.logger("info", Utils.getText("log_wake_restarting", State.db.todo.length));
        TaskRunner2.startExecution();
      } else if (TaskRunner2.hasDispatchSlot()) {
        Utils.logger("info", Utils.getText("log_wake_restarting", State.db.todo.length));
        TaskRunner2.executeBatch();
      }
    }
  }
  __name(handleWakeRecovery, "handleWakeRecovery");
  var wakeRecoveryTimer = null;
  var triggerWakeRecovery = /* @__PURE__ */ __name(() => {
    clearTimeout(wakeRecoveryTimer);
    wakeRecoveryTimer = setTimeout(handleWakeRecovery, 1e3);
  }, "triggerWakeRecovery");
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      setTimeout(ensureUILoaded, 500);
      triggerWakeRecovery();
    }
  });
  window.addEventListener("focus", () => {
    triggerWakeRecovery();
  });
  if (!globalThis.__FAB_HELPER_SKIP_AUTO_MAIN__ && typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", main);
    } else {
      main();
    }
  }
})();
