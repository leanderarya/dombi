# Task 11 Report

## Scope
- Rejected destination resubmission transitions canonical obligation rejected→pending after valid encrypted destination write.
- Start/reject/rollback/complete validate canonical obligation destination and amount when obligation exists; legacy checks remain compatibility fallback only.
- Selected obligation query is constrained by reason/order/non-synthetic payment attempt and deterministically ordered by selected attempt.
- Payload amount uses canonical obligation amount; finance counts use obligation-backed query.
- No DOKU refund invocation added.

## Verification
- Refund suite: 100 passed, 248 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
