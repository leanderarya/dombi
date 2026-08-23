# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 25 tests, 55 assertions, 4.9 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Final fixes

- Canonical transition and projection use approved attempt-first then order lock order.
- Amount comparison uses strict decimal parsing/minor units; malformed amounts do not verify.
- Missing/unrecognized webhook invoices remain durable evidence-only and do not synthesize attempts or settle orders.
- Task 6 invariants updated to assert canonical-attempt absence for unrecognized webhook identity.
