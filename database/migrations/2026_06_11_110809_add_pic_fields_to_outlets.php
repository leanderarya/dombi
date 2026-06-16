<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outlets', function (Blueprint $table) {
            $table->string('pic_name')->nullable()->after('phone');
            $table->string('pic_phone')->nullable()->after('pic_name');
            $table->string('pic_position')->nullable()->after('pic_phone');
        });
    }

    public function down(): void
    {
        Schema::table('outlets', function (Blueprint $table) {
            $table->dropColumn(['pic_name', 'pic_phone', 'pic_position']);
        });
    }
};
