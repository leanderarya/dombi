<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('attempt_key')->unique();
            $table->string('invoice_number')->unique();
            $table->string('merchant_request_id')->unique();
            $table->string('session_token')->nullable();
            $table->string('payment_method')->nullable();
            $table->decimal('amount_snapshot', 12, 2);
            $table->char('currency_snapshot', 3);
            $table->decimal('gateway_amount', 12, 2)->nullable();
            $table->char('gateway_currency', 3)->nullable();
            $table->string('gateway_transaction_id')->nullable();
            $table->string('gateway_status')->nullable();
            $table->enum('creation_state', ['initiated', 'created', 'unknown', 'failed'])->default('initiated');
            $table->enum('settlement_status', ['pending', 'paid', 'failed', 'expired', 'unknown'])->default('pending');
            $table->enum('verification_status', ['verified', 'needs_review'])->default('needs_review');
            $table->unsignedInteger('status_version')->default(1);
            $table->string('reconciliation_status')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamp('fulfilment_claimed_at')->nullable();
            $table->foreignId('fulfilment_claimed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'settlement_status']);
            $table->index(['reconciliation_status', 'settlement_status']);
            $table->index(['gateway_transaction_id']);
            $table->index(['fulfilment_claimed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_attempts');
    }
};
