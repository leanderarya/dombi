# Task 4 Report

## Status
Review findings fixed.

## Changes
- Positive amount enforced through driver-specific CHECK constraints or SQLite insert/update triggers; model/service retain strict positive validation.
- Obligation creation classifies duplicate-key races by SQLSTATE/driver code and propagates FK/schema failures.
- Each historical refund is processed in its own transaction; order row locking serializes synthesis with obligation creation.
- Backfill owns exception-table creation, tags every exception with `2026_08_23_000004_refund_obligations`, and scoped `down()` removes only that run's rows.
- Backfill rejects refund amounts above originating attempt amounts; synthesis requires order total to equal refund amount.
- Backfill uses duplicate-only handling for synthesized attempts, exception rows, and obligations; reruns remain idempotent.
- Synthesized attempts lock the order row, use unique legacy keys, and safely recover from concurrent insertion races.
- Added historical mapping, synthesized-attempt, exception-recovery, rerun-idempotency, duplicate-race, and database-boundary regression coverage.

## Verification
- `php artisan test tests/Feature/RefundObligationTest.php` — PASS (13 tests, 30 assertions; 4.719s)
- `composer run lint:check` — PASS
- `git diff --check` — PASS

## Concerns
- Backfill synthesis uses `IDR` when legacy order currency is unavailable in existing schema.
- Deterministic parallel DB test remains environment-dependent; duplicate-key recovery is covered explicitly.
