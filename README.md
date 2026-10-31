# Fab Helper Script

<!-- badges:start -->
[![License](https://img.shields.io/github/license/monkey-sking/FabHelperScript?style=flat-square)](https://github.com/monkey-sking/FabHelperScript/blob/main/LICENSE) [![Last commit](https://img.shields.io/github/last-commit/monkey-sking/FabHelperScript?style=flat-square)](https://github.com/monkey-sking/FabHelperScript/commits/main) [![JavaScript](https://img.shields.io/github/languages/top/monkey-sking/FabHelperScript?style=flat-square)](https://github.com/monkey-sking/FabHelperScript/search?l=JavaScript) [![Stars](https://img.shields.io/github/stars/monkey-sking/FabHelperScript?style=flat-square)](https://github.com/monkey-sking/FabHelperScript/stargazers) [![views](https://hits.sh/github.com/monkey-sking/FabHelperScript.svg?style=flat-square&label=views&color=0e75b6)](https://github.com/monkey-sking/FabHelperScript) [![Forks](https://img.shields.io/github/forks/monkey-sking/FabHelperScript?style=flat-square)](https://github.com/monkey-sking/FabHelperScript/network/members)
<!-- badges:end -->

**中文** | [English](README_EN.md)

Fab Helper 是专为 [Fab.com](https://www.fab.com) 平台打造的高性能自动化辅助与体验优化用户脚本（v3.5.x）。针对海量资产浏览与入库场景，深度整合了 **API 优先极速入库**、**官网原生零元结算驱动**、**极致资源拦截**、**智能限速退避**、**安全人机验证提醒保护** 以及 **高精度瀑布流浏览记忆** 等现代化能力。

---

## 核心特性

- ⚡ **三重锁定大资源禁用**  
  在最早期（`document-start` 阶段）通过 **CSP 动态注入**、**CSS 强制折叠** 以及 **MutationObserver 同步拦截** 三重机制，全面阻断图片、视频、自定义字体及无关 iframe（包含高耗能的 WebGL 3D 预览器）的加载，大幅降低网络开销与内存占用，保障多标签页极速并发。

- 🚀 **API-First 极速入库与 DOM 智能回落**  
  首创 API 优先入库策略，直接调用官方端点秒级完成加库；当遇到多规格选择、特殊前端交互或接口异常时，自动平滑回落到详情页 DOM 自动化点击流程，兼顾效率与成功率。

- 📦 **Bundle 资产集合与官网零元结算流程自动驱动**  
  原生支持 Fab 上的 Bundle（资产集合）商品。无论是 `/bundles/` 路由还是通过 `/listings/` 路由加入，均能精准识别；自动驱动官网原生零元结算流程（`/payment/web/purchase`），自动提交并双向校验服务端拥有状态。

- 💎 **100% 折扣限时免费与 CC0 许可全覆盖**  
  不仅支持永久免费（$0）资源，更深度兼容促销期间的 **100% 折扣限时免费**（原价大于 0 但折后价为 0）、CC0 公开领域许可商品以及从 `startingPrice` 兜底解析，绝不遗漏任何限免资产。

- 🛡️ **安全人机验证（CAPTCHA）保护机制与浏览器通知**  
  当遭遇 Cloudflare Turnstile、ArkoseLabs、hCaptcha、reCAPTCHA 或平台安全检查时：
  - **绝不强退秒关**：自动取消强制超时关闭，完好保留验证窗口，并注入醒目红色提示横幅；
  - **自动熔断暂停**：主标签页收到验证信号后立即暂停任务派发，保护账号免遭风控惩罚；
  - **待办安全保留**：受阻任务安全保留在待办队列顶部，绝不作废丢弃；
  - **系统桌面通知**：在设置中一键开启通知权限，遭遇验证时即时推送系统通知，提醒用户人工完成验证后一键恢复。

- 🔄 **智能 HTTP 429 限速监测与自愈恢复**  
  实时监测 API 响应状态及页面加载限速。当被限速时，自动转为等待模式，执行随机延迟退避策略，并通过定时刷新和轻量探测在限速解除后自动恢复任务流程，全程无需人工干预。

- 📍 **高精度瀑布流游标（Cursor）浏览记忆**  
  基于 URL Cursor 注入与无感锚定技术，精确记录瀑布流浏览历史深度。刷新或重开页面后能自动无缝还原至最后浏览的商品位置，并提供深色模式高亮反馈。

- 🖥️ **深色玻璃美学悬浮控制台**  
  现代 Glassmorphism 深色拟态控制面板。内置实时指标监控（待办、已入库、失败、可见、已隐藏统计）、实时操作日志、功能开关（大资源拦截、隐藏已拥有、自动滚动、人机验证通知等）及一键清库与重试控件。

---

## 项目结构

本脚本基于清晰的 ES Module 模块化设计，核心代码位于 `src/` 目录下：

```text
src/
├── config.js                        # 全局配置、UI 选择器常量、数据库键名
├── state.js                         # 运行时状态管理 (执行状态、任务队列、多实例信息)
├── index.js                         # 脚本主入口，document-start 早期资源拦截与网络钩子
├── i18n/                            # 国际化语言包
│   ├── zh.js                        # 中文语言包
│   └── en.js                        # 英文语言包
└── modules/
    ├── api.js                       # 网络请求中心（XHR/Fetch 辅助、GM Fetch、数据提取）
    ├── bundle-claim.js              # Bundle 资产识别、零元结算 URL 校验与 iframe 驱动
    ├── captcha-detection.js         # 集中化人机验证（CAPTCHA/Cloudflare/Turnstile）探测
    ├── verification-notifications.js# 浏览器桌面通知权限管理与验证提醒发送
    ├── claim-strategy.js            # 入库策略管理器（ApiClaim 与 DomClaim 调度）
    ├── data-cache.js                # 内存数据缓存系统（Listing 详情、价格与拥有状态缓存）
    ├── database.js                  # 本地持久化数据管理（Todo 待办、Done 完成、Failed 失败）
    ├── detail-claim.js              # 详情页 DOM 自动化领取核心（多规格选择、成人确认、按钮点击）
    ├── instance-manager.js          # 多标签页互斥锁与活动实例协调器
    ├── keepalive.js                 # 后台保活机制（Web Worker 心跳与 WebRTC 防休眠）
    ├── listing-source.js            # 列表数据源适配器（游标分页解析、价格折算）
    ├── page-diagnostics.js          # 详情页 DOM 诊断与状态分析工具
    ├── page-patcher.js              # 页面修补器（游标注入、滚动还原与请求消抖）
    ├── pipeline.js                  # 流水线执行状态机
    ├── pipeline-adapter.js          # 流水线与存储适配层
    ├── pipeline-scheduler.js        # 流水线调度循环与自愈机制
    ├── rate-limit-detection.js      # 429 限速状态精准检测
    ├── rate-limit-manager.js        # 限速冷却管理、历史统计与自愈恢复探测
    ├── task-runner.js               # 任务调度与卡片扫描中心（主页面派发与 Worker 标签页协同）
    ├── ui.js                        # 控制台 UI 构建与交互逻辑
    └── utils.js                     # 基础工具函数（Cookie、日志、DOM 操作等）
```

---

## 安装与开发

### 环境准备
- 安装 [Node.js](https://nodejs.org/) (建议 Node.js 18+ 或更高版本 LTS)。
- 安装浏览器的用户脚本管理器：推荐 [Tampermonkey (篡改猴)](https://www.tampermonkey.net/) 或 Violentmonkey。

### 本地构建
1. 克隆代码库，并安装开发依赖：
   ```bash
   npm install
   ```
2. 运行构建（打包生成 `dist/fab_helper.user.js`）：
   ```bash
   npm run build
   ```
3. 开发监听模式（文件改动自动重新构建）：
   ```bash
   npm run dev
   ```
4. 执行单元测试：
   ```bash
   npm test
   ```

### 安装使用
1. 构建完成后，直接复制项目根目录下 `dist/fab_helper.user.js` 的完整代码。
2. 打开 Tampermonkey 管理面板，点击“新建脚本”，将代码全选粘贴并保存（快捷键 `Ctrl+S` / `Cmd+S`）。
3. 访问 [Fab.com 免费搜索页](https://www.fab.com/search?is_free=1&sort_by=-firstPublishedAt)，控制台即会在页面右下角自动加载展开。

---

## 核心设置项说明

在控制台顶部的 **「设定」** 选项卡中，您可以自由开启或调整以下功能：

| 配置名称 | 对应英文 | 功能说明 |
| :--- | :--- | :--- |
| **无限滚动时自动添加任务** | Auto add on scroll | 开启后，在滚动搜索列表时，视野内符合条件的未拥有商品会自动加入待办加库队列。 |
| **自动滚动页面（自动扫描全部）** | Auto scroll page | 开启后，脚本自动逐屏平滑向下滚动触发分页加载，实现全自动无人值守全库扫描入库。 |
| **记住瀑布流浏览位置** | Remember scroll position | 自动记录最后浏览的商品游标深度，页面刷新或下次进入时无缝恢复到原位置。 |
| **429后自动恢复并继续** | Auto resume after 429 | 当遭遇 429 限速时，脚本自动退避并在探测到限速解除后自动恢复任务执行。 |
| **无商品可见时自动刷新** | Auto refresh empty page | 当页面所有商品均被隐藏或处于空白状态时，自动刷新以拉取下一批内容。 |
| **隐藏打折的付费商品** | Hide discounted paid | 过滤并隐藏打折付费的商品（保留纯免费与 100% 折扣商品）。 |
| **隐藏所有付费商品** | Hide all paid | 强制隐藏一切非纯免费商品。 |
| **禁用图片/媒体等大资源** | Block large resources | 全面禁用图片、视频、WebGL 3D 画布及非必要字体，极大提升加载速度并节省宽带。 |
| **人机验证通知** | Verification notifications | 点击开启浏览器通知权限。当遇到平台安全验证时，弹出系统通知提醒人工处理。 |
| **调试模式** | Debug mode | 输出更详细的运行与诊断日志，便于定位边界问题。 |

---

## 遇到人机验证（CAPTCHA）的处理流程

当平台风控拦截弹出真人验证时，Fab Helper 会提供完整的安全保护：

1. **自动暂停与保留现场**：主控制台立即暂停任务派发，并在保留的验证标签页顶部显示红色横幅。
2. **桌面系统通知**：若您在设置中已开启“人机验证通知”，浏览器会弹出桌面通知，提示您有验证需要手动处理。
3. **完成验证与继续**：
   - 切换到标题带有 **`⚠️【需验证】`** 的标签页，在页面中完成人机验证勾选；
   - 验证通过后回到 Fab 搜索主页面，点击一次控制台底部的 **「一键开刷」** 即可无缝恢复全自动入库。

---

## 关联文档

- [用户使用指南](docs/USER_GUIDE.md) —— 详细了解控制台各项功能的操作方法与验证通知配置。
- [故障排查手册](docs/TROUBLESHOOTING.md) —— 常见运行问题、限速恢复与人机验证排查指南。
- [架构设计说明](docs/ARCHITECTURE.md) —— 深入了解多线程并发、入库策略、流控算法及内部设计。
- [版本更新日志](docs/CHANGELOG.md) —— 详尽的历史版本功能迭代与修复记录。
