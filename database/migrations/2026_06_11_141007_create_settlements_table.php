<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->date('period_date');
            $table->decimal('sales_amount', 14, 2)->default(0);
            $table->decimal('amount_due', 14, 2)->default(0);
            $table->date('due_date');
            $table->string('status')->default('pending'); // pending, due_today, overdue, paid
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['outlet_id', 'period_date']);
            $table->index(['status', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settlements');
    }
};
