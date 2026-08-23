<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('payment_attempts')
            ->select('order_id', 'invoice_number', DB::raw('COUNT(*) AS duplicate_count'))
            ->groupBy('order_id', 'invoice_number')
            ->having('duplicate_count', '>', 1)
            ->get();

        if ($duplicates->isNotEmpty()) {
            Log::critical('Payment attempt unique-index preflight failed', [
                'migration' => __FILE__,
                'duplicates' => $duplicates->map(fn ($duplicate): array => (array) $duplicate)->all(),
            ]);

            throw new RuntimeException('Duplicate payment_attempts order_id/invoice_number rows require reconciliation; see migration log.');
        }

        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->unique(['order_id', 'invoice_number'], 'payment_attempts_order_invoice_unique');
        });
    }

    public function down(): void
    {
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->dropUnique('payment_attempts_order_invoice_unique');
        });
    }
};
