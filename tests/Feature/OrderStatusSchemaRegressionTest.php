<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderStatusSchemaRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_can_be_created_with_pending_confirmation_status(): void
    {
        $order = $this->makePendingConfirmationOrder();

        $this->assertSame(Order::STATUS_PENDING_CONFIRMATION, $order->status);
    }

    public function test_order_can_be_rejected_by_outlet(): void
    {
        [$order, $outletUser] = $this->makePendingConfirmationContext();

        app(OrderStatusService::class)->rejectOrder($order, 'Stok Tidak Tersedia', null, $outletUser);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'rejected_by_outlet',
        ]);
    }

    public function test_order_can_be_cancelled_by_customer(): void
    {
        [$order] = $this->makePendingConfirmationContext();

        app(OrderStatusService::class)->cancelByCustomer($order, 'Salah Pesan', null);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'cancelled_by_customer',
        ]);
    }

    public function test_order_can_expire_from_pending_confirmation(): void
    {
        [$order] = $this->makePendingConfirmationContext();

        app(OrderStatusService::class)->expireOrder($order);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'expired',
        ]);
    }

    private function makePendingConfirmationContext(): array
    {
        $customer = Customer::create([
            'name' => 'Customer Schema',
            'phone' => '628123456789' . rand(10, 99),
        ]);

        $outletUser = User::make([
            'name' => 'Outlet Schema',
            'email' => uniqid('outlet-schema-') . '@example.com',
            'password' => 'password',
        ]);
        $outletUser->role = 'outlet';
        $outletUser->is_active = true;
        $outletUser->save();

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Schema',
            'kelurahan' => 'Kelurahan',
            'kecamatan' => 'Kecamatan',
            'address' => 'Alamat outlet schema',
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Schema 500ml',
            'slug' => uniqid('susu-schema-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'current_stock' => 10,
            'reserved_stock' => 2,
            'minimum_stock' => 0,
        ]);

        $order = $this->makePendingConfirmationOrder($customer, $outlet, $product);

        return [$order, $outletUser, $customer];
    }

    private function makePendingConfirmationOrder(?Customer $customer = null, ?Outlet $outlet = null, ?Product $product = null): Order
    {
        $customer ??= Customer::create([
            'name' => 'Customer Pending',
            'phone' => '628123456789' . rand(10, 99),
        ]);

        if (! $outlet) {
            $outletUser = User::make([
                'name' => 'Outlet Pending',
                'email' => uniqid('outlet-pending-') . '@example.com',
                'password' => 'password',
            ]);
            $outletUser->role = 'outlet';
            $outletUser->is_active = true;
            $outletUser->save();

            $outlet = Outlet::create([
                'user_id' => $outletUser->id,
                'name' => 'Outlet Pending',
                'kelurahan' => 'Kelurahan',
                'kecamatan' => 'Kecamatan',
                'address' => 'Alamat outlet pending',
                'status' => 'active',
            ]);
        }

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-SCHEMA-' . strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'total' => 50000,
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone,
            'customer_address' => 'Alamat customer schema',
            'ordered_at' => now(),
        ]);

        if ($product) {
            $order->items()->create([
                'product_id' => $product->id,
                'product_name' => $product->name,
                'quantity' => 2,
                'price' => 25000,
                'subtotal' => 50000,
            ]);
        }

        return $order;
    }
}
