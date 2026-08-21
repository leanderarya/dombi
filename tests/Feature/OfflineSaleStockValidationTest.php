<?php

namespace Tests\Feature;

use App\Models\OfflineSale;
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

    public function test_update_reverses_then_applies_new_quantity_and_stock(): void
    {
        // Create a sale of 5 (current_stock 14 → 9)
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 5,
            'center_price' => 10000,
            'total_amount' => 50000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);
        $inv = OutletInventory::where('outlet_id', $this->outlet->id)
            ->where('product_id', $this->product->id)->first();
        $inv->decrement('current_stock', 5);

        // Edit to 8 → delta +3 → current_stock 9 → 6
        $response = $this->actingAs($this->user)->put("/outlet/offline-sales/{$sale->id}", [
            'quantity' => 8,
            'payment_method' => 'transfer',
            'notes' => 'edit',
        ]);

        $response->assertSessionDoesntHaveErrors();
        $sale->refresh();
        $this->assertSame(8, $sale->quantity);
        $this->assertSame('transfer', $sale->payment_method);
        $this->assertSame(80000.0, (float) $sale->total_amount);
        $this->assertDatabaseHas('outlet_inventories', [
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'current_stock' => 6,
        ]);
    }

    public function test_update_rejects_quantity_beyond_available_stack_after_reverse(): void
    {
        // Sale of 5, current_stock 9 (after decrement). Editable headroom = 9+5-reserved3 = 11.
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 5,
            'center_price' => 10000,
            'total_amount' => 50000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);
        $inv = OutletInventory::where('outlet_id', $this->outlet->id)
            ->where('product_id', $this->product->id)->first();
        $inv->decrement('current_stock', 5);

        $response = $this->actingAs($this->user)->put("/outlet/offline-sales/{$sale->id}", [
            'quantity' => 12,
            'payment_method' => 'cash',
        ]);

        $response->assertSessionHasErrors('quantity');
        $sale->refresh();
        $this->assertSame(5, $sale->quantity);
    }

    public function test_show_returns_offline_sale_detail(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'center_price' => 10000,
            'total_amount' => 20000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);

        $response = $this->actingAs($this->user)
            ->get("/outlet/offline-sales/{$sale->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('outlet/offline-sales/show')
            ->where('sale.total_amount', 20000)
            ->where('sale.quantity', 2)
        );
    }

    public function test_show_blocks_outlet_from_other_outlet_sale(): void
    {
        $otherOutlet = Outlet::factory()->create(['status' => 'active']);
        $sale = OfflineSale::create([
            'outlet_id' => $otherOutlet->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'center_price' => 10000,
            'total_amount' => 10000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user)
            ->get("/outlet/offline-sales/{$sale->id}")
            ->assertForbidden();
    }
}
