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

class ExchangeWorkflowHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_center_stock_decreases_when_exchange_is_shipped(): void
    {
        $context = $this->makeContext(centerStock: 10, exchangePrice: 30000);
        $exchange = $this->createApprovedExchange($context, quantity: 2);

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.mark-shipped', $exchange))
            ->assertRedirect();

        $this->assertDatabaseHas('exchange_requests', [
            'id' => $exchange->id,
            'status' => ExchangeRequest::STATUS_SHIPPED,
            'shipped_by' => $context['owner']->id,
        ]);

        $this->assertSame(8, (int) $context['exchangeVariant']->fresh()->center_stock);

        $this->assertDatabaseHas('stock_movements', [
            'outlet_id' => $context['outlet']->id,
            'product_variant_id' => $context['exchangeVariant']->id,
            'type' => 'exchange_out',
            'quantity' => -2,
            'reference_type' => ExchangeRequest::class,
            'reference_id' => $exchange->id,
        ]);
    }

    public function test_exchange_shipment_is_blocked_when_center_stock_is_insufficient(): void
    {
        $context = $this->makeContext(centerStock: 1, exchangePrice: 30000);
        $exchange = $this->createApprovedExchange($context, quantity: 2);

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.mark-shipped', $exchange))
            ->assertSessionHasErrors('inventory');

        $this->assertDatabaseHas('exchange_requests', [
            'id' => $exchange->id,
            'status' => ExchangeRequest::STATUS_APPROVED,
        ]);

        $this->assertSame(1, (int) $context['exchangeVariant']->fresh()->center_stock);
        $this->assertSame(0, StockMovement::query()
            ->where('reference_type', ExchangeRequest::class)
            ->where('reference_id', $exchange->id)
            ->where('type', 'exchange_out')
            ->count());
    }

    public function test_confirm_received_is_idempotent_and_does_not_duplicate_stock(): void
    {
        $context = $this->makeContext(centerStock: 10, exchangePrice: 30000, outletStock: 5);
        $exchange = $this->createShippedExchange($context, quantity: 3);

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.exchanges.confirm-received', $exchange))
            ->assertRedirect();

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.exchanges.confirm-received', $exchange))
            ->assertSessionHasErrors('status');

        $this->assertDatabaseHas('exchange_requests', [
            'id' => $exchange->id,
            'status' => ExchangeRequest::STATUS_RECEIVED,
        ]);

        $this->assertSame(8, (int) $context['exchangeInventory']->fresh()->current_stock);

        $this->assertSame(1, StockMovement::query()
            ->where('reference_type', ExchangeRequest::class)
            ->where('reference_id', $exchange->id)
            ->where('type', 'exchange_in')
            ->count());
    }

    public function test_complete_exchange_creates_credit_adjustment_from_value_difference(): void
    {
        $context = $this->makeContext(centerStock: 10, returnPrice: 175000, exchangePrice: 300000);
        $return = $this->createReceivedReturn($context, quantity: 2); // 350.000
        $exchange = $this->createReceivedExchange($context, $return, quantity: 1); // 300.000

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.complete', $exchange))
            ->assertRedirect();

        $this->assertDatabaseHas('exchange_requests', [
            'id' => $exchange->id,
            'status' => ExchangeRequest::STATUS_COMPLETED,
        ]);

        $this->assertDatabaseHas('return_requests', [
            'id' => $return->id,
            'status' => ReturnRequest::STATUS_COMPLETED,
        ]);

        $this->assertDatabaseHas('outlet_payables', [
            'outlet_id' => $context['outlet']->id,
            'type' => 'adjustment',
            'amount' => -50000,
            'reference_type' => ExchangeRequest::class,
            'reference_id' => $exchange->id,
        ]);
    }

    public function test_complete_exchange_creates_payable_adjustment_when_replacement_is_higher(): void
    {
        $context = $this->makeContext(centerStock: 10, returnPrice: 150000, exchangePrice: 350000);
        $return = $this->createReceivedReturn($context, quantity: 2); // 300.000
        $exchange = $this->createReceivedExchange($context, $return, quantity: 1); // 350.000

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.complete', $exchange))
            ->assertRedirect();

        $this->assertDatabaseHas('outlet_payables', [
            'outlet_id' => $context['outlet']->id,
            'type' => 'adjustment',
            'amount' => 50000,
            'reference_type' => ExchangeRequest::class,
            'reference_id' => $exchange->id,
        ]);
    }

    public function test_complete_exchange_is_idempotent_and_creates_adjustment_only_once(): void
    {
        $context = $this->makeContext(centerStock: 10, returnPrice: 175000, exchangePrice: 300000);
        $return = $this->createReceivedReturn($context, quantity: 2);
        $exchange = $this->createReceivedExchange($context, $return, quantity: 1);

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.complete', $exchange))
            ->assertRedirect();

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.complete', $exchange))
            ->assertSessionHasErrors('status');

        $this->assertSame(1, OutletPayable::query()
            ->where('reference_type', ExchangeRequest::class)
            ->where('reference_id', $exchange->id)
            ->where('type', 'adjustment')
            ->count());
    }

    private function createApprovedExchange(array $context, int $quantity): ExchangeRequest
    {
        $exchange = app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'items' => [[
                'product_variant_id' => $context['exchangeVariant']->id,
                'quantity' => $quantity,
            ]],
            'notes' => 'Exchange hardening test',
        ]);

        return app(ExchangeService::class)->approveRequest($exchange, $context['owner']);
    }

    private function createShippedExchange(array $context, int $quantity): ExchangeRequest
    {
        $exchange = $this->createApprovedExchange($context, $quantity);

        return app(ExchangeService::class)->markShipped($exchange->fresh(), $context['owner']);
    }

    private function createReceivedExchange(array $context, ReturnRequest $return, int $quantity): ExchangeRequest
    {
        $exchange = app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'return_request_id' => $return->id,
            'items' => [[
                'product_variant_id' => $context['exchangeVariant']->id,
                'quantity' => $quantity,
            ]],
            'notes' => 'Exchange hardening test',
        ]);

        $exchange = app(ExchangeService::class)->approveRequest($exchange, $context['owner']);
        $exchange = app(ExchangeService::class)->markShipped($exchange->fresh(), $context['owner']);

        return app(ExchangeService::class)->confirmReceived($exchange->fresh(), $context['outletUser']);
    }

    private function createReceivedReturn(array $context, int $quantity): ReturnRequest
    {
        $return = app(ReturnService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'reason' => 'slow_moving',
            'notes' => 'Return linked to exchange hardening test',
            'items' => [[
                'product_variant_id' => $context['returnVariant']->id,
                'quantity' => $quantity,
            ]],
        ]);

        $return = app(ReturnService::class)->approveRequest($return, $context['owner']);

        return app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $context['owner']);
    }

    private function makeContext(
        int $centerStock = 10,
        int $outletStock = 10,
        int $returnPrice = 100000,
        int $exchangePrice = 100000
    ): array {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Semarang',
            'kelurahan' => 'Tembalang',
            'kecamatan' => 'Tembalang',
            'address' => 'Jl. Semarang',
            'status' => 'active',
        ]);

        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        $returnVariant = $this->makeVariant('Biogoat 1L', $returnPrice, 5);
        $exchangeVariant = $this->makeVariant('Domilk Premium Coffee 250ml', $exchangePrice, $centerStock);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $returnVariant->product_id,
            'product_variant_id' => $returnVariant->id,
            'current_stock' => $outletStock,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $exchangeInventory = OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $exchangeVariant->product_id,
            'product_variant_id' => $exchangeVariant->id,
            'current_stock' => $outletStock,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        return compact('owner', 'outletUser', 'outlet', 'returnVariant', 'exchangeVariant', 'exchangeInventory');
    }

    private function makeVariant(string $name, int $sellingPrice, int $centerStock): ProductVariant
    {
        $product = Product::create([
            'name' => $name,
            'slug' => uniqid('exchange-hardening-'),
            'unit' => 'botol',
            'price' => $sellingPrice,
            'is_active' => true,
        ]);

        $family = ProductFamily::create([
            'name' => $name,
            'brand' => 'Dombi',
        ]);

        return ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => $name,
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => max(0, $sellingPrice - 10000),
            'selling_price' => $sellingPrice,
            'center_stock' => $centerStock,
            'is_active' => true,
        ]);
    }
}
