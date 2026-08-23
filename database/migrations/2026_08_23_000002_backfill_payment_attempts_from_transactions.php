<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('payment_attempts', 'legacy_payment_transaction_id')) {
            $duplicates = DB::table('payment_attempts')
                ->select('legacy_payment_transaction_id')
                ->whereNotNull('legacy_payment_transaction_id')
                ->groupBy('legacy_payment_transaction_id')
                ->havingRaw('COUNT(*) > 1')
                ->pluck('legacy_payment_transaction_id');
            if ($duplicates->isNotEmpty()) {
                throw new RuntimeException('Duplicate legacy payment attempt links: '.$duplicates->implode(', '));
            }

            $orphans = DB::table('payment_attempts as attempts')
                ->leftJoin('payment_transactions as transactions', 'transactions.id', '=', 'attempts.legacy_payment_transaction_id')
                ->whereNotNull('attempts.legacy_payment_transaction_id')
                ->whereNull('transactions.id')
                ->pluck('attempts.legacy_payment_transaction_id');
            if ($orphans->isNotEmpty()) {
                throw new RuntimeException('Orphan legacy payment attempt links: '.$orphans->implode(', '));
            }
        }

        if (Schema::hasColumn('payment_transactions', 'status')) {
            Schema::table('payment_transactions', function (Blueprint $table): void {
                $table->string('status')->change();
            });
        }

        Schema::table('payment_attempts', function (Blueprint $table): void {
            if (! Schema::hasColumn('payment_attempts', 'legacy_payment_transaction_id')) {
                $table->unsignedBigInteger('legacy_payment_transaction_id')->nullable()->after('order_id');
            }
            if (! Schema::hasColumn('payment_attempts', 'session_id')) {
                $table->string('session_id')->nullable()->after('session_token');
            }
            if (! Schema::hasColumn('payment_attempts', 'token_id')) {
                $table->string('token_id')->nullable()->after('session_id');
            }
            if (! Schema::hasColumn('payment_attempts', 'raw_response')) {
                $table->json('raw_response')->nullable()->after('metadata');
            }
        });

        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->unique('legacy_payment_transaction_id');
            $table->foreign('legacy_payment_transaction_id')->references('id')->on('payment_transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->dropForeign(['legacy_payment_transaction_id']);
            $table->dropColumn(['legacy_payment_transaction_id', 'session_id', 'token_id', 'raw_response']);
        });
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->enum('status', ['pending', 'paid', 'settled', 'expired', 'failed'])->change();
        });
    }
};
