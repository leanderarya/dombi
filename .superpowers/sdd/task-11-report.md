# Task 11 Report

## Scope
- Finance main query and counts constrain canonical lifecycle statuses, selected refund reason, and non-synthetic selected payment attempts.
- `Order::refundObligation` and `RefundService::canonicalObligation` exclude synthetic provenance and resolve deterministically by selected attempt/reason.
- Rejected destination resubmission uses canonical rejection metadata/status and transitions rejected→pending once without overwriting back to rejected.
- Proof fallback remains legacy-only when no canonical obligation exists.

## Verification
- Refund suite: 100 passed, 248 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
