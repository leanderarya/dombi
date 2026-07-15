<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('refund_requested_at')->nullable()->after('refunded_at');
            $table->string('refund_proof_image')->nullable()->after('refund_requested_at');
            $table->unsignedBigInteger('refunded_by')->nullable()->after('refund_proof_image');
            $table->string('refund_rejected_reason')->nullable()->after('refund_proof_image');
            $table->foreign('refunded_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['refunded_by']);
            $table->dropColumn(['refund_requested_at', 'refund_proof_image', 'refunded_by', 'refund_rejected_reason']);
        });
    }
};
