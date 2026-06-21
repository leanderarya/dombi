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
use App\Services\NotificationService;
use App\Services\ReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerReturnExchangeVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_submitted_return_appears_in_owner_index(): void
    {
        $context = $this->makeContext();
        $return = $this->createReturn($context);

        $this->actingAs($context['owner'])
            ->get('/owner/returns')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/returns/index')
                ->has('returns.data', 1)
                ->where('returns.data.0.id', $return->id)
                ->where('returns.data.0.status', ReturnRequest::STATUS_SUBMITTED)
            );
    }

    public function test_submitted_exchange_appears_in_owner_index(): void
    {
        $context = $this->makeContext();
        $exchange = $this->createExchange($context);

        $this->actingAs($context['owner'])
            ->get('/owner/exchanges')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/exchanges/index')
                ->has('exchanges.data', 1)
                ->where('exchanges.data.0.id', $exchange->id)
                ->where('exchanges.data.0.status', ExchangeRequest::STATUS_SUBMITTED)
            );
    }

    public function test_owner_dashboard_pending_counts_update_for_submitted_requests(): void
    {
        $context = $this->makeContext();
        $this->createReturn($context);
        $this->createExchange($context);

        $this->actingAs($context['owner'])
            ->get('/owner/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/dashboard')
                ->where('actionRequired.returns', 1)
                ->where('actionRequired.exchanges', 1)
                ->where('kpis.pendingActions', 2)
                ->where('ownerOperationalCounts.pendingReturns', 1)
                ->where('ownerOperationalCounts.pendingExchanges', 1)
            );
    }

    public function test_owner_notification_created_for_submitted_return(): void
    {
        $context = $this->makeContext();
        $return = $this->createReturn($context);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'owner',
            'user_id' => $context['owner']->id,
            'type' => NotificationService::RETURN_REQUEST_CREATED,
            'entity_type' => 'return_request',
            'entity_id' => $return->id,
        ]);

        $this->actingAs($context['owner'])
            ->getJson('/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);
    }

    public function test_owner_notification_created_for_submitted_exchange(): void
    {
        $context = $this->makeContext();
        $exchange = $this->createExchange($context);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'owner',
            'user_id' => $context['owner']->id,
            'type' => NotificationService::EXCHANGE_REQUEST_CREATED,
            'entity_type' => 'exchange_request',
            'entity_id' => $exchange->id,
        ]);
    }

    public function test_approving_return_removes_pending_counts(): void
    {
        $context = $this->makeContext();
        $return = $this->createReturn($context);

        $this->actingAs($context['owner'])
            ->post(route('owner.returns.approve', $return), ['notes' => 'OK'])
            ->assertRedirect();

        $this->actingAs($context['owner'])
            ->get('/owner/dashboard')
            ->assertInertia(fn ($page) => $page
                ->where('actionRequired.returns', 0)
                ->where('ownerOperationalCounts.pendingReturns', 0)
            );
    }

    public function test_rejecting_exchange_removes_pending_counts(): void
    {
        $context = $this->makeContext();
        $exchange = $this->createExchange($context);

        $this->actingAs($context['owner'])
            ->post(route('owner.exchanges.reject', $exchange), ['reason' => 'Tidak sesuai kebutuhan'])
            ->assertRedirect();

        $this->actingAs($context['owner'])
            ->get('/owner/dashboard')
            ->assertInertia(fn ($page) => $page
                ->where('actionRequired.exchanges', 0)
                ->where('ownerOperationalCounts.pendingExchanges', 0)
            );
    }

    private function createReturn(array $context): ReturnRequest
    {
        return app(ReturnService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'reason' => 'slow_moving',
            'notes' => 'Produk lambat bergerak',
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 4]],
        ]);
    }

    private function createExchange(array $context): ExchangeRequest
    {
        return app(ExchangeService::class)->createRequest($context['outlet'], $context['outletUser'], [
            'notes' => 'Perlu penggantian produk',
            'items' => [['product_variant_id' => $context['variant']->id, 'quantity' => 2]],
        ]);
    }

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Mranggen',
            'kelurahan' => 'Mranggen',
            'kecamatan' => 'Mranggen',
            'address' => 'Jl. Raya Mranggen',
            'status' => 'active',
        ]);

        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();

        $product = Product::create([
            'name' => 'Biogoat 1L',
            'slug' => uniqid('biogoat-'),
            'unit' => 'botol',
            'price' => 55000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => 'Biogoat', 'brand' => 'Dombi']);
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Biogoat 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 45000,
            'selling_price' => 55000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 12,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        return compact('owner', 'outletUser', 'outlet', 'variant');
    }
}
