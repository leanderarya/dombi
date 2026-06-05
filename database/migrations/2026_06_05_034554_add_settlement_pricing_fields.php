<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add settlement pricing to products
        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('center_price', 12, 2)->nullable()->after('price');
            $table->decimal('selling_price', 12, 2)->nullable()->after('center_price');
        });

        // Backfill: set center_price = price, selling_price = price for existing products
        DB::table('products')->update([
            'center_price' => DB::raw('price'),
            'selling_price' => DB::raw('price'),
        ]);

        // Make non-nullable after backfill
        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('center_price', 12, 2)->default(0)->change();
            $table->decimal('selling_price', 12, 2)->default(0)->change();
        });

        // Add price snapshots to order_items
        Schema::table('order_items', function (Blueprint $table): void {
            $table->decimal('center_price_snapshot', 12, 2)->nullable()->after('price');
            $table->decimal('selling_price_snapshot', 12, 2)->nullable()->after('center_price_snapshot');
            $table->decimal('outlet_margin_snapshot', 12, 2)->nullable()->after('selling_price_snapshot');
        });

        // Backfill existing order items from product prices
        if (DB::getDriverName() === 'mysql') {
            DB::statement('
                UPDATE order_items oi
                JOIN products p ON oi.product_id = p.id
                SET 
                    oi.center_price_snapshot = p.center_price,
                    oi.selling_price_snapshot = p.selling_price,
                    oi.outlet_margin_snapshot = p.selling_price - p.center_price
                WHERE oi.center_price_snapshot IS NULL
            ');
        } else {
            // SQLite-compatible backfill
            DB::statement('
                UPDATE order_items SET 
                    center_price_snapshot = (SELECT center_price FROM products WHERE products.id = order_items.product_id),
                    selling_price_snapshot = (SELECT selling_price FROM products WHERE products.id = order_items.product_id),
                    outlet_margin_snapshot = (SELECT selling_price - center_price FROM products WHERE products.id = order_items.product_id)
                WHERE center_price_snapshot IS NULL
            ');
        }
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table): void {
            $table->dropColumn(['center_price_snapshot', 'selling_price_snapshot', 'outlet_margin_snapshot']);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['center_price', 'selling_price']);
        });
    }
};
