/**
 * Fab Helper - 中文翻译
 */
export const zh = {
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

    // 日志标签
    log_tag_auto_add: '自动添加',

    // 自动添加相关消息
    auto_add_api_timeout: 'API等待超时，已等待 {0}ms，将继续处理卡片。',
    auto_add_api_error: '等待API时出错: {0}',
    auto_add_new_tasks: '新增 {0} 个任务到队列。',

    // HTTP状态检测
    http_status_check_performance_api: '使用Performance API检查，不再发送HEAD请求',

    // 页面状态检测
    page_status_hidden_no_visible: '👁️ 检测到页面上有 {0} 个隐藏商品，但没有可见商品',
    page_status_suggest_refresh: '🔄 检测到页面上有 {0} 个隐藏商品，但没有可见商品，建议刷新页面',

    // 限速状态相关
    rate_limit_already_active: '已处于限速状态，来源: {0}，忽略新的限速触发: {1}',
    xhr_detected_429: '[XHR] 检测到429状态码: {0}',

    // 状态历史消息
    history_cleared_new_session: '历史记录已清空，新会话开始',
    status_history_cleared: '状态历史记录已清空。',
    duplicate_normal_status_detected: '检测到重复的正常状态记录，来源: {0}',
    execution_status_changed: '检测到执行状态变化：{0}',
    status_executing: '执行中',
    status_stopped: '已停止',

    // 状态历史UI文本
    status_duration_label: '持续时间: ',
    status_requests_label: '期间请求数: ',
    status_ended_at_label: '结束于: ',
    status_started_at_label: '开始于: ',
    status_ongoing_label: '已持续: ',
    status_unknown_time: '未知时间',
    status_unknown_duration: '未知',

    // 启动时状态检测
    startup_rate_limited: '脚本启动时处于限速状态。限速已持续至少 {0}s，来源: {1}',
    status_unknown_source: '未知',

    // 请求成功来源
    request_source_search_response: '搜索响应成功',
    request_source_xhr_search: 'XHR搜索成功',
    request_source_xhr_item: 'XHR商品请求',
    consecutive_success_exit: '连续{0}次成功请求 ({1})',
    search_response_parse_failed: '搜索响应解析失败: {0}',

    // 缓存清理和Fab DOM相关
    cache_cleanup_complete: '[Cache] 清理完成，当前缓存大小: 商品={0}, 拥有状态={1}, 价格={2}',
    fab_dom_no_new_owned: '[Fab DOM Refresh] API查询完成，没有发现新的已拥有项目。',

    // 状态报告UI标签
    status_time_label: '时间',
    status_info_label: '信息',

    // 隐性限速检测和API监控
    implicit_rate_limit_detection: '[隐性限速检测]',
    scroll_api_monitoring: '[滚动API监控]',
    task_execution_time: '任务执行时间: {0}秒',
    detected_rate_limit_error: '检测到限速错误信息: {0}',
    detected_possible_rate_limit_empty: '检测到可能的限速情况(空结果): {0}',
    detected_possible_rate_limit_scroll: '检测到可能的限速情况：连续{0}次滚动后卡片数量未增加。',
    detected_api_429_status: '检测到API请求状态码为429: {0}',
    detected_api_rate_limit_content: '检测到API响应内容包含限速信息: {0}',

    // 限速来源标识
    source_implicit_rate_limit: '隐性限速检测',
    source_scroll_api_monitoring: '滚动API监控',

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
    worker_closed: '工作标签页在完成前关闭',

    // 脚本启动和初始化
    log_script_starting: '脚本开始运行...',
    log_network_filter_deprecated: '网络过滤器(NetworkFilter)模块已弃用，功能由补丁程序(PagePatcher)处理。',

    // 限速状态检查
    log_rate_limit_check_active: '已有限速状态检查正在进行，跳过本次检查',
    log_rate_limit_check_start: '开始检查限速状态...',
    log_page_content_rate_limit: '页面内容包含限速信息，确认仍处于限速状态',
    log_use_performance_api: '使用Performance API检查最近的网络请求，不再主动发送API请求',
    log_detected_429_in_10s: '检测到最近10秒内有429状态码的请求，判断为限速状态',
    log_detected_success_in_10s: '检测到最近10秒内有成功的API请求，判断为正常状态',
    log_insufficient_info_status: '没有足够的信息判断限速状态，保持当前状态',
    log_rate_limit_check_failed: '限速状态检查失败: {0}',

    // 游标和位置
    log_cursor_initialized_with: '[Cursor] 初始化完成。加载已保存的cursor: {0}...',
    log_cursor_initialized_empty: '[Cursor] 初始化完成。未找到已保存的cursor。',
    log_cursor_restore_failed: '[Cursor] 恢复cursor状态失败:',
    log_cursor_interceptors_applied: '[Cursor] 网络拦截器已应用。',
    log_cursor_skip_known_position: '[Cursor] 跳过已知位置的保存: {0}',
    log_cursor_skip_backtrack: '[Cursor] 跳过回退位置: {0} (当前位置: {1}), 排序: {2}',
    log_cursor_save_error: '[Cursor] 保存cursor时出错:',
    log_url_sort_changed: '检测到URL排序参数变更，排序方式已从"{0}"更改为"{1}"',
    log_sort_changed_position_cleared: '由于排序方式变更，已清除保存的浏览位置',
    log_sort_check_error: '检查URL排序参数时出错: {0}',
    log_position_cleared: '已清除已保存的浏览位置。',
    clear_position_tooltip: '重置浏览位置并刷新',
    confirm_reset_position: '确定要清除已保存的浏览位置并刷新页面吗？',
    no_position_to_reset: '当前没有保存的浏览位置。',
    log_sort_ascending: '升序',
    log_sort_descending: '降序',

    // XHR/Fetch 限速检测
    log_xhr_rate_limit_detect: '[XHR限速检测] 检测到限速情况，原始响应: {0}',
    log_list_end_normal: '[列表末尾] 检测到已到达列表末尾，这是正常情况，不触发限速: {0}...',
    log_empty_search_with_filters: '[空搜索结果] 检测到搜索结果为空，但包含特殊过滤条件，这可能是正常情况: {0}...',
    log_empty_search_already_limited: '[空搜索结果] 已处于限速状态，不重复触发: {0}...',
    log_empty_search_page_loading: '[空搜索结果] 页面尚未完全加载，可能是初始请求，不触发限速: {0}...',
    log_debounce_intercept: '[Debounce] 🚦 拦截滚动请求。应用{0}ms延迟...',
    log_debounce_discard: '[Debounce] 🗑️ 丢弃之前的挂起请求。',
    log_debounce_sending: '[Debounce] ▶️ 发送最新滚动请求: {0}',
    log_fetch_detected_429: '[Fetch] 检测到429状态码: {0}',
    log_fetch_rate_limit_detect: '[Fetch限速检测] 检测到限速情况，原始响应: {0}...',
    log_fetch_list_end: '[Fetch列表末尾] 检测到已到达列表末尾，这是正常情况，不触发限速: {0}...',
    log_fetch_empty_with_filters: '[Fetch空搜索结果] 检测到搜索结果为空，但包含特殊过滤条件，这可能是正常情况: {0}...',
    log_fetch_empty_already_limited: '[Fetch空搜索结果] 已处于限速状态，不重复触发: {0}...',
    log_fetch_empty_page_loading: '[Fetch空搜索结果] 页面尚未完全加载，可能是初始请求，不触发限速: {0}...',
    log_fetch_implicit_rate_limit: '[Fetch隐性限速] 检测到可能的限速情况(空结果): {0}...',
    log_json_parse_error: 'JSON解析错误: {0}',
    log_response_length: '响应长度: {0}, 前100个字符: {1}',
    log_handling_rate_limit_error: '处理限速时出错: {0}',

    // 执行控制
    log_execution_stopped_manually: '执行已由用户手动停止。',
    log_todo_cleared_scan: '待办列表已清空。现在将扫描并仅添加当前可见的项目。',
    log_scanning_loaded_items: '正在扫描已加载完成的商品...',
    log_executor_running_queued: '执行器已在运行中，新任务已加入队列等待处理。',
    log_todo_empty_scanning: '待办清单为空，正在扫描当前页面...',
    log_request_no_results_not_counted: '请求成功但没有返回有效结果，不计入连续成功计数。来源: {0}',
    log_not_rate_limited_ignore_exit: '当前不是限速状态，忽略退出限速请求: {0}',
    log_found_todo_auto_resume: '发现 {0} 个待办任务，自动恢复执行...',
    log_dispatching_wait: '正在派发任务中，请稍候...',
    log_rate_limited_continue_todo: '当前处于限速状态，但仍将继续执行待办任务...',
    log_detected_todo_no_workers: '检测到有待办任务但没有活动工作线程，尝试重新执行...',

    // 数据库和同步
    log_db_sync_cleared_failed: '[Fab DB Sync] 从"失败"列表中清除了 {0} 个已手动完成的商品。',
    log_no_unowned_in_batch: '本批次中没有发现未拥有的商品。',
    log_no_truly_free_after_verify: '找到未拥有的商品，但价格验证后没有真正免费的商品。',
    log_429_scan_paused: '检测到429错误，可能是请求过于频繁。将暂停扫描。',

    // 工作线程
    log_worker_tabs_cleared: '已清理所有工作标签页的状态。',
    log_worker_task_cleared_closing: '任务数据已被清理，工作标签页将关闭。',
    log_worker_instance_cooperate: '检测到活跃的脚本实例 [{0}]，当前工作标签页将与之协作。',
    log_other_instance_report_ignore: '收到来自其他实例 [{0}] 的工作报告，当前实例 [{1}] 将忽略。',

    // 失败和重试
    log_failed_list_empty: '失败列表为空，无需操作。',

    // 调试模式
    log_debug_mode_toggled: '调试模式已{0}。{1}',
    log_debug_mode_detail_info: '将显示详细日志信息',
    log_no_history_to_copy: '没有历史记录可供复制。',

    // 启动和恢复
    log_execution_state_inconsistent: '执行状态不一致，从存储中恢复：{0}',
    log_invalid_worker_report: '收到无效的工作报告。缺少workerId或task。',
    log_all_tasks_completed: '所有任务已完成。',
    log_all_tasks_completed_rate_limited: '所有任务已完成，且处于限速状态，将刷新页面尝试恢复...',
    log_recovery_probe_failed: '恢复探测失败。仍处于限速状态，将继续随机刷新...',

    // 实例管理
    log_not_active_instance: '当前实例不是活跃实例，不执行任务。',
    log_no_active_instance_activating: '没有检测到活跃实例，当前实例 [{0}] 已激活。',
    log_inactive_instance_taking_over: '前一个实例 [{0}] 不活跃，当前实例接管。',
    log_is_search_page_activated: '当前是搜索页面，实例 [{0}] 已激活。',

    // 可见性和刷新
    log_no_visible_items_todo_workers: '虽然处于限速状态，但检测到有 {0} 个待办任务和 {1} 个活动工作线程，暂不自动刷新页面。',
    log_visible_items_detected_skipping: '⏹️ 检测到页面上有 {0} 个可见商品，不触发自动刷新以避免中断浏览。',
    log_please_complete_tasks_first: '请手动完成或取消这些任务后再刷新页面。',
    log_display_mode_switched: '👁️ 显示模式已切换，当前页面有 {0} 个可见商品',
    position_label: '位置',
    log_entering_rate_limit_from: '🚨 来自 [{0}] 的限速触发！正常运行期持续了 {1} 秒，期间有 {2} 次成功的搜索请求。',
    log_entering_rate_limit_from_v2: '🚨 从 [{0}] 检测到限速！正常运行持续了 {1} 秒，包含 {2} 次成功搜索请求。',
    rate_limit_recovery_success: '✅ 限速似乎已从 [{0}] 解除。429 状态持续了 {1} 秒。',
    fab_dom_refresh_complete: '[Fab DOM Refresh] 完成。更新了 {0} 个可见卡片的状态。',
    auto_refresh_disabled_rate_limit: '⚠️ 处于限速状态，自动刷新功能已关闭，请在需要时手动刷新页面。',

    // 页面诊断
    log_diagnosis_complete: '页面诊断完成，请查看控制台输出',
    log_diagnosis_failed: '页面诊断失败: {0}',

    // Auto resume
    log_auto_resume_page_loading: '[Auto-Resume] 页面在限速状态下加载。正在进行恢复探测...',
    log_recovery_probe_success: '✅ 恢复探测成功！限速已解除，继续正常操作。',
    log_tasks_still_running: '仍有 {0} 个任务在执行中，等待它们完成后再刷新...',
    log_todo_tasks_waiting: '有 {0} 个待办任务等待执行，将尝试继续执行...',
    countdown_refresh_source: '恢复探测失败',
    failed_list_empty: '失败列表为空，无需操作。',
    opening_failed_items: '正在打开 {0} 个失败项目...',

    // 账号验证
    auth_error: '账号失效：未找到 CSRF token，请重新登录',
    auth_error_alert: '账号失效：请重新登录后再使用脚本'
};
