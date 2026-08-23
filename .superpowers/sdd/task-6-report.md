# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 24 tests, 54 assertions, 5.0 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Evidence/transaction fixes

- Later events without amount preserve existing verified gateway amount evidence.
- Legacy PaymentTransaction is updated only after canonical transition succeeds.
- Invalid canonical events therefore cannot mutate legacy transaction status.
- Added regression coverage for amount preservation.
