<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecipientCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private Product $product;

    private ProductVariant $variant;

    private Outlet $outlet;

    private User $user;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->product = Product::create([
            'name' => 'Domilk Premium',
            'slug' => 'domilk-premium-recipient-'.uniqid(),
            'unit' => 'liter',
            'price' => 18000,
            'selling_price' => 25000,
            'center_price' => 18000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create([
            'name' => 'Domilk Premium',
            'brand' => 'Domilk',
            'is_active' => true,
        ]);

        $this->variant = ProductVariant::create([
            'product_family_id' => $family->id,
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

        $this->user = User::factory()->create([
            'role' => 'customer',
            'is_active' => true,
            'name' => 'Budi Santoso',
        ]);

        $this->customer = Customer::create([
            'name' => 'Budi Santoso',
            'phone' => '6281234567890',
            'user_id' => $this->user->id,
            'is_registered' => true,
        ]);
    }

    public function test_delivery_recipient_prefilled_from_account(): void
    {
        $this->actingAs($this->user);

        $this->session([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
        ]);

        $this->get('/customer/checkout/customer')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('recipientDefaults.name', 'Budi Santoso')
                ->where('recipientDefaults.phone', '6281234567890')
            );
    }

    public function test_delivery_recipient_saves_to_order_not_profile(): void
    {
        $this->actingAs($this->user);

        $this->session([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
                'selected_outlet_id' => null,
            ],
            'checkout.customer' => [
                'customer_name' => 'Budi Santoso',
                'phone_number' => '6281234567890',
                'existing_customer_id' => $this->customer->id,
                'recipient_name' => 'Siti Rahayu',
                'recipient_phone' => '6289876543210',
            ],
            'checkout.location' => [
                'latitude' => -7.0500000,
                'longitude' => 110.4300000,
                'address_line' => 'Jl. Test',
            ],
        ]);

        $this->post('/customer/checkout/payment', [
            'payment_method' => 'qris',
            'payment_status' => 'paid',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();

        $this->assertSame('Siti Rahayu', $order->recipient_name);
        $this->assertSame('6289876543210', $order->recipient_phone);

        $this->assertSame('Budi Santoso', $order->customer_name);

        $this->customer->refresh();
        $this->assertSame('Budi Santoso', $this->customer->name);
        $this->assertSame('6281234567890', $this->customer->phone);
    }

    public function test_delivery_recipient_falls_back_to_orderer_when_empty(): void
    {
        $this->actingAs($this->user);

        $this->session([
            'checkout.cart' => [
                ['product_variant_id' => $this->variant->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
                'selected_outlet_id' => null,
            ],
            'checkout.customer' => [
                'customer_name' => 'Budi Santoso',
                'phone_number' => '6281234567890',
                'existing_customer_id' => $this->customer->id,
            ],
            'checkout.location' => [
                'latitude' => -7.0500000,
                'longitude' => 110.4300000,
                'address_line' => 'Jl. Test',
            ],
        ]);

        $this->post('/customer/checkout/payment', [
            'payment_method' => 'qris',
            'payment_status' => 'paid',
        ])->assertRedirect();

        $order = Order::latest()->firstOrFail();

        $this->assertNull($order->recipient_name);
        $this->assertNull($order->recipient_phone);

        $this->assertSame('Budi Santoso', $order->customer_name);
    }

    public function test_pickup_flow_unchanged(): void
    {
        $this->actingAs($this->user);

        $this->get('/customer/home')
            ->assertOk();
    }

    public function test_guest_delivery_requires_login(): void
    {
        $this->session([
            'checkout.fulfillment' => ['fulfillment_type' => 'delivery_dombi'],
        ]);

        $this->post('/customer/checkout/customer', [
            'customer_name' => 'Guest User',
            'phone_number' => '6281111222333',
        ])->assertRedirect('/customer/checkout/login-prompt');
    }
}
