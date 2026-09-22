<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerExpiredHistoryFilterTest extends TestCase
{
    use RefreshDatabase;

    private function customerUser(): array
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'user_id' => $user->id,
            'name' => 'Test Customer',
            'phone' => '628123456781',
            'is_registered' => true,
        ]);

        return [$user, $customer];
    }

    public function test_failed_filter_keeps_failed_delivery(): void
    {
        [$user, $customer] = $this->customerUser();

        $failedDelivery = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_FAILED_DELIVERY,
            'payment_status' => 'paid',
        ]);

        $this->actingAs($user)
            ->get('/customer/orders?filter=failed')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('historyOrders.data', 1)
                ->where('historyOrders.data.0.id', $failedDelivery->id));
    }

    public function test_failed_filter_drops_expired_even_when_money_moved(): void
    {
        [$user, $customer] = $this->customerUser();

        $refundedExpired = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_EXPIRED,
            'payment_status' => 'refunded',
        ]);

        $this->actingAs($user)
            ->get('/customer/orders?filter=failed')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('historyOrders.data', 0));

        $this->actingAs($user)
            ->get('/customer/orders')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('historyOrders.data', 1)
                ->where('historyOrders.data.0.id', $refundedExpired->id));
    }
}
