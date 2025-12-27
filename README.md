# Fab Helper Script

**中文** | [English](README_EN.md)

Fab Helper 是一个用于辅助 Fab.com 网站使用的脚本工具，提供自动化功能和界面增强。

## 版本

- **当前版本**: `dist/fab_helper.user.js` (构建产物，请安装此文件)
- **源代码**: `src/` 目录 (模块化开发)
- **旧版本**: `legacy/` 目录 (归档)

## 核心特性

优化版本（3.5.0，更新于2025-12-27）已完成模块化重构，包含以下改进：

- **模块化架构**：代码拆分为功能独立的模块，易于维护及扩展
- **稳健的初始化**：完整的错误处理和依赖注入机制
- **数据缓存系统**：减少重复API请求
- **请求拦截器**：自动缓存网页发送的API响应
- **智能限速处理**：自动检测 429 错误并暂停/恢复
- **后台任务处理**：支持多标签页协同工作
- **UI 增强**：实时状态面板和操作控制

## 安装

1. 安装 Node.js 环境 (用于构建)
2. 克隆仓库并安装依赖：

   ```bash
   npm install
   ```

3. 构建脚本：

   ```bash
   npm run build
   ```

4. 将生成的 `dist/fab_helper.user.js` 文件安装到用户脚本管理器 (如 Tampermonkey)
5. 访问 Fab.com 网站，脚本将自动运行

## 文档

详细文档请查看 `docs` 目录：

- [用户指南](docs/USER_GUIDE.md)
- [API参考](docs/API_REFERENCE.md)
- [架构说明](docs/ARCHITECTURE.md)
- [更新日志](docs/CHANGELOG.md)
- [故障排除](docs/TROUBLESHOOTING.md)
- [开发需求文档](docs/specs/Fab Helper 脚本开发需求.md)

## 贡献

欢迎提交问题报告和改进建议。请查看 [贡献指南](docs/CONTRIBUTING.md) 了解更多信息。
