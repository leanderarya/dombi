<?php

namespace Tests\Feature;

use App\Models\ExchangeRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\ReturnRequest;
use App\Models\User;
use App\Services\ExchangeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReturnExchangeOperationalHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_return_create_only_lists_variants_owned_by_outlet_inventory(): void
    {
        $context = $this->makeContext();
        $otherVariant = $this->makeVariant('Unowned Variant 1L');

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.returns.create'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/returns/create')
                ->has('variants', 1)
                ->where('variants.0.id', $context['variant']->id)
            );

        $this->assertDatabaseMissing('outlet_inventories', [
            'outlet_id' => $context['outlet']->id,
            'product_variant_id' => $otherVariant->id,
        ]);
    }

    public function test_outlet_exchange_create_only_lists_variants_owned_by_outlet_inventory(): void
    {
        $context = $this->makeContext();
        $otherVariant = $this->makeVariant('Unowned Exchange Variant 1L');

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.exchanges.create'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/exchanges/create')
                ->has('variants', 1)
                ->where('variants.0.id', $context['variant']->id)
            );

        $this->assertDatabaseMissing('outlet_inventories', [
            'outlet_id' => $context['outlet']->id,
            'product_variant_id' => $otherVariant->id,
        ]);
    }

    public function test_outlet_return_quantity_cannot_exceed_available_stock(): void
    {
        $context = $this->makeContext(currentStock: 5, reservedStock: 3);

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.returns.store'), [
                'reason' => 'slow_moving',
                'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 3]],
            ])
            ->assertSessionHasErrors('items.0.quantity');

        $this->assertSame(0, ReturnRequest::count());
    }

    public function test_outlet_exchange_quantity_cannot_exceed_available_stock(): void
    {
        $context = $this->makeContext(currentStock: 4, reservedStock: 2);

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.exchanges.store'), [
                'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 3]],
            ])
            ->assertSessionHasErrors('items.0.quantity');

        $this->assertSame(0, ExchangeRequest::count());
    }

    public function test_owner_can_complete_received_exchange(): void
    {
        $context = $this->makeContext(currentStock: 6, reservedStock: 0);
        $exchange = app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 2]],
        ]);

        app(ExchangeService::class)->approveRequest($exchange, $context['owner']);
        app(ExchangeService::class)->markShipped($exchange->fresh(), $context['owner']);
        app(ExchangeService::class)->confirmReceived($exchange->fresh(), $context['outletUser']);

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.complete', $exchange))
            ->assertRedirect();

        $this->assertDatabaseHas('exchange_requests', [
            'id' => $exchange->id,
            'status' => ExchangeRequest::STATUS_COMPLETED,
        ]);
    }

    private function makeContext(int $currentStock = 10, int $reservedStock = 0): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Banyumanik',
            'kelurahan' => 'Banyumanik',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik',
            'status' => 'active',
        ]);

        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        $variant = $this->makeVariant('Original 500ml');

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->product_id,
            'product_variant_id' => $variant->id,
            'current_stock' => $currentStock,
            'reserved_stock' => $reservedStock,
            'minimum_stock' => 2,
        ]);

        return compact('owner', 'outletUser', 'outlet', 'variant');
    }

    private function makeVariant(string $name): ProductVariant
    {
        $product = Product::create([
            'name' => $name,
            'slug' => uniqid('variant-test-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => $name, 'brand' => 'Dombi']);

        return ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => $name,
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'center_stock' => 20,
            'is_active' => true,
        ]);
    }
}
