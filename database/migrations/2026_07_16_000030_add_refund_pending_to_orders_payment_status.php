<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL requires the full new enum set when altering an enum column.
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', [
                'pending', 'paid', 'settled', 'expired', 'failed',
                'refund_pending', 'refunded', 'refund_rejected', 'refund_failed',
            ])->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', [
                'pending', 'paid', 'settled', 'expired', 'failed',
                'refunded', 'refund_failed',
            ])->nullable()->change();
        });
    }
};
