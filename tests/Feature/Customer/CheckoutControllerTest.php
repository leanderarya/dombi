<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_validate_stock_returns_items_with_stock_info(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 3,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession(['cart' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => true,
                'items' => [
                    [
                        'product_variant_id' => $variant->id,
                        'requested_qty' => 5,
                        'available_stock' => 7,
                        'adjusted' => false,
                    ],
                ],
                'warnings' => [],
            ]);
    }

    public function test_validate_stock_detects_stock_reduction(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession(['cart' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => false,
                'items' => [
                    [
                        'product_variant_id' => $variant->id,
                        'requested_qty' => 5,
                        'available_stock' => 2,
                        'adjusted' => true,
                        'adjusted_qty' => 2,
                        'removed' => false,
                    ],
                ],
            ])
            ->assertJsonStructure(['warnings']);
    }

    public function test_validate_stock_detects_out_of_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession(['cart' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => false,
                'items' => [
                    [
                        'product_variant_id' => $variant->id,
                        'requested_qty' => 5,
                        'available_stock' => 0,
                        'adjusted' => true,
                        'adjusted_qty' => 0,
                        'removed' => true,
                    ],
                ],
            ]);
    }
}
