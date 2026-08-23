# Task 6 report

Implemented canonical payment transition flow with normalized DOKU event input and review fixes.

## Verification

- `php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php`: PASS (8 tests, 18 assertions)
- Focused Pint check: run after final changes.
- Combined production invariant suite: expected legacy failures remain because tests assert pre-canonical behavior. Canonical events now require canonical attempts; amount mismatch records paid settlement with review; no-attempt DOKU events no longer settle orders.

## Review fixes

- Lock order now matches `OrderPaymentProjectionService`: order first, then attempts.
- Gateway references must match attempt invoice or stored gateway reference; null stored references no longer bypass rejection.
- Verified status is monotonic and cannot be downgraded by anomalous SUCCESS events.
- Every accepted event persists gateway evidence and metadata, even when state is unchanged.
- DOKU no longer falls back to legacy `PaymentStatusService` settlement when no canonical attempt exists.
- Added unknown, reference, currency, verification monotonicity, evidence, and claimant regression coverage.
- No automatic DOKU refund call.
