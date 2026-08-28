# Task 15 — Null confirmation timeout fallback

- Fixed `Order` confirmation expiry timeout to treat explicitly null config as unset, then cast fallback value to integer.
- Existing focused feature test `test_pending_confirmation_uses_thirty_minute_fallback_when_config_is_unset` covers null config behavior.

Verification (2026-08-28):

- `php -l app/Models/Order.php` — pass.
- `git diff --check` — pass.
- `DB_PASSWORD= php artisan test tests/Feature/ExpirePendingOrdersTest.php` — unavailable: this project exposes no `artisan test` command in current environment.
