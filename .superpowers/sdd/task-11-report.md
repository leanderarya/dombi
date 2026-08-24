# Task 11 Report

## Scope
- Added reusable `Order::withCanonicalRefund` selector constrained to selected reason, latest non-synthetic payment attempt, and canonical obligation.
- Finance base/count queries use canonical selector; queue filters retain canonical lifecycle status constraints.
- Refund payload status normalization centralized at UI response boundary.
- Synthetic provenance excluded consistently.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
