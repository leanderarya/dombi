<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductSkuGenerator
{
    public function generate(object $category, string $name, ?string $flavor, ?string $size, int $sequence = 1): string
    {
        $catPart = strtoupper(Str::substr(preg_replace('/[^A-Za-z]/', '', $category->name), 0, 3));
        $flav = $flavor ?? $name;
        $flavPart = strtoupper(Str::substr(preg_replace('/[^A-Za-z]/', '', $flav), 0, 3));
        $sizePart = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $size ?? ''));
        $sizePart = $sizePart ? "-{$sizePart}" : '';
        $seq = str_pad((string) $sequence, 3, '0', STR_PAD_LEFT);
        $sku = "{$catPart}-{$flavPart}{$sizePart}-{$seq}";

        return Str::limit($sku, 50, '');
    }

    public function uniqueForCategory(int $categoryId, string $name, ?string $flavor, ?string $size): string
    {
        $cat = ProductCategory::find($categoryId);
        $existingCount = Product::where('product_category_id', $categoryId)->count();
        $seq = $existingCount + 1;
        $base = $this->generate($cat, $name, $flavor, $size, $seq);
        $candidate = $base;
        $i = 0;
        while (Product::where('sku', $candidate)->exists()) {
            $i++;
            $candidate = $this->generate($cat, $name, $flavor, $size, $seq + $i);
        }

        return $candidate;
    }

    public function uniqueForGroup(int $groupId, string $name, ?string $flavor, ?string $size): string
    {
        return DB::transaction(function () use ($groupId, $name, $flavor, $size) {
            $group = ProductFlavorGroup::lockForUpdate()->findOrFail($groupId);
            $cat = $group->category;
            $maxSeq = 0;
            $existingSkus = Product::where('product_flavor_group_id', $groupId)->pluck('sku');
            foreach ($existingSkus as $sku) {
                if (preg_match('/-(\d+)$/', $sku, $m)) {
                    $maxSeq = max($maxSeq, (int) $m[1]);
                }
            }
            $seq = $maxSeq + 1;
            $candidate = $this->generate($cat, $name, $flavor, $size, $seq);
            $retries = 0;
            while (Product::where('sku', $candidate)->exists() && $retries < 5) {
                $retries++;
                $seq++;
                $candidate = $this->generate($cat, $name, $flavor, $size, $seq);
            }

            return $candidate;
        });
    }
}
