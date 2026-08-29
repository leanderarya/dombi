# Staging quality failure

- Fixed `tests/Feature/DokuReconciliationTest.php` unary operator spacing: `if (! $available)` → `if (!$available)`.
- Formatting-only; no behavior change.
- `git diff --check`: passed.
- PHP syntax check: unavailable (`php` not installed).
- Pint check: unavailable (`vendor/bin/pint` not present).
