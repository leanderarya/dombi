# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Production-driver race test now executes reconciliation and webhook in separate `pcntl_fork` children against MySQL/PostgreSQL, with independent DB connections.
- Race test asserts exactly one DOKU status request, one transition outcome, one no-op outcome, paid final state, and successful exit status for every child.
- CI gate is mandatory: CI fails when `RUN_PRODUCTION_DRIVER_TESTS=true`, MySQL/PostgreSQL, or `pcntl` is unavailable. Local runs explicitly skip only when gate prerequisites are unavailable.
- Sequential tests are not used as substitute for concurrency coverage.

## Verification

- `composer run lint:check -- --dirty`: passed (`pint --parallel --test '--dirty'`, Pint passed).
- `php artisan test tests/Feature/DokuReconciliationTest.php`: 24 passed, 1 skipped, 54 assertions.
- Local skip is explicit because production race gate is unavailable in local environment.

## Scope

Task 9 files only.