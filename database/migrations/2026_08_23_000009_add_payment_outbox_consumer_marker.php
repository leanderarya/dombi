<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_outbox_events', function (Blueprint $table): void {
            $table->timestamp('consumer_claimed_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('payment_outbox_events', function (Blueprint $table): void {
            $table->dropColumn('consumer_claimed_at');
        });
    }
};
