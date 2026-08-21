<?php

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        ProductCategory::all()->each(function (ProductCategory $cat) {
            $this->backfillFlavoredGroups($cat);
            $this->backfillNullFlavorGroups($cat);
        });
    }

    private function backfillFlavoredGroups(ProductCategory $cat): void
    {
        $products = Product::where('product_category_id', $cat->id)
            ->whereNotNull('flavor')
            ->get();

        $groups = $products->groupBy(fn (Product $p) => mb_strtolower(trim($p->flavor)));

        foreach ($groups as $norm => $groupProducts) {
            $first = $groupProducts->first();
            $fg = ProductFlavorGroup::firstOrCreate(
                ['product_category_id' => $cat->id, 'normalized_flavor' => $norm],
                ['flavor' => $first->flavor, 'image' => $groupProducts->whereNotNull('image')->first()?->image]
            );
            Product::whereIn('id', $groupProducts->pluck('id'))
                ->update(['product_flavor_group_id' => $fg->id]);
        }
    }

    private function backfillNullFlavorGroups(ProductCategory $cat): void
    {
        $products = Product::where('product_category_id', $cat->id)
            ->whereNull('flavor')
            ->get();

        foreach ($products as $p) {
            $flavorName = trim(preg_replace('/\d+\s*(ml|l|g|kg)\s*$/i', '', $p->name));
            if (empty($flavorName)) {
                $flavorName = 'Regular';
            }
            $norm = mb_strtolower(trim($flavorName));
            $fg = ProductFlavorGroup::firstOrCreate(
                ['product_category_id' => $cat->id, 'normalized_flavor' => $norm],
                ['flavor' => $flavorName]
            );
            $p->update(['product_flavor_group_id' => $fg->id]);
        }
    }

    public function down(): void
    {
        DB::table('products')->update(['product_flavor_group_id' => null]);
        DB::table('product_flavor_groups')->delete();
    }
};
