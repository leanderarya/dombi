<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletOperatingHours;
use App\Models\Product;
use App\Models\User;
use App\Services\DeliveryPricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\WithTestOutlet;

class DeliveryPricingTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outlet = $this->withOutletSession();
    }

    public function test_delivery_pricing_service_calculates_fee_for_serviceable_distance(): void
    {
        $service = app(DeliveryPricingService::class);

        $quote = $service->quote(
            customerLat: -7.0523456,
            customerLng: 110.4345678,
            outletLat: -7.0610000,
            outletLng: 110.4310000,
        );

        $this->assertTrue($quote['is_serviceable']);
        $this->assertGreaterThan(0, $quote['distance_km']);
        $this->assertSame(5000.0, $quote['delivery_fee']);
    }

    public function test_delivery_pricing_service_marks_location_outside_service_radius_as_unserviceable(): void
    {
        $service = app(DeliveryPricingService::class);

        $quote = $service->quote(
            customerLat: -7.0523456,
            customerLng: 110.4345678,
            outletLat: -6.9000000,
            outletLng: 110.7000000,
        );

        $this->assertFalse($quote['is_serviceable']);
        $this->assertSame(0.0, $quote['delivery_fee']);
    }

    public function test_checkout_payment_summary_includes_delivery_fee_for_dombi_delivery(): void
    {
        $product = $this->createStockedProduct();

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 2],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
                'selected_outlet_id' => $this->outlet->id,
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
            'checkout.location' => $this->locationDraft(),
        ])->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->where('summary.delivery_fee', 5000)
                ->where('summary.delivery_quote.is_serviceable', true)
            );
    }

    public function test_checkout_blocks_non_serviceable_dombi_delivery_on_submit(): void
    {
        $product = $this->createStockedProduct();

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
                'selected_outlet_id' => $this->outlet->id,
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
            'checkout.location' => [
                ...$this->locationDraft(),
                'latitude' => -6.9000000,
                'longitude' => 110.7000000,
            ],
        ])->post('/customer/checkout/payment', [
            'payment_method' => 'qris',
            'payment_status' => 'paid',
        ])->assertRedirect('/customer/checkout/customer')
            ->assertSessionHasErrors(['latitude']);

        $this->assertNull(Order::query()->first());
    }

    public function test_home_page_returns_service_status_with_location(): void
    {
        $this->createStockedProduct();

        // serviceStatus was removed from HomeController — home no longer loads delivery data
        $this->withSession([
            'checkout.location' => $this->locationDraft(),
        ])->get('/customer/home')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/home')
                ->missing('serviceStatus')
            );
    }

    public function test_home_page_returns_null_service_status_without_location(): void
    {
        $this->get('/customer/home')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/home')
                ->missing('serviceStatus')
            );
    }

    public function test_checkout_index_returns_delivery_tiers_and_preview(): void
    {
        $product = $this->createStockedProduct();

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'selected_outlet_id' => $this->outlet->id,
            ],
            'checkout.location' => $this->locationDraft(),
        ])->get('/customer/checkout')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/index')
                ->has('deliveryTiers')
                ->has('deliveryPreview')
                ->where('deliveryPreview.is_serviceable', true)
                ->has('nearestOutlet')
            );
    }

    public function test_checkout_customer_returns_delivery_tiers(): void
    {
        $product = $this->createStockedProduct();

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
                'selected_outlet_id' => $this->outlet->id,
            ],
            'checkout.location' => $this->locationDraft(),
        ])->get('/customer/checkout/customer')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/customer')
                ->has('deliveryTiers')
                ->has('deliveryQuote')
            );
    }

    public function test_checkout_payment_returns_delivery_tiers(): void
    {
        $product = $this->createStockedProduct();

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
                'selected_outlet_id' => $this->outlet->id,
            ],
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
            'checkout.location' => $this->locationDraft(),
        ])->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->has('deliveryTiers')
            );
    }

    private function createStockedProduct(): Product
    {
        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        return $product;
    }

    private function locationDraft(): array
    {
        return [
            'address_line' => 'Jl. Ngesrep Timur V No. 12',
            'province' => 'Jawa Tengah',
            'city' => 'Kota Semarang',
            'district' => 'Banyumanik',
            'village' => 'Sumurboto',
            'postal_code' => '50269',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'landmark' => 'Dekat minimarket',
            'delivery_notes' => 'Rumah pagar hijau',
        ];
    }

    private function createOutlet(float $lat, float $lng): Outlet
    {
        $outlet = Outlet::factory()->create([
            'status' => 'active',
            'latitude' => $lat,
            'longitude' => $lng,
        ]);

        OutletOperatingHours::factory()->create([
            'outlet_id' => $outlet->id,
            'day_of_week' => (int) now('Asia/Jakarta')->format('w'),
            'open_time' => '00:00',
            'close_time' => '23:59',
            'is_closed' => false,
        ]);

        return $outlet;
    }

    private function withStock(Outlet $outlet, Product $product): void
    {
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);
    }

    public function test_checkout_quote_honors_selected_outlet_when_serviceable(): void
    {
        $product = $this->createStockedProduct();
        $farOutlet = $this->createOutlet(-7.0300000, 110.4500000);
        $this->withStock($farOutlet, $product);

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
            ],
            'checkout.selected_outlet_id' => $farOutlet->id,
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
            'checkout.location' => $this->locationDraft(),
        ])->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->where('summary.delivery_quote.outlet.id', $farOutlet->id)
                ->where('summary.delivery_fee', 8000)
            );
    }

    public function test_checkout_quote_marks_selected_outlet_unserviceable_when_out_of_range(): void
    {
        $product = $this->createStockedProduct();
        $farOutlet = $this->createOutlet(-6.9000000, 110.7000000);
        $this->withStock($farOutlet, $product);

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
            ],
            'checkout.selected_outlet_id' => $farOutlet->id,
            'checkout.customer' => [
                'customer_name' => 'Sarah Dombi',
                'phone_number' => '6281234567890',
            ],
            'checkout.location' => $this->locationDraft(),
        ])->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->where('summary.delivery_quote.outlet.id', $farOutlet->id)
                ->where('summary.delivery_quote.is_serviceable', false)
            );
    }

    public function test_store_customer_preserves_selected_outlet_for_delivery(): void
    {
        $product = $this->createStockedProduct();
        $farOutlet = $this->createOutlet(-7.0300000, 110.4500000);
        $this->withStock($farOutlet, $product);

        $user = User::factory()->create(['role' => 'customer']);
        $user->customer()->create([
            'name' => 'Test Customer',
            'phone' => '6281234567890',
        ]);

        $this->actingAs($user)->withSession([
            'checkout.cart' => [
                ['product_id' => $product->id, 'quantity' => 1],
            ],
            'checkout.fulfillment' => [
                'fulfillment_type' => 'delivery_dombi',
            ],
            'checkout.selected_outlet_id' => $farOutlet->id,
        ])->post('/customer/checkout/customer', [
            'customer_name' => 'Sarah Dombi',
            'phone_number' => '6281234567890',
            'address_line' => 'Jl. Ngesrep Timur V No. 12',
            'province' => 'Jawa Tengah',
            'city' => 'Kota Semarang',
            'district' => 'Banyumanik',
            'village' => 'Sumurboto',
            'postal_code' => '50269',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'landmark' => 'Dekat minimarket',
            'delivery_notes' => 'Rumah pagar hijau',
        ])->assertRedirect('/customer/checkout/payment');

        $this->get('/customer/checkout/payment')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/checkout/payment')
                ->where('summary.delivery_quote.outlet.id', $farOutlet->id)
                ->where('summary.delivery_fee', 8000)
            );
    }
}
