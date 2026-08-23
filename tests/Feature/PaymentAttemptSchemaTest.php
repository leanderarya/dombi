<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptCreationState;
use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PaymentAttemptSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_attempt_schema_and_relationships_are_canonical(): void
    {
        $this->assertTrue(Schema::hasTable('payment_attempts'));
        $this->assertTrue(Schema::hasColumns('payment_attempts', [
            'order_id', 'attempt_key', 'invoice_number', 'merchant_request_id',
            'session_token', 'amount_snapshot', 'currency_snapshot',
            'gateway_amount', 'gateway_currency', 'creation_state', 'settlement_status',
            'verification_status', 'status_version', 'reconciliation_status',
            'reconciled_at', 'fulfilment_claimed_at', 'fulfilment_claimed_by',
        ]));

        $this->assertTrue(Schema::hasIndex('payment_attempts', ['attempt_key']));
        $this->assertTrue(Schema::hasIndex('payment_attempts', ['invoice_number']));
        $this->assertTrue(Schema::hasIndex('payment_attempts', ['merchant_request_id']));
        $this->assertTrue(Schema::hasIndex('payment_attempts', ['order_id', 'settlement_status']));
        $this->assertTrue(Schema::hasIndex('payment_attempts', ['reconciliation_status', 'settlement_status']));

        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'invoice-1',
            'merchant_request_id' => 'request-1',
            'session_token' => 'shared-session',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
            'creation_state' => PaymentAttemptCreationState::Created,
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);

        $this->assertTrue($attempt->order->is($order));
        $this->assertSame('12500.00', $attempt->amount_snapshot);
        $this->assertSame(PaymentAttemptCreationState::Created, $attempt->creation_state);
        $this->assertSame(PaymentAttemptSettlementStatus::Pending, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $attempt->verification_status);

        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-2',
            'invoice_number' => 'invoice-2',
            'merchant_request_id' => 'request-2',
            'session_token' => 'shared-session',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ]);

        $this->expectException(QueryException::class);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'invoice-3',
            'merchant_request_id' => 'request-3',
        ]);
    }

    public function test_status_enums_expose_canonical_values(): void
    {
        $this->assertSame(['initiated', 'created', 'unknown', 'failed'], array_column(PaymentAttemptCreationState::cases(), 'value'));
        $this->assertSame(['pending', 'paid', 'failed', 'expired', 'unknown'], array_column(PaymentAttemptSettlementStatus::cases(), 'value'));
        $this->assertSame(['verified', 'needs_review'], array_column(PaymentAttemptVerificationStatus::cases(), 'value'));
    }
}
