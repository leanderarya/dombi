<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('customer_credits');

        if (Schema::hasColumn('orders', 'credit_applied')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('credit_applied');
            });
        }

        if (Schema::hasColumn('customers', 'credit_balance')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropColumn('credit_balance');
            });
        }
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->decimal('credit_balance', 12, 2)->default(0)->after('phone');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('credit_applied', 12, 2)->nullable()->after('total');
        });

        Schema::create('customer_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->string('description')->nullable();
            $table->timestamps();
        });
    }
};
