# Fab Helper 故障排除指南

本文档提供了使用 Fab Helper 脚本时可能遇到的常见问题和相应的解决方案。

## 限速相关问题

### 问题：频繁遇到 429 限速错误

**症状**：
- 控制台频繁显示 "🚨 RATE LIMIT DETECTED" 信息
- 页面持续处于限速状态
- 自动恢复功能反复触发但效果不明显

**可能的原因**：
1. 请求发送过于频繁
2. 同时打开了多个 Fab.com 标签页
3. 脚本配置不当
4. 网站限速策略变化

**解决方案**：
1. **减少页面操作频率**：减慢滚动速度，避免快速点击多个链接
2. **关闭多余标签页**：确保同一时间只打开 1-2 个 Fab.com 标签页
3. **调整脚本设置**：
   ```javascript
   // 在控制台中增加延迟时间
   FabHelper.config.debounceDelay = 500; // 增加到 500ms
   FabHelper.config.throttleInterval = 2000; // 增加到 2000ms
   ```
4. **添加恢复后冷却期**：在脚本中增加恢复后的等待时间
5. **临时禁用自动恢复**：如果持续触发限速，可临时禁用自动恢复功能
   ```javascript
   FabHelper.disableAutoRecover();
   ```

### 问题：恢复后立即再次进入限速

**症状**：
- 页面成功从限速状态恢复
- 几秒钟内立即再次触发限速
- 形成恢复-限速-恢复的循环

**可能的原因**：
1. 恢复后立即发送了大量请求
2. 恢复检测机制不完善
3. 浏览器缓存问题

**解决方案**：
1. **增加恢复后冷却期**：
   ```javascript
   // 在控制台中增加恢复后等待时间
   FabHelper.config.recoveryBufferTime = 5000; // 恢复后等待 5 秒
   ```
2. **逐步恢复请求**：恢复后不要立即滚动页面或进行大量操作
3. **清除浏览器缓存**：有时缓存问题会导致异常行为
4. **更新到最新版本**：确保使用最新版脚本，可能已修复此问题

### 问题：限速状态下隐藏商品后不自动刷新

**症状**：
- 页面处于限速状态
- 使用"隐藏已得"功能后所有商品都被隐藏
- 但页面没有自动刷新，保持空白状态

**可能的原因**：
1. 脚本版本过旧，不支持此功能
2. 隐藏商品的计数方式有误
3. 限速状态检测逻辑问题

**解决方案**：
1. **更新到最新版本**：确保使用 3.2.1 或更高版本的脚本
2. **手动刷新页面**：如果没有自动刷新，可以手动刷新页面
3. **切换隐藏状态**：尝试点击"显示已得"再点击"隐藏已得"，触发重新计算
4. **检查实际可见商品数量**：
   ```javascript
   // 在控制台中查看实际可见商品数量
   document.querySelectorAll('.fabkit-Stack-root.nTa5u2sc:not([style*="display: none"])').length
   ```
5. **启用调试模式**：
   ```javascript
   // 启用调试模式查看详细日志
   FabHelper.config.debugMode = true;
   ```

## 游标恢复问题

### 问题：页面刷新后没有回到原位置

**症状**：
- 在限速恢复后，页面位置回到顶部
- 游标恢复功能未生效
- 控制台没有显示游标恢复相关消息

**可能的原因**：
1. 游标保存失败
2. URL 结构变化
3. 页面加载时机问题

**解决方案**：
1. **检查游标存储状态**：
   ```javascript
   // 在控制台中查看保存的游标
   console.log(localStorage.getItem('fabhelper_last_cursor'));
   ```
2. **手动触发恢复**：
   ```javascript
   FabHelper.cursorModule.restoreCursorPosition();
   ```
3. **清除失效的游标数据**：
   ```javascript
   localStorage.removeItem('fabhelper_last_cursor');
   ```
4. **更新脚本**：URL 结构变化可能需要更新脚本以适应

### 问题：游标注入但页面内容不正确

**症状**：
- URL 中的游标参数正确注入
- 但加载的内容不是预期的位置
- 或显示空白结果

**可能的原因**：
1. 游标值已过期
2. 服务器端更新导致旧游标无效
3. 游标格式错误

**解决方案**：
1. **重置游标**：
   ```javascript
   localStorage.removeItem('fabhelper_last_cursor');
   location.reload();
   ```
2. **手动导航**：不使用游标，手动导航到所需位置
3. **更新游标格式**：如果知道正确的游标格式，可手动修改
4. **禁用游标功能**：临时禁用游标恢复功能
   ```javascript
   FabHelper.disableCursorRestore();
   ```

## DOM 相关问题

### 问题：自定义 UI 元素未显示

**症状**：
- 脚本加载成功但没有显示自定义 UI 元素
- 控制台没有相关错误
- 功能正常但界面增强缺失

**可能的原因**：
1. DOM 观察器未启动
2. CSS 注入失败
3. 页面结构变化导致选择器失效

**解决方案**：
1. **检查 DOM 观察器状态**：
   ```javascript
   FabHelper.domObserver.status();
   ```
2. **手动重启 DOM 观察器**：
   ```javascript
   FabHelper.restartDOMObserver();
   ```
3. **检查元素选择器**：如果网站结构变化，需要更新选择器
4. **强制重新注入样式**：
   ```javascript
   FabHelper.reinjectStyles();
   ```

### 问题：页面布局异常

**症状**：
- 使用脚本后页面布局错位
- 某些元素重叠或消失
- 交互功能受到影响

**可能的原因**：
1. CSS 注入冲突
2. 脚本修改了关键 DOM 元素
3. 网站更新与脚本不兼容

**解决方案**：
1. **临时禁用样式修改**：
   ```javascript
   FabHelper.disableCustomStyles();
   ```
2. **恢复原始 DOM 结构**：
   ```javascript
   FabHelper.restoreOriginalDOM();
   ```
3. **更新到最新版本**：检查是否有适应新网站结构的更新
4. **手动修改冲突样式**：如果知道冲突位置，可临时修改样式

## 功能相关问题

### 问题：导出聊天记录失败

**症状**：
- 调用 exportChatHistory() 但没有下载文件
- 控制台显示错误信息
- 或功能没有响应

**可能的原因**：
1. 页面不是聊天记录页面
2. 数据提取逻辑失效
3. 下载功能受到浏览器限制

**解决方案**：
1. **确认正确页面**：确保在包含聊天记录的页面上执行
2. **检查控制台错误**：查看具体错误信息
3. **手动触发提取流程**：
   ```javascript
   FabHelper.chatModule.extractChatData().then(console.log);
   ```
4. **允许下载权限**：确保浏览器允许网站下载文件
5. **更新提取逻辑**：如果网站结构变化，可能需要更新

### 问题：热更新功能未生效

**症状**：
- 有新版本但未自动更新
- 控制台没有更新检查相关信息
- 手动检查更新也没反应

**可能的原因**：
1. 热更新功能未启用
2. 更新服务器无法访问
3. 版本检查逻辑问题

**解决方案**：
1. **启用热更新**：
   ```javascript
   FabHelper.enableHotUpdate();
   ```
2. **手动触发检查**：
   ```javascript
   FabHelper.updateModule.checkForUpdates(true);
   ```
3. **查看更新配置**：
   ```javascript
   console.log(FabHelper.config.updateSettings);
   ```
4. **临时使用手动更新**：如果自动更新持续失败，请手动更新脚本

## 安装和兼容性问题

### 问题：脚本无法安装

**症状**：
- 点击安装链接没有反应
- 用户脚本管理器显示错误
- 安装成功但不加载

**可能的原因**：
1. 用户脚本管理器版本过旧
2. 脚本格式问题
3. 浏览器限制

**解决方案**：
1. **更新脚本管理器**：确保使用最新版本的脚本管理器
2. **手动安装**：尝试手动复制脚本内容到脚本管理器
3. **检查浏览器设置**：确保允许安装用户脚本
4. **尝试不同浏览器**：如果一个浏览器有问题，尝试另一个

### 问题：与其他脚本冲突

**症状**：
- 安装后其他脚本停止工作
- 或 Fab Helper 部分功能失效
- 控制台显示 JavaScript 错误

**可能的原因**：
1. 多个脚本修改相同 DOM 元素
2. 全局变量名冲突
3. 事件监听器冲突

**解决方案**：
1. **暂时禁用其他脚本**：确认是否存在冲突
2. **启用隔离模式**：
   ```javascript
   FabHelper.enableIsolationMode();
   ```
3. **调整加载顺序**：在脚本管理器中调整脚本加载顺序
4. **联系作者**：报告冲突问题以便解决

## 高级诊断与修复

### 诊断模式

如果遇到难以诊断的问题，可以启用诊断模式获取更详细的日志：

```javascript
// 在控制台中启用诊断模式
FabHelper.enableDiagnostics();

// 禁用诊断模式
FabHelper.disableDiagnostics();
```

### 重置所有设置

如果脚本行为异常且无法解决，可以尝试重置所有设置：

```javascript
// 清除所有脚本存储的数据
FabHelper.resetAllSettings();
```

### 手动修复游标数据

如果游标恢复持续出现问题：

```javascript
// 查看当前存储的所有游标
FabHelper.cursorModule.listAllCursors();

// 手动设置当前游标
FabHelper.cursorModule.setCurrentCursor('你的游标值');
```

### 提交诊断报告

如果问题持续存在，请提交诊断报告：

1. 启用诊断模式
2. 复现问题
3. 导出诊断日志：
   ```javascript
   const diagnosticLog = FabHelper.generateDiagnosticReport();
   console.log(diagnosticLog); // 复制此输出
   ```
4. 在 GitHub Issues 中提交问题，并附上诊断日志

---

如果您遇到的问题未在本指南中列出，或提供的解决方案无效，请创建 GitHub Issue 并详细描述您的问题。我们会尽快提供帮助。 