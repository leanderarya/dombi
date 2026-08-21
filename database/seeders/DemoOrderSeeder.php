<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Outlet;
use App\Models\Product;
use App\Support\PhoneNormalizer;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoOrderSeeder extends Seeder
{
    public function run(): void
    {
        $customers = Customer::query()->get();
        abort_unless($customers->isNotEmpty(), 500, 'No customers found. Run CustomerSeeder first.');

        $outlets = Outlet::query()->whereIn('name', ['Outlet Tembalang', 'Outlet Banyumanik'])->get();
        abort_if($outlets->count() < 2, 500, 'No outlets found. Run OutletSeeder first.');

        $products = Product::with('category')->orderBy('id')->limit(8)->get();
        abort_if($products->isEmpty(), 500, 'No products. Run ProductCatalogSeeder first.');

        Order::where('order_code', 'like', 'DEMO-%')->delete();

        $registered = $customers->firstWhere('user_id', '!=', null) ?? $customers->first();
        $guest = $customers->where('user_id', null)->firstWhere('phone', PhoneNormalizer::normalize('081200000001'))
            ?? $customers->where('user_id', null)->first();
        abort_unless($guest, 500, 'No guest customer found. Run CustomerSeeder first.');

        $now = now();
        $statuses = [
            'pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup',
            'picked_up', 'delivering', 'delivering', 'completed', 'completed', 'completed',
            'cancelled_by_customer', 'cancelled_by_outlet', 'rejected_by_outlet',
            'failed_delivery', 'expired',
        ];

        $orders = [];
        $idx = 1;

        // 15 orders for registered customer
        foreach (array_slice($statuses, 0, 15) as $cycle => $status) {
            $orders[] = $this->createOrder($registered, $outlets, $products, $now, $idx++, $status);
        }

        // 15 orders for guest customer
        foreach (array_slice($statuses, 0, 15) as $cycle => $status) {
            $orders[] = $this->createOrder($guest, $outlets, $products, $now, $idx++, $status);
        }

        $this->printChecklist($orders);
    }

    private function createOrder(Customer $customer, $outlets, $products, CarbonInterface $now, int $idx, string $status): Order
    {
        $outlet = $outlets->random();
        $product1 = $products->random();
        $qty1 = rand(1, 4);
        $product2 = $products->random();
        $qty2 = rand(1, 3);
        $product3 = rand(0, 1) ? $products->random() : null;
        $qty3 = $product3 ? rand(1, 2) : 0;

        $subtotal = ($product1->selling_price * $qty1)
            + ($product2->selling_price * $qty2)
            + ($product3 ? $product3->selling_price * $qty3 : 0);
        $fee = rand(1000, 3500);
        $total = $subtotal + $fee;

        $orderedAt = $now->copy()->subDays(rand(0, 14))->subHours(rand(1, 3));
        $paid = in_array($status, ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'completed'], true);

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'recommended_outlet_id' => $outlet->id,
            'order_code' => 'DEMO-'.$now->format('Ymd').'-'.str_pad($idx, 4, '0', STR_PAD_LEFT),
            'recovery_token' => Str::random(8),
            'status' => $status,
            'fulfillment_type' => 'delivery_dombi',
            'subtotal' => $subtotal,
            'delivery_fee' => $fee,
            'total' => $total,
            'payment_method' => ['qris', 'gopay', 'dana', 'bank_transfer'][rand(0, 3)],
            'payment_status' => $paid ? 'paid' : 'pending',
            'payment_fee' => rand(100, 500),
            'paid_at' => $paid ? $orderedAt->copy()->addMinutes(rand(2, 10)) : null,
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone ?? '089000000001',
            'customer_address' => 'Alamat dummy order '.$idx,
            'ordered_at' => $orderedAt,
            'confirmed_at' => in_array($status, ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'delivering', 'completed', 'completed'], true) ? $orderedAt->copy()->addMinutes(rand(5, 20)) : null,
            'completed_at' => $status === 'completed' ? $orderedAt->copy()->addHours(rand(1, 3)) : null,
        ]);

        $this->createItem($order, $product1, $qty1);
        $this->createItem($order, $product2, $qty2);

        if ($product3) {
            $this->createItem($order, $product3, $qty3);
        }

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'from_status' => null,
            'to_status' => $status,
            'notes' => 'Status awal demo',
            'changed_by' => null,
            'changed_by_type' => 'system',
            'created_at' => $orderedAt,
        ]);

        return $order;
    }

    private function createItem(Order $order, Product $product, int $qty): void
    {
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name' => $product->category?->name ?? 'Unknown',
            'variant_name_snapshot' => $product->name,
            'quantity' => $qty,
            'price' => $product->selling_price,
            'center_price_snapshot' => $product->center_price,
            'selling_price_snapshot' => $product->selling_price,
            'outlet_margin_snapshot' => (float) $product->selling_price - (float) $product->center_price,
            'subtotal' => $product->selling_price * $qty,
        ]);
    }

    private function printChecklist(array $orders): void
    {
        echo "\n===== DEMO ORDER CHECKLIST =====\n";
        echo 'Total orders seeded: '.count($orders)."\n";
        echo "\nOrder codes (cek pesanan customer di bawah):\n";
        foreach ($orders as $order) {
            $type = $order->customer?->user_id ? 'REGISTERED' : 'GUEST';
            echo sprintf(
                "  %s  [%s]  %-22s  %-18s  %s  Rp %s\n",
                $order->order_code,
                $type,
                $order->status,
                $order->customer_name ?? $order->customer_phone,
                $order->customer_phone,
                number_format($order->total, 0, ',', '.'),
            );
        }
        echo "===============================\n";
    }
}
