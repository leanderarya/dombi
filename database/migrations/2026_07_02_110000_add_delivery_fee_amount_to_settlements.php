<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settlements', function (Blueprint $table): void {
            $table->decimal('delivery_fee_amount', 12, 2)->default(0)->after('sales_amount');
        });
    }

    public function down(): void
    {
        Schema::table('settlements', function (Blueprint $table): void {
            $table->dropColumn('delivery_fee_amount');
        });
    }
};
