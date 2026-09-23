<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = [
        'orders' => [
            'constraint' => 'orders_refund_destination_branch_exclusive',
            'bank' => ['refund_bank_name', 'refund_account_number', 'refund_account_holder'],
            'ewallet' => ['refund_ewallet_provider', 'refund_ewallet_number', 'refund_ewallet_holder'],
        ],
        'refund_obligations' => [
            'constraint' => 'refund_obligations_destination_branch_exclusive',
            'bank' => ['bank_name', 'account_number', 'account_holder'],
            'ewallet' => ['ewallet_provider', 'ewallet_number', 'ewallet_holder'],
        ],
    ];

    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'pgsql'], true)) {
            return;
        }

        $this->assertNoBranchOverlap();

        foreach (self::TABLES as $table => $definition) {
            $this->addConstraint($table, $definition);
        }
    }

    public function down(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'pgsql'], true)) {
            return;
        }

        foreach (self::TABLES as $table => $definition) {
            $name = $definition['constraint'];

            if (! $this->hasConstraint($table, $name)) {
                continue;
            }

            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$name}");
        }
    }

    /**
     * A destination is either a bank account or an ewallet, never both. Incomplete
     * destinations stay allowed because refund_destination_status already models
     * them as missing or invalid.
     */
    private function assertNoBranchOverlap(): void
    {
        foreach (self::TABLES as $table => $definition) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $anyBank = implode(' OR ', array_map(fn (string $column): string => "{$column} IS NOT NULL", $definition['bank']));
            $anyEwallet = implode(' OR ', array_map(fn (string $column): string => "{$column} IS NOT NULL", $definition['ewallet']));

            $offenders = DB::table($table)
                ->whereRaw("({$anyBank}) AND ({$anyEwallet})")
                ->limit(10)
                ->pluck('id')
                ->all();

            if ($offenders !== []) {
                throw new RuntimeException(sprintf(
                    'Cannot constrain %s; rows %s hold both bank and ewallet destination fields.',
                    $table,
                    implode(', ', $offenders)
                ));
            }
        }
    }

    private function addConstraint(string $table, array $definition): void
    {
        $name = $definition['constraint'];

        if (! Schema::hasTable($table) || $this->hasConstraint($table, $name)) {
            return;
        }

        $bankAllNull = $this->allNullClause($definition['bank']);
        $ewalletAllNull = $this->allNullClause($definition['ewallet']);

        DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$name} CHECK (({$bankAllNull}) OR ({$ewalletAllNull}))");
    }

    private function allNullClause(array $columns): string
    {
        return implode(' AND ', array_map(fn (string $column): string => "{$column} IS NULL", $columns));
    }

    private function hasConstraint(string $table, string $name): bool
    {
        $schema = DB::getDriverName() === 'mysql'
            ? DB::getDatabaseName()
            : DB::selectOne('select current_schema() as schema')->schema;

        return DB::table('information_schema.table_constraints')
            ->where('constraint_schema', $schema)
            ->where('table_name', $table)
            ->where('constraint_name', $name)
            ->exists();
    }
};
