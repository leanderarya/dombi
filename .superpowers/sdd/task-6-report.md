# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 24 tests, 54 assertions, 4.9 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Atomicity fixes

- Webhook processing now runs in one DB transaction.
- Order is locked before legacy canonical-attempt lookup/creation.
- Added unique `(order_id, invoice_number)` payment-attempt constraint and `firstOrCreate` duplicate-safe reservation.
- Legacy PaymentTransaction projection updates only after canonical transition inside same transaction.
- Existing amount evidence preservation and canonical fulfilment protections remain covered.
- SQLite test driver does not parallelize transactions; deterministic unique/reservation path is covered by the combined suite.
