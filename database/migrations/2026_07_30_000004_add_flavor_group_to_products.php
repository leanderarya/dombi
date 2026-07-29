<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $t) {
            $t->foreignId('product_flavor_group_id')->nullable()->after('product_category_id')->constrained('product_flavor_groups')->cascadeOnDelete();
            $t->integer('size_value')->nullable()->after('size');
            $t->string('size_unit')->nullable()->after('size_value');
            $t->string('normalized_size')->nullable()->after('size_unit');
        });
        Schema::table('products', function (Blueprint $t) {
            $t->unique(['product_flavor_group_id', 'normalized_size']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $t) {
            try {
                $t->dropForeign(['product_flavor_group_id']);
            } catch (Exception $e) {
            }
            try {
                $t->dropUnique(['product_flavor_group_id', 'normalized_size']);
            } catch (Exception $e) {
            }
            $t->dropColumn(['product_flavor_group_id', 'size_value', 'size_unit', 'normalized_size']);
        });
    }
};
