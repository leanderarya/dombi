<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->text('address_line')->nullable()->after('address');
            $table->string('province')->nullable()->after('kecamatan');
            $table->string('city')->nullable()->after('province');
            $table->string('district')->nullable()->after('city');
            $table->string('village')->nullable()->after('district');
            $table->string('postal_code', 20)->nullable()->after('village');
            $table->string('landmark')->nullable()->after('longitude');
            $table->text('delivery_notes')->nullable()->after('landmark');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->index('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['phone']);
        });

        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->dropColumn([
                'address_line',
                'province',
                'city',
                'district',
                'village',
                'postal_code',
                'landmark',
                'delivery_notes',
            ]);
        });
    }
};
