# Task 12 Report

## Findings fixed

- Unknown expiry sweep handles terminal orders idempotently and continues batch after per-attempt failures.
- Definitive provider rejection now records canonical failed/expired settlement, updates order projection, and releases reservation through existing lifecycle.
- Fork race test closes parent transaction, purges/reconnects child connections, and asserts child/parent PDO readiness before work.

- CI changed-file frontend checks use separate Git pathspecs (no brace expansion); intended changed files are passed to Prettier/ESLint and failures propagate.
- Added scheduled `payments:expire-unknown` sweep for all unknown attempts, using same atomic `OrderStatusService::expireOrder` lifecycle as reconciliation.
- Production race setup now explicitly commits with failure reporting and verifies both attempts are visible before fork.

- CI production jobs set `CI=true`, assert matrix DB connection, and run explicit MySQL/PostgreSQL drivers; concurrency cannot silently use SQLite.
- CI frontend quality gates inspect changed frontend files only; unrelated repository baseline failures do not block Task 12, and no frontend files were modified.
- Legacy unknown attempts receive `reconciliation_deadline_at` on first reconciliation; deadline expiry uses `OrderStatusService::expireOrder` lifecycle atomically, including reservation release, status history, notifications, and projection.
- Added legacy-deadline and lifecycle reservation-release regressions.

- Unknown reconciliation attempts now receive a 24-hour deadline; before deadline, provider 404 remains unknown/retryable, while after deadline attempt atomically fails, preserves evidence, projects order retry/expiry state, and releases reserved inventory.
- Added deadline regression proving reservation release and no stuck unknown attempt.

- Matching order/attempt fulfilment claim now repairs missing attempt claim timestamp and returns idempotent winner without refund.
- DOKU status-check 404 remains unresolved/unknown as approved ambiguous provider-session lookup; definitive reconciliation outcomes still transition failed and release reservation through creation cleanup.
- MySQL fulfilment claim consistency is enforced with guarded insert/update triggers; PostgreSQL keeps the CHECK constraint.
- CI quality job now runs `composer run lint:check`; frontend format/ESLint remain non-mutating baseline gates.

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
- Relevant Task 12 suite — passed, 88 tests / 228 assertions, 1 skipped (SQLite-only production-driver gate locally).
- `composer run lint:check` — passed.
- Relevant Task 12 suite — passed, 87 tests / 231 assertions, 1 skipped (SQLite-only production-driver gate locally).
- `composer run lint:check` — passed.
- `graphify update .` — passed: 7,221 nodes, 18,423 edges, 503 communities; graph outputs updated.
- Frontend CI checks changed files only with separate pathspecs; local whole-repo baseline remains 4 format failures and 29 ESLint errors / 1 warning in untouched untracked files. Local CI is not claimed green; MySQL/PostgreSQL matrix is CI-only.
- Frontend CI changed-file format/ESLint policy committed; local whole-repo baseline remains 4 format failures and 29 ESLint errors / 1 warning in untouched untracked files. Local CI is not claimed green; MySQL/PostgreSQL matrix is CI-only.
- Focused retry/fulfilment/payment suite — passed, 87 tests / 226 assertions, 1 skipped.
- `composer run lint:check` — passed after Pint import-order fix.
- Local MySQL-backed regression passed; full MySQL/PostgreSQL CI matrix not run locally and is not claimed green.
- Frontend baseline policy: unrelated untracked frontend files remain untouched; `npm run format:check` and `npm run lint:check` are CI gates, not locally green. Local frontend baseline remains 4 format failures and 29 ESLint errors / 1 warning.
- Local MySQL tests were used for claim and 404 regressions; full MySQL/PostgreSQL CI matrix was not run locally and is not claimed green.
- MySQL/PostgreSQL CI driver suites not runnable locally because no production database services are configured in this environment; workflow explicitly provisions them.
