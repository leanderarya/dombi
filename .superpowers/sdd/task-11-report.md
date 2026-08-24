# Task 11 Report

## Scope
- Finance refund query and counts constrain selected refund reason, non-synthetic payment attempts, and deterministic canonical obligation relation.
- Proof controller falls back to legacy proof only when no canonical obligation exists; canonical incomplete proof is unavailable.
- RefundService canonical obligation lookup excludes synthetic attempts and matches order-selected reason/attempt.
- Canonical status gates lifecycle operations; legacy status checks remain fallback only when obligation is absent.
- Rejected destination resubmission eligibility uses canonical rejected status and rejection metadata, then transitions to pending.

## Verification
- Refund suite: 100 passed, 248 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
