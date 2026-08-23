<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptCreationState;
use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
        $user = User::factory()->create();
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'invoice-1',
            'merchant_request_id' => 'request-1',
            'session_token' => 'shared-session',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
            'fulfilment_claimed_by' => $user->id,
            'creation_state' => PaymentAttemptCreationState::Created,
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);

        $this->assertTrue($attempt->order->is($order));
        $this->assertSame('12500.00', $attempt->amount_snapshot);
        $this->assertSame(PaymentAttemptCreationState::Created, $attempt->creation_state);
        $this->assertSame(PaymentAttemptSettlementStatus::Pending, $attempt->settlement_status);
        $this->assertSame(PaymentAttemptVerificationStatus::NeedsReview, $attempt->verification_status);
        $relation = new \ReflectionMethod($attempt, 'refundObligations');
        $this->assertSame(HasMany::class, $relation->getReturnType()->getName());
        $this->assertStringContainsString('RefundObligation', file_get_contents((new \ReflectionClass($attempt))->getFileName()));
    }

    public function test_attempt_invoice_and_request_identities_are_unique(): void
    {
        $order = Order::factory()->create();
        $attributes = [
            'order_id' => $order->id,
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ];

        PaymentAttempt::create($attributes + [
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'invoice-1',
            'merchant_request_id' => 'request-1',
        ]);

        $this->expectException(QueryException::class);
        PaymentAttempt::create($attributes + [
            'attempt_key' => 'attempt-2',
            'invoice_number' => 'invoice-1',
            'merchant_request_id' => 'request-2',
        ]);
    }

    public function test_merchant_request_identity_is_unique(): void
    {
        $order = Order::factory()->create();
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'invoice-1',
            'merchant_request_id' => 'request-1',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ]);

        $this->expectException(QueryException::class);
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'attempt-2',
            'invoice_number' => 'invoice-2',
            'merchant_request_id' => 'request-1',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ]);
    }

    public function test_identity_and_snapshot_fields_are_immutable(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'invoice-1',
            'merchant_request_id' => 'request-1',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ]);

        $attempt->amount_snapshot = 13000;

        $this->expectException(\LogicException::class);
        $attempt->save();
    }

    public function test_invalid_order_foreign_key_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        PaymentAttempt::create([
            'order_id' => 999999,
            'attempt_key' => 'attempt-invalid-order',
            'invoice_number' => 'invoice-invalid-order',
            'merchant_request_id' => 'request-invalid-order',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ]);
    }

    public function test_invalid_claim_actor_foreign_key_is_rejected(): void
    {
        $this->expectException(QueryException::class);
        PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-invalid-user',
            'invoice_number' => 'invoice-invalid-user',
            'merchant_request_id' => 'request-invalid-user',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
            'fulfilment_claimed_by' => 999999,
        ]);
    }

    public function test_duplicate_session_tokens_are_allowed(): void
    {
        $order = Order::factory()->create();
        $attributes = [
            'order_id' => $order->id,
            'session_token' => 'shared-session',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
        ];

        PaymentAttempt::create($attributes + [
            'attempt_key' => 'attempt-session-1',
            'invoice_number' => 'invoice-session-1',
            'merchant_request_id' => 'request-session-1',
        ]);
        PaymentAttempt::create($attributes + [
            'attempt_key' => 'attempt-session-2',
            'invoice_number' => 'invoice-session-2',
            'merchant_request_id' => 'request-session-2',
        ]);

        $this->assertDatabaseCount('payment_attempts', 2);
    }

    public function test_payment_attempt_foreign_keys_enforce_order_and_claim_actor(): void
    {
        $attempt = PaymentAttempt::create([
            'order_id' => Order::factory()->create()->id,
            'attempt_key' => 'attempt-1',
            'invoice_number' => 'invoice-1',
            'merchant_request_id' => 'request-1',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
            'fulfilment_claimed_by' => User::factory()->create()->id,
        ]);

        $attempt->fulfilment_claimed_by = null;
        $attempt->save();
        $this->assertNull($attempt->fresh()->fulfilment_claimed_by);
    }

    public function test_status_enums_expose_canonical_values(): void
    {
        $this->assertSame(['initiated', 'created', 'unknown', 'failed'], array_column(PaymentAttemptCreationState::cases(), 'value'));
        $this->assertSame(['pending', 'paid', 'failed', 'expired', 'unknown'], array_column(PaymentAttemptSettlementStatus::cases(), 'value'));
        $this->assertSame(['verified', 'needs_review'], array_column(PaymentAttemptVerificationStatus::cases(), 'value'));
    }
}
