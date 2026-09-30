<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The category page draws its delete buttons from the two policies plus a
 * per-product list. Without them the dialogs rendered every destructive button
 * enabled and let the server refuse after the fact, so the buttons now depend on
 * exactly what the policies say.
 */
class ProductCategoryDeleteCapabilityTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['role' => 'owner']);
    }

    public function test_a_clean_category_can_be_deleted_and_force_deleted(): void
    {
        $category = ProductCategory::factory()->create();

        $this->actingAs($this->owner())
            ->get("/owner/product-categories/{$category->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('owner/product-categories/show')
                ->where('canDelete', true)
                ->where('canForceDelete', true)
                ->has('deletableProductIds', 0));
    }

    public function test_a_category_with_active_products_can_be_neither_deleted(): void
    {
        $category = ProductCategory::factory()->create();
        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'is_active' => true,
        ]);

        $this->actingAs($this->owner())
            ->get("/owner/product-categories/{$category->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('canDelete', false)
                ->where('canForceDelete', false)
                // The product itself carries no history, so it stays individually
                // deletable — only the category is blocked while it is attached.
                ->where('deletableProductIds', [$product->id]));
    }

    public function test_a_soft_deletable_category_is_not_force_deletable(): void
    {
        $category = ProductCategory::factory()->create();
        $product = Product::factory()->create([
            'product_category_id' => $category->id,
            'is_active' => false,
        ]);

        $this->actingAs($this->owner())
            ->get("/owner/product-categories/{$category->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('canDelete', true)
                ->where('canForceDelete', false)
                ->where('deletableProductIds', [$product->id]));
    }

    public function test_a_product_with_business_history_is_left_out_of_the_deletable_list(): void
    {
        $outlet = Outlet::factory()->create();
        $category = ProductCategory::factory()->create();

        $clean = Product::factory()->create([
            'product_category_id' => $category->id,
            'is_active' => false,
        ]);
        $sold = Product::factory()->create([
            'product_category_id' => $category->id,
            'is_active' => false,
        ]);

        Order::factory()->create(['outlet_id' => $outlet->id]);
        $sold->orderItems()->create([
            'order_id' => Order::query()->firstOrFail()->id,
            'product_id' => $sold->id,
            'product_name' => $sold->name,
            'quantity' => 1,
            'price' => 10000,
            'subtotal' => 10000,
        ]);

        $this->actingAs($this->owner())
            ->get("/owner/product-categories/{$category->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('deletableProductIds', [$clean->id]));
    }
}
