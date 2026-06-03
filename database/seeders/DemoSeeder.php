<?php

namespace Database\Seeders;

use App\Models\CustomerAddress;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\RestockRequest;
use App\Models\StockDistribution;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('password');

        $owner = User::updateOrCreate(['email' => 'owner@example.com'], ['name' => 'Owner Dombi', 'password' => $password, 'role' => 'owner', 'phone' => '081111111111', 'is_active' => true, 'must_change_password' => false]);
        $outletTembalangUser = User::updateOrCreate(['email' => 'outlet.tembalang@example.com'], ['name' => 'Outlet Tembalang', 'password' => $password, 'role' => 'outlet', 'phone' => '082100000001', 'is_active' => true, 'must_change_password' => false]);
        $outletBanyumanikUser = User::updateOrCreate(['email' => 'outlet.banyumanik@example.com'], ['name' => 'Outlet Banyumanik', 'password' => $password, 'role' => 'outlet', 'phone' => '082100000002', 'is_active' => true, 'must_change_password' => false]);
        $courierAndi = User::updateOrCreate(['email' => 'courier.andi@example.com'], ['name' => 'Andi Courier', 'password' => $password, 'role' => 'courier', 'phone' => '083100000001', 'is_active' => true, 'must_change_password' => false]);
        $courierBudi = User::updateOrCreate(['email' => 'courier.budi@example.com'], ['name' => 'Budi Courier', 'password' => $password, 'role' => 'courier', 'phone' => '083100000002', 'is_active' => true, 'must_change_password' => false]);
        $customer = User::updateOrCreate(['email' => 'customer@example.com'], ['name' => 'Customer Demo', 'password' => $password, 'role' => 'customer', 'phone' => '084100000001', 'is_active' => true, 'must_change_password' => false]);

        $category = ProductCategory::updateOrCreate(['slug' => 'susu-kambing'], ['name' => 'Susu Kambing', 'is_active' => true]);

        $products = [
            '250ml' => Product::updateOrCreate(['slug' => 'susu-kambing-250ml'], ['product_category_id' => $category->id, 'name' => 'Susu Kambing 250ml', 'description' => 'Ukuran kecil untuk coba harian.', 'size' => '250ml', 'unit' => 'botol', 'price' => 15000, 'is_active' => true]),
            '500ml' => Product::updateOrCreate(['slug' => 'susu-kambing-500ml'], ['product_category_id' => $category->id, 'name' => 'Susu Kambing 500ml', 'description' => 'Produk demo utama untuk fallback stok.', 'size' => '500ml', 'unit' => 'botol', 'price' => 25000, 'is_active' => true]),
            '1l' => Product::updateOrCreate(['slug' => 'susu-kambing-1l'], ['product_category_id' => $category->id, 'name' => 'Susu Kambing 1L', 'description' => 'Ukuran keluarga.', 'size' => '1L', 'unit' => 'botol', 'price' => 45000, 'is_active' => true]),
        ];

        $tembalang = Outlet::updateOrCreate(['name' => 'Outlet Tembalang'], ['user_id' => $outletTembalangUser->id, 'kelurahan' => 'Tembalang', 'kecamatan' => 'Tembalang', 'city' => 'Semarang', 'province' => 'Jawa Tengah', 'postal_code' => '50275', 'address' => 'Jl. Tembalang Raya No. 12, Semarang', 'latitude' => -7.0568000, 'longitude' => 110.4381000, 'phone' => '085555555555', 'status' => 'active']);
        $banyumanik = Outlet::updateOrCreate(['name' => 'Outlet Banyumanik'], ['user_id' => $outletBanyumanikUser->id, 'kelurahan' => 'Banyumanik', 'kecamatan' => 'Banyumanik', 'city' => 'Semarang', 'province' => 'Jawa Tengah', 'postal_code' => '50263', 'address' => 'Jl. Banyumanik No. 8, Semarang', 'latitude' => -7.0731000, 'longitude' => 110.4216000, 'phone' => '086666666666', 'status' => 'active']);
        $pedurungan = Outlet::updateOrCreate(['name' => 'Outlet Pedurungan'], ['user_id' => null, 'kelurahan' => 'Pedurungan', 'kecamatan' => 'Pedurungan', 'city' => 'Semarang', 'province' => 'Jawa Tengah', 'postal_code' => '50192', 'address' => 'Jl. Pedurungan Tengah No. 3, Semarang', 'latitude' => -7.0011000, 'longitude' => 110.4789000, 'phone' => '087777777777', 'status' => 'active']);

        $outletTembalangUser->update(['outlet_id' => $tembalang->id]);
        $outletBanyumanikUser->update(['outlet_id' => $banyumanik->id]);

        $inventoryRows = [
            [$tembalang, $products['250ml'], 3, 0, 3],
            [$tembalang, $products['500ml'], 0, 0, 2],
            [$tembalang, $products['1l'], 8, 0, 2],
            [$banyumanik, $products['250ml'], 15, 0, 4],
            [$banyumanik, $products['500ml'], 10, 0, 3],
            [$banyumanik, $products['1l'], 2, 0, 2],
            [$pedurungan, $products['250ml'], 20, 0, 5],
            [$pedurungan, $products['500ml'], 20, 0, 5],
            [$pedurungan, $products['1l'], 12, 0, 4],
        ];

        foreach ($inventoryRows as [$outlet, $product, $stock, $reserved, $minimum]) {
            $inventory = OutletInventory::updateOrCreate(
                ['outlet_id' => $outlet->id, 'product_id' => $product->id],
                ['current_stock' => $stock, 'reserved_stock' => $reserved, 'minimum_stock' => $minimum]
            );

            StockMovement::updateOrCreate(
                ['outlet_id' => $outlet->id, 'product_id' => $product->id, 'type' => 'initial_stock'],
                ['quantity' => $stock, 'before_stock' => 0, 'after_stock' => $inventory->current_stock, 'notes' => 'Demo stok awal', 'created_by' => $owner->id]
            );
        }

        CustomerAddress::updateOrCreate(
            ['user_id' => $customer->id, 'label' => 'Rumah Tembalang'],
            ['recipient_name' => 'Customer Demo', 'phone' => '084100000001', 'address' => 'Jl. Sekitar Kampus Tembalang, Semarang', 'kelurahan' => 'Tembalang', 'kecamatan' => 'Tembalang', 'latitude' => -7.0559000, 'longitude' => 110.4375000, 'is_default' => true]
        );

        $pendingOrder = $this->order('DOMBI-DEMO-PENDING', $customer, $banyumanik, [['product' => $products['500ml'], 'quantity' => 2]], 'pending');
        $readyOrder = $this->order('DOMBI-DEMO-READY', $customer, $banyumanik, [['product' => $products['500ml'], 'quantity' => 1]], 'ready_for_pickup');

        $this->reserve($pendingOrder);
        $this->reserve($readyOrder);

        Delivery::updateOrCreate(
            ['order_id' => $readyOrder->id],
            ['courier_id' => $courierAndi->id, 'status' => 'waiting_pickup', 'assigned_by' => $owner->id, 'assigned_at' => now()]
        );

        $restock = RestockRequest::updateOrCreate(
            ['outlet_id' => $tembalang->id, 'notes' => 'Demo request stok 500ml habis'],
            ['requested_by' => $outletTembalangUser->id, 'status' => 'requested']
        );
        $restock->items()->delete();
        $restock->items()->create(['product_id' => $products['500ml']->id, 'requested_quantity' => 12]);
        $restock->items()->create(['product_id' => $products['250ml']->id, 'requested_quantity' => 6]);

        $distributionRequest = RestockRequest::updateOrCreate(
            ['outlet_id' => $banyumanik->id, 'notes' => 'Demo distribution shipped'],
            ['requested_by' => $outletBanyumanikUser->id, 'status' => 'shipped', 'approved_by' => $owner->id, 'approved_at' => now(), 'owner_notes' => 'Dikirim untuk demo penerimaan stok']
        );
        $distributionRequest->items()->delete();
        $distributionRequest->items()->create(['product_id' => $products['1l']->id, 'requested_quantity' => 5, 'approved_quantity' => 4]);

        $distribution = StockDistribution::updateOrCreate(
            ['restock_request_id' => $distributionRequest->id],
            ['outlet_id' => $banyumanik->id, 'status' => 'shipped', 'sent_by' => $owner->id, 'sent_at' => now(), 'notes' => 'Demo distribution siap diterima outlet']
        );
        $distribution->items()->delete();
        $distribution->items()->create(['product_id' => $products['1l']->id, 'quantity' => 4]);
    }

    private function order(string $code, User $customer, Outlet $outlet, array $items, string $status): Order
    {
        $subtotal = collect($items)->sum(fn (array $item): float => $item['product']->price * $item['quantity']);

        $order = Order::updateOrCreate(
            ['order_code' => $code],
            ['customer_id' => $customer->id, 'outlet_id' => $outlet->id, 'status' => $status, 'subtotal' => $subtotal, 'delivery_fee' => 0, 'total' => $subtotal, 'customer_name' => $customer->name, 'customer_phone' => $customer->phone ?? '084100000001', 'customer_address' => 'Jl. Sekitar Kampus Tembalang, Semarang', 'latitude' => -7.0559000, 'longitude' => 110.4375000, 'ordered_at' => now()]
        );

        $order->items()->delete();
        foreach ($items as $item) {
            $order->items()->create(['product_id' => $item['product']->id, 'product_name' => $item['product']->name, 'quantity' => $item['quantity'], 'price' => $item['product']->price, 'subtotal' => $item['product']->price * $item['quantity']]);
        }

        $order->statusHistories()->delete();
        $order->statusHistories()->create(['from_status' => null, 'to_status' => 'pending', 'notes' => 'Order demo dibuat customer.', 'changed_by' => $customer->id, 'created_at' => now()->subMinutes(20)]);
        if ($status === 'ready_for_pickup') {
            $order->statusHistories()->create(['from_status' => 'pending', 'to_status' => 'confirmed', 'notes' => 'Order diterima outlet.', 'created_at' => now()->subMinutes(15)]);
            $order->statusHistories()->create(['from_status' => 'confirmed', 'to_status' => 'preparing', 'notes' => 'Order mulai diproses.', 'created_at' => now()->subMinutes(10)]);
            $order->statusHistories()->create(['from_status' => 'preparing', 'to_status' => 'ready_for_pickup', 'notes' => 'Order siap diambil kurir.', 'created_at' => now()->subMinutes(5)]);
        }

        return $order->fresh('items');
    }

    private function reserve(Order $order): void
    {
        foreach ($order->items as $item) {
            $inventory = OutletInventory::where('outlet_id', $order->outlet_id)->where('product_id', $item->product_id)->first();
            if ($inventory) {
                $inventory->increment('reserved_stock', $item->quantity);
            }
        }
    }
}
