<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->string('nominee_name')->nullable()->after('nominated_by');
            $table->string('nominee_phone')->nullable()->after('nominee_name');
        });
    }

    public function down(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->dropColumn(['nominee_name', 'nominee_phone']);
        });
    }
};
