<?php

use App\Support\StatusConstraints;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'pgsql'], true)) {
            return;
        }

        $this->assertExistingValuesAreAllowed();

        foreach (StatusConstraints::ALLOWED_VALUES as $table => $columns) {
            foreach (array_keys($columns) as $column) {
                $this->addConstraint($table, $column);
            }
        }
    }

    public function down(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'pgsql'], true)) {
            return;
        }

        foreach (StatusConstraints::ALLOWED_VALUES as $table => $columns) {
            foreach (array_keys($columns) as $column) {
                $name = StatusConstraints::constraintName($table, $column);

                if ($this->hasConstraint($table, $name)) {
                    DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$name}");
                }
            }
        }
    }

    private function assertExistingValuesAreAllowed(): void
    {
        foreach (StatusConstraints::ALLOWED_VALUES as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach (array_keys($columns) as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    continue;
                }

                $offenders = DB::table($table)
                    ->whereNotNull($column)
                    ->whereNotIn($column, StatusConstraints::allowedFor($table, $column))
                    ->distinct()
                    ->limit(20)
                    ->pluck($column)
                    ->all();

                if ($offenders !== []) {
                    throw new RuntimeException(sprintf(
                        'Cannot constrain %s.%s; values outside the allowed set require reconciliation first: %s',
                        $table,
                        $column,
                        implode(', ', $offenders)
                    ));
                }
            }
        }
    }

    private function addConstraint(string $table, string $column): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        $name = StatusConstraints::constraintName($table, $column);

        if ($this->hasConstraint($table, $name)) {
            return;
        }

        $quoted = implode(', ', array_map(
            fn (string $value): string => "'".str_replace("'", "''", $value)."'",
            StatusConstraints::allowedFor($table, $column)
        ));

        DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$name} CHECK ({$column} IN ({$quoted}))");
    }

    private function hasConstraint(string $table, string $name): bool
    {
        if (! Schema::hasTable($table)) {
            return false;
        }

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
