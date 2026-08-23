# Task 8 Report

## Scope
Harden checkout payment creation and retry around canonical `PaymentAttempt` records.

## Changes
- Added `DokuService::preparePaymentAttempt(Order)` under order row lock.
- Restricted `DokuService::createPayment` to canonical `PaymentAttempt`; controllers prepare attempts through order-locked creation.
- Unknown attempts reconcile exact invoice/request identity before retry.
- Active leased attempts return controlled in-progress failure instead of generic duplicate failure.
- Active `initiated`, `created`, `pending`, and `unknown` attempts are not duplicated.
- Fresh `initiated` attempts acquire an atomic two-minute creation lease under row lock; only lease owner calls DOKU.
- Provider HTTP runs outside database transactions.
- Definitive 4xx rejection marks attempt `failed`; 408, 5xx, transport timeout, and malformed/ambiguous responses mark `unknown`.
- Retries use fresh attempt/invoice/request identities and preserve historical attempts/transactions.
- Checkout and order retry controllers use attempts instead of deleting payment history.
- Webhook processing requires canonical attempts; legacy transaction evidence is retained but cannot settle or fulfil without one.

## Tests
- Reconciliation SUCCESS test: passed; canonical transition settles attempt and projects order.
- `php artisan test`: 1336 tests passed, 4662 assertions.
- Every reconciliation response persists through a token-checked attempt transaction; stale workers cannot alter state, evidence, backoff, or clear another lease.
- Stale-worker reconciliation regression: passed.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Reconciliation retry slot is claimed under attempt row lock before HTTP; lease released/updated after response and concurrent workers cannot exceed cap.
- Concurrent reconciliation lease regression: passed.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Lock-order regression and payment backfill identity regression fixed.
- Reconciliation failure regression: passed; durable attempt count/status/error/next-backoff persisted and capped at five attempts under row lock.
- `composer run lint:check`: passed (`pint --parallel --test`).
- Pending settlement attempts are active and reused by order-locked preparation.
- Completion verifies current creation lease token; stale provider responses become unknown evidence without transaction/order persistence.
- Legacy success and redirect tests assert `paid_at`.
- Historical `PaymentTransaction` rows remain after retries.
- Webhook evidence without canonical attempt remains persisted and cannot settle or fulfil an order.
- Task 7 workflow and report remain unchanged.
- Pint: passed for all Task 8 PHP files.

## Legacy suite
`DokuPaymentTest`, `DokuPaymentAtomicTest`, `PaymentScenarioTest`, `PaymentFailureFlowTest`, `PaymentReliabilityTest`, `PaymentAuthorizationMutationTest`, `PaymentFeeIntegrationTest`, `DokuMarkPaidCommandTest`, plus Task 8 creation/retry tests.
- `vendor/bin/pint --test app/Http/Controllers/Customer/CheckoutController.php app/Http/Controllers/Customer/OrderController.php app/Services/DokuService.php tests/Feature/PaymentCreationIdempotencyTest.php tests/Feature/PaymentRetryTest.php`
- Result: passed.

## Notes
No Task 7 files are part of this change.
