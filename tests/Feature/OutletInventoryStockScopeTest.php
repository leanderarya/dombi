<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletInventoryStockScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_scopes_survive_a_row_reserved_beyond_its_stock(): void
    {
        $outlet = Outlet::factory()->create();
        [$overReserved] = $this->seedStockStates($outlet);

        $this->assertSame(-4, $overReserved->available_stock);
        $this->assertSame(1, OutletInventory::query()->whereCriticalStock()->count());
        $this->assertSame(2, OutletInventory::query()->whereLowStock()->count());
        $this->assertSame(2, OutletInventory::query()->whereInStock()->count());
    }

    public function test_outlet_dashboard_renders_with_a_row_reserved_beyond_its_stock(): void
    {
        $outlet = Outlet::factory()->create();
        $this->seedStockStates($outlet);

        $user = User::factory()->create(['role' => 'outlet', 'is_active' => true, 'outlet_id' => $outlet->id]);

        $this->actingAs($user)->get('/outlet/dashboard')->assertOk();
    }

    public function test_owner_inventory_page_renders_with_a_row_reserved_beyond_its_stock(): void
    {
        $outlet = Outlet::factory()->create();
        $this->seedStockStates($outlet);

        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $this->actingAs($owner)->get('/owner/inventories')->assertOk();
    }

    private function seedStockStates(Outlet $outlet): array
    {
        return [
            $this->makeInventory($outlet, current: 3, reserved: 7, minimum: 0),
            $this->makeInventory($outlet, current: 10, reserved: 2, minimum: 5),
            $this->makeInventory($outlet, current: 6, reserved: 2, minimum: 5),
        ];
    }

    private function makeInventory(Outlet $outlet, int $current, int $reserved, int $minimum): OutletInventory
    {
        return OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => Product::factory()->create()->id,
            'current_stock' => $current,
            'reserved_stock' => $reserved,
            'minimum_stock' => $minimum,
        ]);
    }
}
