<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletProductPrice;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_category_has_products_relation(): void
    {
        $cat = ProductCategory::factory()->create(['name' => 'Biogoat']);
        $prod = Product::factory()->create([
            'product_category_id' => $cat->id,
            'name' => 'Original 1L',
        ]);

        $this->assertEquals(1, $cat->products()->count());
        $this->assertEquals('Biogoat - Original 1L', $prod->full_display_name);
    }

    public function test_product_category_active_products_filters_inactive(): void
    {
        $cat = ProductCategory::factory()->create();
        Product::factory()->create(['product_category_id' => $cat->id, 'is_active' => true]);
        Product::factory()->create(['product_category_id' => $cat->id, 'is_active' => false]);

        $this->assertEquals(2, $cat->products()->count());
        $this->assertEquals(1, $cat->activeProducts()->count());
    }

    public function test_product_belongs_to_category(): void
    {
        $cat = ProductCategory::factory()->create(['name' => 'Domilk']);
        $prod = Product::factory()->create(['product_category_id' => $cat->id]);

        $this->assertEquals($cat->id, $prod->category->id);
        $this->assertEquals('Domilk', $prod->category->name);
    }

    public function test_product_outlet_margin_accessor(): void
    {
        $prod = Product::factory()->create([
            'center_price' => 30000,
            'selling_price' => 40000,
        ]);

        $this->assertEquals(10000.0, $prod->outlet_margin);
    }

    public function test_product_margin_percent_accessor(): void
    {
        $prod = Product::factory()->create([
            'center_price' => 20000,
            'selling_price' => 25000,
        ]);

        $this->assertEquals(25.0, $prod->margin_percent);

        $zero = Product::factory()->create([
            'center_price' => 0,
            'selling_price' => 10000,
        ]);
        $this->assertEquals(0.0, $zero->margin_percent);
    }

    public function test_product_full_display_name_without_category(): void
    {
        $prod = Product::factory()->make([
            'name' => 'Solo Product',
            'product_category_id' => null,
        ]);
        $prod->setRelation('category', null);
        // Without persisted category, should just return name
        $this->assertEquals('Solo Product', $prod->full_display_name);
    }

    public function test_product_available_stock_sums_inventories(): void
    {
        $prod = Product::factory()->create();
        $outlet1 = Outlet::factory()->create();
        $outlet2 = Outlet::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet1->id,
            'product_id' => $prod->id,
            'current_stock' => 10,
            'reserved_stock' => 2,
        ]);
        OutletInventory::factory()->create([
            'outlet_id' => $outlet2->id,
            'product_id' => $prod->id,
            'current_stock' => 5,
            'reserved_stock' => 1,
        ]);

        $prod->load('inventories');
        $this->assertEquals(12, $prod->available_stock); // (10-2)+(5-1)=12
    }

    public function test_product_stock_status(): void
    {
        // out_of_stock when both center and available <=0
        $prodOut = Product::factory()->create(['center_stock' => 0]);
        $this->assertEquals('out_of_stock', $prodOut->stock_status);

        // low when center_stock <=5 or available <=5
        $prodLowCenter = Product::factory()->create(['center_stock' => 3]);
        $this->assertEquals('low', $prodLowCenter->stock_status);

        $prodLowAvail = Product::factory()->create(['center_stock' => 100]);
        $outlet = Outlet::factory()->create();
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $prodLowAvail->id,
            'current_stock' => 3,
            'reserved_stock' => 0,
        ]);
        $prodLowAvail->load('inventories');
        $this->assertEquals('low', $prodLowAvail->stock_status);

        // available
        $prodAvail = Product::factory()->create(['center_stock' => 20]);
        $outlet2 = Outlet::factory()->create();
        OutletInventory::factory()->create([
            'outlet_id' => $outlet2->id,
            'product_id' => $prodAvail->id,
            'current_stock' => 20,
            'reserved_stock' => 0,
        ]);
        $prodAvail->load('inventories');
        $this->assertEquals('available', $prodAvail->stock_status);
    }

    public function test_product_price_for_outlet_with_override_and_fallback(): void
    {
        $prod = Product::factory()->create(['selling_price' => 40000]);
        $outlet = Outlet::factory()->create();
        $outlet2 = Outlet::factory()->create();

        OutletProductPrice::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $prod->id,
            'selling_price' => 45000,
        ]);

        $this->assertEquals(45000.0, $prod->priceForOutlet($outlet->id));
        $this->assertEquals(40000.0, $prod->priceForOutlet($outlet2->id));
    }

    public function test_product_soft_deletes(): void
    {
        $prod = Product::factory()->create();
        $id = $prod->id;
        $prod->delete();

        $this->assertSoftDeleted('products', ['id' => $id]);
        $this->assertNotNull(Product::withTrashed()->find($id));
    }

    public function test_product_category_soft_deletes(): void
    {
        $cat = ProductCategory::factory()->create();
        $id = $cat->id;
        $cat->delete();

        $this->assertSoftDeleted('product_categories', ['id' => $id]);
    }
}
