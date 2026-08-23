# Task 6 report

## Definitive lock audit

Payment transition paths audited with `grep` across `app/Services` and payment callers.

Canonical order: order → attempts.

- `CanonicalPaymentTransitionService`: locks owning order, then target attempt.
- `OrderPaymentProjectionService`: locks order, then all payment attempts in deterministic ascending ID order; projection runs within same transaction.
- `DokuService` webhook: resolves identity without locks, then locks owning order and attempt; mismatch/missing identity persists evidence without settlement.
- `DokuService` status sync: canonical transition owns order→attempt locking.
- `DokuService` create reservation: locks order only while reserving; commits before HTTP; response transaction persists attempt without aggregate lock inversion.
- Static lock-order test asserts order lock precedes attempt lock in transition, projection, and webhook paths.
- Payment lock scan found no remaining attempt→order inversion in Task 6 paths.
- Non-payment order locks in unrelated services are outside Task 6 aggregate paths.

## Exact verification

`php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS — 29 tests, 65 assertions, 5.8 seconds.

`vendor/bin/pint --test app/Services/CanonicalPaymentTransitionService.php app/Services/OrderPaymentProjectionService.php app/Services/DokuService.php app/Services/NormalizedPaymentEvent.php tests/Unit/CanonicalPaymentTransitionServiceTest.php tests/Feature/PaymentProductionInvariantTest.php`

PASS.
