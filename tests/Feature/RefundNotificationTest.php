<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Order;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_notify_refund_requested_creates_customer_notification(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refund_pending']);

        app(NotificationService::class)->notifyRefundRequested($order);

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $order->customer_id,
            'type' => 'order.refund_requested',
            'entity_type' => 'order',
            'entity_id' => $order->id,
        ]);

        $notification = Notification::where('customer_id', $order->customer_id)
            ->where('type', 'order.refund_requested')
            ->first();

        $this->assertStringContainsString('dibatalkan', $notification->message);
        $this->assertStringContainsString('refund_pending', $notification->data['payment_status'] ?? '');
    }

    public function test_notify_refund_processed_creates_customer_notification(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refunded']);

        app(NotificationService::class)->notifyRefundProcessed($order, 75000);

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $order->customer_id,
            'type' => 'order.refund_processed',
            'entity_type' => 'order',
            'entity_id' => $order->id,
        ]);

        $notification = Notification::where('customer_id', $order->customer_id)
            ->where('type', 'order.refund_processed')
            ->first();

        $this->assertStringContainsString('75.000', $notification->message);
    }

    public function test_notify_refund_requested_no_customer_does_nothing(): void
    {
        $order = Order::factory()->create([
            'customer_id' => null,
            'payment_status' => 'refund_pending',
        ]);

        app(NotificationService::class)->notifyRefundRequested($order);

        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_notify_refund_processed_no_customer_does_nothing(): void
    {
        $order = Order::factory()->create([
            'customer_id' => null,
            'payment_status' => 'refunded',
        ]);

        app(NotificationService::class)->notifyRefundProcessed($order, 50000);

        $this->assertDatabaseCount('notifications', 0);
    }
}
