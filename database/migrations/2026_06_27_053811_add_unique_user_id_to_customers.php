<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Clean up any duplicates first (keep the oldest)
        $duplicates = DB::table('customers')
            ->select('user_id')
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('user_id');

        foreach ($duplicates as $userId) {
            $keep = DB::table('customers')
                ->where('user_id', $userId)
                ->orderBy('id')
                ->first();

            DB::table('customers')
                ->where('user_id', $userId)
                ->where('id', '!=', $keep->id)
                ->delete();
        }

        Schema::table('customers', function (Blueprint $table) {
            $table->unique('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique(['user_id']);
        });
    }
};
