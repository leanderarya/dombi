<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->string('external_provider', 20)
                ->nullable()
                ->after('courier_type');
            $table->string('external_reference', 100)
                ->nullable()
                ->after('external_plate_number');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropColumn(['external_provider', 'external_reference']);
        });
    }
};
