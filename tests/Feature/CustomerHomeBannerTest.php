<?php

namespace Tests\Feature;

use App\Models\CustomerBanner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CustomerHomeBannerTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_and_customer_receive_only_active_banners_in_deterministic_order(): void
    {
        Storage::fake('public');
        $banners = collect([10, 2, 2])->map(fn (int $order) => CustomerBanner::create([
            'name' => 'Internal name',
            'alt_text' => 'Pesan banner',
            'image_path' => "banners/{$order}.webp",
            'target_path' => $order === 10 ? null : '/customer/products',
            'sort_order' => $order,
            'is_active' => true,
        ]));
        CustomerBanner::create([
            'name' => 'Inactive', 'alt_text' => 'Hidden', 'image_path' => 'banners/hidden.webp',
            'sort_order' => 0, 'is_active' => false,
        ]);
        $expected = $banners->sortBy(fn (CustomerBanner $banner) => [$banner->sort_order, $banner->id])
            ->values()->map(fn (CustomerBanner $banner) => [
                'id' => $banner->id,
                'alt_text' => $banner->alt_text,
                'image_url' => Storage::disk('public')->url($banner->image_path),
                'target_path' => $banner->target_path,
            ])->all();

        $this->withSession(['guest_mode' => true])->get('/customer/home')->assertInertia(fn (Assert $page) => $page
            ->component('customer/home')->where('banners', $expected));
        $this->actingAs(User::factory()->create(['role' => 'customer']))->get('/customer/home')
            ->assertInertia(fn (Assert $page) => $page->where('banners', $expected));
    }

    public function test_all_inactive_banners_leave_fallback_to_frontend(): void
    {
        CustomerBanner::create([
            'name' => 'Inactive', 'alt_text' => 'Hidden', 'image_path' => 'banners/hidden.webp',
            'sort_order' => 0, 'is_active' => false,
        ]);
        $this->withSession(['guest_mode' => true])->get('/customer/home')
            ->assertInertia(fn (Assert $page) => $page->has('banners', 0));
    }

    public function test_empty_banner_list_leaves_fallback_to_frontend(): void
    {
        $this->withSession(['guest_mode' => true])->get('/customer/home')
            ->assertInertia(fn (Assert $page) => $page->component('customer/home')->has('banners', 0));
    }
}
