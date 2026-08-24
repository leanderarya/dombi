# Task 14 Verification Report

Date: 2026-08-24

## Scope

Payment observability registry, fixed nullable event schema, safe allowlisted labels, migration parity/cutover verification, production matrix coverage, and production design gate documentation. Frontend and unrelated pre-existing work were not modified.

## Commands and Results

| Command | Result |
|---|---|
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php tests/Feature/PaymentProductionInvariantTest.php` | PASS: 19 tests, 19 passed, 44 assertions. Matrix remains PARTIAL/BLOCKED for Task 14; no production-ready claim |
| `vendor/bin/pint --test app/Console/Commands/BackfillPaymentAttempts.php app/Console/Commands/VerifyPaymentCutover.php app/Services/PaymentObservabilityService.php routes/console.php tests/Feature/PaymentProductionMatrixTest.php` | PASS |
| `php artisan migrate:fresh --seed` | PASS |
| `php artisan payments:verify-cutover` | BLOCKED: `legacy payment writes are enabled`; `config('doku.legacy_writes_enabled')` is true. Full parity includes settlement/currency/gateway identity and refund count/status/reason/amount/destination/proof/reference |
| `php artisan payments:backfill-attempts --dry-run` | PASS: no exceptions, report-only, no writes; nonzero on any exception |
| `php artisan payments:reconcile-doku --dry-run` | PASS: no candidates, report-only, no dispatch |
| `php artisan test` | SERIAL BLOCKER: 1,436 tests, 1,417 passed, 18 failures, 1 skipped. Exact failures: `DokuMarkPaidCommandTest::test_pending_terminal_order_reaches_refund_pending`; `ManualRefundTriggerTest::test_cancelling_a_paid_pending_confirmation_order_flags_refund_pending`; `OwnerRefundWorkspaceTest::test_finance_tab_refund_loads`; `OwnerRefundWorkspaceTest::test_awaiting_guest_queue`; `OwnerRefundWorkspaceTest::test_ready_queue`; `OwnerRefundWorkspaceTest::test_refund_failed_is_action_required`; `OwnerSettlementCollectionTest::test_owner_can_access_collection_page`; `OwnerSettlementCollectionTest::test_kpis_reflect_outstanding_settlements`; `OwnerSettlementCollectionTest::test_kpis_reflect_paid_settlements`; `OwnerSettlementCollectionTest::test_dashboard_shows_outlets_with_unpaid`; `OwnerSettlementCollectionTest::test_overdue_outlets_sorted_first`; `PaymentAttemptBackfillTest::test_legacy_transactions_are_backfilled_once_with_historical_values`; `PaymentAttemptBackfillTest::test_unsupported_status_is_reported_and_not_imported`; `PaymentAttemptBackfillTest::test_orphan_order_is_reported_without_aborting_batch`; `PaymentAttemptBackfillTest::test_failed_attempt_insert_is_reported_and_batch_continues`; `RefundFlowTest::test_cancel_paid_pending_confirmation_order_flags_refund_pending`; `RefundFlowTest::test_reject_paid_order_creates_refund_pending`; `StockValidationRaceConditionTest::test_concurrent_checkout_prevents_overselling` |
| `graphify update .` | PASS: 7,275 nodes, 18,575 edges, 484 communities |

Task 14 status: BLOCKED. Full serial suite failures are release blockers. Production readiness is not claimed.

## Cutover Gate

Run `php artisan payments:verify-cutover` after backfill and refund-obligation parity. Non-zero exit is NO-GO. Only after zero missing, duplicate, invoice/order/amount/currency/status mismatches and legacy writes are disabled may read-only cutover proceed.

## Baseline Truth

Full suite is not green in current repository baseline. Failures include `DokuMarkPaidCommandTest`, `ManualRefundTriggerTest`, `OwnerRefundWorkspaceTest`, and other unrelated existing tests. Task 14 does not claim full-suite success. Dry-run verification requested by brief is unavailable until command signatures support `--dry-run`.
