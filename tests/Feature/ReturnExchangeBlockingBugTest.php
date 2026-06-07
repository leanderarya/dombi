<?php

namespace Tests\Feature;

use App\Models\ExchangeRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\ReturnRequest;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\ExchangeService;
use App\Services\ReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReturnExchangeBlockingBugTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_can_view_own_return_request(): void
    {
        $context = $this->makeContext();
        $return = $this->createReturn($context);

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.returns.show', $return))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/returns/show')
                ->where('return.id', $return->id)
                ->where('return.outlet_id', $context['outlet']->id)
            );
    }

    public function test_outlet_cannot_view_another_outlet_return_request(): void
    {
        $context = $this->makeContext();
        $otherContext = $this->makeContext('Other Outlet', 'Other Variant 1L');
        $otherReturn = $this->createReturn($otherContext);

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.returns.show', $otherReturn))
            ->assertForbidden();
    }

    public function test_outlet_can_view_own_exchange_request(): void
    {
        $context = $this->makeContext();
        $exchange = $this->createExchange($context);

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.exchanges.show', $exchange))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/exchanges/show')
                ->where('exchange.id', $exchange->id)
                ->where('exchange.outlet_id', $context['outlet']->id)
            );
    }

    public function test_outlet_cannot_view_another_outlet_exchange_request(): void
    {
        $context = $this->makeContext();
        $otherContext = $this->makeContext('Other Outlet', 'Other Exchange 1L');
        $otherExchange = $this->createExchange($otherContext);

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.exchanges.show', $otherExchange))
            ->assertForbidden();
    }

    public function test_owner_can_mark_return_received_at_center_and_inventory_is_updated(): void
    {
        $context = $this->makeContext(currentStock: 12, reservedStock: 2);
        $return = $this->createReturn($context, quantity: 4);

        app(ReturnService::class)->approveRequest($return, $context['owner'], 'Approved for return');

        $this->actingAs($context['owner'])
            ->post(route('owner.returns.mark-received', $return), [
                'notes' => 'Barang diterima di pusat',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('return_requests', [
            'id' => $return->id,
            'status' => ReturnRequest::STATUS_RECEIVED_AT_CENTER,
            'received_by' => $context['owner']->id,
        ]);

        $this->assertDatabaseHas('outlet_inventories', [
            'id' => $context['inventory']->id,
            'current_stock' => 8,
            'reserved_stock' => 2,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'outlet_id' => $context['outlet']->id,
            'product_variant_id' => $context['variant']->id,
            'type' => 'return_out',
            'quantity' => -4,
            'reference_type' => ReturnRequest::class,
            'reference_id' => $return->id,
            'created_by' => $context['owner']->id,
        ]);
    }

    public function test_marking_return_received_at_center_creates_no_settlement_adjustment(): void
    {
        $context = $this->makeContext(currentStock: 10, reservedStock: 0);
        $return = $this->createReturn($context, quantity: 3);

        app(ReturnService::class)->approveRequest($return, $context['owner']);

        $this->actingAs($context['owner'])
            ->post(route('owner.returns.mark-received', $return))
            ->assertRedirect();

        $this->assertSame(0, OutletPayable::count());
    }

    public function test_completing_received_return_creates_single_settlement_adjustment(): void
    {
        $context = $this->makeContext(currentStock: 10, reservedStock: 0);
        $return = $this->createReturn($context, quantity: 2);

        app(ReturnService::class)->approveRequest($return, $context['owner']);
        app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $context['owner']);

        $this->actingAs($context['owner'])
            ->post(route('owner.returns.complete', $return))
            ->assertRedirect();

        $this->assertDatabaseHas('return_requests', [
            'id' => $return->id,
            'status' => ReturnRequest::STATUS_COMPLETED,
        ]);

        $this->assertSame(1, OutletPayable::query()
            ->where('outlet_id', $context['outlet']->id)
            ->where('type', 'adjustment')
            ->count());
    }

    public function test_repeated_complete_return_does_not_create_duplicate_adjustment(): void
    {
        $context = $this->makeContext(currentStock: 10, reservedStock: 0);
        $return = $this->createReturn($context, quantity: 2);

        app(ReturnService::class)->approveRequest($return, $context['owner']);
        app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $context['owner']);

        $this->actingAs($context['owner'])
            ->post(route('owner.returns.complete', $return))
            ->assertRedirect();

        $this->actingAs($context['owner'])
            ->post(route('owner.returns.complete', $return))
            ->assertSessionHasErrors('status');

        $this->assertSame(1, OutletPayable::query()
            ->where('outlet_id', $context['outlet']->id)
            ->where('type', 'adjustment')
            ->count());
    }

    public function test_received_at_center_rolls_back_when_inventory_is_insufficient(): void
    {
        $context = $this->makeContext(currentStock: 5, reservedStock: 0);
        $return = $this->createReturn($context, quantity: 4);

        app(ReturnService::class)->approveRequest($return, $context['owner']);

        $context['inventory']->update(['current_stock' => 2]);

        $this->actingAs($context['owner'])
            ->post(route('owner.returns.mark-received', $return))
            ->assertSessionHasErrors('inventory');

        $this->assertDatabaseHas('return_requests', [
            'id' => $return->id,
            'status' => ReturnRequest::STATUS_APPROVED,
        ]);

        $this->assertSame(0, StockMovement::query()
            ->where('reference_type', ReturnRequest::class)
            ->where('reference_id', $return->id)
            ->where('type', 'return_out')
            ->count());
    }

    private function createReturn(array $context, int $quantity = 3): ReturnRequest
    {
        return app(ReturnService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'reason' => 'slow_moving',
            'notes' => 'Return request for blocking bug reproduction',
            'items' => [[
                'product_variant_id' => $context['variant']->id,
                'quantity' => $quantity,
            ]],
        ]);
    }

    private function createExchange(array $context, int $quantity = 2): ExchangeRequest
    {
        return app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'notes' => 'Exchange request for blocking bug reproduction',
            'items' => [[
                'product_variant_id' => $context['variant']->id,
                'quantity' => $quantity,
            ]],
        ]);
    }

    private function makeContext(
        string $outletName = 'Outlet Banyumanik',
        string $variantName = 'Biogoat 1L',
        int $currentStock = 10,
        int $reservedStock = 0
    ): array {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => $outletName,
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik',
            'status' => 'active',
        ]);

        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        $product = Product::create([
            'name' => $variantName,
            'slug' => uniqid('return-bug-'),
            'unit' => 'botol',
            'price' => 55000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create([
            'name' => $variantName,
            'brand' => 'Dombi',
        ]);

        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => $variantName,
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 45000,
            'selling_price' => 55000,
            'is_active' => true,
        ]);

        $inventory = OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => $currentStock,
            'reserved_stock' => $reservedStock,
            'minimum_stock' => 2,
        ]);

        return compact('owner', 'outletUser', 'outlet', 'variant', 'inventory');
    }
}
