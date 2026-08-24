# Task 11 Report

## Scope
- Payloads resolve one selected canonical obligation per payload; canonical encrypted destination, amount, proof, transfer data, status, and started timestamp take precedence.
- Finance ordering/counts remain obligation-backed and selected-attempt constrained.
- Request binds one non-synthetic selected payment attempt and its `(attempt_id, reason)` obligation; synthetic legacy attempts are excluded.
- Lifecycle transitions capture canonical timestamps and project matching values to legacy Order fields.
- No DOKU refund invocation added.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
