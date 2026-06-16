<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            $this->rebuildSqliteTable([
                'initial_stock',
                'stock_adjustment',
                'order_reserved',
                'order_completed',
                'order_cancelled',
                'restock_in',
                'delivery_returned',
                'return_out',
                'return_in',
                'distribution_out',
                'exchange_in',
                'exchange_out',
            ]);

            return;
        }

        DB::statement("
            ALTER TABLE stock_movements
            MODIFY type ENUM(
                'initial_stock',
                'stock_adjustment',
                'order_reserved',
                'order_completed',
                'order_cancelled',
                'restock_in',
                'delivery_returned',
                'return_out',
                'return_in',
                'distribution_out',
                'exchange_in',
                'exchange_out'
            ) NOT NULL
        ");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            $this->rebuildSqliteTable([
                'initial_stock',
                'stock_adjustment',
                'order_reserved',
                'order_completed',
                'order_cancelled',
                'restock_in',
                'delivery_returned',
                'return_out',
                'exchange_in',
                'exchange_out',
            ]);

            return;
        }

        DB::statement("
            ALTER TABLE stock_movements
            MODIFY type ENUM(
                'initial_stock',
                'stock_adjustment',
                'order_reserved',
                'order_completed',
                'order_cancelled',
                'restock_in',
                'delivery_returned',
                'return_out',
                'exchange_in',
                'exchange_out'
            ) NOT NULL
        ");
    }

    private function rebuildSqliteTable(array $allowedTypes): void
    {
        $typeCheck = implode("','", $allowedTypes);

        DB::statement('PRAGMA foreign_keys=OFF');
        DB::statement("
            CREATE TABLE stock_movements_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                outlet_id INTEGER NOT NULL,
                product_id INTEGER NULL,
                product_variant_id INTEGER NULL,
                type VARCHAR NOT NULL CHECK (type IN ('{$typeCheck}')),
                quantity INTEGER NOT NULL,
                before_stock INTEGER NULL,
                after_stock INTEGER NULL,
                before_reserved INTEGER NULL,
                after_reserved INTEGER NULL,
                reference_type VARCHAR NULL,
                reference_id INTEGER NULL,
                notes TEXT NULL,
                created_by INTEGER NULL,
                created_at DATETIME NULL,
                updated_at DATETIME NULL,
                FOREIGN KEY(outlet_id) REFERENCES outlets(id) ON DELETE CASCADE,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL,
                FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            )
        ");

        DB::statement('
            INSERT INTO stock_movements_new (
                id, outlet_id, product_id, product_variant_id, type, quantity,
                before_stock, after_stock, before_reserved, after_reserved,
                reference_type, reference_id, notes, created_by, created_at, updated_at
            )
            SELECT
                id, outlet_id, product_id, product_variant_id, type, quantity,
                before_stock, after_stock, before_reserved, after_reserved,
                reference_type, reference_id, notes, created_by, created_at, updated_at
            FROM stock_movements
        ');

        DB::statement('DROP TABLE stock_movements');
        DB::statement('ALTER TABLE stock_movements_new RENAME TO stock_movements');
        DB::statement('CREATE INDEX stock_movements_created_by_foreign ON stock_movements(created_by)');
        DB::statement('CREATE INDEX stock_movements_outlet_id_created_at_index ON stock_movements(outlet_id, created_at)');
        DB::statement('CREATE INDEX stock_movements_product_id_created_at_index ON stock_movements(product_id, created_at)');
        DB::statement('CREATE INDEX stock_movements_product_variant_id_index ON stock_movements(product_variant_id)');
        DB::statement('PRAGMA foreign_keys=ON');
    }
};
