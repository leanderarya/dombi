<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_view_analytics_dashboard(): void
    {
        $context = $this->makeContext();

        $this->actingAs($context['owner'])
            ->get('/owner/analytics')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/analytics/index')
                ->has('kpis')
                ->has('outletRevenue')
                ->has('topProducts')
                ->where('period', 'month')
            );
    }

    public function test_analytics_calculates_kpis_for_completed_orders(): void
    {
        $context = $this->makeContext();

        Order::create([
            'customer_id' => null,
            'outlet_id' => $context['outletA']->id,
            'order_code' => 'ORD-001',
            'status' => Order::STATUS_COMPLETED,
            'completed_at' => now(),
            'subtotal' => 100000,
            'delivery_fee' => 10000,
            'total' => 110000,
            'customer_name' => 'Test',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
        ]);

        Order::create([
            'customer_id' => null,
            'outlet_id' => $context['outletB']->id,
            'order_code' => 'ORD-002',
            'status' => Order::STATUS_COMPLETED,
            'completed_at' => now(),
            'subtotal' => 200000,
            'delivery_fee' => 15000,
            'total' => 215000,
            'customer_name' => 'Test 2',
            'customer_phone' => '08123456790',
            'customer_address' => 'Jl. Test 2',
            'ordered_at' => now(),
        ]);

        Order::create([
            'customer_id' => null,
            'outlet_id' => $context['outletA']->id,
            'order_code' => 'ORD-003',
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'subtotal' => 50000,
            'delivery_fee' => 5000,
            'total' => 55000,
            'customer_name' => 'Test 3',
            'customer_phone' => '08123456791',
            'customer_address' => 'Jl. Test 3',
            'ordered_at' => now(),
        ]);

        $this->actingAs($context['owner'])
            ->get('/owner/analytics')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('kpis.total_revenue', 325000)
                ->where('kpis.total_orders', 2)
                ->where('kpis.active_outlets', 2)
            );
    }

    public function test_analytics_filters_by_period(): void
    {
        $context = $this->makeContext();

        Order::create([
            'customer_id' => null,
            'outlet_id' => $context['outletA']->id,
            'order_code' => 'ORD-TODAY',
            'status' => Order::STATUS_COMPLETED,
            'completed_at' => now(),
            'subtotal' => 100000,
            'delivery_fee' => 0,
            'total' => 100000,
            'customer_name' => 'Test',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
        ]);

        $this->actingAs($context['owner'])
            ->get('/owner/analytics?period=today')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('kpis.total_revenue', 100000)
                ->where('kpis.total_orders', 1)
                ->where('period', 'today')
            );
    }

    public function test_analytics_returns_outlet_revenue_comparison(): void
    {
        $context = $this->makeContext();

        $orderA = Order::create([
            'customer_id' => null,
            'outlet_id' => $context['outletA']->id,
            'order_code' => 'ORD-A1',
            'status' => Order::STATUS_COMPLETED,
            'completed_at' => now(),
            'subtotal' => 100000,
            'delivery_fee' => 0,
            'total' => 100000,
            'customer_name' => 'Test A',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. A',
            'ordered_at' => now(),
        ]);

        Order::create([
            'customer_id' => null,
            'outlet_id' => $context['outletB']->id,
            'order_code' => 'ORD-B1',
            'status' => Order::STATUS_COMPLETED,
            'completed_at' => now(),
            'subtotal' => 250000,
            'delivery_fee' => 0,
            'total' => 250000,
            'customer_name' => 'Test B',
            'customer_phone' => '08123456790',
            'customer_address' => 'Jl. B',
            'ordered_at' => now(),
        ]);

        $this->actingAs($context['owner'])
            ->get('/owner/analytics')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('outletRevenue', 2)
                ->where('outletRevenue.0.revenue', '250000.00')
                ->where('outletRevenue.0.orders', 1)
                ->where('outletRevenue.1.revenue', '100000.00')
                ->where('outletRevenue.1.orders', 1)
            );
    }

    public function test_analytics_returns_top_products(): void
    {
        $context = $this->makeContext();

        $order = Order::create([
            'customer_id' => null,
            'outlet_id' => $context['outletA']->id,
            'order_code' => 'ORD-TOP',
            'status' => Order::STATUS_COMPLETED,
            'completed_at' => now(),
            'subtotal' => 300000,
            'delivery_fee' => 0,
            'total' => 300000,
            'customer_name' => 'Test',
            'customer_phone' => '08123456789',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $context['productLarge']->id,
            'product_variant_id' => $context['variantLarge']->id,
            'product_name' => 'Biogoat 1L',
            'variant_name_snapshot' => 'Original 1L',
            'quantity' => 3,
            'price' => 55000,
            'subtotal' => 165000,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $context['productSmall']->id,
            'product_variant_id' => $context['variantSmall']->id,
            'product_name' => 'Domilk Coffee 250ml',
            'variant_name_snapshot' => 'Coffee 250ml',
            'quantity' => 5,
            'price' => 30000,
            'subtotal' => 150000,
        ]);

        $this->actingAs($context['owner'])
            ->get('/owner/analytics')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('topProducts', 2)
                ->where('topProducts.0.product_name', 'Biogoat 1L')
                ->where('topProducts.0.total_qty', '3')
                ->where('topProducts.0.total_revenue', 165000)
                ->where('topProducts.1.product_name', 'Domilk Coffee 250ml')
                ->where('topProducts.1.total_qty', '5')
                ->where('topProducts.1.total_revenue', 150000)
            );
    }

    public function test_unauthenticated_user_cannot_access_analytics(): void
    {
        $this->get('/owner/analytics')
            ->assertRedirect('/login');
    }

    public function test_non_owner_cannot_access_analytics(): void
    {
        $user = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $this->actingAs($user)
            ->get('/owner/analytics')
            ->assertRedirect('/outlet/dashboard');
    }

    private function makeContext(): array
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);

        $outletUserA = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outletUserB = User::factory()->create(['role' => 'outlet', 'is_active' => true]);

        $outletA = Outlet::create([
            'user_id' => $outletUserA->id,
            'name' => 'Outlet A',
            'kelurahan' => 'Kel A',
            'kecamatan' => 'Kec A',
            'address' => 'Jl. A',
            'status' => 'active',
        ]);

        $outletB = Outlet::create([
            'user_id' => $outletUserB->id,
            'name' => 'Outlet B',
            'kelurahan' => 'Kel B',
            'kecamatan' => 'Kec B',
            'address' => 'Jl. B',
            'status' => 'active',
        ]);

        $outletUserA->forceFill(['outlet_id' => $outletA->id])->save();
        $outletUserB->forceFill(['outlet_id' => $outletB->id])->save();

        $family = ProductFamily::create(['name' => 'Susu Kambing', 'brand' => 'Dombi']);

        $productLarge = Product::create([
            'name' => 'Biogoat 1L',
            'slug' => uniqid('biogoat-'),
            'unit' => 'botol',
            'price' => 55000,
            'is_active' => true,
        ]);

        $productSmall = Product::create([
            'name' => 'Domilk Coffee 250ml',
            'slug' => uniqid('domilk-'),
            'unit' => 'botol',
            'price' => 30000,
            'is_active' => true,
        ]);

        $variantLarge = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $productLarge->id,
            'name' => 'Biogoat 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 45000,
            'selling_price' => 55000,
            'center_stock' => 100,
            'is_active' => true,
        ]);

        $variantSmall = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $productSmall->id,
            'name' => 'Domilk Coffee 250ml',
            'flavor' => 'Coffee',
            'size' => '250ml',
            'center_price' => 24000,
            'selling_price' => 30000,
            'center_stock' => 100,
            'is_active' => true,
        ]);

        return compact(
            'owner',
            'outletUserA',
            'outletUserB',
            'outletA',
            'outletB',
            'productLarge',
            'productSmall',
            'variantLarge',
            'variantSmall',
        );
    }
}
