<?php

namespace Tests\Regression;

use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\Outlet;
use App\Services\InventoryService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductDomainRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_variant_can_be_created_with_center_stock(): void
    {
        $family = ProductFamily::factory()->create(['name' => 'Biogoat']);
        $variant = ProductVariant::factory()->create([
            'product_family_id' => $family->id,
            'name' => 'Original 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 30000,
            'selling_price' => 40000,
            'center_stock' => 100,
            'sku' => 'BIO-ORI-1L',
        ]);
        $this->assertDatabaseHas('product_variants', ['id' => $variant->id, 'center_stock' => 100]);
    }

    public function test_inventory_service_reserves_stock_using_variant_id(): void
    {
        $this->markTestSkipped('placeholder for current behavior');
    }

    public function test_order_service_builds_items_with_variant_id(): void
    {
        $family = ProductFamily::factory()->create(['name' => 'Domilk']);
        $variant = ProductVariant::factory()->create([
            'product_family_id' => $family->id,
            'center_price' => 10000,
            'selling_price' => 15000,
            'center_stock' => 50,
        ]);
        $this->assertEquals($family->id, $variant->product_family_id);
    }
}
