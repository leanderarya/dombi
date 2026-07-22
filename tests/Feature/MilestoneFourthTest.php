<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
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
                'items' => [['product_variant_id' => $context['variant']->id, 'requested_quantity' => 6]],
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('restock_requests', ['outlet_id' => $context['outlet']->id, 'status' => 'requested']);
        $this->assertDatabaseHas('restock_request_items', ['product_variant_id' => $context['variant']->id, 'requested_quantity' => 6]);
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

    public function test_outlet_cannot_view_other_outlet_restock(): void
    {
        $context = $this->makeContext();
        $otherContext = $this->makeContext('Other Outlet');
        $restock = $this->makeRestock($otherContext);

        $this->actingAs($context['outletUser'])
            ->get(route('outlet.restocks.show', $restock))
            ->assertForbidden();
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
                ->where('statusOptions.5.value', 'cancelled')
            );
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
        $outletUser->update(['outlet_id' => $outlet->id]);

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
            'center_stock' => 100,
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
