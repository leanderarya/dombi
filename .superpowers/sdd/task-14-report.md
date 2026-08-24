# Task 14 Verification Report

Date: 2026-08-24

## Scope

Payment observability registry, fixed nullable event schema, safe allowlisted labels, migration parity/cutover verification, production matrix coverage, and production design gate documentation. Frontend and unrelated pre-existing work were not modified.

## Commands and Results

| Command | Result |
|---|---|
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php tests/Feature/PaymentProductionInvariantTest.php` | PASS: 19 tests, 19 passed, 44 assertions; matrix explicitly PARTIAL. Executable assertions cover happy/order, concurrency/duplicate success, failure/security, recovery/retry, late/refund, amount, regression, unknown status, pending age, reconciliation failure contract, and needs-review contract |
| `vendor/bin/pint --test app/Console/Commands/BackfillPaymentAttempts.php app/Console/Commands/ReconcileDokuPayments.php app/Services/CanonicalPaymentTransitionService.php app/Services/DokuService.php app/Services/DokuWebhookIngressService.php app/Services/PaymentObservabilityService.php app/Jobs/ReconcileDokuPayment.php app/Console/Commands/VerifyPaymentCutover.php routes/console.php tests/Feature/PaymentProductionMatrixTest.php` | PASS |
| `php artisan migrate:fresh --seed` | PASS: migrations and seeders completed |
| `php artisan payments:verify-cutover` | BLOCKED: `legacy payment writes are enabled`; `config('doku.legacy_writes_enabled')` resolves true from configured default; parity checks attempt/order/invoice/currency/amount/status/gateway identity and refund obligations |
| `php artisan payments:backfill-attempts --dry-run` | PASS: `Payment attempt backfill complete. Exceptions: 0`; report-only, no rows written |
| `php artisan payments:reconcile-doku --dry-run` | PASS: `No DOKU payments to reconcile.`; report-only, no jobs dispatched |
| `php artisan test` | SERIAL final result: 1,436 tests, 1,420 passed, 15 failures, 1 skipped. Failures are baseline refund/order/owner workspace/stock/backfill issues; no parallel DB commands used |
| `graphify update .` | PASS: graph rebuilt; 7,274 nodes, 18,573 edges, 486 communities; aggregated HTML generated |

## Cutover Gate

Run `php artisan payments:verify-cutover` after backfill and refund-obligation parity. Non-zero exit is NO-GO. Only after zero missing, duplicate, invoice/order/amount/currency/status mismatches and legacy writes are disabled may read-only cutover proceed.

## Baseline Truth

Full suite is not green in current repository baseline. Failures include `DokuMarkPaidCommandTest`, `ManualRefundTriggerTest`, `OwnerRefundWorkspaceTest`, and other unrelated existing tests. Task 14 does not claim full-suite success. Dry-run verification requested by brief is unavailable until command signatures support `--dry-run`.
