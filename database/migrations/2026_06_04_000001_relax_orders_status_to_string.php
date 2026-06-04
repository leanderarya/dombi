<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE orders MODIFY status VARCHAR(50) NOT NULL DEFAULT 'pending_confirmation'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("
            ALTER TABLE orders MODIFY status ENUM(
                'pending',
                'pending_confirmation',
                'confirmed',
                'preparing',
                'ready_for_pickup',
                'picked_up',
                'delivering',
                'completed',
                'cancelled',
                'cancelled_by_customer',
                'rejected_by_outlet',
                'failed',
                'failed_delivery',
                'expired'
            ) NOT NULL DEFAULT 'pending_confirmation'
        ");
    }
};
