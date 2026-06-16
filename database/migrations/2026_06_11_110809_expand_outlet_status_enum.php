<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('outlets', function (Blueprint $table) {
            $table->string('status')->default('active')->change();
        });
    }

    public function down(): void
    {
        // Revert to enum is not safe; leave as string
    }
};
