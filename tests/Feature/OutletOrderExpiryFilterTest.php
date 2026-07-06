<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletOrderExpiryFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_expired_orders_not_shown_in_aktif_tab(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        // Active order (not expired)
        $activeOrder = $this->createOrder($outlet, [
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'confirmation_expires_at' => now()->addHour(),
        ]);

        // Expired order
        $expiredOrder = $this->createOrder($outlet, [
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'confirmation_expires_at' => now()->subHour(),
        ]);

        $response = $this->actingAs($user)
            ->get('/outlet/orders?tab=aktif');

        $response->assertOk();

        // Active order should be visible
        $response->assertSee($activeOrder->order_code);

        // Expired order should NOT be visible
        $response->assertDontSee($expiredOrder->order_code);
    }

    public function test_expired_orders_shown_in_riwayat_tab(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        // Expired order (status = expired)
        $expiredOrder = $this->createOrder($outlet, [
            'status' => Order::STATUS_EXPIRED,
            'confirmation_expires_at' => now()->subHour(),
        ]);

        $response = $this->actingAs($user)
            ->get('/outlet/orders?tab=riwayat');

        $response->assertOk();

        // Expired order should be visible in history
        $response->assertSee($expiredOrder->order_code);
    }

    public function test_pending_count_excludes_expired(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        // Active pending
        $this->createOrder($outlet, [
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'confirmation_expires_at' => now()->addHour(),
        ]);

        // Expired pending (still has status pending_confirmation but expired)
        $this->createOrder($outlet, [
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'confirmation_expires_at' => now()->subHour(),
        ]);

        $response = $this->actingAs($user)
            ->get('/outlet/dashboard');

        $response->assertOk();

        // Only 1 pending should be shown in the dashboard
        $response->assertSee('1');
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'name' => 'Test Outlet',
            'kelurahan' => 'Test Kelurahan',
            'kecamatan' => 'Test Kecamatan',
            'address' => 'Jl. Test No. 123',
            'status' => 'active',
        ]);
    }

    private function createOutletUser(Outlet $outlet): User
    {
        return User::create([
            'name' => 'Outlet Staff',
            'email' => 'outlet-'.uniqid().'@test.com',
            'password' => bcrypt('password'),
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
            'is_active' => true,
        ]);
    }

    private function createOrder(Outlet $outlet, array $overrides = []): Order
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890'.rand(1000, 9999),
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-'.uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-TEST-'.strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
            'confirmation_expires_at' => now()->addMinutes(15),
        ], $overrides));

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => $product->price,
            'subtotal' => 50000,
        ]);

        return $order;
    }
}
