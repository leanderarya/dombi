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
            $duplicates = DB::table('stock_movements')
                ->selectRaw("CONCAT(reference_type, ':', reference_id, ':', product_id) AS movement_key, COUNT(*) AS movement_count")
                ->where('type', 'order_completed')
                ->groupBy('reference_type', 'reference_id', 'product_id')
                ->having('movement_count', '>', 1)
                ->get();
            if ($duplicates->isNotEmpty()) {
                $details = $duplicates->map(fn ($duplicate): string => "{$duplicate->movement_key} ({$duplicate->movement_count})")->implode(', ');
                throw new RuntimeException("Cannot add order_completed uniqueness; duplicate movement keys require reconciliation: {$details}");
            }
            if (! Schema::hasColumn('stock_movements', 'order_completed_key')) {
                Schema::table('stock_movements', function (Blueprint $table): void {
                    $table->string('order_completed_key')->nullable();
                });
            }
            DB::statement("UPDATE stock_movements SET order_completed_key = CONCAT(reference_type, ':', reference_id, ':', product_id) WHERE type = 'order_completed'");
            DB::statement('DROP TRIGGER IF EXISTS stock_movements_order_completed_key_update');
            DB::statement('DROP TRIGGER IF EXISTS stock_movements_order_completed_key_insert');
            if (collect(Schema::getIndexes('stock_movements'))->contains(fn (array $index): bool => $index['name'] === 'stock_movements_order_completed_unique')) {
                DB::statement('DROP INDEX stock_movements_order_completed_unique ON stock_movements');
            }
            DB::statement("CREATE TRIGGER stock_movements_order_completed_key_insert BEFORE INSERT ON stock_movements FOR EACH ROW SET NEW.order_completed_key = IF(NEW.type = 'order_completed', CONCAT(NEW.reference_type, ':', NEW.reference_id, ':', NEW.product_id), NULL)");
            DB::statement("CREATE TRIGGER stock_movements_order_completed_key_update BEFORE UPDATE ON stock_movements FOR EACH ROW SET NEW.order_completed_key = IF(NEW.type = 'order_completed', CONCAT(NEW.reference_type, ':', NEW.reference_id, ':', NEW.product_id), NULL)");
            DB::statement('CREATE UNIQUE INDEX stock_movements_order_completed_unique ON stock_movements (order_completed_key)');
        } elseif (DB::getDriverName() === 'pgsql') {
            $duplicates = DB::table('stock_movements')
                ->selectRaw("reference_type || ':' || reference_id || ':' || product_id AS movement_key, COUNT(*) AS movement_count")
                ->where('type', 'order_completed')
                ->groupBy('reference_type', 'reference_id', 'product_id')
                ->having('COUNT(*)', '>', 1)
                ->get();
            if ($duplicates->isNotEmpty()) {
                $details = $duplicates->map(fn ($duplicate): string => "{$duplicate->movement_key} ({$duplicate->movement_count})")->implode(', ');
                throw new RuntimeException("Cannot add order_completed uniqueness; duplicate movement keys require reconciliation: {$details}");
            }
            $expectedColumns = ['reference_type', 'reference_id', 'product_id'];
            $normalizePredicate = static fn (?string $predicate): string => preg_replace('/\\s+|::[a-zA-Z0-9_\\s]+/', '', strtolower($predicate ?? '')) ?? '';
            $indexes = DB::select("SELECT index_class.relname AS index_name, index_class.relowner, index_info.indisunique, array_to_json(array_agg(attribute.attname ORDER BY key_position.ordinality)) AS indexed_columns, pg_get_expr(index_info.indpred, index_info.indrelid) AS predicate FROM pg_index index_info JOIN pg_class index_class ON index_class.oid = index_info.indexrelid JOIN pg_namespace index_schema ON index_schema.oid = index_class.relnamespace CROSS JOIN LATERAL unnest(index_info.indkey) WITH ORDINALITY AS key_position(attnum, ordinality) JOIN pg_attribute attribute ON attribute.attrelid = index_info.indrelid AND attribute.attnum = key_position.attnum WHERE index_info.indrelid = 'stock_movements'::regclass AND index_schema.nspname = current_schema() GROUP BY index_class.relname, index_class.relowner, index_info.indisunique, index_info.indpred, index_info.indrelid");
            $equivalent = collect($indexes)->first(fn ($index): bool => $index->indisunique && json_decode($index->indexed_columns, true, flags: JSON_THROW_ON_ERROR) === $expectedColumns && $normalizePredicate($index->predicate) === $normalizePredicate("type = 'order_completed'"));
            $named = collect($indexes)->first(fn ($index): bool => $index->index_name === 'stock_movements_order_completed_unique');
            if ($equivalent === null) {
                if ($named !== null && $named->relowner === DB::selectOne('SELECT oid FROM pg_roles WHERE rolname = current_user')->oid) {
                    DB::statement('DROP INDEX IF EXISTS stock_movements_order_completed_unique');
                }
                DB::statement("CREATE UNIQUE INDEX stock_movements_order_completed_unique ON stock_movements (reference_type, reference_id, product_id) WHERE type = 'order_completed'");
            } elseif ($named !== null && $named->index_name !== $equivalent->index_name && $named->relowner === DB::selectOne('SELECT oid FROM pg_roles WHERE rolname = current_user')->oid) {
                DB::statement('DROP INDEX IF EXISTS stock_movements_order_completed_unique');
            }
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP TRIGGER IF EXISTS orders_fulfilment_claim_consistency_insert');
            DB::statement('DROP TRIGGER IF EXISTS orders_fulfilment_claim_consistency_update');
            DB::statement("CREATE TRIGGER orders_fulfilment_claim_consistency_insert BEFORE INSERT ON orders FOR EACH ROW BEGIN IF (NEW.fulfilment_claimed_at IS NULL) <> (NEW.fulfilment_claimed_by IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid fulfilment claim'; END IF; END");
            DB::statement("CREATE TRIGGER orders_fulfilment_claim_consistency_update BEFORE UPDATE ON orders FOR EACH ROW BEGIN IF (NEW.fulfilment_claimed_at IS NULL) <> (NEW.fulfilment_claimed_by IS NULL) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid fulfilment claim'; END IF; END");
        } elseif (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_fulfilment_claim_consistency CHECK ((fulfilment_claimed_at IS NULL AND fulfilment_claimed_by IS NULL) OR (fulfilment_claimed_at IS NOT NULL AND fulfilment_claimed_by IS NOT NULL))');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP TRIGGER IF EXISTS stock_movements_order_completed_key_update');
            DB::statement('DROP TRIGGER IF EXISTS stock_movements_order_completed_key_insert');
            if (collect(Schema::getIndexes('stock_movements'))->contains(fn (array $index): bool => $index['name'] === 'stock_movements_order_completed_unique')) {
                DB::statement('DROP INDEX stock_movements_order_completed_unique ON stock_movements');
            }
            if (Schema::hasColumn('stock_movements', 'order_completed_key')) {
                Schema::table('stock_movements', function (Blueprint $table): void {
                    $table->dropColumn('order_completed_key');
                });
            }
        } elseif (DB::getDriverName() === 'pgsql') {
            $index = DB::selectOne("SELECT 1 FROM pg_class index_class JOIN pg_namespace index_schema ON index_schema.oid = index_class.relnamespace JOIN pg_roles index_owner ON index_owner.oid = index_class.relowner WHERE index_schema.nspname = current_schema() AND index_class.relname = 'stock_movements_order_completed_unique' AND index_class.relkind = 'i' AND index_owner.rolname = current_user");
            if ($index !== null) {
                DB::statement('DROP INDEX IF EXISTS stock_movements_order_completed_unique');
            }
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('DROP TRIGGER IF EXISTS orders_fulfilment_claim_consistency_insert');
            DB::statement('DROP TRIGGER IF EXISTS orders_fulfilment_claim_consistency_update');
        } elseif (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfilment_claim_consistency');
        }
    }
};
