# FAB Helper 国际化补丁建议

## 需要添加到 Config.TEXTS 的新键值

### 1. 基础日志消息

```javascript
// 在 Config.TEXTS.en 中添加:
{
    // 脚本启动和初始化
    'log_script_starting': 'Script starting...',
    'log_script_online': 'Assistant is online!',
    'log_network_filter_deprecated': 'NetworkFilter module deprecated, functionality handled by PagePatcher.',
    
    // 状态和检查
    'log_rate_limit_check_active': 'Rate limit check already in progress, skipping this check',
    'log_rate_limit_check_start': 'Starting rate limit status check...',
    'log_page_content_rate_limit': 'Page content contains rate limit info, confirming still in rate limited state',
    'log_use_performance_api': 'Using Performance API to check recent network requests, no longer actively sending API requests',
    'log_detected_429_in_10s': 'Detected 429 status code in recent 10 seconds, judging as rate limited',
    'log_detected_success_in_10s': 'Detected successful API request in recent 10 seconds, judging as normal',
    'log_insufficient_info_status': 'Insufficient information to judge rate limit status, maintaining current state',
    'log_rate_limit_check_failed': 'Rate limit status check failed: {0}',
    
    // 游标相关
    'log_cursor_initialized_with': '[Cursor] Initialized. Loaded saved cursor: {0}...',
    'log_cursor_initialized_empty': '[Cursor] Initialized. No saved cursor found.',
    'log_cursor_restore_failed': '[Cursor] Failed to restore cursor state:',
    'log_cursor_interceptors_applied': '[Cursor] Network interceptors applied.',
    'log_cursor_skip_known_position': '[Cursor] Skipping known position save: {0}',
    'log_cursor_skip_backtrack': '[Cursor] Skipping backtrack position: {0} (current: {1}), sort: {2}',
    'log_cursor_save_error': '[Cursor] Error while saving cursor:',
    'log_url_sort_changed': 'Detected URL sort parameter change, sort method changed from "{0}" to "{1}"',
    'log_sorted_changed_position_cleared': 'Due to sort method change, cleared saved browsing position',
    'log_sort_check_error': 'Error checking URL sort parameter: {0}',
    
    // 限速检测
    'log_xhr_rate_limit_detect': '[XHR Rate Limit Detection] Detected rate limit situation, original response: {0}',
    'log_list_end_normal': '[List End] Detected end of list, this is normal, not triggering rate limit: {0}...',
    'log_empty_search_with_filters': '[Empty Search Result] Search result empty but contains special filters, may be normal: {0}...',
    'log_empty_search_already_limited': '[Empty Search Result] Already in rate limited state, not triggering again: {0}...',
    'log_empty_search_page_loading': '[Empty Search Result] Page not fully loaded yet, might be initial request, not triggering rate limit: {0}...',
    'log_debounce_intercept': '[Debounce] 🚦 Intercepted scroll request. Applying {0}ms delay...',
    'log_debounce_discard': '[Debounce] 🗑️ Discarded previous pending request.',
    'log_debounce_sending': '[Debounce] ▶️ Sending latest scroll request: {0}',
    'log_fetch_detected_429': '[Fetch] Detected 429 status code: {0}',
    'log_fetch_rate_limit_detect': '[Fetch Rate Limit Detection] Detected rate limit situation, original response: {0}...',
    'log_fetch_list_end': '[Fetch List End] Detected end of list, this is normal, not triggering rate limit: {0}...',
    'log_fetch_empty_with_filters': '[Fetch Empty Search] Search result empty but contains special filters, may be normal: {0}...',
    'log_fetch_empty_already_limited': '[Fetch Empty Search] Already in rate limited state, not triggering again: {0}...',
    'log_fetch_empty_page_loading': '[Fetch Empty Search] Page not fully loaded yet, might be initial request, not triggering rate limit: {0}...',
    'log_fetch_implicit_rate_limit': '[Fetch Implicit Rate Limit] Detected possible rate limit situation (empty result): {0}...',
    'log_json_parse_error': 'JSON parse error: {0}',
    'log_response_length': 'Response length: {0}, first 100 chars: {1}',
    
    // 执行控制
    'log_execution_stopped_manually': 'Execution manually stopped by user.',
    'log_todo_cleared_scan': 'To-do list cleared. Will now scan and add only currently visible items.',
    'log_scanning_loaded_items': 'Scanning loaded items...',
    'log_executor_running_queued': 'Executor already running, new tasks added to queue for processing.',
    'log_todo_empty_scanning': 'To-do list empty, scanning current page...',
    'log_request_no_results_not_counted': 'Request successful but returned no valid results, not counting towards consecutive success. Source: {0}',
    'log_not_rate_limited_ignore_exit': 'Currently not in rate limited state, ignoring exit rate limit request: {0}',
    'log_found_todo_auto_resume': 'Found {0} to-do tasks, auto-resuming execution...',
    
    // 位置和排序
    'log_position_cleared': 'Cleared saved browsing position.',
    
    // 数据库同步
    'log_db_sync_cleared_failed': '[Fab DB Sync] Cleared {0} manually completed items from "failed" list.',
    'log_no_unowned_in_batch': 'No unowned items found in this batch.',
    'log_no_truly_free_after_verify': 'Found unowned items, but no truly free items after price verification.',
    'log_429_scan_paused': 'Detected 429 error, might be requesting too frequently. Will pause scanning.',
    
    // 执行器状态
    'log_dispatching_wait': 'Dispatching tasks, please wait...',
    'log_rate_limited_continue_todo': 'Currently in rate limited state, but will continue executing to-do tasks...',
    'log_worker_tabs_cleared': 'Cleared all worker tab states.',
    'log_worker_task_cleared_closing': 'Task data cleared, worker tab will close.',
    'log_detected_todo_no_workers': 'Detected to-do tasks but no active workers, attempting to retry...',
    
    // 失败列表
    'log_failed_list_empty': 'Failed list is empty, no action needed.',
    
    // 调试模式  
    'log_debug_mode_toggled': 'Debug mode {0}. {1}',
    'log_debug_mode_detail_info': 'Will display detailed log information',
    'log_no_history_to_copy': 'No history to copy.',
    'log_history_cleared': 'Status history cleared.',
    
    // 启动恢复
    'log_execution_state_inconsistent': 'Execution state inconsistent, restoring from storage: {0}',
    'log_invalid_worker_report': 'Received invalid worker report. Missing workerId or task.',
    'log_all_tasks_completed': 'All tasks completed.',
    'log_all_tasks_completed_rate_limited': 'All tasks completed and in rate limited state, will refresh page to attempt recovery...',
    'log_recovery_probe_failed': 'Recovery probe failed. Still in rate limited state, will continue random refresh...',
    
    // 其他实例
    'log_not_active_instance': 'Current instance is not active instance, not executing tasks.',
    'log_worker_instance_cooperate': 'Detected active script instance [{0}], current worker tab will cooperate with it.',
    'log_no_active_instance_activating': 'No active instance detected, current instance [{0}] activated.',
    'log_inactive_instance_taking_over': 'Previous instance [{0}] inactive, current instance taking over.',
    
    // 状态描述
    'state_executing': 'Executing',
    'state_stopped': 'Stopped',
    
    // 页面诊断
    'log_diagnosis_complete': 'Page diagnosis complete, please check console output',
    'log_diagnosis_failed': 'Page diagnosis failed: {0}',
    
    // 其他
    'log_sort_ascending': 'Ascending',
    'log_sort_descending': 'Descending',
    'log_no_visible_items_todo_workers': 'Though in rate limited state, detected {0} to-do tasks and {1} active workers, not auto refreshing.',
    'log_visible_items_detected_skipping': '⏹️ Detected {0} visible items on page, not triggering auto refresh to avoid interrupting browsing.',
    'log_please_complete_tasks_first': 'Please manually complete or cancel these tasks before refreshing page.',
    'log_entering_rate_limit_from': '🚨 RATE LIMIT DETECTED from [{0}]! Normal operation lasted {1}s with {2} successful search requests.',
    'log_copy_error': 'Copy failed:',
}
```

### 2. 中文对应翻译

```javascript
// 在 Config.TEXTS.zh 中添加:
{
    'log_script_starting': '脚本开始运行...',
    'log_script_online': '助手已上线！',
    'log_network_filter_deprecated': '网络过滤器(NetworkFilter)模块已弃用，功能由补丁程序(PagePatcher)处理。',
    
    'log_rate_limit_check_active': '已有限速状态检查正在进行，跳过本次检查',
    'log_rate_limit_check_start': '开始检查限速状态...',
    'log_page_content_rate_limit': '页面内容包含限速信息，确认仍处于限速状态',
    'log_use_performance_api': '使用Performance API检查最近的网络请求，不再主动发送API请求',
    'log_detected_429_in_10s': '检测到最近10秒内有429状态码的请求，判断为限速状态',
    'log_detected_success_in_10s': '检测到最近10秒内有成功的API请求，判断为正常状态',
    'log_insufficient_info_status': '没有足够的信息判断限速状态，保持当前状态',
    'log_rate_limit_check_failed': '限速状态检查失败: {0}',
    
    'log_cursor_initialized_with': '[Cursor] 初始化完成。加载已保存的cursor: {0}...',
    'log_cursor_initialized_empty': '[Cursor] 初始化完成。未找到已保存的cursor。',
    'log_cursor_restore_failed': '[Cursor] 恢复cursor状态失败:',
    'log_cursor_interceptors_applied': '[Cursor] 网络拦截器已应用。',
    'log_cursor_skip_known_position': '[Cursor] 跳过已知位置的保存: {0}',
    'log_cursor_skip_backtrack': '[Cursor] 跳过回退位置: {0} (当前位置: {1}), 排序: {2}',
    'log_cursor_save_error': '[Cursor] 保存cursor时出错:',
    'log_url_sort_changed': '检测到URL排序参数变更，排序方式已从"{0}"更改为"{1}"',
    'log_sorted_changed_position_cleared': '由于排序方式变更，已清除保存的浏览位置',
    'log_sort_check_error': '检查URL排序参数时出错: {0}',
    
    'log_xhr_rate_limit_detect': '[XHR限速检测] 检测到限速情况，原始响应: {0}',
    'log_list_end_normal': '[列表末尾] 检测到已到达列表末尾，这是正常情况，不触发限速: {0}...',
    'log_empty_search_with_filters': '[空搜索结果] 检测到搜索结果为空，但包含特殊过滤条件，这可能是正常情况: {0}...',
    'log_empty_search_already_limited': '[空搜索结果] 已处于限速状态，不重复触发: {0}...',
    'log_empty_search_page_loading': '[空搜索结果] 页面尚未完全加载，可能是初始请求，不触发限速: {0}...',
    'log_debounce_intercept': '[Debounce] 🚦 拦截滚动请求。应用{0}ms延迟...',
    'log_debounce_discard': '[Debounce] 🗑️ 丢弃之前的挂起请求。',
    'log_debounce_sending': '[Debounce] ▶️ 发送最新滚动请求: {0}',
    'log_fetch_detected_429': '[Fetch] 检测到429状态码: {0}',
    'log_fetch_rate_limit_detect': '[Fetch限速检测] 检测到限速情况，原始响应: {0}...',
    'log_fetch_list_end': '[Fetch列表末尾] 检测到已到达列表末尾，这是正常情况，不触发限速: {0}...',
    'log_fetch_empty_with_filters': '[Fetch空搜索结果] 检测到搜索结果为空，但包含特殊过滤条件，这可能是正常情况: {0}...',
    'log_fetch_empty_already_limited': '[Fetch空搜索结果] 已处于限速状态，不重复触发: {0}...',
    'log_fetch_empty_page_loading': '[Fetch空搜索结果] 页面尚未完全加载，可能是初始请求，不触发限速: {0}...',
    'log_fetch_implicit_rate_limit': '[Fetch隐性限速] 检测到可能的限速情况(空结果): {0}...',
    'log_json_parse_error': 'JSON解析错误: {0}',
    'log_response_length': '响应长度: {0}, 前100个字符: {1}',
    
    'log_execution_stopped_manually': '执行已由用户手动停止。',
    'log_todo_cleared_scan': '待办列表已清空。现在将扫描并仅添加当前可见的项目。',
    'log_scanning_loaded_items': '正在扫描已加载完成的商品...',
    'log_executor_running_queued': '执行器已在运行中，新任务已加入队列等待处理。',
    'log_todo_empty_scanning': '待办清单为空，正在扫描当前页面...',
    'log_request_no_results_not_counted': '请求成功但没有返回有效结果，不计入连续成功计数。来源: {0}',
    'log_not_rate_limited_ignore_exit': '当前不是限速状态，忽略退出限速请求: {0}',
    'log_found_todo_auto_resume': '发现 {0} 个待办任务，自动恢复执行...',
    
    'log_position_cleared': '已清除已保存的浏览位置。',
    
    'log_db_sync_cleared_failed': '[Fab DB Sync] 从"失败"列表中清除了 {0} 个已手动完成的商品。',
    'log_no_unowned_in_batch': '本批次中没有发现未拥有的商品。',
    'log_no_truly_free_after_verify': '找到未拥有的商品，但价格验证后没有真正免费的商品。',
    'log_429_scan_paused': '检测到429错误，可能是请求过于频繁。将暂停扫描。',
    
    'log_dispatching_wait': '正在派发任务中，请稍候...',
    'log_rate_limited_continue_todo': '当前处于限速状态，但仍将继续执行待办任务...',
    'log_worker_tabs_cleared': '已清理所有工作标签页的状态。',
    'log_worker_task_cleared_closing': '任务数据已被清理，工作标签页将关闭。',
    'log_detected_todo_no_workers': '检测到有待办任务但没有活动工作线程，尝试重新执行...',
    
    'log_failed_list_empty': '失败列表为空，无需操作。',
    
    'log_debug_mode_toggled': '调试模式已{0}。{1}',
    'log_debug_mode_detail_info': '将显示详细日志信息',
    'log_no_history_to_copy': '没有历史记录可供复制。',
    'log_history_cleared': '状态历史记录已清空。',
    
    'log_execution_state_inconsistent': '执行状态不一致，从存储中恢复：{0}',
    'log_invalid_worker_report': '收到无效的工作报告。缺少workerId或task。',
    'log_all_tasks_completed': '所有任务已完成。',
    'log_all_tasks_completed_rate_limited': '所有任务已完成，且处于限速状态，将刷新页面尝试恢复...',
    'log_recovery_probe_failed': '恢复探测失败。仍处于限速状态，将继续随机刷新...',
    
    'log_not_active_instance': '当前实例不是活跃实例，不执行任务。',
    'log_worker_instance_cooperate': '检测到活跃的脚本实例 [{0}]，当前工作标签页将与之协作。',
    'log_no_active_instance_activating': '没有检测到活跃实例，当前实例 [{0}] 已激活。',
    'log_inactive_instance_taking_over': '前一个实例 [{0}] 不活跃，当前实例接管。',
    
    'state_executing': '执行中',
    'state_stopped': '已停止',
    
    'log_diagnosis_complete': '页面诊断完成，请查看控制台输出',
    'log_diagnosis_failed': '页面诊断失败: {0}',
    
    'log_sort_ascending': '升序',
    'log_sort_descending': '降序',
    'log_no_visible_items_todo_workers': '虽然处于限速状态，但检测到有 {0} 个待办任务和 {1} 个活动工作线程，暂不自动刷新页面。',
    'log_visible_items_detected_skipping': '⏹️ 检测到页面上有 {0} 个可见商品，不触发自动刷新以避免中断浏览。',
    'log_please_complete_tasks_first': '请手动完成或取消这些任务后再刷新页面。',
    'log_entering_rate_limit_from': '🚨 检测到限速来自 [{0}]！正常运行期持续了 {1}s，期间有 {2} 次成功搜索请求。',
    'log_copy_error': '复制失败:',
}
```

## 具体代码修改位置

### 需要大量修改的地方（按优先级）：

1. **第5218行附近** - 脚本启动日志
   ```javascript
   // 当前:
   Utils.logger('info', '脚本开始运行...');
   // 改为:
   Utils.logger('info', Utils.getText('log_script_starting'));
   ```

2. **所有 `Utils.logger` 调用包含中文的地方** - 约100+处

3. **alert/confirm 调用** - 已基本完成国际化

4. **调试信息** - 可以保留英文，但最好也国际化

## 批量替换建议

使用正则表达式查找替换：

```regex
查找: Utils\.logger\(['"]info['"], ['"]([^'"]*[\u4e00-\u9fa5][^'"]*)['"]\)
替换: 需要逐个检查并创建对应的键值
```

## 预估工作量

- 新增文本键: ~100个
- 代码修改行数: ~150行
- 预计工作时间: 2-3小时

## 优先级建议

### 高优先级（用户可见）
1. UI相关文本（按钮、标签、状态）✅ 已完成
2. alert/confirm 对话框 ✅ 已完成  
3. tooltip 提示 ✅ 已完成

### 中优先级（经常出现的日志）
4. 执行状态相关日志
5. 限速检测相关日志
6. 错误/警告日志

### 低优先级（调试信息）
7. debug 级别的日志
8. 技术性消息（可保留英文）

## 注意事项

1. **参数化** - 所有带变量的文本都要使用 `{0}`, `{1}` 格式
2. **一致性** - 同类型的消息使用相同的前缀（如 `[Cursor]`, `[XHR]`）
3. **简洁性** - 中文翻译要简洁明了，避免过于技术化的术语
4. **测试** - 修改后需要在两种语言环境下都测试一遍
