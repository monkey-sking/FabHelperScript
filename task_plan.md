# Task Plan

## Goal
修复两类 Fab 特殊商品的任务处理逻辑：
1. 外链型商品：详情页只有“在外部网站查看”这类 CTA、没有价格且不可购买时，将任务判定为已成功处理，不再进入失败重试循环。
2. 混合许可商品：当 `Personal` 收费但 `Professional` 免费时，详情页必须选中免费的许可，而不是误点收费的 `Personal`。

## Workstream
- Name: `fix/special-listing-terminal-states`
- Risk: Medium
- Validation target: source-reviewed + targeted automated test + local build

## Baseline
- Base branch: unknown (working tree not yet inspected for branch metadata)
- Environment assumptions: default conversation; avoid macOS signing/install/runtime-permission side effects
- Ownership:
  - In scope: `src/modules/task-runner.js`, `src/modules/database.js`, minimal test scaffolding if needed
  - Out of scope: release packaging, browser automation against installed app identities, unrelated queue logic

## Phases
- [completed] Root-cause analysis
- [completed] Add regression test covering external CTA listing
- [completed] Implement success-path handling for external CTA detail pages
- [completed] Ensure prior failed records are cleared when task later succeeds
- [completed] Add regression test covering mixed-license free selection
- [completed] Implement robust free-license selection for mixed-license listings
- [completed] Run safe verification (`node --test`, local build)

## Decision Log
- 2026-04-15: Treat "View on external website" listings as successfully handled rather than failed, because they are not purchasable Fab listings and retrying them is wasted work.
- 2026-04-15: For mixed-license listings, only explicit free options should be auto-selected; plain `Personal` text is not sufficient evidence of a free license.

## Errors Encountered
- External CTA test initially failed because helper assumed `window.location` existed in the test environment; resolved by adding a safe fallback origin for URL comparison.
