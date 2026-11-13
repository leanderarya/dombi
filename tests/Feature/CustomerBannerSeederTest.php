<?php

namespace Tests\Feature;

use App\Models\CustomerBanner;
use Database\Seeders\CustomerBannerSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CustomerBannerSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_it_seeds_three_inactive_banners_with_their_assets(): void
    {
        $this->seed(CustomerBannerSeeder::class);

        $banners = CustomerBanner::orderBy('sort_order')->get();
        $this->assertCount(3, $banners);
        $this->assertSame([0, 1, 2], $banners->pluck('sort_order')->all());
        $this->assertSame([false, false, false], $banners->pluck('is_active')->all());
        $this->assertSame(
            ['/customer/products', '/customer/products', '/customer/products'],
            $banners->pluck('target_path')->all(),
        );
        $this->assertSame(3, count(Storage::disk('public')->allFiles('banners')));

        foreach ($banners as $banner) {
            Storage::disk('public')->assertExists($banner->image_path);
            $this->assertSame(
                [1200, 480],
                array_slice(getimagesize(Storage::disk('public')->path($banner->image_path)), 0, 2),
            );
            $this->assertStringEndsWith('.webp', $banner->image_path);
        }
    }

    public function test_running_it_twice_is_idempotent(): void
    {
        $this->seed(CustomerBannerSeeder::class);
        $paths = CustomerBanner::orderBy('sort_order')->pluck('image_path')->all();

        $this->seed(CustomerBannerSeeder::class);

        $this->assertDatabaseCount('customer_banners', 3);
        $this->assertSame(3, count(Storage::disk('public')->allFiles('banners')));
        $this->assertSame($paths, CustomerBanner::orderBy('sort_order')->pluck('image_path')->all());
    }

    public function test_an_owner_uploaded_image_is_not_overwritten(): void
    {
        $this->seed(CustomerBannerSeeder::class);

        $banner = CustomerBanner::orderBy('sort_order')->firstOrFail();
        Storage::disk('public')->put('banners/owner-upload.webp', 'owner artwork');
        $banner->update([
            'image_path' => 'banners/owner-upload.webp',
            'alt_text' => 'Teks yang diubah owner',
            'is_active' => true,
        ]);

        $this->seed(CustomerBannerSeeder::class);

        $banner->refresh();
        $this->assertSame('banners/owner-upload.webp', $banner->image_path);
        $this->assertSame('Teks yang diubah owner', $banner->alt_text);
        $this->assertTrue($banner->is_active);
        Storage::disk('public')->assertExists('banners/owner-upload.webp');
    }

    public function test_a_missing_image_file_is_restored(): void
    {
        $this->seed(CustomerBannerSeeder::class);

        $banner = CustomerBanner::orderBy('sort_order')->firstOrFail();
        Storage::disk('public')->delete($banner->image_path);

        $this->seed(CustomerBannerSeeder::class);

        $banner->refresh();
        Storage::disk('public')->assertExists($banner->image_path);
        $this->assertSame(3, count(Storage::disk('public')->allFiles('banners')));
    }
}
