<?php

namespace Tests\Feature;

use App\Enums\RefundRejectionReason;
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
        $rejectionReasons = [
            'refund_pending' => null,
            'refund_in_progress' => null,
            'refund_rejected' => RefundRejectionReason::InvalidDestination->value,
            'refund_failed' => null,
        ];

        $active = collect(Order::ACTIVE_REFUND_PAYMENT_STATUSES)->map(fn (string $paymentStatus) => Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => $paymentStatus,
            'refund_rejected_reason' => $rejectionReasons[$paymentStatus] ?? null,
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

        $activeOrders = collect($props['activeOrders'])->keyBy('id');
        $activeIds = $activeOrders->keys();
        $historyIds = collect($props['historyOrders']['data'])->pluck('id');

        $activeRefunds->each(fn (Order $order) => $this->assertTrue($activeIds->contains($order->id)));
        $activeRefunds->each(fn (Order $order) => $this->assertFalse($historyIds->contains($order->id)));
        $this->assertTrue($historyIds->contains($refunded->id));

        $expectedLabels = [
            'refund_pending' => 'Menunggu Diproses',
            'refund_in_progress' => 'Sedang Diproses',
            'refund_rejected' => 'Refund Ditolak',
            'refund_failed' => 'Refund Gagal',
        ];

        $activeRefunds->each(function (Order $order) use ($activeOrders, $expectedLabels) {
            $badge = $activeOrders->get($order->id)['refund_badge'] ?? null;

            $this->assertNotNull($badge);
            $this->assertSame($order->payment_status, $badge['payment_status']);
            $this->assertSame($expectedLabels[$order->payment_status], $badge['status_label']);
            $this->assertNotEmpty($badge['queue_state']);
        });
    }

    public function test_customer_home_includes_active_refund_orders(): void
    {
        [$user, $customer] = $this->registeredCustomer();
        [$activeRefunds, $refunded] = $this->createRefundOrders($customer);

        $response = $this->actingAs($user)->get('/customer/home')->assertOk();
        $activeOrders = collect($response->viewData('page')['props']['activeOrders'])->keyBy('id');
        $activeIds = $activeOrders->keys();

        $activeRefunds->each(fn (Order $order) => $this->assertTrue($activeIds->contains($order->id)));
        $this->assertFalse($activeIds->contains($refunded->id));

        $expectedLabels = [
            'refund_pending' => 'Menunggu Diproses',
            'refund_in_progress' => 'Sedang Diproses',
            'refund_rejected' => 'Refund Ditolak',
            'refund_failed' => 'Refund Gagal',
        ];

        $activeRefunds->each(function (Order $order) use ($activeOrders, $expectedLabels) {
            $badge = $activeOrders->get($order->id)['refund_badge'] ?? null;

            $this->assertNotNull($badge);
            $this->assertSame($order->payment_status, $badge['payment_status']);
            $this->assertSame($expectedLabels[$order->payment_status], $badge['status_label']);
            $this->assertNotEmpty($badge['queue_state']);
        });
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

        $activeOrders = collect($response->json('active_orders'))->keyBy('id');
        $activeIds = $activeOrders->keys();
        $recentIds = collect($response->json('recent_orders'))->pluck('id');

        $activeRefunds->each(fn (Order $order) => $this->assertTrue($activeIds->contains($order->id)));
        $activeRefunds->each(fn (Order $order) => $this->assertFalse($recentIds->contains($order->id)));
        $this->assertFalse($activeIds->contains($refunded->id));
        $this->assertTrue($recentIds->contains($refunded->id));

        $expectedLabels = [
            'refund_pending' => 'Menunggu Diproses',
            'refund_in_progress' => 'Sedang Diproses',
            'refund_rejected' => 'Refund Ditolak',
            'refund_failed' => 'Refund Gagal',
        ];

        $activeRefunds->each(function (Order $order) use ($activeOrders, $expectedLabels) {
            $badge = $activeOrders->get($order->id)['refund_badge'] ?? null;

            $this->assertNotNull($badge);
            $this->assertSame($order->payment_status, $badge['payment_status']);
            $this->assertSame($expectedLabels[$order->payment_status], $badge['status_label']);
            $this->assertNotEmpty($badge['queue_state']);
        });
    }

    public function test_terminal_refund_rejected_appears_in_history(): void
    {
        [$user, $customer] = $this->registeredCustomer();

        $active = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'refund_rejected',
            'refund_rejected_reason' => RefundRejectionReason::InvalidDestination->value,
        ]);

        $history = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'refund_rejected',
            'refund_rejected_reason' => RefundRejectionReason::PaymentUnverified->value,
        ]);

        $response = $this->actingAs($user)->get('/customer/orders')->assertOk();
        $props = $response->viewData('page')['props'];
        $activeIds = collect($props['activeOrders'])->pluck('id');
        $historyIds = collect($props['historyOrders']['data'])->pluck('id');

        $this->assertTrue($activeIds->contains($active->id));
        $this->assertFalse($historyIds->contains($active->id));
        $this->assertFalse($activeIds->contains($history->id));
        $this->assertTrue($historyIds->contains($history->id));
    }
}
