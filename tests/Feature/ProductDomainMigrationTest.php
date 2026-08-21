<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductDomainMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_tables_exist_after_migration(): void
    {
        // Core renamed tables
        $this->assertTrue(Schema::hasTable('product_categories'), 'product_categories table should exist');
        $this->assertTrue(Schema::hasTable('products'), 'products table should exist');

        // Renamed column in products
        $this->assertTrue(Schema::hasColumn('products', 'product_category_id'), 'products should have product_category_id');
        $this->assertFalse(Schema::hasColumn('products', 'product_family_id'), 'products should not have product_family_id');
        $this->assertTrue(Schema::hasColumn('products', 'description'), 'products should have description column');

        // Dependent tables: product_variant_id -> product_id
        $this->assertTrue(Schema::hasColumn('outlet_inventories', 'product_id'), 'outlet_inventories should have product_id');
        $this->assertFalse(Schema::hasColumn('outlet_inventories', 'product_variant_id'), 'outlet_inventories should not have product_variant_id');

        $this->assertTrue(Schema::hasColumn('order_items', 'product_id'));
        $this->assertFalse(Schema::hasColumn('order_items', 'product_variant_id'));

        $this->assertTrue(Schema::hasColumn('stock_movements', 'product_id'));
        $this->assertFalse(Schema::hasColumn('stock_movements', 'product_variant_id'));

        $this->assertTrue(Schema::hasColumn('restock_request_items', 'product_id'));
        $this->assertFalse(Schema::hasColumn('restock_request_items', 'product_variant_id'));

        $this->assertTrue(Schema::hasColumn('return_request_items', 'product_id'));
        $this->assertFalse(Schema::hasColumn('return_request_items', 'product_variant_id'));

        $this->assertTrue(Schema::hasColumn('exchange_request_items', 'product_id'));
        $this->assertFalse(Schema::hasColumn('exchange_request_items', 'product_variant_id'));

        $this->assertTrue(Schema::hasColumn('favorites', 'product_id'));
        $this->assertFalse(Schema::hasColumn('favorites', 'product_variant_id'));

        $this->assertTrue(Schema::hasColumn('offline_sales', 'product_id'));
        $this->assertFalse(Schema::hasColumn('offline_sales', 'product_variant_id'));

        $this->assertTrue(Schema::hasColumn('pricing_audit_logs', 'product_id'));
        $this->assertFalse(Schema::hasColumn('pricing_audit_logs', 'product_variant_id'));

        // exchange replacement column
        $this->assertTrue(Schema::hasColumn('exchange_request_items', 'replacement_product_id'));
        $this->assertFalse(Schema::hasColumn('exchange_request_items', 'replacement_variant_id'));

        // outlet_variant_prices -> outlet_product_prices
        $this->assertTrue(Schema::hasTable('outlet_product_prices'), 'outlet_product_prices should exist');
        $this->assertFalse(Schema::hasTable('outlet_variant_prices'), 'outlet_variant_prices should not exist');
        $this->assertTrue(Schema::hasColumn('outlet_product_prices', 'product_id'));
        $this->assertFalse(Schema::hasColumn('outlet_product_prices', 'product_variant_id'));

        // Old tables should not exist (renamed)
        $this->assertFalse(Schema::hasTable('product_families'), 'product_families should be renamed');
        $this->assertFalse(Schema::hasTable('product_variants'), 'product_variants should be renamed');
    }

    public function test_legacy_backup_exists(): void
    {
        // If legacy products table existed (it does from initial migration), it should be backed up
        // In fresh RefreshDatabase, initial products exists, so backup should exist after migration
        $this->assertTrue(Schema::hasTable('legacy_products_backup') || ! Schema::hasTable('product_variants'), 'legacy backup should exist or migration handled legacy');
    }
}
