<?php

namespace App\Services;

use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
        private readonly InventoryService $inventoryService,
    ) {}

    public function createCustomerOrder(User $customer, array $payload): Order
    {
        return DB::transaction(function () use ($customer, $payload): Order {
            $address = CustomerAddress::query()
                ->where('user_id', $customer->id)
                ->findOrFail($payload['address_id']);

            $productIds = collect($payload['items'])->pluck('product_id')->all();
            $products = Product::query()
                ->whereIn('id', $productIds)
                ->where('is_active', true)
                ->get()
                ->keyBy('id');

            $items = collect($payload['items'])->map(function (array $item) use ($products): array {
                $product = $products->get((int) $item['product_id']);

                if (! $product) {
                    throw ValidationException::withMessages(['items' => 'Produk inactive tidak bisa dipesan.']);
                }

                $quantity = (int) $item['quantity'];

                return [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'quantity' => $quantity,
                    'price' => $product->price,
                    'subtotal' => $quantity * (float) $product->price,
                ];
            })->values()->all();

            $outlet = $this->outletAssignmentService->findAvailableOutlet(
                $address->latitude !== null ? (float) $address->latitude : null,
                $address->longitude !== null ? (float) $address->longitude : null,
                $items
            );

            if (! $outlet) {
                throw ValidationException::withMessages([
                    'items' => 'Stok produk tidak tersedia di outlet terdekat maupun outlet lain.',
                ]);
            }

            $subtotal = collect($items)->sum('subtotal');
            $deliveryFee = (float) ($payload['delivery_fee'] ?? 0);

            $order = Order::create([
                'customer_id' => $customer->id,
                'outlet_id' => $outlet->id,
                'order_code' => $this->generateOrderCode(),
                'status' => 'pending',
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'total' => $subtotal + $deliveryFee,
                'customer_name' => $address->recipient_name,
                'customer_phone' => $address->phone,
                'customer_address' => $address->address,
                'latitude' => $address->latitude,
                'longitude' => $address->longitude,
                'notes' => $payload['notes'] ?? null,
                'ordered_at' => now(),
            ]);

            foreach ($items as $item) {
                $order->items()->create($item);
            }

            $this->inventoryService->reserveStock($outlet->id, $items, $order);

            $order->statusHistories()->create([
                'from_status' => null,
                'to_status' => 'pending',
                'notes' => 'Order dibuat customer.',
                'changed_by' => $customer->id,
                'created_at' => now(),
            ]);

            return $order->load(['outlet', 'items.product']);
        });
    }

    public function repeatOrder(User $customer, Order $previousOrder): Order
    {
        abort_unless($previousOrder->customer_id === $customer->id, 403);

        $address = $customer->customerAddresses()->latest()->first();

        if (! $address) {
            throw ValidationException::withMessages(['address_id' => 'Buat alamat terlebih dahulu sebelum order ulang.']);
        }

        return $this->createCustomerOrder($customer, [
            'address_id' => $address->id,
            'items' => $previousOrder->items->map(fn ($item): array => [
                'product_id' => $item->product_id,
                'quantity' => $item->quantity,
            ])->all(),
        ]);
    }

    public function generateOrderCode(): string
    {
        $date = Carbon::now()->format('Ymd');
        $count = Order::query()
            ->whereDate('created_at', Carbon::today())
            ->lockForUpdate()
            ->count() + 1;

        return sprintf('DOMBI-%s-%04d', $date, $count);
    }
}
