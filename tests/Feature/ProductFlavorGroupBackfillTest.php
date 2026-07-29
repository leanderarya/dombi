<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductFlavorGroupBackfillTest extends TestCase
{
    use RefreshDatabase;

    private function runBackfill(): void
    {
        $migration = require base_path('database/migrations/2026_07_30_000005_backfill_flavor_groups.php');
        $migration->up();
    }

    public function test_backfill_creates_groups_from_existing_products(): void
    {
        $cat = ProductCategory::factory()->create(['name' => 'Biogoat']);

        Product::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Coffee',
            'size' => '200ml',
        ]);
        Product::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Coffee',
            'size' => '500ml',
        ]);
        Product::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Chocolate',
            'size' => '200ml',
        ]);

        $this->runBackfill();

        $this->assertEquals(2, ProductFlavorGroup::where('product_category_id', $cat->id)->count());
    }

    public function test_null_flavor_products_get_per_product_groups(): void
    {
        $cat = ProductCategory::factory()->create(['name' => 'Susu Kambing']);

        $p1 = Product::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => null,
            'name' => 'Susu Kambing Original 1L',
            'size' => '1L',
        ]);
        $p2 = Product::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => null,
            'name' => 'Susu Kambing Premium 500ml',
            'size' => '500ml',
        ]);

        $this->runBackfill();

        $groups = ProductFlavorGroup::where('product_category_id', $cat->id)->get();
        $this->assertCount(2, $groups);

        $this->assertNotNull($p1->fresh()->product_flavor_group_id);
        $this->assertNotNull($p2->fresh()->product_flavor_group_id);
    }

    public function test_backfill_is_idempotent(): void
    {
        $cat = ProductCategory::factory()->create(['name' => 'Idem']);

        Product::factory()->count(2)->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Vanilla',
        ]);

        $this->runBackfill();
        $firstCount = ProductFlavorGroup::where('product_category_id', $cat->id)->count();

        $this->runBackfill();
        $secondCount = ProductFlavorGroup::where('product_category_id', $cat->id)->count();

        $this->assertEquals($firstCount, $secondCount);
    }

    public function test_flavor_group_model_normalizes_on_save(): void
    {
        $cat = ProductCategory::factory()->create();
        $fg = ProductFlavorGroup::create([
            'product_category_id' => $cat->id,
            'flavor' => '   Coffee   Mocha   ',
        ]);

        $this->assertSame('coffee mocha', $fg->normalized_flavor);
    }

    public function test_product_normalizes_size_on_save(): void
    {
        $cat = ProductCategory::factory()->create();
        $p = Product::factory()->create([
            'product_category_id' => $cat->id,
            'size' => ' 200 mL',
            'flavor' => 'Test',
        ]);

        $this->assertSame('200ml', $p->fresh()->normalized_size);
        $this->assertSame(200, $p->fresh()->size_value);
        $this->assertSame('ml', $p->fresh()->size_unit);
    }

    public function test_product_display_image_accessors(): void
    {
        $cat = ProductCategory::factory()->create();
        $fg = ProductFlavorGroup::create([
            'product_category_id' => $cat->id,
            'flavor' => 'Coffee',
        ]);

        $product = Product::factory()->create([
            'product_category_id' => $cat->id,
            'flavor' => 'Coffee',
            'product_flavor_group_id' => $fg->id,
        ]);

        $this->assertNull($product->display_image);
        $this->assertFalse($product->has_flavor_image);

        $fg->update(['image' => 'flavors/coffee.jpg']);
        $this->assertSame('flavors/coffee.jpg', $product->fresh()->display_image);
        $this->assertTrue($product->fresh()->has_flavor_image);
    }
}
