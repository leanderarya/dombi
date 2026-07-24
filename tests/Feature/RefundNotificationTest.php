<?php

namespace Tests\Feature;

use App\Enums\RefundRejectionReason;
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
        $order = Order::factory()->create([
            'payment_status' => 'refunded',
            'refund_account_number' => '1234567890',
            'refund_ewallet_number' => '081234567890',
        ]);

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
        $this->assertStringContainsString('tujuan refund', $notification->message);
        $this->assertStringNotContainsString('metode pembayaran', $notification->message);
        $this->assertStringNotContainsString('1234567890', $notification->toJson());
        $this->assertStringNotContainsString('081234567890', $notification->toJson());
    }

    public function test_notify_refund_destination_submitted_creates_customer_notification_without_destination_number(): void
    {
        $order = Order::factory()->create([
            'refund_account_number' => '1234567890',
            'refund_ewallet_number' => '081234567890',
        ]);

        app(NotificationService::class)->notifyRefundDestinationSubmitted($order, false);

        $notification = Notification::where('customer_id', $order->customer_id)
            ->where('type', 'order.refund_destination_submitted')
            ->firstOrFail();

        $this->assertStringContainsString('disimpan', $notification->message);
        $this->assertStringNotContainsString('1234567890', $notification->toJson());
        $this->assertStringNotContainsString('081234567890', $notification->toJson());
    }

    public function test_notify_refund_destination_updated_uses_submitted_type_without_destination_number(): void
    {
        $order = Order::factory()->create([
            'refund_account_number' => '1234567890',
            'refund_ewallet_number' => '081234567890',
        ]);

        app(NotificationService::class)->notifyRefundDestinationSubmitted($order, true);

        $notification = Notification::where('customer_id', $order->customer_id)
            ->where('type', 'order.refund_destination_submitted')
            ->firstOrFail();

        $this->assertStringContainsString('diperbarui', $notification->message);
        $this->assertStringNotContainsString('1234567890', $notification->toJson());
        $this->assertStringNotContainsString('081234567890', $notification->toJson());
    }

    public function test_notify_refund_processing_started_creates_customer_notification_without_destination_number(): void
    {
        $order = Order::factory()->create(['refund_account_number' => '1234567890']);

        app(NotificationService::class)->notifyRefundProcessingStarted($order);

        $notification = Notification::where('customer_id', $order->customer_id)
            ->where('type', 'order.refund_processing_started')
            ->firstOrFail();

        $this->assertStringContainsString('mentransfer', $notification->message);
        $this->assertStringNotContainsString('1234567890', $notification->toJson());
    }

    public function test_notify_refund_rejected_creates_customer_notification_without_destination_number(): void
    {
        $order = Order::factory()->create(['refund_account_number' => '1234567890']);

        app(NotificationService::class)->notifyRefundRejected($order, RefundRejectionReason::InvalidDestination);

        $notification = Notification::where('customer_id', $order->customer_id)
            ->where('type', 'order.refund_rejected')
            ->firstOrFail();

        $this->assertSame(RefundRejectionReason::InvalidDestination->value, $notification->data['reason']);
        $this->assertStringContainsString(RefundRejectionReason::InvalidDestination->label(), $notification->message);
        $this->assertStringNotContainsString('1234567890', $notification->toJson());
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
