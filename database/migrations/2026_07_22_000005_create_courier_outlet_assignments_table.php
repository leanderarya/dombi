<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_outlet_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('courier_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->unique(['courier_profile_id', 'outlet_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_outlet_assignments');
    }
};