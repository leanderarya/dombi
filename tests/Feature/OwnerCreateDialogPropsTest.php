<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Tambah Stok and Tambah Outlet are dialogs on their index pages now, so the
 * index has to carry the props those dialogs read. Without them the pickers
 * render empty and the dialog is a dead end.
 */
class OwnerCreateDialogPropsTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_index_carries_the_outlet_and_product_pickers(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['name' => 'Outlet Alfa', 'status' => 'active']);
        $product = Product::factory()->create(['name' => 'Susu Segar', 'is_active' => true]);

        $response = $this->actingAs($owner)->get('/owner/inventories');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('owner/inventories/index')
            ->has('outlets', 1)
            ->where('outlets.0.id', $outlet->id)
            ->where('outlets.0.name', 'Outlet Alfa')
            ->has('products', 1)
            ->where('products.0.id', $product->id)
            ->where('products.0.name', 'Susu Segar'));
    }

    public function test_inventory_index_pickers_skip_inactive_rows(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Outlet::factory()->create(['status' => 'archived']);
        Product::factory()->create(['is_active' => false]);

        $response = $this->actingAs($owner)->get('/owner/inventories');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('outlets', 0)
            ->has('products', 0));
    }

    public function test_outlet_index_carries_existing_outlets_for_the_map(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        Outlet::factory()->create([
            'name' => 'Outlet Beta',
            'status' => 'active',
            'latitude' => -7.05,
            'longitude' => 110.43,
        ]);

        $response = $this->actingAs($owner)->get('/owner/outlets');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('owner/outlets/index')
            ->has('existingOutlets', 1)
            ->where('existingOutlets.0.name', 'Outlet Beta'));
    }

    public function test_the_removed_create_pages_no_longer_route(): void
    {
        // The route names are gone entirely. Asserting on the name rather than
        // on a status code: /owner/inventories/create still matches the
        // PUT inventories/{inventory} pattern, so a GET comes back 405, not 404.
        $this->assertFalse(Route::has('owner.inventories.create'));
        $this->assertFalse(Route::has('owner.couriers.create'));
        $this->assertFalse(Route::has('owner.outlets.create'));

        $owner = User::factory()->create(['role' => 'owner']);

        foreach (['/owner/inventories/create', '/owner/couriers/create', '/owner/outlets/create'] as $url) {
            $this->assertNotSame(200, $this->actingAs($owner)->get($url)->getStatusCode(), $url);
        }
    }

    public function test_storing_an_inventory_still_works_from_the_dialog_payload(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $product = Product::factory()->create(['is_active' => true, 'center_stock' => 100]);

        $response = $this->actingAs($owner)->post('/owner/inventories', [
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 42,
            'minimum_stock' => 5,
            'notes' => 'Dialog QA',
        ]);

        $response->assertRedirect(route('owner.inventories.index'));
        $this->assertDatabaseHas('outlet_inventories', [
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 42,
            'minimum_stock' => 5,
        ]);
        $this->assertSame(1, OutletInventory::count());
    }
}
