<?php

namespace Tests\Feature;

use App\Enums\RefundRejectionReason;
use App\Models\Customer;
use App\Models\Notification;
use App\Models\Order;
use App\Models\RefundStatusHistory;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\RefundService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RefundNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function registeredCustomer(): Customer
    {
        return Customer::factory()->create(['user_id' => User::factory()->create()->id]);
    }

    private function guestCustomer(): Customer
    {
        return Customer::factory()->create(['user_id' => null]);
    }

    public function test_refund_requested_notification_contains_history_id_and_url(): void
    {
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create(['customer_id' => $customer->id, 'total' => 50000]);

        $history = app(RefundService::class)->request($order, 'customer', null, 'customer_cancellation');

        $notif = Notification::where('customer_id', $customer->id)->first();
        $this->assertNotNull($notif);
        $this->assertSame($history->id, $notif->data['refund_history_id']);
        $this->assertStringContainsString("/customer/orders/{$order->id}", $notif->data['url']);
    }

    public function test_owner_receives_request_notification(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create(['customer_id' => $customer->id, 'total' => 50000]);

        app(RefundService::class)->request($order, 'customer', null, 'customer_cancellation');

        $ownerNotif = Notification::where('user_id', $owner->id)
            ->where('type', NotificationService::REFUND_REQUESTED)
            ->first();
        $this->assertNotNull($ownerNotif);
    }

    public function test_guest_request_does_not_notify_customer(): void
    {
        $customer = $this->guestCustomer();
        $order = Order::factory()->paid()->create(['customer_id' => $customer->id, 'total' => 50000]);

        app(RefundService::class)->request($order, 'guest', null, 'expiry');

        $this->assertDatabaseMissing('notifications', [
            'customer_id' => $customer->id,
        ]);
    }

    public function test_owner_receives_guest_request(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->guestCustomer();
        $order = Order::factory()->paid()->create(['customer_id' => $customer->id, 'total' => 50000]);

        app(RefundService::class)->request($order, 'guest', null, 'expiry');

        $ownerNotif = Notification::where('user_id', $owner->id)
            ->where('type', NotificationService::REFUND_REQUESTED)
            ->first();
        $this->assertNotNull($ownerNotif);
    }

    public function test_processing_started_notifies_customer_only(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Arya',
            'refund_amount' => 50000,
        ]);

        app(RefundService::class)->start($order, $owner->id);

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $customer->id,
            'type' => NotificationService::REFUND_PROCESSING_STARTED,
        ]);

        $this->assertDatabaseMissing('notifications', [
            'user_id' => $owner->id,
            'type' => NotificationService::REFUND_PROCESSING_STARTED,
        ]);
    }

    public function test_duplicate_notification_not_created_for_same_history(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create(['customer_id' => $customer->id, 'total' => 50000]);

        $history = app(RefundService::class)->request($order, 'customer', null, 'customer_cancellation');

        $notifService = app(NotificationService::class);
        $orderReloaded = $order->fresh()->loadMissing('customer');
        $notifService->notifyRefundEvent($orderReloaded, $history);
        $notifService->notifyRefundEvent($orderReloaded, $history);

        // Should have 2 total: 1 customer + 1 owner
        $this->assertDatabaseCount('notifications', 2);
    }

    public function test_completion_notification_for_registered_customer(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_in_progress',
            'refund_amount' => 50000,
            'refund_started_at' => now()->subHour(),
            'refund_started_by' => $owner->id,
        ]);

        app(RefundService::class)->complete($order, $owner->id, "private:refund-proofs/{$order->id}/p.jpg", null, null);

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $customer->id,
            'type' => NotificationService::REFUND_PROCESSED,
        ]);
    }

    public function test_rejection_notification_for_registered_customer(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_amount' => 50000,
        ]);

        app(RefundService::class)->reject($order, 'payment_unverified', null, 'owner', $owner->id);

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $customer->id,
            'type' => NotificationService::REFUND_REJECTED,
        ]);
    }

    public function test_rollback_notification_for_registered_customer(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_in_progress',
            'refund_amount' => 50000,
            'refund_started_at' => now()->subHour(),
            'refund_started_by' => $owner->id,
        ]);

        app(RefundService::class)->rollback($order, $owner->id, 'retry', 'Test rollback');

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $customer->id,
            'type' => NotificationService::REFUND_ROLLED_BACK,
        ]);
    }

    public function test_rollback_for_guest_creates_no_notification(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->guestCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_in_progress',
            'refund_amount' => 50000,
            'refund_started_at' => now()->subHour(),
            'refund_started_by' => $owner->id,
        ]);

        app(RefundService::class)->rollback($order, $owner->id, 'retry', 'Test');

        $this->assertDatabaseMissing('notifications', [
            'customer_id' => $customer->id,
        ]);
    }

    public function test_reopened_uses_destination_submitted_type(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_rejected',
            'refund_destination_status' => 'invalid',
            'refund_rejected_reason' => 'invalid_destination',
        ]);

        app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
        ]);

        $this->assertDatabaseHas('notifications', [
            'customer_id' => $customer->id,
            'type' => NotificationService::REFUND_DESTINATION_SUBMITTED,
        ]);
    }
}
