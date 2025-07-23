# Fab Helper Script

Fab Helper 是一个用于辅助 Fab.com 网站使用的脚本工具，提供自动化功能和界面增强。

## 版本

- **标准版**: `fab_userscript_refactored.js` - 基础功能版本
- **优化版**: `fab_userscript_optimized.js` - 性能优化版本，减少API请求，提高稳定性

## 优化版特性

优化版本（3.2.3，更新于2025-07-23）包含以下改进：

- 数据缓存系统：减少重复API请求
- 请求拦截器：自动缓存网页发送的API响应
- 优化商品拥有状态检查：减少API请求次数
- 改进限速状态检测：使用Performance API提前发现问题
- 修复API返回数据格式不一致的问题
- 增强对网页排序选项的适配能力
- 代码优化：精简调试代码，改进错误处理，提高性能
- 修复限速状态下隐藏所有商品后不自动刷新的问题
- 改进自动刷新判断逻辑，使用UI上显示的可见商品数量作为依据
- 添加UI自动恢复机制，解决长时间无操作后UI消失的问题
- 修复同步状态功能导致页面异常的问题

## 安装

1. 安装一个用户脚本管理器，如 Tampermonkey 或 Violentmonkey
2. 将脚本文件添加到用户脚本管理器中
3. 访问 Fab.com 网站，脚本将自动运行

## 文档

详细文档请查看 `docs` 目录：

- [用户指南](docs/USER_GUIDE.md)
- [API参考](docs/API_REFERENCE.md)
- [架构说明](docs/ARCHITECTURE.md)
- [更新日志](docs/CHANGELOG.md)
- [故障排除](docs/TROUBLESHOOTING.md)

## 贡献

欢迎提交问题报告和改进建议。请查看 [贡献指南](docs/CONTRIBUTING.md) 了解更多信息。 