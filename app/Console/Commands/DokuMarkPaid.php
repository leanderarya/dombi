<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DokuMarkPaid extends Command
{
    protected $signature = 'doku:mark-paid {order_code}';

    protected $description = 'Manually mark a Doku order as paid (sandbox workaround)';

    public function handle(): int
    {
        $orderCode = $this->argument('order_code');
        $order = Order::where('order_code', $orderCode)->first();

        if (! $order) {
            $this->error("Order {$orderCode} not found");

            return self::FAILURE;
        }

        if (in_array($order->payment_status, ['refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed', 'settled'], true)) {
            $this->error('Payment status tidak dapat ditandai paid.');

            return self::FAILURE;
        }

        if ($order->payment_status === 'paid') {
            $this->info("Order {$orderCode} is already paid");

            return self::SUCCESS;
        }

        try {
            DB::transaction(function () use ($order) {
                $locked = Order::lockForUpdate()
                    ->with('paymentTransactions')
                    ->findOrFail($order->id);

                $transaction = $locked->paymentTransactions
                    ->whereIn('status', ['pending', 'failed'])
                    ->sortByDesc('created_at')
                    ->first();

                if (! $transaction || (float) $transaction->amount <= 0) {
                    throw new \RuntimeException('No valid transaction found');
                }

                $transaction->update(['status' => 'paid']);

                app(DokuService::class)->processPaymentStatusChange($locked, 'paid');

                $locked->refresh();

                if (! in_array($locked->payment_status, ['paid', 'refund_pending'], true)) {
                    throw new \RuntimeException('Payment status change did not result in expected state');
                }
            });

            $this->info("Order {$orderCode} marked as paid");

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error("Failed to mark order as paid: {$e->getMessage()}");

            return self::FAILURE;
        }
    }
}
