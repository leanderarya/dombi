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
        Schema::table('restock_requests', function (Blueprint $table): void {
            $table->enum('status', ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'received', 'completed', 'cancelled'])->default('requested')->change();
        });
    }

    public function down(): void
    {
        Schema::table('restock_requests', function (Blueprint $table): void {
            $table->enum('status', ['requested', 'approved', 'rejected', 'preparing', 'shipped', 'received', 'completed'])->default('requested')->change();
        });
    }
};
