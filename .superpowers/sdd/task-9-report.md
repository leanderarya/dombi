# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Added bounded command dispatch with `--limit` override and `doku.reconciliation_batch_limit` default (100), ordered by attempt ID.
- Oversized operator `--limit` is clamped to configured maximum; coverage added.
- Job checks attempt existence, pending/unknown creation state, retry cap, and due `next_reconciliation_at` before calling service.
- `DokuReconciliationService::reconcile` safely returns unchanged `TransitionResult` when `fresh()` finds a deleted attempt.
- Added job eligibility and deleted-attempt tests.
- Added integration assertion that successful reconciliation creates `NormalizedPaymentEvent` with `source=doku-reconciliation` and routes through `CanonicalPaymentTransitionService`, matching webhook architecture.
- Production-driver test races reconciliation against real webhook ingress, gated by `RUN_PRODUCTION_DRIVER_TESTS=true`; asserts one DOKU status request, one paid transition, and successful exit status for every child after `pcntl_waitpid`. Local environments skip only when gate, production DB driver, or `pcntl` is unavailable.

## Verification

- `php artisan test tests/Feature/DokuReconciliationTest.php`: 20 passing, 1 explicit local skip.
- `composer run lint:check -- --dirty`: pending final run.

## Scope

Task 9 files only.