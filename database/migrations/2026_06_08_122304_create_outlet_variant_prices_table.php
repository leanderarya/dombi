<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outlet_variant_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->decimal('selling_price', 12, 2);
            $table->timestamps();

            $table->unique(['outlet_id', 'product_variant_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outlet_variant_prices');
    }
};
