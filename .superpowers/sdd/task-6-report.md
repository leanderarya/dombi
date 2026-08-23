# Task 6 report

## Verification

- `php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php`: PASS — 11 tests, 26 assertions.
- Focused Pint: PASS.
- Required combined command: FAIL — latest run 13 passed, 6 failed, 39 assertions.

Remaining failures are in legacy PaymentProductionInvariant expectations that still assume PaymentTransaction-only settlement, old pending mismatch projection, refund-history proxy behavior, or pre-canonical terminal status behavior. Canonical unit coverage passes lock-order, normalized invoice identity, terminal mismatch refund, duplicate claimant, stale event, and evidence semantics.

## Changes

- Canonical service locks attempt then order.
- Projection service locks attempts then order consistently.
- DOKU identity resolves canonical invoice first; transaction/original request values remain evidence/reference data.
- DOKU status sync passes full evidence and amount fallback from persisted attempt.
- DOKU callback path backfills canonical attempt from persisted transaction identity before transition.
- Terminal SUCCESS, including amount mismatch, records paid settlement and refund obligation without fulfilment.
- Retry creation creates one canonical attempt per invoice.
