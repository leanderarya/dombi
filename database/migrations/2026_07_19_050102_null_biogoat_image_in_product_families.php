<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('product_families')
            ->where('name', 'Biogoat')
            ->update(['image' => null]);
    }

    public function down(): void
    {
        DB::table('product_families')
            ->where('name', 'Biogoat')
            ->update(['image' => 'https://images.unsplash.com/photo-1587334274328-64186a80aaee?w=400&h=400&fit=crop&q=80']);
    }
};
