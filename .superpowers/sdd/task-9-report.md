# Task 9: DOKU Reconciliation Scheduler

## Summary

Added scheduled DOKU payment reconciliation using canonical transition, backoff, terminal stopping, and 404/5xx/timeout classification.

## Files Created

- `app/Services/DokuReconciliationService.php` — `reconcile(PaymentAttempt): TransitionResult` wrapper delegating to `DokuService::reconcilePaymentAttempt`; skips non-pending/unknown attempts, respects `next_reconciliation_at` and `reconciliation_attempts >= 5` cap.
- `app/Console/Commands/ReconcileDokuPayments.php` — `payments:reconcile-doku` artisan command; queries pending/unknown attempts with past/null `next_reconciliation_at`, dispatches `ReconcileDokuPayment` job per attempt.
- `app/Jobs/ReconcileDokuPayment.php` — queued job (single try); resolves `PaymentAttempt` by ID, calls `DokuReconciliationService::reconcile`.

## Files Modified

- `routes/console.php` — schedules `payments:reconcile-doku` every minute with `withoutOverlapping()` and `onOneServer()`.

## Test Results

- **14 tests, 24 assertions, all passing** in `tests/Feature/DokuReconciliationTest.php`
- Coverage: pending/unknown selection, SUCCESS resolution, 5xx backoff, timeout backoff, 404 termination, max attempts cap, future `next_reconciliation_at` skip, command dispatch filtering, job integration, concurrent webhook idempotency.

## Design Decisions

- **No duplicate transition logic**: `DokuReconciliationService` delegates to existing `DokuService::reconcilePaymentAttempt` (Task 8). The service only adds selection filtering and `TransitionResult` wrapping.
- **Backoff managed by existing service**: `DokuService::reconcilePaymentAttempt` already sets `next_reconciliation_at` with exponential backoff (2^n min, max 16). The command queries only attempts with past/null `next_reconciliation_at`.
- **Terminal stopping**: 5 max attempts or 404 from DOKU both terminate via existing logic. Service returns `TransitionResult(false)` for already-terminal attempts.
- **Job is single-try**: Scheduler re-dispatches; no Laravel retry layer needed since backoff is data-driven via `next_reconciliation_at`.