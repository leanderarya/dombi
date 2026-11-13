<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offline_sales', function (Blueprint $table): void {
            $table->decimal('selling_price_snapshot', 14, 2)->nullable()->after('center_price');
            $table->decimal('gross_amount', 14, 2)->nullable()->after('selling_price_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('offline_sales', function (Blueprint $table): void {
            $table->dropColumn(['selling_price_snapshot', 'gross_amount']);
        });
    }
};
