# Task 14 Verification Report

Date: 2026-08-24

## Scope

Payment observability registry, fixed nullable event schema, safe allowlisted labels, migration parity/cutover verification, production matrix coverage, and production design gate documentation. Frontend and unrelated pre-existing work were not modified.

## Commands and Results

| Command | Result |
|---|---|
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php` | PASS: 4 tests, 4 passed, 9 assertions (initial RED/GREEN cycle) |
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php tests/Feature/PaymentProductionInvariantTest.php` | PASS: 15 tests, 15 passed, 34 assertions |
| `vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/DokuService.php app/Services/DokuWebhookIngressService.php app/Services/PaymentObservabilityService.php app/Jobs/ReconcileDokuPayment.php app/Console/Commands/VerifyPaymentCutover.php tests/Feature/PaymentProductionMatrixTest.php` | PASS |
| `php artisan migrate:fresh --seed` | PASS: migrations and seeders completed |
| `php artisan payments:verify-cutover` | FAIL: `legacy payment writes are enabled`; non-zero exit blocks cutover |
| `php artisan payments:backfill-attempts --dry-run` | BLOCKED: command does not define `--dry-run` |
| `php artisan payments:reconcile-doku --dry-run` | BLOCKED: command does not define `--dry-run` |
| `php artisan test` | BLOCKED baseline: 1,429 tests, 1,413 passed, 15 failures, 1 skipped; failures include unrelated refund/order/frontend/stock tests and existing backfill fixture drift |
| `graphify update .` | PASS: graph rebuilt; 7,269 nodes, 18,557 edges, 515 communities; aggregated HTML generated |

## Cutover Gate

Run `php artisan payments:verify-cutover` after backfill and refund-obligation parity. Non-zero exit is NO-GO. Only after zero missing, duplicate, invoice/order/amount/currency/status mismatches and legacy writes are disabled may read-only cutover proceed.

## Baseline Truth

Full suite is not green in current repository baseline. Failures include `DokuMarkPaidCommandTest`, `ManualRefundTriggerTest`, `OwnerRefundWorkspaceTest`, and other unrelated existing tests. Task 14 does not claim full-suite success. Dry-run verification requested by brief is unavailable until command signatures support `--dry-run`.
