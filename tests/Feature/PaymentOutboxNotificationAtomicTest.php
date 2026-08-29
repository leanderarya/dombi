<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Jobs\DispatchPaymentOutboxEvent;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\PaymentAttempt;
use App\Models\PaymentOutboxEvent;
use App\Models\User;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\NormalizedPaymentEvent;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PaymentOutboxNotificationAtomicTest extends TestCase
{
    use RefreshDatabase;

    public function test_outbox_notification_only_appears_after_job_handle_not_direct(): void
    {
        // No direct notifyOrderCreated — notification must come through outbox → listener
        Queue::fake();
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::create([
            'name' => 'Atomic Outlet',
            'user_id' => $outletUser->id,
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Test Address',
            'status' => 'active',
        ]);
        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();
        [$order, $attempt] = $this->attempt(['outlet_id' => $outlet->id]);

        // Apply payment — outbox event created, but notifyOrderCreated NOT yet called
        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent(
            'doku', 'SUCCESS', 50000, 'IDR', 'invoice-first', now(), []
        ));

        // Before outbox handle: no notification should exist
        $this->assertSame(0, Notification::query()
            ->where('type', NotificationService::ORDER_CREATED)
            ->where('user_id', $outletUser->id)
            ->count(), 'Notification leaked before outbox handle');

        // Handle outbox job
        $outbox = PaymentOutboxEvent::query()->where('event_type', 'payment.paid')->firstOrFail();
        (new DispatchPaymentOutboxEvent($outbox->id))->handle();

        // After outbox handle: notification must exist
        $this->assertSame(1, Notification::query()
            ->where('type', NotificationService::ORDER_CREATED)
            ->where('user_id', $outletUser->id)
            ->count(), 'Notification missing after outbox handle');
    }

    public function test_notify_order_created_is_atomic_and_no_duplicate(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::create([
            'name' => 'Atomic Test Outlet',
            'user_id' => $outletUser->id,
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Test Address',
            'status' => 'active',
        ]);
        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'total' => 50000, 'payment_status' => 'paid']);

        $service = app(NotificationService::class);

        // First call: creates notification
        $service->notifyOrderCreated($order);

        $this->assertSame(1, Notification::query()
            ->where('type', NotificationService::ORDER_CREATED)
            ->where('user_id', $outletUser->id)
            ->where('entity_type', 'order')
            ->where('entity_id', $order->id)
            ->count());

        // Second call: must NOT create duplicate
        $service->notifyOrderCreated($order);

        $this->assertSame(1, Notification::query()
            ->where('type', NotificationService::ORDER_CREATED)
            ->where('user_id', $outletUser->id)
            ->where('entity_type', 'order')
            ->where('entity_id', $order->id)
            ->count());
    }

    public function test_notify_order_created_throw_on_failure_modes_both_succeed(): void
    {
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::create([
            'name' => 'Throw Mode Outlet',
            'user_id' => $outletUser->id,
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Test Address',
            'status' => 'active',
        ]);
        $outletUser->forceFill(['outlet_id' => $outlet->id])->save();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'total' => 50000, 'payment_status' => 'paid']);

        $service = app(NotificationService::class);

        // Default (best-effort): does not throw, creates notification
        $service->notifyOrderCreated($order);
        $this->assertSame(1, Notification::query()
            ->where('type', NotificationService::ORDER_CREATED)
            ->where('user_id', $outletUser->id)
            ->count());

        // throwOnFailure mode: also does not throw when push succeeds
        $service->notifyOrderCreated($order, throwOnFailure: true);
        $this->assertSame(1, Notification::query()
            ->where('type', NotificationService::ORDER_CREATED)
            ->where('user_id', $outletUser->id)
            ->count());
    }

    private function attempt(array $order = []): array
    {
        $order = Order::factory()->create($order + ['total' => 50000, 'payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => 'first', 'invoice_number' => 'invoice-first',
            'merchant_request_id' => 'request-first', 'amount_snapshot' => 50000, 'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);

        return [$order, $attempt];
    }
}
