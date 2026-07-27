<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActiveRefundOrderVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function registeredCustomer(): array
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create([
            'user_id' => $user->id,
            'phone' => '6281234567810',
        ]);

        return [$user, $customer];
    }

    private function createRefundOrders(Customer $customer): array
    {
        $active = collect(Order::ACTIVE_REFUND_PAYMENT_STATUSES)->map(fn (string $paymentStatus) => Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => $paymentStatus,
        ])
        );

        $refunded = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'refunded',
        ]);

        return [$active, $refunded];
    }

    public function test_customer_orders_places_active_refunds_only_in_active_orders(): void
    {
        [$user, $customer] = $this->registeredCustomer();
        [$activeRefunds, $refunded] = $this->createRefundOrders($customer);

        $response = $this->actingAs($user)->get('/customer/orders')->assertOk();
        $props = $response->viewData('page')['props'];

        $activeIds = collect($props['activeOrders'])->pluck('id');
        $historyIds = collect($props['historyOrders']['data'])->pluck('id');

        $activeRefunds->each(fn (Order $order) => $this->assertTrue($activeIds->contains($order->id)));
        $activeRefunds->each(fn (Order $order) => $this->assertFalse($historyIds->contains($order->id)));
        $this->assertTrue($historyIds->contains($refunded->id));
    }

    public function test_customer_home_includes_active_refund_orders(): void
    {
        [$user, $customer] = $this->registeredCustomer();
        [$activeRefunds, $refunded] = $this->createRefundOrders($customer);

        $response = $this->actingAs($user)->get('/customer/home')->assertOk();
        $activeIds = collect($response->viewData('page')['props']['activeOrders'])->pluck('id');

        $activeRefunds->each(fn (Order $order) => $this->assertTrue($activeIds->contains($order->id)));
        $this->assertFalse($activeIds->contains($refunded->id));
    }

    public function test_guest_recovery_places_active_refunds_only_in_active_orders(): void
    {
        $customer = Customer::factory()->create([
            'user_id' => null,
            'is_registered' => false,
            'phone' => '6281234567811',
        ]);
        [$activeRefunds, $refunded] = $this->createRefundOrders($customer);

        $response = $this->postJson('/customer/orders/recovery', [
            'phone' => '081234567811',
        ])->assertOk();

        $activeIds = collect($response->json('active_orders'))->pluck('id');
        $recentIds = collect($response->json('recent_orders'))->pluck('id');

        $activeRefunds->each(fn (Order $order) => $this->assertTrue($activeIds->contains($order->id)));
        $activeRefunds->each(fn (Order $order) => $this->assertFalse($recentIds->contains($order->id)));
        $this->assertFalse($activeIds->contains($refunded->id));
        $this->assertTrue($recentIds->contains($refunded->id));
    }
}
