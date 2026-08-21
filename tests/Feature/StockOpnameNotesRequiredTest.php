<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockOpnameNotesRequiredTest extends TestCase
{
    use RefreshDatabase;

    public function test_opname_requires_notes_when_stock_differs(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        $product = Product::factory()->create();
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 5,
            'reserved_stock' => 0,
        ]);

        $response = $this->actingAs($user)->post('/outlet/inventory/opname', [
            'product_id' => $product->id,
            'actual_count' => 7,
        ]);

        $response->assertSessionHasErrors('notes');
    }

    public function test_opname_allows_no_notes_when_stock_unchanged(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        $product = Product::factory()->create();
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 5,
            'reserved_stock' => 0,
        ]);

        $response = $this->actingAs($user)->post('/outlet/inventory/opname', [
            'product_id' => $product->id,
            'actual_count' => 5,
        ]);

        $response->assertSessionHasNoErrors();
    }
}
