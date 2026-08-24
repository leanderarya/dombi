# Task 11 Report

## Scope
- Legacy fallback now ignores synthetic legacy obligations; only non-synthetic canonical obligations suppress legacy visibility.
- Canonical selected obligation remains authoritative when present.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
