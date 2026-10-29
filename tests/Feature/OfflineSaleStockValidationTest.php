<?php

namespace Tests\Feature;

use App\Models\OfflineSale;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletProductPrice;
use App\Models\Product;
use App\Models\Settlement;
use App\Models\SettlementPayment;
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

        $response->assertSessionHasErrors('quantity')->assertRedirect();
        $this->assertDatabaseMissing('offline_sales', ['outlet_id' => $this->outlet->id]);
    }

    public function test_store_rejects_quantity_exceeding_available_stock_when_reserved(): void
    {
        $response = $this->actingAs($this->user)->post('/outlet/offline-sales', [
            'product_id' => $this->product->id,
            'quantity' => 12,
            'payment_method' => 'cash',
        ]);

        $response->assertSessionHasErrors('quantity')->assertRedirect();
        $this->assertDatabaseMissing('offline_sales', ['outlet_id' => $this->outlet->id]);
    }

    public function test_store_allows_quantity_up_to_available_stock(): void
    {
        $response = $this->actingAs($this->user)->post('/outlet/offline-sales', [
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

    public function test_store_snapshots_effective_price_and_records_financial_values(): void
    {
        $this->product->update(['center_price' => 18000, 'selling_price' => 21000]);
        OutletProductPrice::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'selling_price' => 25000,
        ]);

        $this->actingAs($this->user)->post('/outlet/offline-sales', [
            'product_id' => $this->product->id,
            'quantity' => 2,
            'payment_method' => 'cash',
            'selling_price' => 1,
        ])->assertSessionDoesntHaveErrors();

        $sale = OfflineSale::where('outlet_id', $this->outlet->id)->firstOrFail();
        $this->assertSame(25000.0, (float) $sale->selling_price_snapshot);
        $this->assertSame(50000.0, (float) $sale->gross_amount);
        $this->assertSame(36000.0, (float) $sale->total_amount);
        $this->assertDatabaseHas('outlet_payables', [
            'reference_type' => OfflineSale::class,
            'reference_id' => $sale->id,
            'amount' => 36000,
            'center_share' => 36000,
            'outlet_margin' => 14000,
            'remaining_amount' => 36000,
        ]);
    }

    public function test_update_reverses_then_applies_new_quantity_and_stock(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 5,
            'center_price' => 10000,
            'selling_price_snapshot' => 15000,
            'gross_amount' => 75000,
            'total_amount' => 50000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);
        OutletInventory::where('outlet_id', $this->outlet->id)
            ->where('product_id', $this->product->id)
            ->decrement('current_stock', 5);

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
        $this->assertSame(120000.0, (float) $sale->gross_amount);
        $this->assertSame(15000.0, (float) $sale->selling_price_snapshot);
        $this->assertDatabaseHas('outlet_inventories', [
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'current_stock' => 6,
        ]);
    }

    public function test_update_rejects_quantity_beyond_available_stock_after_reversal(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 5,
            'center_price' => 10000,
            'selling_price_snapshot' => 15000,
            'gross_amount' => 75000,
            'total_amount' => 50000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);
        OutletInventory::where('outlet_id', $this->outlet->id)
            ->where('product_id', $this->product->id)
            ->decrement('current_stock', 5);

        $response = $this->actingAs($this->user)->put("/outlet/offline-sales/{$sale->id}", [
            'quantity' => 12,
            'payment_method' => 'cash',
        ]);

        $response->assertSessionHasErrors('quantity');
        $this->assertSame(5, $sale->fresh()->quantity);
    }

    public function test_update_preserves_original_selling_price_snapshot(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'center_price' => 18000,
            'selling_price_snapshot' => 25000,
            'gross_amount' => 50000,
            'total_amount' => 36000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);
        OutletInventory::where('outlet_id', $this->outlet->id)
            ->where('product_id', $this->product->id)
            ->decrement('current_stock', 2);
        $this->product->update(['selling_price' => 30000]);

        $this->actingAs($this->user)->put("/outlet/offline-sales/{$sale->id}", [
            'quantity' => 3,
            'payment_method' => 'cash',
        ])->assertSessionDoesntHaveErrors();

        $sale->refresh();
        $this->assertSame(25000.0, (float) $sale->selling_price_snapshot);
        $this->assertSame(75000.0, (float) $sale->gross_amount);
        $this->assertSame(54000.0, (float) $sale->total_amount);
    }

    public function test_legacy_sale_without_price_snapshot_cannot_be_edited(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'center_price' => 10000,
            'total_amount' => 10000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user)->put("/outlet/offline-sales/{$sale->id}", [
            'quantity' => 2,
            'payment_method' => 'cash',
        ])->assertSessionHasErrors('quantity');
        $this->assertSame(1, $sale->fresh()->quantity);
    }

    public function test_delete_last_sale_resets_existing_weekly_settlement(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'center_price' => 10000,
            'selling_price_snapshot' => 15000,
            'gross_amount' => 15000,
            'total_amount' => 10000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);
        $weekStart = $sale->created_at->copy()->startOfWeek()->toDateString();
        $settlement = Settlement::create([
            'outlet_id' => $this->outlet->id,
            'period_date' => $weekStart,
            'period_start' => $weekStart,
            'period_end' => $sale->created_at->copy()->endOfWeek()->toDateString(),
            'period_type' => 'weekly',
            'sales_amount' => 10000,
            'amount_due' => 10000,
            'total_offline_sales' => 10000,
            'net_amount' => -10000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
        ]);

        $this->actingAs($this->user)->delete("/outlet/offline-sales/{$sale->id}")
            ->assertSessionDoesntHaveErrors();

        $this->assertDatabaseMissing('offline_sales', ['id' => $sale->id]);
        $this->assertDatabaseHas('settlements', [
            'id' => $settlement->id,
            'amount_due' => 0,
            'total_offline_sales' => 0,
            'net_amount' => 0,
            'status' => Settlement::STATUS_PAID,
        ]);
    }

    public function test_update_and_delete_block_when_week_has_pending_payment(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 1,
            'center_price' => 10000,
            'selling_price_snapshot' => 15000,
            'gross_amount' => 15000,
            'total_amount' => 10000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);
        $weekStart = $sale->created_at->copy()->startOfWeek()->toDateString();
        $settlement = Settlement::create([
            'outlet_id' => $this->outlet->id,
            'period_date' => $weekStart,
            'period_start' => $weekStart,
            'period_end' => $sale->created_at->copy()->endOfWeek()->toDateString(),
            'period_type' => 'weekly',
            'sales_amount' => 10000,
            'amount_due' => 10000,
            'total_offline_sales' => 10000,
            'net_amount' => -10000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
        ]);
        SettlementPayment::create([
            'outlet_id' => $this->outlet->id,
            'settlement_id' => $settlement->id,
            'reference_number' => 'OFFLINE-TEST-PAYMENT',
            'payment_date' => now()->toDateString(),
            'amount' => 10000,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);

        $this->actingAs($this->user)->put("/outlet/offline-sales/{$sale->id}", [
            'quantity' => 2,
            'payment_method' => 'cash',
        ])->assertSessionHasErrors('quantity');
        $this->actingAs($this->user)->delete("/outlet/offline-sales/{$sale->id}")
            ->assertSessionHasErrors('quantity');
        $this->assertDatabaseHas('offline_sales', ['id' => $sale->id]);
    }

    public function test_settlement_show_lists_only_payments_for_selected_week(): void
    {
        $saleDate = now()->startOfWeek();
        $settlement = Settlement::create([
            'outlet_id' => $this->outlet->id,
            'period_date' => $saleDate->toDateString(),
            'period_start' => $saleDate->toDateString(),
            'period_end' => $saleDate->copy()->endOfWeek()->toDateString(),
            'period_type' => 'weekly',
            'sales_amount' => 0,
            'amount_due' => 1000,
            'net_amount' => -1000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
        ]);
        $otherSettlement = Settlement::create([
            'outlet_id' => $this->outlet->id,
            'period_date' => $saleDate->copy()->subWeek()->toDateString(),
            'period_start' => $saleDate->copy()->subWeek()->toDateString(),
            'period_end' => $saleDate->copy()->subWeek()->endOfWeek()->toDateString(),
            'period_type' => 'weekly',
            'sales_amount' => 0,
            'amount_due' => 2000,
            'net_amount' => -2000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
        ]);
        SettlementPayment::create([
            'outlet_id' => $this->outlet->id,
            'settlement_id' => $settlement->id,
            'reference_number' => 'SELECTED-WEEK-PAYMENT',
            'payment_date' => now()->toDateString(),
            'amount' => 1000,
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);
        SettlementPayment::create([
            'outlet_id' => $this->outlet->id,
            'settlement_id' => $otherSettlement->id,
            'reference_number' => 'OTHER-WEEK-PAYMENT',
            'payment_date' => now()->toDateString(),
            'amount' => 2000,
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->user)->get("/outlet/settlement/{$settlement->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/settlement-show')
                ->has('payments', 1)
                ->where('payments.0.reference', 'SELECTED-WEEK-PAYMENT')
            );
    }

    public function test_show_returns_financial_snapshots_and_legacy_amount(): void
    {
        $sale = OfflineSale::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'quantity' => 2,
            'center_price' => 10000,
            'selling_price_snapshot' => 15000,
            'gross_amount' => 30000,
            'total_amount' => 20000,
            'payment_method' => 'cash',
            'created_by' => $this->user->id,
        ]);

        $this->actingAs($this->user)->get("/outlet/offline-sales/{$sale->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/offline-sales/show')
                ->where('sale.total_amount', 20000)
                ->where('sale.selling_price_snapshot', 15000)
                ->where('sale.gross_amount', 30000)
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

        $this->actingAs($this->user)->get("/outlet/offline-sales/{$sale->id}")
            ->assertForbidden();
    }
}
