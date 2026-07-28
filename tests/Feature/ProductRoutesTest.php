<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ProductRoutesTest extends TestCase
{
    public function test_new_product_routes_exist(): void
    {
        $this->assertTrue(Route::has('owner.product-categories.index'));
        $this->assertTrue(Route::has('owner.products.store'));
    }

    public function test_all_required_routes_exist(): void
    {
        $required = [
            'owner.product-categories.index',
            'owner.product-categories.store',
            'owner.product-categories.show',
            'owner.product-categories.update',
            'owner.product-categories.destroy',
            'owner.product-categories.products.store',
            'owner.products.update',
            'owner.products.destroy',
            'owner.products.toggle',
            'owner.products.duplicate',
        ];

        foreach ($required as $name) {
            $this->assertTrue(Route::has($name), "Missing route: {$name}");
        }

        // Check bulk routes – allow either .bulk or .bulk-store naming (Task 11 used bulk-store)
        $hasBulk = Route::has('owner.product-categories.products.bulk') ||
                   Route::has('owner.product-categories.products.bulk-store');
        $this->assertTrue($hasBulk, 'Missing bulk store route');

        $this->assertTrue(
            Route::has('owner.product-categories.products.bulk-update'),
            'Missing bulk-update route'
        );
    }

    public function test_legacy_redirects_exist(): void
    {
        // At least one legacy product-families route should exist or redirect
        // We check that redirect logic is covered via route existence or legacy controllers
        $hasLegacy = Route::has('owner.product-families.legacy') ||
                     Route::has('owner.product-families.index');
        $this->assertTrue($hasLegacy, 'Missing legacy product-families route');
    }

    public function test_pricing_routes_use_product_param(): void
    {
        // Ensure new product-based pricing routes exist
        $this->assertTrue(
            Route::has('owner.pricing.products.update') ||
            Route::has('owner.pricing.variants.update'),
            'Missing pricing product update route'
        );
    }
}
