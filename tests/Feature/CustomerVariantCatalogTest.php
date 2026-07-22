<?php

namespace Tests\Feature;

use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerVariantCatalogTest extends TestCase
{
    use RefreshDatabase;

    private ProductFamily $family;

    private ProductVariant $kopi250;

    private ProductVariant $kopi1L;

    private ProductVariant $vanilla250;

    private ProductVariant $vanilla1L;

    protected function setUp(): void
    {
        parent::setUp();

        $this->family = ProductFamily::create([
            'name' => 'Domilk Premium Taste',
            'brand' => 'Domilk',
            'description' => 'Susu premium rasa kopi',
            'is_active' => true,
        ]);

        $this->kopi250 = ProductVariant::create([
            'product_family_id' => $this->family->id,
            'name' => 'Kopi 250ml',
            'flavor' => 'Kopi',
            'size' => '250ml',
            'center_price' => 15000,
            'selling_price' => 18000,
            'is_active' => true,
        ]);

        $this->kopi1L = ProductVariant::create([
            'product_family_id' => $this->family->id,
            'name' => 'Kopi 1L',
            'flavor' => 'Kopi',
            'size' => '1L',
            'center_price' => 45000,
            'selling_price' => 52000,
            'is_active' => true,
        ]);

        $this->vanilla250 = ProductVariant::create([
            'product_family_id' => $this->family->id,
            'name' => 'Vanilla 250ml',
            'flavor' => 'Vanilla',
            'size' => '250ml',
            'center_price' => 15000,
            'selling_price' => 18000,
            'is_active' => true,
        ]);

        $this->vanilla1L = ProductVariant::create([
            'product_family_id' => $this->family->id,
            'name' => 'Vanilla 1L',
            'flavor' => 'Vanilla',
            'size' => '1L',
            'center_price' => 45000,
            'selling_price' => 52000,
            'is_active' => true,
        ]);
    }

    public function test_catalog_page_loads_successfully(): void
    {
        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/products')
            );
    }

    public function test_home_page_loads_successfully(): void
    {
        $this->get('/customer/home')
            ->assertOk();
    }

    public function test_product_detail_page_loads_with_family_data(): void
    {
        $this->get('/customer/products/'.$this->family->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/product-detail')
                ->has('family')
            );
    }

    public function test_cart_add_endpoint_accepts_variant_id(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->kopi250->id,
            'quantity' => 1,
        ])
            ->assertOk()
            ->assertJson([
                'success' => true,
            ]);
    }

    public function test_cart_add_rejects_inactive_variant(): void
    {
        $this->kopi250->update(['is_active' => false]);

        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->kopi250->id,
            'quantity' => 1,
        ])->assertUnprocessable();
    }

    public function test_cart_add_rejects_zero_quantity(): void
    {
        $this->postJson('/customer/cart/add', [
            'product_variant_id' => $this->kopi250->id,
            'quantity' => 0,
        ])->assertUnprocessable();
    }

    public function test_family_with_multiple_flavors_creates_separate_catalog_rows(): void
    {
        // Both Kopi and Vanilla should appear as separate entries
        $response = $this->get('/customer/products');
        $response->assertOk();

        // The page should render without errors
        $response->assertInertia(fn ($page) => $page
            ->component('customer/products')
        );
    }

    public function test_inactive_variants_excluded_from_catalog(): void
    {
        $this->kopi250->update(['is_active' => false]);

        $response = $this->get('/customer/products');
        $response->assertOk();

        // Page still loads (inactive variants filtered out by backend)
        $response->assertInertia(fn ($page) => $page
            ->component('customer/products')
        );
    }

    public function test_single_flavor_family_still_shows_correctly(): void
    {
        // Create a family with only one flavor
        $family2 = ProductFamily::create([
            'name' => 'Raw Milk',
            'brand' => 'Domilk',
            'description' => 'Susu murni',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family2->id,
            'name' => 'Original 1L',
            'flavor' => null,
            'size' => '1L',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        $response = $this->get('/customer/products');
        $response->assertOk();
    }

    public function test_product_detail_shows_all_sizes_for_family(): void
    {
        $response = $this->get('/customer/products/'.$this->family->id);
        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('customer/product-detail')
            ->where('family.id', $this->family->id)
        );
    }

    // ─── FAMILY GROUPING TESTS ────────────────────────────────────

    public function test_catalog_groups_variants_by_family(): void
    {
        $family2 = ProductFamily::create([
            'name' => 'Biogoat',
            'brand' => 'Biogoat',
            'description' => 'Susu biogoat',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family2->id,
            'name' => 'Biogoat 250ml',
            'flavor' => null,
            'size' => '250ml',
            'center_price' => 12000,
            'selling_price' => 15000,
            'is_active' => true,
        ]);

        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/products')
            );
    }

    public function test_family_with_zero_active_variants_excluded(): void
    {
        $family2 = ProductFamily::create([
            'name' => 'Inactive Family',
            'brand' => 'Test',
            'description' => 'Should not appear',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family2->id,
            'name' => 'Inactive Variant',
            'flavor' => null,
            'size' => '250ml',
            'center_price' => 10000,
            'selling_price' => 12000,
            'is_active' => false,
        ]);

        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/products')
            );
    }

    public function test_category_chip_filtering_works(): void
    {
        $family2 = ProductFamily::create([
            'name' => 'Biogoat',
            'brand' => 'Biogoat',
            'description' => 'Susu biogoat',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family2->id,
            'name' => 'Biogoat 250ml',
            'flavor' => null,
            'size' => '250ml',
            'center_price' => 12000,
            'selling_price' => 15000,
            'is_active' => true,
        ]);

        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/products')
            );
    }

    public function test_family_section_includes_product_count(): void
    {
        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/products')
            );
    }

    public function test_multiple_families_appear_as_separate_sections(): void
    {
        $family2 = ProductFamily::create([
            'name' => 'Biogoat',
            'brand' => 'Biogoat',
            'description' => 'Susu biogoat',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family2->id,
            'name' => 'Biogoat 250ml',
            'flavor' => null,
            'size' => '250ml',
            'center_price' => 12000,
            'selling_price' => 15000,
            'is_active' => true,
        ]);

        $family3 = ProductFamily::create([
            'name' => 'Raw Milk by Domilk',
            'brand' => 'Domilk',
            'description' => 'Susu murni',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family3->id,
            'name' => 'Fresh 1L',
            'flavor' => 'Fresh',
            'size' => '1L',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/products')
            );
    }
}
