<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add last_activity_at to users for auto-offline tracking
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('last_activity_at')->nullable()->after('shift_ended_at');
        });

        // Add rejection and return fields to deliveries
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->string('rejection_reason')->nullable()->after('failed_reason');
            $table->text('rejection_note')->nullable()->after('rejection_reason');
            $table->timestamp('rejected_at')->nullable()->after('rejection_note');

            $table->string('return_status')->nullable()->after('delivery_note');
            $table->foreignId('return_confirmed_by')->nullable()->after('return_status');
            $table->timestamp('return_confirmed_at')->nullable()->after('return_confirmed_by');
            $table->text('return_notes')->nullable()->after('return_confirmed_at');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropColumn([
                'rejection_reason', 'rejection_note', 'rejected_at',
                'return_status', 'return_confirmed_by', 'return_confirmed_at', 'return_notes',
            ]);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('last_activity_at');
        });
    }
};
