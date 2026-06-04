<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_online')->default(false)->after('is_active');
            $table->timestamp('shift_started_at')->nullable()->after('is_online');
            $table->timestamp('shift_ended_at')->nullable()->after('shift_started_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['is_online', 'shift_started_at', 'shift_ended_at']);
        });
    }
};
