<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->enum('type', [
                'initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed',
                'order_cancelled', 'restock_in', 'distribution_out', 'delivery_returned',
                'offline_sale',
            ])->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->enum('type', [
                'initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed',
                'order_cancelled', 'restock_in', 'distribution_out', 'delivery_returned',
            ])->change();
        });
    }
};
