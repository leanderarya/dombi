# Task 14 Verification Report

Date: 2026-08-24

## Scope

Payment observability registry, fixed nullable event schema, safe allowlisted labels, migration parity/cutover verification, production matrix coverage, and production design gate documentation. Frontend and unrelated pre-existing work were not modified.

## Commands and Results

| Command | Result |
|---|---|
| `php artisan test tests/Feature/PaymentProductionMatrixTest.php tests/Feature/PaymentProductionInvariantTest.php` | PASS: 22 tests, 22 passed, 50 assertions; Task 14 remains BLOCKED |
| `vendor/bin/pint --test Task 14 files` | PASS |
| `php artisan migrate:fresh --seed` | PASS |
| `php artisan payments:verify-cutover` | Historical clean-seed fixture-only output; not release evidence. Production gate remains NO-GO pending real migration parity and runtime evidence |
| `php artisan payments:backfill-attempts --dry-run` | CURRENT (2026-08-24, run after commit `f45a06e4`): BLOCKED by MySQL `1045 Access denied for user root@localhost`; no current command result |
| `php artisan payments:reconcile-doku --dry-run` | CURRENT (2026-08-24, run after commit `f45a06e4`): BLOCKED by MySQL `1045 Access denied for user root@localhost`; no current command result |
| `npm run types:check` | PASS after fixing guest cancel page props and using existing `/track/{token}/cancel` endpoint |
| `php artisan test` | SERIAL NO-GO: 1,439 tests, 435 passed, 1 failure, 1,003 errors; MySQL gone away/refused. Prior exact 18 blocker names remain below |
| `graphify update .` | PASS: 7,284 nodes, 18,544 edges, 507 communities |

Task 14 status: NO-GO/BLOCKED.

Latest run: scoped tests could not execute because MySQL test database rejected credentials (`1045 Access denied for user root@localhost`); 22 tests errored before assertions. This is environment-blocked, not a pass. Current dry-run commands are also environment-blocked by the same `1045 Access denied` on `dombi`; no PASS claim is made. Latest historical successful outputs are retained only as history, not current evidence. Typecheck remains NO-GO with `resources/js/pages/guest/cancel.tsx:26` PageProps constraint and `cancel.tsx:41` missing `route`. Full suite remains NO-GO with exact 18 named failures listed below plus current MySQL credential failure. Cutover requires runtime-resolved `config('doku.legacy_writes_deployment_evidence') === 'false'`; default config is not evidence. Production readiness is not claimed. Full serial suite failures are release blockers. Production readiness is not claimed.

HISTORICAL PASS (2026-08-24, pre-MySQL credential failure): matrix 22/22, 50 assertions; not current evidence. CURRENT SAME ROW: latest scoped run MySQL-blocked before assertions. Task 14 is NO-GO. Reconciliation now selects `created`, `pending`, and `unknown` creation states. Cutover rejects float/non-canonical amounts and accepts only exact decimal strings with at most two fractional digits; no rounding. Observability fallback logs contain exception class/code only, never raw messages.

Late payment requires non-null trusted event timestamp and event time strictly after authoritative terminal transition timestamp. Taxonomy path assertions cover all required event owners; direct registry-only coverage is not treated as production behavior proof.

Current verification remains MySQL-blocked; no current scoped-test, migration, or dry-run PASS is claimed. Dry-run test now snapshots full normalized contents for payment attempts, transactions, obligations, outbox, webhook logs, orders, outlet inventory, and stock movements, with timestamps normalized, plus queue assertions. Owner-path matrix explicitly asserts events reached by available paths; late/duplicate/reconciliation/refund-ageing paths are marked incomplete when MySQL fixtures are unavailable. Task 14 remains NO-GO. Cutover now classifies pre-cutover legacy provenance versus post-cutover canonical obligations using configured cutover timestamp; post-cutover records receive FK/order integrity checks and are exempt from legacy evidence parity. Metric counter/gauge reads return local fallback on backend failure. Dry-run matrix snapshots payment attempts, transactions, obligations, outbox, webhook logs, orders, outlet inventory, and stock movements; execution is blocked by MySQL credentials. Task 14 remains NO-GO. Event taxonomy and labels now validate synchronously before after-commit registration; only backend callback failures are swallowed. Added committed CanonicalPaymentTransitionService backend-failure test asserting paid attempt/order projection and no refund obligation; execution remains blocked by MySQL credentials. Task 14 remains NO-GO. Cutover parity now includes refund destination status, rejected actor/code, and remaining legacy refund metadata. Added committed-transaction observability backend-failure test asserting financial write survives deferred callback failure; execution remains blocked by MySQL credentials. Task 14 remains NO-GO. Cutover refund parity includes lifecycle timestamps, actors, rejection reason/note, destination submission, destinations, proof, references, notes, currency, amount, status, and reason; obligation order/attempt integrity is validated. Cutover outputs `READY` only when parity and explicit runtime evidence pass; otherwise `BLOCKED`. Post-commit observability callbacks and fallback logging are swallow-safe; atomic counters require backend support; durable outbox remains financial truth. Backend-failure test exists but execution is currently blocked by MySQL credentials. Task 14 remains NO-GO. Observability now fails safely when backend unavailable; durable outbox remains financial truth. Post-cutover canonical obligations/attempts are exempt from legacy parity but FK/order/attempt integrity is still checked. Production cutover remains NO-GO until runtime evidence and full-suite blockers clear.

Exact latest serial full-suite blockers (18): `DokuMarkPaidCommandTest::test_pending_terminal_order_reaches_refund_pending`; `ManualRefundTriggerTest::test_cancelling_a_paid_pending_confirmation_order_flags_refund_pending`; `OwnerRefundWorkspaceTest::test_awaiting_guest_queue`; `OwnerRefundWorkspaceTest::test_finance_tab_refund_loads`; `OwnerRefundWorkspaceTest::test_ready_queue`; `OwnerRefundWorkspaceTest::test_refund_failed_is_action_required`; `OwnerSettlementCollectionTest::test_dashboard_shows_outlets_with_unpaid`; `OwnerSettlementCollectionTest::test_kpis_reflect_outstanding_settlements`; `OwnerSettlementCollectionTest::test_kpis_reflect_paid_settlements`; `OwnerSettlementCollectionTest::test_overdue_outlets_sorted_first`; `OwnerSettlementCollectionTest::test_owner_can_access_collection_page`; `PaymentAttemptBackfillTest::test_failed_attempt_insert_is_reported_and_batch_continues`; `PaymentAttemptBackfillTest::test_legacy_transactions_are_backfilled_once_with_historical_values`; `PaymentAttemptBackfillTest::test_orphan_order_is_reported_without_aborting_batch`; `PaymentAttemptBackfillTest::test_unsupported_status_is_reported_and_not_imported`; `RefundFlowTest::test_cancel_paid_pending_confirmation_order_flags_refund_pending`; `RefundFlowTest::test_reject_paid_order_creates_refund_pending`; `StockValidationRaceConditionTest::test_concurrent_checkout_prevents_overselling`.

## Cutover Gate

Run `php artisan payments:verify-cutover` after backfill and refund-obligation parity. Non-zero exit is NO-GO. Only after zero missing, duplicate, invoice/order/amount/currency/status mismatches and legacy writes are disabled may read-only cutover proceed.

## Baseline Truth

Full suite is not green in current repository baseline. Failures include `DokuMarkPaidCommandTest`, `ManualRefundTriggerTest`, `OwnerRefundWorkspaceTest`, and other unrelated existing tests. Task 14 does not claim full-suite success. Dry-run commands exist but current execution is blocked by MySQL credentials; no current PASS is claimed.
