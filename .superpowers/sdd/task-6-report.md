# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 23 tests, 53 assertions, 5.1 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Final status/amount fixes

- Internal/manual `paid` normalizes to canonical SUCCESS while preserving gateway status evidence.
- Missing gateway amount is never replaced with attempt expected amount.
- Missing amount records paid settlement with needs_review and blocks fulfilment/refund decision.
- Added manual/missing-amount regression coverage.
