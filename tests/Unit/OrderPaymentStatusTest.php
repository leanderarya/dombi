<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\RefundStatusHistory;
use App\Models\User;
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

    public function test_refund_destination_status_constants(): void
    {
        $this->assertSame('missing', Order::REFUND_DESTINATION_MISSING);
        $this->assertSame('valid', Order::REFUND_DESTINATION_VALID);
        $this->assertSame('invalid', Order::REFUND_DESTINATION_INVALID);
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
            PaymentStatus::RefundFailed->value,
        ], Order::refundable()->pluck('payment_status')->all());
    }

    public function test_refundable_scope_excludes_non_refund_statuses(): void
    {
        Order::factory()->paid()->create();
        $this->assertCount(0, Order::refundable()->where('payment_status', 'paid')->get());
    }

    public function test_refund_status_histories_relation(): void
    {
        $order = Order::factory()->create();
        RefundStatusHistory::factory()->create([
            'order_id' => $order->id,
            'event' => RefundStatusHistory::EVENT_REFUND_REQUESTED,
            'to_status' => 'refund_pending',
        ]);

        $this->assertCount(1, $order->refundStatusHistories);
        $this->assertInstanceOf(RefundStatusHistory::class, $order->refundStatusHistories->first());
    }

    public function test_is_guest_customer_when_user_id_null(): void
    {
        $customer = Customer::factory()->create(['user_id' => null]);
        $order = Order::factory()->create(['customer_id' => $customer->id]);

        $this->assertTrue($order->isGuestCustomer());
    }

    public function test_is_guest_customer_false_when_user_id_not_null(): void
    {
        $user = User::factory()->create();
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $order = Order::factory()->create(['customer_id' => $customer->id]);

        $this->assertFalse($order->isGuestCustomer());
    }

    public function test_refund_destination_status_is_fillable(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'refund_destination_status' => Order::REFUND_DESTINATION_VALID,
        ]);

        $this->assertSame('valid', $order->fresh()->refund_destination_status);
    }

    public function test_refund_fields_not_appended_to_serialization(): void
    {
        $order = Order::factory()->create();
        $this->assertNotContains('refund_destination_status', $order->getAppends());
    }
}
