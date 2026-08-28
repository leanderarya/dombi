# Task 1 Report

Status: review fix applied; focused test runner unavailable.

Changes:
- Adjusted `test_store_customer_persists_auto_selected_default_address` to omit optional address metadata that frontend auto-selection does not submit.
- Keeps only supported POST contract: customer fields, selected `address_id`, required `address_line`, and coordinates.
- Asserts backend persists selected default address ID, address line, latitude, and longitude in `checkout.location`.

Checks:
- `php -l tests/Feature/CheckoutAddressPersistenceTest.php` — passed.
- `php artisan test tests/Feature/CheckoutAddressPersistenceTest.php` — blocked: Artisan `test` command unavailable.
- `vendor/bin/phpunit tests/Feature/CheckoutAddressPersistenceTest.php` — blocked: `vendor/bin/phpunit` absent.

Commit: pending.
