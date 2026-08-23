# Task 6 report

## Verification

- `php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php`: PASS — 11 tests, 26 assertions.
- Focused Pint: PASS.
- Required combined command: FAIL — 13 passed, 6 failed, 39 assertions.

## Combined failures

1. `test_duplicate_success_notifications_do_not_create_duplicate_paid_attempts`: expected paid, actual pending.
2. `test_success_with_amount_mismatch_does_not_settle_order`: expected pending, actual paid.
3. `test_order_payment_status_projects_from_successful_attempt_state`: expected paid, actual pending.
4. `test_duplicate_payment_retry_creation_keeps_single_attempt_for_same_invoice`: duplicate retry creation still fails.
5. `test_duplicate_late_success_webhooks_create_one_refund_obligation_for_attempt`: expected refund_pending, actual pending.
6. `test_duplicate_refund_request_returns_null_without_second_obligation`: expected one legacy history row, actual zero.

## Blocker fixes

- Canonical transition locks attempt first, then order.
- DOKU status sync passes full DOKU evidence, including amount and invoice fallback reference.
- Reference normalization accepts persisted invoice semantics and stored gateway reference.
- Terminal/cancelled SUCCESS records paid settlement, creates one refund obligation, and never claims fulfilment.
- Same-attempt duplicate remains idempotent; distinct paid loser creates one obligation.
