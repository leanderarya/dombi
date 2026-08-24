# Task 14 Verification Report

Date: 2026-08-24

## Scope

Payment observability registry, fixed nullable event schema, safe allowlisted labels, migration parity/cutover verification, production matrix coverage, and production design gate documentation. Frontend and unrelated pre-existing work were not modified.

## Commands and Results

| Command | Result |
|---|---|
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php` | PASS: 8 tests, 8 passed, 19 assertions; matrix remains PARTIAL, with executable coverage for happy, ordering/projection, duplicate/concurrency invariants, failure/security, recovery/retry, late/refund, amount, regression, observability, and dry-run paths via existing invariant suites plus this matrix |
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php tests/Feature/PaymentProductionInvariantTest.php` | PASS: 19 tests, 19 passed, 44 assertions |
| `vendor/bin/pint --test app/Console/Commands/BackfillPaymentAttempts.php app/Console/Commands/ReconcileDokuPayments.php app/Services/CanonicalPaymentTransitionService.php app/Services/DokuService.php app/Services/DokuWebhookIngressService.php app/Services/PaymentObservabilityService.php app/Jobs/ReconcileDokuPayment.php app/Console/Commands/VerifyPaymentCutover.php tests/Feature/PaymentProductionMatrixTest.php` | PASS |
| `php artisan migrate:fresh --seed` | PASS: migrations and seeders completed |
| `php artisan payments:verify-cutover` | FAIL: `legacy payment writes are enabled`; exact evidence is environment default `PAYMENTS_LEGACY_WRITES_ENABLED=true`; cutover remains BLOCKED |
| `php artisan payments:backfill-attempts --dry-run` | PASS: `Payment attempt backfill complete. Exceptions: 0`; report-only, no rows written |
| `php artisan payments:reconcile-doku --dry-run` | PASS: `No DOKU payments to reconcile.`; report-only, no jobs dispatched |
| `php artisan test` | BLOCKED baseline: final parallel verification was contaminated by concurrent database reset; observed 1,436 tests, 1,394 passed, 21 failures, 1 skipped. Serial scoped suite is green; full suite remains unclaimable |
| `graphify update .` | PASS: graph rebuilt; 7,274 nodes, 18,571 edges, 488 communities; aggregated HTML generated |

## Cutover Gate

Run `php artisan payments:verify-cutover` after backfill and refund-obligation parity. Non-zero exit is NO-GO. Only after zero missing, duplicate, invoice/order/amount/currency/status mismatches and legacy writes are disabled may read-only cutover proceed.

## Baseline Truth

Full suite is not green in current repository baseline. Failures include `DokuMarkPaidCommandTest`, `ManualRefundTriggerTest`, `OwnerRefundWorkspaceTest`, and other unrelated existing tests. Task 14 does not claim full-suite success. Dry-run verification requested by brief is unavailable until command signatures support `--dry-run`.
