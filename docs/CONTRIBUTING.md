# 参与贡献

感谢您考虑为 Fab Helper 项目做出贡献！本文档将指导您如何参与项目开发。

## 开发环境设置

1. **克隆仓库**

   ```bash
   git clone [仓库地址]
   cd FabHelperScript
   ```

2. **安装依赖**
   本项目使用 Node.js 进行构建。

   ```bash
   npm install
   ```

3. **构建与测试**
   - 运行构建命令：

     ```bash
     npm run build
     ```

   - 将生成的 `dist/fab_helper.user.js` 安装到浏览器的用户脚本管理器中
   - 访问 Fab.com 网站进行测试

## 代码风格指南

- 使用 2 空格缩进
- 使用 camelCase 命名变量和函数
- 使用有意义的变量名和函数名，避免使用单字母变量（除非是循环索引）
- 为主要函数和复杂逻辑添加注释
- 在日志输出中使用表情符号前缀，便于快速识别不同类型的日志

示例：

```javascript
/**
 * 处理限速情况并尝试恢复
 * @param {string} source - 触发限速的来源
 */
function handleRateLimit(source) {
  const currentTime = performance.now();
  const duration = (currentTime - lastNormalOperationTime) / 1000;
  
  log(`🚨 RATE LIMIT DETECTED from [${source}]! Normal operation lasted ${duration.toFixed(2)}s with ${successfulSearchCount} successful search requests.`);
  
  // 启动恢复流程
  startAutoRecovery();
}
```

## 提交规范

提交信息应当简洁明了，包含修改的内容和原因。建议使用以下前缀：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 仅修改文档
- `style:` 不影响代码含义的修改（空格、格式化等）
- `refactor:` 重构代码但不添加新功能或修复 bug
- `perf:` 性能优化
- `test:` 添加或修改测试
- `chore:` 构建过程或辅助工具的变动

示例：

```
fix: 修复恢复后立即再次触发限速的问题
```

## 分支策略

- `main` 分支为稳定分支，包含发布版本的代码
- 开发新功能请基于 `main` 创建 `feature/xxx` 分支
- 修复 bug 请基于 `main` 创建 `bugfix/xxx` 分支

## 提交 Pull Request

1. 确保您的代码遵循我们的代码风格指南
2. 确保您的代码已经过充分测试
3. 提交 PR 到 `main` 分支
4. 在 PR 描述中详细说明您的更改，包括：
   - 实现的功能或修复的问题
   - 实现方式或解决方案
   - 如何测试您的更改

## 报告 Bug

如果您发现了 bug，请创建一个 issue 并包含以下信息：

- 简洁明了的标题
- 详细的问题描述
- 复现步骤
- 预期行为和实际行为
- 浏览器版本和操作系统
- 相关的控制台日志（如有）
- 截图（如有）

## 功能请求

如果您有新功能的想法，请创建一个 issue 并包含以下信息：

- 简洁明了的标题
- 详细的功能描述
- 为什么这个功能对项目有价值
- 可能的实现方式（如有）

## 代码审查

所有的 PR 都需要至少一个维护者的审查。在审查过程中，请耐心等待并及时回应反馈。

## 许可证

通过贡献代码，您同意您的贡献将在项目的许可证下发布。
