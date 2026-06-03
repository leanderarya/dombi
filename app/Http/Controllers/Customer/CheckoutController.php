<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use App\Services\DeliveryPricingService;
use App\Services\OrderService;
use App\Services\RecommendOutletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    private const FULFILLMENT_TYPES = ['pickup', 'delivery_dombi', 'delivery_ojol'];
    private const CHECKOUT_VISIBLE_FULFILLMENT_TYPES = ['pickup', 'delivery_dombi'];

    private const PAYMENT_METHODS = ['cod', 'qris', 'transfer', 'card'];

    public function redirect(Request $request): RedirectResponse
    {
        return redirect()->route('customer.checkout', array_filter([
            'product_id' => $request->integer('product_id') ?: null,
        ]));
    }

    public function index(
        Request $request,
        RecommendOutletService $recommendOutletService,
        DeliveryPricingService $deliveryPricingService,
    ): Response {
        $draftItems = collect($request->session()->get('checkout.cart', []));
        $products = Product::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'price', 'image', 'unit']);

        $items = $this->mapItems($draftItems, $products);
        $location = $request->session()->get('checkout.location');
        $latitude = isset($location['latitude']) ? (float) $location['latitude'] : null;
        $longitude = isset($location['longitude']) ? (float) $location['longitude'] : null;

        $nearestOutlet = null;
        $deliveryPreview = null;

        if ($latitude !== null && $longitude !== null) {
            $recommended = $recommendOutletService->recommendForDelivery($latitude, $longitude, $draftItems->all());

            if ($recommended) {
                $outlet = Outlet::query()->find($recommended['id'], ['id', 'name', 'latitude', 'longitude', 'address', 'kelurahan', 'kecamatan']);

                if ($outlet && $outlet->latitude !== null && $outlet->longitude !== null) {
                    $quote = $deliveryPricingService->quote($latitude, $longitude, (float) $outlet->latitude, (float) $outlet->longitude);
                    $nearestOutlet = [
                        'id' => $outlet->id,
                        'name' => $outlet->name,
                        'distance_km' => $quote['distance_km'],
                        'stock_available' => true,
                    ];
                    $deliveryPreview = $quote;
                }
            }
        }

        return Inertia::render('customer/checkout/index', [
            'products' => $products,
            'selectedProductId' => $request->integer('product_id') ?: null,
            'draft' => [
                'items' => $items,
                'fulfillment' => $request->session()->get('checkout.fulfillment'),
            ],
            'summary' => $this->buildItemSummary($items),
            'nearestOutlet' => $nearestOutlet,
            'deliveryPreview' => $deliveryPreview,
            'deliveryTiers' => config('delivery.tiers', []),
        ]);
    }

    public function storeIndex(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', Rule::exists('products', 'id')->where('is_active', true)],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'fulfillment_type' => ['required', Rule::in(self::CHECKOUT_VISIBLE_FULFILLMENT_TYPES)],
        ]);

        $request->session()->put('checkout.fulfillment', $validated);
        $request->session()->put('checkout.cart', $validated['items']);

        return redirect()->route('customer.checkout.customer');
    }

    public function customer(
        Request $request,
        OrderService $orderService,
        RecommendOutletService $recommendOutletService,
        DeliveryPricingService $deliveryPricingService,
    ): Response
    {
        $cart = collect($request->session()->get('checkout.cart', []));
        $products = Product::query()
            ->whereIn('id', $cart->pluck('product_id')->map(fn ($id) => (int) $id)->all())
            ->where('is_active', true)
            ->get(['id', 'name', 'price', 'unit']);
        $fulfillment = $request->session()->get('checkout.fulfillment.fulfillment_type');
        $location = $request->session()->get('checkout.location');
        $previewOutlet = $fulfillment === 'pickup'
            ? $orderService->previewAvailableOutlet($cart->all(), $fulfillment, $location)
            : null;
        $pickupRecommendations = $fulfillment === 'pickup'
            ? $recommendOutletService->recommend(
                isset($location['latitude']) ? (float) $location['latitude'] : null,
                isset($location['longitude']) ? (float) $location['longitude'] : null,
                $cart->all(),
            )
            : ['recommended' => null, 'alternatives' => []];
        $deliveryQuote = $fulfillment === 'delivery_dombi'
            ? $this->resolveDeliveryQuote($cart->all(), $location, $recommendOutletService, $deliveryPricingService)
            : null;

        return Inertia::render('customer/checkout/customer', [
            'draft' => [
                'fulfillment' => $request->session()->get('checkout.fulfillment'),
                'customer' => $request->session()->get('checkout.customer'),
                'location' => $location,
                'items' => $this->mapItems($cart, $products),
            ],
            'previewOutlet' => $previewOutlet ? $previewOutlet->only(['id', 'name', 'address', 'kelurahan', 'kecamatan', 'phone']) : null,
            'pickupRecommendations' => $pickupRecommendations,
            'deliveryQuote' => $deliveryQuote,
            'deliveryTiers' => config('delivery.tiers', []),
        ]);
    }

    public function storeCustomer(Request $request): RedirectResponse
    {
        $fulfillmentType = $request->session()->get('checkout.fulfillment.fulfillment_type');
        $isDelivery = in_array($fulfillmentType, ['delivery_dombi', 'delivery_ojol'], true);
        $existingLocation = $request->session()->get('checkout.location', []);
        $hasExistingLocation = $isDelivery
            && is_array($existingLocation)
            && isset($existingLocation['latitude'], $existingLocation['longitude']);

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'min:3', 'max:255'],
            'phone_number' => ['required', 'string', 'max:20'],
            'latitude' => [$isDelivery && ! $hasExistingLocation ? 'required' : 'nullable', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => [$isDelivery && ! $hasExistingLocation ? 'required' : 'nullable', 'nullable', 'numeric', 'between:-180,180'],
            'address_line' => [$isDelivery && ! $hasExistingLocation ? 'required' : 'nullable', 'nullable', 'string', 'max:1000'],
            'address_detail' => ['nullable', 'string', 'max:500'],
            'province' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'village' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'landmark' => ['nullable', 'string', 'max:500'],
            'delivery_notes' => ['nullable', 'string', 'max:1000'],
            'selected_outlet_id' => [$isDelivery ? 'nullable' : 'required', 'nullable', 'integer', Rule::exists('outlets', 'id')],
        ]);

        $phone = $this->normalizeIndonesianPhone($validated['phone_number']);

        if (! preg_match('/^62[0-9]{9,13}$/', $phone)) {
            return back()->withErrors(['phone_number' => 'Nomor WhatsApp harus menggunakan format Indonesia yang valid.'])->withInput();
        }

        $existingCustomer = User::query()
            ->where('role', 'customer')
            ->where('phone', $phone)
            ->with(['customerAddresses' => fn ($query) => $query->latest()->limit(1)])
            ->first();

        $request->session()->put('checkout.customer', [
            'customer_name' => $validated['customer_name'],
            'phone_number' => $phone,
            'existing_customer_id' => $existingCustomer?->id,
        ]);

        $fulfillmentDraft = $request->session()->get('checkout.fulfillment', []);
        $request->session()->put('checkout.fulfillment', [
            ...$fulfillmentDraft,
            'selected_outlet_id' => ! $isDelivery ? ($validated['selected_outlet_id'] ?? null) : null,
        ]);

        if ($isDelivery) {
            $locationPayload = [
                ...$existingLocation,
                'address_line' => $validated['address_line'] ?? ($existingLocation['address_line'] ?? null),
                'address_detail' => $validated['address_detail'] ?? ($existingLocation['address_detail'] ?? null),
                'province' => $validated['province'] ?? ($existingLocation['province'] ?? null),
                'city' => $validated['city'] ?? ($existingLocation['city'] ?? null),
                'district' => $validated['district'] ?? ($existingLocation['district'] ?? null),
                'village' => $validated['village'] ?? ($existingLocation['village'] ?? null),
                'postal_code' => $validated['postal_code'] ?? ($existingLocation['postal_code'] ?? null),
                'latitude' => $validated['latitude'] ?? ($existingLocation['latitude'] ?? null),
                'longitude' => $validated['longitude'] ?? ($existingLocation['longitude'] ?? null),
                'landmark' => $validated['landmark'] ?? ($existingLocation['landmark'] ?? null),
                'delivery_notes' => $validated['delivery_notes'] ?? ($existingLocation['delivery_notes'] ?? null),
            ];

            $request->session()->put('checkout.location', [
                'address_line' => $locationPayload['address_line'],
                'address_detail' => $locationPayload['address_detail'],
                'province' => $locationPayload['province'],
                'city' => $locationPayload['city'],
                'district' => $locationPayload['district'],
                'village' => $locationPayload['village'],
                'postal_code' => $locationPayload['postal_code'],
                'latitude' => $locationPayload['latitude'],
                'longitude' => $locationPayload['longitude'],
                'landmark' => $locationPayload['landmark'],
                'delivery_notes' => $locationPayload['delivery_notes'],
            ]);
        }

        return redirect()->route('customer.checkout.payment');
    }

    public function payment(Request $request, RecommendOutletService $recommendOutletService, DeliveryPricingService $deliveryPricingService): Response
    {
        $cart = collect($request->session()->get('checkout.cart', []));
        $products = Product::query()
            ->whereIn('id', $cart->pluck('product_id')->map(fn ($id) => (int) $id)->all())
            ->where('is_active', true)
            ->get(['id', 'name', 'price', 'unit']);
        $items = $this->mapItems($cart, $products);
        $subtotal = (float) collect($items)->sum('subtotal');
        $fulfillmentType = $request->session()->get('checkout.fulfillment.fulfillment_type', 'pickup');
        $location = $request->session()->get('checkout.location');
        $pickupOutlet = $fulfillmentType === 'pickup'
            ? Outlet::query()->find($request->session()->get('checkout.fulfillment.selected_outlet_id'), ['id', 'name', 'address', 'kelurahan', 'kecamatan'])
            : null;
        $deliveryQuote = $fulfillmentType === 'delivery_dombi'
            ? $this->resolveDeliveryQuote($cart->all(), $location, $recommendOutletService, $deliveryPricingService)
            : null;

        return Inertia::render('customer/checkout/payment', [
            'draft' => [
                'customer' => $request->session()->get('checkout.customer'),
                'fulfillment' => $request->session()->get('checkout.fulfillment'),
                'location' => $location,
                'items' => $items,
                'pickup_outlet' => $pickupOutlet,
            ],
            'summary' => [
                'subtotal' => $subtotal,
                'delivery_fee' => $fulfillmentType === 'delivery_dombi' ? (float) ($deliveryQuote['delivery_fee'] ?? 0) : 0,
                'delivery_quote' => $deliveryQuote,
                'payment_options' => [
                    ['value' => 'cod', 'label' => 'COD', 'fee_rate' => 0],
                    ['value' => 'qris', 'label' => 'QRIS', 'fee_rate' => 0.007],
                    ['value' => 'transfer', 'label' => 'Transfer', 'fee_rate' => 0],
                    ['value' => 'card', 'label' => 'Card', 'fee_rate' => 0.04],
                ],
            ],
            'deliveryTiers' => config('delivery.tiers', []),
        ]);
    }

    public function submit(Request $request, OrderService $orderService, RecommendOutletService $recommendOutletService, DeliveryPricingService $deliveryPricingService): RedirectResponse
    {
        $fulfillmentType = $request->session()->get('checkout.fulfillment.fulfillment_type');
        $customer = $request->session()->get('checkout.customer');
        $location = $request->session()->get('checkout.location');
        $cart = $request->session()->get('checkout.cart');

        if (! in_array($fulfillmentType, self::FULFILLMENT_TYPES, true)) {
            return redirect()->route('customer.checkout')->withErrors(['fulfillment_type' => 'Pilih metode pengambilan terlebih dahulu.']);
        }

        if (! $customer) {
            return redirect()->route('customer.checkout.customer')->withErrors(['phone_number' => 'Isi informasi pemesan terlebih dahulu.']);
        }

        if (in_array($fulfillmentType, ['delivery_dombi', 'delivery_ojol'], true) && ! $location) {
            return redirect()->route('customer.checkout.customer')->withErrors(['latitude' => 'Lengkapi alamat pengiriman terlebih dahulu.']);
        }

        if (! is_array($cart) || count($cart) === 0) {
            return redirect()->route('customer.checkout')->withErrors(['items' => 'Pilih produk terlebih dahulu.']);
        }

        $validated = $request->validate([
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
        ]);

        $subtotal = $this->calculateSubtotal($cart);
        $deliveryQuote = $fulfillmentType === 'delivery_dombi'
            ? $this->resolveDeliveryQuote($cart, $location, $recommendOutletService, $deliveryPricingService)
            : null;

        if ($fulfillmentType === 'delivery_dombi' && (! $deliveryQuote || ! ($deliveryQuote['is_serviceable'] ?? false))) {
            return redirect()->route('customer.checkout.customer')->withErrors([
                'latitude' => 'Maaf, lokasi Anda berada di luar area layanan Kurir Dombi.',
            ]);
        }

        $deliveryFee = $fulfillmentType === 'delivery_dombi' ? (float) ($deliveryQuote['delivery_fee'] ?? 0) : 0;
        $paymentFee = $this->calculatePaymentFee($validated['payment_method'], $subtotal);

        $order = $orderService->createCheckoutOrder($request->user(), [
            ...($location ?? []),
            ...$customer,
            'items' => $cart,
            'fulfillment_type' => $fulfillmentType,
            'selected_outlet_id' => $request->session()->get('checkout.fulfillment.selected_outlet_id'),
            'payment_method' => $validated['payment_method'],
            'delivery_fee' => $deliveryFee,
            'delivery_distance_km' => $deliveryQuote['distance_km'] ?? 0,
            'recommended_outlet_id' => $deliveryQuote['outlet']['id'] ?? null,
            'payment_fee' => $paymentFee,
            'notes' => $location['delivery_notes'] ?? null,
        ]);

        if (! $request->user()) {
            Auth::login($order->customer);
        }

        $request->session()->forget([
            'checkout.cart',
            'checkout.fulfillment',
            'checkout.customer',
            'checkout.location',
        ]);

        return redirect()->route('customer.orders.show', $order)->with('success', 'Order berhasil dibuat.');
    }

    public function lookupCustomer(Request $request): JsonResponse
    {
        $phone = $this->normalizeIndonesianPhone((string) $request->query('phone_number'));

        if (! preg_match('/^62[0-9]{9,13}$/', $phone)) {
            return response()->json(['found' => false]);
        }

        $customer = User::query()
            ->where('role', 'customer')
            ->where('phone', $phone)
            ->with(['customerAddresses' => fn ($query) => $query->latest()->limit(1)])
            ->first();

        return response()->json([
            'found' => (bool) $customer,
            'customer' => $customer ? [
                'name' => $customer->name,
                'phone_number' => $phone,
                'previous_address' => $customer->customerAddresses->first(),
            ] : null,
        ]);
    }

    public function storeLocationDraft(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'address_line' => ['nullable', 'string', 'max:1000'],
            'address_detail' => ['nullable', 'string', 'max:500'],
            'province' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'village' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'timestamp' => ['nullable', 'integer'],
            'landmark' => ['nullable', 'string', 'max:500'],
            'delivery_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $request->session()->put('checkout.location', $validated);

        return response()->json(['saved' => true, 'location' => $validated]);
    }

    public function pickupOutlets(Request $request, RecommendOutletService $recommendOutletService): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $cart = $request->session()->get('checkout.cart', []);
        $recommendations = $recommendOutletService->recommend(
            isset($validated['latitude']) ? (float) $validated['latitude'] : null,
            isset($validated['longitude']) ? (float) $validated['longitude'] : null,
            is_array($cart) ? $cart : [],
        );

        return response()->json($recommendations);
    }

    private function mapItems($rawItems, $products)
    {
        $productMap = $products->keyBy('id');

        return collect($rawItems)->map(function (array $item) use ($productMap): array {
            $product = $productMap->get((int) $item['product_id']);
            $quantity = (int) $item['quantity'];

            return [
                'product_id' => (int) $item['product_id'],
                'quantity' => $quantity,
                'name' => $product?->name ?? 'Produk',
                'price' => (float) ($product?->price ?? 0),
                'subtotal' => $product ? (float) $product->price * $quantity : 0,
                'unit' => $product?->unit ?? 'pcs',
            ];
        })->values()->all();
    }

    private function buildItemSummary(array $items): array
    {
        return [
            'item_count' => (int) collect($items)->sum('quantity'),
            'subtotal' => (float) collect($items)->sum('subtotal'),
        ];
    }

    private function calculateSubtotal(array $cart): float
    {
        $products = Product::query()
            ->whereIn('id', collect($cart)->pluck('product_id')->map(fn ($id) => (int) $id)->all())
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        return (float) collect($cart)->sum(function (array $item) use ($products): float {
            $product = $products->get((int) $item['product_id']);

            return $product ? (float) $product->price * (int) $item['quantity'] : 0;
        });
    }

    private function calculatePaymentFee(string $paymentMethod, float $subtotal): float
    {
        return match ($paymentMethod) {
            'qris' => round($subtotal * 0.007, 2),
            'card' => round($subtotal * 0.04, 2),
            default => 0,
        };
    }

    private function normalizeIndonesianPhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }

        if (str_starts_with($digits, '8')) {
            return '62'.$digits;
        }

        return $digits;
    }

    private function resolveDeliveryQuote(array $cart, $location, RecommendOutletService $recommendOutletService, DeliveryPricingService $deliveryPricingService): ?array
    {
        if (! is_array($location) || ! isset($location['latitude'], $location['longitude'])) {
            return null;
        }

        $recommendedOutlet = $recommendOutletService->recommendForDelivery(
            (float) $location['latitude'],
            (float) $location['longitude'],
            $cart
        );

        if (! $recommendedOutlet) {
            return null;
        }

        $outlet = Outlet::query()->find($recommendedOutlet['id'], ['id', 'name', 'address', 'kelurahan', 'kecamatan', 'latitude', 'longitude']);

        if (! $outlet || $outlet->latitude === null || $outlet->longitude === null) {
            return null;
        }

        $quote = $deliveryPricingService->quote(
            (float) $location['latitude'],
            (float) $location['longitude'],
            (float) $outlet->latitude,
            (float) $outlet->longitude
        );

        return [
            ...$quote,
            'outlet' => [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'address' => $outlet->address,
                'kelurahan' => $outlet->kelurahan,
                'kecamatan' => $outlet->kecamatan,
            ],
        ];
    }
}
