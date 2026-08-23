# Task 6 report

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 24 tests, 54 assertions, 4.9 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.

## Atomicity fixes

- Webhook processing now runs in one DB transaction.
- Order is locked before legacy canonical-attempt lookup/creation.
- Added unique `(order_id, invoice_number)` payment-attempt constraint and `firstOrCreate` duplicate-safe reservation.
- Legacy PaymentTransaction projection updates only after canonical transition inside same transaction.
- Existing amount evidence preservation and canonical fulfilment protections remain covered.
- SQLite test driver does not parallelize transactions; deterministic unique/reservation path is covered by the combined suite.
- `markOrderPaid()` accepts optional authoritative amount evidence; absent amount intentionally yields paid + needs_review and cannot claim fulfilment.
- `syncStatusFromDoku()` now updates legacy `PaymentTransaction` and canonical transition inside one transaction boundary.
- Unique-index migration preflights duplicate `(order_id, invoice_number)` rows, logs durable critical evidence, and aborts before schema change when reconciliation is required.
- Production concurrency verification remains required: `DB_CONNECTION=mysql php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php` (or PostgreSQL equivalent). SQLite cannot prove concurrent claimant behavior.
