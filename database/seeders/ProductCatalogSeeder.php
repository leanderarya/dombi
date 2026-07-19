<?php

namespace Database\Seeders;

use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Database\Seeder;

class ProductCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            [
                'name' => 'Domilk Original',
                'brand' => 'Domilk',
                'description' => 'Susu kambing murni original tanpa perisa',
                'image' => 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop&q=80',
                'variants' => [
                    ['flavor' => 'Original', 'size' => '250ml', 'center_price' => 10000, 'selling_price' => 12000],
                    ['flavor' => 'Original', 'size' => '1L', 'center_price' => 35000, 'selling_price' => 42000],
                ],
            ],
            [
                'name' => 'Domilk Premium Taste',
                'brand' => 'Domilk',
                'description' => 'Susu kambing premium dengan berbagai pilihan rasa',
                'image' => 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=400&fit=crop&q=80',
                'variants' => [
                    ['flavor' => 'Coklat', 'size' => '250ml', 'center_price' => 12000, 'selling_price' => 15000],
                    ['flavor' => 'Coklat', 'size' => '1L', 'center_price' => 40000, 'selling_price' => 48000],
                    ['flavor' => 'Vanilla', 'size' => '250ml', 'center_price' => 12000, 'selling_price' => 15000],
                    ['flavor' => 'Vanilla', 'size' => '1L', 'center_price' => 40000, 'selling_price' => 48000],
                    ['flavor' => 'Stroberi', 'size' => '250ml', 'center_price' => 12000, 'selling_price' => 15000],
                    ['flavor' => 'Stroberi', 'size' => '1L', 'center_price' => 40000, 'selling_price' => 48000],
                    ['flavor' => 'Coffee', 'size' => '250ml', 'center_price' => 12000, 'selling_price' => 15000],
                    ['flavor' => 'Coffee', 'size' => '1L', 'center_price' => 40000, 'selling_price' => 48000],
                ],
            ],
            [
                'name' => 'Biogoat',
                'brand' => 'Biogoat',
                'description' => 'Susu kambing biogoat berkualitas tinggi',
                'image' => null,
                'variants' => [
                    ['flavor' => 'Original', 'size' => '250ml', 'center_price' => 11000, 'selling_price' => 13000],
                    ['flavor' => 'Original', 'size' => '1L', 'center_price' => 38000, 'selling_price' => 45000],
                ],
            ],
            [
                'name' => 'Raw Milk by Domilk',
                'brand' => 'Domilk',
                'description' => 'Susu kambing mentah segar tanpa pasteurisasi',
                'image' => 'https://images.unsplash.com/photo-1523473827533-2a64d0d36748?w=400&h=400&fit=crop&q=80',
                'variants' => [
                    ['flavor' => 'Fresh', 'size' => '1L', 'center_price' => 25000, 'selling_price' => 30000],
                ],
            ],
        ];

        foreach ($catalog as $familyData) {
            $variants = $familyData['variants'];
            unset($familyData['variants']);

            $family = ProductFamily::updateOrCreate(
                ['name' => $familyData['name']],
                $familyData
            );

            foreach ($variants as $variantData) {
                $sku = strtoupper(substr($family->brand ?? 'DMB', 0, 3))
                    .'-'.strtoupper(substr($variantData['flavor'], 0, 3))
                    .'-'.str_replace(['ml', 'L'], ['', 'L'], $variantData['size']);

                $variantName = $variantData['flavor'].' '.$variantData['size'];

                // Prefix brand to avoid duplicate names across families
                // e.g., "Biogoat Original 250ml" vs "Domilk Original 250ml"
                if ($family->brand && $variantData['flavor'] === 'Original') {
                    $variantName = $family->brand.' '.$variantData['flavor'].' '.$variantData['size'];
                }

                ProductVariant::updateOrCreate(
                    ['sku' => $sku],
                    [
                        'product_family_id' => $family->id,
                        'product_id' => null,
                        'name' => $variantName,
                        'flavor' => $variantData['flavor'],
                        'size' => $variantData['size'],
                        'center_price' => $variantData['center_price'],
                        'selling_price' => $variantData['selling_price'],
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
