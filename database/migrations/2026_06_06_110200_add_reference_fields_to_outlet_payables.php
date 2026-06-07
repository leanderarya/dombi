<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outlet_payables', function (Blueprint $table): void {
            $table->string('reference_type')->nullable()->after('order_id');
            $table->unsignedBigInteger('reference_id')->nullable()->after('reference_type');
            $table->index(['reference_type', 'reference_id'], 'outlet_payables_reference_index');
        });
    }

    public function down(): void
    {
        Schema::table('outlet_payables', function (Blueprint $table): void {
            $table->dropIndex('outlet_payables_reference_index');
            $table->dropColumn(['reference_type', 'reference_id']);
        });
    }
};
