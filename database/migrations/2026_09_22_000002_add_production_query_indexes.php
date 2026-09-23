<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ADDED_INDEXES = [
        ['table' => 'orders', 'name' => 'orders_status_completed_at_index', 'columns' => ['status', 'completed_at']],
        ['table' => 'deliveries', 'name' => 'deliveries_status_updated_at_index', 'columns' => ['status', 'updated_at']],
        ['table' => 'deliveries', 'name' => 'deliveries_courier_id_updated_at_index', 'columns' => ['courier_id', 'updated_at']],
        ['table' => 'settlement_payments', 'name' => 'settlement_payments_verified_at_index', 'columns' => ['verified_at']],
        ['table' => 'payment_webhook_logs', 'name' => 'payment_webhook_logs_created_at_index', 'columns' => ['created_at']],
        ['table' => 'order_reports', 'name' => 'order_reports_created_at_index', 'columns' => ['created_at']],
        ['table' => 'payment_attempts', 'name' => 'payment_attempts_creation_state_created_at_index', 'columns' => ['creation_state', 'created_at']],
        ['table' => 'outlet_audit_logs', 'name' => 'outlet_audit_logs_outlet_id_created_at_index', 'columns' => ['outlet_id', 'created_at']],
        ['table' => 'pricing_audit_logs', 'name' => 'pricing_audit_logs_outlet_id_created_at_index', 'columns' => ['outlet_id', 'created_at']],
        ['table' => 'settlement_audit_logs', 'name' => 'settlement_audit_logs_settlement_id_created_at_index', 'columns' => ['settlement_id', 'created_at']],
    ];

    /**
     * Single-column indexes that the composite index above already serves as a leftmost
     * prefix. MySQL and PostgreSQL keep the foreign key valid through the composite.
     */
    private const SUPERSEDED_INDEXES = [
        ['table' => 'outlet_audit_logs', 'name' => 'outlet_audit_logs_outlet_id_foreign', 'columns' => ['outlet_id']],
        ['table' => 'pricing_audit_logs', 'name' => 'pricing_audit_logs_outlet_id_foreign', 'columns' => ['outlet_id']],
        ['table' => 'settlement_audit_logs', 'name' => 'settlement_audit_logs_settlement_id_foreign', 'columns' => ['settlement_id']],
    ];

    private const STOCK_MOVEMENT_INDEX = 'stock_movements_product_id_created_at_index';

    public function up(): void
    {
        foreach (self::ADDED_INDEXES as $index) {
            if (! Schema::hasTable($index['table'])) {
                continue;
            }

            $this->ensureIndex($index['table'], $index['name'], $index['columns']);
        }

        $this->ensureIndex('stock_movements', self::STOCK_MOVEMENT_INDEX, ['product_id', 'created_at']);
        $this->ensureIndex('stock_movements', 'stock_movements_created_at_index', ['created_at']);

        foreach (self::SUPERSEDED_INDEXES as $index) {
            if ($this->hasIndex($index['table'], $index['name'])) {
                Schema::table($index['table'], function (Blueprint $table) use ($index): void {
                    $table->dropIndex($index['name']);
                });
            }
        }
    }

    public function down(): void
    {
        foreach (self::SUPERSEDED_INDEXES as $index) {
            if (! Schema::hasTable($index['table']) || $this->hasIndex($index['table'], $index['name'])) {
                continue;
            }

            Schema::table($index['table'], function (Blueprint $table) use ($index): void {
                $table->index($index['columns'], $index['name']);
            });
        }

        foreach (self::ADDED_INDEXES as $index) {
            if ($this->hasIndex($index['table'], $index['name'])) {
                Schema::table($index['table'], function (Blueprint $table) use ($index): void {
                    $table->dropIndex($index['name']);
                });
            }
        }

        if (Schema::hasTable('stock_movements')) {
            if ($this->hasIndex('stock_movements', 'stock_movements_created_at_index')) {
                Schema::table('stock_movements', function (Blueprint $table): void {
                    $table->dropIndex('stock_movements_created_at_index');
                });
            }

            $this->ensureIndex('stock_movements', self::STOCK_MOVEMENT_INDEX, ['created_at']);
        }
    }

    private function ensureIndex(string $table, string $name, array $columns): void
    {
        $existing = collect(Schema::getIndexes($table))->firstWhere('name', $name);

        if ($existing !== null) {
            if ($existing['columns'] === $columns) {
                return;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($name): void {
                $blueprint->dropIndex($name);
            });
        }

        Schema::table($table, function (Blueprint $blueprint) use ($name, $columns): void {
            $blueprint->index($columns, $name);
        });
    }

    private function hasIndex(string $table, string $name): bool
    {
        if (! Schema::hasTable($table)) {
            return false;
        }

        return collect(Schema::getIndexes($table))->contains(
            fn (array $index): bool => $index['name'] === $name
        );
    }
};
