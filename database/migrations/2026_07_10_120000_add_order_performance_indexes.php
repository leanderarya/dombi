<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            // Expire-pending query: WHERE status = 'pending_confirmation' AND confirmation_expires_at < NOW()
            $table->index(['status', 'confirmation_expires_at'], 'idx_orders_expire_pending');

            // Stale resolution: WHERE status IN (...) AND updated_at < ...
            $table->index(['status', 'updated_at'], 'idx_orders_stale_resolution');

            // Owner filter: WHERE status = ? AND payment_status = ?
            $table->index(['status', 'payment_status'], 'idx_orders_status_payment');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex('idx_orders_expire_pending');
            $table->dropIndex('idx_orders_stale_resolution');
            $table->dropIndex('idx_orders_status_payment');
        });
    }
};
