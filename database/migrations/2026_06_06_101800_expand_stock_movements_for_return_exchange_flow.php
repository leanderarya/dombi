<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("
            ALTER TABLE stock_movements
            MODIFY type ENUM(
                'initial_stock',
                'stock_adjustment',
                'order_reserved',
                'order_completed',
                'order_cancelled',
                'restock_in',
                'delivery_returned',
                'return_out',
                'exchange_in'
            ) NOT NULL
        ");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("
            ALTER TABLE stock_movements
            MODIFY type ENUM(
                'initial_stock',
                'stock_adjustment',
                'order_reserved',
                'order_completed',
                'order_cancelled',
                'restock_in',
                'delivery_returned'
            ) NOT NULL
        ");
    }
};
