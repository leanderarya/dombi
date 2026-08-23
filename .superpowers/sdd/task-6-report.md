# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 27 tests, 61 assertions, 5.6 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Reservation P0 fix

Short reservation transaction now locks order first, then re-reads and locks active canonical attempt under that order lock before reserving. Transaction commits before HTTP, so waiting concurrent creators recheck reservation state without network calls under lock.
