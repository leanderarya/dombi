<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE stock_movements MODIFY COLUMN type ENUM('initial_stock','stock_adjustment','order_reserved','order_completed','order_cancelled','restock_in','delivery_returned','return_out','return_in','distribution_out','exchange_in','exchange_out','stock_opname','offline_sale','in_transit') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE stock_movements MODIFY COLUMN type ENUM('initial_stock','stock_adjustment','order_reserved','order_completed','order_cancelled','restock_in','delivery_returned','return_out','return_in','distribution_out','exchange_in','exchange_out','stock_opname','offline_sale') NOT NULL");
    }
};
