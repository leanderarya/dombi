<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offline_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('center_price', 12, 2);
            $table->decimal('total_amount', 12, 2);
            $table->string('notes', 500)->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['outlet_id', 'created_at']);
            $table->index('product_variant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_sales');
    }
};
