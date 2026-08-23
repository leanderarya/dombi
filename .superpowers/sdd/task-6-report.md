# Task 6 report

## Exact verification

Command:

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

Result: PASS — 19 tests, 42 assertions, 5.1 seconds.

Lint:

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

Result: PASS.

## Review fixes

- Transition and projection now lock order first, then attempts consistently.
- Event timestamps normalize through Carbon; stale event checks run after identity validation.
- `status_version` increments only when canonical settlement/verification state changes.
- Terminal SUCCESS amount mismatch remains paid settlement, blocked fulfilment, and one explicit refund obligation.
- Payment creation locks order, checks active canonical attempt, reserves invoice/request identity before DOKU request, and reuses persisted payment URL.
- DOKU status sync passes full evidence and persisted amount.
- PaymentProductionInvariant coverage uses canonical attempts, projection, and refund obligations.
