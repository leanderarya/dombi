<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class GuestCancelFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancel_page_returns_ok_with_valid_token(): void
    {
        $order = $this->createOrder();

        $response = $this->get("/guest/orders/{$order->id}/cancel/{$order->guest_token}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('guest/cancel')
            ->has('order')
            ->has('token')
        );
    }

    public function test_cancel_page_returns_404_with_invalid_token(): void
    {
        $order = $this->createOrder();

        $response = $this->get("/guest/orders/{$order->id}/cancel/wrong-token");

        $response->assertNotFound();
    }

    public function test_guest_can_cancel_with_valid_token(): void
    {
        $order = $this->createOrder();

        $response = $this->post("/guest/orders/{$order->id}/cancel/{$order->guest_token}", [
            'reason' => 'Salah Pesan',
        ]);

        $response->assertRedirect();
        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $order->status);
    }

    public function test_guest_cannot_cancel_with_invalid_token(): void
    {
        $order = $this->createOrder();

        $response = $this->post("/guest/orders/{$order->id}/cancel/wrong-token", [
            'reason' => 'Salah Pesan',
        ]);

        $response->assertForbidden();
        $order->refresh();
        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $order->status);
    }

    public function test_guest_cannot_cancel_already_confirmed_order(): void
    {
        $order = $this->createOrder(['status' => Order::STATUS_CONFIRMED]);

        $response = $this->post("/guest/orders/{$order->id}/cancel/{$order->guest_token}", [
            'reason' => 'Salah Pesan',
        ]);

        $response->assertSessionHasErrors('status');
    }

    public function test_guest_token_has_high_entropy(): void
    {
        $order = $this->createOrder();

        $this->assertNotNull($order->guest_token);
        $this->assertEquals(32, strlen($order->guest_token));
    }

    public function test_guest_token_differs_from_recovery_token(): void
    {
        $order = $this->createOrder();

        $this->assertNotEquals($order->recovery_token, $order->guest_token);
    }

    private function createOrder(array $overrides = []): Order
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '081234561234',
        ]);

        $outlet = Outlet::create([
            'name' => 'Outlet Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-' . Str::random(8),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $data = array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-GCF-' . strtoupper(Str::random(6)),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'qris',
            'payment_status' => 'pending',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '081234561234',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
        ], $overrides);

        $order = Order::create($data);

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => $product->price,
            'subtotal' => 50000,
        ]);

        return $order->fresh();
    }
}
