<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Settlement periods (daily/weekly/monthly snapshots)
        Schema::create('settlement_periods', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('period_type'); // daily, weekly, monthly
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedInteger('orders_count')->default(0);
            $table->unsignedInteger('units_sold')->default(0);
            $table->decimal('gross_revenue', 14, 2)->default(0);
            $table->decimal('center_share', 14, 2)->default(0);
            $table->decimal('outlet_margin', 14, 2)->default(0);
            $table->decimal('settled_amount', 14, 2)->default(0);
            $table->decimal('outstanding_amount', 14, 2)->default(0);
            $table->timestamp('calculated_at')->nullable();
            $table->timestamps();

            $table->unique(['outlet_id', 'period_type', 'period_start']);
            $table->index(['period_type', 'period_start']);
        });

        // Outlet payable ledger (tracks settlements/payments)
        Schema::create('outlet_payables', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['sale', 'settlement', 'adjustment'])->default('sale');
            $table->decimal('amount', 14, 2);
            $table->decimal('center_share', 14, 2)->default(0);
            $table->decimal('outlet_margin', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['outlet_id', 'type']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outlet_payables');
        Schema::dropIfExists('settlement_periods');
    }
};
