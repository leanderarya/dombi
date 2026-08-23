# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 27 tests, 61 assertions, 5.0 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Final fixes

- Retry expiry is written only when settlement actually changes into failed/expired; repeated or stale events cannot reset it.
- Projection no longer reacquires all attempt locks after canonical transition already owns attempt→order locks, avoiding reverse lock acquisition.
- Added repeated-failure retry-window regression coverage.
