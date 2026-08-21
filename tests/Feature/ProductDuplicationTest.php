<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductDuplicationTest extends TestCase
{
    use RefreshDatabase;

    public function test_duplicate_copies_except_sku_and_stock(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $cat = ProductCategory::factory()->create(['name' => 'Biogoat']);
        $product = Product::factory()->create([
            'product_category_id' => $cat->id,
            'name' => 'Original 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 30000,
            'selling_price' => 40000,
            'center_stock' => 50,
            'sku' => 'BIO-ORI-001',
            'description' => 'Test product',
        ]);

        $this->actingAs($owner)
            ->post("/owner/products/{$product->id}/duplicate");

        $copy = Product::where('name', 'Original 1L Copy')->first();
        $this->assertNotNull($copy);
        $this->assertEquals(0, $copy->center_stock);
        $this->assertNotEquals($product->sku, $copy->sku);
        $this->assertEquals($product->flavor, $copy->flavor);
        $this->assertEquals($product->size, $copy->size);
        $this->assertEquals($product->center_price, $copy->center_price);
        $this->assertEquals($product->selling_price, $copy->selling_price);
        $this->assertEquals($product->description, $copy->description);
    }

    public function test_duplicate_generates_new_sku(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $cat = ProductCategory::factory()->create(['name' => 'Domilk']);
        $product = Product::factory()->create([
            'product_category_id' => $cat->id,
            'name' => 'Chocolate 200ml',
            'sku' => 'DOM-CHO-200-001',
        ]);

        $this->actingAs($owner)
            ->post("/owner/products/{$product->id}/duplicate");

        $copy = Product::where('name', 'Chocolate 200ml Copy')->first();
        $this->assertNotNull($copy);
        $this->assertNotNull($copy->sku);
        $this->assertStringContainsString('DOM', $copy->sku);
        $this->assertNotEquals('DOM-CHO-200-001', $copy->sku);
    }
}
