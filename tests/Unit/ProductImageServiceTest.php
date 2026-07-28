<?php

namespace Tests\Unit;

use App\Services\ProductImageService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductImageServiceTest extends TestCase
{
    private ProductImageService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(ProductImageService::class);
    }

    public function test_stores_webp_and_deletes_old(): void
    {
        Storage::fake('public');

        $uploaded = UploadedFile::fake()->image('biogoat.jpg', 1200, 800);
        $path = $this->service->store($uploaded, null);

        $this->assertStringEndsWith('.webp', $path);
        $this->assertStringStartsWith('products/', $path);
        Storage::disk('public')->assertExists($path);

        // Store second time with old path - old should be deleted
        $uploaded2 = UploadedFile::fake()->image('biogoat2.jpg', 800, 800);
        $path2 = $this->service->store($uploaded2, $path);

        $this->assertStringEndsWith('.webp', $path2);
        Storage::disk('public')->assertExists($path2);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_store_returns_old_path_when_no_file(): void
    {
        Storage::fake('public');

        $oldPath = 'products/old.webp';
        Storage::disk('public')->put($oldPath, 'dummy');

        $result = $this->service->store(null, $oldPath);

        $this->assertEquals($oldPath, $result);
        Storage::disk('public')->assertExists($oldPath);
    }

    public function test_store_returns_null_when_both_null(): void
    {
        Storage::fake('public');

        $result = $this->service->store(null, null);

        $this->assertNull($result);
    }

    public function test_delete_removes_file(): void
    {
        Storage::fake('public');

        $path = 'products/to-delete.webp';
        Storage::disk('public')->put($path, 'content');

        $this->service->delete($path);

        Storage::disk('public')->assertMissing($path);
    }

    public function test_delete_handles_null_safely(): void
    {
        Storage::fake('public');

        $this->service->delete(null);
        $this->service->delete('');

        // Should not throw
        $this->assertTrue(true);
    }

    public function test_delete_handles_missing_file(): void
    {
        Storage::fake('public');

        $this->service->delete('products/nonexistent.webp');

        $this->assertTrue(true);
    }

    public function test_stored_image_is_valid_webp(): void
    {
        Storage::fake('public');

        $uploaded = UploadedFile::fake()->image('test.png', 1000, 600);
        $path = $this->service->store($uploaded, null);

        Storage::disk('public')->assertExists($path);

        // Check mime via content if possible - at least ensure file size > 0
        $this->assertGreaterThan(0, Storage::disk('public')->size($path));
    }

    public function test_store_deletes_old_only_if_exists(): void
    {
        Storage::fake('public');

        $uploaded = UploadedFile::fake()->image('new.jpg', 800, 800);
        // old path that does not exist on disk - should not crash
        $path = $this->service->store($uploaded, 'products/ghost.webp');

        $this->assertStringEndsWith('.webp', $path);
        Storage::disk('public')->assertExists($path);
    }
}
