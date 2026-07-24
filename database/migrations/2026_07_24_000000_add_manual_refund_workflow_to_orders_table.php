<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('refund_destination_type')->nullable();
            $table->text('refund_bank_name')->nullable();
            $table->text('refund_account_number')->nullable();
            $table->text('refund_account_holder')->nullable();
            $table->text('refund_ewallet_provider')->nullable();
            $table->text('refund_ewallet_number')->nullable();
            $table->text('refund_ewallet_holder')->nullable();
            $table->timestamp('refund_destination_submitted_at')->nullable();
            $table->timestamp('refund_started_at')->nullable();
            $table->foreignId('refund_started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('refund_transfer_reference')->nullable();
            $table->text('refund_transfer_note')->nullable();
            $table->timestamp('refund_rejected_at')->nullable();
            $table->foreignId('refund_rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('refund_rejection_note')->nullable();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', [
                'pending', 'paid', 'settled', 'expired', 'failed',
                'refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed',
            ])->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('orders')
            ->where('payment_status', 'refund_in_progress')
            ->update(['payment_status' => 'refund_pending']);

        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', [
                'pending', 'paid', 'settled', 'expired', 'failed',
                'refund_pending', 'refunded', 'refund_rejected', 'refund_failed',
            ])->nullable()->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['refund_started_by']);
            $table->dropForeign(['refund_rejected_by']);
            $table->dropColumn([
                'refund_destination_type',
                'refund_bank_name',
                'refund_account_number',
                'refund_account_holder',
                'refund_ewallet_provider',
                'refund_ewallet_number',
                'refund_ewallet_holder',
                'refund_destination_submitted_at',
                'refund_started_at',
                'refund_started_by',
                'refund_transfer_reference',
                'refund_transfer_note',
                'refund_rejected_at',
                'refund_rejected_by',
                'refund_rejection_note',
            ]);
        });
    }
};
