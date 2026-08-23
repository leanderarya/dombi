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
- Webhook compatibility synthesizes canonical unknown attempts from legacy transaction evidence.

## Tests
- `php artisan test tests/Feature/PaymentCreationIdempotencyTest.php tests/Feature/PaymentRetryTest.php`
- Result: 10 tests passed, 20 assertions in focused creation/retry suite.
- Relevant legacy payment suite updated for canonical attempt identities and fixtures.
- `vendor/bin/pint --test app/Http/Controllers/Customer/CheckoutController.php app/Http/Controllers/Customer/OrderController.php app/Services/DokuService.php tests/Feature/PaymentCreationIdempotencyTest.php tests/Feature/PaymentRetryTest.php`
- Result: passed.

## Notes
Existing legacy payment tests expose behavior expectations around webhook-only transaction fixtures; those fixtures conflict with canonical-attempt-only processing and remain outside Task 8 focused verification.
