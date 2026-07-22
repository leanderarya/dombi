<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\ExchangeService;
use App\Services\ReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryConservationTest extends TestCase
{
    use RefreshDatabase;

    // ─── RETURN CONSERVATION ────────────────────────────────────────

    public function test_return_preserves_total_inventory(): void
    {
        $ctx = $this->makeContext(centerStock: 100, outletStock: 20);
        $returnQty = 5;

        $totalBefore = $this->totalInventory($ctx, $ctx['variant']);

        $return = app(ReturnService::class)->createRequest($ctx['outlet'], $ctx['outletUser'], [
            'reason' => 'slow_moving',
            'items' => [['product_variant_id' => $ctx['variant']->id, 'quantity' => $returnQty]],
        ]);

        $return = app(ReturnService::class)->approveRequest($return, $ctx['owner']);
        $return = app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $ctx['owner']);

        $totalAfter = $this->totalInventory($ctx, $ctx['variant']);

        $this->assertSame($totalBefore, $totalAfter, 'Return must preserve total inventory (center + outlet).');
        $this->assertSame(105, (int) $ctx['variant']->fresh()->center_stock);
        $this->assertSame(15, (int) $ctx['inventory']->fresh()->current_stock);
    }

    public function test_return_creates_return_in_and_return_out_movements(): void
    {
        $ctx = $this->makeContext(centerStock: 100, outletStock: 20);

        $return = app(ReturnService::class)->createRequest($ctx['outlet'], $ctx['outletUser'], [
            'reason' => 'damaged_packaging',
            'items' => [['product_variant_id' => $ctx['variant']->id, 'quantity' => 3]],
        ]);

        $return = app(ReturnService::class)->approveRequest($return, $ctx['owner']);
        $return = app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $ctx['owner']);

        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_out',
            'quantity' => -3,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_in',
            'quantity' => 3,
        ]);
    }

    // ─── EXCHANGE CONSERVATION ──────────────────────────────────────

    public function test_exchange_preserves_total_inventory(): void
    {
        $ctx = $this->makeContext(
            centerStock: 50,
            outletStock: 20,
            centerStockExchange: 100,
            outletStockExchange: 10
        );

        $totalBefore = $this->totalInventoryAllVariants($ctx);

        // Return 5 units of variant A
        $return = app(ReturnService::class)->createRequest($ctx['outlet'], $ctx['outletUser'], [
            'reason' => 'slow_moving',
            'items' => [['product_variant_id' => $ctx['variant']->id, 'quantity' => 5]],
        ]);
        $return = app(ReturnService::class)->approveRequest($return, $ctx['owner']);
        $return = app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $ctx['owner']);

        // Exchange 8 units of variant B
        $exchange = app(ExchangeService::class)->createRequest($ctx['outlet'], $ctx['outletUser'], [
            'return_request_id' => $return->id,
            'items' => [['product_variant_id' => $ctx['exchangeVariant']->id, 'quantity' => 8]],
        ]);
        $exchange = app(ExchangeService::class)->approveRequest($exchange, $ctx['owner']);
        $exchange = app(ExchangeService::class)->markShipped($exchange->fresh(), $ctx['owner']);
        $exchange = app(ExchangeService::class)->confirmReceived($exchange->fresh(), $ctx['outletUser']);

        $totalAfter = $this->totalInventoryAllVariants($ctx);

        $this->assertSame($totalBefore, $totalAfter, 'Exchange must preserve total inventory across all variants.');
    }

    public function test_exchange_creates_all_movements(): void
    {
        $ctx = $this->makeContext(centerStock: 50, outletStock: 20, centerStockExchange: 100, outletStockExchange: 10);

        $return = app(ReturnService::class)->createRequest($ctx['outlet'], $ctx['outletUser'], [
            'reason' => 'slow_moving',
            'items' => [['product_variant_id' => $ctx['variant']->id, 'quantity' => 3]],
        ]);
        $return = app(ReturnService::class)->approveRequest($return, $ctx['owner']);
        $return = app(ReturnService::class)->markReceivedAtCenter($return->fresh('items'), $ctx['owner']);

        $exchange = app(ExchangeService::class)->createRequest($ctx['outlet'], $ctx['outletUser'], [
            'return_request_id' => $return->id,
            'items' => [['product_variant_id' => $ctx['exchangeVariant']->id, 'quantity' => 5]],
        ]);
        $exchange = app(ExchangeService::class)->approveRequest($exchange, $ctx['owner']);
        $exchange = app(ExchangeService::class)->markShipped($exchange->fresh(), $ctx['owner']);
        $exchange = app(ExchangeService::class)->confirmReceived($exchange->fresh(), $ctx['outletUser']);

        // return_out: outlet returns to center
        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_out',
            'quantity' => -3,
        ]);

        // return_in: center receives from outlet
        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $ctx['variant']->id,
            'type' => 'return_in',
            'quantity' => 3,
        ]);

        // exchange_out: center ships replacement
        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $ctx['exchangeVariant']->id,
            'type' => 'exchange_out',
            'quantity' => -5,
        ]);

        // exchange_in: outlet receives replacement
        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $ctx['exchangeVariant']->id,
            'type' => 'exchange_in',
            'quantity' => 5,
        ]);
    }

    // ─── FULL LIFECYCLE CONSERVATION ────────────────────────────────

    // ─── HELPERS ────────────────────────────────────────────────────

    private function makeContext(
        int $centerStock = 100,
        int $outletStock = 20,
        ?int $centerStockExchange = null,
        ?int $outletStockExchange = null,
    ): array {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Conservation Test Outlet',
            'kelurahan' => 'Tembalang',
            'kecamatan' => 'Tembalang',
            'address' => 'Jl. Test',
            'status' => 'active',
        ]);

        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        $variant = $this->makeVariant('Biogoat 1L', 100000, $centerStock);

        $inventory = OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->product_id,
            'product_variant_id' => $variant->id,
            'current_stock' => $outletStock,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $exchangeVariant = null;
        $exchangeInventory = null;

        if ($centerStockExchange !== null) {
            $exchangeVariant = $this->makeVariant('Domilk Premium Coffee 250ml', 30000, $centerStockExchange);
            $exchangeInventory = OutletInventory::create([
                'outlet_id' => $outlet->id,
                'product_id' => $exchangeVariant->product_id,
                'product_variant_id' => $exchangeVariant->id,
                'current_stock' => $outletStockExchange ?? 0,
                'reserved_stock' => 0,
                'minimum_stock' => 2,
            ]);
        }

        return compact('owner', 'outletUser', 'outlet', 'variant', 'inventory', 'exchangeVariant', 'exchangeInventory');
    }

    private function makeVariant(string $name, int $sellingPrice, int $centerStock): ProductVariant
    {
        $product = Product::create([
            'name' => $name,
            'slug' => uniqid('conservation-'),
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

    private function totalInventory(array $ctx, ProductVariant $variant): int
    {
        $center = (int) $variant->fresh()->center_stock;
        $outlet = (int) OutletInventory::where('outlet_id', $ctx['outlet']->id)
            ->where('product_variant_id', $variant->id)
            ->first()?->current_stock ?? 0;

        return $center + $outlet;
    }

    private function totalInventoryAllVariants(array $ctx): int
    {
        $total = 0;

        $total += (int) $ctx['variant']->fresh()->center_stock;
        $total += (int) ($ctx['inventory']->fresh()->current_stock ?? 0);

        if ($ctx['exchangeVariant']) {
            $total += (int) $ctx['exchangeVariant']->fresh()->center_stock;
            $total += (int) ($ctx['exchangeInventory']->fresh()->current_stock ?? 0);
        }

        return $total;
    }
}
