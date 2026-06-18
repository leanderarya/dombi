<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class OrderStatusRaceConditionTest extends TestCase
{
    use RefreshDatabase;

    public function test_reject_order_fails_when_status_changed_after_stale_check(): void
    {
        [$order, $outletUser] = $this->makePendingConfirmationContext();

        // Simulate race condition: order status changes between stale check and lock
        $staleOrder = Order::find($order->id);
        $this->assertTrue($staleOrder->isPendingConfirmation());

        // First rejection succeeds
        app(OrderStatusService::class)->rejectOrder($order, 'Stok Tidak Tersedia', null, $outletUser);

        // Second rejection on stale order should fail (status already changed)
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->rejectOrder($staleOrder, 'Stok Tidak Tersedia', null, $outletUser);
    }

    public function test_cancel_by_customer_fails_when_status_changed_after_stale_check(): void
    {
        [$order] = $this->makePendingConfirmationContext();

        // Simulate race condition: order status changes between stale check and lock
        $staleOrder = Order::find($order->id);
        $this->assertTrue($staleOrder->isPendingConfirmation());

        // First cancellation succeeds
        app(OrderStatusService::class)->cancelByCustomer($order, 'Salah Pesan', null);

        // Second cancellation on stale order should fail (status already changed)
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->cancelByCustomer($staleOrder, 'Salah Pesan', null);
    }

    public function test_reject_order_validates_reason_inside_transaction(): void
    {
        [$order, $outletUser] = $this->makePendingConfirmationContext();

        // Invalid reason should fail even before transaction
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->rejectOrder($order, 'Invalid Reason', null, $outletUser);
    }

    public function test_cancel_by_customer_validates_reason_inside_transaction(): void
    {
        [$order] = $this->makePendingConfirmationContext();

        // Invalid reason should fail even before transaction
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->cancelByCustomer($order, 'Invalid Reason', null);
    }

    public function test_reject_order_requires_note_for_lainnya_reason(): void
    {
        [$order, $outletUser] = $this->makePendingConfirmationContext();

        // Lainnya reason without note should fail
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->rejectOrder($order, 'Lainnya', null, $outletUser);
    }

    public function test_cancel_by_customer_requires_note_for_lainnya_reason(): void
    {
        [$order] = $this->makePendingConfirmationContext();

        // Lainnya reason without note should fail
        $this->expectException(ValidationException::class);
        app(OrderStatusService::class)->cancelByCustomer($order, 'Lainnya', null);
    }

    public function test_reject_order_releases_stock_only_once(): void
    {
        [$order, $outletUser] = $this->makePendingConfirmationContext();

        $initialReserved = OutletInventory::where('outlet_id', $order->outlet_id)
            ->where('product_variant_id', $order->items->first()->product_variant_id)
            ->first()
            ->reserved_stock;

        // Reject the order
        app(OrderStatusService::class)->rejectOrder($order, 'Stok Tidak Tersedia', null, $outletUser);

        // Verify stock was released exactly once
        $finalReserved = OutletInventory::where('outlet_id', $order->outlet_id)
            ->where('product_variant_id', $order->items->first()->product_variant_id)
            ->first()
            ->reserved_stock;

        $this->assertEquals($initialReserved - $order->items->first()->quantity, $finalReserved);
    }

    public function test_cancel_by_customer_releases_stock_only_once(): void
    {
        [$order] = $this->makePendingConfirmationContext();

        $initialReserved = OutletInventory::where('outlet_id', $order->outlet_id)
            ->where('product_variant_id', $order->items->first()->product_variant_id)
            ->first()
            ->reserved_stock;

        // Cancel the order
        app(OrderStatusService::class)->cancelByCustomer($order, 'Salah Pesan', null);

        // Verify stock was released exactly once
        $finalReserved = OutletInventory::where('outlet_id', $order->outlet_id)
            ->where('product_variant_id', $order->items->first()->product_variant_id)
            ->first()
            ->reserved_stock;

        $this->assertEquals($initialReserved - $order->items->first()->quantity, $finalReserved);
    }

    private function makePendingConfirmationContext(): array
    {
        $customer = Customer::create([
            'name' => 'Customer Race',
            'phone' => '628123456789'.rand(10, 99),
        ]);

        $outletUser = User::make([
            'name' => 'Outlet Race',
            'email' => uniqid('outlet-race-').'@example.com',
            'password' => 'password',
        ]);
        $outletUser->role = 'outlet';
        $outletUser->is_active = true;
        $outletUser->save();

        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Outlet Race',
            'kelurahan' => 'Kelurahan',
            'kecamatan' => 'Kecamatan',
            'address' => 'Alamat outlet race',
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Race 500ml',
            'slug' => uniqid('susu-race-'),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $family = ProductFamily::create(['name' => 'Susu Kambing Race', 'brand' => 'Dombi']);
        $variant = ProductVariant::create([
            'product_family_id' => $family->id,
            'product_id' => $product->id,
            'name' => 'Susu Race 500ml Original',
            'flavor' => 'Original',
            'size' => '500ml',
            'center_price' => 20000,
            'selling_price' => 25000,
            'is_active' => true,
        ]);

        OutletInventory::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 2,
            'minimum_stock' => 0,
        ]);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-RACE-'.strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'total' => 50000,
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone,
            'customer_address' => 'Alamat customer race',
            'ordered_at' => now(),
        ]);

        $order->items()->create([
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => 25000,
            'subtotal' => 50000,
        ]);

        return [$order, $outletUser, $customer];
    }
}
