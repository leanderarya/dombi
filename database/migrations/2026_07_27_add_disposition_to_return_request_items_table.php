<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('return_request_items', function (Blueprint $table) {
            $table->string('disposition')->nullable()->after('subtotal');
            $table->timestamp('disposed_at')->nullable()->after('disposition');
            $table->foreignId('disposed_by')->nullable()->constrained('users')->after('disposed_at');
        });
    }

    public function down(): void
    {
        Schema::table('return_request_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('disposed_by');
            $table->dropColumn(['disposition', 'disposed_at']);
        });
    }
};
