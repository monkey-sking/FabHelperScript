# Task Plan

## Goal
修复并验证 Fab Helper 近期“已拥有隐藏 / 已入库计数 / 日志噪声 / 更新日志”问题：
1. 已拥有卡片应在任务完成或 DOM Refresh 确认后自动隐藏。
2. 已入库计数应按 listing UID 去重，避免语言路径和 query 造成重复计数。
3. 未加载卡片日志不应刷屏或显示裸 key。
4. 更新日志应记录本轮修复，便于用户更新后核对。

## Workstream
- Name: `fix/owned-hide-count-regressions`
- Risk: Medium
- Validation target: source-reviewed + targeted automated test + local build

## Baseline
- Base branch: `main`
- Environment assumptions: default conversation; avoid macOS signing/install/runtime-permission side effects
- Ownership:
  - In scope: `src/modules/task-runner.js`, `src/modules/database.js`, `src/config.js`, `src/index.js`, changelog files, targeted tests
  - Out of scope: release packaging, browser automation against installed app identities, unrelated queue logic

## Phases
- [completed] Root-cause analysis for repeated `log_unsettled_cards`
- [completed] Fix owned-card text detection and retry coalescing
- [completed] Fix DOM Refresh to trigger hiding after confirmed owned state
- [completed] Normalize done URLs by listing UID to repair已入库计数
- [completed] Audit related storage keys and fix missing `HIDE_PAID`
- [completed] Update changelog and final verification

## Decision Log
- 2026-04-15: Treat "View on external website" listings as successfully handled rather than failed, because they are not purchasable Fab listings and retrying them is wasted work.
- 2026-04-15: For mixed-license listings, only explicit free options should be auto-selected; plain `Personal` text is not sufficient evidence of a free license.
- 2026-05-12: Count `done` entries by canonical listing UID, not raw URL string, because Fab pages produce localized/absolute/query URL variants for the same listing.
- 2026-05-12: Keep unsettled-card messages at debug level; they are diagnostic retries, not user-actionable status.

## Errors Encountered
- External CTA test initially failed because helper assumed `window.location` existed in the test environment; resolved by adding a safe fallback origin for URL comparison.
- `done URLs are normalized...` regression failed before implementation; resolved by centralizing `Database.normalizeListingUrl()` / `Database.addDoneUrl()`.
