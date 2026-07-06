<?php

namespace Database\Factories;

use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductVariantFactory extends Factory
{
    protected $model = ProductVariant::class;

    public function definition(): array
    {
        return [
            'product_family_id' => ProductFamily::factory(),
            'name' => $this->faker->word(),
            'is_active' => true,
        ];
    }
}
