<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Audit, history, and financial rows must not disappear because a parent row
     * was removed. None of these parents are hard deleted by application code:
     * outlets are archived and soft deleted, and users, orders, and payment
     * attempts have no delete path at all.
     */
    private const PROTECTED = [
        ['table' => 'settlement_audit_logs', 'column' => 'user_id', 'parent' => 'users'],
        ['table' => 'pricing_audit_logs', 'column' => 'outlet_id', 'parent' => 'outlets'],
        ['table' => 'pricing_audit_logs', 'column' => 'product_id', 'parent' => 'products'],
        ['table' => 'outlet_audit_logs', 'column' => 'outlet_id', 'parent' => 'outlets'],
        ['table' => 'outlet_payables', 'column' => 'outlet_id', 'parent' => 'outlets'],
        ['table' => 'settlement_payments', 'column' => 'outlet_id', 'parent' => 'outlets'],
        ['table' => 'settlements', 'column' => 'outlet_id', 'parent' => 'outlets'],
        ['table' => 'stock_movements', 'column' => 'outlet_id', 'parent' => 'outlets'],
        ['table' => 'payment_attempts', 'column' => 'order_id', 'parent' => 'orders'],
        ['table' => 'payment_transactions', 'column' => 'order_id', 'parent' => 'orders'],
        ['table' => 'refund_obligations', 'column' => 'payment_attempt_id', 'parent' => 'payment_attempts'],
        ['table' => 'order_status_histories', 'column' => 'order_id', 'parent' => 'orders'],
        ['table' => 'refund_status_histories', 'column' => 'order_id', 'parent' => 'orders'],
        ['table' => 'delivery_resolution_logs', 'column' => 'order_id', 'parent' => 'orders'],
    ];

    public function up(): void
    {
        $this->rewriteRules('RESTRICT');
    }

    public function down(): void
    {
        $this->rewriteRules('CASCADE');
    }

    private function rewriteRules(string $rule): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'pgsql'], true)) {
            return;
        }

        foreach (self::PROTECTED as $foreignKey) {
            $name = $this->constraintName($foreignKey['table'], $foreignKey['column']);

            if ($name === null) {
                throw new RuntimeException(sprintf(
                    'Expected a foreign key on %s.%s but found none; refusing to report success without protecting it.',
                    $foreignKey['table'],
                    $foreignKey['column']
                ));
            }

            $this->dropConstraint($foreignKey['table'], $name);

            DB::statement(sprintf(
                'ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s (id) ON DELETE %s',
                $foreignKey['table'],
                $name,
                $foreignKey['column'],
                $foreignKey['parent'],
                $rule
            ));
        }
    }

    private function dropConstraint(string $table, string $name): void
    {
        $clause = DB::getDriverName() === 'mysql' ? 'DROP FOREIGN KEY' : 'DROP CONSTRAINT';

        DB::statement("ALTER TABLE {$table} {$clause} {$name}");
    }

    private function constraintName(string $table, string $column): ?string
    {
        if (! Schema::hasTable($table)) {
            return null;
        }

        $schema = DB::getDriverName() === 'mysql'
            ? DB::getDatabaseName()
            : DB::selectOne('select current_schema() as schema')->schema;

        $row = DB::table('information_schema.key_column_usage')
            ->where('constraint_schema', $schema)
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->whereNotNull('referenced_table_name')
            ->first();

        if ($row === null) {
            return null;
        }

        $row = (array) $row;

        return $row['constraint_name'] ?? $row['CONSTRAINT_NAME'] ?? null;
    }
};
