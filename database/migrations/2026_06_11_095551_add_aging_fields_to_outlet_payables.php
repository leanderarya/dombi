<?php

use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outlet_payables', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('amount');
            $table->decimal('paid_amount', 14, 2)->default(0)->after('due_date');
            $table->decimal('remaining_amount', 14, 2)->default(0)->after('paid_amount');
        });

        // Backfill existing sale rows using PHP (database-agnostic)
        $payables = DB::table('outlet_payables')
            ->where('type', 'sale')
            ->select(['id', 'created_at', 'center_share'])
            ->get();

        foreach ($payables as $payable) {
            DB::table('outlet_payables')
                ->where('id', $payable->id)
                ->update([
                    'due_date' => Carbon::parse($payable->created_at)->addDays(7)->toDateString(),
                    'remaining_amount' => $payable->center_share,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('outlet_payables', function (Blueprint $table) {
            $table->dropColumn(['due_date', 'paid_amount', 'remaining_amount']);
        });
    }
};
