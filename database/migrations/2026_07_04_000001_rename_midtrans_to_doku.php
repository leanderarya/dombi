<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->renameColumn('midtrans_order_id', 'doku_order_id');
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->renameColumn('midtrans_order_id', 'doku_order_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->renameColumn('doku_order_id', 'midtrans_order_id');
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->renameColumn('doku_order_id', 'midtrans_order_id');
        });
    }
};
