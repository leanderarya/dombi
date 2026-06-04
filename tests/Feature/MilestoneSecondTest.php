<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MilestoneSecondTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_cannot_view_another_outlet_order(): void
    {
        [$outletAUser] = $this->makeOutlet('Outlet A');
        [, $outletB] = $this->makeOutlet('Outlet B');
        $order = $this->makeOrder($outletB);

        $this->actingAs($outletAUser)
            ->get(route('outlet.orders.show', $order))
            ->assertForbidden();
    }

    public function test_outlet_can_reject_pending_order_and_release_reserved_stock(): void
    {
        [$outletUser, $outlet] = $this->makeOutlet('Outlet Processing');
        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml',
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 5,
            'reserved_stock' => 2,
            'minimum_stock' => 1,
        ]);

        $order = $this->makeOrder($outlet);
        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => 25000,
            'subtotal' => 50000,
        ]);

        $this->actingAs($outletUser)
            ->post(route('outlet.orders.reject', $order), [
                'reason' => 'Stok Tidak Tersedia',
            ])
            ->assertRedirect(route('outlet.orders.show', $order));

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'rejected_by_outlet']);
        $this->assertSame(0, OutletInventory::first()->reserved_stock);
        $this->assertTrue(StockMovement::where('reference_id', $order->id)->where('type', 'order_cancelled')->exists());
    }

    private function makeOutlet(string $name): array
    {
        $user = User::create([
            'name' => $name.' User',
            'email' => str($name)->slug().'-user@example.com',
            'password' => 'password',
            'role' => 'outlet',
            'is_active' => true,
        ]);

        $outlet = Outlet::create([
            'user_id' => $user->id,
            'name' => $name,
            'kelurahan' => 'Kelurahan',
            'kecamatan' => 'Kecamatan',
            'address' => 'Alamat outlet',
            'status' => 'active',
        ]);

        return [$user, $outlet];
    }

    private function makeOrder(Outlet $outlet): Order
    {
        $customer = Customer::create([
            'name' => 'Customer',
            'phone' => '081234567890' . rand(1000, 9999),
        ]);

        return Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-'.uniqid(),
            'status' => 'pending_confirmation',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Customer',
            'customer_phone' => '080000000000',
            'customer_address' => 'Alamat customer',
            'ordered_at' => now(),
        ]);
    }
}
