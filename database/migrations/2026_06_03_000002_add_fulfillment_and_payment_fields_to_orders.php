<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('fulfillment_type')->default('delivery_dombi')->after('status');
            $table->string('payment_method')->nullable()->after('delivery_fee');
            $table->decimal('payment_fee', 12, 2)->default(0)->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn([
                'fulfillment_type',
                'payment_method',
                'payment_fee',
            ]);
        });
    }
};
