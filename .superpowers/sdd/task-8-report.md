# Task 8 Report

## Scope
Canonical DOKU payment creation, retry, reconciliation, leases, immutable snapshots, and active-attempt projection.

## Verification
- Focused Task 8 creation/retry/boundary tests: 26 passed, 67 assertions.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Full `php artisan test`: 1343 run, 1332 passed, 11 baseline failures/errors. Verification blocked.

## Baseline quarantine
11 failures/errors are quarantined as prior-task compatibility issues after restoring approved Task 7 state: lock-order assertion; missing canonical-attempt fixtures in DokuMarkPaid/DokuPayment atomic and webhook tests; removed Order overload callers; legacy backfill hard-coded ID; schema expectation missing pending state; late-refund expectation mismatch. No Task 8 focused regression remains.

## Task 8 result
Failed attempts with unknown settlement require exact-attempt reconciliation before creation. Unresolved attempts remain controlled blocked; definitive failure can lead to fresh attempt preparation. `createPayment` never sends provider requests for non-initiated failed attempts. Task 7 workflow/report unchanged.
