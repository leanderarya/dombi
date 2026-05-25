<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->index(['status', 'created_at']);
            $table->index(['outlet_id', 'status']);
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->index(['courier_id', 'status']);
        });

        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->index(['outlet_id', 'created_at']);
            $table->index(['product_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex(['status', 'created_at']);
            $table->dropIndex(['outlet_id', 'status']);
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropIndex(['courier_id', 'status']);
        });

        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropIndex(['outlet_id', 'created_at']);
            $table->dropIndex(['product_id', 'created_at']);
        });
    }
};
