# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Production-driver race test executes reconciliation and webhook in separate `pcntl_fork` children against MySQL/PostgreSQL, with independent DB connections.
- Each worker now reports explicit persisted domain outcome: reconciliation `TransitionResult.changed`, or webhook canonical `status_version` delta (`transition` vs `noop`). HTTP status is not used to classify domain outcome.
- Race test asserts exactly one applied transition, one no-op/ignored result, one DOKU status request, final paid state, and successful exit status for every child.
- CI gate is mandatory: CI fails when production race prerequisites are unavailable. Local runs explicitly skip only when gate prerequisites are unavailable.

## Verification

- `composer run lint:check -- --dirty`: passed (`pint --parallel --test '--dirty'`, Pint passed).
- `php artisan test tests/Feature/DokuReconciliationTest.php`: 24 passed, 1 skipped, 54 assertions.
- Local skip is explicit because production race gate is unavailable in local environment.

## Scope

Task 9 files only.