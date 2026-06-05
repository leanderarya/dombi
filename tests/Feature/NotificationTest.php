<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Delivery;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $outletUser;
    private User $courier;
    private Customer $customer;
    private Outlet $outlet;
    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->outletUser = User::factory()->create(['role' => 'outlet']);
        $this->courier = User::factory()->create(['role' => 'courier']);
        $this->customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890']);
        $this->outlet = Outlet::create([
            'name' => 'Test Outlet',
            'user_id' => $this->outletUser->id,
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Test Address',
            'status' => 'active',
        ]);
        $this->outletUser->forceFill(['outlet_id' => $this->outlet->id])->save();

        $this->order = Order::create([
            'customer_id' => $this->customer->id,
            'outlet_id' => $this->outlet->id,
            'order_code' => 'ORD-TEST-001',
            'status' => 'pending_confirmation',
            'subtotal' => 50000,
            'total' => 55000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Test Address',
        ]);
    }

    // ─── NOTIFICATION CREATION ─────────────────────────────────────

    public function test_notification_can_be_created(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test Title',
            'message' => 'Test message',
        ]);

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
        ]);
    }

    public function test_notification_can_be_marked_as_read(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test',
            'message' => 'Test',
        ]);

        $this->assertNull($notification->read_at);

        $notification->markAsRead();

        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_notification_is_read_returns_correct_state(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test',
            'message' => 'Test',
        ]);

        $this->assertFalse($notification->isRead());

        $notification->markAsRead();

        $this->assertTrue($notification->fresh()->isRead());
    }

    public function test_notification_stores_data_as_json(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test',
            'message' => 'Test',
            'data' => ['order_id' => 1, 'order_code' => 'ORD-001'],
        ]);

        $this->assertEquals(['order_id' => 1, 'order_code' => 'ORD-001'], $notification->fresh()->data);
    }

    // ─── NOTIFICATION SERVICE ──────────────────────────────────────

    public function test_order_confirmed_notifies_customer(): void
    {
        $service = app(NotificationService::class);
        $this->order->update(['status' => 'confirmed']);
        $service->notifyOrderConfirmed($this->order);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'customer',
            'customer_id' => $this->customer->id,
            'type' => NotificationService::ORDER_CONFIRMED,
        ]);
    }

    public function test_order_rejected_notifies_customer_and_owner(): void
    {
        $service = app(NotificationService::class);
        $service->notifyOrderRejected($this->order, 'Stok Tidak Tersedia');

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'customer',
            'customer_id' => $this->customer->id,
            'type' => NotificationService::ORDER_REJECTED,
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_REJECTED,
        ]);
    }

    public function test_courier_assigned_notifies_all_roles(): void
    {
        $delivery = Delivery::create([
            'order_id' => $this->order->id,
            'courier_id' => $this->courier->id,
            'status' => 'waiting_pickup',
            'assigned_by' => $this->owner->id,
        ]);
        $delivery->load('order');

        $service = app(NotificationService::class);
        $service->notifyCourierAssigned($delivery);

        // Customer notified
        $this->assertDatabaseHas('notifications', [
            'user_type' => 'customer',
            'customer_id' => $this->customer->id,
            'type' => NotificationService::COURIER_ASSIGNED,
        ]);

        // Courier notified
        $this->assertDatabaseHas('notifications', [
            'user_type' => 'courier',
            'user_id' => $this->courier->id,
            'type' => NotificationService::COURIER_ASSIGNED,
        ]);

        // Outlet notified
        $this->assertDatabaseHas('notifications', [
            'user_type' => 'outlet',
            'user_id' => $this->outletUser->id,
            'type' => NotificationService::COURIER_ASSIGNED,
        ]);
    }

    public function test_delivery_failed_notifies_customer_owner_outlet(): void
    {
        $delivery = Delivery::create([
            'order_id' => $this->order->id,
            'courier_id' => $this->courier->id,
            'status' => 'failed',
            'assigned_by' => $this->owner->id,
            'failed_reason' => 'Customer not found',
        ]);
        $delivery->load('order');

        $service = app(NotificationService::class);
        $service->notifyDeliveryFailed($delivery, 'Customer not found');

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'customer',
            'type' => NotificationService::DELIVERY_FAILED,
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'owner',
            'type' => NotificationService::DELIVERY_FAILED,
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'outlet',
            'type' => NotificationService::DELIVERY_FAILED,
        ]);
    }

    public function test_sla_violation_notifies_owners(): void
    {
        $service = app(NotificationService::class);
        $service->notifySlaViolation('SLA Violation', 'Order ORD-001 has exceeded pickup SLA', ['order_id' => 1]);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::SLA_VIOLATION,
            'title' => 'SLA Violation',
        ]);
    }

    // ─── NOTIFICATION API ──────────────────────────────────────────

    public function test_user_can_fetch_notifications(): void
    {
        Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test',
            'message' => 'Test message',
        ]);

        $this->actingAs($this->owner)
            ->getJson('/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('unread_count', 1);
    }

    public function test_user_can_get_unread_count(): void
    {
        Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test',
            'message' => 'Test',
        ]);

        Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test 2',
            'message' => 'Test 2',
            'read_at' => now(),
        ]);

        $this->actingAs($this->owner)
            ->getJson('/notifications/unread-count')
            ->assertOk()
            ->assertJson(['unread_count' => 1]);
    }

    public function test_user_can_mark_notification_as_read(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test',
            'message' => 'Test',
        ]);

        $this->actingAs($this->owner)
            ->postJson("/notifications/{$notification->id}/read")
            ->assertOk();

        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_user_can_mark_all_notifications_as_read(): void
    {
        Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test 1',
            'message' => 'Test 1',
        ]);

        Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test 2',
            'message' => 'Test 2',
        ]);

        $this->actingAs($this->owner)
            ->postJson('/notifications/read-all')
            ->assertOk();

        $this->assertDatabaseMissing('notifications', [
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'read_at' => null,
        ]);
    }

    public function test_user_cannot_mark_other_users_notification_as_read(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Test',
            'message' => 'Test',
        ]);

        $this->actingAs($this->outletUser)
            ->postJson("/notifications/{$notification->id}/read")
            ->assertForbidden();
    }

    public function test_notifications_only_show_for_correct_user_type(): void
    {
        Notification::create([
            'user_type' => 'owner',
            'user_id' => $this->owner->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Owner Notification',
            'message' => 'For owner',
        ]);

        Notification::create([
            'user_type' => 'outlet',
            'user_id' => $this->outletUser->id,
            'type' => NotificationService::ORDER_CONFIRMED,
            'title' => 'Outlet Notification',
            'message' => 'For outlet',
        ]);

        $this->actingAs($this->owner)
            ->getJson('/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.title', 'Owner Notification');
    }

    // ─── EVENT INTEGRATION ─────────────────────────────────────────

    public function test_order_confirmation_creates_notification(): void
    {
        $this->order->update(['status' => 'pending_confirmation']);

        $orderStatusService = app(OrderStatusService::class);
        $orderStatusService->updateStatus($this->order, 'confirmed', $this->outletUser);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'customer',
            'customer_id' => $this->customer->id,
            'type' => NotificationService::ORDER_CONFIRMED,
        ]);
    }

    public function test_order_rejection_via_service_creates_notification(): void
    {
        $orderStatusService = app(OrderStatusService::class);
        $orderStatusService->rejectOrder($this->order, 'Stok Tidak Tersedia', null, $this->outletUser);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'customer',
            'customer_id' => $this->customer->id,
            'type' => NotificationService::ORDER_REJECTED,
        ]);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'owner',
            'type' => NotificationService::ORDER_REJECTED,
        ]);
    }

    // ─── MODEL SCOPES ──────────────────────────────────────────────

    public function test_unread_scope(): void
    {
        Notification::create([
            'user_type' => 'owner', 'user_id' => $this->owner->id,
            'type' => 'test', 'title' => 'Unread', 'message' => 'Unread',
        ]);

        Notification::create([
            'user_type' => 'owner', 'user_id' => $this->owner->id,
            'type' => 'test', 'title' => 'Read', 'message' => 'Read',
            'read_at' => now(),
        ]);

        $this->assertCount(1, Notification::unread()->get());
    }

    public function test_for_user_scope(): void
    {
        Notification::create([
            'user_type' => 'owner', 'user_id' => $this->owner->id,
            'type' => 'test', 'title' => 'Owner', 'message' => 'Owner',
        ]);

        Notification::create([
            'user_type' => 'outlet', 'user_id' => $this->outletUser->id,
            'type' => 'test', 'title' => 'Outlet', 'message' => 'Outlet',
        ]);

        $this->assertCount(1, Notification::forUser('owner', $this->owner->id)->get());
    }

    public function test_for_customer_scope(): void
    {
        Notification::create([
            'user_type' => 'customer', 'customer_id' => $this->customer->id,
            'type' => 'test', 'title' => 'Customer', 'message' => 'Customer',
        ]);

        $this->assertCount(1, Notification::forCustomer($this->customer->id)->get());
    }

    public function test_notification_mark_as_read(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner', 'user_id' => $this->owner->id,
            'type' => 'test', 'title' => 'Test', 'message' => 'Test',
        ]);

        $this->assertFalse($notification->isRead());

        $notification->markAsRead();

        $this->assertTrue($notification->fresh()->isRead());
    }

    public function test_notification_mark_as_read_is_idempotent(): void
    {
        $notification = Notification::create([
            'user_type' => 'owner', 'user_id' => $this->owner->id,
            'type' => 'test', 'title' => 'Test', 'message' => 'Test',
        ]);

        $notification->markAsRead();
        $firstReadAt = $notification->fresh()->read_at;

        // Call again - should not change the timestamp
        $notification->markAsRead();
        $this->assertEquals($firstReadAt, $notification->fresh()->read_at);
    }
}
