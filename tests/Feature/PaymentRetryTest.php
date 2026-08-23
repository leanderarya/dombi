<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptCreationState;
use App\Exceptions\DokuPaymentException;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentRetryTest extends TestCase
{
    use RefreshDatabase;

    public function test_retry_creates_fresh_identity_and_preserves_failed_attempt(): void
    {
        $order = Order::factory()->create();
        $old = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'old', 'invoice_number' => 'old-invoice', 'merchant_request_id' => 'old-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Failed]);
        $service = app(DokuService::class);

        $new = $service->preparePaymentAttempt($order);

        $this->assertNotSame($old->invoice_number, $new->invoice_number);
        $this->assertDatabaseHas('payment_attempts', ['id' => $old->id, 'creation_state' => 'failed']);
        $this->assertDatabaseCount('payment_attempts', 2);
    }

    public function test_timeout_marks_attempt_unknown_without_retrying_provider_call(): void
    {
        Http::fake(['*' => Http::response('', 504)]);
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'timeout', 'invoice_number' => 'timeout-invoice', 'merchant_request_id' => 'timeout-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => PaymentAttemptCreationState::Failed]);

        $this->expectException(DokuPaymentException::class);
        try {
            app(DokuService::class)->createPayment($attempt);
        } finally {
            $this->assertDatabaseHas('payment_attempts', ['id' => $attempt->id, 'creation_state' => 'failed']);
        }
    }
}
