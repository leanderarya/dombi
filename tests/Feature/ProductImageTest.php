<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
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

    public function test_category_has_no_image_field(): void
    {
        // Factory does not set image, so it's null via $fillable not including it
        $category = ProductCategory::factory()->create(['name' => 'Test Category']);
        $this->assertNull($category->getAttributes()['image'] ?? null);
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

    public function test_delete_product_image_endpoint(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'owner']);
        $category = ProductCategory::factory()->create();
        $path = 'products/prod-del-test.webp';
        Storage::disk('public')->put($path, 'content');

        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'product_flavor_group_id' => null,
            'image' => $path,
        ]);

        $response = $this->actingAs($user)
            ->delete("/owner/products/{$product->id}/image");

        $response->assertRedirect();
        $this->assertDatabaseHas('products', ['id' => $product->id, 'image' => null]);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_delete_product_image_idempotent(): void
    {
        $user = User::factory()->create(['role' => 'owner']);
        $category = ProductCategory::factory()->create();
        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'product_flavor_group_id' => null,
            'image' => null,
        ]);

        $response = $this->actingAs($user)
            ->delete("/owner/products/{$product->id}/image");

        $response->assertRedirect();
    }

    public function test_delete_flavor_group_image_endpoint(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'owner']);
        $category = ProductCategory::factory()->create();
        $path = 'products/flavor-del-test.webp';
        Storage::disk('public')->put($path, 'content');

        $flavorGroup = ProductFlavorGroup::factory()->create([
            'product_category_id' => $category->id,
            'image' => $path,
        ]);

        $response = $this->actingAs($user)
            ->delete("/owner/product-flavor-groups/{$flavorGroup->id}/image");

        $response->assertRedirect();
        $this->assertDatabaseHas('product_flavor_groups', ['id' => $flavorGroup->id, 'image' => null]);
        Storage::disk('public')->assertMissing($path);
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

    public function test_store_routes_image_to_flavor_group_for_flavored_product(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'owner']);
        $category = ProductCategory::factory()->create();
        $file = UploadedFile::fake()->image('grouped.jpg', 800, 800);

        $response = $this->actingAs($user)
            ->post("/owner/product-categories/{$category->id}/products", [
                'name' => 'Test Grouped',
                'flavor' => 'Chocolate',
                'size' => '200ml',
                'center_price' => 10000,
                'selling_price' => 15000,
                'image' => $file,
            ]);

        $response->assertRedirect();

        $product = Product::where('name', 'Test Grouped')->first();
        $this->assertNotNull($product);
        $this->assertNull($product->image);
        $this->assertNotNull($product->product_flavor_group_id);

        $this->assertNotNull($product->flavorGroup->image);
    }
}
