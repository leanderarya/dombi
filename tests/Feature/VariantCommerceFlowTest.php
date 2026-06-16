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

    // ─── PART 10: END-TO-END TEST ────────────────────────────────────

    public function test_end_to_end_variant_checkout_creates_order_with_inventory_and_settlement(): void
    {
        // Step 1: Add variant to cart (product-detail POSTs to /customer/checkout)
        $this->post('/customer/checkout', [
            'items' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
        ])->assertRedirect('/customer/checkout')
            ->assertSessionHas('checkout.cart.0.product_variant_id', $this->variant->id)
            ->assertSessionHas('checkout.cart.0.quantity', 2);

        // Step 2: Choose fulfillment type (checkout/index POSTs to /customer/checkout)
        $this->post('/customer/checkout', [
            'items' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'fulfillment_type' => 'pickup',
        ])->assertRedirect('/customer/checkout/customer')
            ->assertSessionHas('checkout.fulfillment.fulfillment_type', 'pickup');

        // Step 3: Submit customer info
        $this->post('/customer/checkout/customer', [
            'customer_name' => 'Budi Santoso',
            'phone_number' => '081234567890',
            'selected_outlet_id' => $this->outlet->id,
        ])->assertRedirect('/customer/checkout/payment')
            ->assertSessionHas('checkout.customer.customer_name', 'Budi Santoso')
            ->assertSessionHas('checkout.customer.phone_number', '6281234567890');

        // Step 4: Submit payment and create order
        $this->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ])->assertRedirect();

        // Verify order created
        $order = Order::latest()->firstOrFail();
        $this->assertSame('pending_confirmation', $order->status);
        $this->assertSame('pickup', $order->fulfillment_type);
        $this->assertSame('cod', $order->payment_method);
        $this->assertSame('Budi Santoso', $order->customer_name);
        $this->assertSame('6281234567890', $order->customer_phone);
        $this->assertEquals(50000.0, (float) $order->subtotal);
        $this->assertEquals(0.0, (float) $order->delivery_fee);
        $this->assertEquals(0.0, (float) $order->payment_fee);
        $this->assertEquals(50000.0, (float) $order->total);

        // Verify order items
        $item = $order->items()->firstOrFail();
        $this->assertEquals($this->variant->id, $item->product_variant_id);
        $this->assertEquals($this->product->id, $item->product_id);
        $this->assertSame('Domilk Premium Taste', $item->product_name);
        $this->assertSame('Coffee 1L', $item->variant_name_snapshot);
        $this->assertEquals(2, $item->quantity);
        $this->assertEquals(25000.0, (float) $item->price);
        $this->assertEquals(18000.0, (float) $item->center_price_snapshot);
        $this->assertEquals(25000.0, (float) $item->selling_price_snapshot);
        $this->assertEquals(7000.0, (float) $item->outlet_margin_snapshot);
        $this->assertEquals(50000.0, (float) $item->subtotal);

        // Verify inventory reserved
        $inventory = OutletInventory::where('outlet_id', $this->outlet->id)
            ->where('product_variant_id', $this->variant->id)
            ->firstOrFail();
        $this->assertEquals(50, $inventory->current_stock);
        $this->assertEquals(2, $inventory->reserved_stock);

        // Verify stock movement recorded
        $this->assertDatabaseHas('stock_movements', [
            'outlet_id' => $this->outlet->id,
            'product_variant_id' => $this->variant->id,
            'type' => 'order_reserved',
            'quantity' => 2,
            'reference_type' => Order::class,
            'reference_id' => $order->id,
        ]);

        // Verify settlement snapshot can be generated
        $settlementService = app(SettlementService::class);

        // Simulate order completion
        $order->update(['status' => 'completed']);
        $settlementService->recordSale($order);

        $this->assertDatabaseHas('outlet_payables', [
            'outlet_id' => $this->outlet->id,
            'order_id' => $order->id,
            'type' => 'sale',
            'amount' => 50000.0,
        ]);

        $payable = OutletPayable::where('order_id', $order->id)->where('type', 'sale')->firstOrFail();
        $this->assertEquals(36000.0, (float) $payable->center_share);
        $this->assertEquals(14000.0, (float) $payable->outlet_margin);

        // Verify settlement summary
        $summary = $settlementService->getOutletSummary($this->outlet->id);
        $this->assertEquals(50000.0, $summary['gross_revenue']);
        $this->assertEquals(36000.0, $summary['center_share']);
        $this->assertEquals(14000.0, $summary['outlet_margin']);
        $this->assertEquals(2, $summary['units_sold']);
        $this->assertEquals(1, $summary['orders_count']);
    }

    // ─── PART 11: REGRESSION TESTS ───────────────────────────────────

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
        // Step 1: Cart page shows variant data
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

        // Step 2: Customer page shows variant data
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

        // Step 3: Payment page shows variant data
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
        $this->seedVariantCheckoutDraft();

        $this->post('/customer/checkout/payment', [
            'payment_method' => 'qris',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();
        $item = $order->items()->firstOrFail();

        $this->assertEquals($this->variant->id, $item->product_variant_id);
        $this->assertEquals($this->product->id, $item->product_id);
        $this->assertSame('Domilk Premium Taste', $item->product_name);
        $this->assertSame('Coffee 1L', $item->variant_name_snapshot);
        $this->assertEquals(25000.0, (float) $item->price);
        $this->assertEquals(18000.0, (float) $item->center_price_snapshot);
        $this->assertEquals(25000.0, (float) $item->selling_price_snapshot);
        $this->assertEquals(7000.0, (float) $item->outlet_margin_snapshot);
    }

    public function test_variant_inventory_reservation_decrements_available_stock(): void
    {
        $this->seedVariantCheckoutDraft();

        $this->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $inventory = OutletInventory::where('outlet_id', $this->outlet->id)
            ->where('product_variant_id', $this->variant->id)
            ->firstOrFail();

        $this->assertEquals(50, $inventory->current_stock, 'current_stock should not change on reservation');
        $this->assertEquals(3, $inventory->reserved_stock, 'reserved_stock should increase by order quantity');
        $this->assertEquals(47, $inventory->available_stock, 'available_stock should decrease');
    }

    public function test_variant_settlement_snapshot_calculates_center_share_and_margin(): void
    {
        $this->seedVariantCheckoutDraft();

        $this->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();
        $order->update(['status' => 'completed']);

        $settlementService = app(SettlementService::class);
        $settlementService->recordSale($order);

        $payable = OutletPayable::where('order_id', $order->id)->where('type', 'sale')->firstOrFail();

        // center_share = center_price_snapshot * quantity = 18000 * 3 = 54000
        $this->assertEquals(54000.0, (float) $payable->center_share);

        // outlet_margin = outlet_margin_snapshot * quantity = 7000 * 3 = 21000
        $this->assertEquals(21000.0, (float) $payable->outlet_margin);

        // amount = order total = 75000
        $this->assertEquals(75000.0, (float) $payable->amount);
    }

    public function test_variant_stock_movement_records_variant_id(): void
    {
        $this->seedVariantCheckoutDraft();

        $this->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();

        $this->assertDatabaseHas('stock_movements', [
            'outlet_id' => $this->outlet->id,
            'product_variant_id' => $this->variant->id,
            'type' => 'order_reserved',
            'quantity' => 3,
            'reference_type' => Order::class,
            'reference_id' => $order->id,
        ]);
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
        $product2 = Product::create([
            'name' => 'Domilk Premium Taste Small',
            'slug' => 'domilk-premium-taste-small',
            'unit' => 'liter',
            'price' => 10000,
            'selling_price' => 15000,
            'center_price' => 10000,
            'is_active' => true,
        ]);

        $variant2 = ProductVariant::create([
            'product_family_id' => $this->family->id,
            'product_id' => $product2->id,
            'name' => 'Coffee 500ml',
            'flavor' => 'Coffee',
            'size' => '500ml',
            'center_price' => 10000,
            'selling_price' => 15000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $product2->id,
            'product_variant_id' => $variant2->id,
            'current_stock' => 30,
            'reserved_stock' => 0,
            'minimum_stock' => 5,
        ]);

        $this->withSession([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
                ['product_variant_id' => $variant2->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup'],
            'checkout.customer' => [
                'customer_name' => 'Multi Variant',
                'phone_number' => '6281234567890',
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();
        $this->assertEquals(2, $order->items()->count());

        // subtotal = (25000 * 2) + (15000 * 1) = 65000
        $this->assertEquals(65000.0, (float) $order->subtotal);
        $this->assertEquals(65000.0, (float) $order->total);
    }

    // ─── HELPERS ─────────────────────────────────────────────────────

    private function seedVariantCheckoutDraft(): void
    {
        $this->withSession([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 3],
            ],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup'],
            'checkout.customer' => [
                'customer_name' => 'Test Variant User',
                'phone_number' => '6281234567890',
            ],
        ]);
    }
}
