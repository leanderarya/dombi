# Task 4 Report

## Status
Review findings fixed.

## Changes
- Positive amount enforced through driver-specific CHECK constraints or SQLite insert/update triggers; model/service retain strict positive validation.
- Obligation creation classifies duplicate-key races by SQLSTATE/driver code and propagates FK/schema failures.
- Refund obligation creation requires a persisted payment attempt whose order exists.
- Each historical refund is processed in its own transaction; order and relevant existing attempt rows lock before synthesis/obligation creation.
- Backfill owns exception-table creation and cleanup, checks required tables/columns, validates `refunded_by`, and tags every synthesized attempt, obligation, and exception with `2026_08_23_000004_refund_obligations`; scoped `down()` removes exact-key rows only.
- Existing-attempt mapping chooses a locked candidate whose amount covers refund amount; synthesis requires order total to equal refund amount.
- Migration creation, trigger setup, and indexes are guarded for interrupted reruns.
- `orders.total` and every selected historical refund column are validated before processing; absent sources stop safely.
- Refund-status rows are all loaded; invalid, zero, negative, and over-precision amounts produce tagged `invalid_refund_amount` exceptions.
- Candidate attempts are locked first, invalid amount formats/precision are reported as `invalid_attempt_amount`, then valid candidates are selected using exact two-decimal minor-unit comparisons; service rejects non-positive/non-canonical amounts.
- Existing and synthesized currency must be exactly three uppercase letters; missing/invalid values record `missing_currency` without creating an orphan attempt or defaulting to IDR.
- Constraint/trigger setup and rollback are rerun-safe; rollback removes only exact-run obligations and unreferenced synthesized attempts.
- Duplicate creation races use bounded retry/requery and canonical-field validation; conflicting synthesized attempts/obligations become tagged exceptions.
- Amount validation rejects fractional precision beyond two digits before minor-unit conversion; currency remains exactly three uppercase letters with no IDR fallback.
- MySQL/MariaDB constraint repair uses guarded ALTER fallback; PostgreSQL/SQLite remain driver-safe.
- Duplicate detection matches narrow SQLSTATE/driver duplicate codes; FK/schema errors propagate or become tagged mapping exceptions where applicable.
- Existing-table migration reruns inspect and repair required uniqueness and payment-attempt foreign-key constraints; invalid existing data raises explicit repair errors.
- Deterministic duplicate-key recovery is covered by canonical-row injection; repository does not provide portable parallel DB harness.
- Bank/account/e-wallet destination fields use encrypted casts matching `Order`; backfill decrypts legacy Order ciphertext then re-encrypts through `RefundObligation` casts before raw insert, preserving nulls and round-trip reads.
- Per-row destination decrypt failures are tagged `invalid_refund_destination_ciphertext`, skipped, and do not abort remaining refunds.
- Backfill uses duplicate-only handling for synthesized attempts, exception rows, and obligations; reruns remain idempotent.
- Synthesized attempts lock the order row, use unique legacy keys, and safely recover from concurrent insertion races.
- Added historical mapping, synthesized-attempt, exception-recovery, rerun-idempotency, duplicate-race, and database-boundary regression coverage.

## Verification
- `php artisan test tests/Feature/RefundObligationTest.php` — PASS (22 tests, 45 assertions; 27.420s)
- `composer run lint:check` — PASS
- `git diff --check` — PASS

## Concerns
- Deterministic parallel DB test remains environment-dependent; duplicate-key recovery is covered explicitly.
