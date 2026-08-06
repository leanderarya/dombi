<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settlements', function (Blueprint $table) {
            $table->decimal('total_online_share', 14, 2)->default(0)->after('delivery_fee_amount');
            $table->decimal('total_delivery_cost', 14, 2)->default(0)->after('total_online_share');
            $table->decimal('total_refund', 14, 2)->default(0)->after('total_delivery_cost');
            $table->decimal('total_offline_sales', 14, 2)->default(0)->after('total_refund');
            $table->decimal('net_amount', 14, 2)->default(0)->after('total_offline_sales');
            $table->string('direction', 20)->default('outlet_pays_owner')->after('net_amount');
        });
    }

    public function down(): void
    {
        Schema::table('settlements', function (Blueprint $table) {
            $table->dropColumn([
                'total_online_share',
                'total_delivery_cost',
                'total_refund',
                'total_offline_sales',
                'net_amount',
                'direction',
            ]);
        });
    }
};
