<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->unique(['reference_type', 'reference_id', 'product_id', 'type'], 'stock_movements_order_completed_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_claim_consistency CHECK ((fulfilment_claimed_at IS NULL AND fulfilment_claimed_by IS NULL) OR (fulfilment_claimed_at IS NOT NULL AND fulfilment_claimed_by IS NOT NULL))');
        }
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropUnique('stock_movements_order_completed_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders DROP CONSTRAINT orders_fulfilment_claim_consistency');
        }
    }
};
