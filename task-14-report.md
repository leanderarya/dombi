# Task 14 — Payment production matrix/invariants

Implemented option 1 scoped fixes.

- Cache mock now stubs `forget` used by observability failure path.
- Queue assertions use database jobs count; compatible with sync queue.
- Owner-path taxonomy fixture runs inside transaction; unavailable after-commit event paths remain explicitly incomplete.
- Reconcile dry-run assertion matches selected-attempt report.
- Duplicate retry and late-success assertions align canonical-only behavior: no legacy payment transaction fulfillment; canonical late success remains paid attempt without duplicate legacy paid row/refund obligation.

Verification (2026-08-24):

- `DB_PASSWORD= php artisan test tests/Feature/PaymentProductionMatrixTest.php tests/Feature/PaymentProductionInvariantTest.php` — pass: 22 passed, 1 incomplete, 61 assertions.
- `npm run types:check` — pass.
- `composer run lint:check` — pass (Pint 661 files).

Incomplete test is intentional: late, duplicate, reconciliation, and refund-ageing owner paths require available MySQL fixtures. No production readiness claim.
