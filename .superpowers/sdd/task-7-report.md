# Task 7 Report

Implemented durable DOKU webhook ingress separation and review fixes.

- Missing `Request-Id` rejects before persistence.
- Stored body digest is validated for every duplicate; conflicts return `409`.
- Processed duplicates return idempotent success; retryable/error records reprocess; signature-invalid records reject.
- Exact raw-body signature, timestamp freshness, durable persistence, and retry status are covered.
- Focused tests cover cache-independent deduplication, retry reprocessing, missing ID, digest conflict, stale timestamp, and exact-body digest.

Verification:

- `php artisan test tests/Feature/DokuWebhookIngressTest.php tests/Unit/WebhookSecurityTest.php` — 14 passed.
- `composer run lint:check` — passed.
- Duplicate cleanup explicitly retains a processed row when available, otherwise newest row, then deletes all other IDs; portable migration regression covered.
- Unique-constraint race recovery performs bounded committed-row lookup before status-based claim/reprocess, returning `503` only when row visibility fails.
- Signature authentication now precedes all durable mutation; invalid duplicates cannot mutate valid rows.
- Duplicate digest/status decisions and valid claims occur in one row-locked transaction after authentication.
- Historical rows without original raw bytes are marked retryable/reprocess-required; migration never fabricates signed evidence.
- Added `.github/workflows/task-7-production.yml` Laravel key/env setup and MySQL readiness wait before migration; production concurrency gate remains mandatory.
- Added `claimed_at` lease with five-minute stale recovery under row lock; failed workers become retryable.
- SQLite tests deterministically verify durable claim; CI production-driver gate must run the forked two-worker test on MySQL/PostgreSQL with `pcntl`; local SQLite runs skip with explicit reason.
- Parallel test writes actual newline-delimited worker results, requires exactly two result lines, then asserts one durable request row and at most one successful/processing claim response.
- Restored `Log` facade import in `DokuPaymentController`.
- `php artisan test tests/Feature/DokuWebhookIngressTest.php tests/Unit/WebhookSecurityTest.php` — 16 passed.
- `composer run lint:check` — passed.
