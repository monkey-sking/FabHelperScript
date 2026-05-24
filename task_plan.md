# Task Plan

## Goal
修复并验证 Fab Helper 在“滚动时自动添加任务”开启时，当前队列跑完后不会继续推进瀑布流的问题：
1. 当前待办队列和 worker 都清空后，应自动向下推进列表，触发 Fab 加载更多卡片。
2. 新卡片加载后复用现有扫描逻辑加入任务并继续执行。
3. 到达底部或连续没有新增内容时应停止尝试，避免无限滚动。

## Workstream
- Name: `fix/auto-scroll-resume`
- Risk: Medium
- Validation target: source-reviewed + targeted automated test + local build

## Baseline
- Base branch: `main`
- Environment assumptions: default conversation; avoid macOS signing/install/runtime-permission side effects
- Ownership:
  - In scope: `src/modules/task-runner.js`, `src/state.js`, targeted tests
  - Out of scope: release packaging, browser automation, detail-page acquisition logic, installed userscript/runtime permission changes

## Phases
- [completed] Root-cause analysis for queue-complete stop behavior
- [completed] Add regression coverage for idle auto-scroll scheduling
- [completed] Implement idle auto-scroll and scan continuation
- [completed] Run targeted test and build verification

## Decision Log
- 2026-04-15: Treat "View on external website" listings as successfully handled rather than failed, because they are not purchasable Fab listings and retrying them is wasted work.
- 2026-04-15: For mixed-license listings, only explicit free options should be auto-selected; plain `Personal` text is not sufficient evidence of a free license.
- 2026-05-12: Count `done` entries by canonical listing UID, not raw URL string, because Fab pages produce localized/absolute/query URL variants for the same listing.
- 2026-05-12: Keep unsettled-card messages at debug level; they are diagnostic retries, not user-actionable status.
- 2026-05-24: Treat queue completion as a temporary idle state when auto-add is enabled; the script should try to advance the list before fully settling.

## Errors Encountered
- External CTA test initially failed because helper assumed `window.location` existed in the test environment; resolved by adding a safe fallback origin for URL comparison.
- `done URLs are normalized...` regression failed before implementation; resolved by centralizing `Database.normalizeListingUrl()` / `Database.addDoneUrl()`.
