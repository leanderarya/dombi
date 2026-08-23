# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Reconciliation claim transaction now re-checks locked attempt eligibility after concurrent webhook/transition: creation state must be `pending|unknown` and settlement state, when present, must be `pending|unknown`.
- Finalized attempts return no-op before any DOKU status request.
- Added regression asserting finalized settlement skips DOKU request and returns unchanged result.
- Existing 404 preservation, deleted-attempt no-op, bounded dispatch, job guards, canonical transition integration, scheduler, and production-driver race coverage retained.

## Verification

- `php artisan test tests/Feature/DokuReconciliationTest.php`: 21 passed, 1 skipped, 47 assertions.
- `composer run lint:check -- --dirty`: passed.

## Scope

Task 9 files only, with required DOKU reconciliation implementation correction in `app/Services/DokuService.php`.