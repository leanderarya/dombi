<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE stock_movements MODIFY type ENUM('initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed', 'order_cancelled', 'restock_in', 'delivery_returned', 'stock_opname') NOT NULL");
        }
        // SQLite doesn't support ENUM - type column is varchar in SQLite tests
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE stock_movements MODIFY type ENUM('initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed', 'order_cancelled', 'restock_in', 'delivery_returned') NOT NULL");
        }
    }
};
