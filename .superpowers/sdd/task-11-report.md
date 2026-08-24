# Task 11 Report

## Scope
- Rejected destination resubmission routes canonical rejected→pending through `RefundObligationService::transition`, clearing rejection/started metadata and setting canonical timestamp.
- Rollback routes canonical in_progress→pending through transition, clearing started timestamp/metadata while retaining rollback projection/history.
- Legacy Order fields remain compatibility projections.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
