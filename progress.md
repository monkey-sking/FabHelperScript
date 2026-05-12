# Progress

## 2026-05-12

- Investigated repeated `log_unsettled_cards` and owned-card hiding reports.
- Added regression coverage for retry coalescing, saved-library text detection, mixed settled/unsettled card lists, and DOM Refresh hide triggering.
- Implemented canonical done URL handling and added regression coverage for localized/query URL variants.
- Rebuilt and pushed fixes through commits:
  - `714c84f` Fix owned card hiding detection
  - `0e4ed0d` Avoid blocking hide on loading cards
  - `ab668e1` Hide cards after ownership refresh
  - `4c4b1df` Normalize done listing URLs
- Audited adjacent persistence keys; found and fixed missing `HIDE_PAID` key and stale `TASK` delete call.
- Updated root and docs changelogs with 3.5.2 notes.
- Bumped package version to 3.5.2 and rebuilt dist so the userscript header matches the changelog.
- Investigated free cards not auto-queuing; added retry coverage for unsettled auto-add cards and mixed-license free list cards, then fixed `isCardSettled()` / auto-add retry behavior.

## 2026-04-15

- Initialized planning files for `fix/marketplace-external-cta`.
- Inspected task execution flow, ownership detection, retry behavior, and failure persistence.
- Confirmed root cause: external CTA listings are not recognized as a handled terminal state.
- Added regression tests for external CTA handling and stale failed-record cleanup.
- Implemented external CTA success-path detection and failed-record cleanup on success.
- Verified with `node --test tests/task-runner.test.js` and `npm run build`.
- Added a regression test for mixed-license listings where `Personal` is paid and `Professional` is free.
- Updated license selection to choose only explicit free options instead of matching plain `Personal`.
- Re-verified with `node --test tests/task-runner.test.js` and `npm run build`.
