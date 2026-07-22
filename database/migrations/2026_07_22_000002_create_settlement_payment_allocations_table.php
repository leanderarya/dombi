<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settlement_payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('settlement_payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('settlement_id')->constrained()->cascadeOnDelete();
            $table->decimal('allocated_amount', 14, 2);
            $table->timestamps();
            $table->unique(['settlement_payment_id', 'settlement_id'], 'spa_payment_settlement_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settlement_payment_allocations');
    }
};
