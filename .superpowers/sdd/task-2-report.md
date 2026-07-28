# Task 2: DB Migration – Rename Tables & Columns (Phase 3)

**Status:** DONE

**Commit SHA:** pending (see git log after commit)

**Test Summary:**
- Created `tests/Feature/ProductDomainMigrationTest.php` with TDD approach
- Initial run: FAIL (2 failures) – outlet_inventories still had product_variant_id, legacy backup missing – confirms old schema
- After migration: PASS (2 tests, 32 assertions) – verifies:
  - product_categories & products tables exist
  - product_family_id → product_category_id, description column added
  - 10 dependent tables: product_variant_id → product_id, product_variant_id absent
  - replacement_variant_id → replacement_product_id
  - outlet_variant_prices → outlet_product_prices
  - product_families & product_variants no longer exist
  - legacy backup tables created

**Migration File:**
- `database/migrations/2026_07_30_000001_refactor_product_domain.php`
- Handles:
  - Backup legacy `products` → `legacy_products_backup` when both products & product_variants exist
  - Backup legacy `product_categories` → `legacy_product_categories_backup` when both categories & families exist (conflict from initial core tables migration)
  - Rename `product_families` → `product_categories`
  - Rename `product_variants` → `products`
  - Drop FKs robustly via INFORMATION_SCHEMA queries to handle MySQL FK name mismatches after renames (e.g., product_variants_*_foreign still on products table)
  - Drop legacy product_id columns in products and dependent tables to avoid duplicate column conflict when renaming
  - Handles unique indexes: outlet_inventories, outlet_variant_prices, favorites – drop before rename, recreate after
  - Add `description` column if missing
  - Rename `outlet_variant_prices` → `outlet_product_prices`
  - Recreate FKs: products.product_category_id → product_categories, all dependent product_id → products, replacement_product_id → products
  - Down migration reverses all

**Key Fixes for MySQL:**
- Custom `dropFkByColumn` that tries Laravel convention, then INFORMATION_SCHEMA, then known old FK names
- `dropAllFks` for bulk dropping before table renames
- Avoids SQLite renameColumn issues – tests run on MySQL dombi_test (DB_PASSWORD=140504 locally)
- Fresh migration run: `php artisan migrate:fresh` succeeds in 368ms for this migration

**Commands:**
```bash
php artisan test tests/Feature/ProductDomainMigrationTest.php
# → PASS 2 tests, 32 assertions

php artisan migrate:fresh --force
# → 2026_07_30_000001_refactor_product_domain ... DONE
```

**Commits:**
- `feat: migrate product domain tables product_families→categories, product_variants→products`

**Report Path:** `.superpowers/sdd/task-2-report.md`

**Notes:**
- phpunit.xml locally adjusted DB_PASSWORD to 140504 to connect to MySQL dombi_test; not included in commit per task spec.
- Migration compatible with existing ProductFamily/ProductVariant models temporarily – models still reference old tables but after migration will need Phase 4 model renames.
- Legacy backups preserved for rollback safety.
