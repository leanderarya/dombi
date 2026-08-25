<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CleanupStagingLegacyPaymentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.env' => 'staging',
            'database.connections.mysql.database' => 'dombi_staging',
            'database.staging_database_name' => 'dombi_staging',
        ]);
    }

    public function test_refuses_without_explicit_confirmation(): void
    {
        DB::table('payment_transactions')->insert([
            'order_id' => Order::factory()->create()->id, 'doku_order_id' => 'legacy', 'payment_method' => 'qris',
            'amount' => 10, 'status' => 'failed', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('payments:cleanup-staging-legacy')
            ->assertExitCode(1)
            ->expectsOutputToContain('--confirm-staging');

        $this->assertDatabaseCount('payment_transactions', 1);
    }

    public function test_refuses_testing_production_and_database_mismatch(): void
    {
        foreach (['testing', 'production'] as $environment) {
            config(['app.env' => $environment]);
            $this->artisan('payments:cleanup-staging-legacy', ['--confirm-staging' => true])->assertExitCode(1);
        }

        config(['app.env' => 'staging', 'database.connections.mysql.database' => 'wrong']);
        $this->artisan('payments:cleanup-staging-legacy', ['--confirm-staging' => true])
            ->assertExitCode(1)
            ->expectsOutputToContain('database identity');
    }

    public function test_deletes_legacy_data_but_preserves_canonical_data_and_schema(): void
    {
        $legacyOrder = Order::factory()->create([
            'payment_status' => 'paid', 'doku_order_id' => 'legacy-order', 'paid_at' => now(),
        ]);
        $canonicalOrder = Order::factory()->create(['payment_status' => 'paid', 'doku_order_id' => 'canonical']);
        $attempt = PaymentAttempt::create([
            'order_id' => $canonicalOrder->id,
            'attempt_key' => 'cleanup-'.$canonicalOrder->id,
            'invoice_number' => $canonicalOrder->order_code,
            'merchant_request_id' => 'cleanup-request-'.$canonicalOrder->id,
            'amount_snapshot' => $canonicalOrder->total,
            'currency_snapshot' => 'IDR',
            'settlement_status' => 'paid',
            'verification_status' => 'verified',
        ]);
        RefundObligation::create([
            'payment_attempt_id' => $attempt->id,
            'amount' => 10,
            'currency' => 'IDR',
            'reason' => 'cleanup-test',
            'status' => 'pending',
        ]);
        DB::table('payment_transactions')->insert([
            'order_id' => $legacyOrder->id, 'doku_order_id' => 'legacy', 'payment_method' => 'qris',
            'amount' => 10, 'status' => 'failed', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('payments:cleanup-staging-legacy', ['--confirm-staging' => true])
            ->assertExitCode(0)->expectsOutputToContain('payment transaction rows: 1');

        $this->assertDatabaseCount('payment_transactions', 0);
        $this->assertDatabaseHas('payment_attempts', ['order_id' => $canonicalOrder->id]);
        $this->assertDatabaseCount('refund_obligations', 1);
        $this->assertDatabaseHas('orders', ['id' => $legacyOrder->id, 'payment_status' => null, 'doku_order_id' => null, 'paid_at' => null]);
        $this->assertDatabaseHas('orders', ['id' => $canonicalOrder->id, 'doku_order_id' => 'canonical']);
        $this->assertTrue(Schema::hasTable('payment_transactions'));
    }
}
