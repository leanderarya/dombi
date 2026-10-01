<?php

namespace Tests\Feature;

use App\Enums\RefundObligationStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Models\User;
use App\Services\RefundObligationService;
use App\Services\RefundPayloadService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RefundQueueStateTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    /**
     * @return array{0: Order, 1: RefundObligation}
     */
    private function orderWithObligation(string $status, bool $withDestination): array
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create()->id]);
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_reason' => 'customer_cancellation',
            'refund_destination_status' => $withDestination ? 'valid' : 'missing',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);
        $key = "queue-state-{$status}-".uniqid();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => $key,
            'invoice_number' => $key,
            'merchant_request_id' => $key,
            'amount_snapshot' => 50000,
            'currency_snapshot' => 'IDR',
        ]);
        $obligation = RefundObligation::create(array_merge([
            'payment_attempt_id' => $attempt->id,
            'amount' => 50000,
            'currency' => 'IDR',
            'reason' => 'customer_cancellation',
            'status' => $status,
            'requested_at' => now(),
        ], $withDestination ? [
            'destination_type' => 'bank',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
            'destination_submitted_at' => now(),
        ] : []));

        return [$order, $obligation];
    }

    public function test_needs_review_obligation_stays_in_its_own_queue(): void
    {
        [$order] = $this->orderWithObligation('needs_review', false);
        $service = app(RefundPayloadService::class);

        $this->assertSame('needs_review', $service->queueState($order));
        $this->assertSame('Perlu Ditinjau', $service->queueLabel('needs_review'));
        $this->assertSame('Perlu Ditinjau', $service->statusLabel($order));
        $this->assertContains('needs_review', $service::QUEUES);
    }

    public function test_for_owner_marks_only_can_recover_for_a_needs_review_obligation(): void
    {
        [$order] = $this->orderWithObligation('needs_review', true);

        $payload = app(RefundPayloadService::class)->forOwner($order);

        $this->assertNotNull($payload);
        $this->assertSame('needs_review', $payload['queue_state']);
        $this->assertTrue($payload['can_recover']);
        $this->assertFalse($payload['can_start']);
        $this->assertFalse($payload['can_complete']);
        $this->assertFalse($payload['can_rollback']);
        $this->assertFalse($payload['can_reject']);
        $this->assertFalse($payload['can_enter_destination']);
        $this->assertArrayNotHasKey('can_legacy_repair', $payload);
    }

    public function test_recover_returns_a_needs_review_obligation_to_the_queue(): void
    {
        [$readyOrder, $readyObligation] = $this->orderWithObligation('needs_review', true);
        [$awaitingOrder, $awaitingObligation] = $this->orderWithObligation('needs_review', false);
        $service = app(RefundPayloadService::class);

        $this->actingAs($this->owner)
            ->post("/owner/finance/refund-obligations/{$readyObligation->id}/recover")
            ->assertRedirect();
        $this->assertNotNull(session('success'));
        $this->assertSame('pending', $readyObligation->fresh()->status->value);
        $this->assertNull($readyObligation->fresh()->started_at);
        $this->assertSame('ready', $service->queueState($readyOrder->fresh()));

        $this->actingAs($this->owner)
            ->post("/owner/finance/refund-obligations/{$awaitingObligation->id}/recover")
            ->assertRedirect();
        $this->assertSame('pending', $awaitingObligation->fresh()->status->value);
        $this->assertSame('awaiting_customer', $service->queueState($awaitingOrder->fresh()));

        $this->assertSame('refund_pending', $readyOrder->fresh()->payment_status);
    }

    public function test_recover_refuses_a_completed_obligation(): void
    {
        [$order, $obligation] = $this->orderWithObligation('completed', true);

        $this->assertFalse(
            app(RefundObligationService::class)->transition($obligation, RefundObligationStatus::Pending)
        );

        $this->actingAs($this->owner)
            ->post("/owner/finance/refund-obligations/{$obligation->id}/recover")
            ->assertRedirect();
        $this->assertNull(session('success'));
        $this->assertNotNull(session('error'));
        $this->assertSame('completed', $obligation->fresh()->status->value);
        $this->assertSame('completed', app(RefundPayloadService::class)->queueState($order->fresh()));
    }

    public function test_recover_route_is_registered_and_needs_review_is_a_valid_filter(): void
    {
        $this->assertSame('/owner/finance/refund-obligations/1/recover', route('owner.finance.refund-obligations.recover', ['obligation' => 1], false));
        $this->assertSame('/owner/finance/refund-obligations/1', route('owner.finance.refund-obligations.show', ['obligation' => 1], false));

        $this->actingAs($this->owner)
            ->get('/owner/refunds?filter=needs_review')
            ->assertRedirect('/owner/finance?tab=refund&filter=needs_review');

        [$order] = $this->orderWithObligation('needs_review', false);
        $this->actingAs($this->owner)
            ->get("/owner/finance/refund-obligations/{$order->selectedRefundObligation()->id}")
            ->assertRedirect('/owner/finance?tab=refund&filter=needs_review');
    }

    public function test_needs_review_filter_lists_only_needs_review_orders(): void
    {
        [$needsReviewOrder] = $this->orderWithObligation('needs_review', true);
        $this->orderWithObligation('pending', true);

        $this->actingAs($this->owner)
            ->get('/owner/finance?tab=refund&filter=needs_review')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('refunds.data', 1)
                ->where('refunds.data.0.order_id', $needsReviewOrder->id)
                ->where('refunds.data.0.queue_state', 'needs_review'));
    }
}
