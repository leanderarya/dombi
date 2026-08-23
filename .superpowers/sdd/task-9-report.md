# Task 9: DOKU Reconciliation Scheduler

## Findings Fixed

- Reconciliation error/timeout persistence now locks the attempt and re-checks unresolved eligibility before writing unknown/backoff.
- If webhook/concurrent processing finalized the attempt, failure handling clears reconciliation lease and preserves finalized creation/settlement state without overwriting retry metadata.
- Deleted attempts after claim/failure are handled as safe no-op results through reconciliation service exception handling; no return-type violation or crash.
- Added regression for finalized-state error handling and retained finalized claim no-DOKU regression.

## Verification

- `php artisan test tests/Feature/DokuReconciliationTest.php`: 22 passed, 1 skipped, 49 assertions.
- `composer run lint:check -- --dirty`: pending final run.

## Scope

Task 9 files only, with required DOKU reconciliation implementation correction in `app/Services/DokuService.php`.