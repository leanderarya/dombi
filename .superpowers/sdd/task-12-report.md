# Task 12 Report

## Findings fixed

- MySQL `up()` and `down()` each use one `Schema::getIndexes('stock_movements')` metadata guard before dropping `stock_movements_order_completed_unique`; duplicate nested guards removed.
- CI production matrix explicitly configures MySQL 8.4 and PostgreSQL 16 connection, port, credentials, and extensions.
- Production concurrency test fails instead of skipping when `CI=true` and SQLite is selected.
- CI runs expanded payment, Doku, fulfilment, inventory, settlement, and refund suites.
- Frontend CI uses non-mutating `npm run format:check` and `npm run lint:check`.

## Verification

- Expanded PHP suite command covering 25 Task 12-related Feature files — 235 tests, 232 passed, 2 failed, 1 skipped. Failures: `DokuPaymentTest::test_webhook_success_marks_paid` and `DokuPaymentTest::test_redirect_proceeds_on_verified_status_api` expected `paid`, received `pending`.
- `composer run lint:check` — passed.
- `npm run format:check` — failed: 4 files, `assign-courier-sheet.tsx`, `guest/cancel.tsx`, `product-families/index.tsx`, `product-families/show.tsx`.
- `npm run lint:check` — failed: 29 errors, 1 warning in same untracked frontend files.
- `graphify update .` — passed: 7,213 nodes, 18,392 edges, 476 communities; graph outputs updated.
- MySQL/PostgreSQL CI driver suites not runnable locally because no production database services are configured in this environment; workflow explicitly provisions them.
