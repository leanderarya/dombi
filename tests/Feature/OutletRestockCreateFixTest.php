<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\RestockRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletRestockCreateFixTest extends TestCase
{
    use RefreshDatabase;

    private function outletUser(): User
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        return $user;
    }

    public function test_restock_request_stores_product_id(): void
    {
        $user = $this->outletUser();
        $product = Product::factory()->create(['is_active' => true]);

        OutletInventory::factory()->create([
            'outlet_id' => $user->outlet->id,
            'product_id' => $product->id,
            'current_stock' => 5,
        ]);

        $response = $this->actingAs($user)->post('/outlet/restocks', [
            'items' => [
                ['product_id' => $product->id, 'requested_quantity' => 3],
            ],
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('restock_requests', ['outlet_id' => $user->outlet->id]);
        $restock = RestockRequest::where('outlet_id', $user->outlet->id)->first();
        $this->assertSame($product->id, $restock->items()->first()->product_id);
    }
}