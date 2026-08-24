<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use App\Services\NormalizedPaymentEvent;
use App\Services\PaymentObservabilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class PaymentProductionMatrixTest extends TestCase
{
    use RefreshDatabase;

    public function test_observability_registry_exposes_fixed_schema_and_safe_allowlisted_labels(): void
    {
        $observability = app(PaymentObservabilityService::class);
        $observability->event('invalid_response', [
            'order_id' => 1,
            'attempt_id' => 2,
            'invoice_number' => 'INV-1',
            'request_id' => null,
            'gateway_reference' => null,
            'mapped_status' => 'unknown',
            'processing_result' => 'unknown',
            'error_reason' => 'missing_payment_url',
            'raw_body' => 'secret-body',
        ]);

        $events = $observability->events();
        $event = end($events);
        $this->assertSame([
            'order_id', 'attempt_id', 'invoice_number', 'request_id', 'gateway_reference',
            'mapped_status', 'processing_result', 'error_reason',
        ], array_keys($event['labels']));
        $this->assertSame('invalid_response', $event['name']);
        $this->assertSame(1, $observability->counters()['payment_invalid_response']);
        $this->assertArrayHasKey('payment_pending_age_seconds', $observability->gauges());
        $this->assertArrayNotHasKey('raw_body', $event['labels']);
    }

    public function test_cutover_verification_fails_when_legacy_row_has_no_matching_attempt(): void
    {
        $order = Order::factory()->create();
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'LEGACY-MISSING',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);

        $this->artisan('payments:verify-cutover')->assertExitCode(1);
    }

    public function test_required_matrix_categories_are_registered(): void
    {
        $this->assertSame([
            'creation_failed', 'creation_timeout', 'invalid_signature', 'unknown_status',
            'amount_mismatch', 'pending_age', 'reconciliation_failure', 'late_payment',
            'duplicate_success', 'refund_ageing', 'needs_review', 'invalid_response',
        ], PaymentObservabilityService::registeredEventNames());
    }

    public function test_payment_transition_writes_sanitized_structured_observability_event(): void
    {
        Log::shouldReceive('channel')->with('operational')->andReturnSelf();
        Log::shouldReceive('info')->once()->withArgs(function (string $message, array $context): bool {
            return $message === 'payment.transition'
                && isset($context['order_id'], $context['attempt_id'], $context['invoice_number'], $context['request_id'], $context['gateway_reference'], $context['mapped_status'], $context['processing_result'])
                && ! isset($context['raw_body'], $context['signature'], $context['secret_key']);
        });
        $order = Order::factory()->create(['payment_status' => 'pending']);
        $attempt = PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => 'matrix-'.$order->id,
            'invoice_number' => $order->order_code,
            'merchant_request_id' => 'matrix-request-'.$order->id,
            'amount_snapshot' => $order->total,
            'currency_snapshot' => 'IDR',
        ]);

        app(DokuService::class)->handleNormalizedWebhook(new NormalizedPaymentEvent(
            source: 'matrix-test',
            gatewayStatus: 'SUCCESS',
            amount: $order->total,
            currency: 'IDR',
            gatewayReference: 'gateway-'.$attempt->id,
            receivedAt: now(),
            rawEvidence: ['order' => ['invoice_number' => $order->order_code]],
        ));

        Log::channel('operational')->shouldHaveReceived('info')->withArgs(function (string $message, array $context): bool {
            return $message === 'payment.transition'
                && isset($context['order_id'], $context['attempt_id'], $context['invoice_number'], $context['request_id'], $context['gateway_reference'], $context['mapped_status'], $context['processing_result'])
                && ! isset($context['raw_body'], $context['signature'], $context['secret_key']);
        });
    }
}
