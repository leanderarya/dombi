<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('refunded_at')->nullable()->after('paid_at');
            $table->decimal('refund_amount', 12, 2)->nullable()->after('refunded_at');
            $table->string('refund_reason')->nullable()->after('refund_amount');
            $table->string('doku_refund_id')->nullable()->after('refund_reason');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['refunded_at', 'refund_amount', 'refund_reason', 'doku_refund_id']);
        });
    }
};
