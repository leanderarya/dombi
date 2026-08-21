<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\OutletOperatingHours;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\WithTestOutlet;

class CartControllerTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outlet = $this->withOutletSession();
    }

    public function test_add_to_cart_returns_stock_info(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 3,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_id' => $variant->id,
                'quantity' => 5,
            ]);

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'item' => ['product_id', 'quantity', 'available_stock', 'max_quantity'],
                'warning',
            ])
            ->assertJson([
                'success' => true,
                'item' => [
                    'product_id' => $variant->id,
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
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 5,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_id' => $variant->id,
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
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_id' => $variant->id,
                'quantity' => 1,
            ]);

        $response->assertUnprocessable()
            ->assertJson([
                'success' => false,
                'error' => 'Stok produk ini sedang tidak tersedia di seluruh outlet.',
            ]);
    }

    public function test_add_to_cart_rejects_legacy_product_variant_id_key(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 1,
            ])
            ->assertUnprocessable()
            ->assertInvalid('product_id');
    }

    public function test_add_without_anchor_resolves_nearest_open_outlet_with_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        // No session anchor — resolver must pick the only open-with-stock outlet
        session()->forget('checkout.fulfillment.selected_outlet_id');
        session()->forget('checkout.selected_outlet_id');

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_id' => $variant->id,
                'quantity' => 3,
            ])
            ->assertOk()
            ->assertJson([
                'success' => true,
                'switched_outlet' => false,
                'item' => ['quantity' => 3],
            ]);

        $this->assertEquals(
            $this->outlet->id,
            session('checkout.fulfillment.selected_outlet_id'),
        );
    }

    public function test_add_smart_switches_outlet_when_anchored_outlet_has_no_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        $stockedOutlet = Outlet::factory()->create(['status' => 'active']);
        OutletOperatingHours::factory()->create([
            'outlet_id' => $stockedOutlet->id,
            'day_of_week' => (int) now('Asia/Jakarta')->format('w'),
            'open_time' => '00:00',
            'close_time' => '23:59',
            'is_closed' => false,
        ]);

        // Anchored outlet has NO stock
        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 0,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        // Stocked outlet has enough
        OutletInventory::factory()->create([
            'outlet_id' => $stockedOutlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_id' => $variant->id,
                'quantity' => 3,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'switched_outlet' => true,
                'outlet' => [
                    'from_outlet_id' => $this->outlet->id,
                    'to_outlet_id' => $stockedOutlet->id,
                ],
            ]);

        $this->assertEquals(
            $stockedOutlet->id,
            session('checkout.fulfillment.selected_outlet_id'),
        );
    }

    public function test_add_smart_switch_uses_existing_partial_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 5,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_id' => $variant->id,
                'quantity' => 10,
            ])
            ->assertOk()
            ->assertJson([
                'success' => true,
                'switched_outlet' => false,
                'item' => ['quantity' => 5],
                'warning' => 'Jumlah dikurangi dari 10 ke 5 (stok tersisa 5)',
            ]);
    }

    public function test_set_quantity_and_remove_use_product_id(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 0,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_id' => $variant->id,
                'quantity' => 3,
            ])
            ->assertOk();

        $this->actingAs($user)
            ->postJson('/customer/cart/quantity', [
                'product_id' => $variant->id,
                'quantity' => 2,
            ])
            ->assertOk()
            ->assertJson(['cart_count' => 2]);

        $this->actingAs($user)
            ->postJson('/customer/cart/remove', [
                'product_id' => $variant->id,
            ])
            ->assertOk()
            ->assertJson(['cart_count' => 0]);
    }
}
