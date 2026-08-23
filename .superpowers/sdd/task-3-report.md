# Task 3 Report

## Review fixes
- Order `order_code` is canonical invoice identity whenever available; provider ID remains gateway transaction identity.
- Missing order/provider identities synthesize deterministic invoice, attempt, and request values.
- `session_id` and `token_id` are preserved separately; `session_token` remains compatibility fallback.
- Legacy `raw_response` is stored in canonical `payment_attempts.raw_response`.
- Migration preflight checks duplicate non-null legacy links before applying unique/FK constraints and fails explicitly with duplicate IDs.

## Verification
- `php artisan test tests/Feature/PaymentAttemptBackfillTest.php` — PASS, 4 tests, 27 assertions.
- `composer run lint:check` — pending after final migration formatting.
- `git diff --check` — pending after final migration formatting.

## Scope
Task 3 files only. Existing unrelated uncommitted files preserved.
