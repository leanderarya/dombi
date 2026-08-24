# Task 12 Report

## Scope

Added order-level fulfilment claim protection, duplicate-payment refund obligations, and idempotent order stock completion.

## Behaviour

- Order claim is conditional on `fulfilment_claimed_at IS NULL`; only one paid attempt can claim it.
- Losing paid attempts create one `duplicate_paid_attempt` refund obligation and do not claim fulfilment.
- Inventory completion skips an already-recorded `order_completed` movement for the same order/product, preventing duplicate stock mutation.
- Existing DOKU creation states remain unchanged: definitive failures are `failed`; ambiguous outcomes remain `unknown` for reconciliation. No automatic DOKU refund was added.

## Verification

- `php artisan test tests/Feature/PaymentFulfilmentConcurrencyTest.php` — passed, 1 test / 3 assertions.
- `composer run lint:check` — passed.
- `graphify update .` — run after code changes.

## Files

- `database/migrations/2026_08_24_000007_add_payment_fulfilment_claim_to_orders.php`
- `app/Models/Order.php`
- `app/Services/CanonicalPaymentTransitionService.php`
- `app/Services/InventoryService.php`
- `tests/Feature/PaymentFulfilmentConcurrencyTest.php`
