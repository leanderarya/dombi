<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('fulfilment_claimed_at')->nullable()->after('paid_at');
            $table->foreignId('fulfilment_claimed_by')->nullable()->after('fulfilment_claimed_at')->constrained('payment_attempts')->nullOnDelete();
            $table->index(['fulfilment_claimed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropForeign(['fulfilment_claimed_by']);
            $table->dropIndex(['fulfilment_claimed_at']);
            $table->dropColumn(['fulfilment_claimed_at', 'fulfilment_claimed_by']);
        });
    }
};
