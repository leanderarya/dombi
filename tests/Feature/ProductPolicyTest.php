<?php

namespace Tests\Feature;

use App\Models\ExchangeRequest;
use App\Models\ExchangeRequestItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletProductPrice;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\RestockRequest;
use App\Models\RestockRequestItem;
use App\Models\ReturnRequest;
use App\Models\ReturnRequestItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Policies\ProductCategoryPolicy;
use App\Policies\ProductPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductPolicyTest extends TestCase
{
    use RefreshDatabase;

    private ProductPolicy $productPolicy;

    private ProductCategoryPolicy $categoryPolicy;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->productPolicy = new ProductPolicy;
        $this->categoryPolicy = new ProductCategoryPolicy;
        $this->user = User::factory()->create(['role' => 'owner']);
    }

    // ProductPolicy tests

    public function test_cannot_delete_product_used_in_orders(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $order = Order::factory()->create();

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 1,
            'price' => 10000,
            'subtotal' => 10000,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_cannot_delete_product_with_stock(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $outlet = Outlet::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 5,
            'reserved_stock' => 0,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_can_delete_product_with_zero_stock_inventory(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $outlet = Outlet::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 0,
            'reserved_stock' => 0,
        ]);

        $this->assertTrue($this->productPolicy->delete($this->user, $product));
    }

    public function test_cannot_delete_product_with_outlet_price(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $outlet = Outlet::factory()->create();

        OutletProductPrice::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_cannot_delete_product_with_stock_movement(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $outlet = Outlet::factory()->create();

        StockMovement::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'type' => 'restock_in',
            'quantity' => 10,
            'before_stock' => 0,
            'after_stock' => 10,
            'before_reserved' => 0,
            'after_reserved' => 0,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_cannot_delete_product_with_return_request_item(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $returnRequest = ReturnRequest::factory()->create();

        ReturnRequestItem::factory()->create([
            'return_request_id' => $returnRequest->id,
            'product_id' => $product->id,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_cannot_delete_product_with_exchange_request_item_as_product_id(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $replacement = Product::factory()->create(['product_category_id' => $cat->id]);

        $outlet = Outlet::factory()->create();
        $returnRequest = ReturnRequest::factory()->create(['outlet_id' => $outlet->id]);

        $exchangeRequest = ExchangeRequest::create([
            'return_request_id' => $returnRequest->id,
            'outlet_id' => $outlet->id,
            'requested_by' => $this->user->id,
            'status' => ExchangeRequest::STATUS_SUBMITTED,
        ]);

        ExchangeRequestItem::create([
            'exchange_request_id' => $exchangeRequest->id,
            'product_id' => $product->id,
            'replacement_product_id' => $replacement->id,
            'quantity' => 1,
            'replacement_quantity' => 1,
            'unit_price' => 10000,
            'subtotal' => 10000,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_cannot_delete_product_with_exchange_request_item_as_replacement(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $original = Product::factory()->create(['product_category_id' => $cat->id]);

        $outlet = Outlet::factory()->create();
        $returnRequest = ReturnRequest::factory()->create(['outlet_id' => $outlet->id]);

        $exchangeRequest = ExchangeRequest::create([
            'return_request_id' => $returnRequest->id,
            'outlet_id' => $outlet->id,
            'requested_by' => $this->user->id,
            'status' => ExchangeRequest::STATUS_SUBMITTED,
        ]);

        ExchangeRequestItem::create([
            'exchange_request_id' => $exchangeRequest->id,
            'product_id' => $original->id,
            'replacement_product_id' => $product->id,
            'quantity' => 1,
            'replacement_quantity' => 1,
            'unit_price' => 10000,
            'subtotal' => 10000,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_cannot_delete_product_with_restock_request_item(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $outlet = Outlet::factory()->create();

        $restockRequest = RestockRequest::create([
            'outlet_id' => $outlet->id,
            'requested_by' => $this->user->id,
            'status' => 'requested',
        ]);

        RestockRequestItem::create([
            'restock_request_id' => $restockRequest->id,
            'product_id' => $product->id,
            'requested_quantity' => 10,
        ]);

        $this->assertFalse($this->productPolicy->delete($this->user, $product));
    }

    public function test_can_delete_unused_product(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);

        $this->assertTrue($this->productPolicy->delete($this->user, $product));
    }

    public function test_can_delete_product_with_null_user(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);

        $this->assertTrue($this->productPolicy->delete(null, $product));
    }

    // ProductCategoryPolicy tests

    public function test_cannot_delete_category_with_active_products(): void
    {
        $cat = ProductCategory::factory()->create();
        Product::factory()->create(['product_category_id' => $cat->id, 'is_active' => true]);

        $this->assertFalse($this->categoryPolicy->delete($this->user, $cat));
    }

    public function test_cannot_delete_category_with_products_having_history(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id, 'is_active' => false]);
        $order = Order::factory()->create();

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 1,
            'price' => 10000,
            'subtotal' => 10000,
        ]);

        $this->assertFalse($this->categoryPolicy->delete($this->user, $cat));
    }

    public function test_can_delete_category_without_products(): void
    {
        $cat = ProductCategory::factory()->create();

        $this->assertTrue($this->categoryPolicy->delete($this->user, $cat));
    }

    public function test_can_delete_category_with_only_inactive_products_no_history(): void
    {
        $cat = ProductCategory::factory()->create();
        Product::factory()->create(['product_category_id' => $cat->id, 'is_active' => false]);

        $this->assertTrue($this->categoryPolicy->delete($this->user, $cat));
    }

    public function test_cannot_delete_category_with_stock_history(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id, 'is_active' => false]);
        $outlet = Outlet::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
        ]);

        $this->assertFalse($this->categoryPolicy->delete($this->user, $cat));
    }

    public function test_product_policy_force_delete_same_as_delete(): void
    {
        $cat = ProductCategory::factory()->create();
        $product = Product::factory()->create(['product_category_id' => $cat->id]);
        $order = Order::factory()->create();

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 1,
            'price' => 10000,
            'subtotal' => 10000,
        ]);

        $this->assertFalse($this->productPolicy->forceDelete($this->user, $product));

        $cleanProduct = Product::factory()->create(['product_category_id' => $cat->id]);
        $this->assertTrue($this->productPolicy->forceDelete($this->user, $cleanProduct));
    }
}
