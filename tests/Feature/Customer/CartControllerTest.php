<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_add_to_cart_returns_stock_info(): void
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

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 5,
            ]);

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'item' => ['product_variant_id', 'quantity', 'available_stock', 'max_quantity'],
                'warning',
            ])
            ->assertJson([
                'success' => true,
                'item' => [
                    'product_variant_id' => $variant->id,
                    'quantity' => 5,
                    'available_stock' => 7,
                    'max_quantity' => 7,
                ],
                'warning' => null,
            ]);
    }

    public function test_add_to_cart_auto_adjusts_when_exceeds_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 5,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 10,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'item' => [
                    'quantity' => 5,
                    'available_stock' => 5,
                    'max_quantity' => 5,
                ],
                'warning' => 'Jumlah dikurangi dari 10 ke 5 (stok tersisa 5)',
            ]);
    }

    public function test_add_to_cart_fails_when_out_of_stock(): void
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

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 1,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => false,
                'error' => 'Stok produk ini sudah habis',
                'item' => [
                    'available_stock' => 0,
                    'max_quantity' => 0,
                ],
            ]);
    }
}
