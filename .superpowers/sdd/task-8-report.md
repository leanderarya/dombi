# Task 8 Report

## Scope
Harden canonical DOKU payment creation, retry, reconciliation, leases, snapshots, and active-attempt projection.

## Verification
- Focused Task 8 creation/retry/boundary tests: 24 passed, 62 assertions.
- `php artisan test`: 1343 run, 1332 passed, 11 baseline failures/errors. Verification blocked.
- Baseline failures/errors are prior-task compatibility issues after restoring approved Task 7 state: lock-order assertion; missing canonical-attempt fixtures in DokuMarkPaid/DokuPayment atomic and webhook tests; removed Order overload callers; legacy backfill hard-coded ID; schema expectation missing pending state; late-refund expectation mismatch.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Retry resolves prior failed/unknown attempt identity before fresh preparation, allowing late success reconciliation without replacing evidence.
- Max-attempt cap is checked before fresh preparation while active attempts remain reusable.

## Task 8 result
PENDING reconciliation persists `creation_state=pending`, preserves pending settlement projection, and clears reconciliation lease. No Task 7 workflow/report changes included.
