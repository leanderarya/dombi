<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('invitation_status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->unsignedInteger('total_deliveries')->default(0);
            $table->decimal('rating', 3, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index('invitation_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_profiles');
    }
};
