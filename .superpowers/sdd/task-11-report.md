# Task 11 Report

## Scope
- All Finance queue filters use `Order::withCanonicalRefund` selected-obligation scope; no queue any-obligation predicates remain.
- Finance counts use same canonical scope and lifecycle status set as rows.
- Selected reason, latest non-synthetic attempt, and obligation tie-break remain centralized in Order selector.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
