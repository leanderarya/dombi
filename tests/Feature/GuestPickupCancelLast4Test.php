<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestPickupCancelLast4Test extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_cancel_pickup_with_correct_last4(): void
    {
        $order = $this->createPickupOrder(['customer_phone' => '081234561234']);

        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '1234',
        ])->assertOk()->assertJson(['success' => true]);

        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $order->status);
    }

    public function test_guest_cannot_cancel_pickup_with_wrong_last4(): void
    {
        $order = $this->createPickupOrder(['customer_phone' => '081234561234']);

        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '9999',
        ])->assertStatus(422)->assertJson(['success' => false]);

        $order->refresh();
        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $order->status);
    }

    public function test_guest_cannot_cancel_pickup_without_last4(): void
    {
        $order = $this->createPickupOrder(['customer_phone' => '081234561234']);

        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
        ])->assertStatus(422)->assertJson(['success' => false]);

        $order->refresh();
        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $order->status);
    }

    public function test_guest_cannot_cancel_pickup_with_invalid_last4_format(): void
    {
        $order = $this->createPickupOrder(['customer_phone' => '081234561234']);

        // Non-numeric
        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '12a4',
        ])->assertStatus(422)->assertJson(['success' => false]);

        // Wrong length
        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '123',
        ])->assertStatus(422)->assertJson(['success' => false]);

        // Too long
        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '12345',
        ])->assertStatus(422)->assertJson(['success' => false]);

        $order->refresh();
        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $order->status);
    }

    public function test_delivery_order_cancel_does_not_require_last4(): void
    {
        $order = $this->createDeliveryOrder(['customer_phone' => '081234561234']);

        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
        ])->assertOk()->assertJson(['success' => true]);

        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $order->status);
    }

    public function test_last4_hp_normalizes_phone_with_formatting(): void
    {
        // Phone stored with +62 prefix and dashes
        $order = $this->createPickupOrder(['customer_phone' => '+62 812-3456-1234']);

        $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '1234',
        ])->assertOk()->assertJson(['success' => true]);

        $order->refresh();
        $this->assertSame(Order::STATUS_CANCELLED_BY_CUSTOMER, $order->status);
    }

    public function test_cancel_response_is_generic_on_failure(): void
    {
        $order = $this->createPickupOrder(['customer_phone' => '081234561234']);

        // Wrong last4 — should return same generic message
        $response = $this->post('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Salah Pesan',
            'last4_hp' => '9999',
        ]);

        $response->assertStatus(422);
        $data = $response->json();
        $this->assertFalse($data['success']);
        $this->assertArrayHasKey('error', $data);
        // Generic message — does not say "HP salah" specifically
        $this->assertStringContainsString('Tidak dapat membatalkan', $data['error']);
    }

    private function createPickupOrder(array $overrides = []): Order
    {
        return $this->createOrder(array_merge(['fulfillment_type' => 'pickup'], $overrides));
    }

    private function createDeliveryOrder(array $overrides = []): Order
    {
        return $this->createOrder(array_merge(['fulfillment_type' => 'delivery_dombi'], $overrides));
    }

    private function createOrder(array $overrides = []): Order
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => $overrides['customer_phone'] ?? '081234561234',
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
            'slug' => 'susu-kambing-500ml-cancel-'.uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-CANCEL-'.strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'qris',
            'payment_status' => 'paid',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '081234561234',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
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
