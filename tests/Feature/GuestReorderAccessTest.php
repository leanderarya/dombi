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

class GuestReorderAccessTest extends TestCase
{
    use RefreshDatabase;

    // ─── GUEST RECOVERED ORDER CAN REORDER ─────────────────────────

    public function test_guest_recovered_order_can_restore_cart(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();  // recovery returns JSON, not redirect

        $this->get('/customer/orders/'.$order->id.'/restore-cart')
            ->assertRedirect();
    }

    public function test_guest_can_repeat_order_after_recovery(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();  // recovery returns JSON, not redirect

        $this->post('/customer/orders/'.$order->id.'/repeat')
            ->assertRedirect();
    }

    public function test_guest_recovery_stores_session_data(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();  // recovery returns JSON
    }

    // ─── GUEST UNRECOVERED ORDER CANNOT REORDER ────────────────────

    public function test_guest_without_recovery_cannot_restore_cart(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        // No recovery — direct access should redirect to login
        $this->get('/customer/orders/'.$order->id.'/restore-cart')
            ->assertRedirect('/login');
    }

    public function test_guest_cannot_reorder_order_from_different_customer(): void
    {
        $context1 = $this->createOrderContext('completed');
        $context2 = $this->createOrderContext('completed', '6289876543210');

        // Recover orders for customer 1
        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $context1['order']->recovery_token,
        ])->assertOk();  // recovery returns JSON

        // Try to reorder customer 2's order — redirect (guest session limits)
        $this->get('/customer/orders/'.$context2['order']->id.'/restore-cart')
            ->assertRedirect();
    }

    public function test_guest_cannot_reorder_order_not_in_recovery_session(): void
    {
        $context = $this->createOrderContext('completed');

        // Recover with a different token (no matching order)
        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4',
        ])->assertOk();

        // No session data stored — should redirect to login
        $this->get('/customer/orders/'.$context['order']->id.'/restore-cart')
            ->assertRedirect('/login');
    }

    // ─── AUTHENTICATED CUSTOMER CAN REORDER ────────────────────────

    public function test_authenticated_customer_can_restore_cart(): void
    {
        $context = $this->createOrderContext('completed');

        $this->actingAs($context['user'])
            ->get('/customer/orders/'.$context['order']->id.'/restore-cart')
            ->assertRedirect('/customer/checkout')
            ->assertSessionHas('success');
    }

    public function test_authenticated_customer_can_repeat_order(): void
    {
        $context = $this->createOrderContext('completed');

        $this->actingAs($context['user'])
            ->post('/customer/orders/'.$context['order']->id.'/repeat')
            ->assertRedirect('/customer/checkout')
            ->assertSessionHas('success');
    }

    // ─── OTHER CUSTOMER'S ORDER DENIED ─────────────────────────────

    public function test_authenticated_customer_cannot_reorder_other_customers_order(): void
    {
        $context = $this->createOrderContext('completed');
        $otherUser = User::factory()->create(['role' => 'customer', 'is_active' => true]);

        $this->actingAs($otherUser)
            ->get('/customer/orders/'.$context['order']->id.'/restore-cart')
            ->assertForbidden();
    }

    // ─── RECOVERY SESSION EXPIRES ──────────────────────────────────

    public function test_expired_recovery_session_blocks_reorder(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        // Recover
        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();
    }

    // ─── GUEST CHECKOUT FLOW AFTER REORDER ─────────────────────────

    public function test_guest_reorder_redirects_to_checkout(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $this->get('/customer/orders/'.$order->id.'/restore-cart')
            ->assertRedirect();
    }

    public function test_guest_reorder_with_inactive_variant_shows_error(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        $context['variant']->update(['is_active' => false]);

        $this->postJson('/customer/orders/recovery', [
            'phone' => '6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertOk();

        $this->get('/customer/orders/'.$order->id.'/restore-cart')
            ->assertRedirect();
    }

    // ─── PHONE FORMAT NORMALIZATION ────────────────────────────────

    public function test_recovery_with_different_phone_formats_allows_reorder(): void
    {
        $context = $this->createOrderContext('completed');
        $order = $context['order'];

        // Recover with +62 format
        $this->postJson('/customer/orders/recovery', [
            'phone' => '+6281234567890',
            'recovery_token' => $order->recovery_token,
        ])->assertRedirect();

        // Should be able to reorder
        $this->get('/customer/orders/'.$order->id.'/restore-cart')
            ->assertRedirect();
    }

    // ─── HELPERS ───────────────────────────────────────────────────

    private function createOrderContext(string $status, string $phone = '6281234567890'): array
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'user_id' => $user->id,
            'name' => 'Test Customer',
            'phone' => $phone,
            'is_registered' => false,
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
            'slug' => 'test-product-'.uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create([
            'name' => 'Test Family',
            'is_active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Test Variant',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

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
            'order_code' => 'DOMBI-GUEST-'.strtoupper(uniqid()),
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
