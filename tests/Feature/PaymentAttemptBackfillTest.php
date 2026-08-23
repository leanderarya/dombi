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
        $this->assertSame('INV-100', $attempt->metadata['legacy_order_code']);
        $this->assertSame('legacy-attempt-1', $attempt->attempt_key);
        $this->assertSame('DOKU-100', $attempt->merchant_request_id);
        $this->assertSame('session-100', $attempt->session_token);
        $this->assertSame('session-100', $attempt->session_id);
        $this->assertSame('token-100', $attempt->token_id);
        $this->assertSame('qris', $attempt->payment_method);
        $this->assertSame('12500.00', $attempt->amount_snapshot);
        $this->assertSame('12500.00', $attempt->gateway_amount);
        $this->assertSame('paid', $attempt->gateway_status);
        $this->assertSame(['result' => 'ok'], $attempt->raw_response);
        $this->assertSame($createdAt->toDateTimeString(), $attempt->fresh()->created_at->toDateTimeString());
        $this->assertSame($updatedAt->toDateTimeString(), $attempt->fresh()->updated_at->toDateTimeString());

        $this->artisan('payments:backfill-attempts')->assertExitCode(0);
        $this->assertDatabaseCount('payment_attempts', 1);
    }

    public function test_missing_provider_and_order_identities_are_synthesized(): void
    {
        $transaction = PaymentTransaction::query()->create([
            'order_id' => Order::factory()->create(['order_code' => ''])->id,
            'doku_order_id' => '',
            'payment_method' => 'qris',
            'amount' => 1000,
            'status' => 'pending',
        ]);

        $this->artisan('payments:backfill-attempts')->assertExitCode(0);

        $attempt = PaymentAttempt::query()->sole();
        $this->assertSame("legacy-invoice-{$transaction->id}", $attempt->invoice_number);
        $this->assertSame("legacy-attempt-{$transaction->id}", $attempt->attempt_key);
        $this->assertSame("legacy-request-{$transaction->id}", $attempt->merchant_request_id);
    }

    public function test_unsupported_status_is_reported_and_not_imported(): void
    {
        $transaction = PaymentTransaction::query()->create([
            'order_id' => Order::factory()->create()->id,
            'doku_order_id' => 'DOKU-unsupported',
            'payment_method' => 'qris',
            'amount' => 1000,
            'status' => 'refunded',
        ]);

        $this->artisan('payments:backfill-attempts')
            ->expectsOutputToContain("Payment transaction {$transaction->id} has unsupported status [refunded]")
            ->expectsOutputToContain('Exceptions: 1')
            ->assertExitCode(0);

        $this->assertDatabaseCount('payment_attempts', 0);
    }

    public function test_orphan_order_is_reported_without_aborting_batch(): void
    {
        $orphan = PaymentTransaction::query()->create([
            'order_id' => Order::factory()->create()->id,
            'doku_order_id' => 'DOKU-orphan',
            'payment_method' => 'qris',
            'amount' => 1000,
            'status' => 'pending',
        ]);
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('payment_transactions')->where('id', $orphan->id)->update(['order_id' => 999999]);
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $valid = PaymentTransaction::query()->create([
            'order_id' => Order::factory()->create()->id,
            'doku_order_id' => 'DOKU-valid',
            'payment_method' => 'qris',
            'amount' => 1000,
            'status' => 'pending',
        ]);

        $this->artisan('payments:backfill-attempts')
            ->expectsOutputToContain("Payment transaction {$orphan->id} could not be mapped")
            ->assertExitCode(0);
        $this->assertDatabaseHas('payment_attempts', ['legacy_payment_transaction_id' => $valid->id]);
    }

    public function test_failed_attempt_insert_is_reported_and_batch_continues(): void
    {
        $order = Order::factory()->create();
        PaymentAttempt::query()->create([
            'order_id' => $order->id,
            'attempt_key' => 'legacy-attempt-6',
            'invoice_number' => 'DOKU-conflict',
            'merchant_request_id' => 'existing-request',
            'amount_snapshot' => 1000,
            'currency_snapshot' => 'IDR',
        ]);
        $failed = PaymentTransaction::query()->create([
            'order_id' => $order->id,
            'doku_order_id' => 'DOKU-conflict',
            'payment_method' => 'qris',
            'amount' => 1000,
            'status' => 'pending',
        ]);
        $valid = PaymentTransaction::query()->create([
            'order_id' => Order::factory()->create()->id,
            'doku_order_id' => 'DOKU-after-failure',
            'payment_method' => 'qris',
            'amount' => 1000,
            'status' => 'pending',
        ]);

        $this->artisan('payments:backfill-attempts')
            ->expectsOutputToContain("Payment transaction {$failed->id} failed")
            ->assertExitCode(0);
        $this->assertDatabaseHas('payment_attempts', ['legacy_payment_transaction_id' => $valid->id]);
        $this->assertDatabaseMissing('payment_attempts', ['legacy_payment_transaction_id' => $failed->id]);
        PaymentAttempt::query()->where('invoice_number', 'DOKU-conflict')->delete();
        $this->artisan('payments:backfill-attempts')->assertExitCode(0);
        $this->assertDatabaseHas('payment_attempts', ['legacy_payment_transaction_id' => $failed->id]);
    }

    public function test_empty_provider_identity_is_not_unmappable_when_order_exists(): void
    {
        PaymentTransaction::query()->create([
            'order_id' => Order::factory()->create(['order_code' => ''])->id,
            'doku_order_id' => '',
            'payment_method' => 'qris',
            'amount' => 1000,
            'status' => 'pending',
        ]);

        $this->artisan('payments:backfill-attempts')->assertExitCode(0);
        $this->assertDatabaseCount('payment_attempts', 1);
    }
}
