# Task 4 Report

## Status
Review findings fixed.

## Changes
- Positive amount enforced through driver-specific CHECK constraints or SQLite insert/update triggers; model/service retain strict positive validation.
- Obligation creation classifies duplicate-key races by SQLSTATE/driver code and propagates FK/schema failures.
- Backfill uses duplicate-only handling for synthesized attempts, exception rows, and obligations; reruns remain idempotent.
- Synthesized attempts lock the order row, use unique legacy keys, and safely recover from concurrent insertion races.
- Added historical mapping, synthesized-attempt, exception-recovery, rerun-idempotency, duplicate-race, and database-boundary regression coverage.

## Verification
- `php artisan test tests/Feature/RefundObligationTest.php` — PASS (10 tests, 25 assertions; 5.056s)
- `composer run lint:check` — PASS
- `git diff --check` — PASS

## Concerns
- Backfill synthesis uses `IDR` when legacy order currency is unavailable in existing schema.
- Deterministic parallel DB test remains environment-dependent; duplicate-key recovery is covered explicitly.
