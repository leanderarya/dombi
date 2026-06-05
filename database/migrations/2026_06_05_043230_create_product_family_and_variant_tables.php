<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Product Families
        Schema::create('product_families', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('brand')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Product Variants
        Schema::create('product_variants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('flavor')->nullable();
            $table->string('size')->nullable();
            $table->string('sku')->nullable()->unique();
            $table->string('barcode')->nullable();
            $table->decimal('center_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('product_family_id');
            $table->index('sku');
            $table->index(['product_family_id', 'is_active']);
        });

        // Add product_variant_id to outlet_inventories
        Schema::table('outlet_inventories', function (Blueprint $table): void {
            $table->foreignId('product_variant_id')->nullable()->after('product_id');
            $table->index('product_variant_id');
            $table->unique(['outlet_id', 'product_variant_id']);
        });

        // Add product_variant_id to order_items
        Schema::table('order_items', function (Blueprint $table): void {
            $table->foreignId('product_variant_id')->nullable()->after('product_id');
            $table->string('variant_name_snapshot')->nullable()->after('product_name');
            $table->index('product_variant_id');
        });

        // Add product_variant_id to stock_movements
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->foreignId('product_variant_id')->nullable()->after('product_id');
            $table->index('product_variant_id');
        });

        // Add product_variant_id to restock_request_items
        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->foreignId('product_variant_id')->nullable()->after('product_id');
            $table->index('product_variant_id');
        });

        // Add product_variant_id to stock_distribution_items
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->foreignId('product_variant_id')->nullable()->after('product_id');
            $table->index('product_variant_id');
        });
    }

    public function down(): void
    {
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->dropColumn('product_variant_id');
        });

        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->dropColumn('product_variant_id');
        });

        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropColumn('product_variant_id');
        });

        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropColumn(['product_variant_id', 'variant_name_snapshot']);
        });

        Schema::table('outlet_inventories', function (Blueprint $table): void {
            $table->dropColumn('product_variant_id');
        });

        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('product_families');
    }
};
