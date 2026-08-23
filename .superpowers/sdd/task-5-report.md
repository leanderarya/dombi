# Task 5 Report

- Added aggregate order payment projection service.
- Projection now runs inside one database transaction, locks order and payment attempts, and updates order projection atomically.
- Initiated/created creation states force pending precedence even when settlement is terminal or null.
- Added regressions for creation-state precedence and verified paid preservation after later failed/expired attempts.
- Concurrent recompute/attempt insertion test not added: repository test database is SQLite and does not provide reliable parallel transaction/process locking semantics.
- Focused tests: `php artisan test tests/Unit/OrderPaymentProjectionServiceTest.php` — 4 passed, 14 assertions.
- Lint: `vendor/bin/pint --test ...` — passed.
