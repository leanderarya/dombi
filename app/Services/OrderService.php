<?php

namespace App\Services;

use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    private const ORDER_CODE_MAX_RETRIES = 5;

    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
        private readonly InventoryService $inventoryService,
    ) {}

    public function createCustomerOrder(User $customer, array $payload): Order
    {
        return $this->createCheckoutOrder($customer, $payload);
    }

    public function createCheckoutOrder(?User $customer, array $payload): Order
    {
        return DB::transaction(function () use ($customer, $payload): Order {
            $customer = $customer ?? $this->findOrCreateGuestCustomer($payload);
            $items = $this->buildOrderItems($payload['items']);
            $fulfillmentType = $payload['fulfillment_type'] ?? 'delivery_dombi';
            $address = $this->shouldUseDeliveryAddress($fulfillmentType)
                ? $this->resolveCheckoutAddress($customer, $payload)
                : null;
            $outlet = $this->assignOutlet($items, $fulfillmentType, $address, $payload);

            if (! $outlet) {
                throw ValidationException::withMessages([
                    'items' => 'Stok produk tidak tersedia di outlet terdekat maupun outlet lain.',
                ]);
            }

            $subtotal = collect($items)->sum('subtotal');
            $deliveryFee = (float) ($payload['delivery_fee'] ?? 0);
            $deliveryDistance = (float) ($payload['delivery_distance_km'] ?? 0);
            $paymentFee = (float) ($payload['payment_fee'] ?? 0);

            $order = Order::create([
                'customer_id' => $customer->id,
                'outlet_id' => $outlet->id,
                'recommended_outlet_id' => $payload['recommended_outlet_id'] ?? $outlet->id,
                'order_code' => $this->generateOrderCodeWithRetry(),
                'status' => 'pending',
                'fulfillment_type' => $fulfillmentType,
                'subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'delivery_distance_km' => $deliveryDistance,
                'payment_method' => $payload['payment_method'] ?? 'cod',
                'payment_fee' => $paymentFee,
                'total' => $subtotal + $deliveryFee + $paymentFee,
                'customer_name' => $address?->recipient_name ?? ($payload['customer_name'] ?? $customer->name),
                'customer_phone' => $address?->phone ?? ($payload['phone_number'] ?? $customer->phone),
                'customer_address' => $address?->address_line ?: $this->pickupAddressLabel($outlet, $fulfillmentType),
                'latitude' => $address?->latitude,
                'longitude' => $address?->longitude,
                'notes' => $payload['notes'] ?? $address?->delivery_notes ?? null,
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

    public function previewAvailableOutlet(array $items, ?string $fulfillmentType, ?array $location = null): ?Outlet
    {
        $builtItems = $this->buildOrderItems($items);
        $lat = $this->shouldUseDeliveryAddress($fulfillmentType)
            ? ($location['latitude'] ?? null)
            : null;
        $lng = $this->shouldUseDeliveryAddress($fulfillmentType)
            ? ($location['longitude'] ?? null)
            : null;

        return $this->outletAssignmentService->findAvailableOutlet(
            $lat !== null ? (float) $lat : null,
            $lng !== null ? (float) $lng : null,
            $builtItems
        );
    }

    private function findOrCreateGuestCustomer(array $payload): User
    {
        $phone = (string) $payload['phone_number'];

        $customer = User::query()
            ->where('role', 'customer')
            ->where('phone', $phone)
            ->lockForUpdate()
            ->first();

        if ($customer) {
            return $customer;
        }

        return User::create([
            'name' => $payload['customer_name'],
            'email' => $this->generateCustomerEmail($phone),
            'password' => Str::random(40),
            'role' => 'customer',
            'phone' => $phone,
            'is_active' => true,
            'must_change_password' => false,
        ]);
    }

    private function resolveCheckoutAddress(User $customer, array $payload): CustomerAddress
    {
        if (! empty($payload['address_id'])) {
            return CustomerAddress::query()
                ->where('user_id', $customer->id)
                ->findOrFail($payload['address_id']);
        }

        CustomerAddress::where('user_id', $customer->id)->update(['is_default' => false]);

        $addressLine = trim((string) $payload['address_line']);
        $houseNumber = trim((string) ($payload['house_number'] ?? ''));

        if ($houseNumber !== '' && ! str_contains($addressLine, $houseNumber)) {
            $addressLine = trim($addressLine.' '.$houseNumber);
        }

        $deliveryNotes = $payload['delivery_notes'] ?? null;

        return $customer->customerAddresses()->create([
            'label' => 'Alamat Checkout',
            'recipient_name' => $payload['customer_name'] ?? $customer->name,
            'phone' => $payload['phone_number'] ?? $customer->phone,
            'address' => $addressLine,
            'address_line' => $addressLine,
            'kelurahan' => $payload['village'] ?? null,
            'kecamatan' => $payload['district'] ?? null,
            'province' => $payload['province'] ?? null,
            'city' => $payload['city'] ?? null,
            'district' => $payload['district'] ?? null,
            'village' => $payload['village'] ?? null,
            'postal_code' => $payload['postal_code'] ?? null,
            'latitude' => $payload['latitude'] ?? null,
            'longitude' => $payload['longitude'] ?? null,
            'landmark' => $payload['landmark'] ?? null,
            'delivery_notes' => $deliveryNotes,
            'is_default' => true,
        ]);
    }

    private function buildOrderItems(array $rawItems): array
    {
        $productIds = collect($rawItems)->pluck('product_id')->all();
        $products = Product::query()
            ->whereIn('id', $productIds)
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        return collect($rawItems)->map(function (array $item) use ($products): array {
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
    }

    private function shouldUseDeliveryAddress(?string $fulfillmentType): bool
    {
        return in_array($fulfillmentType, ['delivery_dombi', 'delivery_ojol'], true);
    }

    private function assignOutlet(array $items, string $fulfillmentType, ?CustomerAddress $address, array $payload): ?Outlet
    {
        if ($fulfillmentType === 'pickup' && ! empty($payload['selected_outlet_id'])) {
            $selectedOutlet = Outlet::query()
                ->where('status', 'active')
                ->with('inventories')
                ->find((int) $payload['selected_outlet_id']);

            if ($selectedOutlet && $this->outletAssignmentService->outletHasEnoughStock($selectedOutlet, $items)) {
                return $selectedOutlet;
            }

            throw ValidationException::withMessages([
                'selected_outlet_id' => 'Outlet pickup yang dipilih sudah tidak tersedia untuk pesanan ini.',
            ]);
        }

        return $this->outletAssignmentService->findAvailableOutlet(
            $this->shouldUseDeliveryAddress($fulfillmentType) && $address?->latitude !== null ? (float) $address->latitude : null,
            $this->shouldUseDeliveryAddress($fulfillmentType) && $address?->longitude !== null ? (float) $address->longitude : null,
            $items
        );
    }

    private function pickupAddressLabel(Outlet $outlet, string $fulfillmentType): string
    {
        if ($fulfillmentType !== 'pickup') {
            return $outlet->address;
        }

        return 'Ambil di '.$outlet->name;
    }

    private function generateCustomerEmail(string $phone): string
    {
        $base = 'customer-'.$phone;
        $email = $base.'@dombi.local';
        $suffix = 2;

        while (User::where('email', $email)->exists()) {
            $email = $base.'-'.$suffix.'@dombi.local';
            $suffix++;
        }

        return $email;
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

    /**
     * Generate order code with retry to handle duplicate race conditions.
     */
    private function generateOrderCodeWithRetry(): string
    {
        $date = Carbon::now()->format('Ymd');

        for ($attempt = 0; $attempt < self::ORDER_CODE_MAX_RETRIES; $attempt++) {
            $count = Order::query()
                ->whereDate('created_at', Carbon::today())
                ->lockForUpdate()
                ->count() + 1 + $attempt;

            $code = sprintf('DOMBI-%s-%04d', $date, $count);

            if (! Order::where('order_code', $code)->exists()) {
                return $code;
            }
        }

        // Fallback: append random suffix
        return sprintf('DOMBI-%s-%04d-%s', $date, $count ?? 1, substr(uniqid(), -4));
    }
}
