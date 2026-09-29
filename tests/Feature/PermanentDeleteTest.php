<?php

namespace Tests\Feature;

use App\Models\OfflineSale;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Settlement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Permanent delete must never be able to erase business history. Every refusal
 * asserts the same two things: the request is rejected AND the records behind it
 * are still there.
 */
class PermanentDeleteTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => 'owner',
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }

    // ── Outlets ──────────────────────────────────────────────────────────

    public function test_an_outlet_with_an_order_cannot_be_deleted_permanently(): void
    {
        $outlet = Outlet::factory()->create();
        $order = Order::factory()->create(['outlet_id' => $outlet->id]);

        $this->actingAs($this->owner)
            ->delete(route('owner.outlets.force-destroy', $outlet))
            ->assertSessionHasErrors('outlet');

        $this->assertNotNull(Outlet::find($outlet->id), 'The outlet must survive.');
        $this->assertNotNull(Order::find($order->id), 'The order must survive.');
    }

    public function test_an_outlet_with_a_settlement_cannot_be_deleted_permanently(): void
    {
        $outlet = Outlet::factory()->create();
        $settlement = Settlement::factory()->create(['outlet_id' => $outlet->id]);

        $this->actingAs($this->owner)
            ->delete(route('owner.outlets.force-destroy', $outlet))
            ->assertSessionHasErrors('outlet');

        $this->assertNotNull(Outlet::find($outlet->id));
        $this->assertNotNull(Settlement::find($settlement->id), 'The settlement must survive.');
    }

    public function test_an_outlet_with_stock_movements_cannot_be_deleted_permanently(): void
    {
        $outlet = Outlet::factory()->create();

        DB::table('stock_movements')->insert([
            'outlet_id' => $outlet->id,
            'type' => 'initial_stock',
            'quantity' => 10,
        ]);

        $this->actingAs($this->owner)
            ->delete(route('owner.outlets.force-destroy', $outlet))
            ->assertSessionHasErrors('outlet');

        $this->assertNotNull(Outlet::find($outlet->id));
    }

    public function test_an_outlet_with_no_history_is_deleted_permanently(): void
    {
        $outletUser = User::factory()->create([
            'role' => 'outlet',
            'is_active' => true,
            'must_change_password' => false,
        ]);

        $outlet = Outlet::factory()->create(['user_id' => $outletUser->id]);
        $outletUser->update(['outlet_id' => $outlet->id]);

        $this->actingAs($this->owner)
            ->delete(route('owner.outlets.force-destroy', $outlet))
            ->assertRedirect(route('owner.outlets.index'));

        $this->assertNull(
            Outlet::withTrashed()->find($outlet->id),
            'The row must be gone, not merely soft deleted.',
        );

        $outletUser->refresh();
        $this->assertNull($outletUser->outlet_id, 'The operational account must be detached.');
        $this->assertFalse((bool) $outletUser->is_active, 'The operational account must be disabled.');
    }

    // ── Products ─────────────────────────────────────────────────────────

    public function test_a_product_sold_offline_cannot_be_deleted_permanently(): void
    {
        $outlet = Outlet::factory()->create();
        $product = Product::factory()->create();

        // offline_sales.product_id cascades, so this guard is what stops a hard
        // delete from quietly taking settlement revenue with it.
        $sale = OfflineSale::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'quantity' => 2,
            'center_price' => 10000,
            'total_amount' => 20000,
            'payment_method' => 'cash',
            'created_by' => $this->owner->id,
        ]);

        $this->actingAs($this->owner)
            ->delete(route('owner.products.force-destroy', $product))
            ->assertSessionHasErrors('business_history');

        $this->assertNotNull(Product::withTrashed()->find($product->id), 'The product must survive.');
        $this->assertNotNull(OfflineSale::find($sale->id), 'The offline sale must survive.');
    }

    public function test_a_clean_product_is_deleted_permanently(): void
    {
        $product = Product::factory()->create();

        $this->actingAs($this->owner)
            ->delete(route('owner.products.force-destroy', $product))
            ->assertRedirect();

        $this->assertNull(Product::withTrashed()->find($product->id));
    }

    public function test_a_soft_deleted_product_can_still_be_deleted_permanently(): void
    {
        $product = Product::factory()->create();
        $product->delete();

        $this->assertNotNull(Product::withTrashed()->find($product->id));

        $this->actingAs($this->owner)
            ->delete(route('owner.products.force-destroy', $product))
            ->assertRedirect();

        $this->assertNull(Product::withTrashed()->find($product->id));
    }

    // ── Categories ───────────────────────────────────────────────────────

    public function test_a_category_holding_products_cannot_be_deleted_permanently(): void
    {
        $category = ProductCategory::factory()->create();
        Product::factory()->create(['product_category_id' => $category->id]);

        $this->actingAs($this->owner)
            ->delete(route('owner.product-categories.force-destroy', $category))
            ->assertRedirect();

        $this->assertNotNull(ProductCategory::withTrashed()->find($category->id));
    }

    public function test_a_category_holding_only_soft_deleted_products_is_still_blocked(): void
    {
        $category = ProductCategory::factory()->create();
        Product::factory()->create(['product_category_id' => $category->id])->delete();

        $this->actingAs($this->owner)
            ->delete(route('owner.product-categories.force-destroy', $category))
            ->assertRedirect();

        $this->assertNotNull(
            ProductCategory::withTrashed()->find($category->id),
            'Deleting the category would null the category on its trashed products.',
        );
    }

    public function test_an_empty_category_is_deleted_permanently(): void
    {
        $category = ProductCategory::factory()->create();

        $this->actingAs($this->owner)
            ->delete(route('owner.product-categories.force-destroy', $category))
            ->assertRedirect(route('owner.product-categories.index'));

        $this->assertNull(ProductCategory::withTrashed()->find($category->id));
    }
}
