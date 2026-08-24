# Task 14 Verification Report

Date: 2026-08-24

## Scope

Payment observability registry, fixed nullable event schema, safe allowlisted labels, migration parity/cutover verification, production matrix coverage, and production design gate documentation. Frontend and unrelated pre-existing work were not modified.

## Commands and Results

| Command | Result |
|---|---|
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php tests/Feature/PaymentProductionInvariantTest.php` | PASS: 20 tests, 20 passed, 45 assertions; Task 14 matrix still PARTIAL/BLOCKED, not production-ready |
| `vendor/bin/pint --test Task 14 files` | PASS |
| `php artisan migrate:fresh --seed` | PASS |
| `php artisan payments:verify-cutover` | BLOCKED: legacy writes enabled/parity gate; default `config('doku.legacy_writes_enabled')=false`, production must explicitly verify false. Refund parity covers count/status/reason/amount/destination/proof/reference |
| `php artisan payments:backfill-attempts --dry-run` | PASS: `Payment attempt backfill complete.` / `Exceptions: 0`; no DB or storage writes; exception cases print stdout and return nonzero |
| `php artisan payments:reconcile-doku --dry-run` | PASS: `No DOKU payments to reconcile.`; no dispatch |
| `php artisan test` | SERIAL BLOCKER: 1,437 tests, 1,418 passed, 18 failures, 1 skipped. Exact blocker names listed below; no production-ready claim |
| `graphify update .` | PASS: 7,276 nodes, 18,576 edges, 489 communities |

Task 14 status: BLOCKED. Full serial suite failures are release blockers. Production readiness is not claimed.

## Cutover Gate

Run `php artisan payments:verify-cutover` after backfill and refund-obligation parity. Non-zero exit is NO-GO. Only after zero missing, duplicate, invoice/order/amount/currency/status mismatches and legacy writes are disabled may read-only cutover proceed.

## Baseline Truth

Full suite is not green in current repository baseline. Failures include `DokuMarkPaidCommandTest`, `ManualRefundTriggerTest`, `OwnerRefundWorkspaceTest`, and other unrelated existing tests. Task 14 does not claim full-suite success. Dry-run verification requested by brief is unavailable until command signatures support `--dry-run`.
