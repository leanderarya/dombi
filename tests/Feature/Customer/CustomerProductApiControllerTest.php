<?php

namespace Tests\Feature\Customer;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerProductApiControllerTest extends TestCase
{
    use DatabaseTransactions;

    public function test_stock_status_uses_minimum_stock_threshold(): void
    {
        $outlet = Outlet::factory()->create();
        $family = ProductCategory::factory()->create();
        $variant = Product::factory()->create(['product_category_id' => $family->id]);

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 2,
            'minimum_stock' => 10,
        ]);

        $response = $this->getJson("/customer/products/api?outlet_id={$outlet->id}");

        // available = 10 - 2 = 8, which is > 5 (old threshold) but <= 10 (minimum_stock)
        $response->assertOk()
            ->assertJsonPath('families.0.variants.0.stock_status', 'low')
            ->assertJsonPath('families.0.variants.0.available_stock', 8);
    }

    public function test_stock_status_out_of_stock(): void
    {
        $outlet = Outlet::factory()->create();
        $family = ProductCategory::factory()->create();
        $variant = Product::factory()->create(['product_category_id' => $family->id]);

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 5,
        ]);

        $response = $this->getJson("/customer/products/api?outlet_id={$outlet->id}");

        $response->assertOk()
            ->assertJsonPath('families.0.variants.0.stock_status', 'out_of_stock')
            ->assertJsonPath('families.0.variants.0.available_stock', 0);
    }
}
