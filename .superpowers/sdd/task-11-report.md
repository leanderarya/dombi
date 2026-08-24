# Task 11 Report

## Scope
- Finance base query now uses `Order::withCanonicalRefund` deterministic selector with selected reason, latest non-synthetic attempt, and obligation tie-break.
- Awaiting-customer queue uses same canonical selector with pending/no-destination constraints.
- Synthetic attempts excluded from canonical finance selection.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
