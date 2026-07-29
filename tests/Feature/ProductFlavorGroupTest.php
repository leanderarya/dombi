<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductFlavorGroupTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_display_image_returns_flavor_group_image(): void
    {
        $cat = ProductCategory::factory()->create();
        $fg = ProductFlavorGroup::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Coffee',
            'image' => 'products/coffee.webp',
        ]);
        $p = Product::factory()->create([
            'product_category_id' => $cat->id,
            'product_flavor_group_id' => $fg->id,
            'flavor' => 'Coffee',
            'size' => '200ml',
            'image' => null,
        ]);
        $this->assertEquals('products/coffee.webp', $p->flavorGroup->image);
        $this->assertEquals('products/coffee.webp', $p->display_image);
    }

    public function test_products_same_group_same_display_image(): void
    {
        $cat = ProductCategory::factory()->create();
        $fg = ProductFlavorGroup::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Coffee',
            'image' => 'coffee.webp',
        ]);
        $p1 = Product::factory()->create([
            'product_category_id' => $cat->id,
            'product_flavor_group_id' => $fg->id,
            'size' => '200ml',
        ]);
        $p2 = Product::factory()->create([
            'product_category_id' => $cat->id,
            'product_flavor_group_id' => $fg->id,
            'size' => '500ml',
        ]);
        $this->assertEquals($p1->display_image, $p2->display_image);
    }

    public function test_replacing_group_image_affects_all_sizes(): void
    {
        $cat = ProductCategory::factory()->create();
        $fg = ProductFlavorGroup::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Coffee',
            'image' => 'old.webp',
        ]);
        $p1 = Product::factory()->create([
            'product_category_id' => $cat->id,
            'product_flavor_group_id' => $fg->id,
            'size' => '200ml',
        ]);
        $fg->update(['image' => 'new.webp']);
        $this->assertEquals('new.webp', $p1->fresh()->flavorGroup->image);
    }

    public function test_bulk_size_atomic_rollback(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $cat = ProductCategory::factory()->create();

        $response = $this->actingAs($owner)->post(
            route('owner.product-categories.products.bulk-size', $cat),
            [
                'flavor' => 'Matcha',
                'sizes' => [
                    ['size' => '200ml', 'center_price' => 25000, 'selling_price' => 35000],
                    ['size' => '200ml', 'center_price' => 30000, 'selling_price' => 40000],
                ],
            ]
        );

        $response->assertSessionHasErrors();
        $this->assertEquals(0, Product::where('product_category_id', $cat->id)->count());
        $this->assertEquals(0, ProductFlavorGroup::where('product_category_id', $cat->id)->count());
    }

    public function test_normalized_flavor_uniqueness(): void
    {
        $cat = ProductCategory::factory()->create();
        ProductFlavorGroup::factory()->create(['product_category_id' => $cat->id, 'flavor' => 'Coffee']);
        $this->expectException(QueryException::class);
        ProductFlavorGroup::factory()->create(['product_category_id' => $cat->id, 'flavor' => ' coffee ']);
    }

    public function test_normalized_size_uniqueness_in_group(): void
    {
        $cat = ProductCategory::factory()->create();
        $fg = ProductFlavorGroup::factory()->create(['product_category_id' => $cat->id, 'flavor' => 'Coffee']);
        Product::factory()->create([
            'product_category_id' => $cat->id,
            'product_flavor_group_id' => $fg->id,
            'size' => '200ml',
        ]);
        $this->expectException(QueryException::class);
        Product::factory()->create([
            'product_category_id' => $cat->id,
            'product_flavor_group_id' => $fg->id,
            'size' => '200 ml',
        ]);
    }
}
