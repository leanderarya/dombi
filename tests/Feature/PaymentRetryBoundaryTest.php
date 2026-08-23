<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentRetryBoundaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_at_cap_inactive_order_does_not_prepare_another_attempt_or_call_provider(): void
    {
        $order = Order::factory()->create();
        foreach (range(1, 3) as $number) {
            PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => "failed-{$number}", 'invoice_number' => "failed-invoice-{$number}", 'merchant_request_id' => "failed-request-{$number}", 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'failed', 'settlement_status' => 'failed']);
        }
        Http::fake();

        $this->assertSame(3, PaymentAttempt::where('order_id', $order->id)->count());
        $this->assertSame('failed', app(DokuService::class)->preparePaymentAttempt($order)->creation_state?->value);
        Http::assertNothingSent();
    }

    public function test_failed_creation_with_pending_settlement_is_pollable_attempt(): void
    {
        $order = Order::factory()->create();
        $attempt = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'ambiguous-poll', 'invoice_number' => 'ambiguous-poll', 'merchant_request_id' => 'ambiguous-poll-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'failed', 'settlement_status' => 'pending']);

        $resolved = PaymentAttempt::where('order_id', $order->id)->where(function ($query): void {
            $query->whereIn('creation_state', ['initiated', 'pending', 'created', 'unknown'])
                ->orWhereIn('settlement_status', ['pending', 'unknown']);
        })->latest('id')->first();

        $this->assertSame($attempt->id, $resolved?->id);
    }

    public function test_at_cap_active_order_reuses_existing_attempt(): void
    {
        $order = Order::factory()->create();
        $active = PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => 'active', 'invoice_number' => 'active-invoice', 'merchant_request_id' => 'active-request', 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'created', 'settlement_status' => 'pending']);
        foreach (range(1, 2) as $number) {
            PaymentAttempt::create(['order_id' => $order->id, 'attempt_key' => "failed-{$number}", 'invoice_number' => "failed-invoice-{$number}", 'merchant_request_id' => "failed-request-{$number}", 'amount_snapshot' => $order->total, 'currency_snapshot' => 'IDR', 'creation_state' => 'failed', 'settlement_status' => 'failed']);
        }

        $this->assertSame($active->id, app(DokuService::class)->preparePaymentAttempt($order)->id);
        $this->assertSame(3, PaymentAttempt::where('order_id', $order->id)->count());
    }
}
