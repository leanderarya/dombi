<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settlement_reconciliation_issues', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('settlement_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('open');
            $table->json('settlement_snapshot');
            $table->json('source_snapshot');
            $table->timestamp('detected_at');
            $table->timestamps();
            $table->index(['settlement_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settlement_reconciliation_issues');
    }
};
