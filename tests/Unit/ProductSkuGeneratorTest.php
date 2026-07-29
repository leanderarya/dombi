<?php

namespace Tests\Unit;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use App\Services\ProductSkuGenerator;
use Tests\TestCase;

class ProductSkuGeneratorTest extends TestCase
{
    public function test_generates_deterministic_sku(): void
    {
        $gen = app(ProductSkuGenerator::class);
        $cat = (object) ['name' => 'Biogoat'];
        $sku = $gen->generate($cat, 'Original 1L', 'Original', '1L', 1);
        $this->assertEquals('BIO-ORI-1L-001', $sku);
        $sku2 = $gen->generate($cat, 'Chocolate 1L', 'Chocolate', '1L', 2);
        $this->assertEquals('BIO-CHO-1L-002', $sku2);
    }

    public function test_unique_uses_max_sequence_plus_one(): void
    {
        $cat = ProductCategory::factory()->create(['name' => 'TestCat']);
        $group = ProductFlavorGroup::factory()->create(['product_category_id' => $cat->id, 'flavor' => 'Coffee']);
        Product::factory()->create(['product_category_id' => $cat->id, 'product_flavor_group_id' => $group->id, 'sku' => 'TES-COF-200-005']);
        $gen = app(ProductSkuGenerator::class);
        $sku = $gen->uniqueForGroup($group->id, 'Coffee 200ml', 'Coffee', '200ml');
        $this->assertStringEndsWith('006', $sku);
    }
}
