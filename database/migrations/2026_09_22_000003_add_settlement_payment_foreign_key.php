<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('settlement_payments') || $this->hasForeignKey('settlement_payments', 'settlement_id')) {
            return;
        }

        DB::table('settlement_payments')
            ->whereNotNull('settlement_id')
            ->whereNotExists(function ($query): void {
                $query->select(DB::raw(1))
                    ->from('settlements')
                    ->whereColumn('settlements.id', 'settlement_payments.settlement_id');
            })
            ->update(['settlement_id' => null]);

        if (! $this->hasIndex('settlement_payments', 'settlement_payments_settlement_id_index')) {
            Schema::table('settlement_payments', function (Blueprint $table): void {
                $table->index('settlement_id', 'settlement_payments_settlement_id_index');
            });
        }

        Schema::table('settlement_payments', function (Blueprint $table): void {
            $table->foreign('settlement_id')->references('id')->on('settlements')->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! $this->hasForeignKey('settlement_payments', 'settlement_id')) {
            return;
        }

        Schema::table('settlement_payments', function (Blueprint $table): void {
            $table->dropForeign(['settlement_id']);
        });

        if ($this->hasIndex('settlement_payments', 'settlement_payments_settlement_id_index')) {
            Schema::table('settlement_payments', function (Blueprint $table): void {
                $table->dropIndex('settlement_payments_settlement_id_index');
            });
        }
    }

    private function hasForeignKey(string $table, string $column): bool
    {
        if (! Schema::hasTable($table)) {
            return false;
        }

        return collect(Schema::getForeignKeys($table))->contains(
            fn (array $foreignKey): bool => $foreignKey['columns'] === [$column]
        );
    }

    private function hasIndex(string $table, string $name): bool
    {
        return collect(Schema::getIndexes($table))->contains(
            fn (array $index): bool => $index['name'] === $name
        );
    }
};
