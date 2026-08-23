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
- Duplicate cleanup uses explicit retained/deleted IDs for portable migrations.
- Added `claimed_at` lease with five-minute stale recovery under row lock; failed workers become retryable.
- SQLite tests deterministically verify durable claim; production-driver test forks two real workers when MySQL/PostgreSQL and `pcntl` are available, otherwise skips with explicit reason.
- Parallel test asserts one durable request row and at most one successful/processing claim response.
- `php artisan test tests/Feature/DokuWebhookIngressTest.php tests/Unit/WebhookSecurityTest.php` — 16 passed.
- `composer run lint:check` — passed.
