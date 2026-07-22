<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->string('courier_source')->nullable()->after('user_id');
            $table->foreignId('nominated_by')->nullable()->constrained('users')->nullOnDelete()->after('courier_source');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete()->after('nominated_by');
            $table->timestamp('approved_at')->nullable()->after('approved_by');
        });
    }

    public function down(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->dropColumn(['courier_source', 'nominated_by', 'approved_by', 'approved_at']);
        });
    }
};