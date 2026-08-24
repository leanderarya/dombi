<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        if (! in_array(DB::getDriverName(), ['mysql', 'pgsql'], true)) {
            throw new RuntimeException('Task 12 requires MySQL or PostgreSQL for order_completed uniqueness.');
        }

        if (DB::getDriverName() === 'mysql') {
            Schema::table('stock_movements', function (Blueprint $table): void {
                $table->string('order_completed_key')->nullable();
            });
            DB::statement("CREATE TRIGGER stock_movements_order_completed_key_insert BEFORE INSERT ON stock_movements FOR EACH ROW SET NEW.order_completed_key = IF(NEW.type = 'order_completed', CONCAT(NEW.reference_type, ':', NEW.reference_id, ':', NEW.product_id), NULL)");
            DB::statement("CREATE TRIGGER stock_movements_order_completed_key_update BEFORE UPDATE ON stock_movements FOR EACH ROW SET NEW.order_completed_key = IF(NEW.type = 'order_completed', CONCAT(NEW.reference_type, ':', NEW.reference_id, ':', NEW.product_id), NULL)");
            DB::statement('CREATE UNIQUE INDEX stock_movements_order_completed_unique ON stock_movements (order_completed_key)');
        } elseif (DB::getDriverName() === 'pgsql') {
            DB::statement("CREATE UNIQUE INDEX stock_movements_order_completed_unique ON stock_movements (reference_type, reference_id, product_id) WHERE type = 'order_completed'");
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_claim_consistency CHECK ((fulfilment_claimed_at IS NULL AND fulfilment_claimed_by IS NULL) OR (fulfilment_claimed_at IS NOT NULL AND fulfilment_claimed_by IS NOT NULL))');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP TRIGGER IF EXISTS stock_movements_order_completed_key_update');
            DB::statement('DROP TRIGGER IF EXISTS stock_movements_order_completed_key_insert');
            DB::statement('DROP INDEX stock_movements_order_completed_unique ON stock_movements');
            Schema::table('stock_movements', function (Blueprint $table): void {
                $table->dropColumn('order_completed_key');
            });
        } elseif (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX stock_movements_order_completed_unique');
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders DROP CONSTRAINT orders_fulfilment_claim_consistency');
        }
    }
};
