<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * 5-phase migration:
     * 1. Capture all category image paths into temp table
     * 2. Clean up unreferenced files from disk
     * 3. Drop the column
     * 4. Null grouped product images (legacy cleanup)
     * 5. Drop temp table
     *
     * Schema-reversible (down restores column), data-irreversible.
     */
    public function up(): void
    {
        // Guard: skip if column was already dropped (idempotent)
        if (! Schema::hasColumn('product_categories', 'image')) {
            return;
        }
        // Phase 1: Capture category image paths
        Schema::create('__category_image_cleanup', function (Blueprint $table) {
            $table->id();
            $table->string('old_image_path')->nullable();
        });

        $paths = DB::table('product_categories')
            ->whereNotNull('image')
            ->pluck('image');

        $inserts = $paths->map(fn ($p) => ['old_image_path' => $p])->all();
        if (! empty($inserts)) {
            DB::table('__category_image_cleanup')->insert($inserts);
        }

        // Phase 2: Clean up unreferenced category image files
        $allPaths = DB::table('__category_image_cleanup')->pluck('old_image_path')->filter();

        foreach ($allPaths as $path) {
            if (! $path) {
                continue;
            }

            $usedByProduct = DB::table('products')->where('image', $path)->exists();
            $usedByFlavorGroup = DB::table('product_flavor_groups')->where('image', $path)->exists();

            if (! $usedByProduct && ! $usedByFlavorGroup && Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
        }

        // Phase 3: Drop the column
        Schema::table('product_categories', function (Blueprint $table) {
            $table->dropColumn('image');
        });

        // Phase 4: Null grouped product images (legacy data)
        DB::table('products')
            ->whereNotNull('product_flavor_group_id')
            ->whereNotNull('image')
            ->update(['image' => null]);

        // Phase 5: Drop temp cleanup table
        Schema::dropIfExists('__category_image_cleanup');
    }

    /**
     * Schema-reversible: restores column but data is lost.
     */
    public function down(): void
    {
        // Guard: only add if column doesn't exist
        Schema::table('product_categories', function (Blueprint $table) {
            if (! Schema::hasColumn('product_categories', 'image')) {
                $table->string('image')->nullable()->after('description');
            }
        });
    }
};
