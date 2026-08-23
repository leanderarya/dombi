<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->string('status')->change();
        });

        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->unsignedBigInteger('legacy_payment_transaction_id')->nullable()->after('order_id');
            $table->string('session_id')->nullable()->after('session_token');
            $table->string('token_id')->nullable()->after('session_id');
            $table->json('raw_response')->nullable()->after('metadata');
        });

        $duplicates = DB::table('payment_attempts')
            ->select('legacy_payment_transaction_id')
            ->whereNotNull('legacy_payment_transaction_id')
            ->groupBy('legacy_payment_transaction_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('legacy_payment_transaction_id');
        if ($duplicates->isNotEmpty()) {
            throw new RuntimeException('Duplicate legacy payment attempt links: '.$duplicates->implode(', '));
        }

        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->unique('legacy_payment_transaction_id');
            $table->foreign('legacy_payment_transaction_id')->references('id')->on('payment_transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->enum('status', ['pending', 'paid', 'settled', 'expired', 'failed'])->change();
        });

        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->dropForeign(['legacy_payment_transaction_id']);
            $table->dropColumn(['legacy_payment_transaction_id', 'session_id', 'token_id', 'raw_response']);
        });
    }
};
