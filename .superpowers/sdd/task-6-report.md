# Task 6 report

## Exact verification

Command:

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

Result: PASS — 19 tests, 42 assertions, 4.8 seconds.

Lint command:

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

Result: PASS.

## Task 6 updates

- PaymentProductionInvariantTest now uses canonical PaymentAttempt, refund_obligation, and projection semantics instead of obsolete PaymentTransaction-only assertions.
- Amount mismatch asserts paid settlement plus needs_review while order projection remains pending until verified.
- Terminal late success asserts one canonical refund obligation and no fulfilment claim.
- Legacy refund-history proxy assertion replaced with canonical obligation identity.
- Retry uniqueness and no-canonical-attempt rejection remain covered.
- Canonical service and projection service use consistent attempt-first then order locking.
- DOKU sync passes full evidence and persisted amount/reference semantics.
