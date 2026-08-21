<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProductFlavorGroupMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_flavor_groups_table_exists(): void
    {
        $this->assertTrue(Schema::hasTable('product_flavor_groups'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups', 'product_category_id'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups', 'flavor'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups', 'normalized_flavor'));
        $this->assertTrue(Schema::hasColumn('product_flavor_groups', 'image'));
    }
}
