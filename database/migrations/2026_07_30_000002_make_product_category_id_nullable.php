<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products') && Schema::hasColumn('products', 'product_category_id')) {
            Schema::table('products', function (Blueprint $t) {
                // Drop FK first if exists, make nullable, re-add FK
                try {
                    $t->dropForeign(['product_category_id']);
                } catch (Exception $e) {
                    // FK may not exist
                }
                $t->unsignedBigInteger('product_category_id')->nullable()->change();
                try {
                    $t->foreign('product_category_id')->references('id')->on('product_categories')->cascadeOnDelete();
                } catch (Exception $e) {
                    // FK re-creation may fail if not needed
                }
            });
        }
    }

    public function down(): void
    {
        // no-op; NOT NULL constraint not enforced
    }
};
