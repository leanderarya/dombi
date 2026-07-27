<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerOrderSeparationTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_model_has_status_constants(): void
    {
        $this->assertSame(
            ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering'],
            Order::ACTIVE_STATUSES
        );

        $this->assertSame(
            ['completed', 'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet', 'failed_delivery', 'expired'],
            Order::HISTORY_STATUSES
        );

        $this->assertSame(
            ['refund_pending', 'refund_in_progress', 'refund_rejected', 'refund_failed'],
            Order::ACTIVE_REFUND_PAYMENT_STATUSES
        );
    }

    public function test_customer_visibility_scopes_treat_active_refunds_as_active_and_refunded_as_history(): void
    {
        $customer = Customer::factory()->create();

        $ordinaryActive = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CONFIRMED,
            'payment_status' => 'paid',
        ]);

        $activeRefunds = collect(Order::ACTIVE_REFUND_PAYMENT_STATUSES)->map(fn (string $paymentStatus) => Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => $paymentStatus,
            'refund_rejected_reason' => $paymentStatus === 'refund_rejected' ? \App\Enums\RefundRejectionReason::InvalidDestination->value : null,
        ])
        );

        $refunded = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'payment_status' => 'refunded',
        ]);

        $historyWithoutPaymentStatus = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => null,
        ]);

        $activeIds = Order::query()
            ->where('customer_id', $customer->id)
            ->visibleAsCustomerActive()
            ->pluck('id');

        $historyIds = Order::query()
            ->where('customer_id', $customer->id)
            ->visibleAsCustomerHistory()
            ->pluck('id');

        $this->assertTrue($activeIds->contains($ordinaryActive->id));
        $activeRefunds->each(fn (Order $order) => $this->assertTrue($activeIds->contains($order->id)));
        $activeRefunds->each(fn (Order $order) => $this->assertFalse($historyIds->contains($order->id)));
        $this->assertTrue($historyIds->contains($refunded->id));
        $this->assertTrue($historyIds->contains($historyWithoutPaymentStatus->id));
    }

    public function test_customer_active_scope_preserves_confirmation_expiry_guard(): void
    {
        $customer = Customer::factory()->create();

        $expiredConfirmation = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'payment_status' => 'pending',
            'confirmation_expires_at' => now()->subMinute(),
        ]);

        $activeRefund = Order::factory()->create([
            'customer_id' => $customer->id,
            'status' => Order::STATUS_EXPIRED,
            'payment_status' => 'refund_pending',
            'confirmation_expires_at' => now()->subMinute(),
        ]);

        $activeIds = Order::query()
            ->where('customer_id', $customer->id)
            ->visibleAsCustomerActive()
            ->pluck('id');

        $this->assertFalse($activeIds->contains($expiredConfirmation->id));
        $this->assertTrue($activeIds->contains($activeRefund->id));
    }
}
