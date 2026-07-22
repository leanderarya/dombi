<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\WithTestOutlet;

class CartFlowHardeningTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    private Product $product;

    private ProductFamily $family;

    private ProductVariant $variant;

    private ProductVariant $variant2;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->product = Product::create([
            'name' => 'Domilk Premium Taste',
            'slug' => 'domilk-premium-cart',
            'unit' => 'liter',
            'price' => 18000,
            'selling_price' => 25000,
            'center_price' => 18000,
            'is_active' => true,
        ]);

        $this->family = ProductFamily::create([
            'name' => 'Domilk Premium Taste',
            'brand' => 'Domilk',
            'description' => 'Susu premium',
            'is_active' => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_family_id' => $this->family->id,
            'product_id' => $this->product->id,
            'name' => 'Coffee 1L',
            'flavor' => 'Coffee',
            'size' => '1L',
            'center_price' => 18000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        $this->variant2 = ProductVariant::create([
            'product_family_id' => $this->family->id,
            'product_id' => $this->product->id,
            'name' => 'Vanilla 250ml',
            'flavor' => 'Vanilla',
            'size' => '250ml',
            'center_price' => 8000,
            'selling_price' => 12000,
            'is_active' => true,
        ]);

        $this->outlet = $this->withOutletSession();

        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'product_variant_id' => $this->variant->id,
            'current_stock' => 50,
            'reserved_stock' => 0,
            'minimum_stock' => 5,
        ]);

        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'product_variant_id' => $this->variant2->id,
            'current_stock' => 30,
            'reserved_stock' => 0,
            'minimum_stock' => 5,
        ]);
    }

    // ─── ADD TO CART VIA NEW ENDPOINT ───────────────────────────────

    public function test_add_single_item_to_cart_returns_json(): void
    {
        $response = $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 2,
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'item' => [
                    'product_variant_id' => $this->variant->id,
                    'quantity' => 2,
                    'available_stock' => 50,
                    'max_quantity' => 50,
                ],
            ]);
    }

    public function test_add_item_stores_in_session(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 2,
        ])->assertOk();

        $cart = session('checkout.cart');
        $this->assertCount(1, $cart);
        $this->assertEquals($this->variant->id, $cart[0]['product_variant_id']);
        $this->assertEquals(2, $cart[0]['quantity']);
    }

    public function test_add_item_does_not_redirect(): void
    {
        $response = $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 1,
        ]);

        // Should return 200 JSON, not a redirect
        $response->assertOk();
        $response->assertJson(['success' => true]);
    }

    // ─── MULTIPLE VARIANTS ──────────────────────────────────────────

    public function test_add_multiple_variants_to_cart(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 2,
        ])->assertOk();

        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant2->id,
            'quantity' => 1,
        ])->assertOk();

        $cart = session('checkout.cart');
        $this->assertCount(2, $cart);
        $this->assertEquals(2, $cart[0]['quantity']);
        $this->assertEquals(1, $cart[1]['quantity']);
    }

    // ─── QUANTITY MERGE ─────────────────────────────────────────────

    public function test_add_same_variant_merges_quantity(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 2,
        ])->assertOk();

        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 3,
        ])->assertOk();

        $cart = session('checkout.cart');
        $this->assertCount(1, $cart);
        $this->assertEquals(5, $cart[0]['quantity']);
    }

    public function test_merge_returns_updated_cart_count(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 2,
        ])->assertJson([
            'success' => true,
            'item' => [
                'product_variant_id' => $this->variant->id,
                'quantity' => 2,
                'available_stock' => 50,
                'max_quantity' => 50,
            ],
        ]);

        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 3,
        ])->assertJson([
            'success' => true,
            'item' => [
                'product_variant_id' => $this->variant->id,
                'quantity' => 3,
                'available_stock' => 50,
                'max_quantity' => 50,
            ],
        ]);
    }

    // ─── VALIDATION ─────────────────────────────────────────────────

    public function test_add_inactive_variant_rejected(): void
    {
        $this->variant->update(['is_active' => false]);

        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 1,
        ])->assertUnprocessable();
    }

    public function test_add_with_zero_quantity_rejected(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 0,
        ])->assertUnprocessable();
    }

    public function test_add_nonexistent_variant_rejected(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => 99999,
            'quantity' => 1,
        ])->assertUnprocessable();
    }

    // ─── CHECKOUT STILL WORKS ───────────────────────────────────────

    public function test_cart_items_appear_in_checkout_after_add(): void
    {
        // Add item via new endpoint
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 2,
        ])->assertOk();

        // Visit checkout page - should show items from session
        $this->get('/customer/checkout')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/index')
                ->has('draft.items', 1)
                ->where('draft.items.0.product_variant_id', $this->variant->id)
                ->where('draft.items.0.quantity', 2)
            );
    }

    public function test_full_checkout_flow_with_add_to_cart(): void
    {
        // Add item
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 2,
        ])->assertOk();

        // Submit checkout with fulfillment
        $this->post('/customer/checkout', [
            'items' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'fulfillment_type' => 'pickup',
        ])->assertRedirect('/customer/checkout/customer');
    }

    // ─── REORDER COMPATIBILITY ──────────────────────────────────────

    public function test_reorder_restores_cart_and_checkout_works(): void
    {
        // Create a customer with a completed order
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $this->outlet->id,
            'order_code' => 'DOMBI-REORDER-TEST',
            'status' => 'completed',
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Test',
            'ordered_at' => now(),
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $this->product->id,
            'product_variant_id' => $this->variant->id,
            'product_name' => 'Domilk Premium Taste',
            'variant_name_snapshot' => 'Coffee 1L',
            'quantity' => 2,
            'price' => 25000,
            'subtotal' => 50000,
        ]);

        // Restore cart from order
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer->update(['user_id' => $user->id]);

        $this->actingAs($user)
            ->get('/customer/orders/'.$order->id.'/restore-cart')
            ->assertRedirect('/customer/checkout');

        // Verify cart was restored
        $cart = session('checkout.cart');
        $this->assertNotNull($cart);
        $this->assertCount(1, $cart);
        $this->assertEquals($this->variant->id, $cart[0]['product_variant_id']);
    }
}
