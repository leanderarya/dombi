<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\ProductCategory;
use App\Services\ProductSkuGenerator;
use Illuminate\Database\Seeder;

class ProductCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $skuGenerator = new ProductSkuGenerator;

        $catalog = [
            [
                'name' => 'Biogoat',
                'brand' => 'Biogoat',
                'description' => 'Susu kambing Biogoat berkualitas tinggi - murni dan bernutrisi',
                'products' => [
                    ['name' => 'Original 1L', 'flavor' => 'Original', 'size' => '1L', 'center_price' => 35000, 'selling_price' => 42000],
                    ['name' => 'Chocolate 1L', 'flavor' => 'Chocolate', 'size' => '1L', 'center_price' => 40000, 'selling_price' => 48000],
                    ['name' => 'Strawberry 200ml', 'flavor' => 'Strawberry', 'size' => '200ml', 'center_price' => 12000, 'selling_price' => 15000],
                ],
            ],
            [
                'name' => 'Domilk Premium Taste',
                'brand' => 'Domilk',
                'description' => 'Susu kambing premium dengan berbagai pilihan rasa',
                'products' => [
                    ['name' => 'Coffee 200ml', 'flavor' => 'Coffee', 'size' => '200ml', 'center_price' => 12000, 'selling_price' => 15000],
                    ['name' => 'Chocolate 200ml', 'flavor' => 'Chocolate', 'size' => '200ml', 'center_price' => 12000, 'selling_price' => 15000],
                    ['name' => 'Strawberry 200ml', 'flavor' => 'Strawberry', 'size' => '200ml', 'center_price' => 12000, 'selling_price' => 15000],
                    ['name' => 'Vanilla 200ml', 'flavor' => 'Vanilla', 'size' => '200ml', 'center_price' => 12000, 'selling_price' => 15000],
                ],
            ],
        ];

        foreach ($catalog as $categoryData) {
            $products = $categoryData['products'];
            unset($categoryData['products']);

            $category = ProductCategory::updateOrCreate(
                ['name' => $categoryData['name']],
                $categoryData
            );

            foreach ($products as $index => $productData) {
                // Use ProductSkuGenerator for SKU generation
                $sku = $skuGenerator->generate(
                    $category,
                    $productData['name'],
                    $productData['flavor'],
                    $productData['size'],
                    $index + 1
                );

                // Ensure uniqueness across runs
                $existing = Product::where('sku', $sku)->first();
                if ($existing && $existing->product_category_id !== $category->id) {
                    $sku = $skuGenerator->uniqueForCategory($category->id, $productData['name'], $productData['flavor'], $productData['size']);
                }

                Product::updateOrCreate(
                    [
                        'product_category_id' => $category->id,
                        'flavor' => $productData['flavor'],
                        'size' => $productData['size'],
                    ],
                    [
                        'name' => $productData['name'],
                        'description' => $productData['flavor'].' fresh milk '.$productData['size'],
                        'sku' => $sku,
                        'center_price' => $productData['center_price'],
                        'selling_price' => $productData['selling_price'],
                        'center_stock' => 0,
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
