<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_tiers', function (Blueprint $table) {
            $table->id();
            $table->decimal('min_km', 6, 2)->default(0);
            $table->decimal('max_km', 6, 2);
            $table->decimal('fee', 10, 2);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_tiers');
    }
};
