# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Command now excludes attempts with `metadata.reconciliation_attempts >= 5`.
- First retry backoff corrected to exactly 2 minutes after post-claim count becomes 1; subsequent delays remain exponential, capped at 16 minutes.
- Frozen-time tests assert exact `next_reconciliation_at` and post-claim count for both 5xx and timeout paths.
- Added scheduler assertions for every-minute cadence, `withoutOverlapping()`, and `onOneServer()`.
- Added command cap-filter coverage for attempts at counts 5 and 6.
- Added explicit `RUN_PRODUCTION_DRIVER_TESTS=true` CI-gated production-driver contention test requiring MySQL/PostgreSQL and `pcntl`; it asserts one status request and paid transition after concurrent lease contention.

## Verification

- `php artisan test tests/Feature/DokuReconciliationTest.php`: 15 passing, 1 explicitly skipped production-driver test in local environment.
- `composer run lint:check -- --dirty`: passed.

## Scope

Task 9 files only, plus required correction in `app/Services/DokuService.php` for documented backoff calculation.