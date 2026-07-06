<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockValidationE2ETest extends TestCase
{
    use RefreshDatabase;

    public function test_full_stock_validation_flow(): void
    {
        // Setup
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $family = ProductFamily::create(['name' => 'Susu Kambing Original', 'is_active' => true]);
        $variant = ProductVariant::factory()->create([
            'product_family_id' => $family->id,
            'name' => '250ml',
            'selling_price' => 25000,
            'center_price' => 18000,
        ]);

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 5,
            'minimum_stock' => 3,
            'is_active' => true,
        ]);

        // Step 1: Add to cart - should auto-adjust (available = 10 - 5 = 5, requested 8 -> clamped to 5)
        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 8,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'item' => [
                    'quantity' => 5,
                    'available_stock' => 5,
                    'max_quantity' => 5,
                ],
                'warning' => 'Jumlah dikurangi dari 8 ke 5 (stok tersisa 5)',
            ]);

        // Step 2: Validate stock at checkout (uses session key 'cart')
        $response = $this->actingAs($user)
            ->withSession(['cart' => [['product_variant_id' => $variant->id, 'quantity' => 5]]])
            ->getJson('/customer/checkout/validate-stock');

        $response->assertOk()
            ->assertJson(['valid' => true]);

        // Step 3: Stock reduced before submit (reserved goes 5 -> 8, so available = 10 - 8 = 2)
        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variant->id)
            ->first();
        $inventory->update(['reserved_stock' => 8]);

        // Step 4: Submit - should get adjustment (checkout uses 'checkout.cart' session key)
        $response = $this->actingAs($user)
            ->session([
                'checkout.cart' => [['product_variant_id' => $variant->id, 'quantity' => 5]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $outlet->id],
                'checkout.customer' => ['customer_name' => 'Test', 'phone_number' => '6281234567890'],
            ])
            ->postJson('/customer/checkout/payment', ['payment_method' => 'qris']);

        $response->assertStatus(422)
            ->assertJson(['adjusted' => true])
            ->assertJsonStructure(['adjustments', 'warnings']);
    }
}
