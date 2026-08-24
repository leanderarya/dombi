# Task 11 Report

## Scope
- Canonical obligation amount now drives payload amount; legacy Order amount remains fallback only.
- Finance refund counts use obligation-backed `whereHas` query rather than `Order::refundable()`.
- Rejected destination resubmission no longer references undefined rejection variables; method arguments remain authoritative.
- RefundService writes destination data to locked canonical obligations and transitions lifecycle states with proof/reference/note.
- Synthetic legacy attempts carry provenance and verified=false and are excluded from trusted attempt selection.
- No DOKU refund invocation added.

## Verification
- Refund suite: 100 passed, 248 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
