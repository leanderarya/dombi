<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
use App\Models\StockDistribution;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('password');

        // ── Users ────────────────────────────────────────────────────
        $owner = User::updateOrCreate(['email' => 'owner@example.com'], [
            'name' => 'Owner Dombi', 'password' => $password, 'role' => 'owner',
            'phone' => '081111111111', 'is_active' => true, 'must_change_password' => false,
        ]);
        $outletTembalangUser = User::updateOrCreate(['email' => 'outlet.tembalang@example.com'], [
            'name' => 'Outlet Tembalang', 'password' => $password, 'role' => 'outlet',
            'phone' => '082100000001', 'is_active' => true, 'must_change_password' => false,
        ]);
        $outletBanyumanikUser = User::updateOrCreate(['email' => 'outlet.banyumanik@example.com'], [
            'name' => 'Outlet Banyumanik', 'password' => $password, 'role' => 'outlet',
            'phone' => '082100000002', 'is_active' => true, 'must_change_password' => false,
        ]);
        $courierAndi = User::updateOrCreate(['email' => 'courier.andi@example.com'], [
            'name' => 'Andi Courier', 'password' => $password, 'role' => 'courier',
            'phone' => '083100000001', 'is_active' => true, 'must_change_password' => false,
        ]);
        $courierBudi = User::updateOrCreate(['email' => 'courier.budi@example.com'], [
            'name' => 'Budi Courier', 'password' => $password, 'role' => 'courier',
            'phone' => '083100000002', 'is_active' => true, 'must_change_password' => false,
        ]);
        $customer = Customer::updateOrCreate(['phone' => '6284100000001'], [
            'name' => 'Customer Demo', 'email' => 'customer@example.com', 'is_registered' => false,
        ]);

        // ── Outlets ──────────────────────────────────────────────────
        $tembalang = Outlet::updateOrCreate(['name' => 'Outlet Tembalang'], [
            'user_id' => $outletTembalangUser->id, 'kelurahan' => 'Tembalang', 'kecamatan' => 'Tembalang',
            'city' => 'Semarang', 'province' => 'Jawa Tengah', 'postal_code' => '50275',
            'address' => 'Jl. Tembalang Raya No. 12, Semarang',
            'latitude' => -7.0568000, 'longitude' => 110.4381000, 'phone' => '085555555555', 'status' => 'active',
        ]);
        $banyumanik = Outlet::updateOrCreate(['name' => 'Outlet Banyumanik'], [
            'user_id' => $outletBanyumanikUser->id, 'kelurahan' => 'Banyumanik', 'kecamatan' => 'Banyumanik',
            'city' => 'Semarang', 'province' => 'Jawa Tengah', 'postal_code' => '50263',
            'address' => 'Jl. Banyumanik No. 8, Semarang',
            'latitude' => -7.0731000, 'longitude' => 110.4216000, 'phone' => '086666666666', 'status' => 'active',
        ]);
        $pedurungan = Outlet::updateOrCreate(['name' => 'Outlet Pedurungan'], [
            'user_id' => null, 'kelurahan' => 'Pedurungan', 'kecamatan' => 'Pedurungan',
            'city' => 'Semarang', 'province' => 'Jawa Tengah', 'postal_code' => '50192',
            'address' => 'Jl. Pedurungan Tengah No. 3, Semarang',
            'latitude' => -7.0011000, 'longitude' => 110.4789000, 'phone' => '087777777777', 'status' => 'active',
        ]);

        $outletTembalangUser->update(['outlet_id' => $tembalang->id]);
        $outletBanyumanikUser->update(['outlet_id' => $banyumanik->id]);

        // ── Demo orders using variants ───────────────────────────────
        // Pick a specific variant for demo orders: Domilk Premium Taste Coffee 1L
        $demoVariant = ProductVariant::where('flavor', 'Coffee')->where('size', '1L')->first();

        if ($demoVariant) {
            $pendingOrder = $this->createDemoOrder('DOMBI-DEMO-PENDING', $customer, $banyumanik, $demoVariant, 2, 'pending_confirmation');
            $readyOrder = $this->createDemoOrder('DOMBI-DEMO-READY', $customer, $banyumanik, $demoVariant, 1, 'ready_for_pickup');

            $this->reserveStock($pendingOrder);
            $this->reserveStock($readyOrder);

            Delivery::updateOrCreate(
                ['order_id' => $readyOrder->id],
                ['courier_id' => $courierAndi->id, 'status' => 'waiting_pickup', 'assigned_by' => $owner->id, 'assigned_at' => now()]
            );
        }

        // ── Customer address ─────────────────────────────────────────
        CustomerAddress::updateOrCreate(
            ['customer_id' => $customer->id, 'label' => 'Rumah Tembalang'],
            [
                'recipient_name' => 'Customer Demo', 'phone' => '6284100000001',
                'address' => 'Jl. Sekitar Kampus Tembalang, Semarang',
                'kelurahan' => 'Tembalang', 'kecamatan' => 'Tembalang',
                'latitude' => -7.0559000, 'longitude' => 110.4375000, 'is_default' => true,
            ]
        );

        // ── Demo restock request ─────────────────────────────────────
        if ($demoVariant) {
            $restock = RestockRequest::updateOrCreate(
                ['outlet_id' => $tembalang->id, 'notes' => 'Demo request stok Coffee 1L habis'],
                ['requested_by' => $outletTembalangUser->id, 'status' => 'requested']
            );
            $restock->items()->delete();
            $restock->items()->create([
                'product_variant_id' => $demoVariant->id,
                'requested_quantity' => 12,
            ]);

            $distributionRequest = RestockRequest::updateOrCreate(
                ['outlet_id' => $banyumanik->id, 'notes' => 'Demo distribution shipped'],
                [
                    'requested_by' => $outletBanyumanikUser->id, 'status' => 'shipped',
                    'approved_by' => $owner->id, 'approved_at' => now(),
                    'owner_notes' => 'Dikirim untuk demo penerimaan stok',
                ]
            );
            $distributionRequest->items()->delete();
            $distributionRequest->items()->create([
                'product_variant_id' => $demoVariant->id,
                'requested_quantity' => 5,
                'approved_quantity' => 4,
            ]);

            $distribution = StockDistribution::updateOrCreate(
                ['restock_request_id' => $distributionRequest->id],
                [
                    'outlet_id' => $banyumanik->id, 'status' => 'shipped',
                    'sent_by' => $owner->id, 'sent_at' => now(),
                    'notes' => 'Demo distribution siap diterima outlet',
                ]
            );
            $distribution->items()->delete();
            $distribution->items()->create([
                'product_variant_id' => $demoVariant->id,
                'quantity' => 4,
            ]);
        }
    }

    private function createDemoOrder(string $code, Customer $customer, Outlet $outlet, ProductVariant $variant, int $quantity, string $status): Order
    {
        $subtotal = (float) $variant->selling_price * $quantity;

        $order = Order::updateOrCreate(
            ['order_code' => $code],
            [
                'customer_id' => $customer->id,
                'outlet_id' => $outlet->id,
                'status' => $status,
                'fulfillment_type' => 'pickup',
                'subtotal' => $subtotal,
                'delivery_fee' => 0,
                'payment_fee' => 0,
                'total' => $subtotal,
                'payment_method' => 'cod',
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone ?? '6284100000001',
                'customer_address' => 'Ambil di '.$outlet->name,
                'latitude' => -7.0559000,
                'longitude' => 110.4375000,
                'ordered_at' => now(),
            ]
        );

        $order->items()->delete();
        $order->items()->create([
            'product_id' => $variant->product_id,
            'product_variant_id' => $variant->id,
            'product_name' => $variant->family?->name ?? $variant->name,
            'variant_name_snapshot' => $variant->name,
            'quantity' => $quantity,
            'price' => $variant->selling_price,
            'center_price_snapshot' => $variant->center_price,
            'selling_price_snapshot' => $variant->selling_price,
            'outlet_margin_snapshot' => $variant->outlet_margin,
            'subtotal' => $subtotal,
        ]);

        $order->statusHistories()->delete();
        $order->statusHistories()->create([
            'from_status' => null, 'to_status' => 'pending_confirmation',
            'notes' => 'Order demo dibuat customer.',
            'changed_by' => $customer->id, 'created_at' => now()->subMinutes(20),
        ]);

        if ($status === 'ready_for_pickup') {
            $order->statusHistories()->create([
                'from_status' => 'pending_confirmation', 'to_status' => 'confirmed',
                'notes' => 'Order diterima outlet.', 'created_at' => now()->subMinutes(15),
            ]);
            $order->statusHistories()->create([
                'from_status' => 'confirmed', 'to_status' => 'preparing',
                'notes' => 'Order mulai diproses.', 'created_at' => now()->subMinutes(10),
            ]);
            $order->statusHistories()->create([
                'from_status' => 'preparing', 'to_status' => 'ready_for_pickup',
                'notes' => 'Order siap diambil kurir.', 'created_at' => now()->subMinutes(5),
            ]);
        }

        return $order->fresh('items');
    }

    private function reserveStock(Order $order): void
    {
        foreach ($order->items as $item) {
            $variantId = $item->product_variant_id;
            if (! $variantId) {
                continue;
            }

            $inventory = OutletInventory::where('outlet_id', $order->outlet_id)
                ->where('product_variant_id', $variantId)
                ->first();

            if ($inventory) {
                $inventory->increment('reserved_stock', $item->quantity);
            }
        }
    }
}
