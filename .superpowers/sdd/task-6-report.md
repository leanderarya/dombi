# Task 6 report

## Definitive lock audit

Payment transition paths audited with `grep` across `app/Services` and payment callers.

Canonical order: attempt(s) → order.

- `CanonicalPaymentTransitionService`: locks target attempt, then order.
- `OrderPaymentProjectionService`: locks all payment attempts in deterministic ascending ID order, then order; projection runs within same transaction.
- `DokuService` webhook: resolves attempt by invoice, locks attempt, then owning order; mismatch/missing identity persists evidence without settlement.
- `DokuService` status sync: canonical transition owns attempt→order locking.
- `DokuService` create reservation: no attempt exists during reservation; locks order only, commits before HTTP; response transaction performs idempotent persistence without aggregate lock inversion.
- Non-payment order locks in unrelated services are outside Task 6 aggregate paths.

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 28 tests, 62 assertions, 5.6 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.
