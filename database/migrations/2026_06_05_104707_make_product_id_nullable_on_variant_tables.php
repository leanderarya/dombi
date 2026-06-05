<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // restock_request_items: make product_id nullable
        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->foreignId('product_id')->nullable()->change();
        });
        // Drop and re-add FK with nullOnDelete
        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
        });
        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        // stock_distribution_items: make product_id nullable
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->foreignId('product_id')->nullable()->change();
        });
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
        });
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        // stock_movements: make product_id nullable
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->foreignId('product_id')->nullable()->change();
        });
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
        });
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });
    }

    public function down(): void
    {
        // stock_movements: restore NOT NULL
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
        });
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->foreignId('product_id')->nullable(false)->change();
        });
        Schema::table('stock_movements', function (Blueprint $table): void {
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        // stock_distribution_items: restore NOT NULL
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
        });
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->foreignId('product_id')->nullable(false)->change();
        });
        Schema::table('stock_distribution_items', function (Blueprint $table): void {
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });

        // restock_request_items: restore NOT NULL
        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
        });
        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->foreignId('product_id')->nullable(false)->change();
        });
        Schema::table('restock_request_items', function (Blueprint $table): void {
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });
    }
};
