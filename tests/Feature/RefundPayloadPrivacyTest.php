<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Models\RefundStatusHistory;
use App\Models\User;
use App\Services\RefundPayloadService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundPayloadPrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_payload_uses_selected_obligation_proof_and_transfer_fields(): void
    {
        $order = $this->createOrderWithDestination('refunded', 'valid');
        $order->update([
            'refund_proof_image' => 'legacy-proof.jpg',
            'refund_transfer_reference' => 'legacy-reference',
            'refund_transfer_note' => 'legacy-note',
            'refund_reason' => 'customer_cancellation',
        ]);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'payload-canonical',
            'invoice_number' => 'payload-canonical',
            'merchant_request_id' => 'payload-canonical',
            'amount_snapshot' => 50000,
            'currency_snapshot' => 'IDR',
        ]);
        RefundObligation::create([
            'payment_attempt_id' => $attempt->id,
            'amount' => 50000,
            'currency' => 'IDR',
            'reason' => 'customer_cancellation',
            'status' => 'completed',
            'proof_image' => 'canonical-proof.jpg',
            'transfer_reference' => 'canonical-reference',
            'transfer_note' => 'canonical-note',
        ]);

        $payload = app(RefundPayloadService::class)->forOwner($order);

        $this->assertSame('canonical-reference', $payload['transfer_reference']);
        $this->assertSame('canonical-note', $payload['transfer_note']);
        $this->assertSame("/refunds/{$order->id}/proof", $payload['proof_url']);
    }

    public function test_owner_payload_uses_canonical_obligation_state_and_destination(): void
    {
        $order = $this->createOrderWithDestination('refund_pending', 'valid');
        $order->update(['payment_status' => 'refund_rejected', 'refund_reason' => 'customer_cancellation', 'refund_rejected_reason' => 'other']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'payload-state',
            'invoice_number' => 'payload-state',
            'merchant_request_id' => 'payload-state',
            'amount_snapshot' => 50000,
            'currency_snapshot' => 'IDR',
        ]);
        RefundObligation::create([
            'payment_attempt_id' => $attempt->id,
            'amount' => 50000,
            'currency' => 'IDR',
            'reason' => 'customer_cancellation',
            'status' => 'rejected',
            'destination_type' => 'bank',
            'bank_name' => 'CANONICAL',
            'account_number' => '9999',
            'account_holder' => 'Canonical',
            'metadata' => ['rejection_reason' => 'invalid_destination', 'rejection_note' => 'Fix it'],
        ]);

        $payload = app(RefundPayloadService::class)->forOwner($order);

        $this->assertFalse($payload['can_start']);
        $this->assertTrue($payload['can_reject'] === false);
        $this->assertSame('invalid_destination', $payload['rejection']['code']);
        $this->assertSame('CANONICAL', $payload['destination']['label']);
        $this->assertSame('9999', $payload['destination']['number']);
    }

    public function test_owner_payload_contains_full_destination(): void
    {
        $order = $this->createOrderWithDestination('refund_pending', 'valid');
        $payload = app(RefundPayloadService::class)->forOwner($order);

        $this->assertStringContainsString('1234567890', json_encode($payload));
        $this->assertArrayHasKey('destination', $payload);
    }

    public function test_customer_payload_excludes_full_destination(): void
    {
        $order = $this->createOrderWithDestination('refund_pending', 'valid');
        $payload = app(RefundPayloadService::class)->forCustomer($order);

        $this->assertStringNotContainsString('1234567890', json_encode($payload));
        $this->assertArrayHasKey('destination', $payload);
    }

    public function test_guest_payload_excludes_destination_and_proof(): void
    {
        $order = $this->createGuestOrderWithDestination('refund_pending', 'valid');
        $payload = app(RefundPayloadService::class)->forGuest($order);

        $this->assertStringNotContainsString('1234567890', json_encode($payload));
        $this->assertArrayNotHasKey('destination', $payload);
        $this->assertArrayNotHasKey('proof_url', $payload);
    }

    public function test_outlet_payload_excludes_destination_and_proof_and_transfer(): void
    {
        $order = $this->createOrderWithDestination('refund_pending', 'valid');
        $payload = app(RefundPayloadService::class)->forOutlet($order);

        $this->assertStringNotContainsString('1234567890', json_encode($payload));
        $this->assertArrayNotHasKey('destination', $payload);
        $this->assertArrayNotHasKey('proof_url', $payload);
        $this->assertArrayNotHasKey('transfer_reference', $payload);
    }

    public function test_queue_in_progress_within_24h(): void
    {
        Carbon::setTestNow('2026-07-25 12:00:00');
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_in_progress',
            'refund_started_at' => Carbon::parse('2026-07-24 13:00:00'),
        ]);

        $state = app(RefundPayloadService::class)->queueState($order);
        $this->assertSame('in_progress', $state);
    }

    public function test_queue_action_required_at_exactly_24h(): void
    {
        Carbon::setTestNow('2026-07-25 13:00:00');
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_in_progress',
            'refund_started_at' => Carbon::parse('2026-07-24 13:00:00'),
        ]);

        $state = app(RefundPayloadService::class)->queueState($order);
        $this->assertSame('action_required', $state);
    }

    public function test_queue_refund_failed_is_action_required(): void
    {
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_failed',
        ]);

        $state = app(RefundPayloadService::class)->queueState($order);
        $this->assertSame('action_required', $state);
    }

    public function test_registered_customer_awaiting_separation(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create()->id]);
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
        ]);

        $this->assertSame('awaiting_customer', app(RefundPayloadService::class)->queueState($order));
    }

    public function test_guest_awaiting_separation(): void
    {
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
        ]);

        $this->assertSame('awaiting_guest', app(RefundPayloadService::class)->queueState($order));
    }

    public function test_all_seven_queues_exist(): void
    {
        $service = app(RefundPayloadService::class);
        $this->assertCount(7, $service::QUEUES);
    }

    public function test_timeline_excludes_forbidden_metadata_keys(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create()->id]);
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refunded',
        ]);

        RefundStatusHistory::create([
            'order_id' => $order->id,
            'from_status' => 'refund_in_progress',
            'to_status' => 'refunded',
            'event' => 'refund_completed',
            'actor_type' => 'owner',
            'metadata' => [
                'proof_present' => true,
                'reference_present' => true,
                'refund_account_number' => '1234567890',
                'refund_bank_name' => 'BCA',
            ],
        ]);

        $order->load('refundStatusHistories');

        $payload = app(RefundPayloadService::class)->forOwner($order);
        $timeline = $payload['timeline'];
        $meta = $timeline[0]['metadata'];

        $this->assertArrayHasKey('proof_present', $meta);
        $this->assertArrayNotHasKey('refund_account_number', $meta);
        $this->assertArrayNotHasKey('refund_bank_name', $meta);
    }

    public function test_normalize_stock_reason(): void
    {
        $service = app(RefundPayloadService::class);
        $this->assertSame('Stok Tidak Tersedia', $service->normalizeStockReason('Stok Habis'));
        $this->assertSame('Stok Tidak Tersedia', $service->normalizeStockReason('Stok Tidak Tersedia'));
        $this->assertSame('Produk Rusak', $service->normalizeStockReason('Produk Rusak'));
        $this->assertNull($service->normalizeStockReason(null));
    }

    private function createOrderWithDestination(string $paymentStatus, string $destinationStatus): Order
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create()->id]);

        return Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => $paymentStatus,
            'refund_destination_status' => $destinationStatus,
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Arya',
            'refund_amount' => 50000,
        ]);
    }

    private function createGuestOrderWithDestination(string $paymentStatus, string $destinationStatus): Order
    {
        $customer = Customer::factory()->create(['user_id' => null]);

        return Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => $paymentStatus,
            'refund_destination_status' => $destinationStatus,
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Arya',
            'refund_amount' => 50000,
        ]);
    }
}
