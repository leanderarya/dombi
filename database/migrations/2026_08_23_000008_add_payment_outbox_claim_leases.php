<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_outbox_events', function (Blueprint $table): void {
            $table->string('claim_token', 64)->nullable()->index();
            $table->timestamp('claim_expires_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('payment_outbox_events', function (Blueprint $table): void {
            $table->dropColumn(['claim_token', 'claim_expires_at']);
        });
    }
};
