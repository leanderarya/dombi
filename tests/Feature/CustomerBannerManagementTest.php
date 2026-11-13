<?php

namespace Tests\Feature;

use App\Models\CustomerBanner;
use App\Models\User;
use App\Services\BannerImageService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class CustomerBannerManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function payload(array $overrides = []): array
    {
        return array_replace([
            'name' => 'Banner katalog',
            'alt_text' => 'Pilihan Dombi untuk harimu',
            'target_path' => '/customer/products',
            'sort_order' => 0,
            'is_active' => true,
            'image' => UploadedFile::fake()->image('banner.jpg', 1200, 480),
        ], $overrides);
    }

    private function banner(array $overrides = []): CustomerBanner
    {
        Storage::disk('public')->put('banners/old.webp', 'old image');

        return CustomerBanner::create(array_replace([
            'name' => 'Lama',
            'alt_text' => 'Desain lama',
            'image_path' => 'banners/old.webp',
            'target_path' => null,
            'sort_order' => 0,
            'is_active' => false,
        ], $overrides));
    }

    private function owner(): User
    {
        return User::factory()->create(['role' => 'owner']);
    }

    public function test_owner_can_create_webp_banner_and_view_exact_index_payload(): void
    {
        $this->actingAs($this->owner())->post('/owner/banners', $this->payload())
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();

        $banner = CustomerBanner::sole();
        Storage::disk('public')->assertExists($banner->image_path);
        $this->assertStringEndsWith('.webp', $banner->image_path);
        $this->assertTrue($banner->is_active);
        $this->assertSame(0, $banner->sort_order);
        $this->assertSame('image/webp', Storage::disk('public')->mimeType($banner->image_path));

        $this->get('/owner/banners')->assertInertia(fn (Assert $page) => $page
            ->component('owner/banners/index', false)
            ->where('maxBanners', 3)
            ->has('banners', 1)
            ->where('banners.0', [
                'id' => $banner->id,
                'name' => $banner->name,
                'alt_text' => $banner->alt_text,
                'image_url' => Storage::disk('public')->url($banner->image_path),
                'target_path' => '/customer/products',
                'sort_order' => 0,
                'is_active' => true,
            ]));
    }

    public function test_replacing_image_removes_old_file_only_after_database_update(): void
    {
        $banner = $this->banner();
        $this->actingAs($this->owner())->put("/owner/banners/{$banner->id}", $this->payload())
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();

        $banner->refresh();
        $this->assertNotSame('banners/old.webp', $banner->image_path);
        Storage::disk('public')->assertMissing('banners/old.webp');
        Storage::disk('public')->assertExists($banner->image_path);
    }

    public function test_multipart_post_can_spoof_put_for_image_replacement(): void
    {
        $banner = $this->banner();
        $this->actingAs($this->owner())->post("/owner/banners/{$banner->id}", $this->payload(['_method' => 'put']))
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();
        $this->assertNotSame('banners/old.webp', $banner->fresh()->image_path);
    }

    public function test_owner_index_orders_active_and_inactive_banners_by_order_then_id(): void
    {
        $last = $this->banner(['sort_order' => 10]);
        $first = $this->banner(['sort_order' => 1]);
        $second = $this->banner(['sort_order' => 1, 'is_active' => true]);
        $this->actingAs($this->owner())->get('/owner/banners')->assertInertia(fn (Assert $page) => $page
            ->component('owner/banners/index', false)
            ->has('banners', 3)
            ->where('banners.0.id', $first->id)
            ->where('banners.1.id', $second->id)
            ->where('banners.2.id', $last->id));
    }

    public function test_update_without_image_keeps_file_and_saves_order_and_status(): void
    {
        $banner = $this->banner();
        $data = $this->payload(['sort_order' => 9999, 'target_path' => null]);
        unset($data['image']);
        $this->actingAs($this->owner())->put("/owner/banners/{$banner->id}", $data)
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();

        $banner->refresh();
        $this->assertSame('banners/old.webp', $banner->image_path);
        $this->assertSame(9999, $banner->sort_order);
        $this->assertTrue($banner->is_active);
        $this->assertNull($banner->target_path);
        Storage::disk('public')->assertExists('banners/old.webp');
    }

    public function test_write_failure_does_not_mutate_record_or_old_image(): void
    {
        $banner = $this->banner();
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('put')->once()->andReturn(false);
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);
        $this->actingAs($this->owner())->put("/owner/banners/{$banner->id}", $this->payload())
            ->assertSessionHasErrors('image');
        $this->assertSame('Lama', $banner->fresh()->name);
        $this->assertSame('banners/old.webp', $banner->fresh()->image_path);
    }

    public function test_database_failure_cleans_new_image_and_preserves_old_image(): void
    {
        $banner = $this->banner();
        CustomerBanner::updating(function (): void {
            throw new RuntimeException('Simulated database failure');
        });

        try {
            $this->actingAs($this->owner())->put("/owner/banners/{$banner->id}", $this->payload())
                ->assertStatus(500);
        } finally {
            CustomerBanner::flushEventListeners();
        }

        $this->assertSame('Lama', $banner->fresh()->name);
        $this->assertSame('banners/old.webp', $banner->fresh()->image_path);
        $this->assertSame(['banners/old.webp'], Storage::disk('public')->allFiles('banners'));
    }

    public function test_create_database_failure_cleans_new_image(): void
    {
        CustomerBanner::creating(function (): void {
            throw new RuntimeException('Simulated database failure');
        });
        try {
            $this->actingAs($this->owner())->post('/owner/banners', $this->payload())->assertStatus(500);
        } finally {
            CustomerBanner::flushEventListeners();
        }
        $this->assertDatabaseCount('customer_banners', 0);
        $this->assertSame([], Storage::disk('public')->allFiles('banners'));
    }

    public function test_old_image_cleanup_failure_does_not_fail_committed_update(): void
    {
        $banner = $this->banner();
        $service = $this->partialMock(BannerImageService::class);
        $service->shouldReceive('delete')->with('banners/old.webp')->once()
            ->andThrow(new RuntimeException('Delete failed'));
        Log::spy();
        $this->actingAs($this->owner())->put("/owner/banners/{$banner->id}", $this->payload())
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();
        $this->assertSame('Banner katalog', $banner->fresh()->name);
        Storage::disk('public')->assertExists($banner->fresh()->image_path);
        Log::shouldHaveReceived('warning')->once();
    }

    public function test_fourth_banner_is_rejected_and_leaves_no_trace(): void
    {
        $this->banner();
        $this->banner(['name' => 'Kedua']);
        $this->banner(['name' => 'Ketiga']);

        $this->actingAs($this->owner())->post('/owner/banners', $this->payload())
            ->assertRedirect()->assertSessionHasErrors('name');

        $this->assertDatabaseCount('customer_banners', 3);
        $this->assertSame(['banners/old.webp'], Storage::disk('public')->allFiles('banners'));
    }

    public function test_update_stays_allowed_while_at_capacity(): void
    {
        $banner = $this->banner();
        $this->banner(['name' => 'Kedua']);
        $this->banner(['name' => 'Ketiga']);

        $this->actingAs($this->owner())->put("/owner/banners/{$banner->id}", $this->payload())
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();

        $this->assertDatabaseCount('customer_banners', 3);
        $this->assertSame('Banner katalog', $banner->fresh()->name);
    }

    public function test_owner_can_delete_banner_and_its_file(): void
    {
        $banner = $this->banner();

        $this->actingAs($this->owner())->delete("/owner/banners/{$banner->id}")
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();

        $this->assertDatabaseCount('customer_banners', 0);
        Storage::disk('public')->assertMissing('banners/old.webp');
    }

    public function test_delete_cleanup_failure_still_removes_record(): void
    {
        $banner = $this->banner();
        $service = $this->partialMock(BannerImageService::class);
        $service->shouldReceive('delete')->with('banners/old.webp')->once()
            ->andThrow(new RuntimeException('Delete failed'));
        Log::spy();

        $this->actingAs($this->owner())->delete("/owner/banners/{$banner->id}")
            ->assertRedirect('/owner/banners')->assertSessionHasNoErrors();

        $this->assertDatabaseCount('customer_banners', 0);
        Log::shouldHaveReceived('warning')->once();
    }

    #[DataProvider('unauthorizedRoles')]
    public function test_non_owners_cannot_access_banner_routes(string $role): void
    {
        $banner = $this->banner();
        $this->actingAs(User::factory()->create(['role' => $role]));
        $destination = match ($role) {
            'outlet' => '/outlet/dashboard',
            'courier' => '/courier/dashboard',
            default => '/customer/home',
        };
        $this->get('/owner/banners')->assertRedirect($destination);
        $this->post('/owner/banners', $this->payload())->assertRedirect($destination);
        $this->put("/owner/banners/{$banner->id}", $this->payload())->assertRedirect($destination);
        $this->delete("/owner/banners/{$banner->id}")->assertRedirect($destination);
        $this->assertSame('Lama', $banner->fresh()->name);
        $this->assertDatabaseCount('customer_banners', 1);
    }

    public static function unauthorizedRoles(): array
    {
        return array_map(fn (string $role) => [$role], ['customer', 'outlet', 'courier']);
    }

    public function test_guests_cannot_access_banner_routes(): void
    {
        $banner = $this->banner();
        $this->get('/owner/banners')->assertRedirect('/login');
        $this->post('/owner/banners', $this->payload())->assertRedirect('/login');
        $this->put("/owner/banners/{$banner->id}", $this->payload())->assertRedirect('/login');
        $this->delete("/owner/banners/{$banner->id}")->assertRedirect('/login');
    }

    #[DataProvider('unsafeTargets')]
    public function test_unsafe_target_paths_are_rejected(string $target): void
    {
        $this->actingAs($this->owner())->post('/owner/banners', $this->payload(['target_path' => $target]))
            ->assertSessionHasErrors('target_path');
        $this->assertDatabaseCount('customer_banners', 0);
        $this->assertSame([], Storage::disk('public')->allFiles('banners'));
    }

    public static function unsafeTargets(): array
    {
        return array_map(fn (string $path) => [$path], [
            'https://example.com/customer/products', '//example.com', 'javascript:alert(1)',
            '/owner/banners', '/customer-evil', '/customer/../owner', '/customer/./products',
            '/customer\\products', "/customer/products\nX", '/customer/%2e%2e/owner',
            '/customer/%252e%252e/owner', '/customer/%5c%5cexample.com',
            '/customer/products?next=%0aevil',
            "\n/customer/products", "/customer/products\n", "/customer/products\t",
        ]);
    }

    #[DataProvider('invalidFields')]
    public function test_invalid_fields_are_rejected(string $field, mixed $value): void
    {
        $this->actingAs($this->owner())->post('/owner/banners', $this->payload([$field => $value]))
            ->assertSessionHasErrors($field);
        $this->assertDatabaseCount('customer_banners', 0);
    }

    public static function invalidFields(): array
    {
        return [
            ['name', ''], ['name', str_repeat('a', 101)],
            ['alt_text', ''], ['alt_text', str_repeat('a', 501)],
            ['sort_order', -1], ['sort_order', 10000], ['sort_order', 1.5], ['is_active', 'yes'],
        ];
    }

    public function test_image_required_on_create(): void
    {
        $data = $this->payload();
        unset($data['image']);
        $this->actingAs($this->owner())->post('/owner/banners', $data)->assertSessionHasErrors('image');
    }

    public function test_invalid_images_are_rejected(): void
    {
        $this->actingAs($this->owner());
        foreach ([
            UploadedFile::fake()->image('square.jpg', 600, 600),
            UploadedFile::fake()->image('small.jpg', 595, 238),
            UploadedFile::fake()->image('large.jpg', 4005, 1602),
            UploadedFile::fake()->image('huge.jpg', 600, 240)->size(5121),
            UploadedFile::fake()->image('animated.gif', 600, 240),
            UploadedFile::fake()->create('vector.svg', 1, 'image/svg+xml'),
            UploadedFile::fake()->create('fake.jpg', 1, 'image/jpeg'),
        ] as $image) {
            $this->post('/owner/banners', $this->payload(['image' => $image]))->assertSessionHasErrors('image');
        }
        $this->assertDatabaseCount('customer_banners', 0);
    }

    public function test_encoder_preserves_ratio_and_never_upscales(): void
    {
        foreach ([[2000, 800, 1200, 480], [600, 240, 600, 240]] as [$width, $height, $expectedWidth, $expectedHeight]) {
            $path = app(BannerImageService::class)->store(UploadedFile::fake()->image('banner.png', $width, $height));
            [$actualWidth, $actualHeight] = getimagesize(Storage::disk('public')->path($path));
            $this->assertSame($expectedWidth, $actualWidth);
            $this->assertSame($expectedHeight, $actualHeight);
        }
    }
}
