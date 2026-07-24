<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Models\RefundStatusHistory;
use App\Models\User;
use App\Services\RefundService;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundServiceTest extends TestCase
{
    use RefreshDatabase;

    private function createPaidTransaction(Order $order, float $amount, string $status = 'paid'): PaymentTransaction
    {
        return PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'TXN-'.$order->id.'-'.uniqid(),
            'payment_method' => 'qris',
            'amount' => $amount,
            'status' => $status,
        ]);
    }

    private function registeredCustomer(): Customer
    {
        $user = User::factory()->create();
        return Customer::factory()->create(['user_id' => $user->id]);
    }

    public function test_request_snapshots_positive_total_and_writes_one_safe_history(): void
    {
        $order = Order::factory()->paid()->create(['total' => 75000]);
        $this->createPaidTransaction($order, 75000);

        $service = app(RefundService::class);
        $history = $service->request($order, 'customer', null, 'customer_cancellation');

        $order->refresh();

        $this->assertNotNull($history);
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame(75000.0, (float) $order->refund_amount);
        $this->assertNotNull($order->refund_requested_at);
        $this->assertSame('customer_cancellation', $order->refund_reason);
        $this->assertSame('missing', $order->refund_destination_status);

        $this->assertSame('refund_requested', $history->event);
        $this->assertSame('paid', $history->from_status);
        $this->assertSame('refund_pending', $history->to_status);
        $this->assertSame('customer', $history->actor_type);
        $this->assertNull($history->actor_id);
        $this->assertEquals(['refund_amount' => 75000.0, 'source_entry_point' => 'customer_cancellation'], $history->metadata);

        $this->assertDatabaseCount('refund_status_histories', 1);
    }

    public function test_request_rejects_zero_total(): void
    {
        $order = Order::factory()->paid()->create(['total' => 0]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Refund amount melebihi pembayaran terverifikasi.');

        app(RefundService::class)->request($order, 'customer', null, 'customer_cancellation');
    }

    public function test_request_rejects_total_above_successful_payment_amount(): void
    {
        $order = Order::factory()->paid()->create(['total' => 100000]);
        $this->createPaidTransaction($order, 50000);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Refund amount melebihi pembayaran terverifikasi.');

        app(RefundService::class)->request($order, 'customer', null, 'customer_cancellation');
    }

    public function test_request_allows_legacy_paid_at_row_without_payment_transaction(): void
    {
        $order = Order::factory()->paid()->create(['total' => 50000, 'paid_at' => now()->subDay()]);

        $history = app(RefundService::class)->request($order, 'customer', null, 'customer_cancellation');

        $this->assertNotNull($history);
        $this->assertSame('refund_pending', $order->fresh()->payment_status);
    }

    public function test_request_accepts_settled_collection_and_records_settled_from_status(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'settled',
            'total' => 50000,
            'paid_at' => now()->subDay(),
        ]);
        $this->createPaidTransaction($order, 50000, 'settled');

        $history = app(RefundService::class)->request($order, 'customer', null, 'customer_cancellation');

        $order->refresh();
        $this->assertNotNull($history);
        $this->assertSame('settled', $history->from_status);
        $this->assertSame('refund_pending', $order->payment_status);
    }

    public function test_duplicate_request_returns_null_without_second_history(): void
    {
        $order = Order::factory()->paid()->create(['total' => 50000]);
        $this->createPaidTransaction($order, 50000);

        $service = app(RefundService::class);
        $first = $service->request($order, 'customer', null, 'customer_cancellation');
        $second = $service->request($order->fresh(), 'customer', null, 'customer_cancellation');

        $this->assertNotNull($first);
        $this->assertNull($second);
        $this->assertDatabaseCount('refund_status_histories', 1);
    }

    public function test_registered_customer_submits_bank_and_clears_ewallet_fields(): void
    {
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_ewallet_provider' => 'GoPay',
            'refund_ewallet_number' => '081234567890',
            'refund_ewallet_holder' => 'Old',
        ]);

        $service = app(RefundService::class);
        $history = $service->submitDestination($order, 'bank', 'customer', null, [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
        ]);

        $order->refresh();
        $this->assertSame('bank', $order->refund_destination_type);
        $this->assertSame('BCA', $order->refund_bank_name);
        $this->assertSame('1234567890', $order->refund_account_number);
        $this->assertSame('Arya', $order->refund_account_holder);
        $this->assertNull($order->refund_ewallet_provider);
        $this->assertNull($order->refund_ewallet_number);
        $this->assertNull($order->refund_ewallet_holder);
        $this->assertSame('destination_submitted', $history->event);
    }

    public function test_registered_customer_submits_ewallet_and_clears_bank_fields(): void
    {
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Old',
        ]);

        $service = app(RefundService::class);
        $history = $service->submitDestination($order, 'ewallet', 'customer', null, [
            'ewallet_provider' => 'GoPay',
            'ewallet_number' => '081234567890',
            'ewallet_holder' => 'Arya',
        ]);

        $order->refresh();
        $this->assertSame('ewallet', $order->refund_destination_type);
        $this->assertSame('GoPay', $order->refund_ewallet_provider);
        $this->assertSame('081234567890', $order->refund_ewallet_number);
        $this->assertSame('Arya', $order->refund_ewallet_holder);
        $this->assertNull($order->refund_bank_name);
        $this->assertNull($order->refund_account_number);
        $this->assertNull($order->refund_account_holder);
        $this->assertSame('destination_submitted', $history->event);
    }

    public function test_customer_cannot_submit_for_guest_order(): void
    {
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Tujuan refund tidak dapat diubah pada status ini.');

        app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
        ]);
    }

    public function test_owner_can_submit_only_for_guest_order(): void
    {
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
        ]);

        $history = app(RefundService::class)->submitDestination($order, 'bank', 'owner', 1, [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
        ]);

        $this->assertNotNull($history);
        $this->assertSame('guest_destination_submitted_by_owner', $history->event);
    }

    public function test_pending_destination_update_uses_destination_updated_event(): void
    {
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Arya',
        ]);

        $history = app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
            'bank_name' => 'MANDIRI',
            'account_number' => '0987654321',
            'account_holder' => 'Arya',
        ]);

        $this->assertNotNull($history);
        $this->assertSame('destination_updated', $history->event);
    }

    public function test_eligible_rejected_correction_uses_refund_reopened_event_and_preserves_old_rejection_history(): void
    {
        $customer = $this->registeredCustomer();
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_rejected',
            'refund_destination_status' => 'invalid',
            'refund_rejected_reason' => 'invalid_destination',
            'refund_rejection_note' => 'Wrong bank',
            'refund_rejected_at' => now()->subDay(),
            'refund_rejected_by' => $admin->id,
        ]);

        RefundStatusHistory::create([
            'order_id' => $order->id,
            'from_status' => 'refund_pending',
            'to_status' => 'refund_rejected',
            'event' => 'refund_rejected',
            'actor_type' => 'system',
        ]);

        $history = app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
        ]);

        $order->refresh();
        $this->assertSame('refund_pending', $order->payment_status);
        $this->assertSame('valid', $order->refund_destination_status);
        $this->assertNull($order->refund_rejected_reason);
        $this->assertNull($order->refund_rejection_note);
        $this->assertNull($order->refund_rejected_at);
        $this->assertNull($order->refund_rejected_by);

        $this->assertSame('refund_reopened', $history->event);
        $this->assertSame('refund_rejected', $history->from_status);
        $this->assertSame('refund_pending', $history->to_status);

        $this->assertDatabaseCount('refund_status_histories', 2);
    }

    public function test_final_rejected_destination_update_fails_without_mutation(): void
    {
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_rejected',
            'refund_destination_status' => 'invalid',
            'refund_rejected_reason' => 'other',
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Tujuan refund tidak dapat diubah pada status ini.');

        try {
            app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Arya',
            ]);
        } finally {
            $order->refresh();
            $this->assertSame('refund_rejected', $order->payment_status);
        }
    }

    public function test_history_failure_rolls_back_order_mutation(): void
    {
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'total' => 50000,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
        ]);

        $originalFields = $order->only([
            'payment_status', 'refund_destination_type', 'refund_bank_name',
            'refund_account_number', 'refund_account_holder',
            'refund_ewallet_provider', 'refund_ewallet_number', 'refund_ewallet_holder',
            'refund_destination_status',
        ]);

        RefundStatusHistory::creating(function () {
            throw new \RuntimeException('Simulated history failure');
        });

        try {
            app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'Arya',
            ]);
            $this->fail('Expected exception was not thrown.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Simulated history failure', $e->getMessage());
        }

        $order->refresh();
        $this->assertEquals($originalFields['payment_status'], $order->payment_status);
        $this->assertEquals($originalFields['refund_destination_type'], $order->refund_destination_type);
        $this->assertEquals($originalFields['refund_bank_name'], $order->refund_bank_name);
        $this->assertEquals($originalFields['refund_destination_status'], $order->refund_destination_status);
    }

    public function test_destination_metadata_contains_only_destination_type(): void
    {
        $customer = $this->registeredCustomer();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
        ]);

        $history = app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
        ]);

        $this->assertSame(['destination_type' => 'bank'], $history->metadata);
    }

    public function test_start_transitions_to_in_progress(): void
    {
        $customer = $this->registeredCustomer();
        $owner = User::factory()->create();
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

        $service = app(RefundService::class);
        $history = $service->start($order, $owner->id);

        $order->refresh();
        $this->assertSame('refund_in_progress', $order->payment_status);
        $this->assertNotNull($order->refund_started_at);
        $this->assertSame($owner->id, $order->refund_started_by);

        $this->assertSame('processing_started', $history->event);
        $this->assertSame('owner', $history->actor_type);
        $this->assertSame($owner->id, $history->actor_id);
        $this->assertEquals(['destination_type' => 'bank'], $history->metadata);
    }

    public function test_start_fails_when_destination_not_valid(): void
    {
        $owner = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_amount' => 50000,
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Tujuan refund belum lengkap atau tidak valid.');

        app(RefundService::class)->start($order, $owner->id);
    }

    public function test_start_fails_when_not_refund_pending(): void
    {
        $owner = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_in_progress',
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Order ini tidak dalam antrean refund.');

        app(RefundService::class)->start($order, $owner->id);
    }

    public function test_reject_transitions_to_rejected(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
        ]);

        $service = app(RefundService::class);
        $history = $service->reject($order, 'payment_unverified', null, 'system', $admin->id);

        $order->refresh();
        $this->assertSame('refund_rejected', $order->payment_status);
        $this->assertSame('payment_unverified', $order->refund_rejected_reason);
        $this->assertNull($order->refund_rejection_note);
        $this->assertNotNull($order->refund_rejected_at);
        $this->assertSame($admin->id, $order->refund_rejected_by);

        $this->assertSame('refund_rejected', $history->event);
        $this->assertSame('payment_unverified', $history->reason_code);
        $this->assertNull($history->note);
    }

    public function test_reject_fails_when_refund_in_progress(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_in_progress',
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Refund yang sedang diproses harus diselesaikan atau di-rollback.');

        app(RefundService::class)->reject($order, 'payment_unverified', null, 'system', $admin->id);
    }

    public function test_reject_requires_note_for_other_reason(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Catatan diperlukan untuk alasan ini.');

        app(RefundService::class)->reject($order, 'other', null, 'system', $admin->id);
    }

    public function test_reject_fails_when_destination_not_valid_without_legacy_gate(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_requested_at' => now(),
        ]);

        $this->expectException(DomainException::class);

        app(RefundService::class)->reject($order, 'payment_unverified', null, 'system', $admin->id);
    }

    public function test_reject_with_invalid_destination_reason_marks_destination_invalid(): void
    {
        $customer = $this->registeredCustomer();
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Arya',
        ]);

        $service = app(RefundService::class);
        $history = $service->reject($order, 'invalid_destination', 'Wrong bank details', 'system', $admin->id);

        $order->refresh();
        $this->assertSame('invalid', $order->refund_destination_status);
        $this->assertSame('invalid_destination', $order->refund_rejected_reason);
        $this->assertSame('Wrong bank details', $order->refund_rejection_note);

        $this->assertSame('refund_rejected', $history->event);
        $this->assertSame('invalid_destination', $history->reason_code);
        $this->assertSame('Wrong bank details', $history->note);
    }

    public function test_reject_with_final_reason_keeps_destination_valid(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
        ]);

        app(RefundService::class)->reject($order, 'payment_unverified', null, 'system', $admin->id);

        $order->refresh();
        $this->assertSame('valid', $order->refund_destination_status);
    }

    public function test_reject_accepts_legacy_repair_when_before_cutoff(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_requested_at' => \Carbon\Carbon::create(2026, 7, 23, 23, 59, 0, config('app.timezone')),
        ]);

        $history = app(RefundService::class)->reject($order, 'payment_unverified', null, 'system', $admin->id, legacyRepair: true);

        $order->refresh();
        $this->assertSame('refund_rejected', $order->payment_status);
        $this->assertSame('valid', $order->refund_destination_status);
    }

    public function test_reject_legacy_repair_rejects_after_cutoff(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_requested_at' => \Carbon\Carbon::create(2026, 7, 24, 2, 0, 0, config('app.timezone')),
        ]);

        $this->expectException(DomainException::class);

        app(RefundService::class)->reject($order, 'payment_unverified', null, 'system', $admin->id, legacyRepair: true);
    }

    public function test_reject_legacy_repair_rejects_without_flag(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_requested_at' => \Carbon\Carbon::create(2026, 7, 23, 23, 59, 0, config('app.timezone')),
        ]);

        $this->expectException(DomainException::class);

        app(RefundService::class)->reject($order, 'payment_unverified', null, 'system', $admin->id);
    }

    public function test_start_fails_when_destination_fields_incomplete(): void
    {
        $customer = $this->registeredCustomer();
        $owner = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_destination_type' => 'bank',
            'refund_bank_name' => null,
            'refund_account_number' => null,
            'refund_account_holder' => 'Arya',
            'refund_amount' => 50000,
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Tujuan refund belum lengkap atau tidak valid.');

        app(RefundService::class)->start($order, $owner->id);
    }

    public function test_reject_with_incomplete_destination_reason_marks_destination_invalid(): void
    {
        $admin = User::factory()->create();
        $order = Order::factory()->paid()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
        ]);

        $service = app(RefundService::class);
        $history = $service->reject($order, 'incomplete_destination', 'Missing fields', 'system', $admin->id);

        $order->refresh();
        $this->assertSame('invalid', $order->refund_destination_status);
        $this->assertSame('incomplete_destination', $history->reason_code);
    }

    public function test_start_history_rolls_back_on_failure(): void
    {
        $customer = $this->registeredCustomer();
        $owner = User::factory()->create();
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

        $originalStatus = $order->payment_status;

        RefundStatusHistory::creating(function () {
            throw new \RuntimeException('Simulated history failure');
        });

        try {
            app(RefundService::class)->start($order, $owner->id);
            $this->fail('Expected exception was not thrown.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Simulated history failure', $e->getMessage());
        }

        $order->refresh();
        $this->assertSame($originalStatus, $order->payment_status);
        $this->assertNull($order->refund_started_at);
        $this->assertNull($order->refund_started_by);
    }
}
