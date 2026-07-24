<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use App\Enums\RefundRejectionReason;
use App\Models\Order;
use App\Services\PaymentStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentStatusServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_transition_applies_only_when_current_status_matches(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Paid, ['paid_at' => now()]);
        $this->assertTrue($ok);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => 'paid']);
    }

    public function test_transition_is_no_op_when_current_status_differs(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Pending);
        $this->assertFalse($ok);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => 'paid']);
    }

    public function test_cannot_transition_a_terminal_status(): void
    {
        $order = Order::factory()->create(['payment_status' => 'refunded']);
        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Pending);
        $this->assertFalse($ok);
    }

    public function test_refund_pending_can_transition_to_refund_in_progress(): void
    {
        $order = Order::factory()->create(['payment_status' => PaymentStatus::RefundPending->value]);

        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::RefundInProgress);

        $this->assertTrue($ok);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'payment_status' => PaymentStatus::RefundInProgress->value,
        ]);
    }

    public function test_refund_in_progress_can_transition_to_refunded(): void
    {
        $order = Order::factory()->create(['payment_status' => PaymentStatus::RefundInProgress->value]);

        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Refunded);

        $this->assertTrue($ok);
        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'payment_status' => PaymentStatus::Refunded->value,
        ]);
    }

    public function test_refund_in_progress_cannot_transition_to_refund_rejected(): void
    {
        $order = Order::factory()->create(['payment_status' => PaymentStatus::RefundInProgress->value]);

        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::RefundRejected);

        $this->assertFalse($ok);
    }

    public function test_refund_pending_cannot_transition_directly_to_refunded(): void
    {
        $order = Order::factory()->create(['payment_status' => PaymentStatus::RefundPending->value]);

        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::Refunded);

        $this->assertFalse($ok);
    }

    public function test_transition_matrix(): void
    {
        $service = app(PaymentStatusService::class);

        // Allowed transitions
        $this->assertTransitionSucceeds($service, 'pending', 'paid');
        $this->assertTransitionSucceeds($service, 'failed', 'paid');
        $this->assertTransitionSucceeds($service, 'expired', 'paid');

        // Blocked transitions
        $this->assertTransitionFails($service, 'settled', 'paid');
        $this->assertTransitionFails($service, 'refunded', 'paid');

        // Same-state (idempotency guard)
        foreach (['pending', 'paid', 'failed', 'expired', 'settled', 'refunded'] as $status) {
            $this->assertSameStatusFails($service, $status);
        }

        // CAS race condition (lost update)
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $stale = Order::find($order->id);
        $order->update(['payment_status' => 'paid']);
        $this->assertFalse($service->transition($stale, PaymentStatus::Failed));
    }

    private function assertTransitionSucceeds(PaymentStatusService $service, string $from, string $to): void
    {
        $order = Order::factory()->create(['payment_status' => $from]);
        $ok = $service->transition($order, PaymentStatus::from($to));
        $this->assertTrue($ok, "Expected $from -> $to to succeed");
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => $to]);
    }

    private function assertTransitionFails(PaymentStatusService $service, string $from, string $to): void
    {
        $order = Order::factory()->create(['payment_status' => $from]);
        $ok = $service->transition($order, PaymentStatus::from($to));
        $this->assertFalse($ok, "Expected $from -> $to to fail");
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => $from]);
    }

    private function assertSameStatusFails(PaymentStatusService $service, string $status): void
    {
        $order = Order::factory()->create(['payment_status' => $status]);
        $ok = $service->transition($order, PaymentStatus::from($status));
        $this->assertFalse($ok, "Expected same-status $status -> $status to fail");
    }

    public function test_only_eligible_rejection_reasons_can_reopen_refund(): void
    {
        $service = app(PaymentStatusService::class);

        foreach ([RefundRejectionReason::InvalidDestination, RefundRejectionReason::IncompleteDestination] as $reason) {
            $order = Order::factory()->create([
                'payment_status' => PaymentStatus::RefundRejected->value,
                'refund_rejected_reason' => $reason->value,
            ]);

            $this->assertTrue($service->reopenRefund($order));
            $this->assertDatabaseHas('orders', [
                'id' => $order->id,
                'payment_status' => PaymentStatus::RefundPending->value,
                'refund_rejected_reason' => null,
            ]);
        }

        foreach ([RefundRejectionReason::PaymentUnverified, RefundRejectionReason::DuplicateRefund, RefundRejectionReason::Other] as $reason) {
            $order = Order::factory()->create([
                'payment_status' => PaymentStatus::RefundRejected->value,
                'refund_rejected_reason' => $reason->value,
            ]);

            $this->assertFalse($service->reopenRefund($order));
            $this->assertDatabaseHas('orders', [
                'id' => $order->id,
                'payment_status' => PaymentStatus::RefundRejected->value,
                'refund_rejected_reason' => $reason->value,
            ]);
        }
    }
}
