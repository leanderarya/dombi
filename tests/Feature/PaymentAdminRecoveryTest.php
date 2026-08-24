<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentAdminRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_owner_cannot_access_payment_recovery_read_endpoints(): void
    {
        $user = User::factory()->create(['role' => 'customer']);

        $this->actingAs($user)->get('/owner/finance/payments')->assertRedirect('/customer/home');
    }

    public function test_owner_can_read_payment_recovery_data(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);

        $response = $this->actingAs($owner)->get('/owner/finance/payments');

        $response->assertOk();
        $response->assertJsonStructure(['attempts', 'webhooks', 'refund_obligations']);
    }

    public function test_owner_payment_read_exposes_only_safe_attempt_fields(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $order = Order::factory()->create();
        PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'safe-attempt',
            'invoice_number' => 'INV-SAFE',
            'merchant_request_id' => 'REQ-SAFE',
            'amount_snapshot' => 12500,
            'currency_snapshot' => 'IDR',
            'payment_method' => 'qris',
            'creation_state' => 'pending',
            'settlement_status' => 'pending',
            'verification_status' => 'needs_review',
            'raw_response' => ['customer' => ['email' => 'secret@example.com']],
            'session_token' => 'session-secret',
            'token_id' => 'token-secret',
            'gateway_transaction_id' => 'gateway-safe',
            'metadata' => ['reconciliation_attempts' => 2, 'customer_snapshot' => ['phone' => 'secret']],
        ]);

        $attempt = $this->actingAs($owner)->getJson('/owner/finance/payments')->json('attempts.data.0');

        $this->assertSame(['id', 'attempt_key', 'invoice_number', 'payment_method', 'amount_snapshot', 'currency_snapshot', 'gateway_amount', 'gateway_currency', 'gateway_transaction_id', 'gateway_status', 'creation_state', 'settlement_status', 'verification_status', 'reconciliation_status', 'reconciled_at', 'fulfilment_claimed_at', 'metadata', 'created_at', 'updated_at'], array_keys($attempt));
        $this->assertSame(['reconciliation_attempts' => 2], $attempt['metadata']);
    }

    public function test_owner_payment_recovery_routes_are_registered(): void
    {
        $this->assertSame('/owner/finance/payments', route('owner.finance.payments.index', [], false));
        $this->assertSame('/owner/finance/payments/1/check-status', route('owner.finance.payments.check-status', ['attempt' => 1], false));
        $this->assertSame('/owner/finance/refund-obligations/1/needs-review', route('owner.finance.refund-obligations.needs-review', ['obligation' => 1], false));
    }
}
