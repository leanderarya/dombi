<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('recovery_token', 8)->nullable()->unique()->after('order_code');
        });

        // Generate tokens for existing orders
        $orders = DB::table('orders')->whereNull('recovery_token')->get();
        foreach ($orders as $order) {
            DB::table('orders')->where('id', $order->id)->update([
                'recovery_token' => strtoupper(bin2hex(random_bytes(3))),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('recovery_token');
        });
    }
};
