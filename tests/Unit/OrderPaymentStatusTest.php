<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OrderPaymentStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_status_enum_accessor_returns_enum(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        $this->assertSame(PaymentStatus::Paid, $order->payment_status_enum);
    }

    public function test_refund_destination_is_encrypted_in_database_and_decrypted_on_model(): void
    {
        $order = Order::factory()->create([
            'refund_bank_name' => 'Bank Central Asia',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Jane Doe',
            'refund_ewallet_provider' => 'GoPay',
            'refund_ewallet_number' => '081234567890',
            'refund_ewallet_holder' => 'Jane Doe',
        ]);

        $destinations = [
            'refund_bank_name' => 'Bank Central Asia',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Jane Doe',
            'refund_ewallet_provider' => 'GoPay',
            'refund_ewallet_number' => '081234567890',
            'refund_ewallet_holder' => 'Jane Doe',
        ];
        $rawOrder = DB::table('orders')->find($order->id);
        $storedOrder = Order::findOrFail($order->id);

        foreach ($destinations as $field => $plaintext) {
            $this->assertNotSame($plaintext, $rawOrder->{$field});
            $this->assertSame($plaintext, $storedOrder->{$field});
        }
    }

    public function test_refundable_scope_returns_refund_workflow_statuses_only(): void
    {
        foreach ([
            'pending', 'paid', 'settled', 'expired', 'failed',
            'refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed',
        ] as $status) {
            Order::factory()->create(['payment_status' => $status]);
        }

        $this->assertEqualsCanonicalizing([
            PaymentStatus::RefundPending->value,
            PaymentStatus::RefundInProgress->value,
            PaymentStatus::Refunded->value,
            PaymentStatus::RefundRejected->value,
        ], Order::refundable()->pluck('payment_status')->all());
    }
}
