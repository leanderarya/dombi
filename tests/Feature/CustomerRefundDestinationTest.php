<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerRefundDestinationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['role' => 'customer']);
        $this->customer = Customer::factory()->create(['user_id' => $this->user->id]);
    }

    public function test_customer_can_submit_own_bank_destination(): void
    {
        $order = Order::factory()->create([
            'customer_id' => $this->customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($this->user)
            ->patch("/customer/orders/{$order->id}/refund-destination", [
                'destination_type' => 'bank',
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Test User',
            ]);

        $response->assertSessionHas('success', 'Tujuan refund berhasil disimpan.');
    }

    public function test_customer_can_submit_own_ewallet_destination(): void
    {
        $order = Order::factory()->create([
            'customer_id' => $this->customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($this->user)
            ->patch("/customer/orders/{$order->id}/refund-destination", [
                'destination_type' => 'ewallet',
                'ewallet_provider' => 'GoPay',
                'ewallet_number' => '08123456789',
                'ewallet_holder' => 'Test User',
            ]);

        $response->assertSessionHas('success', 'Tujuan refund berhasil disimpan.');
    }

    public function test_customer_cannot_submit_for_guest_order(): void
    {
        $guest = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->create([
            'customer_id' => $guest->id,
            'payment_status' => 'refund_pending',
        ]);

        $response = $this->actingAs($this->user)
            ->patch("/customer/orders/{$order->id}/refund-destination", [
                'destination_type' => 'bank',
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Test',
            ]);

        $response->assertForbidden();
    }

    public function test_blocked_after_start(): void
    {
        $order = Order::factory()->create([
            'customer_id' => $this->customer->id,
            'payment_status' => 'refund_in_progress',
        ]);

        $response = $this->actingAs($this->user)
            ->patch("/customer/orders/{$order->id}/refund-destination", [
                'destination_type' => 'bank',
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Test',
            ]);

        $response->assertSessionHas('error');
    }
}
