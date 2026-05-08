<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\RestockRequest;
use App\Models\StockDistribution;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\RestockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MilestoneFourthTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_can_create_restock_request_with_items(): void
    {
        $context = $this->makeContext();

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.restocks.store'), [
                'notes' => 'Stok menipis',
                'items' => [['product_id' => $context['product']->id, 'requested_quantity' => 6]],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('restock_requests', ['outlet_id' => $context['outlet']->id, 'status' => 'requested']);
        $this->assertDatabaseHas('restock_request_items', ['product_id' => $context['product']->id, 'requested_quantity' => 6]);
    }

    public function test_owner_can_approve_request_and_create_distribution(): void
    {
        $context = $this->makeContext();
        $restock = $this->makeRestock($context);

        $this->actingAs($context['owner'])
            ->post(route('owner.restocks.approve', $restock), [
                'owner_notes' => 'Approved sebagian',
                'items' => [['restock_request_item_id' => $restock->items->first()->id, 'approved_quantity' => 4]],
            ])
            ->assertRedirect(route('owner.restocks.show', $restock));

        $this->assertDatabaseHas('restock_request_items', ['id' => $restock->items->first()->id, 'approved_quantity' => 4]);
        $this->assertDatabaseHas('restock_requests', ['id' => $restock->id, 'status' => 'preparing']);
        $this->assertDatabaseHas('stock_distributions', ['restock_request_id' => $restock->id, 'status' => 'preparing']);
        $this->assertDatabaseHas('stock_distribution_items', ['product_id' => $context['product']->id, 'quantity' => 4]);
    }

    public function test_owner_can_reject_request(): void
    {
        $context = $this->makeContext();
        $restock = $this->makeRestock($context);

        $this->actingAs($context['owner'])
            ->post(route('owner.restocks.reject', $restock), ['rejected_reason' => 'Stok pusat kosong'])
            ->assertRedirect(route('owner.restocks.show', $restock));

        $this->assertDatabaseHas('restock_requests', ['id' => $restock->id, 'status' => 'rejected', 'rejected_reason' => 'Stok pusat kosong']);
    }

    public function test_owner_can_mark_distribution_shipped(): void
    {
        $context = $this->makeContext();
        $distribution = $this->makeDistribution($context);

        $this->actingAs($context['owner'])
            ->post(route('owner.distributions.mark-shipped', $distribution))
            ->assertRedirect(route('owner.distributions.show', $distribution));

        $this->assertDatabaseHas('stock_distributions', ['id' => $distribution->id, 'status' => 'shipped']);
        $this->assertNotNull($distribution->fresh()->sent_at);
    }

    public function test_outlet_confirm_received_adds_stock_once_and_records_movement(): void
    {
        $context = $this->makeContext();
        $distribution = $this->makeDistribution($context);
        app(RestockService::class)->markShipped($distribution, $context['owner']);

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.distributions.confirm-received', $distribution))
            ->assertRedirect();

        $this->actingAs($context['outletUser'])
            ->post(route('outlet.distributions.confirm-received', $distribution))
            ->assertRedirect();

        $inventory = OutletInventory::where('outlet_id', $context['outlet']->id)
            ->where('product_id', $context['product']->id)
            ->firstOrFail();

        $this->assertSame(6, $inventory->current_stock);
        $this->assertSame(1, StockMovement::where('reference_id', $distribution->id)->where('type', 'restock_in')->count());
        $this->assertDatabaseHas('stock_distributions', ['id' => $distribution->id, 'status' => 'completed']);
        $this->assertDatabaseHas('restock_requests', ['id' => $distribution->restock_request_id, 'status' => 'completed']);
    }

    public function test_outlet_cannot_view_other_outlet_restock(): void
    {
        $context = $this->makeContext();
        $otherContext = $this->makeContext('Other Outlet');
        $restock = $this->makeRestock($otherContext);

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.restocks.show', $restock))
            ->assertForbidden();
    }

    public function test_approve_with_all_zero_quantities_fails(): void
    {
        $context = $this->makeContext();
        $restock = $this->makeRestock($context);

        $this->actingAs($context['owner'])
            ->post(route('owner.restocks.approve', $restock), [
                'items' => [['restock_request_item_id' => $restock->items->first()->id, 'approved_quantity' => 0]],
            ])
            ->assertSessionHasErrors('items');

        $this->assertSame(0, StockDistribution::count());
    }

    private function makeDistribution(array $context): StockDistribution
    {
        $restock = $this->makeRestock($context);

        app(RestockService::class)->approveRequest($restock, $context['owner'], [
            ['restock_request_item_id' => $restock->items->first()->id, 'approved_quantity' => 4],
        ]);

        return $restock->fresh('distribution')->distribution;
    }

    private function makeRestock(array $context): RestockRequest
    {
        return app(RestockService::class)->createRequest($context['outletUser'], [
            'notes' => 'Perlu restock',
            'items' => [['product_id' => $context['product']->id, 'requested_quantity' => 6]],
        ])->load('items');
    }

    private function makeContext(string $outletName = 'Outlet Banyumanik'): array
    {
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

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => uniqid('susu-kambing-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 2,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        return compact('owner', 'outletUser', 'outlet', 'product');
    }
}
