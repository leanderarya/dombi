<?php

namespace Tests\Feature;

use App\Models\OfflineSale;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\SettlementReconciliationIssue;
use App\Models\User;
use App\Services\SettlementGeneratorService;
use App\Services\SettlementPaymentService;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SettlementConcurrencyTest extends TestCase
{
    public function test_pending_payment_blocks_concurrent_offline_sale_edit(): void
    {
        $this->requireProductionDatabase();

        [$outlet, $user, $product, $sale, $settlement] = $this->makeSaleContext();
        $outletId = $outlet->id;
        $userId = $user->id;
        $saleId = $sale->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'settlement-edit-');
        [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        $pid = pcntl_fork();
        if ($pid === 0) {
            fclose($parentSocket);
            try {
                DB::purge();
                DB::reconnect();
                $this->signalWorkerReady($childSocket);
                $this->awaitWorkerGo($childSocket);
                fwrite($childSocket, "attempting\n");
                $response = $this->actingAs(User::findOrFail($userId))->put("/outlet/offline-sales/{$saleId}", [
                    'quantity' => 2,
                    'payment_method' => 'cash',
                ]);
                file_put_contents($resultPath, json_encode([
                    'status' => $response->getStatusCode(),
                    'sale_quantity' => OfflineSale::whereKey($saleId)->value('quantity'),
                ]));
                DB::disconnect();
                exit(0);
            } catch (\Throwable $exception) {
                file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()]));
                exit(1);
            }
        }

        $this->assertGreaterThan(0, $pid);
        fclose($childSocket);
        $workerConnectionId = $this->receiveWorkerConnectionId($parentSocket);
        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        $this->signalWorkerGo($parentSocket);
        $this->assertWorkerAttempted($parentSocket);
        $this->assertExpectedLockWait(
            $this->observeLockWait($workerConnectionId, $blockingConnectionId, 'outlets'),
            'outlets',
        );
        SettlementPayment::create([
            'outlet_id' => $outletId,
            'settlement_id' => $settlement->id,
            'reference_number' => 'RACE-'.uniqid(),
            'payment_date' => now()->toDateString(),
            'amount' => 10000,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
        DB::commit();
        fclose($parentSocket);

        pcntl_waitpid($pid, $status);
        $result = json_decode((string) file_get_contents($resultPath), true);
        @unlink($resultPath);
        $this->assertTrue(pcntl_wifexited($status), json_encode($result));
        $this->assertSame(0, pcntl_wexitstatus($status), json_encode($result));

        DB::purge();
        DB::reconnect();
        $this->assertSame(302, $result['status']);
        $this->assertSame(1, $result['sale_quantity']);
        $this->assertSame(8, OutletInventory::where('outlet_id', $outletId)->where('product_id', $product->id)->value('current_stock'));
        $payment = SettlementPayment::where('outlet_id', $outletId)->firstOrFail();
        $this->assertSame(SettlementPayment::STATUS_PENDING, $payment->status);
        $this->assertSame(0, DB::table('settlement_payment_allocations')->where('settlement_payment_id', $payment->id)->count());
    }

    public function test_pending_payment_blocks_concurrent_offline_sale_delete(): void
    {
        $this->requireProductionDatabase();

        [$outlet, $user, $product, $sale, $settlement] = $this->makeSaleContext();
        $outletId = $outlet->id;
        $userId = $user->id;
        $saleId = $sale->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'settlement-delete-');
        [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        $pid = pcntl_fork();
        if ($pid === 0) {
            fclose($parentSocket);
            try {
                DB::purge();
                DB::reconnect();
                $this->signalWorkerReady($childSocket);
                $this->awaitWorkerGo($childSocket);
                fwrite($childSocket, "attempting\n");
                $response = $this->actingAs(User::findOrFail($userId))->delete("/outlet/offline-sales/{$saleId}");
                file_put_contents($resultPath, json_encode(['status' => $response->getStatusCode()]));
                DB::disconnect();
                exit(0);
            } catch (\Throwable $exception) {
                file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()]));
                exit(1);
            }
        }

        $this->assertGreaterThan(0, $pid);
        fclose($childSocket);
        $workerConnectionId = $this->receiveWorkerConnectionId($parentSocket);
        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        $this->signalWorkerGo($parentSocket);
        $this->assertWorkerAttempted($parentSocket);
        $this->assertExpectedLockWait(
            $this->observeLockWait($workerConnectionId, $blockingConnectionId, 'outlets'),
            'outlets',
        );
        SettlementPayment::create([
            'outlet_id' => $outletId,
            'settlement_id' => $settlement->id,
            'reference_number' => 'DELETE-RACE-'.uniqid(),
            'payment_date' => now()->toDateString(),
            'amount' => 10000,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
        DB::commit();
        fclose($parentSocket);

        pcntl_waitpid($pid, $status);
        $result = json_decode((string) file_get_contents($resultPath), true);
        @unlink($resultPath);
        $this->assertTrue(pcntl_wifexited($status), json_encode($result));
        $this->assertSame(0, pcntl_wexitstatus($status), json_encode($result));

        DB::purge();
        DB::reconnect();
        $this->assertSame(302, $result['status']);
        $this->assertDatabaseHas('offline_sales', ['id' => $saleId, 'quantity' => 1]);
        $this->assertSame(8, OutletInventory::where('outlet_id', $outletId)->where('product_id', $product->id)->value('current_stock'));
        $this->assertSame(0, DB::table('stock_movements')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(0, DB::table('outlet_payables')->where('type', 'sale')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(0, DB::table('outlet_payables')->where('type', 'adjustment')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
    }

    public function test_concurrent_fifo_allocations_are_serialized_by_outlet_lock(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , , $sale, $firstSettlement] = $this->makeSaleContext();
        $secondSettlement = Settlement::create([
            'outlet_id' => $outlet->id,
            'period_date' => $sale->created_at->copy()->subWeek()->startOfWeek()->toDateString(),
            'period_start' => $sale->created_at->copy()->subWeek()->startOfWeek()->toDateString(),
            'period_end' => $sale->created_at->copy()->subWeek()->endOfWeek()->toDateString(),
            'period_type' => 'weekly',
            'sales_amount' => 10000,
            'amount_due' => 10000,
            'total_offline_sales' => 10000,
            'net_amount' => -10000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
        ]);
        $outletId = $outlet->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'settlement-fifo-');
        $workers = [];
        $sockets = [];
        foreach ([1, 2] as $worker) {
            [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            $pid = pcntl_fork();
            if ($pid === 0) {
                fclose($parentSocket);
                try {
                    DB::purge();
                    DB::reconnect();
                    $this->signalWorkerReady($childSocket);
                    $this->awaitWorkerGo($childSocket);
                    fwrite($childSocket, "attempting\n");
                    DB::transaction(function () use ($outletId, $worker): void {
                        Outlet::lockForSettlement($outletId);
                        $payment = SettlementPayment::create([
                            'outlet_id' => $outletId,
                            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
                            'reference_number' => 'FIFO-RACE-'.$worker.'-'.uniqid(),
                            'payment_date' => now()->toDateString(),
                            'amount' => 10000,
                            'status' => SettlementPayment::STATUS_VERIFIED,
                        ]);
                        app(SettlementPaymentService::class)->fifoAllocate(
                            $outletId,
                            10000,
                            $payment->id,
                            Settlement::DIRECTION_OUTLET_PAYS,
                        );
                    });
                    file_put_contents($resultPath, "ok\n", FILE_APPEND | LOCK_EX);
                    DB::disconnect();
                    exit(0);
                } catch (\Throwable $exception) {
                    file_put_contents($resultPath, $exception->getMessage()."\n", FILE_APPEND | LOCK_EX);
                    exit(1);
                }
            }
            $this->assertGreaterThan(0, $pid);
            fclose($childSocket);
            $workers[] = $pid;
            $sockets[] = $parentSocket;
        }

        $workerConnectionIds = [];
        foreach ($sockets as $socket) {
            $workerConnectionIds[] = $this->receiveWorkerConnectionId($socket);
        }

        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        foreach ($sockets as $socket) {
            $this->signalWorkerGo($socket);
            $this->assertWorkerAttempted($socket);
        }
        $this->assertExpectedLockWaits(
            $this->observeLockWaits($workerConnectionIds, $blockingConnectionId, 'outlets'),
            $workerConnectionIds,
            $blockingConnectionId,
            'outlets',
        );
        DB::commit();
        foreach ($sockets as $socket) {
            fclose($socket);
        }
        foreach ($workers as $pid) {
            pcntl_waitpid($pid, $status);
            $this->assertTrue(pcntl_wifexited($status), (string) file_get_contents($resultPath));
            $this->assertSame(0, pcntl_wexitstatus($status), (string) file_get_contents($resultPath));
        }

        DB::purge();
        DB::reconnect();
        $allocations = DB::table('settlement_payment_allocations')
            ->whereIn('settlement_id', [$firstSettlement->id, $secondSettlement->id])
            ->get();
        $this->assertSame(20000.0, (float) Settlement::findOrFail($firstSettlement->id)->paid_amount
            + (float) Settlement::findOrFail($secondSettlement->id)->paid_amount);
        $this->assertCount(2, $allocations);
        $this->assertSame(2, SettlementPayment::where('outlet_id', $outletId)->where('status', SettlementPayment::STATUS_VERIFIED)->count());
        $this->assertSame(20000.0, (float) $allocations->sum('allocated_amount'));
        $this->assertSame(0, DB::table('settlement_payment_allocations as allocations')
            ->join('settlement_payments as payments', 'payments.id', '=', 'allocations.settlement_payment_id')
            ->join('settlements', 'settlements.id', '=', 'allocations.settlement_id')
            ->whereColumn('payments.direction', '!=', 'settlements.direction')
            ->count());
        @unlink($resultPath);
    }

    public function test_concurrent_first_generation_creates_one_weekly_settlement(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , , $sale] = $this->makeSaleContext(withSettlement: false);
        $outletId = $outlet->id;
        $date = $sale->created_at->toDateString();
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'settlement-generation-');
        $workers = [];
        $sockets = [];
        foreach ([1, 2] as $worker) {
            [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            $pid = pcntl_fork();
            if ($pid === 0) {
                fclose($parentSocket);
                try {
                    DB::purge();
                    DB::reconnect();
                    $this->signalWorkerReady($childSocket);
                    $this->awaitWorkerGo($childSocket);
                    fwrite($childSocket, "attempting\n");
                    $settlement = app(SettlementGeneratorService::class)->generateForOutlet(
                        Outlet::findOrFail($outletId),
                        Carbon::parse($date),
                    );
                    file_put_contents($resultPath, $settlement->id."\n", FILE_APPEND | LOCK_EX);
                    DB::disconnect();
                    exit(0);
                } catch (\Throwable $exception) {
                    file_put_contents($resultPath, 'error: '.$exception->getMessage()."\n", FILE_APPEND | LOCK_EX);
                    exit(1);
                }
            }
            $this->assertGreaterThan(0, $pid);
            fclose($childSocket);
            $workers[] = $pid;
            $sockets[] = $parentSocket;
        }

        $workerConnectionIds = [];
        foreach ($sockets as $socket) {
            $workerConnectionIds[] = $this->receiveWorkerConnectionId($socket);
        }

        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        foreach ($sockets as $socket) {
            $this->signalWorkerGo($socket);
            $this->assertWorkerAttempted($socket);
        }
        $this->assertExpectedLockWaits(
            $this->observeLockWaits($workerConnectionIds, $blockingConnectionId, 'outlets'),
            $workerConnectionIds,
            $blockingConnectionId,
            'outlets',
        );
        DB::commit();
        foreach ($sockets as $socket) {
            fclose($socket);
        }
        foreach ($workers as $pid) {
            pcntl_waitpid($pid, $status);
            $this->assertTrue(pcntl_wifexited($status));
            $this->assertSame(0, pcntl_wexitstatus($status), (string) file_get_contents($resultPath));
        }

        DB::purge();
        DB::reconnect();
        $settlements = Settlement::where('outlet_id', $outletId)
            ->where('period_type', 'weekly')
            ->whereDate('period_start', Carbon::parse($date)->startOfWeek()->toDateString())
            ->get();
        $ids = array_map('intval', file($resultPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
        @unlink($resultPath);
        $this->assertCount(1, $settlements);
        $this->assertCount(2, $ids);
        $this->assertSame([$settlements->first()->id], array_values(array_unique($ids)));
    }

    public function test_owner_payout_waiting_on_outlet_lock_is_recorded_after_sale_edit(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , $product, $sale, $settlement] = $this->makeSaleContext();
        $settlement->update([
            'direction' => Settlement::DIRECTION_OWNER_PAYS,
            'net_amount' => 10000,
            'amount_due' => 10000,
        ]);
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $outletId = $outlet->id;
        $saleId = $sale->id;
        $ownerId = $owner->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'owner-payout-edit-');
        [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        $pid = pcntl_fork();
        if ($pid === 0) {
            fclose($parentSocket);
            try {
                DB::purge();
                DB::reconnect();
                $this->signalWorkerReady($childSocket);
                $this->awaitWorkerGo($childSocket);
                fwrite($childSocket, "attempting\n");
                $response = $this->actingAs(User::findOrFail($ownerId))->post("/owner/finance/settlements/{$outletId}/payout", [
                    'amount' => 10000,
                    'reference_number' => 'OWNER-RACE-'.uniqid(),
                ]);
                file_put_contents($resultPath, json_encode(['status' => $response->getStatusCode()]));
                DB::disconnect();
                exit(0);
            } catch (\Throwable $exception) {
                file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()]));
                exit(1);
            }
        }

        $this->assertGreaterThan(0, $pid);
        fclose($childSocket);
        $workerConnectionId = $this->receiveWorkerConnectionId($parentSocket);
        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        $this->signalWorkerGo($parentSocket);
        $this->assertWorkerAttempted($parentSocket);
        $this->assertExpectedLockWait(
            $this->observeLockWait($workerConnectionId, $blockingConnectionId, 'outlets'),
            'outlets',
        );
        $inventory = OutletInventory::where('outlet_id', $outletId)->where('product_id', $product->id)->lockForUpdate()->firstOrFail();
        $inventory->increment('current_stock', 1);
        OfflineSale::whereKey($saleId)->update(['quantity' => 2, 'total_amount' => 20000, 'gross_amount' => 30000]);
        $settlement->update([
            'amount_due' => 20000,
            'net_amount' => 20000,
            'direction' => Settlement::DIRECTION_OWNER_PAYS,
            'sales_amount' => 20000,
        ]);
        DB::commit();
        fclose($parentSocket);

        pcntl_waitpid($pid, $status);
        $result = json_decode((string) file_get_contents($resultPath), true);
        @unlink($resultPath);
        $this->assertTrue(pcntl_wifexited($status), json_encode($result));
        $this->assertSame(0, pcntl_wexitstatus($status), json_encode($result));
        DB::purge();
        DB::reconnect();
        $this->assertSame(302, $result['status']);
        $this->assertSame(1, SettlementPayment::where('outlet_id', $outletId)->count());
        $this->assertSame(2, OfflineSale::findOrFail($saleId)->quantity);
        $this->assertSame(9, OutletInventory::where('outlet_id', $outletId)->where('product_id', $product->id)->value('current_stock'));
        $settlement->refresh();
        $this->assertSame(20000.0, (float) $settlement->amount_due);
        $this->assertSame(10000.0, (float) $settlement->paid_amount);
        $this->assertSame(Settlement::DIRECTION_OWNER_PAYS, $settlement->direction);
    }

    public function test_owner_direct_payment_waiting_on_outlet_lock_is_rejected_after_sale_delete(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , , $sale, $settlement] = $this->makeSaleContext();
        $settlement->update([
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'net_amount' => -10000,
        ]);
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $outletId = $outlet->id;
        $saleId = $sale->id;
        $ownerId = $owner->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'owner-payment-delete-');
        [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        $pid = pcntl_fork();
        if ($pid === 0) {
            fclose($parentSocket);
            try {
                DB::purge();
                DB::reconnect();
                $this->signalWorkerReady($childSocket);
                $this->awaitWorkerGo($childSocket);
                fwrite($childSocket, "attempting\n");
                $response = $this->actingAs(User::findOrFail($ownerId))->post("/owner/finance/settlements/{$outletId}/payments", [
                    'amount' => 10000,
                    'payment_method' => 'transfer_bank',
                    'reference_number' => 'OWNER-DELETE-RACE-'.uniqid(),
                ]);
                file_put_contents($resultPath, json_encode([
                    'status' => $response->getStatusCode(),
                    'error' => $response->getSession()->get('error'),
                ]));
                DB::disconnect();
                exit(0);
            } catch (\Throwable $exception) {
                file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()]));
                exit(1);
            }
        }

        $this->assertGreaterThan(0, $pid);
        fclose($childSocket);
        $workerConnectionId = $this->receiveWorkerConnectionId($parentSocket);
        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        $this->signalWorkerGo($parentSocket);
        $this->assertWorkerAttempted($parentSocket);
        $this->assertExpectedLockWait(
            $this->observeLockWait($workerConnectionId, $blockingConnectionId, 'outlets'),
            'outlets',
        );
        OutletInventory::where('outlet_id', $outletId)->lockForUpdate()->firstOrFail()->increment('current_stock', 1);
        $sale->delete();
        $settlement->update([
            'sales_amount' => 0,
            'amount_due' => 0,
            'net_amount' => 0,
            'direction' => Settlement::DIRECTION_OWNER_PAYS,
        ]);
        DB::commit();
        fclose($parentSocket);

        pcntl_waitpid($pid, $status);
        $result = json_decode((string) file_get_contents($resultPath), true);
        @unlink($resultPath);
        $this->assertTrue(pcntl_wifexited($status), json_encode($result));
        $this->assertSame(0, pcntl_wexitstatus($status), json_encode($result));
        DB::purge();
        DB::reconnect();
        $this->assertSame(302, $result['status']);
        $this->assertStringContainsString('Tidak ada tagihan outlet', $result['error']);
        $this->assertStringContainsString('Tidak ada tagihan outlet', $result['error']);
        $this->assertSame(0, SettlementPayment::where('outlet_id', $outletId)->count());
        $this->assertSame(0, OfflineSale::whereKey($saleId)->count());
        $this->assertSame(0, DB::table('outlet_payables')->where('type', 'sale')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(0, DB::table('outlet_payables')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(0, DB::table('stock_movements')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(9, OutletInventory::where('outlet_id', $outletId)->where('product_id', $sale->product_id)->value('current_stock'));
        $settlement->refresh();
        $this->assertSame(0.0, (float) $settlement->amount_due);
        $this->assertSame(0.0, (float) $settlement->paid_amount);
        $this->assertSame(Settlement::DIRECTION_OWNER_PAYS, $settlement->direction);
        $this->assertSame(0, SettlementPayment::where('outlet_id', $outletId)->count());
        $this->assertSame(0, DB::table('settlement_payment_allocations as allocations')
            ->join('settlement_payments as payments', 'payments.id', '=', 'allocations.settlement_payment_id')
            ->where('payments.outlet_id', $outletId)
            ->count());
    }

    public function test_payment_verification_waits_for_recalculation_and_preserves_snapshot(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , , $sale, $settlement] = $this->makeSaleContext();
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        Storage::fake('public');
        $receipt = UploadedFile::fake()->image('receipt.jpg');
        $receiptPath = $receipt->store('payment-proofs', 'public');
        $payment = SettlementPayment::create([
            'outlet_id' => $outlet->id,
            'settlement_id' => $settlement->id,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'reference_number' => 'VERIFY-RACE-'.uniqid(),
            'payment_date' => now()->toDateString(),
            'amount' => 10000,
            'payment_method' => 'transfer_bank',
            'proof_image' => $receiptPath,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
        $outletId = $outlet->id;
        $paymentId = $payment->id;
        $saleId = $sale->id;
        $settlementId = $settlement->id;
        $ownerId = $owner->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'verify-recalc-race-');
        [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        $pid = pcntl_fork();
        if ($pid === 0) {
            fclose($parentSocket);
            try {
                DB::purge();
                DB::reconnect();
                $this->signalWorkerReady($childSocket);
                $this->awaitWorkerGo($childSocket);
                fwrite($childSocket, "attempting\n");
                $response = $this->actingAs(User::findOrFail($ownerId))->post("/owner/finance/settlement-payments/{$paymentId}/verify");
                file_put_contents($resultPath, json_encode(['status' => $response->getStatusCode()]));
                DB::disconnect();
                exit(0);
            } catch (\Throwable $exception) {
                file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()]));
                exit(1);
            }
        }

        $this->assertGreaterThan(0, $pid);
        fclose($childSocket);
        $workerConnectionId = $this->receiveWorkerConnectionId($parentSocket);
        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        $this->signalWorkerGo($parentSocket);
        $this->assertWorkerAttempted($parentSocket);
        $this->assertExpectedLockWait(
            $this->observeLockWait($workerConnectionId, $blockingConnectionId, 'outlets'),
            'outlets',
        );
        OfflineSale::whereKey($saleId)->update(['quantity' => 2, 'total_amount' => 20000, 'gross_amount' => 30000]);
        app(SettlementGeneratorService::class)->recalculateForWeek($outlet, $sale->created_at);
        DB::commit();
        fclose($parentSocket);

        pcntl_waitpid($pid, $status);
        $result = json_decode((string) file_get_contents($resultPath), true);
        @unlink($resultPath);
        $this->assertTrue(pcntl_wifexited($status), json_encode($result));
        $this->assertSame(0, pcntl_wexitstatus($status), json_encode($result));
        DB::purge();
        DB::reconnect();
        $settlement->refresh();
        $payment->refresh();
        $this->assertSame(302, $result['status']);
        $this->assertSame(2, OfflineSale::findOrFail($saleId)->quantity);
        $this->assertSame(10000.0, (float) $settlement->amount_due);
        $this->assertSame(-10000.0, (float) $settlement->net_amount);
        $this->assertSame(0.0, (float) $settlement->paid_amount);
        $this->assertSame(Settlement::STATUS_GENERATED, $settlement->status);
        $this->assertSame(SettlementPayment::STATUS_PENDING, $payment->status);
        $this->assertSame($receiptPath, $payment->proof_image);
        Storage::disk('public')->assertExists($receiptPath);
        $this->assertSame(0, $payment->allocations()->count());
        $this->assertSame(0.0, (float) $payment->allocations()->sum('allocated_amount'));
        $this->assertSame(Settlement::DIRECTION_OUTLET_PAYS, $settlement->direction);
        $this->assertSame(Settlement::DIRECTION_OUTLET_PAYS, $payment->direction);
        $this->assertSame(1, SettlementPayment::where('outlet_id', $outletId)->count());
        $this->assertSame(0, DB::table('settlement_payment_allocations as allocations')
            ->join('settlement_payments as payments', 'payments.id', '=', 'allocations.settlement_payment_id')
            ->join('settlements', 'settlements.id', '=', 'allocations.settlement_id')
            ->whereColumn('payments.direction', '!=', 'settlements.direction')
            ->count());
        $this->assertSame(0, DB::table('stock_movements')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(0, DB::table('outlet_payables')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(8, OutletInventory::where('outlet_id', $outletId)->where('product_id', $sale->product_id)->value('current_stock'));

        $this->assertSame(1, DB::table('settlement_reconciliation_issues')->where('settlement_id', $settlementId)->where('status', 'open')->count());
        $issue = DB::table('settlement_reconciliation_issues')->where('settlement_id', $settlementId)->firstOrFail();
        $sourceSnapshot = json_decode($issue->source_snapshot, true);
        $settlementSnapshot = json_decode($issue->settlement_snapshot, true);
        $this->assertSame(20000.0, (float) $sourceSnapshot['amount_due']);
        $this->assertSame(10000.0, (float) $settlementSnapshot['amount_due']);
        $this->assertSame(20000.0, (float) $sourceSnapshot['sales_amount']);
        $this->assertSame(10000.0, (float) $settlementSnapshot['sales_amount']);
    }

    public function test_issue_created_before_verification_blocks_payment_after_observed_outlet_lock_wait(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , , , $settlement] = $this->makeSaleContext();
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $payment = SettlementPayment::create([
            'outlet_id' => $outlet->id,
            'settlement_id' => $settlement->id,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'reference_number' => 'ISSUE-FIRST-'.uniqid(),
            'payment_date' => now()->toDateString(),
            'amount' => 10000,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
        $outletId = $outlet->id;
        $paymentId = $payment->id;
        $settlementId = $settlement->id;
        $ownerId = $owner->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'issue-before-verify-');
        [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        $pid = pcntl_fork();
        if ($pid === 0) {
            fclose($parentSocket);
            try {
                DB::purge();
                DB::reconnect();
                $this->signalWorkerReady($childSocket);
                $this->awaitWorkerGo($childSocket);
                fwrite($childSocket, "attempting\n");
                try {
                    app(SettlementPaymentService::class)->verifyPayment(
                        SettlementPayment::findOrFail($paymentId),
                        User::findOrFail($ownerId),
                    );
                    file_put_contents($resultPath, json_encode(['blocked' => false]));
                } catch (ValidationException) {
                    file_put_contents($resultPath, json_encode(['blocked' => true]));
                }
                DB::disconnect();
                exit(0);
            } catch (\Throwable $exception) {
                file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()]));
                exit(1);
            }
        }

        $this->assertGreaterThan(0, $pid);
        fclose($childSocket);
        $workerConnectionId = $this->receiveWorkerConnectionId($parentSocket);
        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        $this->signalWorkerGo($parentSocket);
        $this->assertWorkerAttempted($parentSocket);
        $this->assertExpectedLockWait(
            $this->observeLockWait($workerConnectionId, $blockingConnectionId, 'outlets'),
            'outlets',
        );
        SettlementReconciliationIssue::create([
            'settlement_id' => $settlementId,
            'status' => 'open',
            'settlement_snapshot' => ['net_amount' => -10000],
            'source_snapshot' => ['net_amount' => -9000],
            'detected_at' => now(),
        ]);
        DB::commit();
        fclose($parentSocket);

        pcntl_waitpid($pid, $status);
        $result = json_decode((string) file_get_contents($resultPath), true);
        @unlink($resultPath);
        $this->assertTrue(pcntl_wifexited($status), json_encode($result));
        $this->assertSame(0, pcntl_wexitstatus($status), json_encode($result));
        DB::purge();
        DB::reconnect();
        $payment->refresh();
        $settlement->refresh();
        $this->assertTrue($result['blocked']);
        $this->assertSame(SettlementPayment::STATUS_PENDING, $payment->status);
        $this->assertSame(0.0, (float) $settlement->paid_amount);
        $this->assertSame(Settlement::STATUS_GENERATED, $settlement->status);
        $this->assertSame(0, $payment->allocations()->count());
        $this->assertSame(1, DB::table('settlement_reconciliation_issues')->where('settlement_id', $settlementId)->where('status', 'open')->count());
    }

    public function test_verification_committed_before_issue_creation_keeps_payment_verified(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , , , $settlement] = $this->makeSaleContext();
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $payment = SettlementPayment::create([
            'outlet_id' => $outlet->id,
            'settlement_id' => $settlement->id,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'reference_number' => 'VERIFY-FIRST-'.uniqid(),
            'payment_date' => now()->toDateString(),
            'amount' => 10000,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
        $outletId = $outlet->id;
        $paymentId = $payment->id;
        $settlementId = $settlement->id;
        $ownerId = $owner->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'verify-before-issue-');
        [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        $pid = pcntl_fork();
        if ($pid === 0) {
            fclose($parentSocket);
            try {
                DB::purge();
                DB::reconnect();
                $this->signalWorkerReady($childSocket);
                $this->awaitWorkerGo($childSocket);
                fwrite($childSocket, "attempting\n");
                app(SettlementPaymentService::class)->verifyPayment(
                    SettlementPayment::findOrFail($paymentId),
                    User::findOrFail($ownerId),
                );
                file_put_contents($resultPath, json_encode(['verified' => true]));
                DB::disconnect();
                exit(0);
            } catch (\Throwable $exception) {
                file_put_contents($resultPath, json_encode(['error' => $exception->getMessage()]));
                exit(1);
            }
        }

        $this->assertGreaterThan(0, $pid);
        fclose($childSocket);
        $workerConnectionId = $this->receiveWorkerConnectionId($parentSocket);
        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        $this->signalWorkerGo($parentSocket);
        $this->assertWorkerAttempted($parentSocket);
        $this->assertExpectedLockWait(
            $this->observeLockWait($workerConnectionId, $blockingConnectionId, 'outlets'),
            'outlets',
        );
        DB::commit();
        fclose($parentSocket);

        pcntl_waitpid($pid, $status);
        $result = json_decode((string) file_get_contents($resultPath), true);
        @unlink($resultPath);
        $this->assertTrue(pcntl_wifexited($status), json_encode($result));
        $this->assertSame(0, pcntl_wexitstatus($status), json_encode($result));

        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        SettlementReconciliationIssue::create([
            'settlement_id' => $settlementId,
            'status' => 'open',
            'settlement_snapshot' => ['net_amount' => -10000],
            'source_snapshot' => ['net_amount' => -9000],
            'detected_at' => now(),
        ]);
        DB::commit();
        DB::purge();
        DB::reconnect();
        $payment->refresh();
        $settlement->refresh();
        $this->assertTrue($result['verified']);
        $this->assertSame(SettlementPayment::STATUS_VERIFIED, $payment->status);
        $this->assertSame(10000.0, (float) $settlement->paid_amount);
        $this->assertSame(Settlement::STATUS_PAID, $settlement->status);
        $this->assertSame(1, $payment->allocations()->count());
        $this->assertSame(10000.0, (float) $payment->allocations()->sum('allocated_amount'));
        $this->assertSame(1, DB::table('settlement_reconciliation_issues')->where('settlement_id', $settlementId)->where('status', 'open')->count());
    }

    public function test_concurrent_retries_verify_payment_once_and_allocate_once(): void
    {
        $this->requireProductionDatabase();

        [$outlet, , , , $settlement] = $this->makeSaleContext();
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $payment = SettlementPayment::create([
            'outlet_id' => $outlet->id,
            'settlement_id' => $settlement->id,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'reference_number' => 'VERIFY-RETRY-'.bin2hex(random_bytes(6)),
            'payment_date' => now()->toDateString(),
            'amount' => 10000,
            'payment_method' => 'transfer_bank',
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
        $outletId = $outlet->id;
        $paymentId = $payment->id;
        $settlementId = $settlement->id;
        $ownerId = $owner->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'verify-retry-race-');
        $workers = [];
        $sockets = [];
        foreach ([1, 2] as $worker) {
            [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            $pid = pcntl_fork();
            if ($pid === 0) {
                fclose($parentSocket);
                try {
                    DB::purge();
                    DB::reconnect();
                    $this->signalWorkerReady($childSocket);
                    $this->awaitWorkerGo($childSocket);
                    fwrite($childSocket, "attempting\n");
                    app(SettlementPaymentService::class)->verifyPayment(
                        SettlementPayment::findOrFail($paymentId),
                        User::findOrFail($ownerId),
                    );
                    file_put_contents($resultPath, "ok\n", FILE_APPEND | LOCK_EX);
                    DB::disconnect();
                    exit(0);
                } catch (\Throwable $exception) {
                    file_put_contents($resultPath, $exception->getMessage()."\n", FILE_APPEND | LOCK_EX);
                    exit(1);
                }
            }
            $this->assertGreaterThan(0, $pid);
            fclose($childSocket);
            $workers[] = $pid;
            $sockets[] = $parentSocket;
        }

        $workerConnectionIds = [];
        foreach ($sockets as $socket) {
            $workerConnectionIds[] = $this->receiveWorkerConnectionId($socket);
        }

        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        foreach ($sockets as $socket) {
            $this->signalWorkerGo($socket);
            $this->assertWorkerAttempted($socket);
        }
        $this->assertExpectedLockWaits(
            $this->observeLockWaits($workerConnectionIds, $blockingConnectionId, 'outlets'),
            $workerConnectionIds,
            $blockingConnectionId,
            'outlets',
        );
        DB::commit();
        foreach ($sockets as $socket) {
            fclose($socket);
        }
        foreach ($workers as $pid) {
            pcntl_waitpid($pid, $status);
            $output = (string) file_get_contents($resultPath);
            $this->assertTrue(pcntl_wifexited($status), $output);
            $this->assertSame(0, pcntl_wexitstatus($status), $output);
        }

        DB::purge();
        DB::reconnect();
        $payment->refresh();
        $settlement->refresh();
        $this->assertSame(SettlementPayment::STATUS_VERIFIED, $payment->status);
        $this->assertSame(10000.0, (float) $settlement->paid_amount);
        $this->assertSame(Settlement::STATUS_PAID, $settlement->status);
        $this->assertSame(1, $payment->allocations()->count());
        $this->assertSame(10000.0, (float) $payment->allocations()->sum('allocated_amount'));
        $this->assertSame(1, SettlementPayment::where('outlet_id', $outletId)->where('status', SettlementPayment::STATUS_VERIFIED)->count());
        $this->assertSame(0, DB::table('settlement_payment_allocations as allocations')
            ->join('settlement_payments as payments', 'payments.id', '=', 'allocations.settlement_payment_id')
            ->where('payments.id', $paymentId)
            ->where('allocations.settlement_id', '!=', $settlementId)
            ->count());
        @unlink($resultPath);
    }

    public function test_concurrent_sale_edit_and_generation_preserve_final_source_snapshot(): void
    {
        $this->requireProductionDatabase();

        [$outlet, $user, $product, $sale] = $this->makeSaleContext();
        $outletId = $outlet->id;
        $userId = $user->id;
        $saleId = $sale->id;
        $date = $sale->created_at->toDateString();
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'sale-generation-race-');
        $workers = [];
        $sockets = [];
        foreach ([1, 2] as $worker) {
            [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            $pid = pcntl_fork();
            if ($pid === 0) {
                fclose($parentSocket);
                try {
                    DB::purge();
                    DB::reconnect();
                    $this->signalWorkerReady($childSocket);
                    $this->awaitWorkerGo($childSocket);
                    fwrite($childSocket, "attempting\n");
                    if ($worker === 1) {
                        $response = $this->actingAs(User::findOrFail($userId))->put("/outlet/offline-sales/{$saleId}", [
                            'quantity' => 2,
                            'payment_method' => 'cash',
                        ]);
                        if ($response->getStatusCode() !== 302) {
                            throw new \RuntimeException('Sale edit failed with HTTP '.$response->getStatusCode());
                        }
                    } else {
                        app(SettlementGeneratorService::class)->recalculateForWeek(
                            Outlet::findOrFail($outletId),
                            Carbon::parse($date),
                        );
                    }
                    file_put_contents($resultPath, "ok\n", FILE_APPEND | LOCK_EX);
                    DB::disconnect();
                    exit(0);
                } catch (\Throwable $exception) {
                    file_put_contents($resultPath, $exception->getMessage()."\n", FILE_APPEND | LOCK_EX);
                    exit(1);
                }
            }
            $this->assertGreaterThan(0, $pid);
            fclose($childSocket);
            $workers[] = $pid;
            $sockets[] = $parentSocket;
        }

        $workerConnectionIds = [];
        foreach ($sockets as $socket) {
            $workerConnectionIds[] = $this->receiveWorkerConnectionId($socket);
        }

        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        foreach ($sockets as $socket) {
            $this->signalWorkerGo($socket);
            $this->assertWorkerAttempted($socket);
        }
        $this->assertExpectedLockWaits(
            $this->observeLockWaits($workerConnectionIds, $blockingConnectionId, 'outlets'),
            $workerConnectionIds,
            $blockingConnectionId,
            'outlets',
        );
        DB::commit();
        foreach ($sockets as $socket) {
            fclose($socket);
        }
        foreach ($workers as $pid) {
            pcntl_waitpid($pid, $status);
            $output = (string) file_get_contents($resultPath);
            $this->assertTrue(pcntl_wifexited($status), $output);
            $this->assertSame(0, pcntl_wexitstatus($status), $output);
        }

        DB::purge();
        DB::reconnect();
        $sale->refresh();
        $settlement = Settlement::where('outlet_id', $outletId)
            ->where('period_type', 'weekly')
            ->whereDate('period_start', Carbon::parse($date)->startOfWeek()->toDateString())
            ->firstOrFail();
        $this->assertSame(2, $sale->quantity);
        $this->assertSame(7, OutletInventory::where('outlet_id', $outletId)->where('product_id', $product->id)->value('current_stock'));
        $this->assertSame(20000.0, (float) $settlement->total_offline_sales);
        $this->assertSame(20000.0, (float) $settlement->sales_amount);
        $this->assertSame(-20000.0, (float) $settlement->net_amount);
        $this->assertSame(Settlement::DIRECTION_OUTLET_PAYS, $settlement->direction);
        $this->assertSame(1, DB::table('stock_movements')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(1, DB::table('outlet_payables')->where('type', 'sale')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $this->assertSame(1, DB::table('outlet_payables')->where('type', 'adjustment')->where('reference_type', OfflineSale::class)->where('reference_id', $saleId)->count());
        $issues = DB::table('settlement_reconciliation_issues')->where('settlement_id', $settlement->id)->get();
        $this->assertCount(0, $issues, json_encode($issues));
        @unlink($resultPath);
    }

    public function test_concurrent_outlet_payment_submissions_create_only_one_pending_payment(): void
    {
        $this->requireProductionDatabase();

        [$outlet, $user, , , $settlement] = $this->makeSaleContext();
        $outletId = $outlet->id;
        $userId = $user->id;
        $settlementId = $settlement->id;
        DB::commit();
        DB::purge();
        DB::reconnect();

        $resultPath = tempnam(sys_get_temp_dir(), 'payment-submit-race-');
        $workers = [];
        $sockets = [];
        foreach ([1, 2] as $worker) {
            [$parentSocket, $childSocket] = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            $pid = pcntl_fork();
            if ($pid === 0) {
                fclose($parentSocket);
                try {
                    DB::purge();
                    DB::reconnect();
                    $this->signalWorkerReady($childSocket);
                    $this->awaitWorkerGo($childSocket);
                    fwrite($childSocket, "attempting\n");
                    $response = $this->actingAs(User::findOrFail($userId))->post('/outlet/settlement-payments', [
                        'amount' => 10000,
                        'reference_number' => 'SUBMIT-RACE-'.$worker.'-'.bin2hex(random_bytes(4)),
                        'payment_date' => now()->toDateString(),
                    ]);
                    file_put_contents($resultPath, $response->getStatusCode()."\n", FILE_APPEND | LOCK_EX);
                    DB::disconnect();
                    exit(0);
                } catch (\Throwable $exception) {
                    file_put_contents($resultPath, 'error: '.$exception->getMessage()."\n", FILE_APPEND | LOCK_EX);
                    exit(1);
                }
            }
            $this->assertGreaterThan(0, $pid);
            fclose($childSocket);
            $workers[] = $pid;
            $sockets[] = $parentSocket;
        }

        $workerConnectionIds = [];
        foreach ($sockets as $socket) {
            $workerConnectionIds[] = $this->receiveWorkerConnectionId($socket);
        }

        DB::beginTransaction();
        Outlet::lockForSettlement($outletId);
        $blockingConnectionId = $this->workerConnectionId();
        foreach ($sockets as $socket) {
            $this->signalWorkerGo($socket);
            $this->assertWorkerAttempted($socket);
        }
        $this->assertExpectedLockWaits(
            $this->observeLockWaits($workerConnectionIds, $blockingConnectionId, 'outlets'),
            $workerConnectionIds,
            $blockingConnectionId,
            'outlets',
        );
        DB::commit();
        foreach ($sockets as $socket) {
            fclose($socket);
        }
        foreach ($workers as $pid) {
            pcntl_waitpid($pid, $status);
            $output = (string) file_get_contents($resultPath);
            $this->assertTrue(pcntl_wifexited($status), $output);
            $this->assertSame(0, pcntl_wexitstatus($status), $output);
        }

        DB::purge();
        DB::reconnect();
        $payments = SettlementPayment::where('outlet_id', $outletId)->get();
        $this->assertCount(1, $payments);
        $this->assertSame(SettlementPayment::STATUS_PENDING, $payments->first()->status);
        $this->assertSame($settlementId, $payments->first()->settlement_id);
        $this->assertSame(0, DB::table('settlement_payment_allocations')->whereIn('settlement_payment_id', $payments->pluck('id'))->count());
        @unlink($resultPath);
    }

    private function workerConnectionId(): int
    {
        return (int) DB::selectOne('SELECT CONNECTION_ID() AS connection_id')->connection_id;
    }

    private function signalWorkerReady($socket): void
    {
        fwrite($socket, json_encode(['ready' => true, 'connection_id' => $this->workerConnectionId()])."\n");
    }

    private function awaitWorkerGo($socket): void
    {
        stream_set_timeout($socket, 10);
        $this->assertSame('go', trim((string) fgets($socket)), 'Coordinator did not release worker.');
    }

    private function receiveWorkerConnectionId($socket): int
    {
        stream_set_timeout($socket, 10);
        $message = json_decode((string) fgets($socket), true);
        $this->assertIsArray($message, 'Worker did not report ready state.');
        $this->assertTrue($message['ready'] ?? false, 'Worker did not report ready state.');
        $this->assertArrayHasKey('connection_id', $message);

        return (int) $message['connection_id'];
    }

    private function signalWorkerGo($socket): void
    {
        fwrite($socket, "go\n");
    }

    private function assertWorkerAttempted($socket): void
    {
        stream_set_timeout($socket, 10);
        $this->assertSame('attempting', trim((string) fgets($socket)), 'Worker did not reach competing operation.');
    }

    private function observeLockWaits(array $waitingConnectionIds, int $blockingConnectionId, string $table): array
    {
        $config = DB::connection()->getConfig();
        config(['database.connections.lock_observer' => $config]);
        DB::purge('lock_observer');
        $observer = DB::connection('lock_observer');
        $deadline = microtime(true) + 10;
        $waits = [];

        do {
            $placeholders = implode(',', array_fill(0, count($waitingConnectionIds), '?'));
            $waits = $observer->select(<<<SQL
                SELECT
                    requesting_thread.PROCESSLIST_ID AS waiting_connection_id,
                    blocking_thread.PROCESSLIST_ID AS blocking_connection_id,
                    requesting_lock.OBJECT_SCHEMA AS object_schema,
                    requesting_lock.OBJECT_NAME AS object_name,
                    requesting_lock.INDEX_NAME AS index_name,
                    requesting_lock.LOCK_TYPE AS lock_type,
                    requesting_lock.LOCK_MODE AS lock_mode,
                    requesting_lock.LOCK_STATUS AS lock_status,
                    blocking_lock.LOCK_STATUS AS blocking_lock_status
                FROM performance_schema.data_lock_waits AS waits
                JOIN performance_schema.threads AS requesting_thread
                  ON requesting_thread.THREAD_ID = waits.REQUESTING_THREAD_ID
                JOIN performance_schema.threads AS blocking_thread
                  ON blocking_thread.THREAD_ID = waits.BLOCKING_THREAD_ID
                JOIN performance_schema.data_locks AS requesting_lock
                  ON requesting_lock.ENGINE_LOCK_ID = waits.REQUESTING_ENGINE_LOCK_ID
                 AND requesting_lock.ENGINE = waits.ENGINE
                JOIN performance_schema.data_locks AS blocking_lock
                  ON blocking_lock.ENGINE_LOCK_ID = waits.BLOCKING_ENGINE_LOCK_ID
                 AND blocking_lock.ENGINE = waits.ENGINE
                WHERE requesting_thread.PROCESSLIST_ID IN ({$placeholders})
                  AND blocking_thread.PROCESSLIST_ID = ?
                  AND requesting_lock.OBJECT_SCHEMA = DATABASE()
                  AND requesting_lock.OBJECT_NAME = ?
                  AND requesting_lock.LOCK_STATUS = 'WAITING'
                  AND blocking_lock.LOCK_STATUS = 'GRANTED'
                SQL, [...$waitingConnectionIds, $blockingConnectionId, $table]);

            if (count($waits) >= count($waitingConnectionIds)) {
                return $waits;
            }

            usleep(10000);
        } while (microtime(true) < $deadline);

        return $waits;
    }

    private function observeLockWait(int $waitingConnectionId, int $blockingConnectionId, string $table): ?object
    {
        return $this->observeLockWaits([$waitingConnectionId], $blockingConnectionId, $table)[0] ?? null;
    }

    private function assertExpectedLockWaits(array $waits, array $waitingConnectionIds, int $blockingConnectionId, string $table): void
    {
        $this->assertCount(count($waitingConnectionIds), $waits, "MySQL did not report every expected InnoDB lock wait on {$table}.");

        $actualWaiters = array_map(static fn (object $wait): int => (int) $wait->waiting_connection_id, $waits);
        sort($actualWaiters);
        sort($waitingConnectionIds);
        $this->assertSame($waitingConnectionIds, $actualWaiters);

        foreach ($waits as $wait) {
            $this->assertSame($blockingConnectionId, (int) $wait->blocking_connection_id);
            $this->assertSame($table, $wait->object_name);
            $this->assertSame('WAITING', $wait->lock_status);
            $this->assertSame('GRANTED', $wait->blocking_lock_status);
        }
    }

    private function assertExpectedLockWait(?object $wait, string $table): void
    {
        $this->assertNotNull($wait, "MySQL did not report the expected InnoDB lock wait on {$table}.");
        $this->assertSame($table, $wait->object_name);
        $this->assertSame('WAITING', $wait->lock_status);
        $this->assertSame('GRANTED', $wait->blocking_lock_status);
    }

    private function makeSaleContext(bool $withSettlement = true): array
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id, 'is_active' => true, 'must_change_password' => false]);
        $product = Product::factory()->create([
            'center_price' => 10000,
            'sku' => 'CONCURRENCY-'.bin2hex(random_bytes(8)),
        ]);
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 8,
            'reserved_stock' => 0,
        ]);
        $sale = OfflineSale::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'center_price' => 10000,
            'selling_price_snapshot' => 15000,
            'gross_amount' => 15000,
            'total_amount' => 10000,
            'payment_method' => 'cash',
            'created_by' => $user->id,
        ]);
        $settlement = $withSettlement ? Settlement::create([
            'outlet_id' => $outlet->id,
            'period_date' => $sale->created_at->copy()->startOfWeek()->toDateString(),
            'period_start' => $sale->created_at->copy()->startOfWeek()->toDateString(),
            'period_end' => $sale->created_at->copy()->endOfWeek()->toDateString(),
            'period_type' => 'weekly',
            'sales_amount' => 10000,
            'amount_due' => 10000,
            'total_offline_sales' => 10000,
            'net_amount' => -10000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'due_date' => now()->addWeek()->toDateString(),
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
            'adjustment_amount' => 0,
        ]) : null;

        return [$outlet, $user, $product, $sale, $settlement];
    }

    private function requireProductionDatabase(): void
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();
        if ($driver === 'sqlite') {
            if (filter_var(getenv('CI'), FILTER_VALIDATE_BOOLEAN)) {
                $this->fail('Settlement concurrency gate requires MySQL 8 in CI.');
            }
            $this->markTestSkipped('SQLite does not provide production-driver row-lock concurrency.');
        }

        $this->assertSame('mysql', $driver, 'Settlement lock-wait instrumentation requires MySQL 8.');
        $this->assertStringStartsWith('8.', (string) $connection->selectOne('SELECT VERSION() AS version')->version);
        $this->assertSame(1, (int) $connection->selectOne('SELECT @@performance_schema AS enabled')->enabled);
        $this->assertTrue(function_exists('pcntl_fork'), 'pcntl is required for independent-process concurrency tests.');

        try {
            $connection->select('SELECT THREAD_ID FROM performance_schema.threads LIMIT 1');
            $connection->select('SELECT ENGINE_LOCK_ID FROM performance_schema.data_locks LIMIT 1');
            $connection->select('SELECT REQUESTING_THREAD_ID FROM performance_schema.data_lock_waits LIMIT 1');
        } catch (\Throwable $exception) {
            $this->fail('Performance Schema lock-wait visibility is required: '.$exception->getMessage());
        }
    }
}
