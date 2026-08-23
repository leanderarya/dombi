# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- DOKU status 404 now preserves unresolved creation state (`pending` remains `pending`, `unknown` remains `unknown`), records `last_reconciliation_status=404`, `last_reconciliation_error=invoice_not_found`, raw evidence, and schedules bounded retry using normal backoff.
- 404 no longer applies terminal FAILED canonical transition.
- Deleted `PaymentAttempt` is a no-op `TransitionResult(false)` after preflight refresh, after service claim/failure exceptions, and after final refresh.
- Existing bounded command, job eligibility, canonical normalized-event integration, scheduler, and production-driver race coverage retained.

## Verification

- `php artisan test tests/Feature/DokuReconciliationTest.php`: 20 passed, 1 skipped, 45 assertions.
- `composer run lint:check -- --dirty`: run below; must pass before commit.

## Scope

Task 9 files only, with required existing DOKU reconciliation implementation correction in `app/Services/DokuService.php`.