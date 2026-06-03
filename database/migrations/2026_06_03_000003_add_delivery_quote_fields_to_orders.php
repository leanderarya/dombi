<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('delivery_distance_km', 8, 2)->default(0)->after('delivery_fee');
            $table->foreignId('recommended_outlet_id')->nullable()->after('outlet_id')->constrained('outlets')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('recommended_outlet_id');
            $table->dropColumn('delivery_distance_km');
        });
    }
};
