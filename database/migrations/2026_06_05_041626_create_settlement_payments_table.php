<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settlement_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('reference_number')->unique();
            $table->date('payment_date');
            $table->decimal('amount', 14, 2);
            $table->string('proof_image')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['pending_verification', 'verified', 'rejected'])->default('pending_verification');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['outlet_id', 'status']);
            $table->index('payment_date');
            $table->index('status');
        });

        // Add due_date to settlement_periods for overdue tracking
        Schema::table('settlement_periods', function (Blueprint $table): void {
            $table->date('due_date')->nullable()->after('period_end');
        });
    }

    public function down(): void
    {
        Schema::table('settlement_periods', function (Blueprint $table): void {
            $table->dropColumn('due_date');
        });

        Schema::dropIfExists('settlement_payments');
    }
};
