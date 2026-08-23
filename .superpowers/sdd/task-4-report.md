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
- Candidate attempts are locked first, then selected using exact two-decimal minor-unit comparisons; service rejects non-positive/non-canonical amounts.
- Existing and synthesized currency must be exactly three uppercase letters; missing/invalid values record `missing_currency` without creating an orphan attempt or defaulting to IDR.
- Constraint/trigger setup and rollback are rerun-safe; rollback removes only exact-run obligations and unreferenced synthesized attempts.
- Duplicate detection matches narrow SQLSTATE/driver duplicate codes; FK/schema errors propagate or become tagged mapping exceptions where applicable.
- Backfill uses duplicate-only handling for synthesized attempts, exception rows, and obligations; reruns remain idempotent.
- Synthesized attempts lock the order row, use unique legacy keys, and safely recover from concurrent insertion races.
- Added historical mapping, synthesized-attempt, exception-recovery, rerun-idempotency, duplicate-race, and database-boundary regression coverage.

## Verification
- `php artisan test tests/Feature/RefundObligationTest.php` — PASS (19 tests, 38 assertions; 24.724s)
- `composer run lint:check` — PASS
- `git diff --check` — PASS

## Concerns
- Backfill synthesis uses `IDR` when legacy order currency is unavailable in existing schema.
- Deterministic parallel DB test remains environment-dependent; duplicate-key recovery is covered explicitly.
