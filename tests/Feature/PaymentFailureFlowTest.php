<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentFailureFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_status_endpoint_returns_current_status(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567890',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'failed',
        ]);

        $response = $this->actingAs($user)
            ->getJson("/customer/orders/{$order->id}/payment-status");

        $response->assertOk()
            ->assertJson([
                'payment_status' => 'failed',
            ]);
    }

    public function test_payment_status_syncs_from_doku(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567891',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'pending',
            'doku_order_id' => 'DOMBI-TEST-001',
        ]);

        // This test verifies the endpoint exists and returns a response
        // Actual DOKU sync would require mocking the DOKU API
        $response = $this->actingAs($user)
            ->getJson("/customer/orders/{$order->id}/payment-status");

        $response->assertOk();
    }

    public function test_restore_cart_redirects_to_checkout(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567892',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'failed',
        ]);

        $response = $this->actingAs($user)
            ->get("/customer/orders/{$order->id}/restore-cart");

        // Should redirect to checkout if items are available, or to order show if not
        $response->assertRedirect();
    }

    private function createOrder(Customer $customer, array $overrides = []): Order
    {
        $outlet = Outlet::create([
            'name' => 'Test Outlet',
            'kelurahan' => 'Test Kelurahan',
            'kecamatan' => 'Test Kecamatan',
            'address' => 'Jl. Test No. 123',
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-'.uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-TEST-'.strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'credit_card',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone,
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
            'confirmation_expires_at' => now()->addMinutes(15),
            'payment_status' => 'pending',
        ], $overrides));

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => $product->price,
            'subtotal' => 50000,
        ]);

        return $order;
    }
}
