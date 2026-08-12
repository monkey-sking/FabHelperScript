# 更新日志

## 3.5.18 (2026-08-12)

### 修复（判底信号改由服务器权威：cursors.next === null 才算自动入库成功）

- **设计纠正**：「到没到底」的唯一权威信号改为服务器接口响应 `State.isEndOfSearchList`（由 `index.js` 拦截 `/i/listings/search` 写入 `cursors.next === null`），即用户口径「服务器没有新的了才算自动入库成功」。
- **移除错误的本地判据**：此前 v3.5.13 把 `physicallyStuck = 物理触底 && 连续 N 轮无增长` 当作停转依据，正是导致「滚动条在底部就提前停」的根源（Fab 为虚拟化渲染，scrollHeight / 卡片 DOM 计数等本地信号不可靠）。现一律不作为到底依据，仅保留为「继续滚动」的心跳信号。
- **成功定义收紧**：只有 `isEndOfSearchList === true`（服务器确认无更多）才视作自动入库成功并收尾；本地「连续多轮无新内容」仅作安全护栏（阈值提到 6 轮），护栏触发**不**调用 `stopExecutionAndSettle`、不宣称成功，仅停止滚动循环等待服务器信号。
- `toggleAutoScroll` 开启时重置 `isEndOfSearchList` 与 `autoScrollAttempts`，防止上一轮残留的 `true` 让本次一开就「假成功」。
- 保留 v3.5.14 修复：服务器确认到底但仍有 worker 在途 / 待办未空时，仅停滚动、不杀 worker，避免「工作标签页在完成前关闭」。
- 测试同步：`e2e-auto-scroll.mjs` 改为「末页由 mock 置 `isEndOfSearchList=true` 模拟服务器 `next=null`」驱动停止；`task-runner.test.js` 3 个用例改写为服务器驱动语义（停=isEndOfSearchList、物理触底不停、安全护栏不 settle）。单测 30/30、e2e 50/50（含 Bug B）全绿。

## 3.5.17 (2026-08-12)

### 新增功能（自动滚动独立开关，默认关）

- 此前「自动滚动页面扫描全部」与「滚动时自动添加可见任务」被 `autoAddOnScroll` 一个开关绑死，用户无法单独关掉脚本接管滚动。
- 新增独立开关 **`autoScroll`（默认关）**，专门门控「脚本自动滚动页面以扫描全部商品」（`attemptAutoScroll` 的所有触发点：executeBatch 空队列、checkVisibilityAndRefresh 隐藏完当前页、attemptAutoScroll 自循环、worker 完成空队列收尾）。
- `autoAddOnScroll` 语义收敛为「手动滚动出现新卡时自动加任务（不自动滚页）」；`autoScroll` 开启时也会一并触发扫描与启动执行，保证自动滚动能正常加任务（放开 `scanAndAddTasks` 的早退）。
- UI 设置面板新增「自动滚动页面（自动扫描全部，默认关）」开关，调用 `toggleAutoScroll`；持久化键 `fab_autoScroll_v1`，加载默认 `false`。
- 测试同步：`tests/task-runner.test.js` 中 3 个「autoAddOnScroll 触发自动滚动」用例改为用 `autoScroll`；`tests/e2e-auto-scroll.mjs` 显式 `State.autoScroll = true` 驱动自动滚动。单测 30/30、e2e 100/100（含 Bug B 到底不误杀）全绿。

## 3.5.16 (2026-08-12)

### 功能修复（调优 v3.5.15 的“底部 nudge”：上滚幅度不足，长列表仍中途卡住）

- v3.5.15 的 nudge 仅上滚半屏（≈innerH×0.5）。ego 真实登录环境实测：底部哨兵区较大时半屏上滚不足以让哨兵离开可视区，导致 24→72→96 后又卡在 96（连续 3 轮无增长即停）。
- 调优：nudge 上滚幅度提升到 **整整一屏以上（innerH×1.2）**，并确保哨兵明确离开可视区再滚回底部；两侧等待各 500ms。
- 验证：ego 真实 Fab 登录页（页面恒开在底部，最坏情况）注入 v3.5.16，自动滚动连续遍历 `72→96→120→144→168→192→216→240` 全程 `bottom=false / exec=true` 不冻结（80s 仍持续增长，仅在列表真正到底时才停）。对比 v3.5.14（同环境卡在 24）、v3.5.15（卡在 96）。

## 3.5.15 (2026-08-12)

### 功能修复（核心：滚动已到底时无限滚动加载器不重新触发，导致“入库卡在 N / 尝试 1/3 即已到达页面底部”）

- 修复 **自动滚动在页面已处于底部时提前停转（入库卡在 N，或只尝试 1 轮就「已到达页面底部」）**：
  - 根因：`doScroll` 只做向下滚动。当页面已在底部时，向下滚动无法再推进滚动位置，Fab 的无限滚动 `IntersectionObserver` 哨兵始终处于「已 intersecting」状态，不会重新触发「进入可视区」回调，下一页请求不发、`scrollHeight` 不增长；脚本在连续 3 轮无增长后误判「已到列表末尾」而停转。ego 真实登录环境实测：在底部时 `scrollBy/scrollTo` 无法推进，但**先上滚约半屏、再滚回底部**可让哨兵离开并重新进入可视区，成功触发加载器（24→72）。
  - 修复：`doScroll` 末尾新增「底部 nudge」——仅当确实已到底（`scrollY >= scrollHeight - innerHeight - 50`）时，先 `scrollTo(0, scrollY - innerH*0.5)`、再 `scrollTo(0, scrollHeight)` 各派发 scroll 事件并重试，重新触发加载器。正常分步下滚过程不受影响。
  - 验证：ego 真实 Fab 登录页注入 v3.5.15，确认在底部卡住时 nudge 能继续加载下一页；`node --test` 单测与 `e2e-auto-scroll.mjs` 回归保持通过。

## 3.5.14 (2026-08-12)

### 功能修复（核心：自动滚动“到达列表底部”误杀在途 worker，导致大量任务 `工作标签页在完成前关闭`）

- 修复 **自动滚动滚到底后，正在后台处理的入库任务几乎瞬间全部失败（`工作标签页在完成前关闭`，执行时间 0.00s）**：
  - 用户实测线索：左下角出现「已到达商品列表底部，全部商品扫描完毕」提示后，入库就中断、待入库商品没加上。该提示与误杀 worker 是**同一个动作**。
  - 根因：`attemptAutoScroll` 到达底部时调用 `stopExecutionAndSettle()`，而它内部 `closeAllWorkerTabs()` 会 `GM_deleteValue(workerId)` 并清空 `State.runningWorkers`——把**正在后台处理任务的 worker 标签页的任务数据删掉**。worker 标签页一打开就读不到自己的任务数据（`GM_getValue(workerId)` 为 null），立即 `closeWorkerTab()` 并上报 `worker_closed`（「工作标签页在完成前关闭」）。此路径在 v3.5.13 之前不暴露：旧版自动滚动在中间 N 就冻住、从未真正滚到底，故 `closeAllWorkerTabs` 不被触发；v3.5.13 让它能正常滚到底后，反而把在途 worker 全杀了。
  - 修复（两处）：
    1. `attemptAutoScroll` 到底分支改为：**若仍有 `activeWorkers > 0` 或 `todo` 未空，只停止滚动（`isAutoScrolling = false`）、保留执行与 worker，绝不调用 `stopExecutionAndSettle`**；由 worker 完成流程（index.js 1250）收尾并再次触发 `attemptAutoScroll`，届时 `todo` 空且无活跃 worker 才真正 settle。仅当 `todo` 空且无活跃 worker 时才 settle。补一发 `executeBatch` 兜底待办不被软锁。
    2. `processDetailPage` 读取任务数据加**重试**：`GM_getValue(workerId)` 初次为 null/无 task 时，间隔 400ms 重试 6 次再判定「任务数据已清理」，兜底跨标签页 GM 存储异步提交导致的瞬时读空（避免误报「工作标签页在完成前关闭」）。
  - 验证：e2e 新增「到底时有 2 个在途 worker」断言——`stopCalled=false / activeWorkers 保留 / isAutoScrolling=false`（未误杀、仅停滚动），worker 跑完后再到底 `stopCalled=true`（正常收尾）；`node --test` 30/30 + e2e 100/100 全过。`dist` 重建 v3.5.14。

## 3.5.13 (2026-08-12)

### 功能修复（核心：后端误报“无下一页”导致一滚到底就停）

- 修复 **autoAdd 自动滚动「滚到页面最底部就停、中间/顶部正常」**（对应用户实测：滚动条在底部就不行了，在中间或最上面就没问题）：
  - 根因：`attemptAutoScroll` 的 `doScroll()` 滚完会落在页面**最底部**，使 `isAtPhysicalBottom` 恒为 true；旧 `reachedBottom = (backendEnded && isAtPhysicalBottom) || physicallyStuck` 中 `backendEnded = State.isEndOfSearchList`（后端 `cursors.next === null` 快照）一旦被置 true（在「刚滚到底、下一页尚在加载中」时极易误判），一滚到底即 `reachedBottom === true` → 立刻停转。中间/顶部时 `isAtPhysicalBottom` 为 false，碰不到该条件，故正常。
  - 修复：将 `backendEnded` **彻底移出停转判定**。`reachedBottom` 现在只等于 `physicallyStuck = isAtPhysicalBottom && autoScrollAttempts >= maxScrollAttempts`——即**唯一可靠的“到底”信号是「连续多次滚动后 DOM 不再增长」**。只要 `scrollHeight` 或卡片数还在长（见 `newProcessedCount / newDomCardCount / scrollHeightGrew`），就会重置 `autoScrollAttempts` 并继续；只有连续 `maxScrollAttempts` 轮无增长、且物理触底，才视为真到底。`isEndOfSearchList` 作为单次快照信号不再参与启停决策。
  - 验证：`node --test` 30/30 通过；ego 真实 `is_free` 页注入 v3.5.13 并**强制 `isEndOfSearchList = true`（模拟后端误报）**，脚本 `attempts` 全程为 0、`已到达页面底部` 未提前出现，`total` 持续 `96→264` 穿越旧冻结点，证明后端假信号不再导致提前停转。

## 3.5.12 (2026-08-11)

### 功能修复（核心：自动滚动误判“已到页面底部”提前停）

- 修复 **autoAdd 自动滚动「已到达页面底部，停止滚动」提前收尾**（对应用户报告的“自动滚动的问题 / 入库停在 N 或 120 不动”）：
  - 根因：`attemptAutoScroll` 的 `doScroll()` 用 `window.scrollTo(0, scrollHeight)` **一把跳到页面底部**。Fab 的无限滚动加载器基于 IntersectionObserver 哨兵（或 scroll 位置监听），哨兵被一次性跳过、从未进入可视区，既不触发「进入可视区」回调，也不发起下一页请求，于是 `scrollHeight` 不增长、`newDomCardCount` 恒为 0；滚动连续 3 轮无新内容后 `physicallyStuck`（物理触底 + 3 轮无新内容）成立，脚本直接 `stopExecutionAndSettle` 并打印「已到达页面底部，停止滚动」。这正是用户日志里 `尝试 1/3 → 2/3 → 3/3 → 已到达页面底部` 的来源。
  - 修复（三处）：
    1. `doScroll()` 改为**分步下滚**（6 步 × 350ms，末段再贴底），让无限滚动哨兵从下方逐帧进入可视区，稳定触发下一页加载——回归测试已锁死「必须发出多次 `scrollBy`、而非一次跳到底」。
    2. 「还有内容」的强信号改用 **`scrollHeight` 是否增长**：只要页面被无限滚动撑高 (`currentScrollHeight > previousScrollHeight + 2`)，即便卡片/已处理计数因其它因素暂时未变，也继续滚动，不再据此误判到底。
    3. `reachedBottom` 收紧为 `(backendEnded && isAtPhysicalBottom) || physicallyStuck`——防止后端 `cursors.next` 误报 `null`（或响应结构不符被错误解析）时，在页面仍可滚动、商品未扫完的情况下提前收尾。
  - 验证：新增回归测试 `attemptAutoScroll scrolls stepwise ...`；`node --test` **30/30** 通过；`dist` 重建 v3.5.12。

## 3.5.11 (2026-08-11)

### 功能修复（核心：自动入库跑到一半停转）

- 修复 **autoAdd 自动翻页误判“已到列表末尾”而提前停转**（对应用户报告的“入库数量停在 N 不动 / 隐藏了就停在那里”）：
  - 根因：`attemptAutoScroll` 用 `getCurrentCardTotal()` 检测“滚动后是否加载到新卡片”，但它调用 `getCardCounts()` **未传 `forceRefresh`**，命中缓存。在「纯自动入库模式」下唯一的缓存刷新入口 `runHideOrShow` 不会执行，于是滚动加载出新卡后缓存 `total` 仍停在首屏值，`newDomCardCount` 恒为 0；一旦某页没有新的免费商品可加入待办（`newTodoCount`、`newProcessedCount` 也都为 0），脚本即误判到底，连点 3 次 `autoScrollAttempts` 后提前 `stopExecutionAndSettle`，表现为「已入库数量停在 24 不动」。此前 v3.5.8/v3.5.9 针对“隐藏塌陷”的修复方向有偏差——用户的真实主链路是“入库自动跑”，卡点在自动翻页的新内容检测，而非隐藏方式。
  - 修复：`getCurrentCardTotal()` 改为 `getCardCounts(true)` 强制按真实 DOM 重新计数，使 `newDomCardTotal` 能正确感知“确实加载了新卡片”，继续滚动，直到后端确认无下一页（`isEndOfSearchList`）或物理触底连续 3 轮无新内容才收尾。
  - 验证：`node --test` 29/29 通过；`dist` 重建 v3.5.11。

## 3.5.10 (2026-08-11)

### 功能修复

- 修复 **可见/隐藏计数在无限滚动加载新卡后偏差**（P2）：
  - 根因：`runHideOrShow` 仅在「隐藏模式切换（hideModeKey 变化）」时才基于真实 DOM 重算卡片计数缓存，否则沿用旧缓存；而 Fab 无限滚动加载新卡后 `document` 引用与 `href` 均不变，缓存的 `total` 停留在旧值。叠加 `adjustCardCountCacheHidden` 的 `Math.min(cache.total, …)` 钳制，让 `hidden` 不敢超过偏小的 `total`，导致「可见/隐藏」计数在长列表下持续偏低（仅 UI 数字不准，不影响翻页与终止逻辑）。
  - 修复：`runHideOrShow` 每次都按当前真实 DOM 重算 `total/hidden/visible`（`runHideOrShow` 本身已节流，性能可接受）；删除 `Math.min(cache.total, …)` 钳制，改回 `Math.max(0, hidden + delta)`，因 `total` 现已始终准确。
  - 验证：新增回归测试——模拟无限滚动加载第 3 张已隐藏卡后 `getCardCounts().total` 由 2 刷新到 3；`node --test` 29/29 通过；`dist` 重建 v3.5.10。

## 3.5.9 (2026-08-11)

### 功能修复

- 修复 **autoAdd 自动滚动在「隐藏全部可见卡片」场景下无限循环**（对应用户报告的“隐藏后滚动条在中间持续刷新出入库/隐藏”）：
  - 根因：`attemptAutoScroll` 的兜底判底条件 `physicallyStuck` 带 `!isAllHidden` 前置条件。当用户开启隐藏（如 hideSaved）且当前可见卡片全部被隐藏时 `isAllHidden=true`，`physicallyStuck` 永远为 false；而 autoAdd 分支在 `physicallyStuck` 为 false 时直接 `return` 继续滚动，**跳过了 `maxScrollAttempts` 兜底**，若后端 `isEndOfSearchList` 因响应结构不可靠则永不退出，形成无限滚动。
  - 修复：移除 `!isAllHidden` 前置条件——判底只认「物理触底 + 连续 3 轮无新内容」，与卡片是否全隐藏无关；同时清理已无引用的 `isAllHidden` 局部变量。
  - 验证：`node --test` 28/28 通过；`dist` 重建 v3.5.9。

## 3.5.8 (2026-08-11)

### 功能修复

- 修复 **隐藏商品后无限滚动卡死 / 新商品不再自动加载** 问题（P0）：
  - 根因：隐藏卡片使用 `display:none` 会把卡片移出文档流，页面高度塌陷，
    Fab 的无限滚动 IntersectionObserver sentinel 被永远留在视口内，无法触发下一页请求，
    表现为“隐藏 24 个左右就停住、不再显示新商品”。
  - 修复：隐藏改为 `visibility:hidden`（保留文档流占位，`pointer-events`/`user-select` 禁用以防误触），
    页面高度不变，sentinel 始终位于视口外，翻页照常进行。
  - `isCardHidden` 改为仅以 `data-fab-hidden` 属性判定，避免与“已处理且已隐藏”的稳定态判断冲突。
  - `runHideOrShow` 的 `minHeight:120vh` 仅作为兜底安全网作用于最外层可滚动容器
    （`main` / `#main` / `.AssetGrid-root` / `.fabkit-responsive-grid-container`），
    不再下探 Fab 嵌套的 flex/transform 包裹层，避免把不该撑高的内层顶高。
  - 删除 `attemptAutoScroll` 中“临时把隐藏卡片恢复成 `display:none` 再滚动”的 hack：
    该做法会在滚动过程中反复切换 `display`，造成布局抖动，并引发“滚动条在中间就持续刷新入库/隐藏”的错觉；
    `visibility:hidden` 下页面高度天然稳定，直接滚动到底即可触发加载。

### 验证

- 更新 5 处隐藏断言（`display==='none'` → `visibility==='hidden'`），`node --test tests/task-runner.test.js` 全部 26 项通过。

### 已知权衡

- 采用 `visibility:hidden` 后，已隐藏商品会在原位置**保留空白占位**（不再完全折叠）。这是修复无限滚动冻结必须付出的代价；
  若追求完全紧凑可改回 `display:none` + 仅靠 `minHeight` 撑高，但该方案在 Fab 嵌套 loader 布局上历史验证不够稳，本次未采用。

> **ego 实测更正**：经 ego 浏览器在真实 Fab 页面验证，Fab 当前为固定容器高度的虚拟化/窗口化渲染，单卡隐藏 `visibility` 与 `display` 两种方式均不改变页面总高度（塌陷量均为 0），且搜索页未暴露无限滚动 sentinel 元素。因此「`display:none` 塌陷卡住 sentinel 导致翻页停滞」的假设在 Fab 现架构下**不成立**。本改动定位为**防御性加固**（保留占位、绝不劣于 `display:none`、在非虚拟化视图下仍防塌陷），真正修复 autoAdd 卡死的是 **3.5.9** 的终止逻辑修正。

## 3.5.2 (2026-05-12)

### 功能修复

- 修复 **免费商品不会自动进队列** 问题：
  - 未加载完成的卡片会触发自动添加重试，不再一次扫描错过后就停住
  - 支持列表页“选择许可（从 免费 到 $6.99）”等混合许可免费信号自动入队
- 修复 **自动入库完成后卡片不隐藏** 问题：
  - 已入库的本地记录可直接驱动隐藏，不再等待列表页原生状态文案刷新
  - 统一本会话完成记录的 URL 格式，避免中文路径和 canonical 路径不一致
- 修复 **已入库计数不准确** 问题：
  - 统一按 listing UID 归一化 `done` URL，避免不同语言路径、绝对/相对路径、query 参数造成重复计数
  - 启动时自动清理旧的重复 `done` 记录并保存
  - 待办自动清理、DOM Refresh、任务完成写入统一使用 `Database.isDone()` / `Database.addDoneUrl()`
- 修复 **已拥有卡片不自动隐藏** 问题：
  - 支持通过“已保存在我的库中 / Saved in My Library / 在我的库中 / In My Library”文案识别已拥有卡片
  - DOM Refresh 确认新拥有项目后立即触发隐藏
  - 未加载完成卡片只安排后台重试，不再阻塞其它卡片隐藏
- 修复 **日志异常** 问题：
  - `log_unsettled_cards` 不再作为普通日志刷屏
  - 补齐中英文翻译，避免显示裸 key
- 修复 **隐藏付费设置持久化** 问题：
  - 新增 `HIDE_PAID` 存储 key
  - 清理停止任务时对废弃 `TASK` key 的调用

### 验证

- 新增并通过 10 个 targeted regression tests
- 通过本地构建，生成 `dist/fab_helper.user.js`

## 3.5.1 (2025-12-28)

### 功能修复

- 修复 **待办数量翻倍** 问题：
  - 在 `scanAndAddTasks` 中添加严格的 uid/url 去重检查
  - 添加 `isScanningTasks` 扫描锁，防止并发调用导致重复添加
- 修复 **入库操作立即关闭** 问题：
  - 增强工作标签页页面就绪检测机制（最长 15 秒等待）
  - 使用多重检测（DOM 元素、readyState、交互内容）确保页面完全加载后再执行
- 修复 **按钮检测失败** 问题：
  - 使用大小写不敏感匹配，兼容 "Add to My Library" 等变体
  - 添加备用方案：检测包含 "add" + "library" 或 "添加" + "库" 的按钮
  - 记录所有可见按钮文本用于调试
- 增强 **失败任务日志记录**：`markAsFailed` 方法现在支持记录详细的失败信息，包括：
  - 失败原因和时间戳
  - 错误详情（执行时间、workerId、instanceId）
  - 工作线程日志（最后 5 条）
  - 重试次数

### 代码优化

- Watchdog 超时处理现在使用增强的 `markAsFailed` 记录超时详情
- 添加去重日志输出，便于调试重复添加问题

## 3.5.0 (2025-12-27)

### 重构

- **模块化架构**：将单文件脚本重构为 15+ 个功能模块，提高代码可维护性
- **构建系统**：引入 `esbuild` 进行代码打包和优化
- **项目整理**：归档旧版本文件，清理项目结构

### 国际化

- **英文文档**：新增 `README_EN.md`，支持多语言文档索引

### 功能修复

- 修复 **UI 不显示** 的问题 (`State.UI` 对象缺失)
- 修复 **计数异常** 问题 (`Database` 模块计数逻辑优化)
- 修复 **Launcher 无限循环** 问题 (增加错误处理)

## 3.2.2 (2025-07-23)

### 功能优化

- 改进自动刷新判断逻辑，使用UI上显示的可见商品数量作为依据，更准确地反映实际情况
- 优化页面刷新方式，确保刷新后UI能正确重新加载
- 添加UI自动恢复机制，解决长时间无操作后UI消失的问题
- 修改脚本加载时机为document-idle，确保页面完全加载后再执行

### 功能修复

- 修复限速状态下隐藏所有商品后可能不刷新的问题
- 修复刷新后脚本UI可能不显示的问题
- 修复标签页切换后UI可能丢失的问题

## 3.2.1 (2025-07-23)

### 代码优化

- 精简调试相关代码，减少不必要的日志输出
- 优化缓存清理逻辑，提高代码复用性
- 改进错误处理和日志格式，更易于阅读
- 移除未使用的过时函数
- 简化网络请求监控逻辑
- 修正控制台输出格式，减少调试信息

### 功能修复

- 修复限速状态下隐藏所有商品后不自动刷新的问题
- 改进限速状态检测逻辑，在无可见商品时主动刷新
- 优化隐藏/显示功能，更准确地计算可见商品数量
- 减少限速状态下的自动刷新等待时间

## 3.2.0 (2023-07-23)

### 优化更新

- 新增数据缓存系统，减少重复API请求
- 添加请求拦截器，自动缓存网页发送的API响应
- 优化商品拥有状态检查，减少API请求次数
- 优化价格验证功能，利用缓存减少API请求
- 改进限速状态检测，使用Performance API提前发现问题
- 优化倒计时刷新功能，更智能地检测限速状态恢复
- 修复API返回数据格式不一致的问题
- 增强对网页排序选项的适配能力

## 3.1.0 (2023-07-22)

### 新功能

- 添加聊天记录导出功能
- 实现脚本热更新功能
- 增加用户界面配置选项

### 改进

- 优化限速检测算法，减少误判
- 改进游标恢复精确度
- 提高 DOM 观察器效率

### 修复

- 修复多个游标格式识别问题
- 解决部分页面上 UI 元素未正确显示的问题
- 修复连续触发限速恢复的逻辑错误

## [1.0.0] - 2023-XX-XX

### 首次发布

- 实现限速检测和自动恢复
- 请求去抖动和节流功能
- 游标位置保存和恢复
- DOM 观察和增强
- 基础日志记录系统

## 版本号规范

Fab Helper 脚本遵循 [语义化版本控制](https://semver.org/lang/zh-CN/) 规范：

- **主版本号**：当进行不兼容的 API 更改时增加
- **次版本号**：当添加向后兼容的新功能时增加
- **修订号**：当进行向后兼容的问题修复时增加

额外的标签：

- **alpha**：早期测试版本，功能不完整
- **beta**：功能完整但可能不稳定
- **rc**：候选发布版本，即将正式发布

例如：

- 1.0.0-alpha.1
- 1.0.0-beta.2
- 1.0.0-rc.1
- 1.0.0
