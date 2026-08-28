# Task 1 Report: Centralize timeout configuration

## Changes

- Added typed `order.doku_reconciliation_deadline_hours` config with default `24`.
- Preserved and typed confirmation timeout default `30` and payment retry window default `15`.
- Updated `OrderService` fallback to `config('order.confirmation_timeout_minutes', 30)`.
- Updated both DOKU reconciliation deadline calculations to use centralized config.
- Added `tests/Unit/OrderTimingConfigTest.php` covering defaults and runtime overrides.
- Ran `graphify update .` after code changes.

## Verification

- PHP lint passed for `config/order.php`, `app/Services/OrderService.php`, `app/Services/DokuService.php`.
- `git diff --check` passed.
- `php artisan test --filter='OrderTimingConfig|DokuReconciliation|OrderService'` unavailable: this project does not define `artisan test`.
- `vendor/bin/phpunit` unavailable: PHPUnit dependencies/binary are not installed.
- npm checks not run; task workspace has no installed test runner verification available.

## Commit

`5ff6a489 fix: centralize order expiry timing`
