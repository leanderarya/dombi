<?php

namespace Tests\Feature;

use App\Enums\PaymentAttemptSettlementStatus;
use App\Enums\PaymentAttemptVerificationStatus;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\RefundObligation;
use App\Models\StockMovement;
use App\Services\CanonicalPaymentTransitionService;
use App\Services\InventoryService;
use App\Services\NormalizedPaymentEvent;
use App\Services\SettlementService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\TestCase;

class PaymentFulfilmentConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_completion_constraint_migration_backfills_and_reports_duplicates(): void
    {
        $migration = file_get_contents(database_path('migrations/2026_08_24_000008_add_fulfilment_integrity_constraints.php'));
        $this->assertStringContainsString('UPDATE stock_movements SET order_completed_key', $migration);
        $this->assertStringContainsString('duplicate movement keys require reconciliation', $migration);
        $this->assertLessThan(strpos($migration, "Schema::table('stock_movements'"), strpos($migration, '$duplicates = DB::table(\'stock_movements\')'));
        $this->assertStringContainsString('DROP TRIGGER IF EXISTS', $migration);
        $this->assertStringContainsString("Schema::getIndexes('stock_movements')", $migration);
    }

    public function test_refund_obligation_uniqueness_is_present_on_production_drivers(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $this->markTestSkipped('SQLite constraint gate is not production-driver coverage.');
        }

        $driver = DB::connection()->getDriverName();
        if ($driver === 'pgsql') {
            $indexes = collect(DB::select("SELECT indexdef FROM pg_indexes WHERE tablename = 'refund_obligations'"));
            $this->assertTrue($indexes->contains(fn ($index) => str_contains($index->indexdef, 'payment_attempt_id') && str_contains($index->indexdef, 'reason')));

            return;
        }
        $this->assertSame('mysql', $driver);
        $indexes = collect(DB::select('SHOW INDEX FROM refund_obligations'));
        $this->assertTrue($indexes->contains(fn ($index) => $index->Key_name === 'refund_obligations_payment_attempt_id_reason_unique'));
    }

    public function test_order_completion_does_not_block_reservation_movements(): void
    {
        $outlet = Outlet::factory()->create();
        $product = Product::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id]);
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1, 'price' => 1, 'subtotal' => 1]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 2, 'reserved_stock' => 0, 'minimum_stock' => 0]);
        app(InventoryService::class)->reserveStock($outlet->id, [['product_id' => $product->id, 'quantity' => 1]], $order);
        $order->load('items');
        app(InventoryService::class)->releaseReservedStock($order);

        $this->assertSame(2, StockMovement::where('reference_type', Order::class)->where('reference_id', $order->id)->where('product_id', $product->id)->count());
    }

    public function test_duplicate_product_lines_are_completed_as_one_inventory_decrement(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        foreach ([1, 2] as $quantity) {
            $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => $quantity, 'price' => 50000, 'subtotal' => 50000 * $quantity]);
        }
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 5, 'reserved_stock' => 3, 'minimum_stock' => 0]);

        app(InventoryService::class)->completeOrderStock($order->fresh(['items']));

        $inventory = OutletInventory::where('outlet_id', $outlet->id)->where('product_id', $product->id)->first();
        $this->assertSame(2, $inventory->current_stock);
        $this->assertSame(0, $inventory->reserved_stock);
        $this->assertSame(1, StockMovement::where('type', 'order_completed')->count());
    }

    public function test_order_completed_movement_update_cannot_create_duplicate(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $this->markTestSkipped('SQLite does not provide production completion uniqueness; production-driver gate covers MySQL/PostgreSQL.');
        }
        $outlet = Outlet::factory()->create();
        $product = Product::factory()->create();
        $movements = [];
        foreach (range(1, 2) as $referenceId) {
            $movements[] = StockMovement::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'type' => 'order_completed', 'quantity' => -1, 'reference_type' => Order::class, 'reference_id' => $referenceId]);
        }

        $this->expectException(QueryException::class);
        $movements[1]->update(['reference_id' => $movements[0]->reference_id]);
    }

    public function test_order_completion_movement_is_idempotent(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1, 'price' => 50000, 'subtotal' => 50000]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 3, 'reserved_stock' => 1, 'minimum_stock' => 0]);

        app(InventoryService::class)->completeOrderStock($order->fresh(['items']));
        app(InventoryService::class)->completeOrderStock($order->fresh(['items']));

        $this->assertSame(1, StockMovement::where('reference_type', Order::class)->where('reference_id', $order->id)->where('type', 'order_completed')->count());
    }

    public function test_matching_order_claim_repairs_missing_attempt_timestamp_without_refund(): void
    {
        $order = Order::factory()->create(['status' => Order::STATUS_CONFIRMED, 'payment_status' => 'pending']);
        $attempt = $this->attempt($order, 'matching-claim', 'invoice-matching-claim');
        $order->update(['fulfilment_claimed_at' => now(), 'fulfilment_claimed_by' => $attempt->id]);

        $result = app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-matching-claim', now(), []));

        $this->assertTrue($result->fulfilmentWinner);
        $this->assertNotNull($attempt->fresh()->fulfilment_claimed_at);
        $this->assertSame(0, RefundObligation::count());
    }

    public function test_terminal_needs_review_success_creates_late_refund_without_fulfilment(): void
    {
        $order = Order::factory()->create(['status' => Order::STATUS_EXPIRED, 'payment_status' => 'pending']);
        $attempt = $this->attempt($order, 'terminal-review', 'invoice-terminal-review');

        app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent('doku', 'SUCCESS', 49000, 'IDR', 'invoice-terminal-review', now(), []));

        $this->assertSame(1, RefundObligation::where('payment_attempt_id', $attempt->id)->where('reason', 'late_payment')->count());
        $this->assertNull($order->fresh()->fulfilment_claimed_at);
        $this->assertSame(Order::STATUS_EXPIRED, $order->fresh()->status);
    }

    public function test_completed_winner_replay_on_terminal_order_is_idempotent_without_refund(): void
    {
        $order = Order::factory()->create(['status' => Order::STATUS_EXPIRED, 'payment_status' => 'pending']);
        $attempt = $this->attempt($order, 'winner-replay', 'invoice-winner-replay');
        $order->update(['fulfilment_claimed_at' => now(), 'fulfilment_claimed_by' => $attempt->id, 'status' => Order::STATUS_COMPLETED]);
        $attempt->update(['fulfilment_claimed_at' => now(), 'settlement_status' => PaymentAttemptSettlementStatus::Paid, 'verification_status' => PaymentAttemptVerificationStatus::Verified]);

        $result = app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-winner-replay', now(), []));

        $this->assertTrue($result->fulfilmentWinner);
        $this->assertSame(0, RefundObligation::count());
    }

    public function test_payment_fulfilment_rolls_back_claim_order_inventory_and_obligation_on_failure(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'total' => 50000, 'payment_status' => 'pending', 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1, 'price' => 50000, 'subtotal' => 50000]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 3, 'reserved_stock' => 1, 'minimum_stock' => 0]);
        $attempt = $this->attempt($order, 'rollback', 'invoice-rollback');
        $settlement = Mockery::mock(app(SettlementService::class));
        $settlement->shouldReceive('recordSale')->andThrow(new \RuntimeException('settlement failed'));
        $this->app->instance(SettlementService::class, $settlement);

        try {
            app(CanonicalPaymentTransitionService::class)->apply($attempt, new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', 'invoice-rollback', now(), []));
            $this->fail('Expected settlement failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('settlement failed', $exception->getMessage());
        }

        $this->assertNull($order->fresh()->fulfilment_claimed_at);
        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
        $this->assertSame(3, OutletInventory::where('outlet_id', $outlet->id)->where('product_id', $product->id)->value('current_stock'));
        $this->assertSame(0, RefundObligation::count());
        $this->assertSame(0, StockMovement::where('type', 'order_completed')->count());
    }

    public function test_production_driver_parallel_workers_have_one_fulfilment_winner(): void
    {
        $driver = config('database.default') === 'sqlite' ? 'sqlite' : DB::connection()->getDriverName();
        if ($driver === 'sqlite') {
            if (filter_var(getenv('CI'), FILTER_VALIDATE_BOOLEAN)) {
                $this->fail('Production-driver concurrency gate cannot skip in CI.');
            }
            $this->markTestSkipped('SQLite does not provide production-driver row-lock concurrency.');
        }
        $this->assertContains($driver, ['mysql', 'pgsql']);
        if (! function_exists('pcntl_fork')) {
            $this->fail('pcntl is required for production-driver concurrency gate.');
        }

        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'total' => 50000, 'payment_status' => 'pending', 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1, 'price' => 50000, 'subtotal' => 50000]);
        OutletInventory::create(['outlet_id' => $outlet->id, 'product_id' => $product->id, 'current_stock' => 3, 'reserved_stock' => 1, 'minimum_stock' => 0]);
        $first = $this->attempt($order, 'parallel-first', 'invoice-parallel-first');
        $second = $this->attempt($order, 'parallel-second', 'invoice-parallel-second');
        $results = tempnam(sys_get_temp_dir(), 'task12-results-');
        file_put_contents($results, '');
        DB::commit();
        $parentSockets = [];
        $children = [];

        foreach ([$first, $second] as $attempt) {
            [$parentSocket, $childSocket] = stream_socket_pair(AF_UNIX, SOCK_STREAM, 0);
            $pid = pcntl_fork();
            if ($pid === 0) {
                try {
                    DB::purge();
                    DB::reconnect();
                    fwrite($childSocket, "ready\n");
                    while (fgets($childSocket) === false) {
                        usleep(10000);
                    }
                    app(CanonicalPaymentTransitionService::class)->apply(PaymentAttempt::findOrFail($attempt->id), new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', $attempt->invoice_number, now(), []));
                    file_put_contents($results, "success\n", FILE_APPEND | LOCK_EX);
                    exit(0);
                } catch (\Throwable $exception) {
                    file_put_contents($results, "error: {$exception->getMessage()}\n", FILE_APPEND | LOCK_EX);
                    exit(1);
                }
            }
            $this->assertGreaterThan(0, $pid);
            fclose($childSocket);
            $parentSockets[] = $parentSocket;
            $children[] = $pid;
        }

        foreach ($parentSockets as $socket) {
            $this->assertSame('ready', trim(fgets($socket)));
        }
        foreach ($parentSockets as $socket) {
            fwrite($socket, "go\n");
            fclose($socket);
        }

        foreach ($children as $pid) {
            pcntl_waitpid($pid, $status);
            $this->assertTrue(pcntl_wifexited($status));
            $this->assertSame(0, pcntl_wexitstatus($status), file_get_contents($results));
        }

        $this->assertSame(1, PaymentAttempt::whereNotNull('fulfilment_claimed_at')->count());
        $this->assertSame(1, RefundObligation::where('reason', 'duplicate_paid_attempt')->count());
        $this->assertSame(1, StockMovement::where('reference_id', $order->id)->where('type', 'order_completed')->count());
        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
        $this->assertSame(2, OutletInventory::whereKey(OutletInventory::query()->where('outlet_id', $outlet->id)->where('product_id', $product->id)->value('id'))->value('current_stock'));
        @unlink($results);
    }

    public function test_only_one_successful_attempt_claims_order_fulfilment(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id, 'total' => 50000, 'payment_status' => 'pending', 'status' => Order::STATUS_CONFIRMED]);
        $product = Product::factory()->create();
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'quantity' => 1, 'price' => 50000, 'subtotal' => 50000]);
        OutletInventory::create(['outlet_id' => $order->outlet_id, 'product_id' => $product->id, 'current_stock' => 3, 'reserved_stock' => 1, 'minimum_stock' => 0]);
        $first = $this->attempt($order, 'first', 'invoice-first');
        $second = $this->attempt($order, 'second', 'invoice-second');
        $event = fn (string $invoice) => new NormalizedPaymentEvent('doku', 'SUCCESS', 50000, 'IDR', $invoice, now(), []);

        app(CanonicalPaymentTransitionService::class)->apply($first, $event('invoice-first'));
        app(CanonicalPaymentTransitionService::class)->apply($second, $event('invoice-second'));

        $this->assertNotNull($order->fresh()->fulfilment_claimed_at);
        $this->assertSame(1, PaymentAttempt::whereNotNull('fulfilment_claimed_at')->count());
        $this->assertSame(1, RefundObligation::where('reason', 'duplicate_paid_attempt')->count());
        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
        $this->assertSame(1, StockMovement::where('reference_type', Order::class)->where('reference_id', $order->id)->where('type', 'order_completed')->count());
    }

    private function attempt(Order $order, string $key, string $invoice): PaymentAttempt
    {
        return PaymentAttempt::create([
            'order_id' => $order->id,
            'attempt_key' => $key,
            'invoice_number' => $invoice,
            'merchant_request_id' => $key.'-request',
            'amount_snapshot' => 50000,
            'currency_snapshot' => 'IDR',
            'settlement_status' => PaymentAttemptSettlementStatus::Pending,
            'verification_status' => PaymentAttemptVerificationStatus::NeedsReview,
        ]);
    }
}
