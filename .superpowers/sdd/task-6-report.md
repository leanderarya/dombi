# Task 6 report

Canonical payment transition review fixes implemented.

## Verification

- `php artisan test tests/Unit/CanonicalPaymentTransitionServiceTest.php`: PASS (10 tests, 23 assertions)
- Combined required suite: run after final lint; legacy invariant failures are recorded below.
- Focused Pint: run after final edits.

## Review fixes

- Same claimed attempt is idempotent and never creates a self-refund.
- Only distinct paid attempts can lose fulfilment and create one obligation.
- DOKU callback references normalize to canonical invoice when gateway transaction reference is absent.
- Accepted references remain bounded to persisted attempt invoice or stored gateway reference.
- Legacy `markOrderPaid` now requires and routes through a canonical attempt; no direct PaymentStatusService bypass.
- Stale `receivedAt` events are ignored without overwriting state or evidence.
- Tests separate same-attempt duplicates, stale events, and distinct-attempt loser behavior.
- No automatic DOKU refund call.

## Expected combined-suite failures

Existing `PaymentProductionInvariantTest` contains legacy PaymentTransaction-only expectations. Those cases intentionally conflict with Task 6 canonical-attempt-only ownership: transaction-only callbacks do not settle orders, amount-mismatch settlement is paid/needs-review at attempt level, and legacy refund proxies are not canonical obligations.
