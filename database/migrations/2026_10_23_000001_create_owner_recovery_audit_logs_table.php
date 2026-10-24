<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_recovery_audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('operation_id')->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('event', 64);
            $table->string('operator', 255);
            $table->string('session_driver', 80);
            $table->unsignedInteger('sessions_revoked')->default(0);
            $table->timestamp('created_at');

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_recovery_audit_logs');
    }
};
