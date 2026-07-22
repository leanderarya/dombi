<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->foreignId('outlet_id')->nullable()->after('user_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('outlet_id');
        });
    }
};
