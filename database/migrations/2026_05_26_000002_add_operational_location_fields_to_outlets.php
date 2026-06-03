<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outlets', function (Blueprint $table): void {
            $table->string('city')->nullable()->after('kecamatan');
            $table->string('province')->nullable()->after('city');
            $table->string('postal_code')->nullable()->after('province');
            $table->text('operational_notes')->nullable()->after('phone');
            $table->unsignedSmallInteger('delivery_radius_km')->nullable()->after('operational_notes');
            $table->unsignedSmallInteger('prep_estimate_minutes')->nullable()->after('delivery_radius_km');
        });
    }

    public function down(): void
    {
        Schema::table('outlets', function (Blueprint $table): void {
            $table->dropColumn([
                'city',
                'province',
                'postal_code',
                'operational_notes',
                'delivery_radius_km',
                'prep_estimate_minutes',
            ]);
        });
    }
};
