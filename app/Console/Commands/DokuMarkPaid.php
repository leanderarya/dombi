<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use Illuminate\Console\Command;

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

        if ($order->payment_status === 'paid') {
            $this->info("Order {$orderCode} is already paid");

            return self::SUCCESS;
        }

        $order->update(['payment_status' => 'paid', 'paid_at' => now()]);

        $tx = PaymentTransaction::where('doku_order_id', $orderCode)->first();
        if ($tx) {
            $tx->update(['status' => 'paid']);
        }

        // Trigger side effects (notifications, status change)
        app(DokuService::class)->processPaymentStatusChange($order, 'paid');

        $this->info("Order {$orderCode} marked as paid");

        return self::SUCCESS;
    }
}
