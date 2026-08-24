# Task 11 Report

## Scope
- Canonical destination fields are exclusive whenever obligation exists; legacy destination fallback only when obligation absent, including masked customer destination.
- Finance rows/counts eager-load payment attempts and obligations so payload queue resolution avoids per-order obligation queries.
- Canonical selection and synthetic exclusion preserved.

## Verification
- Refund suite: 104 passed, 272 assertions.
- `composer run lint:check`: passed.
- `graphify update .`: passed.
