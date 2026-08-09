<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfflineSaleStockValidationTest extends TestCase
{
    use RefreshDatabase;

    private Outlet $outlet;

    private Product $product;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outlet = Outlet::factory()->create(['status' => 'active']);
        $this->product = Product::factory()->create(['center_price' => 10000]);
        $this->user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $this->outlet->id]);
        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'current_stock' => 14,
            'reserved_stock' => 3,
        ]);
    }

    public function test_store_rejects_quantity_exceeding_physical_stock(): void
    {
        $response = $this->actingAs($this->user)->post('/outlet/offline-sales', [
            'product_id' => $this->product->id,
            'quantity' => 15,
            'payment_method' => 'cash',
        ]);

        $response->assertSessionHasErrors('quantity')
            ->assertRedirect();
        $this->assertDatabaseMissing('offline_sales', ['outlet_id' => $this->outlet->id]);
    }

    public function test_store_rejects_quantity_exceeding_available_stock_when_reserved(): void
    {
        // current_stock=14, reserved_stock=3 → available=11
        $validated = $this->actingAs($this->user)
            ->post('/outlet/offline-sales', [
                'product_id' => $this->product->id,
                'quantity' => 12,
                'payment_method' => 'cash',
            ]);

        $validated->assertSessionHasErrors('quantity')
            ->assertRedirect();
        $this->assertDatabaseMissing('offline_sales', ['outlet_id' => $this->outlet->id]);
    }

    public function test_store_allows_quantity_up_to_available_stock(): void
    {
        $response = $this->actingAs($this->user)
            ->post('/outlet/offline-sales', [
                'product_id' => $this->product->id,
                'quantity' => 11,
                'payment_method' => 'cash',
            ]);

        $response->assertSessionDoesntHaveErrors();
        $this->assertDatabaseHas('offline_sales', [
            'outlet_id' => $this->outlet->id,
            'quantity' => 11,
        ]);
        $this->assertDatabaseHas('outlet_inventories', [
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'current_stock' => 3,
        ]);
    }
}
