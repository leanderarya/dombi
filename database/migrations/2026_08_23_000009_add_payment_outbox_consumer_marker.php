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
            $table->timestamp('consumer_claimed_at')->nullable()->index();
            $table->timestamp('consumer_completed_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('payment_outbox_events', function (Blueprint $table): void {
            $table->dropColumn(['consumer_status', 'consumer_claimed_at', 'consumer_completed_at']);
        });
    }
};
