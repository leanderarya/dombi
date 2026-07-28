<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private function dropFkByColumn(string $table, string $column): void
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, $column)) {
            return;
        }

        // Try convention
        try {
            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->dropForeign([$column]);
            });
        } catch (\Throwable $e) {
        }

        // Query INFORMATION_SCHEMA for remaining FKs on that column
        try {
            $db = DB::getDatabaseName();
            $rows = DB::select(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL",
                [$db, $table, $column]
            );
            foreach ($rows as $row) {
                try {
                    DB::statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$row->CONSTRAINT_NAME}`");
                } catch (\Throwable $ex) {
                }
            }
        } catch (\Throwable $e) {
        }

        // Also try known old names
        foreach ([
            "{$table}_{$column}_foreign",
            "product_variants_{$column}_foreign",
            "product_families_{$column}_foreign",
            "products_{$column}_foreign",
            "outlet_variant_prices_{$column}_foreign",
        ] as $fkName) {
            try {
                DB::statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$fkName}`");
            } catch (\Throwable $ex) {
            }
        }
    }

    private function dropAllFks(string $table): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }
        try {
            $db = DB::getDatabaseName();
            $rows = DB::select(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
                [$db, $table]
            );
            foreach ($rows as $row) {
                try {
                    DB::statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$row->CONSTRAINT_NAME}`");
                } catch (\Throwable $ex) {
                }
            }
        } catch (\Throwable $e) {
        }
    }

    private function dropUniqueIfExists(string $table, array $columns, string $indexName = null): void
    {
        if (!Schema::hasTable($table)) {
            return;
        }
        // Try by columns
        try {
            Schema::table($table, function (Blueprint $t) use ($columns) {
                $t->dropUnique($columns);
            });
        } catch (\Throwable $e) {
        }
        if ($indexName) {
            try {
                Schema::table($table, function (Blueprint $t) use ($indexName) {
                    $t->dropUnique($indexName);
                });
            } catch (\Throwable $e) {
            }
            try {
                DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$indexName}`");
            } catch (\Throwable $e) {
            }
        }
    }

    public function up(): void
    {
        // 1. Drop all FKs that could block renames
        $variantTables = [
            'outlet_inventories',
            'order_items',
            'stock_movements',
            'restock_request_items',
            'return_request_items',
            'exchange_request_items',
            'favorites',
            'offline_sales',
            'pricing_audit_logs',
            'outlet_variant_prices',
        ];

        foreach ($variantTables as $tbl) {
            $this->dropFkByColumn($tbl, 'product_variant_id');
            $this->dropFkByColumn($tbl, 'product_id');
        }
        $this->dropFkByColumn('exchange_request_items', 'replacement_variant_id');
        $this->dropFkByColumn('exchange_request_items', 'replacement_product_id');
        $this->dropFkByColumn('product_variants', 'product_family_id');
        $this->dropFkByColumn('product_variants', 'product_id');
        $this->dropFkByColumn('products', 'product_category_id');
        $this->dropFkByColumn('products', 'product_family_id');

        // For legacy backup handling, drop all FKs from products and product_categories if they exist
        $this->dropAllFks('products');
        $this->dropAllFks('product_categories');

        // 2. Backup legacy products table
        if (Schema::hasTable('products') && Schema::hasTable('product_variants')) {
            if (Schema::hasTable('legacy_products_backup')) {
                Schema::drop('legacy_products_backup');
            }
            Schema::rename('products', 'legacy_products_backup');
        }

        // Backup legacy product_categories table
        if (Schema::hasTable('product_categories') && Schema::hasTable('product_families')) {
            if (Schema::hasTable('legacy_product_categories_backup')) {
                Schema::drop('legacy_product_categories_backup');
            }
            $this->dropAllFks('product_categories');
            Schema::rename('product_categories', 'legacy_product_categories_backup');
        }

        // 3. Rename product_families -> product_categories
        if (Schema::hasTable('product_families')) {
            Schema::rename('product_families', 'product_categories');
        }

        // 4. Rename product_variants -> products
        if (Schema::hasTable('product_variants')) {
            Schema::rename('product_variants', 'products');
        }

        // 5. Products table column handling
        if (Schema::hasTable('products')) {
            // Ensure any remaining FKs dropped
            $this->dropFkByColumn('products', 'product_family_id');
            $this->dropFkByColumn('products', 'product_category_id');
            $this->dropFkByColumn('products', 'product_id');

            if (Schema::hasColumn('products', 'product_family_id')) {
                Schema::table('products', function (Blueprint $t) {
                    $t->renameColumn('product_family_id', 'product_category_id');
                });
            }

            if (Schema::hasColumn('products', 'product_id')) {
                Schema::table('products', function (Blueprint $t) {
                    $t->dropColumn('product_id');
                });
            }

            if (!Schema::hasColumn('products', 'description')) {
                Schema::table('products', function (Blueprint $t) {
                    $t->text('description')->nullable()->after('name');
                });
            }
        }

        // 6. Handle dependent tables column renames
        // First, drop uniques that involve product_variant_id or product_id to avoid conflicts
        $this->dropUniqueIfExists('outlet_inventories', ['outlet_id', 'product_variant_id'], 'outlet_inventories_outlet_id_product_variant_id_unique');
        $this->dropUniqueIfExists('outlet_inventories', ['outlet_id', 'product_id'], 'outlet_inventories_outlet_id_product_id_unique');
        $this->dropUniqueIfExists('outlet_variant_prices', ['outlet_id', 'product_variant_id'], 'outlet_variant_prices_outlet_id_product_variant_id_unique');
        $this->dropUniqueIfExists('outlet_variant_prices', ['outlet_id', 'product_id'], 'outlet_variant_prices_outlet_id_product_id_unique');
        $this->dropUniqueIfExists('favorites', ['customer_id', 'product_variant_id'], 'favorites_customer_id_product_variant_id_unique');
        $this->dropUniqueIfExists('favorites', ['customer_id', 'product_id'], 'favorites_customer_id_product_id_unique');

        $renames = [
            'outlet_inventories',
            'order_items',
            'stock_movements',
            'restock_request_items',
            'return_request_items',
            'exchange_request_items',
            'favorites',
            'offline_sales',
            'pricing_audit_logs',
            'outlet_variant_prices',
        ];

        foreach ($renames as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            if (!Schema::hasColumn($table, 'product_variant_id')) {
                continue;
            }

            // If legacy product_id still exists, drop it
            if (Schema::hasColumn($table, 'product_id')) {
                $this->dropFkByColumn($table, 'product_id');
                try {
                    Schema::table($table, function (Blueprint $t) {
                        $t->dropColumn('product_id');
                    });
                } catch (\Throwable $e) {
                    // Try raw
                    try {
                        DB::statement("ALTER TABLE `{$table}` DROP COLUMN `product_id`");
                    } catch (\Throwable $ex) {
                    }
                }
            }

            // Now rename variant_id to product_id
            $this->dropFkByColumn($table, 'product_variant_id');
            try {
                Schema::table($table, function (Blueprint $t) {
                    $t->renameColumn('product_variant_id', 'product_id');
                });
            } catch (\Throwable $e) {
                // Fallback raw rename
                try {
                    DB::statement("ALTER TABLE `{$table}` RENAME COLUMN `product_variant_id` TO `product_id`");
                } catch (\Throwable $ex) {
                }
            }
        }

        // 7. replacement_variant_id -> replacement_product_id
        if (Schema::hasTable('exchange_request_items') && Schema::hasColumn('exchange_request_items', 'replacement_variant_id')) {
            $this->dropFkByColumn('exchange_request_items', 'replacement_variant_id');
            Schema::table('exchange_request_items', function (Blueprint $t) {
                $t->renameColumn('replacement_variant_id', 'replacement_product_id');
            });
        }

        // 8. Rename outlet_variant_prices -> outlet_product_prices
        if (Schema::hasTable('outlet_variant_prices')) {
            Schema::rename('outlet_variant_prices', 'outlet_product_prices');
        }

        // 9. Recreate FKs
        if (Schema::hasTable('products') && Schema::hasTable('product_categories') && Schema::hasColumn('products', 'product_category_id')) {
            try {
                Schema::table('products', function (Blueprint $t) {
                    $t->foreign('product_category_id')->references('id')->on('product_categories')->cascadeOnDelete();
                });
            } catch (\Throwable $e) {
            }
        }

        $fkDefs = [
            'outlet_inventories' => 'nullOnDelete',
            'order_items' => 'nullOnDelete',
            'stock_movements' => 'nullOnDelete',
            'restock_request_items' => 'nullOnDelete',
            'return_request_items' => 'cascadeOnDelete',
            'exchange_request_items' => 'cascadeOnDelete',
            'favorites' => 'cascadeOnDelete',
            'offline_sales' => 'cascadeOnDelete',
            'pricing_audit_logs' => 'cascadeOnDelete',
            'outlet_product_prices' => 'cascadeOnDelete',
        ];

        foreach ($fkDefs as $table => $onDelete) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'product_id')) {
                continue;
            }
            try {
                Schema::table($table, function (Blueprint $t) use ($onDelete) {
                    if ($onDelete === 'nullOnDelete') {
                        $t->foreign('product_id')->references('id')->on('products')->nullOnDelete();
                    } else {
                        $t->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
                    }
                });
            } catch (\Throwable $e) {
            }
        }

        if (Schema::hasTable('exchange_request_items') && Schema::hasColumn('exchange_request_items', 'replacement_product_id')) {
            try {
                Schema::table('exchange_request_items', function (Blueprint $t) {
                    $t->foreign('replacement_product_id')->references('id')->on('products')->nullOnDelete();
                });
            } catch (\Throwable $e) {
            }
        }

        // Recreate uniques
        if (Schema::hasTable('outlet_inventories')) {
            try {
                Schema::table('outlet_inventories', function (Blueprint $t) {
                    $t->unique(['outlet_id', 'product_id']);
                });
            } catch (\Throwable $e) {
            }
        }

        if (Schema::hasTable('outlet_product_prices')) {
            try {
                Schema::table('outlet_product_prices', function (Blueprint $t) {
                    $t->unique(['outlet_id', 'product_id']);
                });
            } catch (\Throwable $e) {
            }
        }

        if (Schema::hasTable('favorites')) {
            try {
                Schema::table('favorites', function (Blueprint $t) {
                    $t->unique(['customer_id', 'product_id']);
                });
            } catch (\Throwable $e) {
            }
        }
    }

    public function down(): void
    {
        // Drop FKs
        $tables = [
            'products',
            'outlet_inventories',
            'order_items',
            'stock_movements',
            'restock_request_items',
            'return_request_items',
            'exchange_request_items',
            'favorites',
            'offline_sales',
            'pricing_audit_logs',
            'outlet_product_prices',
        ];
        foreach ($tables as $tbl) {
            $this->dropAllFks($tbl);
        }

        // Drop uniques
        $this->dropUniqueIfExists('outlet_inventories', ['outlet_id', 'product_id'], 'outlet_inventories_outlet_id_product_id_unique');
        $this->dropUniqueIfExists('outlet_product_prices', ['outlet_id', 'product_id'], 'outlet_product_prices_outlet_id_product_id_unique');
        $this->dropUniqueIfExists('favorites', ['customer_id', 'product_id'], 'favorites_customer_id_product_id_unique');

        // Reverse renames for tables
        if (Schema::hasTable('product_categories') && Schema::hasTable('legacy_product_categories_backup')) {
            Schema::rename('product_categories', 'product_families');
            Schema::rename('legacy_product_categories_backup', 'product_categories');
        } elseif (Schema::hasTable('product_categories') && !Schema::hasTable('product_families')) {
            // If no legacy backup, assume product_categories is the renamed families
            Schema::rename('product_categories', 'product_families');
        }

        if (Schema::hasTable('products') && Schema::hasTable('legacy_products_backup')) {
            Schema::rename('products', 'product_variants');
            Schema::rename('legacy_products_backup', 'products');

            if (Schema::hasColumn('product_variants', 'product_category_id')) {
                $this->dropFkByColumn('product_variants', 'product_category_id');
                Schema::table('product_variants', function (Blueprint $t) {
                    $t->renameColumn('product_category_id', 'product_family_id');
                });
            }
            if (!Schema::hasColumn('product_variants', 'product_id')) {
                Schema::table('product_variants', function (Blueprint $t) {
                    $t->unsignedBigInteger('product_id')->nullable()->after('id');
                });
            }
        } elseif (Schema::hasTable('products')) {
            if (Schema::hasColumn('products', 'product_category_id')) {
                $this->dropFkByColumn('products', 'product_category_id');
                Schema::table('products', function (Blueprint $t) {
                    $t->renameColumn('product_category_id', 'product_family_id');
                });
            }
            Schema::rename('products', 'product_variants');
            if (!Schema::hasColumn('product_variants', 'product_id')) {
                Schema::table('product_variants', function (Blueprint $t) {
                    $t->unsignedBigInteger('product_id')->nullable()->after('id');
                });
            }
        }

        // Reverse column renames
        $reverseTables = [
            'outlet_inventories',
            'order_items',
            'stock_movements',
            'restock_request_items',
            'return_request_items',
            'exchange_request_items',
            'favorites',
            'offline_sales',
            'pricing_audit_logs',
            'outlet_product_prices',
        ];

        foreach ($reverseTables as $table) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'product_id')) {
                continue;
            }
            $this->dropFkByColumn($table, 'product_id');
            Schema::table($table, function (Blueprint $t) {
                $t->renameColumn('product_id', 'product_variant_id');
            });
        }

        if (Schema::hasTable('exchange_request_items') && Schema::hasColumn('exchange_request_items', 'replacement_product_id')) {
            $this->dropFkByColumn('exchange_request_items', 'replacement_product_id');
            Schema::table('exchange_request_items', function (Blueprint $t) {
                $t->renameColumn('replacement_product_id', 'replacement_variant_id');
            });
        }

        if (Schema::hasTable('outlet_product_prices')) {
            Schema::rename('outlet_product_prices', 'outlet_variant_prices');
        }

        // Recreate old uniques
        $this->dropUniqueIfExists('outlet_inventories', ['outlet_id', 'product_variant_id'], 'outlet_inventories_outlet_id_product_variant_id_unique');
        $this->dropUniqueIfExists('outlet_variant_prices', ['outlet_id', 'product_variant_id'], 'outlet_variant_prices_outlet_id_product_variant_id_unique');
        $this->dropUniqueIfExists('favorites', ['customer_id', 'product_variant_id'], 'favorites_customer_id_product_variant_id_unique');

        try {
            if (Schema::hasTable('outlet_inventories')) {
                Schema::table('outlet_inventories', function (Blueprint $t) {
                    $t->unique(['outlet_id', 'product_variant_id']);
                });
            }
        } catch (\Throwable $e) {
        }
        try {
            if (Schema::hasTable('outlet_variant_prices')) {
                Schema::table('outlet_variant_prices', function (Blueprint $t) {
                    $t->unique(['outlet_id', 'product_variant_id']);
                });
            }
        } catch (\Throwable $e) {
        }
        try {
            if (Schema::hasTable('favorites')) {
                Schema::table('favorites', function (Blueprint $t) {
                    $t->unique(['customer_id', 'product_variant_id']);
                });
            }
        } catch (\Throwable $e) {
        }
    }
};
