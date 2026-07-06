<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add columns if they don't exist yet
        if (! Schema::hasColumn('settlements', 'period_start')) {
            Schema::table('settlements', function (Blueprint $table): void {
                $table->date('period_start')->nullable()->after('period_date');
                $table->date('period_end')->nullable()->after('period_start');
                $table->string('period_type')->default('weekly')->after('period_end');
            });
        }

        // Backfill: set period_start = period_date, period_end = period_date for existing daily records
        DB::table('settlements')
            ->whereNull('period_start')
            ->update([
                'period_start' => DB::raw('period_date'),
                'period_end' => DB::raw('period_date'),
                'period_type' => 'daily',
            ]);

        // Make non-nullable after backfill
        Schema::table('settlements', function (Blueprint $table): void {
            $table->date('period_start')->nullable(false)->change();
            $table->date('period_end')->nullable(false)->change();
        });

        // Drop old unique constraint, add new one with period_type + period_start
        try {
            Schema::table('settlements', function (Blueprint $table): void {
                $table->dropUnique(['outlet_id', 'period_date']);
            });
        } catch (Throwable $e) {
            // Constraint may already be dropped
        }

        // Add new unique constraint if it doesn't exist
        $hasIndex = false;
        if (config('database.default') === 'sqlite') {
            $indexes = DB::select("PRAGMA index_list('settlements')");
            $hasIndex = collect($indexes)->contains('name', 'settlements_outlet_period_unique');
        } else {
            $indexes = DB::select("SHOW INDEXES FROM settlements WHERE Key_name = 'settlements_outlet_period_unique'");
            $hasIndex = ! empty($indexes);
        }
        if (! $hasIndex) {
            Schema::table('settlements', function (Blueprint $table): void {
                $table->unique(['outlet_id', 'period_type', 'period_start'], 'settlements_outlet_period_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::table('settlements', function (Blueprint $table): void {
            $table->dropUnique('settlements_outlet_period_unique');
            $table->unique(['outlet_id', 'period_date']);
            $table->dropColumn(['period_start', 'period_end', 'period_type']);
        });
    }
};
