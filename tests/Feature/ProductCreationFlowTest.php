<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCreationFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_created_with_zero_stock_and_then_initial_stock_setup(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);

        $cat = ProductCategory::factory()->create();

        $this->actingAs($owner)
            ->post("/owner/product-categories/{$cat->id}/products", [
                'name' => 'Coffee 200ml',
                'flavor' => 'Coffee',
                'size' => '200ml',
                'center_price' => 30000,
                'selling_price' => 40000,
                'product_category_id' => $cat->id,
            ])
            ->assertRedirect();

        $product = Product::latest()->first();
        $this->assertEquals(0, $product->center_stock);

        $this->actingAs($owner)
            ->patch("/owner/inventories/central-stock/{$product->id}", [
                'center_stock' => 100,
                'reason' => 'Stok awal',
            ]);

        $this->assertDatabaseHas('products', ['id' => $product->id, 'center_stock' => 100]);
    }

    public function test_bulk_create_multi_flavor(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $cat = ProductCategory::factory()->create(['name' => 'Domilk Premium Taste']);

        $this->actingAs($owner)
            ->post("/owner/product-categories/{$cat->id}/products/bulk", [
                'size' => '200ml',
                'center_price' => 15000,
                'selling_price' => 20000,
                'flavors' => ['Coffee', 'Chocolate', 'Strawberry', 'Vanilla'],
            ])
            ->assertRedirect();

        $this->assertEquals(4, Product::where('product_category_id', $cat->id)->count());
        $this->assertDatabaseHas('products', ['name' => 'Coffee 200ml']);
        $this->assertDatabaseHas('products', ['name' => 'Vanilla 200ml']);
    }
}
