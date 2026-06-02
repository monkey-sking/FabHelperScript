/**
 * Fab Helper - English translations
 */
export const en = {
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
    log_refresh_error: 'Error during state synchronization:',
    log_unsettled_cards: '{0} cards are still loading. Will check again shortly.',

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

    // 日志标签
    log_tag_auto_add: 'Auto Add',

    // 自动添加相关消息
    auto_add_api_timeout: 'API wait timeout, waited {0}ms, will continue processing cards.',
    auto_add_api_error: 'Error while waiting for API: {0}',
    auto_add_new_tasks: 'Added {0} new tasks to queue.',
    auto_scroll_attempt: '[Auto Scroll] Queue empty, attempting to scroll down to load more... (Attempt {0}/{1})',
    auto_scroll_success: '[Auto Scroll] Successfully loaded and identified {0} new tasks, continuing...',
    auto_scroll_reached_bottom: '[Auto Scroll] Reached page bottom, stopping scroll.',
    auto_scroll_no_new_items: '[Auto Scroll] No new eligible items found after {0} consecutive scrolls, stopping auto scroll.',
    auto_scroll_waiting: '[Auto Scroll] No new eligible items found, waiting for next scroll attempt...',

    // HTTP状态检测
    http_status_check_performance_api: 'Using Performance API check, no longer sending HEAD requests',

    // 页面状态检测
    page_status_hidden_no_visible: '👁️ Detected {0} hidden items on page, but no visible items',
    page_status_suggest_refresh: '🔄 Detected {0} hidden items on page, but no visible items, suggest refreshing page',

    // 限速状态相关
    rate_limit_already_active: 'Already in rate limit state, source: {0}, ignoring new rate limit trigger: {1}',
    xhr_detected_429: '[XHR] Detected 429 status code: {0}',

    // 状态历史消息
    history_cleared_new_session: 'History cleared, new session started',
    status_history_cleared: 'Status history cleared.',
    duplicate_normal_status_detected: 'Detected duplicate normal status record, source: {0}',
    execution_status_changed: 'Detected execution status change: {0}',
    status_executing: 'Executing',
    status_stopped: 'Stopped',

    // 状态历史UI文本
    status_duration_label: 'Duration: ',
    status_requests_label: 'Requests: ',
    status_ended_at_label: 'Ended at: ',
    status_started_at_label: 'Started at: ',
    status_ongoing_label: 'Ongoing: ',
    status_unknown_time: 'Unknown time',
    status_unknown_duration: 'Unknown',

    // 启动时状态检测
    startup_rate_limited: 'Script started in rate limited state. Rate limit has lasted at least {0}s, source: {1}',
    status_unknown_source: 'Unknown',

    // 请求成功来源
    request_source_search_response: 'Search Response Success',
    request_source_xhr_search: 'XHR Search Success',
    request_source_xhr_item: 'XHR Item Request',
    consecutive_success_exit: 'Consecutive {0} successful requests ({1})',
    search_response_parse_failed: 'Search response parsing failed: {0}',

    // 缓存清理和Fab DOM相关
    cache_cleanup_complete: '[Cache] Cleanup complete, current cache size: items={0}, owned status={1}, prices={2}',
    fab_dom_no_new_owned: '[Fab DOM Refresh] API query completed, no new owned items found.',

    // 状态报告UI标签
    status_time_label: 'Time',
    status_info_label: 'Info',

    // 隐性限速检测和API监控
    implicit_rate_limit_detection: '[Implicit Rate Limit Detection]',
    scroll_api_monitoring: '[Scroll API Monitoring]',
    task_execution_time: 'Task execution time: {0} seconds',
    detected_rate_limit_error: 'Detected rate limit error info: {0}',
    detected_possible_rate_limit_empty: 'Detected possible rate limit situation (empty result): {0}',
    detected_possible_rate_limit_scroll: 'Detected possible rate limit situation: no card count increase after {0} consecutive scrolls.',
    detected_api_429_status: 'Detected API request status code 429: {0}',
    detected_api_rate_limit_content: 'Detected API response content contains rate limit info: {0}',

    // 限速来源标识
    source_implicit_rate_limit: 'Implicit Rate Limit Detection',
    source_scroll_api_monitoring: 'Scroll API Monitoring',

    // 设置项
    setting_auto_refresh: 'Auto refresh when no items visible',
    setting_auto_add_scroll: 'Auto add tasks on infinite scroll',
    setting_remember_position: 'Remember waterfall browsing position',
    setting_auto_resume_429: 'Auto resume after 429 errors',
    setting_hide_discounted: 'Hide discounted paid items',
    setting_hide_paid: 'Hide all paid items',
    setting_block_large_resources: 'Disable images and media',
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
    worker_closed: 'Worker tab closed before completion',
    worker_captcha: 'CAPTCHA / human verification detected (manual action needed)',
    log_keepalive_on: 'Background keep-alive started (Worker heartbeat + freeze guard)',
    log_keepalive_failed: 'Failed to start keep-alive: {0}',
    log_auto_retry: '↻ Auto-retry ({0}/{1}): {2}',
    keepalive_label: 'KeepAlive',
    keepalive_dead: '⚠️off (CSP?)',

    // 脚本启动和初始化
    log_script_starting: 'Script starting...',
    log_network_filter_deprecated: 'NetworkFilter module deprecated, functionality handled by PagePatcher.',

    // 限速状态检查
    log_rate_limit_check_active: 'Rate limit check already in progress, skipping',
    log_rate_limit_check_start: 'Starting rate limit status check...',
    log_page_content_rate_limit: 'Page content contains rate limit info, confirming still rate limited',
    log_use_performance_api: 'Using Performance API to check recent requests, no longer sending active requests',
    log_detected_429_in_10s: 'Detected 429 status in recent 10s, judging as rate limited',
    log_detected_success_in_10s: 'Detected successful request in recent 10s, judging as normal',
    log_insufficient_info_status: 'Insufficient info to judge rate limit status, maintaining current state',
    log_rate_limit_check_failed: 'Rate limit status check failed: {0}',

    // 游标和位置
    log_cursor_initialized_with: '[Cursor] Initialized. Loaded saved cursor: {0}...',
    log_cursor_initialized_empty: '[Cursor] Initialized. No saved cursor found.',
    log_cursor_restore_failed: '[Cursor] Failed to restore cursor state:',
    log_cursor_interceptors_applied: '[Cursor] Network interceptors applied.',
    log_cursor_skip_known_position: '[Cursor] Skipping known position save: {0}',
    log_cursor_skip_backtrack: '[Cursor] Skipping backtrack position: {0} (current: {1}), sort: {2}',
    log_cursor_save_error: '[Cursor] Error saving cursor:',
    log_url_sort_changed: 'Detected URL sort parameter change from "{0}" to "{1}"',
    log_sort_changed_position_cleared: 'Cleared saved position due to sort method change',
    log_sort_check_error: 'Error checking URL sort parameter: {0}',
    log_position_cleared: 'Cleared saved browsing position.',
    clear_position_tooltip: 'Reset position and refresh',
    confirm_reset_position: 'Are you sure you want to clear the saved browsing position and refresh the page?',
    no_position_to_reset: 'No saved browsing position.',
    log_sort_ascending: 'Ascending',
    log_sort_descending: 'Descending',

    // XHR/Fetch 限速检测
    log_xhr_rate_limit_detect: '[XHR Rate Limit] Detected rate limit, response: {0}',
    log_list_end_normal: '[List End] Reached end of list, normal situation: {0}...',
    log_empty_search_with_filters: '[Empty Search] Empty result but has filters, may be normal: {0}...',
    log_empty_search_already_limited: '[Empty Search] Already rate limited, not triggering again: {0}...',
    log_empty_search_page_loading: '[Empty Search] Page still loading, may be initial request: {0}...',
    log_debounce_intercept: '[Debounce] 🚦 Intercepted scroll request. Applying {0}ms delay...',
    log_debounce_discard: '[Debounce] 🗑️ Discarded previous pending request.',
    log_debounce_sending: '[Debounce] ▶️ Sending latest scroll request: {0}',
    log_fetch_detected_429: '[Fetch] Detected 429 status code: {0}',
    log_fetch_rate_limit_detect: '[Fetch Rate Limit] Detected rate limit, response: {0}...',
    log_fetch_list_end: '[Fetch List End] Reached end, normal: {0}...',
    log_fetch_empty_with_filters: '[Fetch Empty] Empty with filters, may be normal: {0}...',
    log_fetch_empty_already_limited: '[Fetch Empty] Already limited, not triggering: {0}...',
    log_fetch_empty_page_loading: '[Fetch Empty] Page loading, may be initial: {0}...',
    log_fetch_implicit_rate_limit: '[Fetch Implicit] Possible rate limit (empty): {0}...',
    log_json_parse_error: 'JSON parse error: {0}',
    log_response_length: 'Response length: {0}, first 100 chars: {1}',
    log_handling_rate_limit_error: 'Error handling rate limit: {0}',

    // 执行控制
    log_execution_stopped_manually: 'Execution manually stopped by user.',
    log_todo_cleared_scan: 'To-do list cleared. Will scan and add only visible items.',
    log_scanning_loaded_items: 'Scanning loaded items...',
    log_executor_running_queued: 'Executor running, new tasks queued for processing.',
    log_todo_empty_scanning: 'To-do list empty, scanning current page...',
    log_request_no_results_not_counted: 'Request successful but no valid results, not counting. Source: {0}',
    log_not_rate_limited_ignore_exit: 'Not rate limited, ignoring exit request: {0}',
    log_found_todo_auto_resume: 'Found {0} to-do tasks, auto-resuming execution...',
    log_dispatching_wait: 'Dispatching tasks, please wait...',
    log_rate_limited_continue_todo: 'In rate limited state, but will continue executing to-do tasks...',
    log_detected_todo_no_workers: 'Detected to-do tasks but no active workers, attempting retry...',

    // 数据库和同步
    log_db_sync_cleared_failed: '[Fab DB Sync] Cleared {0} manually completed items from failed list.',
    log_no_unowned_in_batch: 'No unowned items found in this batch.',
    log_no_truly_free_after_verify: 'Found unowned items, but none truly free after price verification.',
    log_429_scan_paused: 'Detected 429 error, requesting too frequently. Will pause scanning.',

    // 工作线程
    log_worker_tabs_cleared: 'Cleared all worker tab states.',
    log_worker_task_cleared_closing: 'Task data cleared, worker tab will close.',
    log_worker_instance_cooperate: 'Detected active instance [{0}], worker tab will cooperate.',
    log_other_instance_report_ignore: 'Received report from other instance [{0}], current [{1}] will ignore.',

    // 失败和重试
    log_failed_list_empty: 'Failed list empty, no action needed.',
    log_cleared_from_failed: 'Cleared {0} actually-owned items from the failed list.',
    log_failed_check_start: 'Checking status of failed items (verifying local records and server status)...',
    log_failed_check_local: '[Local Check] Found {0} items already marked done locally, removing from failed list...',
    log_failed_check_network: '[Server Check] Querying server for acquisition status of remaining {0} items...',
    log_failed_check_network_confirmed: '[Server Check] Confirmed {0} items actually acquired, updating database...',
    log_failed_check_network_none: '[Server Check] No other acquired items detected.',
    log_failed_check_complete: '✨ Check complete! Removed {0} successfully acquired items from the failed list.',
    log_failed_check_all_done: '🎉 All failed items are verified as acquired! Failed list is now empty.',
    confirm_open_failed_remaining: 'Status check complete. {0} items are still not in library.\nDo you want to open these {0} failed items in new tabs for manual processing?',
    alert_failed_all_done: 'All failed items are verified as acquired. No manual action needed!',

    // Wake/visibility recovery
    log_wake_recovery: '🔔 Tab re-activated (lock screen / tab switch recovery). Checking execution state...',
    log_wake_cleanup_stale: '🧹 Cleaned up {0} stale workers frozen by lock screen. Restarting execution.',
    log_wake_restarting: '▶️ Re-activating execution ({0} pending tasks).',

    // 调试模式
    log_debug_mode_toggled: 'Debug mode {0}. {1}',
    log_debug_mode_detail_info: 'Will display detailed log information',
    log_no_history_to_copy: 'No history to copy.',

    // 启动和恢复
    log_execution_state_inconsistent: 'Execution state inconsistent, restoring from storage: {0}',
    log_invalid_worker_report: 'Received invalid worker report. Missing workerId or task.',
    log_all_tasks_completed: 'All tasks completed.',
    log_all_tasks_completed_rate_limited: 'All tasks completed and rate limited, will refresh to recover...',
    log_recovery_probe_failed: 'Recovery probe failed. Still rate limited, will continue refresh...',

    // 实例管理
    log_not_active_instance: 'Current instance not active, not executing tasks.',
    log_no_active_instance_activating: 'No active instance detected, instance [{0}] activated.',
    log_inactive_instance_taking_over: 'Previous instance [{0}] inactive, taking over.',
    log_is_search_page_activated: 'This is search page, instance [{0}] activated.',

    // 可见性和刷新
    log_no_visible_items_todo_workers: 'Rate limited with {0} to-do and {1} workers, not auto-refreshing.',
    log_visible_items_detected_skipping: '⏹️ Detected {0} visible items, not refreshing to avoid interruption.',
    log_please_complete_tasks_first: 'Please complete or cancel these tasks before refreshing.',
    log_display_mode_switched: '👁️ Display mode switched, current page has {0} visible items',
    position_label: 'Location',
    log_entering_rate_limit_from: '🚨 Entering RATE LIMIT state from [{0}]! Normal period lasted {1}s with {2} requests.',
    log_entering_rate_limit_from_v2: '🚨 RATE LIMIT DETECTED from [{0}]! Normal operation lasted {1}s with {2} successful search requests.',
    rate_limit_recovery_success: '✅ Rate limit appears to be lifted from [{0}]. The 429 period lasted {1}s.',
    fab_dom_refresh_complete: '[Fab DOM Refresh] Complete. Updated {0} visible card states.',
    auto_refresh_disabled_rate_limit: '⚠️ In rate limit state, auto refresh is disabled. Please manually refresh the page if needed.',

    // 页面诊断
    log_diagnosis_complete: 'Page diagnosis complete, check console output',
    log_diagnosis_failed: 'Page diagnosis failed: {0}',

    // Auto resume
    log_auto_resume_page_loading: '[Auto-Resume] Page loaded in rate limited state. Running recovery probe...',
    log_recovery_probe_success: '✅ Recovery probe succeeded! Rate limit lifted, continuing normal operations.',
    log_tasks_still_running: 'Still have {0} tasks running, waiting for them to finish before refresh...',
    log_todo_tasks_waiting: '{0} to-do tasks waiting to execute, will try to continue execution...',
    countdown_refresh_source: 'Recovery probe failed',
    failed_list_empty: 'Failed list is empty, no action needed.',
    opening_failed_items: 'Opening {0} failed items...',

    // 账号验证
    auth_error: 'Session expired: CSRF token not found, please log in again',
    auth_error_alert: 'Session expired: Please log in again before using the script',
    auth_session_invalid: 'Login session is invalid. Please log in again before starting a run.',
    auth_worker_aborted: 'Worker tab detected no active login; task processing aborted.',
    auth_scan_blocked: 'Not logged in (or session expired). Scan skipped to avoid treating every paid item as free.'
};
