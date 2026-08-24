# Task 11 Report

## Scope
- Legacy fallback suppression now requires non-synthetic canonical obligation matching `orders.refund_reason`.
- Obligations for unrelated refund reasons cannot hide legacy refund rows.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
