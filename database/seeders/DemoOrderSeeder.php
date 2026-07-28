<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoOrderSeeder extends Seeder
{
    public function run(): void
    {
        $customer = Customer::first();
        abort_unless($customer, 500, 'No customer found. Run OutletSeeder first.');

        $outlets = Outlet::whereIn('id', [1, 2])->get();
        abort_if($outlets->isEmpty(), 500, 'No outlets found. Run OutletSeeder first.');

        $products = Product::with('category')->orderBy('id')->limit(8)->get();
        abort_if($products->isEmpty(), 500, 'No products. Run ProductCatalogSeeder first.');

        Order::where('order_code', 'like', 'DEMO-%')->delete();

        $now = now();

        for ($i = 0; $i < 30; $i++) {
            $daysAgo = rand(1, 14);
            $completedAt = $now->copy()->subDays($daysAgo)->subHours(rand(0, 12));

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

            $order = Order::create([
                'customer_id' => $customer->id,
                'outlet_id' => $outlet->id,
                'recommended_outlet_id' => $outlet->id,
                'order_code' => 'DEMO-'.$now->format('Ymd').'-'.str_pad($i + 1, 4, '0', STR_PAD_LEFT),
                'recovery_token' => Str::random(8),
                'status' => 'completed',
                'fulfillment_type' => 'delivery_dombi',
                'subtotal' => $subtotal,
                'delivery_fee' => $fee,
                'total' => $total,
                'payment_method' => ['qris', 'gopay', 'dana', 'bank_transfer'][rand(0, 3)],
                'payment_status' => 'paid',
                'payment_fee' => rand(100, 500),
                'paid_at' => $completedAt->copy()->subMinutes(rand(10, 60)),
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone ?? '089000000001',
                'customer_address' => 'Alamat dummy no '.$i,
                'ordered_at' => $completedAt->copy()->subHours(rand(1, 3)),
                'confirmed_at' => $completedAt->copy()->subHours(rand(0, 1)),
                'completed_at' => $completedAt,
            ]);

            $this->createItem($order, $product1, $qty1);
            $this->createItem($order, $product2, $qty2);

            if ($product3) {
                $this->createItem($order, $product3, $qty3);
            }
        }

        echo "DemoOrderSeeder: 30 orders spread across 2 outlets over 14 days.\n";
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
}
