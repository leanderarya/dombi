<?php

namespace Tests\Feature;

use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VariantOrderingAndPricingTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_detail_sends_all_active_variants_with_size_and_price(): void
    {
        $family = ProductFamily::create([
            'name' => 'Biogoat',
            'brand' => 'Biogoat',
            'description' => 'Susu biogoat',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Original 250ml',
            'flavor' => 'Original',
            'size' => '250ml',
            'center_price' => 11000,
            'selling_price' => 13000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Original 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 38000,
            'selling_price' => 45000,
            'is_active' => true,
        ]);

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/product-detail')
                ->has('family.variants', 2)
            );

        $variants = $response->viewData('page')['props']['family']['variants'];
        $sizes = array_column($variants, 'size');

        $this->assertContains('250ml', $sizes);
        $this->assertContains('1L', $sizes);
    }

    public function test_inactive_variants_excluded_from_detail(): void
    {
        $family = ProductFamily::create([
            'name' => 'Test Family',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Active 250ml',
            'flavor' => 'Original',
            'size' => '250ml',
            'center_price' => 10000,
            'selling_price' => 12000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Inactive 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 30000,
            'selling_price' => 35000,
            'is_active' => false,
        ]);

        $this->get('/customer/products/'.$family->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/product-detail')
                ->has('family.variants', 1)
            );
    }

    public function test_single_size_product_sends_one_variant(): void
    {
        $family = ProductFamily::create([
            'name' => 'Raw Milk',
            'brand' => 'Domilk',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Fresh 1L',
            'flavor' => 'Fresh',
            'size' => '1L',
            'center_price' => 25000,
            'selling_price' => 30000,
            'is_active' => true,
        ]);

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/product-detail')
                ->has('family.variants', 1)
            );

        $variants = $response->viewData('page')['props']['family']['variants'];
        $this->assertEquals('1L', $variants[0]['size']);
        $this->assertEquals('30000.00', $variants[0]['selling_price']);
    }

    public function test_catalog_sends_variants_with_size_data(): void
    {
        $family = ProductFamily::create([
            'name' => 'Domilk Premium',
            'brand' => 'Domilk',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Kopi 1L',
            'flavor' => 'Kopi',
            'size' => '1L',
            'center_price' => 40000,
            'selling_price' => 48000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Kopi 250ml',
            'flavor' => 'Kopi',
            'size' => '250ml',
            'center_price' => 12000,
            'selling_price' => 15000,
            'is_active' => true,
        ]);

        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('customer/products')
                ->has('families.0.variants', 2)
            );
    }

    public function test_multiple_sizes_with_different_prices(): void
    {
        $family = ProductFamily::create([
            'name' => 'Multi Size',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        $sizes = [
            ['size' => '1L', 'selling_price' => 80000],
            ['size' => '250ml', 'selling_price' => 32000],
            ['size' => '500ml', 'selling_price' => 50000],
            ['size' => '750ml', 'selling_price' => 65000],
        ];

        foreach ($sizes as $s) {
            ProductVariant::create([
                'product_family_id' => $family->id,
                'name' => "Original {$s['size']}",
                'flavor' => 'Original',
                'size' => $s['size'],
                'center_price' => (int) ($s['selling_price'] * 0.7),
                'selling_price' => $s['selling_price'],
                'is_active' => true,
            ]);
        }

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('family.variants', 4)
            );

        $variants = $response->viewData('page')['props']['family']['variants'];
        $sizesReturned = array_column($variants, 'size');

        $this->assertContains('250ml', $sizesReturned);
        $this->assertContains('500ml', $sizesReturned);
        $this->assertContains('750ml', $sizesReturned);
        $this->assertContains('1L', $sizesReturned);
    }

    public function test_variant_selling_price_is_decimal_string(): void
    {
        $family = ProductFamily::create([
            'name' => 'Price Test',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Original 250ml',
            'flavor' => 'Original',
            'size' => '250ml',
            'center_price' => 10000,
            'selling_price' => 32000,
            'is_active' => true,
        ]);

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk();

        $variants = $response->viewData('page')['props']['family']['variants'];
        $this->assertEquals('32000.00', $variants[0]['selling_price']);
    }

    public function test_all_variant_sizes_are_present_for_frontend_sorting(): void
    {
        $family = ProductFamily::create([
            'name' => 'Sort Test',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        $expectedSizes = ['250ml', '500ml', '750ml', '1L', '2L'];

        foreach ($expectedSizes as $size) {
            ProductVariant::create([
                'product_family_id' => $family->id,
                'name' => "Original $size",
                'flavor' => 'Original',
                'size' => $size,
                'center_price' => 10000,
                'selling_price' => 15000,
                'is_active' => true,
            ]);
        }

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk();

        $variants = $response->viewData('page')['props']['family']['variants'];
        $sizesReturned = array_column($variants, 'size');

        foreach ($expectedSizes as $size) {
            $this->assertContains($size, $sizesReturned, "Size $size should be present in variants");
        }
    }

    // ─── DECISION SIMPLIFICATION TESTS ────────────────────────────

    public function test_single_flavor_single_size_sends_one_variant(): void
    {
        $family = ProductFamily::create([
            'name' => 'Raw Milk',
            'brand' => 'Domilk',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Fresh 1L',
            'flavor' => 'Fresh',
            'size' => '1L',
            'center_price' => 25000,
            'selling_price' => 30000,
            'is_active' => true,
        ]);

        $this->get('/customer/products/'.$family->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('family.variants', 1)
                ->has('family.variants.0', fn ($v) => $v
                    ->where('flavor', 'Fresh')
                    ->where('size', '1L')
                    ->where('selling_price', '30000.00')
                    ->etc()
                )
            );
    }

    public function test_multi_flavor_multi_size_sends_all_combinations(): void
    {
        $family = ProductFamily::create([
            'name' => 'Domilk Premium',
            'brand' => 'Domilk',
            'is_active' => true,
        ]);

        $combinations = [
            ['flavor' => 'Kopi', 'size' => '250ml', 'price' => 15000],
            ['flavor' => 'Kopi', 'size' => '1L', 'price' => 48000],
            ['flavor' => 'Vanilla', 'size' => '250ml', 'price' => 15000],
            ['flavor' => 'Vanilla', 'size' => '1L', 'price' => 48000],
        ];

        foreach ($combinations as $c) {
            ProductVariant::create([
                'product_family_id' => $family->id,
                'name' => "{$c['flavor']} {$c['size']}",
                'flavor' => $c['flavor'],
                'size' => $c['size'],
                'center_price' => (int) ($c['price'] * 0.7),
                'selling_price' => $c['price'],
                'is_active' => true,
            ]);
        }

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk();

        $variants = $response->viewData('page')['props']['family']['variants'];
        $this->assertCount(4, $variants);

        $flavors = array_unique(array_column($variants, 'flavor'));
        $sizes = array_unique(array_column($variants, 'size'));

        $this->assertContains('Kopi', $flavors);
        $this->assertContains('Vanilla', $flavors);
        $this->assertContains('250ml', $sizes);
        $this->assertContains('1L', $sizes);
    }

    public function test_smallest_size_price_is_lowest(): void
    {
        $family = ProductFamily::create([
            'name' => 'Price Check',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Original 250ml',
            'flavor' => 'Original',
            'size' => '250ml',
            'center_price' => 11000,
            'selling_price' => 32000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Original 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 38000,
            'selling_price' => 80000,
            'is_active' => true,
        ]);

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk();

        $variants = $response->viewData('page')['props']['family']['variants'];

        // Find the 250ml variant
        $v250 = collect($variants)->firstWhere('size', '250ml');
        $v1L = collect($variants)->firstWhere('size', '1L');

        $this->assertNotNull($v250);
        $this->assertNotNull($v1L);
        $this->assertLessThan((float) $v1L['selling_price'], (float) $v250['selling_price']);
    }

    public function test_single_flavor_family_sends_correct_variant(): void
    {
        $family = ProductFamily::create([
            'name' => 'Biogoat',
            'brand' => 'Biogoat',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Original 250ml',
            'flavor' => 'Original',
            'size' => '250ml',
            'center_price' => 11000,
            'selling_price' => 13000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'Original 1L',
            'flavor' => 'Original',
            'size' => '1L',
            'center_price' => 38000,
            'selling_price' => 45000,
            'is_active' => true,
        ]);

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk();

        $variants = $response->viewData('page')['props']['family']['variants'];

        // Both variants have same flavor
        $flavors = array_unique(array_column($variants, 'flavor'));
        $this->assertCount(1, $flavors);
        $this->assertContains('Original', $flavors);

        // Both sizes present
        $sizes = array_column($variants, 'size');
        $this->assertContains('250ml', $sizes);
        $this->assertContains('1L', $sizes);
    }

    public function test_no_flavor_family_sends_variants_without_flavor(): void
    {
        $family = ProductFamily::create([
            'name' => 'Plain Milk',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => '250ml',
            'flavor' => null,
            'size' => '250ml',
            'center_price' => 10000,
            'selling_price' => 12000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => '1L',
            'flavor' => null,
            'size' => '1L',
            'center_price' => 30000,
            'selling_price' => 35000,
            'is_active' => true,
        ]);

        $response = $this->get('/customer/products/'.$family->id);
        $response->assertOk();

        $variants = $response->viewData('page')['props']['family']['variants'];
        $this->assertCount(2, $variants);

        foreach ($variants as $v) {
            $this->assertNull($v['flavor']);
        }
    }

    public function test_catalog_page_sends_families_with_variant_counts(): void
    {
        $family = ProductFamily::create([
            'name' => 'Test Family',
            'brand' => 'Test',
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'A 250ml',
            'flavor' => 'A',
            'size' => '250ml',
            'center_price' => 10000,
            'selling_price' => 12000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'A 1L',
            'flavor' => 'A',
            'size' => '1L',
            'center_price' => 30000,
            'selling_price' => 35000,
            'is_active' => true,
        ]);

        ProductVariant::create([
            'product_family_id' => $family->id,
            'name' => 'B 250ml',
            'flavor' => 'B',
            'size' => '250ml',
            'center_price' => 10000,
            'selling_price' => 12000,
            'is_active' => true,
        ]);

        $this->get('/customer/products')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('families.0.variants', 3)
            );
    }
}
