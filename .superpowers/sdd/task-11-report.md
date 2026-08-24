# Task 11 Report

## Scope
- Deterministic selected canonical obligation remains shared by payload behavior and selected-attempt/reason resolution; synthetic provenance excluded.
- UI statuses map canonical lifecycle values to legacy capability values only at payload boundary.
- RefundService lifecycle gates canonical obligation status exclusively when present; legacy payment status is fallback only when absent.
- Canonical started datetime cast is used for payload queue/capability timestamps.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
