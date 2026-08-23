# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 28 tests, 62 assertions, 5.9 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Lock/conflict fixes

- Projection now locks attempts first, then order, matching canonical transition.
- Webhook resolves invoice attempt, locks attempt before its order, and removes duplicate order lock.
- Invoice-resolved order/attempt ownership mismatch persists `PaymentWebhookLog` evidence and rejects settlement.
