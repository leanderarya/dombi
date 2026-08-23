<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\PaymentTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PaymentAttemptBackfillTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_transactions_are_backfilled_once_with_historical_values(): void
    {
        $order = Order::factory()->create(['order_code' => 'INV-100']);
        $createdAt = Carbon::parse('2026-01-01 10:00:00');
        $updatedAt = Carbon::parse('2026-01-01 10:05:00');

        $transaction = PaymentTransaction::query()->create([
            'order_id' => $order->id,
            'doku_order_id' => 'DOKU-100',
            'payment_method' => 'qris',
            'amount' => 12500,
            'status' => 'paid',
            'session_id' => 'session-100',
            'token_id' => 'token-100',
            'raw_response' => ['result' => 'ok'],
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ]);
        $transaction->timestamps = false;
        $transaction->save();
        DB::table('payment_transactions')->where('id', $transaction->id)->update([
            'created_at' => $createdAt,
            'updated_at' => $updatedAt,
        ]);

        $this->artisan('payments:backfill-attempts')->assertExitCode(0);

        $attempt = PaymentAttempt::query()->sole();
        $this->assertSame($order->id, $attempt->order_id);
        $this->assertSame('DOKU-100', $attempt->invoice_number);
        $this->assertSame('legacy-payment-transaction-1', $attempt->attempt_key);
        $this->assertSame('DOKU-100', $attempt->merchant_request_id);
        $this->assertSame('session-100', $attempt->session_token);
        $this->assertSame('qris', $attempt->payment_method);
        $this->assertSame('12500.00', $attempt->amount_snapshot);
        $this->assertSame('12500.00', $attempt->gateway_amount);
        $this->assertSame('paid', $attempt->gateway_status);
        $this->assertSame(['result' => 'ok'], $attempt->metadata['legacy_raw_response']);
        $this->assertSame($createdAt->toDateTimeString(), $attempt->fresh()->created_at->toDateTimeString());
        $this->assertSame($updatedAt->toDateTimeString(), $attempt->fresh()->updated_at->toDateTimeString());

        $this->artisan('payments:backfill-attempts')->assertExitCode(0);
        $this->assertDatabaseCount('payment_attempts', 1);
    }

    public function test_missing_invoice_mapping_is_reported(): void
    {
        $transaction = PaymentTransaction::query()->create([
            'order_id' => Order::factory()->create(['order_code' => ''])->id,
            'doku_order_id' => '',
            'payment_method' => 'qris',
            'amount' => 1000,
        ]);

        $this->artisan('payments:backfill-attempts')
            ->expectsOutputToContain("Payment transaction {$transaction->id} could not be mapped")
            ->assertExitCode(0);

        $this->assertDatabaseCount('payment_attempts', 0);
    }
}
