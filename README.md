# Fab Helper 脚本

## 项目简介
Fab Helper 是一个用户脚本（UserScript），旨在增强 Fab.com 网站的使用体验。脚本提供了多种功能，包括自动处理限速问题、优化浏览体验、导出聊天记录等实用功能。

## 核心功能
- **限速自动恢复**：检测 429 状态码并自动刷新页面恢复正常访问
- **滚动请求优化**：通过延迟和去抖动技术避免频繁触发限速
- **游标恢复机制**：保存浏览位置，确保刷新后能够继续浏览
- **DOM 优化**：提供更流畅的页面浏览体验
- **导出聊天记录**：支持导出下载目录中的聊天记录
- **热更新功能**：支持脚本的快速更新而无需手动重新安装

## 安装方法
1. 首先安装一个用户脚本管理器：
   - Chrome/Edge: [Tampermonkey](https://www.tampermonkey.net/)
   - Firefox: [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
   - Safari: [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)

2. 安装 Fab Helper 脚本：
   - 点击 [此链接](安装链接) 安装最新版本
   - 或将 `fab_userscript_refactored.js` 文件手动导入到用户脚本管理器中

## 使用指南
1. 安装脚本后访问 Fab.com
2. 脚本会自动启动并在后台运行
3. 当遇到限速问题时，脚本会自动处理并恢复
4. 可通过控制台日志查看脚本运行状态

## 项目结构
```
FabHelperScript/
  - fab_userscript_refactored.js  # 主脚本文件
  - docs/                         # 文档目录
    - chat_history/               # 开发过程中的问题讨论记录
  - TODO.md                       # 待办事项
```

## 贡献指南
我们欢迎各种形式的贡献，包括但不限于：
- 提交 bug 报告
- 提出新功能建议
- 改进代码或文档
- 添加测试用例

### 开发流程
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m '添加某某功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 常见问题
### Q: 为什么有时候会循环触发限速恢复?
A: 当页面从限速状态恢复后立即发送大量请求时，可能会再次触发限速。我们正在优化恢复后的请求节流机制。

### Q: 脚本是否支持所有浏览器?
A: 脚本主要支持基于 Chrome 和 Firefox 的现代浏览器，其他浏览器可能需要额外配置。

## 版本历史
请参阅 `docs/版本号规范.md` 了解版本命名规则和历史版本信息。

## 许可证
[待定] - 请指定项目使用的开源许可证

## 联系方式
[待定] - 请添加您希望他人联系您的方式 