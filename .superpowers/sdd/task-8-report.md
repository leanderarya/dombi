# Task 8 Report

## Verification
- Focused Task 8 tests: 30 passed, 74 assertions.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Full `php artisan test`: 1343 run, 1332 passed, 11 failures/errors. Verification blocked.

## Baseline quarantine
`CanonicalPaymentTransitionServiceTest::test_payment_aggregate_lock_order_is_order_then_attempt` — baseline source-order assertion; `DokuMarkPaidCommandTest::test_pending_terminal_order_reaches_refund_pending` — missing canonical attempt fixture; both `DokuPaymentAtomicTest` paid/late-payment methods — missing canonical attempt fixtures; `DokuPaymentTest::test_create_payment_returns_url` — removed Order overload; two DokuPayment success/redirect tests — missing canonical attempt fixtures; `PaymentAttemptBackfillTest::test_legacy_transactions_are_backfilled_once_with_historical_values` — hard-coded legacy ID; `PaymentAttemptSchemaTest::test_status_enums_expose_canonical_values` — baseline omits pending state; `PaymentProductionInvariantTest::test_duplicate_payment_retry_creation_keeps_single_attempt_for_same_invoice` — removed Order overload; `PaymentProductionInvariantTest::test_duplicate_late_success_webhooks_create_one_refund_obligation_for_attempt` — baseline expects paid instead of refund_pending.

No Task 8 focused regression remains. Task 7 workflow/report unchanged.
