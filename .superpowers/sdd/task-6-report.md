# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 25 tests, 58 assertions, 4.9 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Review fixes

- Terminal invalid-order SUCCESS creates exactly one `late_payment` refund obligation; valid already-claimed attempts use `duplicate_paid_attempt` only for distinct losers.
- Legacy PaymentTransaction projection cannot regress a paid transaction on later lower-priority events.
- Late-success invariant restores canonical attempt coverage: paid settlement, paid order projection, one late-payment obligation, no fulfilment claim.
