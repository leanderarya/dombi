<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletInventoryOpnameFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_opname_updates_stock_with_product_id(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        $product = Product::factory()->create();
        $outletInventory = OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 5,
            'reserved_stock' => 0,
        ]);

        $response = $this->actingAs($user)->post('/outlet/inventory/opname', [
            'product_id' => $product->id,
            'actual_count' => 7,
            'notes' => 'Ditemukan 2 stok selip',
        ]);

        $response->assertRedirect();
        $this->assertSame(7, $outletInventory->fresh()->current_stock);
        $this->assertDatabaseHas('stock_movements', [
            'type' => 'stock_opname',
            'product_id' => $product->id,
            'after_stock' => 7,
        ]);
    }
}
