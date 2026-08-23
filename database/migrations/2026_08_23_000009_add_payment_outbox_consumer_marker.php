<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_outbox_events', function (Blueprint $table): void {
            $table->string('consumer_status')->default('pending')->index();
            $table->string('consumer_claim_token', 64)->nullable()->index();
            $table->timestamp('consumer_claimed_at')->nullable()->index();
            $table->timestamp('consumer_next_attempt_at')->nullable()->index();
            $table->text('consumer_last_error')->nullable();
            $table->timestamp('consumer_completed_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('payment_outbox_events', function (Blueprint $table): void {
            $table->dropColumn(['consumer_status', 'consumer_claim_token', 'consumer_claimed_at', 'consumer_next_attempt_at', 'consumer_last_error', 'consumer_completed_at']);
        });
    }
};
