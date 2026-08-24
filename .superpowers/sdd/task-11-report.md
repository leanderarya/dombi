# Task 11 Report

## Scope
- Canonical action_required selector includes stale in_progress (`started_at <= 24h`) and failed obligations.
- Legacy action_required fallback includes stale legacy in_progress and refund_failed only when no matching canonical obligation exists.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
