<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
use App\Models\StockDistribution;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\RestockService;
use Illuminate\Database\QueryException;
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
                'items' => [['product_variant_id' => $context['variant']->id, 'requested_quantity' => 6]],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('restock_requests', ['outlet_id' => $context['outlet']->id, 'status' => 'requested']);
        $this->assertDatabaseHas('restock_request_items', ['product_variant_id' => $context['variant']->id, 'requested_quantity' => 6]);
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
        $this->assertDatabaseHas('stock_distributions', ['restock_request_id' => $restock->id, 'status' => 'preparing', 'sent_by' => null, 'sent_at' => null]);
        $this->assertDatabaseHas('stock_distribution_items', ['product_variant_id' => $context['variant']->id, 'quantity' => 4]);
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
        $this->assertSame($context['owner']->id, $distribution->fresh()->sent_by);
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
            ->where('product_variant_id', $context['variant']->id)
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

    public function test_duplicate_distribution_creation_is_prevented_safely(): void
    {
        $context = $this->makeContext();
        $distribution = $this->makeDistribution($context);
        $restock = $distribution->restockRequest()->with('items')->firstOrFail();

        $sameDistribution = app(RestockService::class)->createDistribution($restock, $context['owner']);

        $this->assertSame($distribution->id, $sameDistribution->id);
        $this->assertSame(1, StockDistribution::where('restock_request_id', $restock->id)->count());
    }

    public function test_database_rejects_duplicate_distribution_for_same_restock_request(): void
    {
        $context = $this->makeContext();
        $distribution = $this->makeDistribution($context);

        $this->expectException(QueryException::class);

        StockDistribution::create([
            'restock_request_id' => $distribution->restock_request_id,
            'outlet_id' => $context['outlet']->id,
            'status' => 'preparing',
        ]);
    }

    public function test_owner_restock_detail_exposes_operational_distribution_context(): void
    {
        $context = $this->makeContext();
        $distribution = $this->makeDistribution($context);

        $this->actingAs($context['owner'])
            ->get(route('owner.restocks.show', $distribution->restock_request_id))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/restocks/show')
                ->has('restock.requester')
                ->has('restock.approver')
                ->has('restock.distribution')
                ->has('restock.distribution.items', 1)
                ->has('restock.distribution.sender')
                ->where('restock.status', 'preparing')
                ->where('restock.distribution.status', 'preparing')
                ->where('restock.distribution.sent_by', null)
            );
    }

    public function test_owner_restock_filters_hide_redundant_approved_and_received_statuses(): void
    {
        $context = $this->makeContext();

        $this->actingAs($context['owner'])
            ->get(route('owner.restocks.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/restocks/index')
                ->where('statusOptions.0.value', 'requested')
                ->where('statusOptions.1.value', 'preparing')
                ->where('statusOptions.2.value', 'shipped')
                ->where('statusOptions.3.value', 'completed')
                ->where('statusOptions.4.value', 'rejected')
                ->missing('statusOptions.5')
            );
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
            'items' => [['product_variant_id' => $context['variant']->id, 'requested_quantity' => 6]],
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

        $family = ProductFamily::create(['name' => 'Susu Kambing', 'brand' => 'Dombi']);
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original 500ml',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 2,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        return compact('owner', 'outletUser', 'outlet', 'product', 'variant');
    }
}
