<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryServiceProductRefactorTest extends TestCase
{
    use RefreshDatabase;

    public function test_initial_stock_creates_movement(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id, 'center_stock' => 0]);
        app(\App\Services\InventoryService::class)->updateCenterStock($product->id, 100, 'Stok awal');
        $this->assertDatabaseHas('stock_movements', ['product_id' => $product->id, 'type' => 'initial_stock', 'quantity' => 100]);
    }

    public function test_adjustment_type_when_not_initial(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id, 'center_stock' => 50]);
        app(\App\Services\InventoryService::class)->updateCenterStock($product->id, 100, 'Penyesuaian rutin');
        $this->assertDatabaseHas('stock_movements', ['product_id' => $product->id, 'type' => 'stock_adjustment', 'quantity' => 50]);
    }

    public function test_initial_stock_detection_without_artist_keyword(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id, 'center_stock' => 0]);
        app(\App\Services\InventoryService::class)->updateCenterStock($product->id, 10, 'First batch');
        $this->assertDatabaseHas('stock_movements', ['product_id' => $product->id, 'type' => 'initial_stock']);
    }
}
