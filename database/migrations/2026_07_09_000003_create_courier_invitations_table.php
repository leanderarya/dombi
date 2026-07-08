<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_invitations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invited_by')->constrained('users');
            $table->foreignId('courier_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('phone', 20);
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->enum('status', ['pending', 'accepted', 'expired'])->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index('status');
            $table->index('token');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_invitations');
    }
};
