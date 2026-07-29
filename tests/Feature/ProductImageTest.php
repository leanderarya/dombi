<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use App\Services\ProductImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductImageTest extends TestCase
{
    use RefreshDatabase;

    public function test_upload_image_service(): void
    {
        Storage::fake('public');

        $service = app(ProductImageService::class);
        $uploaded = UploadedFile::fake()->image('product.jpg', 800, 800);
        $path = $service->store($uploaded, null);

        $this->assertStringEndsWith('.webp', $path);
        Storage::disk('public')->assertExists($path);
    }

    public function test_image_fallback_chain(): void
    {
        $cat = ProductCategory::factory()->create(['image' => 'products/cat.webp']);
        $product = Product::factory()->create([
            'product_category_id' => $cat->id,
            'image' => null,
        ]);

        $this->assertNull($product->image);
        $this->assertEquals('products/cat.webp', $product->category->image);

        $productWithImage = Product::factory()->create([
            'product_category_id' => $cat->id,
            'image' => 'products/prod.webp',
        ]);

        $this->assertEquals('products/prod.webp', $productWithImage->image);
    }

    public function test_display_image_flavored_returns_flavor_group_only(): void
    {
        $category = ProductCategory::factory()->create();
        $flavorGroup = ProductFlavorGroup::factory()->create([
            'product_category_id' => $category->id,
            'image' => 'products/flavor-test.webp',
        ]);

        // Product with flavor group AND its own image — must return flavorGroup image only
        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'product_flavor_group_id' => $flavorGroup->id,
            'image' => 'products/override.webp', // should be ignored
        ]);

        $this->assertSame('products/flavor-test.webp', $product->display_image);
        $this->assertTrue($product->has_flavor_image);
    }

    public function test_display_image_flavorless_returns_own_image(): void
    {
        $product = Product::factory()->create([
            'product_flavor_group_id' => null,
            'image' => 'products/no-flavor.webp',
        ]);

        $this->assertSame('products/no-flavor.webp', $product->display_image);
        $this->assertFalse($product->has_flavor_image);
    }

    public function test_display_image_flavorless_no_image_returns_null(): void
    {
        $product = Product::factory()->create([
            'product_flavor_group_id' => null,
            'image' => null,
        ]);

        $this->assertNull($product->display_image);
        $this->assertFalse($product->has_flavor_image);
    }

    public function test_display_image_flavored_no_flavor_group_image_returns_null(): void
    {
        $category = ProductCategory::factory()->create();
        $flavorGroup = ProductFlavorGroup::factory()->create([
            'product_category_id' => $category->id,
            'image' => null,
        ]);
        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'product_flavor_group_id' => $flavorGroup->id,
            'image' => null,
        ]);

        $this->assertNull($product->display_image);
        $this->assertFalse($product->has_flavor_image);
    }
}
