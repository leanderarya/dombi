<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->string('address_detail', 500)->nullable()->after('address_line');
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->string('customer_address_detail', 500)->nullable()->after('customer_address');
            $table->string('customer_landmark', 500)->nullable()->after('customer_address_detail');
        });
    }

    public function down(): void
    {
        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->dropColumn('address_detail');
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['customer_address_detail', 'customer_landmark']);
        });
    }
};
