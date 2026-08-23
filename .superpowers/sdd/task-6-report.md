# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 21 tests, 46 assertions, 5.3 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Final P0 fixes

- Invoice identity is validated independently from gateway transaction references.
- Unmatched gateway references are retained as evidence and cannot overwrite canonical identity.
- Legacy webhook attempts marked `legacy_webhook_needs_review` remain `needs_review` on SUCCESS until authoritative reconciliation.
- Added regression tests for both policies.
