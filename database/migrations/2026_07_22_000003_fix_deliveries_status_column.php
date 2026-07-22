<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->string('status', 50)->default('waiting_assignment')->change();
        });
    }

    public function down(): void
    {
        // One-way migration — cannot reliably revert ENUM
    }
};
