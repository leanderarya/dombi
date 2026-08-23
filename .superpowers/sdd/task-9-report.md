# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Command now selects only attempts with eligible creation states (`pending|unknown`) and unresolved settlement state (`NULL|pending|unknown`), excluding finalized jobs.
- Pending reconciliation persistence re-checks locked canonical creation/settlement eligibility before updating; finalized attempts preserve state, clear lease, and never downgrade paid/failed/expired.
- Added regressions for finalized command filtering and pending-result preservation.
- Existing 404 preservation, deleted-attempt no-op, bounded dispatch, job guards, canonical transition integration, scheduler, and production-driver race coverage retained.

## Verification

- `php artisan test tests/Feature/DokuReconciliationTest.php`: 24 passed, 1 skipped, 54 assertions.
- `composer run lint:check -- --dirty`: passed (`pint --parallel --test '--dirty'`, Pint passed).

## Scope

Task 9 files only, with required DOKU reconciliation implementation correction in `app/Services/DokuService.php`.