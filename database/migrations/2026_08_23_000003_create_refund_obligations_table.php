<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refund_obligations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payment_attempt_id')->constrained('payment_attempts')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->char('currency', 3);
            $table->string('reason');
            $table->enum('status', ['pending', 'in_progress', 'completed', 'rejected', 'failed', 'needs_review'])->default('pending');
            $table->string('destination_type')->nullable();
            $table->text('bank_name')->nullable();
            $table->text('account_number')->nullable();
            $table->text('account_holder')->nullable();
            $table->text('ewallet_provider')->nullable();
            $table->text('ewallet_number')->nullable();
            $table->text('ewallet_holder')->nullable();
            $table->timestamp('destination_submitted_at')->nullable();
            $table->string('transfer_reference')->nullable();
            $table->text('transfer_note')->nullable();
            $table->string('proof_image')->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->unique(['payment_attempt_id', 'reason']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_obligations');
    }
};
