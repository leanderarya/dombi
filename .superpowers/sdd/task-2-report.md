# Task 2 Report

## Scope

Implemented canonical payment attempt schema, model, enums, Order relationship, and focused feature tests only. Existing unrelated uncommitted files were preserved.

## Files

- `app/Enums/PaymentAttemptCreationState.php`
- `app/Enums/PaymentAttemptSettlementStatus.php`
- `app/Enums/PaymentAttemptVerificationStatus.php`
- `app/Models/PaymentAttempt.php`
- `app/Models/Order.php`
- `database/migrations/2026_08_23_000001_create_payment_attempts_table.php`
- `tests/Feature/PaymentAttemptSchemaTest.php`

## Implementation

- Added creation states: `initiated`, `created`, `unknown`, `failed`.
- Added settlement statuses: `pending`, `paid`, `failed`, `expired`, `unknown`.
- Added verification statuses: `verified`, `needs_review`.
- Added unique `attempt_key`, `invoice_number`, and `merchant_request_id` identities.
- Added order foreign key with cascade delete.
- Added immutable amount/currency snapshot enforcement in model updates.
- Added gateway amount/currency and gateway identifiers.
- Added status version, reconciliation fields, fulfilment claim fields, metadata, and reconciliation indexes.
- Added `Order::paymentAttempts()`, `PaymentAttempt::order()`, and typed `PaymentAttempt::refundObligations(): HasMany` targeting future `App\Models\RefundObligation`.
- Deferred `RefundObligation` model, table, and service implementation; no relation points to `refund_status_histories`.
- Defined `fulfilment_claimed_by` as nullable foreign key to `users`, with `nullOnDelete()`.
- Confirmed session tokens are not globally unique.

## TDD Evidence

1. Added schema/model tests first.
2. Ran targeted test before implementation: failed as expected because payment attempt schema and enum classes were absent.
3. Added minimal implementation.
4. Ran targeted test: passed.

## Verification

- `vendor/bin/pint --test`: PASS
- `php artisan test tests/Feature/PaymentAttemptSchemaTest.php`: PASS, 9 tests, 24 assertions
- Initial `php artisan pint --test` command was unavailable because `pint` is not an Artisan command; repository binary `vendor/bin/pint` was used.

## Concerns

- Canonical `RefundObligation` model/table/service remains deferred to its owning task; Task 2 relation is intentionally typed against that future model only.
