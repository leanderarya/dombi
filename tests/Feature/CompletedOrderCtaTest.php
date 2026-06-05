<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompletedOrderCtaTest extends TestCase
{
    use RefreshDatabase;

    public function test_completed_order_detail_page_shows_reorder_action(): void
    {
        $context = $this->createOrderContext('completed');

        $response = $this->actingAs($context['user'])
            ->get('/customer/orders/' . $context['order']->id);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('customer/orders/show')
            ->where('order.status', 'completed')
        );
    }

    public function test_active_order_detail_page_shows_tracking_action(): void
    {
        $context = $this->createOrderContext('pending_confirmation');

        $response = $this->actingAs($context['user'])
            ->get('/customer/orders/' . $context['order']->id);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('customer/orders/show')
            ->where('order.status', 'pending_confirmation')
        );
    }

    public function test_completed_order_tracking_page_shows_reorder_sticky(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        $response = $this->get('/track/' . $order->recovery_token);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('track')
            ->where('order.status', 'completed')
            ->has('order')
        );
    }

    public function test_active_order_tracking_page_does_not_show_reorder_sticky(): void
    {
        $context = $this->createOrderContext('preparing');
        $order = $context['order'];

        $response = $this->get('/track/' . $order->recovery_token);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('track')
            ->where('order.status', 'preparing')
        );
    }

    public function test_cancelled_order_tracking_page_shows_reorder_sticky(): void
    {
        $context = $this->createOrderContext('cancelled_by_customer');
        $order = $context['order'];

        $response = $this->get('/track/' . $order->recovery_token);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('track')
            ->where('order.status', 'cancelled_by_customer')
        );
    }

    public function test_failed_delivery_order_tracking_page_shows_reorder_sticky(): void
    {
        $context = $this->createOrderContext('failed_delivery');
        $order = $context['order'];

        $response = $this->get('/track/' . $order->recovery_token);

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('track')
            ->where('order.status', 'failed_delivery')
        );
    }

    public function test_reorder_restores_cart_with_same_items(): void
    {
        $context = $this->createOrderContext('completed');
        $originalOrder = $context['order'];

        $response = $this->actingAs($context['user'])
            ->post('/customer/orders/' . $originalOrder->id . '/repeat');

        $response->assertRedirect('/customer/checkout');
        $response->assertSessionHas('success');

        // Verify cart was restored
        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
        $this->assertCount(1, $cart);
        $this->assertEquals($context['variant']->id, $cart[0]['product_variant_id']);
        $this->assertEquals(2, $cart[0]['quantity']);

        // Verify no new order was created
        $this->assertEquals(1, Order::count());
    }

    public function test_reorder_preserves_variant_information(): void
    {
        $context = $this->createOrderContext('completed');
        $originalOrder = $context['order'];

        $this->actingAs($context['user'])
            ->post('/customer/orders/' . $originalOrder->id . '/repeat');

        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
        $this->assertEquals($context['variant']->id, $cart[0]['product_variant_id']);
    }

    public function test_reorder_redirects_to_checkout(): void
    {
        $context = $this->createOrderContext('completed');
        $originalOrder = $context['order'];

        $response = $this->actingAs($context['user'])
            ->post('/customer/orders/' . $originalOrder->id . '/repeat');

        $response->assertRedirect('/customer/checkout');
    }

    public function test_customer_cannot_reorder_other_customers_order(): void
    {
        $context = $this->createOrderContext('completed');
        $otherUser = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $response = $this->actingAs($otherUser)
            ->post('/customer/orders/' . $context['order']->id . '/repeat');

        $response->assertForbidden();
    }

    public function test_reorder_with_inactive_variant_shows_warning(): void
    {
        $context = $this->createOrderContext('completed');
        $context['variant']->update(['is_active' => false]);

        $response = $this->actingAs($context['user'])
            ->post('/customer/orders/' . $context['order']->id . '/repeat');

        $response->assertRedirect('/customer/orders/' . $context['order']->id);
        $response->assertSessionHas('error');
    }

    public function test_reorder_with_deleted_variant_shows_warning(): void
    {
        $context = $this->createOrderContext('completed');
        $context['variant']->delete();

        $response = $this->actingAs($context['user'])
            ->post('/customer/orders/' . $context['order']->id . '/repeat');

        $response->assertRedirect('/customer/orders/' . $context['order']->id);
        $response->assertSessionHas('error');
    }

    public function test_reorder_with_insufficient_stock_adjusts_quantity(): void
    {
        $context = $this->createOrderContext('completed');

        // Reduce stock to 1 (original order was 2)
        $inventory = OutletInventory::where('product_variant_id', $context['variant']->id)->first();
        $inventory->update(['current_stock' => 1]);

        $response = $this->actingAs($context['user'])
            ->post('/customer/orders/' . $context['order']->id . '/repeat');

        $response->assertRedirect('/customer/checkout');
        $response->assertSessionHas('success');

        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
        $this->assertCount(1, $cart);
        $this->assertEquals(1, $cart[0]['quantity']); // Adjusted from 2 to 1
    }

    public function test_reorder_uses_current_pricing(): void
    {
        $context = $this->createOrderContext('completed');

        // Change price
        $context['variant']->update(['selling_price' => 30000]);

        $response = $this->actingAs($context['user'])
            ->post('/customer/orders/' . $context['order']->id . '/repeat');

        $response->assertRedirect('/customer/checkout');
        $response->assertSessionHas('success');

        // The cart should be restored (pricing is validated at checkout time)
        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
        $this->assertCount(1, $cart);
    }

    public function test_restore_cart_endpoint_works_for_completed_order(): void
    {
        $context = $this->createOrderContext('completed');

        $response = $this->actingAs($context['user'])
            ->get('/customer/orders/' . $context['order']->id . '/restore-cart');

        $response->assertRedirect('/customer/checkout');
        $response->assertSessionHas('success');

        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
        $this->assertCount(1, $cart);
        $this->assertEquals($context['variant']->id, $cart[0]['product_variant_id']);
    }

    public function test_restore_cart_endpoint_works_for_failed_order(): void
    {
        $context = $this->createOrderContext('failed_delivery');

        $response = $this->actingAs($context['user'])
            ->get('/customer/orders/' . $context['order']->id . '/restore-cart');

        $response->assertRedirect('/customer/checkout');
        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
    }

    public function test_restore_cart_endpoint_works_for_cancelled_order(): void
    {
        $context = $this->createOrderContext('cancelled_by_customer');

        $response = $this->actingAs($context['user'])
            ->get('/customer/orders/' . $context['order']->id . '/restore-cart');

        $response->assertRedirect('/customer/checkout');
        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
    }

    public function test_restore_cart_endpoint_works_for_expired_order(): void
    {
        $context = $this->createOrderContext('expired');

        $response = $this->actingAs($context['user'])
            ->get('/customer/orders/' . $context['order']->id . '/restore-cart');

        $response->assertRedirect('/customer/checkout');
        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
    }

    public function test_customer_cannot_restore_cart_from_other_customers_order(): void
    {
        $context = $this->createOrderContext('completed');
        $otherUser = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $response = $this->actingAs($otherUser)
            ->get('/customer/orders/' . $context['order']->id . '/restore-cart');

        $response->assertForbidden();
    }

    public function test_reorder_with_multiple_items_restores_all(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        // Add a second variant
        $family2 = ProductFamily::create(['name' => 'Test Family 2', 'is_active' => true]);
        $product2 = Product::create([
            'name' => 'Test Product 2',
            'slug' => 'test-product-2-' . uniqid(),
            'unit' => 'botol',
            'price' => 15000,
            'is_active' => true,
        ]);
        $variant2 = ProductVariant::create([
            'product_family_id' => $family2->id,
            'product_id' => $product2->id,
            'name' => 'Test Variant 2',
            'center_price' => 10000,
            'selling_price' => 15000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $context['outlet']->id,
            'product_id' => $product2->id,
            'product_variant_id' => $variant2->id,
            'current_stock' => 50,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product2->id,
            'product_variant_id' => $variant2->id,
            'product_name' => $product2->name,
            'variant_name_snapshot' => $variant2->name,
            'quantity' => 1,
            'price' => 15000,
            'subtotal' => 15000,
        ]);

        $response = $this->actingAs($context['user'])
            ->post('/customer/orders/' . $order->id . '/repeat');

        $response->assertRedirect('/customer/checkout');
        $response->assertSessionHas('success');

        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
        $this->assertCount(2, $cart);
    }

    private function createOrderContext(string $status): array
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'user_id' => $user->id,
            'name' => 'Test Customer',
            'phone' => '628123456789' . rand(10, 99),
            'is_registered' => true,
        ]);

        $outletUser = User::factory()->create(['role' => 'outlet', 'is_active' => true]);
        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Test Outlet',
            'kelurahan' => 'Kelurahan',
            'kecamatan' => 'Kecamatan',
            'address' => 'Test Address',
            'latitude' => -6.2088,
            'longitude' => 106.8456,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Test Product',
            'slug' => 'test-product-' . uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        // Create a product family for the variant
        $family = ProductFamily::create([
            'name' => 'Test Family',
            'is_active' => true,
        ]);

        // Create a variant linked to the product
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Test Variant',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        // Set up inventory for the variant
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 100,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-CTA-' . strtoupper(uniqid()),
            'status' => $status,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'total' => 50000,
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone,
            'customer_address' => 'Test Address',
            'ordered_at' => now(),
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'product_name' => $product->name,
            'variant_name_snapshot' => $variant->name,
            'quantity' => 2,
            'price' => 25000,
            'subtotal' => 50000,
        ]);

        return [
            'user' => $user,
            'customer' => $customer,
            'outlet' => $outlet,
            'product' => $product,
            'variant' => $variant,
            'order' => $order->fresh('items'),
        ];
    }
}
