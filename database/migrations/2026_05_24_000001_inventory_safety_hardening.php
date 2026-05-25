<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add before/after reserved stock tracking to stock_movements
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->integer('before_reserved')->nullable()->after('after_stock');
            $table->integer('after_reserved')->nullable()->after('before_reserved');
        });

        // Add delivery resolution fields
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->string('resolution_status')->nullable()->after('failed_reason');
            $table->text('resolution_notes')->nullable()->after('resolution_status');
            $table->foreignId('resolved_by')->nullable()->after('resolution_notes')->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable()->after('resolved_by');
        });

        // Add unique constraint on deliveries.order_id
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->unique('order_id');
        });

        // Expand delivery status enum to include resolution statuses
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE deliveries MODIFY status ENUM('waiting_assignment', 'waiting_pickup', 'picked_up', 'delivering', 'completed', 'failed', 'retry_delivery', 'returned_to_outlet', 'cancelled_and_released') NOT NULL DEFAULT 'waiting_assignment'");
        }

        // Expand stock_movements type enum
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE stock_movements MODIFY type ENUM('initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed', 'order_cancelled', 'restock_in', 'delivery_returned') NOT NULL");
        }
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropUnique(['order_id']);
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropForeign(['resolved_by']);
            $table->dropColumn(['resolution_status', 'resolution_notes', 'resolved_by', 'resolved_at']);
        });

        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropColumn(['before_reserved', 'after_reserved']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE deliveries MODIFY status ENUM('waiting_assignment', 'waiting_pickup', 'picked_up', 'delivering', 'completed', 'failed') NOT NULL DEFAULT 'waiting_assignment'");
            DB::statement("ALTER TABLE stock_movements MODIFY type ENUM('initial_stock', 'stock_adjustment', 'order_reserved', 'order_completed', 'order_cancelled', 'restock_in') NOT NULL");
        }
    }
};
