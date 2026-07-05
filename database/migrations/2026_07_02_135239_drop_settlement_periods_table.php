<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('settlement_periods');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('settlement_periods', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status')->default('open');
            $table->decimal('total_sales_amount', 15, 2)->default(0);
            $table->decimal('total_settled_amount', 15, 2)->default(0);
            $table->decimal('total_outstanding_amount', 15, 2)->default(0);
            $table->integer('transaction_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['outlet_id', 'period_start', 'period_end']);
        });
    }
};
