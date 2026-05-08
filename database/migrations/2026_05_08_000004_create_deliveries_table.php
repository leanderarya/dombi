<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('courier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['waiting_assignment', 'waiting_pickup', 'picked_up', 'delivering', 'completed', 'failed'])->default('waiting_assignment');
            $table->timestamp('pickup_time')->nullable();
            $table->timestamp('delivered_time')->nullable();
            $table->text('failed_reason')->nullable();
            $table->text('notes')->nullable();
            $table->string('proof_image')->nullable();
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
