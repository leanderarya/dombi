<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerInventoryOutletTabFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_inventory_index_contains_product_inventories(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $product = Product::factory()->create(['is_active' => true]);

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 4,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($owner)->get('/owner/inventories?tab=outlet');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('owner/inventories/index')
            ->has('outletSections', 1)
            ->has('outletSections.0.inventories', 1)
            ->where('outletSections.0.inventories.0.product_id', $product->id)
            ->where('outletSections.0.inventories.0.current_stock', 4));
    }
}