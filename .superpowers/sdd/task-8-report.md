# Task 8 Report

## Verification
- Focused Task 8 creation/retry/boundary tests: 31 passed, 77 assertions.
- DOKU status 404 is definitive invoice-not-found: exact attempt transitions failed, projection/retry window update, fresh retry permitted; transport/5xx remain unknown.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Full `php artisan test`: 1350 run, 1337 passed, 13 failures/errors. Verification blocked.

## Baseline quarantine
Compared with approved Task 7 baseline `db3cf8c0`, failures are prior-task compatibility/test-fixture issues: `CanonicalPaymentTransitionServiceTest::test_payment_aggregate_lock_order_is_order_then_attempt` (baseline source-order assertion); `DokuMarkPaidCommandTest::test_pending_terminal_order_reaches_refund_pending` (missing canonical attempt fixture); two `DokuPaymentAtomicTest` methods (missing canonical attempt fixture); `DokuPaymentTest::test_create_payment_returns_url` (removed Order overload); two DokuPayment success/redirect tests (missing canonical attempt fixtures); `PaymentAttemptBackfillTest::test_legacy_transactions_are_backfilled_once_with_hard-coded legacy ID`; `PaymentAttemptSchemaTest::test_status_enums_expose_canonical_values` (baseline omits pending state); `PaymentProductionInvariantTest::test_duplicate_payment_retry_creation_keeps_single_attempt_for_same_invoice` (removed Order overload); `PaymentProductionInvariantTest::test_duplicate_late_success_webhooks_create_one_refund_obligation_for_attempt` (baseline expects paid instead of refund_pending); `PaymentProductionInvariantTest::test_manual_paid_without_authoritative_amount_requires_review_and_cannot_fulfil` (removed Order overload); `PaymentProductionInvariantTest::test_paid_transaction_cannot_regress_on_failed_status_sync` (missing canonical invoice evidence). These are quarantined baseline failures; Task 8 focused verification remains green.

Task 7 workflow/report unchanged. Full verification blocked.
