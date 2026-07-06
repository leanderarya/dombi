<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\OutletPayable;
use App\Models\Settlement;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SettlementService
{
    /**
     * Record a sale payable when an order is completed.
     * Writes to outlet_payables as audit trail only.
     */
    public function recordSale(Order $order): void
    {
        if ($order->status !== 'completed') {
            return;
        }

        $centerShare = $order->items->sum(fn (OrderItem $item) => (float) $item->center_price_snapshot * $item->quantity);
        $outletMargin = $order->items->sum(fn (OrderItem $item) => (float) $item->outlet_margin_snapshot * $item->quantity);

        OutletPayable::create([
            'outlet_id' => $order->outlet_id,
            'order_id' => $order->id,
            'type' => 'sale',
            'amount' => (float) $order->total,
            'center_share' => $centerShare,
            'outlet_margin' => $outletMargin,
            'due_date' => now()->endOfWeek(Carbon::SUNDAY)->addDays(7)->toDateString(),
            'paid_amount' => 0,
            'remaining_amount' => $centerShare,
            'notes' => "Penjualan order {$order->order_code}",
        ]);
    }

    /**
     * Get the outstanding payable for an outlet (from settlements table).
     */
    public function getOutstandingPayable(int $outletId): float
    {
        return (float) Settlement::where('outlet_id', $outletId)
            ->where('period_type', 'weekly')
            ->sum(DB::raw('amount_due - paid_amount - adjustment_amount'));
    }
}
