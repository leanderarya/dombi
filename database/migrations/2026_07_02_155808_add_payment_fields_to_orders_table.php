<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', ['pending', 'paid', 'settled', 'expired', 'failed'])->nullable()->after('payment_method');
            $table->string('midtrans_order_id')->nullable()->unique()->after('payment_status');
            $table->timestamp('paid_at')->nullable()->after('midtrans_order_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'midtrans_order_id', 'paid_at']);
        });
    }
};
