<?php

namespace Tests\Feature;

use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PickupCompletionConcurrencyTest extends TestCase
{
    use DatabaseTruncation;

    public function test_valid_pickup_completion_writes_expected_sale_and_inventory_effects(): void
    {
        [$order, $user, $product] = $this->makePickupContext();

        app(OrderStatusService::class)->completePickup($order, $user);

        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
        $this->assertSame(1, $this->completionHistory($order)->count());
        $this->assertSame(1, $this->salePayables($order)->count());
        $payable = $this->salePayables($order)->firstOrFail();
        $this->assertSame($order->outlet_id, $payable->outlet_id);
        $this->assertSame($order->id, $payable->order_id);
        $this->assertSame((string) $order->total, (string) $payable->amount);
        $this->assertSame('30000.00', (string) $payable->center_share);
        $this->assertSame('20000.00', (string) $payable->outlet_margin);
        $this->assertSame('30000.00', (string) $payable->remaining_amount);
        $this->assertSame(1, $this->completionMovements($order, $product)->count());
        $this->assertSame(8, $this->inventory($order, $product)->current_stock);
        $this->assertSame(0, $this->inventory($order, $product)->reserved_stock);
    }

    public function test_stale_pickup_retry_does_not_repeat_completion_effects(): void
    {
        [$order, $user, $product] = $this->makePickupContext();
        $staleOrder = Order::findOrFail($order->id);
        app(OrderStatusService::class)->completePickup($order, $user);

        try {
            app(OrderStatusService::class)->completePickup($staleOrder, $user);
            $this->fail('Expected stale pickup completion to be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('status', $exception->errors());
        }

        $this->assertSame(1, $this->completionHistory($order)->count());
        $this->assertSame(1, $this->salePayables($order)->count());
        $this->assertSame(1, $this->completionMovements($order, $product)->count());
        $this->assertSame(8, $this->inventory($order, $product)->current_stock);
        $this->assertSame(0, $this->inventory($order, $product)->reserved_stock);
    }

    public function test_failed_pickup_completion_rolls_back_status_history_stock_and_payable(): void
    {
        [$order, $user, $product] = $this->makePickupContext(currentStock: 1);

        try {
            app(OrderStatusService::class)->completePickup($order, $user);
            $this->fail('Expected insufficient stock to reject pickup completion.');
        } catch (InsufficientStockException) {
            $this->assertSame(Order::STATUS_READY_FOR_PICKUP, $order->fresh()->status);
            $this->assertSame(0, $this->completionHistory($order)->count());
            $this->assertSame(0, $this->salePayables($order)->count());
            $this->assertSame(0, $this->completionMovements($order, $product)->count());
            $this->assertSame(1, $this->inventory($order, $product)->current_stock);
            $this->assertSame(2, $this->inventory($order, $product)->reserved_stock);
        }
    }

    public function test_concurrent_pickup_completion_when_first_worker_holds_lock(): void
    {
        $this->assertConcurrentPickupCompletion(firstWorkerHoldsLock: true);
    }

    public function test_concurrent_pickup_completion_when_second_worker_holds_lock(): void
    {
        $this->assertConcurrentPickupCompletion(firstWorkerHoldsLock: false);
    }

    private function assertConcurrentPickupCompletion(bool $firstWorkerHoldsLock): void
    {
        $driver = DB::connection()->getDriverName();
        if ($driver === 'sqlite') {
            if (filter_var(getenv('CI'), FILTER_VALIDATE_BOOLEAN)) {
                $this->fail('Pickup concurrency gate cannot skip in CI.');
            }
            $this->markTestSkipped('SQLite does not provide production-driver row-lock concurrency.');
        }
        $this->assertSame('mysql', $driver);
        if (! function_exists('pcntl_fork')) {
            $this->fail('pcntl is required for pickup concurrency gate.');
        }

        [$order, $user, $product] = $this->makePickupContext();
        DB::disconnect();
        $holderName = $firstWorkerHoldsLock ? 'first' : 'second';
        $waiterName = $firstWorkerHoldsLock ? 'second' : 'first';
        $workerSockets = [];
        $workerPids = [];
        $holderReleased = false;

        try {
            foreach ([$holderName, $waiterName] as $workerName) {
                [$parentSocket, $childSocket] = stream_socket_pair(AF_UNIX, SOCK_STREAM, 0);
                stream_set_timeout($parentSocket, 30);
                stream_set_timeout($childSocket, 30);
                $workerPid = pcntl_fork();
                if ($workerPid === 0) {
                    fclose($parentSocket);
                    if ($workerName === $holderName) {
                        $this->runLockHolder($childSocket, $order->id, $user->id);
                    }
                    $this->runWaitingWorker($childSocket, $order->id, $user->id);
                }
                fclose($childSocket);
                $this->assertGreaterThan(0, $workerPid);
                $workerSockets[$workerName] = $parentSocket;
                $workerPids[$workerName] = $workerPid;
            }

            $this->assertSame('locked', trim(fgets($workerSockets[$holderName])));
            $connectionMessage = trim(fgets($workerSockets[$waiterName]));
            $this->assertMatchesRegularExpression('/^connection:\\d+$/', $connectionMessage);
            $this->assertSame('waiting', trim(fgets($workerSockets[$waiterName])));

            DB::purge();
            DB::reconnect();
            $this->waitForInnoDbLockWait((int) substr($connectionMessage, strlen('connection:')));

            $this->assertNotFalse(fwrite($workerSockets[$holderName], "complete\n"));
            $holderReleased = true;
            $this->assertSame('completed', trim(fgets($workerSockets[$holderName])));
            fclose($workerSockets[$holderName]);
            unset($workerSockets[$holderName]);
            pcntl_waitpid($workerPids[$holderName], $holderStatus);
            unset($workerPids[$holderName]);
            $this->assertTrue(pcntl_wifexited($holderStatus));
            $this->assertSame(0, pcntl_wexitstatus($holderStatus));

            $this->assertSame('rejected:status', trim(fgets($workerSockets[$waiterName])));
            fclose($workerSockets[$waiterName]);
            unset($workerSockets[$waiterName]);
            pcntl_waitpid($workerPids[$waiterName], $waiterStatus);
            unset($workerPids[$waiterName]);
            $this->assertTrue(pcntl_wifexited($waiterStatus));
            $this->assertSame(0, pcntl_wexitstatus($waiterStatus));

            DB::purge();
            DB::reconnect();
            $this->assertSame(Order::STATUS_COMPLETED, Order::findOrFail($order->id)->status);
            $this->assertSame(1, $this->completionHistory($order)->count());
            $this->assertSame(1, $this->salePayables($order)->count());
            $this->assertSame(1, $this->completionMovements($order, $product)->count());
            $this->assertSame(8, $this->inventory($order, $product)->current_stock);
            $this->assertSame(0, $this->inventory($order, $product)->reserved_stock);
        } finally {
            if (! $holderReleased && isset($workerSockets[$holderName]) && is_resource($workerSockets[$holderName])) {
                @fwrite($workerSockets[$holderName], "complete\n");
            }
            foreach ($workerSockets as $socket) {
                if (is_resource($socket)) {
                    fclose($socket);
                }
            }
            foreach ($workerPids as $workerPid) {
                pcntl_waitpid($workerPid, $workerStatus);
            }
            DB::purge();
            DB::reconnect();
        }
    }

    private function runLockHolder($socket, int $orderId, int $userId): never
    {
        try {
            DB::purge();
            DB::reconnect();
            DB::beginTransaction();
            $outletId = Order::query()->whereKey($orderId)->value('outlet_id');
            Outlet::lockForSettlement((int) $outletId);
            fwrite($socket, "locked\n");
            if (trim((string) fgets($socket)) !== 'complete') {
                throw new \RuntimeException('Coordinator did not release pickup lock holder.');
            }

            app(OrderStatusService::class)->completePickup(Order::findOrFail($orderId), User::findOrFail($userId));
            DB::commit();
            fwrite($socket, "completed\n");
            fclose($socket);
            exit(0);
        } catch (\Throwable $exception) {
            fwrite($socket, 'error:'.$exception->getMessage()."\n");
            fclose($socket);
            exit(1);
        }
    }

    private function waitForInnoDbLockWait(int $connectionId): void
    {
        $deadline = microtime(true) + 10;
        do {
            $waiting = DB::selectOne(
                'SELECT COUNT(*) AS waiting FROM performance_schema.data_lock_waits WHERE REQUESTING_THREAD_ID = (SELECT THREAD_ID FROM performance_schema.threads WHERE PROCESSLIST_ID = ?)',
                [$connectionId],
            );
            if ((int) $waiting->waiting > 0) {
                return;
            }
            usleep(10000);
        } while (microtime(true) < $deadline);

        $this->fail('Second pickup worker did not reach the InnoDB row lock wait.');
    }

    private function runWaitingWorker($socket, int $orderId, int $userId): never
    {
        try {
            DB::purge();
            DB::reconnect();
            $connectionId = (int) DB::selectOne('SELECT CONNECTION_ID() AS id')->id;
            fwrite($socket, "connection:{$connectionId}\n");
            $staleOrder = Order::findOrFail($orderId);
            $notified = false;
            DB::connection()->beforeExecuting(function (string $query) use ($socket, &$notified): void {
                $normalized = strtolower($query);
                if (! $notified && str_contains($normalized, 'outlets') && str_contains($normalized, 'for update')) {
                    $notified = true;
                    fwrite($socket, "waiting\n");
                }
            });

            try {
                app(OrderStatusService::class)->completePickup($staleOrder, User::findOrFail($userId));
                fwrite($socket, "completed\n");
                fclose($socket);
                exit(0);
            } catch (ValidationException $exception) {
                fwrite($socket, 'rejected:'.array_key_first($exception->errors())."\n");
                fclose($socket);
                exit(0);
            }
        } catch (\Throwable $exception) {
            fwrite($socket, 'error:'.$exception->getMessage()."\n");
            fclose($socket);
            exit(1);
        }
    }

    private function makePickupContext(int $currentStock = 10): array
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create();
        $user->update(['outlet_id' => $outlet->id]);
        $product = Product::factory()->create(['center_price' => 15000, 'selling_price' => 25000]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => Order::FULFILLMENT_PICKUP,
            'payment_status' => 'paid',
        ]);
        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => 25000,
            'subtotal' => 50000,
            'center_price_snapshot' => 15000,
            'outlet_margin_snapshot' => 10000,
        ]);
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => $currentStock,
            'reserved_stock' => 2,
            'minimum_stock' => 0,
        ]);

        return [$order, $user, $product];
    }

    private function completionHistory(Order $order)
    {
        return OrderStatusHistory::query()->where('order_id', $order->id)->where('to_status', Order::STATUS_COMPLETED);
    }

    private function salePayables(Order $order)
    {
        return OutletPayable::query()->where('order_id', $order->id)->where('type', 'sale');
    }

    private function completionMovements(Order $order, Product $product)
    {
        return StockMovement::query()
            ->where('reference_type', Order::class)
            ->where('reference_id', $order->id)
            ->where('product_id', $product->id)
            ->where('type', 'order_completed');
    }

    private function inventory(Order $order, Product $product): OutletInventory
    {
        return OutletInventory::query()->where('outlet_id', $order->outlet_id)->where('product_id', $product->id)->firstOrFail();
    }
}
