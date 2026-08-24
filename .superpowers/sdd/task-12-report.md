# Task 12 Report

## Findings fixed

- MySQL `up()` and `down()` each use one `Schema::getIndexes('stock_movements')` metadata guard before dropping `stock_movements_order_completed_unique`; duplicate nested guards removed.
- CI production matrix explicitly configures MySQL 8.4 and PostgreSQL 16 connection, port, credentials, and extensions.
- Production concurrency test fails instead of skipping when `CI=true` and SQLite is selected.
- CI runs expanded payment, Doku, fulfilment, inventory, settlement, and refund suites.
- Frontend CI uses non-mutating `npm run format:check` and `npm run lint:check`.

## Verification

- Focused Doku/fulfilment regression — passed, 18 tests / 47 assertions.
- Expanded PHP suite command covering 25 Task 12-related Feature files, run before final fixes — 236 tests, 231 passed, 4 failed, 1 skipped. Final focused Doku/fulfilment rerun passed, 18 tests / 47 assertions.
- `composer run lint:check` — passed.
- `npm run format:check` — failed: 4 untouched untracked files, `resources/js/components/outlet/assign-courier-sheet.tsx`, `resources/js/pages/guest/cancel.tsx`, `resources/js/pages/owner/product-families/index.tsx`, `resources/js/pages/owner/product-families/show.tsx`.
- `npm run lint:check` — failed: 29 errors, 1 warning in same untouched untracked files.
- `graphify update .` — passed: 7,214 nodes, 18,398 edges, 483 communities; graph outputs updated.
- MySQL/PostgreSQL CI driver suites not runnable locally because no production database services are configured in this environment; workflow explicitly provisions them.
