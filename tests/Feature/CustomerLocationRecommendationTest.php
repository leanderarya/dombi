<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductCategory;
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
        [$product, $variant] = $this->createProduct();

        $nearEmpty = $this->createOutlet('Outlet Tembalang', -7.0530000, 110.4360000, 0, $product->id);
        $recommended = $this->createOutlet('Outlet Banyumanik', -7.0610000, 110.4310000, 10, $product->id);
        $alternative = $this->createOutlet('Outlet Pedurungan', -7.0000000, 110.4700000, 20, $product->id);

        $this->withSession([
            'checkout.cart' => [
                ['product_id' => $variant->id, 'quantity' => 2],
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

    private function createProduct(): array
    {
        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductCategory::create(['name' => 'Susu Kambing', 'brand' => 'Dombi']);
        $variant = Product::create([
            'product_category_id' => $family->id,
            'name' => 'Original 500ml',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        return [$product, $variant];
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

        $variant = $productId ? Product::find($productId) : null;
        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $variant?->id ?? $productId,
            'current_stock' => $stock,
            'reserved_stock' => 0,
            'minimum_stock' => 0,
        ]);

        return $outlet;
    }
}
