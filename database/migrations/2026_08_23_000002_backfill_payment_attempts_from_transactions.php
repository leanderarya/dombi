<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->foreignId('legacy_payment_transaction_id')->nullable()->unique()->after('order_id')->constrained('payment_transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->dropForeign(['legacy_payment_transaction_id']);
            $table->dropColumn('legacy_payment_transaction_id');
        });
    }
};
