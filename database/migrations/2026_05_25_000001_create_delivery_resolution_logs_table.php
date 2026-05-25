<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_resolution_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('delivery_id')->nullable();
            $table->string('resolution_type');
            $table->foreignId('resolved_by')->constrained('users')->cascadeOnDelete();
            $table->text('resolution_notes');
            $table->unsignedInteger('retry_attempt')->default(0);
            $table->string('previous_status')->nullable();
            $table->string('new_status')->nullable();
            $table->text('inventory_effect')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_resolution_logs');
    }
};
