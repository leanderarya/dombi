<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerCredit;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

class CustomerCreditService
{
    /**
     * Refund order total to customer credit.
     * Called when paid order is rejected/cancelled.
     */
    public function refund(Order $order): CustomerCredit
    {
        if ($order->payment_status !== 'paid') {
            throw new \InvalidArgumentException('Cannot refund unpaid order');
        }

        return DB::transaction(function () use ($order) {
            $customer = Customer::where('id', $order->customer_id)->lockForUpdate()->first();
            $balanceBefore = (float) $customer->credit_balance;
            $refundAmount = (float) $order->total;

            $customer->update([
                'credit_balance' => $balanceBefore + $refundAmount,
            ]);

            return CustomerCredit::create([
                'customer_id' => $customer->id,
                'order_id' => $order->id,
                'amount' => $refundAmount,
                'type' => 'refund',
                'balance_after' => $customer->fresh()->credit_balance,
                'notes' => "Refund order #{$order->order_code}",
            ]);
        });
    }

    /**
     * Apply credit to an order during checkout.
     * Returns the amount applied.
     */
    public function applyToOrder(Order $order, Customer $customer): float
    {
        return DB::transaction(function () use ($order, $customer) {
            $locked = Customer::where('id', $customer->id)->lockForUpdate()->first();
            $creditBalance = (float) $locked->credit_balance;
            $orderTotal = (float) $order->total;

            if ($creditBalance <= 0) {
                return 0;
            }

            $applied = min($creditBalance, $orderTotal);

            $locked->update([
                'credit_balance' => $creditBalance - $applied,
            ]);

            $order->update([
                'credit_applied' => $applied,
            ]);

            CustomerCredit::create([
                'customer_id' => $locked->id,
                'order_id' => $order->id,
                'amount' => -$applied,
                'type' => 'refund',
                'balance_after' => $locked->fresh()->credit_balance,
                'notes' => "Kredit dipakai untuk order #{$order->order_code}",
            ]);

            return $applied;
        });
    }

    /**
     * Get customer's current credit balance.
     */
    public function getBalance(Customer $customer): float
    {
        return (float) $customer->credit_balance;
    }
}
