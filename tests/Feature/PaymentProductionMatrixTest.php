<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\DokuService;
use App\Services\NormalizedPaymentEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class PaymentProductionMatrixTest extends TestCase
{
    use RefreshDatabase;

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
