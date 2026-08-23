# Task 8 Report

## Verification
- Focused Task 8 creation/retry/boundary tests: 32 passed, 80 assertions.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Full `php artisan test`: 1352 run, 1339 passed, 13 failures/errors. Verification blocked.

## Failure breakdown

**Task 8-owned regressions (6):**
- `DokuPaymentAtomicTest::test_mark_order_paid_is_idempotent_via_atomic_transition`, `test_late_payment_on_terminal_order_persists_refund_amount` — `markOrderPaidPublic` now requires `PaymentAttempt` not `Order`.
- `DokuPaymentTest::test_create_payment_returns_url` — removed `Order` overload from `createPayment`.
- `PaymentProductionInvariantTest::test_duplicate_payment_retry_creation_keeps_single_attempt_for_same_invoice`, `test_manual_paid_without_authoritative_amount_requires_review_and_cannot_fulfil` — `createPayment`/`markOrderPaid` signature changes.
- `PaymentProductionInvariantTest::test_paid_transaction_cannot_regress_on_failed_status_sync` — `processPaymentStatusChange` requires canonical invoice evidence.

**Pre-existing baseline failures (7):**
- `CanonicalPaymentTransitionServiceTest::test_payment_aggregate_lock_order_is_order_then_attempt` — baseline source-order assertion.
- `DokuMarkPaidCommandTest::test_pending_terminal_order_reaches_refund_pending` — missing canonical attempt fixture.
- `DokuPaymentTest::test_webhook_success_marks_paid`, `test_redirect_proceeds_on_verified_status_api` — missing canonical attempt fixtures.
- `PaymentAttemptBackfillTest::test_legacy_transactions_are_backfilled_once_with_historical_values` — hard-coded legacy ID.
- `PaymentAttemptSchemaTest::test_status_enums_expose_canonical_values` — baseline omits pending state.
- `PaymentProductionInvariantTest::test_duplicate_late_success_webhooks_create_one_refund_obligation_for_attempt` — baseline expects paid instead of refund_pending.

Task 7 workflow/report unchanged. Full verification blocked.