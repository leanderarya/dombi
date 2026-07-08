<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->decimal('latitude', 10, 7)->nullable()->after('is_online');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->timestamp('location_updated_at')->nullable()->after('longitude');
            $table->enum('vehicle_type', ['motorcycle', 'bicycle', 'car'])->nullable()->after('location_updated_at');
            $table->string('vehicle_plate', 20)->nullable()->after('vehicle_type');
            $table->string('photo')->nullable()->after('vehicle_plate');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['latitude', 'longitude', 'location_updated_at', 'vehicle_type', 'vehicle_plate', 'photo']);
        });
    }
};
