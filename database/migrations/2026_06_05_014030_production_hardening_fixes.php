<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // C4: Add rejected_by_courier to deliveries ENUM
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE deliveries MODIFY status ENUM('waiting_assignment','waiting_pickup','picked_up','delivering','completed','failed','retry_delivery','returned_to_outlet','cancelled_and_released','rejected_by_courier') NOT NULL DEFAULT 'waiting_assignment'");
        }

        // D4/D15: Add index for ExpirePendingOrders scheduler query
        Schema::table('orders', function (Blueprint $table): void {
            $table->index(['status', 'confirmation_expires_at'], 'orders_status_expires_at_index');
        });

        // D5: Add index on users.role
        Schema::table('users', function (Blueprint $table): void {
            $table->index('role', 'users_role_index');
        });

        // D6: Add composite index for courier availability queries
        Schema::table('users', function (Blueprint $table): void {
            $table->index(['role', 'is_online', 'is_active'], 'users_role_online_active_index');
        });

        // D1/D8: Add index on delivery_resolution_logs.delivery_id
        Schema::table('delivery_resolution_logs', function (Blueprint $table): void {
            $table->index('delivery_id', 'delivery_resolution_logs_delivery_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('delivery_resolution_logs', function (Blueprint $table): void {
            $table->dropIndex('delivery_resolution_logs_delivery_id_index');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_role_online_active_index');
            $table->dropIndex('users_role_index');
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex('orders_status_expires_at_index');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE deliveries MODIFY status ENUM('waiting_assignment','waiting_pickup','picked_up','delivering','completed','failed','retry_delivery','returned_to_outlet','cancelled_and_released') NOT NULL DEFAULT 'waiting_assignment'");
        }
    }
};
