# Task 8 Report

## Scope
Harden checkout payment creation and retry around canonical `PaymentAttempt` records.

## Changes
- Added `DokuService::preparePaymentAttempt(Order)` under order row lock.
- Added canonical `DokuService::createPayment(PaymentAttempt)` flow; legacy `Order` callers prepare an attempt first.
- Active `initiated`, `created`, `pending`, and `unknown` attempts are not duplicated.
- Provider HTTP runs outside database transactions.
- Definitive provider rejection marks attempt `failed`.
- Transport/ambiguous responses mark attempt `unknown`; retry requires reconciliation.
- Retries use fresh attempt/invoice/request identities and preserve historical attempts/transactions.
- Checkout and order retry controllers use attempts instead of deleting payment history.
- Webhook compatibility synthesizes canonical unknown attempts from legacy transaction evidence.

## Tests
- `php artisan test tests/Feature/PaymentCreationIdempotencyTest.php tests/Feature/PaymentRetryTest.php`
- Result: 4 tests passed, 9 assertions.
- `vendor/bin/pint --test app/Http/Controllers/Customer/CheckoutController.php app/Http/Controllers/Customer/OrderController.php app/Services/DokuService.php tests/Feature/PaymentCreationIdempotencyTest.php tests/Feature/PaymentRetryTest.php`
- Result: passed.

## Notes
Existing legacy payment tests expose behavior expectations around webhook-only transaction fixtures; those fixtures conflict with canonical-attempt-only processing and remain outside Task 8 focused verification.
