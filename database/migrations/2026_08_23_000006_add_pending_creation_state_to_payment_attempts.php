<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->enum('creation_state', ['initiated', 'pending', 'created', 'unknown', 'failed'])->default('initiated')->change();
        });
    }

    public function down(): void
    {
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->enum('creation_state', ['initiated', 'created', 'unknown', 'failed'])->default('initiated')->change();
        });
    }
};
