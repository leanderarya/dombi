<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'gateway_fee')) {
                $table->decimal('gateway_fee', 12, 2)->default(0)->after('payment_fee');
            }
            if (! Schema::hasColumn('orders', 'absorbed_fee')) {
                $table->decimal('absorbed_fee', 12, 2)->default(0)->after('gateway_fee');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'gateway_fee')) {
                $table->dropColumn('gateway_fee');
            }
            if (Schema::hasColumn('orders', 'absorbed_fee')) {
                $table->dropColumn('absorbed_fee');
            }
        });
    }
};
