# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 25 tests, 58 assertions, 4.9 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php database/migrations/2026_08_23_000005_add_order_invoice_unique_to_payment_attempts.php`

PASS.

## Migration portability fix

Payment-attempt duplicate preflight now uses portable `havingRaw('COUNT(*) > ?', [1])` instead of PostgreSQL-incompatible select-alias HAVING.
