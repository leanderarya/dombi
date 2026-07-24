<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('refund_destination_status')->nullable()->after('refund_destination_submitted_at');
            $table->index(['payment_status', 'refund_destination_status'], 'orders_refund_queue_index');
        });

        DB::table('orders')
            ->whereIn('payment_status', ['refund_pending', 'refund_in_progress', 'refunded', 'refund_rejected', 'refund_failed'])
            ->update([
                'refund_destination_status' => DB::raw(
                    "CASE WHEN refund_destination_submitted_at IS NOT NULL AND refund_destination_type IN ('bank','ewallet') THEN 'valid' ELSE 'missing' END"
                ),
            ]);

        Schema::create('refund_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->string('event');
            $table->string('actor_type');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('reason_code')->nullable();
            $table->text('note')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['order_id', 'created_at', 'id'], 'refund_history_order_timeline_index');
            $table->index(['event', 'order_id'], 'refund_history_event_order_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_status_histories');

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex('orders_refund_queue_index');
            $table->dropColumn('refund_destination_status');
        });
    }
};
