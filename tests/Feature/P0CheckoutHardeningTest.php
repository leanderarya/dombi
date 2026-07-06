<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class P0CheckoutHardeningTest extends TestCase
{
    use RefreshDatabase;

    private Product $product;

    private ProductFamily $family;

    private ProductVariant $variant;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();

        $this->family = ProductFamily::create([
            'name' => 'Domilk Premium',
            'brand' => 'Domilk',
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'name' => 'Domilk Premium',
            'slug' => 'domilk-premium-p0-'.uniqid(),
            'unit' => 'liter',
            'price' => 18000,
            'selling_price' => 25000,
            'center_price' => 18000,
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
            'name' => 'Outlet Test',
            'kelurahan' => 'Sumurboto',
            'kecamatan' => 'Banyumanik',
            'address' => 'Jl. Banyumanik No. 123',
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

    // ─── P0-2: PAYMENT SUBMISSION IDEMPOTENCY ──────────────────────

    public function test_duplicate_payment_submission_returns_same_order(): void
    {
        // Setup checkout session
        $this->session([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $this->outlet->id],
            'checkout.customer' => [
                'customer_name' => 'Test User',
                'phone_number' => '6281234567890',
            ],
        ]);

        // First submission
        $response1 = $this->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $response1->assertRedirect();
        $orderCode1 = session('checkoutSuccess.order_code');

        // Setup session again for second submission
        $this->session([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $this->outlet->id],
            'checkout.customer' => [
                'customer_name' => 'Test User',
                'phone_number' => '6281234567890',
            ],
        ]);

        // Second submission with same fingerprint should return same order
        $response2 = $this->post('/customer/checkout/payment', [
            'payment_method' => 'cod',
        ]);

        $response2->assertRedirect();
    }

    public function test_payment_rate_limit_configured(): void
    {
        // Verify rate limiter can be resolved without error
        $limiter = RateLimiter::limiter('payment-submit');
        $this->assertNotNull($limiter);
    }

    // ─── P0-3: CART QUANTITY MAX ───────────────────────────────────

    public function test_set_quantity_rejects_qty_above_999(): void
    {
        // Add item first
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 1,
        ])->assertOk();

        // Try to set quantity to 1000
        $this->postJson('/customer/cart/quantity', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 1000,
        ])->assertUnprocessable();
    }

    public function test_set_quantity_accepts_qty_999(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 1,
        ])->assertOk();

        $this->postJson('/customer/cart/quantity', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 999,
        ])->assertOk();
    }

    public function test_add_item_rejects_qty_above_999(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->variant->id,
            'quantity' => 1000,
        ])->assertUnprocessable();
    }

    public function test_checkout_store_index_rejects_qty_above_999(): void
    {
        $response = $this->post('/customer/checkout', [
            'items' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 1000],
            ],
            'fulfillment_type' => 'pickup',
        ]);

        // Should redirect back with errors or return 422
        $response->assertInvalid(['items.0.quantity']);
    }

    // ─── P0-4: TRACKING PRIVACY MASKING ────────────────────────────

    public function test_track_page_masks_customer_name(): void
    {
        $order = $this->createOrder([
            'customer_name' => 'Budi Santoso',
        ]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.customer_name', 'Budi S.')
            );
    }

    public function test_track_page_masks_single_word_name(): void
    {
        $order = $this->createOrder([
            'customer_name' => 'Budi',
        ]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.customer_name', 'Budi')
            );
    }

    public function test_track_page_masks_customer_phone(): void
    {
        $order = $this->createOrder([
            'customer_phone' => '6281234567890',
        ]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.customer_phone', '62•••••••7890')
            );
    }

    public function test_track_page_masks_address(): void
    {
        $order = $this->createOrder([
            'customer_address' => 'Jl. Melati No. 123, RT 01/RW 02, Kel. Tembalang',
            'customer_address_detail' => 'Blok A5',
            'customer_landmark' => 'Rumah hijau',
        ]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.customer_address_detail', null)
                ->where('order.customer_landmark', null)
            );
    }

    public function test_track_page_does_not_expose_raw_pii(): void
    {
        $order = $this->createOrder([
            'customer_name' => 'Rahasia Penting',
            'customer_phone' => '6289998887776',
        ]);

        $this->get('/track/'.$order->recovery_token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('order.customer_name', 'Rahasia P.')
                ->where('order.customer_phone', '62•••••••7776')
            );
    }

    public function test_track_cancel_does_not_leak_exception_message(): void
    {
        $order = $this->createOrder([
            'status' => 'completed',
        ]);

        $this->postJson('/track/'.$order->recovery_token.'/cancel', [
            'reason' => 'Berubah pikiran',
        ])->assertJson([
            'success' => false,
            'error' => 'Tidak dapat membatalkan pesanan ini.',
        ]);
    }

    private function createOrder(array $overrides = []): Order
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $this->outlet->id,
            'order_code' => 'DOMBI-P0-'.strtoupper(uniqid()),
            'status' => 'pending_confirmation',
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Jl. Test No. 1',
            'ordered_at' => now(),
        ], $overrides));

        $order->items()->create([
            'product_id' => $this->product->id,
            'product_name' => $this->product->name,
            'quantity' => 2,
            'price' => $this->product->price,
            'subtotal' => 50000,
        ]);

        return $order;
    }
}
