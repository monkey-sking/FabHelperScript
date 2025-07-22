# Fab Helper API 参考文档

本文档详细介绍 Fab Helper 脚本提供的 API，供开发者扩展功能或自定义行为。

## 全局命名空间

Fab Helper 所有功能都封装在全局 `FabHelper` 对象中，可通过浏览器控制台访问。

```javascript
// 示例: 检查 FabHelper 是否可用
console.log(typeof FabHelper !== 'undefined' ? 'Fab Helper 已加载' : 'Fab Helper 未加载');
```

## 配置 API

### FabHelper.config

包含脚本的所有配置选项。

```javascript
// 获取当前配置
console.log(FabHelper.config);

// 修改配置
FabHelper.config.debounceDelay = 500;
FabHelper.config.enableAutoRecover = true;
```

#### 主要配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `debounceDelay` | Number | 350 | 请求去抖动延迟时间 (ms) |
| `throttleInterval` | Number | 1000 | 请求节流间隔时间 (ms) |
| `enableAutoRecover` | Boolean | true | 是否启用自动恢复功能 |
| `maxRetryTime` | Number | 60000 | 最大自动恢复时间 (ms) |
| `recoveryBufferTime` | Number | 0 | 恢复后的冷却时间 (ms) |
| `successfulRequestsThreshold` | Number | 3 | 判定恢复成功所需的成功请求数 |
| `enableLogging` | Boolean | true | 是否启用日志记录 |
| `logLevel` | String | 'info' | 日志级别 ('debug', 'info', 'warn', 'error') |

### FabHelper.saveConfig()

保存当前配置到本地存储，在页面刷新后仍保持。

```javascript
// 修改配置并保存
FabHelper.config.debounceDelay = 500;
FabHelper.saveConfig();
```

### FabHelper.resetConfig()

重置配置到默认值。

```javascript
// 重置所有配置
FabHelper.resetConfig();
```

## 限速处理 API

### FabHelper.isRateLimited

获取当前是否处于限速状态。

```javascript
// 检查是否处于限速状态
if (FabHelper.isRateLimited) {
  console.log('当前处于限速状态');
}
```

### FabHelper.handleRateLimit(source)

手动触发限速处理流程。

```javascript
// 手动触发限速处理
FabHelper.handleRateLimit('manual_trigger');
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `source` | String | 触发限速的来源说明 |

### FabHelper.disableAutoRecover()

临时禁用自动恢复功能。

```javascript
// 禁用自动恢复
FabHelper.disableAutoRecover();
```

### FabHelper.enableAutoRecover()

重新启用自动恢复功能。

```javascript
// 启用自动恢复
FabHelper.enableAutoRecover();
```

### FabHelper.getRateLimitStatus()

获取当前限速状态的详细信息。

```javascript
// 获取限速状态信息
const status = FabHelper.getRateLimitStatus();
console.log(status);
/*
{
  isLimited: true,
  startTime: 1615123456789,
  duration: 45.2, // 秒
  recoveryAttempts: 2,
  successfulRequests: 1
}
*/
```

## 请求优化 API

### FabHelper.debounceRequest(url, delay)

对指定 URL 的请求进行去抖动处理。

```javascript
// 对搜索请求应用去抖动
const debouncedRequest = FabHelper.debounceRequest('/api/search', 500);
debouncedRequest();
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `url` | String | 请求的 URL |
| `delay` | Number | 可选，去抖动延迟时间 (ms)，默认使用配置值 |

### FabHelper.throttleRequests(interval)

全局请求节流控制。

```javascript
// 设置全局请求节流间隔
FabHelper.throttleRequests(2000);
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `interval` | Number | 节流间隔时间 (ms) |

## 游标恢复 API

### FabHelper.cursorModule.saveCursorPosition(cursor)

保存当前游标位置。

```javascript
// 保存当前游标
FabHelper.cursorModule.saveCursorPosition('cD1Qcmltcm9zZStIaWxsK0JvdW5kYXJ5');
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `cursor` | String | 游标字符串 |

### FabHelper.cursorModule.restoreCursorPosition()

恢复保存的游标位置。

```javascript
// 尝试恢复游标位置
FabHelper.cursorModule.restoreCursorPosition();
```

### FabHelper.cursorModule.clearSavedCursor()

清除保存的游标数据。

```javascript
// 清除游标数据
FabHelper.cursorModule.clearSavedCursor();
```

### FabHelper.cursorModule.listAllCursors()

列出所有保存的游标历史。

```javascript
// 查看游标历史
const cursors = FabHelper.cursorModule.listAllCursors();
console.log(cursors);
```

### FabHelper.disableCursorRestore()

禁用游标恢复功能。

```javascript
// 禁用游标恢复
FabHelper.disableCursorRestore();
```

## DOM 观察 API

### FabHelper.domObserver.status()

获取 DOM 观察器的状态。

```javascript
// 检查 DOM 观察器状态
const status = FabHelper.domObserver.status();
console.log(status);
/*
{
  active: true,
  observingElements: 3,
  lastMutation: 1615123456789
}
*/
```

### FabHelper.restartDOMObserver()

重新启动 DOM 观察器。

```javascript
// 重启 DOM 观察器
FabHelper.restartDOMObserver();
```

### FabHelper.reinjectStyles()

重新注入自定义样式。

```javascript
// 重新注入样式
FabHelper.reinjectStyles();
```

### FabHelper.disableCustomStyles()

临时禁用自定义样式。

```javascript
// 禁用自定义样式
FabHelper.disableCustomStyles();
```

### FabHelper.enableCustomStyles()

重新启用自定义样式。

```javascript
// 启用自定义样式
FabHelper.enableCustomStyles();
```

## 日志 API

### FabHelper.log(message)

记录普通日志信息。

```javascript
// 记录日志
FabHelper.log('正在处理请求...');
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `message` | String | 日志消息 |

### FabHelper.logDebug(message)

记录调试级别的日志。

```javascript
// 记录调试信息
FabHelper.logDebug('游标数据: ' + JSON.stringify(cursorData));
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `message` | String | 调试消息 |

### FabHelper.logWarning(message)

记录警告级别的日志。

```javascript
// 记录警告信息
FabHelper.logWarning('游标格式可能有问题');
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `message` | String | 警告消息 |

### FabHelper.logError(message, error)

记录错误级别的日志。

```javascript
// 记录错误信息
try {
  // 某些操作
} catch (err) {
  FabHelper.logError('处理请求时出错', err);
}
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `message` | String | 错误消息 |
| `error` | Error | 可选，错误对象 |

### FabHelper.enableLogging()

启用日志记录。

```javascript
// 启用日志
FabHelper.enableLogging();
```

### FabHelper.disableLogging()

禁用日志记录。

```javascript
// 禁用日志
FabHelper.disableLogging();
```

### FabHelper.setLogLevel(level)

设置日志级别。

```javascript
// 设置日志级别
FabHelper.setLogLevel('debug');
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `level` | String | 日志级别 ('debug', 'info', 'warn', 'error') |

## 功能扩展 API

### FabHelper.chatModule.exportChatHistory()

导出聊天记录。

```javascript
// 导出聊天记录
FabHelper.chatModule.exportChatHistory();
```

### FabHelper.chatModule.extractChatData()

提取当前页面的聊天数据，返回 Promise。

```javascript
// 提取聊天数据
FabHelper.chatModule.extractChatData()
  .then(data => console.log('提取的聊天数据:', data))
  .catch(err => console.error('提取失败:', err));
```

## 热更新 API

### FabHelper.updateModule.checkForUpdates(force)

检查脚本更新。

```javascript
// 检查更新
FabHelper.updateModule.checkForUpdates(true);
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `force` | Boolean | 是否强制检查更新，忽略时间间隔限制 |

### FabHelper.enableHotUpdate()

启用自动热更新功能。

```javascript
// 启用热更新
FabHelper.enableHotUpdate();
```

### FabHelper.disableHotUpdate()

禁用自动热更新功能。

```javascript
// 禁用热更新
FabHelper.disableHotUpdate();
```

## 工具 API

### FabHelper.util.downloadJSON(data, filename)

将 JSON 数据下载为文件。

```javascript
// 下载数据为 JSON 文件
const data = { key: 'value' };
FabHelper.util.downloadJSON(data, 'my-data.json');
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `data` | Object | 要下载的 JSON 数据 |
| `filename` | String | 保存的文件名 |

### FabHelper.util.formatDate(date, format)

格式化日期。

```javascript
// 格式化日期
const formatted = FabHelper.util.formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
console.log(formatted); // 例如: 2023-05-01 14:30:45
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `date` | Date | 日期对象 |
| `format` | String | 日期格式字符串 |

## 诊断 API

### FabHelper.enableDiagnostics()

启用诊断模式，记录更详细的日志。

```javascript
// 启用诊断
FabHelper.enableDiagnostics();
```

### FabHelper.disableDiagnostics()

禁用诊断模式。

```javascript
// 禁用诊断
FabHelper.disableDiagnostics();
```

### FabHelper.generateDiagnosticReport()

生成诊断报告，包含当前状态和历史数据。

```javascript
// 生成诊断报告
const report = FabHelper.generateDiagnosticReport();
console.log(report);
```

### FabHelper.resetAllSettings()

重置所有设置和存储的数据。

```javascript
// 重置所有设置
FabHelper.resetAllSettings();
```

## 事件 API

订阅和触发自定义事件。

### FabHelper.events.on(eventName, callback)

订阅事件。

```javascript
// 订阅限速事件
FabHelper.events.on('rateLimitDetected', (data) => {
  console.log(`检测到限速: ${data.source}`);
});
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `eventName` | String | 事件名称 |
| `callback` | Function | 事件回调函数 |

### FabHelper.events.off(eventName, callback)

取消事件订阅。

```javascript
// 取消订阅
const handler = (data) => console.log(data);
FabHelper.events.on('rateLimitDetected', handler);
// 稍后取消订阅
FabHelper.events.off('rateLimitDetected', handler);
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `eventName` | String | 事件名称 |
| `callback` | Function | 要移除的回调函数 |

### FabHelper.events.once(eventName, callback)

订阅一次性事件（触发后自动取消订阅）。

```javascript
// 一次性事件订阅
FabHelper.events.once('recoveryComplete', () => {
  console.log('恢复完成，此消息只会显示一次');
});
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `eventName` | String | 事件名称 |
| `callback` | Function | 事件回调函数 |

### 可用的内置事件

| 事件名称 | 触发时机 | 回调数据 |
|----------|----------|----------|
| `rateLimitDetected` | 检测到限速时 | `{ source, time }` |
| `recoveryStarted` | 开始恢复流程时 | `{ retryTime }` |
| `recoveryComplete` | 恢复成功时 | `{ duration }` |
| `recoveryFailed` | 恢复失败时 | `{ attempts }` |
| `cursorSaved` | 保存游标位置时 | `{ cursor }` |
| `cursorRestored` | 恢复游标位置时 | `{ cursor, success }` |
| `updateAvailable` | 检测到更新时 | `{ version, changelog }` |
| `updateApplied` | 应用更新后 | `{ version }` |

## 扩展 API

### FabHelper.registerModule(name, moduleObject)

注册自定义模块，扩展 FabHelper 功能。

```javascript
// 注册自定义模块
FabHelper.registerModule('myFeature', {
  init() {
    console.log('初始化自定义模块');
  },
  doSomething() {
    console.log('执行自定义功能');
  }
});

// 使用自定义模块
FabHelper.myFeature.doSomething();
```

| 参数 | 类型 | 描述 |
|------|------|------|
| `name` | String | 模块名称 |
| `moduleObject` | Object | 模块对象，包含各种方法和属性 | 