<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\WithTestOutlet;

class CheckoutControllerTest extends TestCase
{
    use RefreshDatabase;
    use WithTestOutlet;

    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->outlet = $this->withOutletSession();
    }

    public function test_validate_stock_returns_items_with_stock_info(): void
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

        $this->actingAs($user)
            ->withSession(['checkout.cart' => [
                ['product_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => true,
                'items' => [
                    [
                        'product_id' => $variant->id,
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
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession(['checkout.cart' => [
                ['product_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => false,
                'items' => [
                    [
                        'product_id' => $variant->id,
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

    public function test_submit_returns_422_with_adjustments_when_stock_insufficient(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);

        $family = ProductCategory::create(['name' => 'Susu Kambing Original', 'is_active' => true]);
        $variant = Product::factory()->create([
            'product_category_id' => $family->id,
            'name' => '250ml',
            'selling_price' => 25000,
            'center_price' => 18000,
        ]);

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
            'is_active' => true,
        ]);

        $this->actingAs($user)
            ->session([
                'checkout.cart' => [['product_id' => $variant->id, 'quantity' => 5]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $this->outlet->id],
                'checkout.customer' => ['customer_name' => 'Test', 'phone_number' => '6281234567890'],
            ])
            ->postJson('/customer/checkout/payment', ['payment_method' => 'qris'])
            ->assertStatus(422)
            ->assertJson([
                'adjusted' => true,
                'warnings' => [
                    'Susu Kambing Original: jumlah dikurangi dari 5 ke 2 (stok tersisa 2)',
                ],
            ])
            ->assertJsonStructure(['adjustments', 'warnings']);
    }

    public function test_validate_stock_detects_out_of_stock(): void
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

        $this->actingAs($user)
            ->withSession(['checkout.cart' => [
                ['product_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => false,
                'items' => [
                    [
                        'product_id' => $variant->id,
                        'requested_qty' => 5,
                        'available_stock' => 0,
                        'adjusted' => true,
                        'adjusted_qty' => 0,
                        'removed' => true,
                    ],
                ],
            ]);
    }

    public function test_validate_stock_scopes_to_selected_outlet(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        $otherOutlet = Outlet::factory()->create(['status' => 'active']);

        OutletInventory::factory()->create([
            'outlet_id' => $otherOutlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 2,
        ]);

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 20,
            'reserved_stock' => 5,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession([
                'checkout.cart' => [['product_id' => $variant->id, 'quantity' => 10]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $this->outlet->id],
            ])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => true,
                'items' => [
                    [
                        'product_id' => $variant->id,
                        'requested_qty' => 10,
                        'available_stock' => 15,
                        'adjusted' => false,
                        'removed' => false,
                    ],
                ],
                'warnings' => [],
            ]);
    }

    public function test_validate_stock_updates_session_cart_with_adjusted_quantities(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);
        $variant = Product::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession([
                'checkout.cart' => [['product_id' => $variant->id, 'quantity' => 5]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $this->outlet->id],
            ])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJsonPath('valid', false)
            ->assertJsonPath('items.0.adjusted_qty', 2);

        $this->assertEquals(2, session('checkout.cart.0.quantity'));
    }

    public function test_validate_stock_respects_outlet_scoping_for_multi_item_cart(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Customer::factory()->create(['user_id' => $user->id]);

        $family = ProductCategory::create(['name' => 'Susu Kambing Multi', 'is_active' => true]);
        $variantA = Product::factory()->create(['product_category_id' => $family->id, 'name' => '250ml']);
        $variantB = Product::factory()->create(['product_category_id' => $family->id, 'name' => '500ml']);

        $otherOutlet = Outlet::factory()->create(['status' => 'active']);

        OutletInventory::factory()->create([
            'outlet_id' => $otherOutlet->id,
            'product_id' => $variantA->id,
            'current_stock' => 100,
            'reserved_stock' => 0,
        ]);
        OutletInventory::factory()->create([
            'outlet_id' => $otherOutlet->id,
            'product_id' => $variantB->id,
            'current_stock' => 0,
            'reserved_stock' => 0,
        ]);

        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variantA->id,
            'current_stock' => 5,
            'reserved_stock' => 2,
        ]);
        OutletInventory::factory()->create([
            'outlet_id' => $this->outlet->id,
            'product_id' => $variantB->id,
            'current_stock' => 8,
            'reserved_stock' => 4,
        ]);

        $this->actingAs($user)
            ->withSession([
                'checkout.cart' => [
                    ['product_id' => $variantA->id, 'quantity' => 5],
                    ['product_id' => $variantB->id, 'quantity' => 5],
                ],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $this->outlet->id],
            ])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => false,
                'items' => [
                    [
                        'product_id' => $variantA->id,
                        'requested_qty' => 5,
                        'available_stock' => 3,
                        'adjusted' => true,
                        'adjusted_qty' => 3,
                        'removed' => false,
                    ],
                    [
                        'product_id' => $variantB->id,
                        'requested_qty' => 5,
                        'available_stock' => 4,
                        'adjusted' => true,
                        'adjusted_qty' => 4,
                        'removed' => false,
                    ],
                ],
            ]);
    }
}
