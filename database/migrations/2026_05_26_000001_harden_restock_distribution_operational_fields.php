<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_distributions', function (Blueprint $table): void {
            $table->text('received_notes')->nullable()->after('received_at');
            $table->text('damage_notes')->nullable()->after('received_notes');
            $table->unique('restock_request_id');
        });
    }

    public function down(): void
    {
        Schema::table('stock_distributions', function (Blueprint $table): void {
            $table->dropUnique(['restock_request_id']);
            $table->dropColumn(['received_notes', 'damage_notes']);
        });
    }
};
