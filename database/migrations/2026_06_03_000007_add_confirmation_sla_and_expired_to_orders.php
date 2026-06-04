<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('confirmation_expires_at')->nullable()->after('ordered_at');
            $table->timestamp('expired_at')->nullable()->after('cancellation_note');
            $table->string('expired_reason')->nullable()->after('expired_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['confirmation_expires_at', 'expired_at', 'expired_reason']);
        });
    }
};
