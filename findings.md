# Findings

## 2026-05-12

- User-visible `log_unsettled_cards` means either an older installed userscript is running or the message is logged at info level. Current fix demotes it to debug and adds i18n strings.
- Owned card hiding had two separate blockers:
  - `isCardSettled()` depended on old Fab class selectors and did not recognize saved-library text in the new DOM.
  - `runHideOrShow()` returned early when any card was unsettled, blocking already-owned cards from hiding.
- DOM Refresh confirmed owned cards but only wrote to `State.db.done`; it did not immediately run hide logic. Added hide trigger when hide filters are enabled.
- `State.db.done` stored URLs, but write paths produced multiple shapes for the same listing:
  - `https://www.fab.com/zh-cn/listings/<uid>`
  - `https://www.fab.com/listings/<uid>`
  - links with query params
  This caused `已入库` to overcount. Canonicalizing to `https://www.fab.com/listings/<uid>` fixes duplicates and makes `Database.isDone()` robust.
- Additional audit finding: `Config.DB_KEYS.HIDE_PAID` was referenced but not defined, so the hidden-paid preference could persist under an undefined key. Added the key.
- Additional audit finding: `TaskRunner.stop()` deleted `Config.DB_KEYS.TASK`, but that key was not defined and no active code used it. Removed the stale delete.
- Auto-add skipped free cards because `scanAndAddTasks()` required `isCardSettled()` first, while `isCardSettled()` only recognized old free/owned classes or saved-library text. Mixed-license list cards with text like `选择许可（从 免费 到 $6.99）` were free by `isFreeCard()` but not settled, so they only retried and never queued. Fixed by treating explicit free signals as settled and scheduling retries for genuinely unsettled cards.

## 2026-04-15

- Root cause sits in `src/modules/task-runner.js` worker-detail flow.
- Current success conditions only cover:
  - API says listing is already acquired
  - UI shows owned-state text/snackbar/button
  - Script finds a license/add/checkout button and drives the purchase/free-claim flow
- External CTA listings expose an anchor like `a.fabkit-Button-root` with label `在外部网站查看` / `View on external website`.
- Those listings have no add-to-library / buy-now path, so current logic falls through to `Could not find an add button.` and reports `success: false`.
- `retryFailedTasks()` blindly requeues everything in `State.db.failed`, so these misclassified listings loop forever.
- `Database.markAsDone()` does not currently remove matching stale entries from `State.db.failed`, so old failures can linger even after later success.
- Implemented fix:
  - `TaskRunner.getExternalProductState()` now detects visible external CTA links whose hostname differs from Fab and whose label matches the external-view action.
  - Worker-detail flow treats that state as a handled success terminal state.
  - `Database.markAsDone()` now removes stale failed entries for the same UID before persisting done state.
- Mixed-license follow-up:
  - Previous dropdown logic treated plain `Personal` text as selectable, which could choose a paid personal license before a free professional one.
  - `TaskRunner.findFreeLicenseOption()` now requires an explicit free signal and prefers truly free options in the dropdown.
  - This prevents auto-selecting a paid `Personal` license when `Professional Free` is available.
