<?php

namespace Tests\Feature;

use App\Models\DeliveryTier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryTierTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        DeliveryTier::query()->delete();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    public function test_owner_can_list_delivery_tiers(): void
    {
        DeliveryTier::factory()->count(3)->create();

        $response = $this->actingAs($this->owner)->get('/owner/delivery-tiers');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page->component('owner/delivery-tiers/index')->has('tiers', 3));
    }

    public function test_owner_can_create_delivery_tier(): void
    {
        $response = $this->actingAs($this->owner)->post('/owner/delivery-tiers', [
            'min_km' => 0,
            'max_km' => 5,
            'fee' => 10000,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseHas('delivery_tiers', ['max_km' => 5, 'fee' => 10000]);
    }

    public function test_owner_can_update_delivery_tier(): void
    {
        $tier = DeliveryTier::create(['id' => 999, 'min_km' => 0, 'max_km' => 5, 'fee' => 10000, 'is_active' => true, 'sort_order' => 1]);

        $response = $this->actingAs($this->owner)->put('/owner/delivery-tiers/999', [
            'min_km' => 0,
            'max_km' => 7,
            'fee' => 12000,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseHas('delivery_tiers', ['id' => 999, 'max_km' => 7, 'fee' => 12000]);
    }

    public function test_owner_can_delete_delivery_tier(): void
    {
        $tier = DeliveryTier::create(['id' => 998, 'min_km' => 0, 'max_km' => 5, 'fee' => 10000, 'is_active' => true, 'sort_order' => 1]);

        $response = $this->actingAs($this->owner)->delete('/owner/delivery-tiers/998');

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseMissing('delivery_tiers', ['id' => 998]);
    }

    public function test_owner_can_toggle_tier_active_status(): void
    {
        $tier = DeliveryTier::create(['id' => 997, 'min_km' => 0, 'max_km' => 5, 'fee' => 10000, 'is_active' => true, 'sort_order' => 1]);

        $response = $this->actingAs($this->owner)->patch('/owner/delivery-tiers/997/toggle');

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseHas('delivery_tiers', ['id' => 997, 'is_active' => false]);
    }

    public function test_max_km_must_be_greater_than_min_km(): void
    {
        $response = $this->actingAs($this->owner)->post('/owner/delivery-tiers', [
            'min_km' => 10,
            'max_km' => 5,
            'fee' => 10000,
        ]);

        $response->assertSessionHasErrors('max_km');
    }

    public function test_non_owner_cannot_manage_tiers(): void
    {
        $user = User::factory()->create(['role' => 'customer']);

        $response = $this->actingAs($user)->get('/owner/delivery-tiers');

        $response->assertRedirect('/customer/home');
    }
}
