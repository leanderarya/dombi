<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refund_obligations', function (Blueprint $table): void {
            $table->timestamp('requested_at')->nullable()->after('processed_by');
            $table->timestamp('started_at')->nullable()->after('requested_at');
            $table->timestamp('completed_at')->nullable()->after('started_at');
            $table->timestamp('rejected_at')->nullable()->after('completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('refund_obligations', function (Blueprint $table): void {
            $table->dropColumn(['requested_at', 'started_at', 'completed_at', 'rejected_at']);
        });
    }
};
