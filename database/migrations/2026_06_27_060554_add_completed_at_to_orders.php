<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('completed_at')->nullable()->after('expired_at');
        });

        // Backfill: set completed_at from status_histories where status became 'completed'
        // SQLite does not support UPDATE ... FROM with table aliases
        if (config('database.default') === 'sqlite') {
            DB::statement("
                UPDATE orders
                SET completed_at = (
                    SELECT MIN(sh.created_at)
                    FROM order_status_histories sh
                    WHERE sh.order_id = orders.id AND sh.to_status = 'completed'
                )
                WHERE orders.status = 'completed' AND orders.completed_at IS NULL
            ");
        } else {
            DB::statement("
                UPDATE orders o
                SET completed_at = (
                    SELECT MIN(sh.created_at)
                    FROM order_status_histories sh
                    WHERE sh.order_id = o.id AND sh.to_status = 'completed'
                )
                WHERE o.status = 'completed' AND o.completed_at IS NULL
            ");
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });
    }
};
