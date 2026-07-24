<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\RefundRejectionReason;
use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CustomerRefundDestinationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_saves_bank_destination_without_changing_server_refund_amount(): void
    {
        [$user, $order] = $this->customerAndOrder([
            'payment_status' => PaymentStatus::RefundPending->value,
            'refund_amount' => 50000,
        ]);

        $this->actingAs($user)->patch($this->endpoint($order), [
            'destination_type' => 'bank',
            'bank_name' => 'Bank Central Asia',
            'account_number' => '1234567890',
            'account_holder' => 'Jane Doe',
            'refund_amount' => 1,
        ])->assertRedirect();

        $order->refresh();
        $this->assertSame('bank', $order->refund_destination_type);
        $this->assertSame('Bank Central Asia', $order->refund_bank_name);
        $this->assertSame('1234567890', $order->refund_account_number);
        $this->assertSame('Jane Doe', $order->refund_account_holder);
        $this->assertNull($order->refund_ewallet_provider);
        $this->assertNull($order->refund_ewallet_number);
        $this->assertNull($order->refund_ewallet_holder);
        $this->assertNotNull($order->refund_destination_submitted_at);
        $this->assertSame('50000.00', $order->refund_amount);
        $this->assertNotSame('1234567890', DB::table('orders')->find($order->id)->refund_account_number);
    }

    public function test_customer_saves_ewallet_destination(): void
    {
        [$user, $order] = $this->customerAndOrder();

        $this->actingAs($user)->patch($this->endpoint($order), [
            'destination_type' => 'ewallet',
            'ewallet_provider' => 'GoPay',
            'ewallet_number' => '081234567890',
            'ewallet_holder' => 'Jane Doe',
        ])->assertRedirect();

        $order->refresh();
        $this->assertSame('ewallet', $order->refund_destination_type);
        $this->assertSame('GoPay', $order->refund_ewallet_provider);
        $this->assertSame('081234567890', $order->refund_ewallet_number);
        $this->assertSame('Jane Doe', $order->refund_ewallet_holder);
        $this->assertNull($order->refund_bank_name);
        $this->assertNull($order->refund_account_number);
        $this->assertNull($order->refund_account_holder);
    }

    public function test_customer_cannot_save_destination_for_another_customers_order(): void
    {
        [$user] = $this->customerAndOrder();
        [, $otherOrder] = $this->customerAndOrder();

        $this->actingAs($user)->patch($this->endpoint($otherOrder), $this->bankPayload())
            ->assertForbidden();

        $this->assertNull($otherOrder->fresh()->refund_destination_type);
    }

    public function test_customer_can_edit_destination_while_refund_is_pending(): void
    {
        [$user, $order] = $this->customerAndOrder([
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'Old Bank',
            'refund_account_number' => '111',
            'refund_account_holder' => 'Old Name',
        ]);

        $this->actingAs($user)->patch($this->endpoint($order), [
            'destination_type' => 'bank',
            'bank_name' => 'New Bank',
            'account_number' => '222',
            'account_holder' => 'New Name',
        ])->assertRedirect();

        $this->assertSame('New Bank', $order->fresh()->refund_bank_name);
    }

    public function test_customer_cannot_edit_destination_after_processing_starts(): void
    {
        [$user, $order] = $this->customerAndOrder([
            'payment_status' => PaymentStatus::RefundInProgress->value,
        ]);

        $this->actingAs($user)->patch($this->endpoint($order), $this->bankPayload())
            ->assertSessionHas('error');

        $this->assertNull($order->fresh()->refund_destination_type);
    }

    public function test_eligible_rejected_refund_reopens_when_customer_resubmits(): void
    {
        [$user, $order] = $this->customerAndOrder([
            'payment_status' => PaymentStatus::RefundRejected->value,
            'refund_rejected_reason' => RefundRejectionReason::InvalidDestination->value,
            'refund_rejection_note' => 'Nomor rekening salah',
            'refund_rejected_at' => now(),
        ]);

        $this->actingAs($user)->patch($this->endpoint($order), $this->bankPayload())
            ->assertRedirect();

        $order->refresh();
        $this->assertSame(PaymentStatus::RefundPending->value, $order->payment_status);
        $this->assertNull($order->refund_rejected_reason);
        $this->assertNull($order->refund_rejection_note);
        $this->assertSame('Bank Central Asia', $order->refund_bank_name);
    }

    public function test_final_rejected_refund_cannot_be_resubmitted(): void
    {
        [$user, $order] = $this->customerAndOrder([
            'payment_status' => PaymentStatus::RefundRejected->value,
            'refund_rejected_reason' => RefundRejectionReason::PaymentUnverified->value,
        ]);

        $this->actingAs($user)->patch($this->endpoint($order), $this->bankPayload())
            ->assertSessionHas('error');

        $order->refresh();
        $this->assertSame(PaymentStatus::RefundRejected->value, $order->payment_status);
        $this->assertNull($order->refund_destination_type);
    }

    public function test_switching_destination_method_clears_unused_fields(): void
    {
        [$user, $order] = $this->customerAndOrder([
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'Bank Central Asia',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Jane Doe',
        ]);

        $this->actingAs($user)->patch($this->endpoint($order), [
            'destination_type' => 'ewallet',
            'ewallet_provider' => 'OVO',
            'ewallet_number' => '081234567890',
            'ewallet_holder' => 'Jane Doe',
        ])->assertRedirect();

        $order->refresh();
        $this->assertNull($order->refund_bank_name);
        $this->assertNull($order->refund_account_number);
        $this->assertNull($order->refund_account_holder);
        $this->assertSame('OVO', $order->refund_ewallet_provider);
    }

    private function customerAndOrder(array $attributes = []): array
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $order = Order::factory()->create(array_merge([
            'customer_id' => $customer->id,
            'payment_status' => PaymentStatus::RefundPending->value,
        ], $attributes));

        return [$user, $order];
    }

    private function endpoint(Order $order): string
    {
        return route('customer.orders.refund-destination.update', $order);
    }

    private function bankPayload(): array
    {
        return [
            'destination_type' => 'bank',
            'bank_name' => 'Bank Central Asia',
            'account_number' => '1234567890',
            'account_holder' => 'Jane Doe',
        ];
    }
}
