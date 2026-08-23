# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Added bounded command dispatch with `--limit` override and `doku.reconciliation_batch_limit` default (100), ordered by attempt ID.
- Added command test proving only configured batch size dispatches.
- Job now checks attempt existence, pending/unknown creation state, retry cap, and due `next_reconciliation_at` before calling service.
- Added job eligibility guard test.
- Added integration assertion that successful reconciliation creates `NormalizedPaymentEvent` with `source=doku-reconciliation` and routes through `CanonicalPaymentTransitionService`, matching webhook architecture.
- Expanded production-driver test to race reconciliation against real webhook ingress, gated by `RUN_PRODUCTION_DRIVER_TESTS=true`; asserts one DOKU status request and one paid transition. Local environments skip only when gate, production DB driver, or `pcntl` is unavailable.

## Verification

- `php artisan test tests/Feature/DokuReconciliationTest.php`: 18 passing, 1 explicit local skip.
- `composer run lint:check -- --dirty`: passed.

## Scope

Task 9 files only, plus existing Task 8 `DokuService.php` backoff correction remains in prior commit.