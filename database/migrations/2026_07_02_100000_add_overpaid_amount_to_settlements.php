<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settlements', function (Blueprint $table): void {
            $table->decimal('overpaid_amount', 12, 2)->default(0)->after('adjustment_amount');
        });
    }

    public function down(): void
    {
        Schema::table('settlements', function (Blueprint $table): void {
            $table->dropColumn('overpaid_amount');
        });
    }
};
