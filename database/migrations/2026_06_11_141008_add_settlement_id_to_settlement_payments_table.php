<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settlement_payments', function (Blueprint $table) {
            $table->foreignId('settlement_id')->nullable()->after('outlet_id');
        });
    }

    public function down(): void
    {
        Schema::table('settlement_payments', function (Blueprint $table) {
            $table->dropColumn('settlement_id');
        });
    }
};
