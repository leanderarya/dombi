<?php

namespace Database\Factories;

use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReturnRequestItemFactory extends Factory
{
    protected $model = ReturnRequestItem::class;

    public function definition(): array
    {
        return [
            'return_request_id' => ReturnRequest::factory(),
            'product_variant_id' => ProductVariant::factory(),
            'quantity' => 1,
            'unit_price' => 10000,
            'subtotal' => 10000,
        ];
    }
}
