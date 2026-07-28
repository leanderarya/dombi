<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
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
}
