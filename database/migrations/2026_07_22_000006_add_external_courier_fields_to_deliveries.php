<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->string('courier_type', 20)->default('dombi')->after('courier_id');
            $table->string('external_courier_name', 100)->nullable()->after('courier_type');
            $table->string('external_courier_phone', 20)->nullable()->after('external_courier_name');
            $table->string('external_plate_number', 20)->nullable()->after('external_courier_phone');
            $table->decimal('courier_cost', 14, 2)->nullable()->after('external_plate_number');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropColumn(['courier_type', 'external_courier_name', 'external_courier_phone', 'external_plate_number', 'courier_cost']);
        });
    }
};