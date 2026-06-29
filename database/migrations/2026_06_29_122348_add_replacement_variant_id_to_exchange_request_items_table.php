<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('exchange_request_items', function (Blueprint $table): void {
            $table->foreignId('replacement_variant_id')->nullable()->after('product_variant_id')->constrained('product_variants')->nullOnDelete();
            $table->unsignedInteger('replacement_quantity')->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('exchange_request_items', function (Blueprint $table): void {
            $table->dropForeign(['replacement_variant_id']);
            $table->dropColumn(['replacement_variant_id', 'replacement_quantity']);
        });
    }
};
