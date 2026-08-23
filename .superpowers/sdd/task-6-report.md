# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 22 tests, 50 assertions, 4.8 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Final identity fixes

- Invoice fallback is never stored as `gateway_transaction_id`; canonical invoice remains `invoice_number`.
- Provider transaction references are stored separately as gateway evidence/reference.
- Every webhook-synthesized attempt, including attempts synthesized alongside an existing PaymentTransaction, is marked `legacy_webhook_needs_review`.
- Legacy webhook SUCCESS cannot fulfil until authoritative reconciliation.
- Added regressions for provider-reference storage and legacy synthesized-attempt fulfilment blocking.
