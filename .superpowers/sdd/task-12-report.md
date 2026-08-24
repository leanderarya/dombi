# Task 12 Report

## Findings fixed

- MySQL `order_completed_key` is refreshed by both BEFORE INSERT and BEFORE UPDATE triggers, so updates cannot bypass scoped uniqueness.
- Regression test attempts to retarget an existing completion movement to another completion key and asserts database rejection.
- PostgreSQL partial unique index continues enforcing equivalent update-safe uniqueness.
- Reservation/release movement types remain unrestricted.

## Verification

- `php artisan test tests/Feature/PaymentFulfilmentConcurrencyTest.php` — passed, 7 tests / 29 assertions; production-driver parallel worker gate included, SQLite skips explicitly.
- `composer run lint:check` — passed.
- `graphify update .` — run after implementation.

## Files

- `database/migrations/2026_08_24_000008_add_fulfilment_integrity_constraints.php`
- `tests/Feature/PaymentFulfilmentConcurrencyTest.php`
