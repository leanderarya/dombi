# Task 11 Report

## Scope
- Canonical selected-obligation selector now uses latest eligible non-synthetic payment attempt, then highest obligation ID tie-break for same attempt.
- Order scope, selected relation, Finance canonical filters/counts/order, RefundService, and payload resolution use canonical selection; synthetic attempts cannot reorder lifecycle.
- Older obligations cannot surface when newer selected obligation exists.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
