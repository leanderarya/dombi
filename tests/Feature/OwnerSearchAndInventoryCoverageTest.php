<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Two ways the owner UI used to hide rows: the order search only looked at the
 * order code, and the inventory Outlet tab only knew about products that
 * already had an outlet_inventories row.
 */
class OwnerSearchAndInventoryCoverageTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['role' => 'owner']);
    }

    public function test_order_search_matches_the_customer_name(): void
    {
        $customer = Customer::factory()->create(['name' => 'Arya Ajisadda Haryanto']);
        $other = Customer::factory()->create(['name' => 'Someone Else']);
        $outlet = Outlet::factory()->create();

        Order::factory()->create(['customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-20260917-001']);
        Order::factory()->create(['customer_id' => $other->id, 'outlet_id' => $outlet->id, 'order_code' => 'DOMBI-20260917-002']);

        $this->actingAs($this->owner())
            ->get('/owner/orders?status=all&search=Arya')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/orders/index')
                ->has('orders.data', 1)
                ->where('orders.data.0.order_code', 'DOMBI-20260917-001'));
    }

    public function test_order_search_still_matches_the_order_code(): void
    {
        $outlet = Outlet::factory()->create();
        Order::factory()->create(['outlet_id' => $outlet->id, 'order_code' => 'DOMBI-20260917-001']);
        Order::factory()->create(['outlet_id' => $outlet->id, 'order_code' => 'DOMBI-20260918-002']);

        $this->actingAs($this->owner())
            ->get('/owner/orders?status=all&search=20260918')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('orders.data', 1)
                ->where('orders.data.0.order_code', 'DOMBI-20260918-002'));
    }

    public function test_inventory_outlet_tab_lists_products_with_no_outlet_row(): void
    {
        $category = ProductCategory::factory()->create();
        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'name' => 'Biogoat - Coklat 1l',
            'is_active' => true,
            'center_stock' => 0,
        ]);

        Outlet::factory()->create(['status' => 'active']);

        $response = $this->actingAs($this->owner())->get('/owner/inventories?tab=pusat');

        // The Outlet tab builds its table from centralStock plus outlet rows, so
        // the product has to be on the page at all for the group to seed.
        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('centralStock', 1)
                ->where('centralStock.0.id', $product->id)
                ->where('centralStock.0.center_stock', 0));
    }

    public function test_inventory_index_carries_both_halves_the_outlet_tab_needs(): void
    {
        $outlet = Outlet::factory()->create(['status' => 'active', 'name' => 'Outlet Alfa']);
        $category = ProductCategory::factory()->create();

        $stocked = Product::factory()->create(['product_category_id' => $category->id, 'is_active' => true]);
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $stocked->id,
            'current_stock' => 9,
            'minimum_stock' => 3,
        ]);

        $unstocked = Product::factory()->create([
            'product_category_id' => $category->id,
            'is_active' => true,
            'name' => 'Makanan - Bolu Ketan',
        ]);

        $this->actingAs($this->owner())
            ->get('/owner/inventories?tab=pusat')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/inventories/index')
                ->has('centralStock', 2)
                ->has('outletSections', 1)
                ->has('outletSections.0.inventories', 1));
    }
}
