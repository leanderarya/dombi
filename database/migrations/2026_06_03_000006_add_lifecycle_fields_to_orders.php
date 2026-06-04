<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('confirmed_at')->nullable()->after('ordered_at');
            $table->unsignedBigInteger('confirmed_by')->nullable()->after('confirmed_at');
            $table->timestamp('rejected_at')->nullable()->after('confirmed_by');
            $table->unsignedBigInteger('rejected_by')->nullable()->after('rejected_at');
            $table->string('rejection_reason')->nullable()->after('rejected_by');
            $table->text('rejection_note')->nullable()->after('rejection_reason');
            $table->timestamp('cancelled_at')->nullable()->after('rejection_note');
            $table->unsignedBigInteger('cancelled_by')->nullable()->after('cancelled_at');
            $table->string('cancellation_reason')->nullable()->after('cancelled_by');
            $table->text('cancellation_note')->nullable()->after('cancellation_reason');
        });

        Schema::table('order_status_histories', function (Blueprint $table): void {
            $table->string('changed_by_type')->nullable()->after('changed_by');
            $table->text('reason')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn([
                'confirmed_at', 'confirmed_by',
                'rejected_at', 'rejected_by', 'rejection_reason', 'rejection_note',
                'cancelled_at', 'cancelled_by', 'cancellation_reason', 'cancellation_note',
            ]);
        });

        Schema::table('order_status_histories', function (Blueprint $table): void {
            $table->dropColumn(['changed_by_type', 'reason']);
        });
    }
};
