<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('refund_obligations') || ! Schema::hasTable('payment_attempts')) {
            return;
        }

        $refunds = DB::table('orders')
            ->whereIn('payment_status', ['refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed'])
            ->whereNotNull('refund_amount')
            ->where('refund_amount', '>', 0)
            ->get(['id', 'payment_status', 'refund_amount', 'refund_destination_type', 'refund_bank_name', 'refund_account_number', 'refund_account_holder', 'refund_ewallet_provider', 'refund_ewallet_number', 'refund_ewallet_holder', 'refund_destination_submitted_at', 'refund_transfer_reference', 'refund_transfer_note', 'refund_proof_image', 'refunded_by', 'refunded_at']);

        foreach ($refunds as $refund) {
            $attempt = DB::table('payment_attempts')
                ->where('order_id', $refund->id)
                ->where('amount_snapshot', '>', 0)
                ->orderByDesc('id')
                ->first();

            if (! $attempt) {
                logger()->warning('Refund obligation backfill skipped unmappable order.', ['order_id' => $refund->id]);

                continue;
            }

            $status = match ($refund->payment_status ?? null) {
                'refunded' => 'completed',
                'refund_in_progress' => 'in_progress',
                'refund_rejected' => 'rejected',
                'refund_failed' => 'failed',
                default => 'pending',
            };

            DB::table('refund_obligations')->insertOrIgnore([
                'payment_attempt_id' => $attempt->id,
                'amount' => $refund->refund_amount,
                'currency' => $attempt->currency_snapshot,
                'reason' => $refund->refund_reason ?: 'historical_refund',
                'status' => $status,
                'destination_type' => $refund->refund_destination_type,
                'bank_name' => $refund->refund_bank_name,
                'account_number' => $refund->refund_account_number,
                'account_holder' => $refund->refund_account_holder,
                'ewallet_provider' => $refund->refund_ewallet_provider,
                'ewallet_number' => $refund->refund_ewallet_number,
                'ewallet_holder' => $refund->refund_ewallet_holder,
                'destination_submitted_at' => $refund->refund_destination_submitted_at,
                'transfer_reference' => $refund->refund_transfer_reference,
                'transfer_note' => $refund->refund_transfer_note,
                'proof_image' => $refund->refund_proof_image,
                'processed_by' => $refund->refunded_by,
                'processed_at' => $refund->refunded_at,
                'metadata' => json_encode(['backfilled_from_order_id' => $refund->id]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void {}
};
