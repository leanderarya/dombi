<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    private const ORDER_CODE_MAX_RETRIES = 5;

    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
        private readonly InventoryService $inventoryService,
        private readonly PricingService $pricingService,
        private readonly NotificationService $notificationService,
    ) {}

    public function createCustomerOrder(Customer $customer, array $payload): Order
    {
        return $this->createCheckoutOrder($customer, $payload);
    }

    public function createCheckoutOrder(User|Customer|null $user, array $payload): Order
    {
        return DB::transaction(function () use ($user, $payload): Order {
            $customer = $this->resolveCustomer($user, $payload);
            $items = $this->buildOrderItems($payload['items']);
            $fulfillmentType = $payload['fulfillment_type'] ?? 'delivery_dombi';
            $address = $this->shouldUseDeliveryAddress($fulfillmentType)
                ? $this->resolveCheckoutAddress($customer, $payload)
                : null;

            $candidates = $this->getCandidateOutlets($items, $fulfillmentType, $address, $payload);

            if ($candidates->isEmpty()) {
                throw ValidationException::withMessages([
                    'items' => 'Stok produk tidak tersedia di outlet terdekat maupun outlet lain.',
                ]);
            }

            $subtotal = collect($items)->sum('subtotal');
            $deliveryFee = (float) ($payload['delivery_fee'] ?? 0);
            $deliveryDistance = (float) ($payload['delivery_distance_km'] ?? 0);
            $paymentFee = (float) ($payload['payment_fee'] ?? 0);

            // Try each outlet until reservation succeeds
            foreach ($candidates as $outlet) {
                try {
                    return $this->createOrderWithReservation(
                        $customer, $outlet, $items, $payload, $fulfillmentType, $address,
                        $subtotal, $deliveryFee, $deliveryDistance, $paymentFee,
                    );
                } catch (ValidationException $e) {
                    // Stock was taken between snapshot and reservation — try next outlet
                    continue;
                }
            }

            throw ValidationException::withMessages([
                'items' => 'Stok produk tidak tersedia di outlet terdekat maupun outlet lain.',
            ]);
        });
    }

    private function createOrderWithReservation(
        Customer $customer,
        Outlet $outlet,
        array $items,
        array $payload,
        string $fulfillmentType,
        ?CustomerAddress $address,
        float $subtotal,
        float $deliveryFee,
        float $deliveryDistance,
        float $paymentFee,
    ): Order {
        // Re-resolve prices for the specific outlet (per-outlet pricing)
        $items = $this->applyOutletPricing($items, $outlet->id);
        $subtotal = collect($items)->sum('subtotal');

        $order = Order::create([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'recommended_outlet_id' => $payload['recommended_outlet_id'] ?? $outlet->id,
            'order_code' => $this->generateOrderCodeWithRetry(),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => $fulfillmentType,
            'subtotal' => $subtotal,
            'delivery_fee' => $deliveryFee,
            'delivery_distance_km' => $deliveryDistance,
            'payment_method' => $payload['payment_method'] ?? 'cod',
            'payment_fee' => $paymentFee,
            'total' => $subtotal + $deliveryFee + $paymentFee,
            'customer_name' => $address?->recipient_name ?? ($payload['customer_name'] ?? $customer->name),
            'customer_phone' => $address?->phone ?? ($payload['phone_number'] ?? $customer->phone),
            'recipient_name' => $payload['recipient_name'] ?? null,
            'recipient_phone' => $payload['recipient_phone'] ?? null,
            'customer_address' => $address?->address_line ?: $this->pickupAddressLabel($outlet, $fulfillmentType),
            'customer_address_detail' => $address?->address_detail ?? null,
            'customer_landmark' => $address?->landmark ?? null,
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
            'to_status' => Order::STATUS_PENDING_CONFIRMATION,
            'notes' => 'Order dibuat customer.',
            'changed_by' => $customer->id,
            'changed_by_type' => 'customer',
            'created_at' => now(),
        ]);

        $this->notificationService->notifyOrderCreated($order);

        return $order->load(['outlet', 'items.product']);
    }

    private function getCandidateOutlets(array $items, string $fulfillmentType, ?CustomerAddress $address, array $payload): Collection
    {
        if ($fulfillmentType === 'pickup' && ! empty($payload['selected_outlet_id'])) {
            $selectedOutlet = Outlet::query()
                ->where('status', 'active')
                ->with('inventories')
                ->find((int) $payload['selected_outlet_id']);

            if ($selectedOutlet && $this->outletAssignmentService->outletHasEnoughStock($selectedOutlet, $items)) {
                return collect([$selectedOutlet]);
            }

            throw ValidationException::withMessages([
                'selected_outlet_id' => 'Outlet pickup yang dipilih sudah tidak tersedia untuk pesanan ini.',
            ]);
        }

        return $this->outletAssignmentService->findCandidateOutlets(
            $this->shouldUseDeliveryAddress($fulfillmentType) && $address?->latitude !== null ? (float) $address->latitude : null,
            $this->shouldUseDeliveryAddress($fulfillmentType) && $address?->longitude !== null ? (float) $address->longitude : null,
            $items
        );
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

    public function repeatOrder(Customer $customer, Order $previousOrder): Order
    {
        $items = $previousOrder->items->map(function ($item) {
            return [
                'product_variant_id' => $item->product_variant_id,
                'product_id' => $item->product_id,
                'quantity' => $item->quantity,
            ];
        })->toArray();

        return $this->createCheckoutOrder($customer, [
            'items' => $items,
            'fulfillment_type' => $previousOrder->fulfillment_type,
            'customer_name' => $customer->name,
            'phone_number' => $customer->phone,
            'payment_method' => 'cod',
        ]);
    }

    /**
     * Restore cart items from a previous order.
     *
     * Validates variants exist and are active, checks stock availability,
     * and returns validated items with current pricing.
     *
     * @return array{items: array, warnings: array}
     */
    public function restoreCartFromOrder(Order $order): array
    {
        $order->load('items.variant');

        $restoredItems = [];
        $warnings = [];

        foreach ($order->items as $item) {
            $variant = $item->variant;
            $originalQuantity = (int) $item->quantity;
            $originalName = $item->product_name.($item->variant_name_snapshot ? " {$item->variant_name_snapshot}" : '');

            // Check variant exists and is active
            if (! $variant || ! $variant->is_active) {
                $warnings[] = "{$originalName} sudah tidak tersedia.";

                continue;
            }

            // Use current pricing, not old snapshot
            $currentPrice = (float) $variant->selling_price;

            // Check stock availability across all active outlets
            $availableStock = $this->getMaxAvailableStock($variant->id);
            $restoredQuantity = min($originalQuantity, $availableStock);

            if ($restoredQuantity <= 0) {
                $warnings[] = "{$originalName} stok habis.";

                continue;
            }

            if ($restoredQuantity < $originalQuantity) {
                $warnings[] = "{$originalName}: stok tersedia hanya {$restoredQuantity}.";
            }

            $restoredItems[] = [
                'product_variant_id' => $variant->id,
                'quantity' => $restoredQuantity,
            ];
        }

        return [
            'items' => $restoredItems,
            'warnings' => $warnings,
        ];
    }

    /**
     * Get maximum available stock for a variant across all active outlets.
     */
    private function getMaxAvailableStock(int $variantId): int
    {
        return (int) OutletInventory::query()
            ->where('product_variant_id', $variantId)
            ->whereHas('outlet', fn ($q) => $q->where('status', 'active'))
            ->selectRaw('MAX(current_stock - reserved_stock) as max_available')
            ->value('max_available') ?? 0;
    }

    private function resolveCustomer(User|Customer|null $user, array $payload): Customer
    {
        // Already a Customer model — use directly
        if ($user instanceof Customer) {
            return $user;
        }

        // Authenticated User — find their existing Customer record
        if ($user instanceof User) {
            $customer = $user->customer;
            if ($customer) {
                $customer->update(['last_order_at' => now()]);

                return $customer;
            }
        }

        // Guest fallback
        return $this->findOrCreateGuestCustomer($payload);
    }

    private function findOrCreateGuestCustomer(array $payload): Customer
    {
        $phone = (string) $payload['phone_number'];

        $customer = Customer::query()
            ->where('phone', $phone)
            ->lockForUpdate()
            ->first();

        if ($customer) {
            $customer->update(['last_order_at' => now()]);

            return $customer;
        }

        return Customer::create([
            'name' => $payload['customer_name'],
            'phone' => $phone,
            'is_registered' => false,
            'last_order_at' => now(),
        ]);
    }

    private function resolveCheckoutAddress(Customer $customer, array $payload): CustomerAddress
    {
        if (! empty($payload['address_id'])) {
            return CustomerAddress::query()
                ->where('customer_id', $customer->id)
                ->findOrFail($payload['address_id']);
        }

        CustomerAddress::where('customer_id', $customer->id)->update(['is_default' => false]);

        $addressLine = trim((string) $payload['address_line']);
        $houseNumber = trim((string) ($payload['house_number'] ?? ''));

        if ($houseNumber !== '' && ! str_contains($addressLine, $houseNumber)) {
            $addressLine = trim($addressLine.' '.$houseNumber);
        }

        $deliveryNotes = $payload['delivery_notes'] ?? null;

        return $customer->addresses()->create([
            'label' => 'Alamat Checkout',
            'recipient_name' => $payload['customer_name'] ?? $customer->name,
            'phone' => $payload['phone_number'] ?? $customer->phone,
            'address' => $addressLine,
            'address_line' => $addressLine,
            'address_detail' => $payload['address_detail'] ?? null,
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
        // Support both product_id (legacy) and product_variant_id (new)
        $variantIds = collect($rawItems)->pluck('product_variant_id')->filter()->all();
        $productIds = collect($rawItems)->pluck('product_id')->filter()->all();

        $variants = ProductVariant::query()
            ->whereIn('id', $variantIds)
            ->where('is_active', true)
            ->with('family')
            ->get()
            ->keyBy('id');

        $products = Product::query()
            ->whereIn('id', $productIds)
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        return collect($rawItems)->map(function (array $item) use ($variants, $products): array {
            $quantity = (int) $item['quantity'];

            // Prefer variant over product
            if (! empty($item['product_variant_id'])) {
                $variant = $variants->get((int) $item['product_variant_id']);

                if (! $variant) {
                    throw ValidationException::withMessages(['items' => 'Varian produk tidak ditemukan atau tidak aktif.']);
                }

                return [
                    'product_id' => $variant->product_id,
                    'product_variant_id' => $variant->id,
                    'product_name' => $variant->family?->name ?? $variant->name,
                    'variant_name_snapshot' => $variant->name,
                    'quantity' => $quantity,
                    'price' => $variant->selling_price,
                    'center_price_snapshot' => $variant->center_price,
                    'selling_price_snapshot' => $variant->selling_price,
                    'outlet_margin_snapshot' => $variant->outlet_margin,
                    'subtotal' => $quantity * (float) $variant->selling_price,
                ];
            }

            // Legacy product flow
            $product = $products->get((int) $item['product_id']);

            if (! $product) {
                throw ValidationException::withMessages(['items' => 'Produk tidak ditemukan atau tidak aktif.']);
            }

            $price = $product->selling_price > 0 ? $product->selling_price : $product->price;

            return [
                'product_id' => $product->id,
                'product_variant_id' => null,
                'product_name' => $product->name,
                'variant_name_snapshot' => null,
                'quantity' => $quantity,
                'price' => $price,
                'center_price_snapshot' => $product->center_price > 0 ? $product->center_price : $product->price,
                'selling_price_snapshot' => $price,
                'outlet_margin_snapshot' => $product->selling_price > 0 ? $product->selling_price - $product->center_price : 0,
                'subtotal' => $quantity * (float) $price,
            ];
        })->values()->all();
    }

    private function shouldUseDeliveryAddress(?string $fulfillmentType): bool
    {
        return in_array($fulfillmentType, ['delivery_dombi', 'delivery_ojol'], true);
    }

    private function pickupAddressLabel(Outlet $outlet, string $fulfillmentType): string
    {
        if ($fulfillmentType !== 'pickup') {
            return $outlet->address;
        }

        return 'Ambil di '.$outlet->name;
    }

    /**
     * Re-resolve item prices using per-outlet pricing.
     * Overrides selling_price_snapshot and recalculates subtotal/margin.
     */
    private function applyOutletPricing(array $items, int $outletId): array
    {
        $variantIds = collect($items)->pluck('product_variant_id')->filter()->all();
        $variants = ProductVariant::whereIn('id', $variantIds)->get()->keyBy('id');

        return array_map(function (array $item) use ($variants, $outletId) {
            $variantId = $item['product_variant_id'] ?? null;
            if (! $variantId || ! isset($variants[$variantId])) {
                return $item;
            }

            $variant = $variants[$variantId];
            $outletPrice = $this->pricingService->getSellingPrice($variant, $outletId);
            $centerPrice = (float) $variant->center_price;
            $quantity = (int) $item['quantity'];

            $item['price'] = $outletPrice;
            $item['selling_price_snapshot'] = $outletPrice;
            $item['outlet_margin_snapshot'] = $outletPrice - $centerPrice;
            $item['subtotal'] = $quantity * $outletPrice;

            return $item;
        }, $items);
    }

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
