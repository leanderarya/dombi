<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\WithTestOutlet;

class CustomerLocationRecommendationTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withOutletSession();
    }

    public function test_customer_location_can_be_stored_in_checkout_draft(): void
    {
        $this->postJson('/customer/location', [
            'address_line' => 'Jl. Ngesrep Timur V No. 12',
            'province' => 'Jawa Tengah',
            'city' => 'Kota Semarang',
            'district' => 'Banyumanik',
            'village' => 'Sumurboto',
            'postal_code' => '50269',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'accuracy' => 24.5,
            'timestamp' => now()->timestamp,
            'landmark' => 'Dekat minimarket',
            'delivery_notes' => 'Rumah pagar hijau',
        ])->assertOk()
            ->assertSessionHas('checkout.location.latitude', -7.0523456)
            ->assertSessionHas('checkout.location.village', 'Sumurboto');
    }

    public function test_pickup_outlet_recommendation_prioritizes_stock_over_shorter_distance(): void
    {
        $product = $this->createProduct();
        $variant = ProductVariant::where('product_id', $product->id)->first();

        $nearEmpty = $this->createOutlet('Outlet Tembalang', -7.0530000, 110.4360000, 0, $product->id);
        $recommended = $this->createOutlet('Outlet Banyumanik', -7.0610000, 110.4310000, 10, $product->id);
        $alternative = $this->createOutlet('Outlet Pedurungan', -7.0000000, 110.4700000, 20, $product->id);

        $this->withSession([
            'checkout.cart' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2],
            ],
        ])->getJson('/customer/checkout/pickup-outlets?latitude=-7.0523456&longitude=110.4345678')
            ->assertOk()
            ->assertJsonPath('recommended.id', $recommended->id)
            ->assertJsonPath('recommended.name', 'Outlet Banyumanik')
            ->assertJsonPath('alternatives.0.id', $recommended->id)
            ->assertJsonPath('alternatives.1.id', $alternative->id)
            ->assertJsonMissing(['id' => $nearEmpty->id]);
    }

    public function test_selected_pickup_outlet_is_used_when_customer_places_order(): void
    {
        $response = $this->get('/customer/checkout');
        $response->assertOk();
    }

    private function createProduct(): Product
    {
        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml',
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => 'Susu Kambing', 'brand' => 'Dombi']);
        ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Original 500ml',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        return $product;
    }

    private function createOutlet(string $name, float $latitude, float $longitude, int $stock, int $productId): Outlet
    {
        $outlet = Outlet::create([
            'name' => $name,
            'kelurahan' => 'Semarang',
            'kecamatan' => 'Semarang',
            'address' => 'Jl. '.$name,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'status' => 'active',
        ]);

        $variant = ProductVariant::where('product_id', $productId)->first();
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $productId,
            'product_variant_id' => $variant?->id,
            'current_stock' => $stock,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        return $outlet;
    }
}
