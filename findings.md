# Findings

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
