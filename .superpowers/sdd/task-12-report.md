# Task 12 Report

## Findings fixed

- Canonical verified payment success now claims order fulfilment and completes order/inventory/settlement in same database transaction. Duplicate paid attempts receive durable `duplicate_paid_attempt` obligations and never fulfil.
- Inventory completion performs a row-locked duplicate check and has a database unique key on `(reference_type, reference_id, product_id, type)`.
- PostgreSQL receives claimant consistency check `(claimed_at, claimed_by)`; MySQL constraint is omitted because MySQL rejects checks referencing columns participating in foreign-key referential actions.
- Unknown DOKU creation remains durable and reconciliation-driven; existing tests cover unknown creation, expiry/reconciliation, definitive 404 failure, pending results, and successful reconciliation. No automatic DOKU refund was added.

## Verification

- `php artisan test tests/Feature/PaymentFulfilmentConcurrencyTest.php` — passed, 2 tests / 6 assertions.
- `php artisan test tests/Feature/PaymentFulfilmentConcurrencyTest.php` — passed, 2 tests / 6 assertions.
- `php artisan test tests/Feature/PaymentFulfilmentConcurrencyTest.php tests/Feature/PaymentOutboxTest.php tests/Feature/DokuReconciliationTest.php tests/Feature/PaymentRetryTest.php` — 56 passed, 2 existing failures in `PaymentRetryTest` expecting 404 reconciliation state `failed`; current behaviour returns durable `unknown`.
- `composer run lint:check` — passed.
- `graphify update .` — passed; graph rebuilt with 7,203 nodes.

## Files

- `database/migrations/2026_08_24_000007_add_payment_fulfilment_claim_to_orders.php`
- `database/migrations/2026_08_24_000008_add_fulfilment_integrity_constraints.php`
- `app/Models/Order.php`
- `app/Services/CanonicalPaymentTransitionService.php`
- `app/Services/OrderStatusService.php`
- `app/Services/InventoryService.php`
- `tests/Feature/PaymentFulfilmentConcurrencyTest.php`
