<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_flavor_groups', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_category_id')->constrained('product_categories')->cascadeOnDelete();
            $t->string('flavor');
            $t->string('normalized_flavor');
            $t->text('description')->nullable();
            $t->string('image')->nullable();
            $t->boolean('is_active')->default(true);
            $t->softDeletes();
            $t->timestamps();
            $t->unique(['product_category_id', 'normalized_flavor'], 'pfg_cat_flavor_unique');
            $t->index(['product_category_id', 'is_active'], 'pfg_cat_active_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_flavor_groups');
    }
};
