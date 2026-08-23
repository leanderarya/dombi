<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_webhook_logs', function (Blueprint $table): void {
            $table->text('raw_body')->nullable()->after('payload');
            $table->string('body_digest', 64)->nullable()->after('raw_body');
            $table->unique('request_id');
        });
    }

    public function down(): void
    {
        Schema::table('payment_webhook_logs', function (Blueprint $table): void {
            $table->dropUnique(['request_id']);
            $table->dropColumn(['raw_body', 'body_digest']);
        });
    }
};
