<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCategoryControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_category(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $this->actingAs($owner)->post('/owner/product-categories', ['name' => 'Biogoat', 'brand' => 'Dombi'])->assertRedirect();
        $this->assertDatabaseHas('product_categories', ['name' => 'Biogoat']);
    }

    public function test_owner_can_view_categories_index(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $response = $this->actingAs($owner)->get('/owner/product-categories');
        $response->assertStatus(200);
    }

    public function test_owner_can_create_product_under_category(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $category = ProductCategory::factory()->create(['name' => 'TestCat']);

        $this->actingAs($owner)->post("/owner/product-categories/{$category->id}/products", [
            'name' => 'Original 1L',
            'center_price' => 30000,
            'selling_price' => 40000,
        ])->assertRedirect();

        $this->assertDatabaseHas('products', ['name' => 'Original 1L', 'product_category_id' => $category->id]);
    }

    public function test_owner_can_bulk_create_products(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $category = ProductCategory::factory()->create();

        $this->actingAs($owner)->post("/owner/product-categories/{$category->id}/products/bulk", [
            'flavors' => ['Chocolate', 'Coffee'],
            'size' => '200ml',
            'center_price' => 15000,
            'selling_price' => 20000,
        ])->assertRedirect();

        $this->assertDatabaseCount('products', 2);
    }

    public function test_owner_can_toggle_product(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $product = Product::factory()->create(['is_active' => true]);

        $this->actingAs($owner)->patch("/owner/products/{$product->id}/toggle")->assertRedirect();
        $this->assertDatabaseHas('products', ['id' => $product->id, 'is_active' => false]);
    }

    public function test_owner_can_duplicate_product(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $product = Product::factory()->create(['name' => 'Original']);

        $this->actingAs($owner)->post("/owner/products/{$product->id}/duplicate")->assertRedirect();
        $this->assertDatabaseHas('products', ['name' => 'Original Copy']);
    }
}
