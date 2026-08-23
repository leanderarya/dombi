# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 26 tests, 60 assertions, 5.0 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## P0 regression fix

Canonical failed/expired transitions now set pending orders' `confirmation_expires_at` using configured `order.payment_retry_window_minutes`, within canonical transition transaction. Added regression coverage; no controller duplicate logic added.
