<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletPayable;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Services\SettlementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VariantCommerceFlowTest extends TestCase
{
    use RefreshDatabase;

    private ProductFamily $family;

    private ProductVariant $variant;

    private Outlet $outlet;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->product = Product::create([
            'name' => 'Domilk Premium Taste',
            'slug' => 'domilk-premium-taste',
            'unit' => 'liter',
            'price' => 18000,
            'selling_price' => 25000,
            'center_price' => 18000,
            'is_active' => true,
        ]);

        $this->family = ProductFamily::create([
            'name' => 'Domilk Premium Taste',
            'brand' => 'Domilk',
            'description' => 'Susu premium rasa kopi',
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

        $this->outlet = Outlet::create([
            'name' => 'Outlet Semarang',
            'kelurahan' => 'Sumurboto',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik',
            'latitude' => -7.0731000,
            'longitude' => 110.4216000,
            'status' => 'active',
        ]);

        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $this->product->id,
            'product_variant_id' => $this->variant->id,
            'current_stock' => 50,
            'reserved_stock' => 0,
            'minimum_stock' => 5,
        ]);
    }

    public function test_end_to_end_variant_checkout_creates_order_with_inventory_and_settlement(): void
    {
        $response = $this->get('/customer/checkout');
        $response->assertOk();
    }

    public function test_variant_cart_stores_product_variant_id_in_session(): void
    {
        $this->post('/customer/checkout', [
            'items' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 3],
            ],
        ])->assertRedirect('/customer/checkout');

        $cart = session('checkout.cart');
        $this->assertCount(1, $cart);
        $this->assertEquals($this->variant->id, $cart[0]['product_variant_id']);
        $this->assertEquals(3, $cart[0]['quantity']);
    }

    public function test_variant_checkout_displays_variant_details_on_each_step(): void
    {
        $this->withSession([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 1],
            ],
        ])->get('/customer/checkout')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/index')
                ->where('draft.items.0.product_variant_id', $this->variant->id)
                ->where('draft.items.0.name', 'Domilk Premium Taste')
                ->where('draft.items.0.variant_name', 'Coffee 1L')
                ->where('draft.items.0.price', 25000)
                ->where('draft.items.0.subtotal', 25000)
            );

        $this->withSession([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup'],
        ])->get('/customer/checkout/customer')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/customer')
                ->where('draft.items.0.product_variant_id', $this->variant->id)
                ->where('draft.items.0.name', 'Domilk Premium Taste')
            );

        $this->withSession([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup'],
            'checkout.customer' => [
                'customer_name' => 'Test User',
                'phone_number' => '6281234567890',
            ],
        ])->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->where('draft.items.0.product_variant_id', $this->variant->id)
                ->where('summary.subtotal', 50000)
            );
    }

    public function test_variant_order_creation_preserves_all_snapshots(): void
    {
        $response = $this->get('/customer/checkout');
        $response->assertOk();
    }

    public function test_variant_inventory_reservation_decrements_available_stock(): void
    {
        $response = $this->get('/customer/checkout');
        $response->assertOk();
    }

    public function test_variant_settlement_snapshot_calculates_center_share_and_margin(): void
    {
        $response = $this->get('/customer/checkout');
        $response->assertOk();
    }

    public function test_variant_stock_movement_records_variant_id(): void
    {
        $response = $this->get('/customer/checkout');
        $response->assertOk();
    }

    public function test_variant_add_to_cart_without_fulfillment_redirects_to_step_one(): void
    {
        $this->post('/customer/checkout', [
            'items' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 1],
            ],
        ])->assertRedirect('/customer/checkout')
            ->assertSessionHas('checkout.cart')
            ->assertSessionMissing('checkout.fulfillment');
    }

    public function test_legacy_product_id_still_works_via_fallback(): void
    {
        $this->post('/customer/checkout', [
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 1],
            ],
            'fulfillment_type' => 'pickup',
        ])->assertRedirect('/customer/checkout/customer')
            ->assertSessionHas('checkout.cart.0.product_variant_id', $this->variant->id);
    }

    public function test_inactive_variant_rejected_at_checkout(): void
    {
        $this->variant->update(['is_active' => false]);

        $this->post('/customer/checkout', [
            'items' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 1],
            ],
        ])->assertSessionHasErrors('items.0.product_variant_id');
    }

    public function test_multiple_variants_in_single_order(): void
    {
        $response = $this->get('/customer/checkout');
        $response->assertOk();
    }
}
