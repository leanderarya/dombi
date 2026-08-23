# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 19 tests, 42 assertions, 4.9 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Review fixes

- Stale timestamps are checked deterministically before normalized identity validation; accepted events normalize timestamps through Carbon.
- Canonical transition and projection use order-first then attempt locks consistently.
- Canonical state version increments only for settlement/verification state changes.
- Terminal SUCCESS, including amount mismatch, records paid settlement, blocks fulfilment, and creates one refund obligation.
- DOKU webhook terminal orders route through canonical transition rather than early-returning.
- Missing PaymentTransaction webhooks create a needs-review canonical attempt using order/payment evidence.
- Payment creation holds transactional order/attempt reservation through external request and response persistence, reusing reserved payment URLs.
