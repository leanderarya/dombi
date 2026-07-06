<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StockValidationRaceConditionTest extends TestCase
{
    use RefreshDatabase;

    public function test_concurrent_checkout_prevents_overselling(): void
    {
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
            'current_stock' => 3,
            'reserved_stock' => 0,
            'minimum_stock' => 1,
            'is_active' => true,
        ]);

        $userA = User::factory()->create(['role' => 'customer']);
        $customerA = Customer::factory()->create(['user_id' => $userA->id]);

        $userB = User::factory()->create(['role' => 'customer']);
        $customerB = Customer::factory()->create(['user_id' => $userB->id]);

        // Customer A tries to buy 3
        $responseA = $this->actingAs($userA)
            ->session([
                'checkout.cart' => [['product_variant_id' => $variant->id, 'quantity' => 3]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $outlet->id],
                'checkout.customer' => ['customer_name' => 'Customer A', 'phone_number' => '6281111111111'],
            ])
            ->postJson('/customer/checkout/payment', ['payment_method' => 'qris']);

        // Customer B tries to buy 3 at the same time
        $responseB = $this->actingAs($userB)
            ->session([
                'checkout.cart' => [['product_variant_id' => $variant->id, 'quantity' => 3]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $outlet->id],
                'checkout.customer' => ['customer_name' => 'Customer B', 'phone_number' => '6282222222222'],
            ])
            ->postJson('/customer/checkout/payment', ['payment_method' => 'qris']);

        // One should succeed, one should get adjustment
        $successCount = 0;
        $adjustCount = 0;

        if ($responseA->status() === 200 || $responseA->status() === 302) {
            $successCount++;
        }
        if ($responseA->status() === 422) {
            $adjustCount++;
        }
        if ($responseB->status() === 200 || $responseB->status() === 302) {
            $successCount++;
        }
        if ($responseB->status() === 422) {
            $adjustCount++;
        }

        $this->assertEquals(1, $successCount, 'Exactly one checkout should succeed');
        $this->assertEquals(1, $adjustCount, 'Exactly one checkout should get adjustment');

        // Verify no overselling
        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variant->id)
            ->first();

        $this->assertGreaterThanOrEqual(0, $inventory->current_stock - $inventory->reserved_stock);
    }
}
