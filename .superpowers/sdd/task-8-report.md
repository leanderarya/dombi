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
- Focused Task 8 creation/retry suite: 15 tests passed, 35 assertions.
- Complete listed legacy payment suite plus Task 8 tests: 69 tests passed, 120 assertions.
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
