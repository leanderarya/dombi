<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundDestinationRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_registered_customer_can_submit_own_destination(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $order = Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->patch("/customer/orders/{$order->id}/refund-destination", [
                'destination_type' => 'bank',
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Test User',
            ]);

        $response->assertSessionHas('success');
    }

    public function test_registered_customer_cannot_submit_guest_destination(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $guest = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->create(['customer_id' => $guest->id, 'payment_status' => 'refund_pending']);

        $response = $this->actingAs($user)
            ->patch("/customer/orders/{$order->id}/refund-destination", [
                'destination_type' => 'bank',
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Test',
            ]);

        $response->assertStatus(403);
    }

    public function test_owner_can_submit_guest_destination(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $guest = Customer::factory()->create(['user_id' => null]);

        $order = Order::factory()->create([
            'customer_id' => $guest->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $response = $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/destination", [
                'destination_type' => 'bank',
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Guest Name',
                'phone_verified' => true,
            ]);

        $response->assertSessionHas('success');
    }

    public function test_owner_cannot_submit_registered_destination_via_owner_route(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        $order = Order::factory()->create(['customer_id' => $customer->id, 'payment_status' => 'refund_pending']);

        $response = $this->actingAs($owner)
            ->post("/owner/refunds/{$order->id}/destination", [
                'destination_type' => 'bank',
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Test',
                'phone_verified' => true,
            ]);

        $response->assertForbidden();
    }
}
