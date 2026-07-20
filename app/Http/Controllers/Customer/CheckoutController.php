<?php

namespace App\Http\Controllers\Customer;

use App\Exceptions\DokuPaymentException;
use App\Exceptions\StockAdjustedException;
use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\DeliveryPricingService;
use App\Services\DokuService;
use App\Services\OrderService;
use App\Services\RecommendOutletService;
use App\Support\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CheckoutController extends Controller
{
    private const FULFILLMENT_TYPES = ['pickup', 'delivery_dombi', 'delivery_ojol'];

    private const CHECKOUT_VISIBLE_FULFILLMENT_TYPES = ['pickup', 'delivery_dombi'];

    private const PAYMENT_METHODS = ['qris', 'transfer', 'ewallet', 'credit_card', 'gopay', 'shopeepay', 'dana'];

    public function redirect(Request $request): RedirectResponse
    {
        return redirect()->route('customer.checkout', array_filter([
            'product_variant_id' => $request->integer('product_variant_id') ?: null,
        ]));
    }

    public function index(
        Request $request,
        RecommendOutletService $recommendOutletService,
        DeliveryPricingService $deliveryPricingService,
    ): Response {
        $draftItems = collect($request->session()->get('checkout.cart', []));

        // Load variants with family info
        $variantIds = $draftItems->pluck('product_variant_id')->filter()->map(fn ($id) => (int) $id)->all();
        $variants = $this->loadCartVariants($variantIds);

        $items = $this->mapVariantItems($draftItems, $variants);
        $location = $request->session()->get('checkout.location');
        $latitude = isset($location['latitude']) ? (float) $location['latitude'] : null;
        $longitude = isset($location['longitude']) ? (float) $location['longitude'] : null;

        $nearestOutlet = null;
        $deliveryPreview = null;

        // Check if user already selected an outlet (from products page)
        $selectedOutletId = $request->session()->get('checkout.selected_outlet_id');
        $selectedOutlet = $selectedOutletId
            ? Outlet::query()->find($selectedOutletId, ['id', 'name', 'latitude', 'longitude', 'address', 'kelurahan', 'kecamatan'])
            : null;

        if ($selectedOutlet && $latitude !== null && $longitude !== null && $selectedOutlet->latitude !== null && $selectedOutlet->longitude !== null) {
            $quote = $deliveryPricingService->quote($latitude, $longitude, (float) $selectedOutlet->latitude, (float) $selectedOutlet->longitude);
            $nearestOutlet = [
                'id' => $selectedOutlet->id,
                'name' => $selectedOutlet->name,
                'distance_km' => $quote['distance_km'],
                'stock_available' => true,
            ];
            $deliveryPreview = $quote;
        } elseif ($latitude !== null && $longitude !== null) {
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
            'draft' => [
                'items' => $items,
                'fulfillment' => $request->session()->get('checkout.fulfillment'),
                'selected_outlet_id' => $request->session()->get('checkout.selected_outlet_id'),
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
            'items.*.product_variant_id' => ['required_without:items.*.product_id', 'nullable', 'integer', Rule::exists('product_variants', 'id')->where('is_active', true)],
            'items.*.product_id' => ['required_without:items.*.product_variant_id', 'nullable', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'fulfillment_type' => ['nullable', Rule::in(self::CHECKOUT_VISIBLE_FULFILLMENT_TYPES)],
            'selected_outlet_id' => ['nullable', 'integer', Rule::exists('outlets', 'id')],
        ]);

        // Normalize items to use product_variant_id
        $items = collect($validated['items'])->map(function ($item) {
            if (! empty($item['product_variant_id'])) {
                return $item;
            }
            // Legacy: find variant from product_id
            if (! empty($item['product_id'])) {
                $variant = ProductVariant::where('product_id', $item['product_id'])->where('is_active', true)->first();
                if ($variant) {
                    $item['product_variant_id'] = $variant->id;
                }
            }

            return $item;
        })->toArray();

        // Always store cart items + selected outlet in session
        $request->session()->put('checkout.cart', $items);

        if (! empty($validated['selected_outlet_id'])) {
            $request->session()->put('checkout.selected_outlet_id', (int) $validated['selected_outlet_id']);
        }

        // If no fulfillment_type provided, just store items and go to checkout step 1
        if (empty($validated['fulfillment_type'])) {
            return redirect()->route('customer.checkout.index');
        }

        // Full submission with fulfillment, store and go to step 2
        // Carry over selected_outlet_id from the separate session key
        if ($selectedId = $request->session()->get('checkout.selected_outlet_id')) {
            $validated['selected_outlet_id'] = $selectedId;
        }
        $request->session()->put('checkout.fulfillment', $validated);

        // Skip customer step for logged-in users with Customer profile (pickup)
        $user = $request->user();
        $customer = $user?->customer;

        if ($user && $customer && $customer->phone && $validated['fulfillment_type'] === 'pickup') {
            $request->session()->put('checkout.customer', [
                'customer_name' => $customer->name,
                'phone_number' => $customer->phone,
                'existing_customer_id' => $customer->id,
            ]);

            return redirect()->route('customer.checkout.payment');
        }

        return redirect()->route('customer.checkout.customer');
    }

    public function customer(
        Request $request,
        OrderService $orderService,
        RecommendOutletService $recommendOutletService,
        DeliveryPricingService $deliveryPricingService,
    ): Response {
        $cart = collect($request->session()->get('checkout.cart', []));

        // Load variants with family info
        $variantIds = $cart->pluck('product_variant_id')->filter()->map(fn ($id) => (int) $id)->all();
        $variants = $this->loadCartVariants($variantIds);

        $fulfillment = $request->session()->get('checkout.fulfillment.fulfillment_type');
        $selectedOutletId = $request->session()->get('checkout.selected_outlet_id')
            ?? $request->session()->get('checkout.fulfillment.selected_outlet_id');
        $location = $request->session()->get('checkout.location');

        // Resolve outlet: prioritize user-selected > nearest recommendation
        $selectedOutlet = $selectedOutletId ? Outlet::query()->find($selectedOutletId, ['id', 'name', 'latitude', 'longitude', 'address', 'kelurahan', 'kecamatan']) : null;

        $previewOutlet = $selectedOutlet ?? (
            $fulfillment === 'pickup'
                ? $orderService->previewAvailableOutlet($cart->all(), $fulfillment, $location)
                : null
        );
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

        $user = $request->user();
        $customer = $user?->customer;

        // Saved addresses for address picker
        $savedAddresses = $customer ? $customer->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('updated_at')
            ->get(['id', 'label', 'recipient_name', 'phone', 'address_line', 'address_detail', 'village', 'district', 'city', 'province', 'postal_code', 'latitude', 'longitude', 'landmark', 'delivery_notes', 'is_default'])
            ->map(fn ($a) => [
                'id' => $a->id,
                'label' => $a->label,
                'recipient_name' => $a->recipient_name,
                'phone' => $a->phone,
                'address_line' => $a->address_line,
                'address_detail' => $a->address_detail,
                'village' => $a->village,
                'district' => $a->district,
                'city' => $a->city,
                'province' => $a->province,
                'postal_code' => $a->postal_code,
                'latitude' => $a->latitude,
                'longitude' => $a->longitude,
                'landmark' => $a->landmark,
                'delivery_notes' => $a->delivery_notes,
                'is_default' => $a->is_default,
            ])
            ->all() : [];

        // Suggest nearest address if GPS is available (no distance cap — frontend decides UX)
        $suggestedAddressId = null;
        if ($savedAddresses && isset($location['latitude'], $location['longitude'])) {
            $userLat = (float) $location['latitude'];
            $userLon = (float) $location['longitude'];
            $best = null;
            $bestDist = PHP_FLOAT_MAX;

            foreach ($savedAddresses as $addr) {
                if (! $addr['latitude'] || ! $addr['longitude']) continue;
                $dist = $this->haversineDistance($userLat, $userLon, (float) $addr['latitude'], (float) $addr['longitude']);
                if ($dist < $bestDist) {
                    $bestDist = $dist;
                    $best = $addr['id'];
                }
            }

            $suggestedAddressId = $best;
        } elseif ($savedAddresses) {
            // No GPS — suggest default
            $default = collect($savedAddresses)->first(fn ($a) => $a['is_default']);
            $suggestedAddressId = $default['id'] ?? null;
        }

        return Inertia::render('customer/checkout/customer', [
            'draft' => [
                'fulfillment' => $request->session()->get('checkout.fulfillment'),
                'customer' => $request->session()->get('checkout.customer'),
                'location' => $location,
                'items' => $this->mapVariantItems($cart, $variants),
            ],
            'authUser' => $user ? [
                'name' => $customer?->name ?? $user->name,
                'phone' => $customer?->phone,
            ] : null,
            'recipientDefaults' => [
                'name' => $customer?->name ?? $user?->name ?? null,
                'phone' => $customer?->phone ?? null,
            ],
            'savedRecipients' => $customer ? $customer->recipients()
                ->orderByDesc('is_default')
                ->orderByDesc('updated_at')
                ->get()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'label' => $r->label,
                    'name' => $r->name,
                    'phone' => $r->phone,
                    'address_line' => $r->address_line,
                    'latitude' => $r->latitude,
                    'longitude' => $r->longitude,
                    'is_default' => $r->is_default,
                ])
                ->all() : [],
            'previewOutlet' => $previewOutlet ? $previewOutlet->only(['id', 'name', 'address', 'kelurahan', 'kecamatan', 'phone']) : null,
            'pickupRecommendations' => $pickupRecommendations,
            'deliveryQuote' => $deliveryQuote,
            'deliveryTiers' => config('delivery.tiers', []),
            'savedAddresses' => $savedAddresses,
            'suggestedAddressId' => $suggestedAddressId,
        ]);
    }

    public function storeCustomer(Request $request): RedirectResponse
    {
        $fulfillmentType = $request->session()->get('checkout.fulfillment.fulfillment_type');
        $isDelivery = in_array($fulfillmentType, ['delivery_dombi', 'delivery_ojol'], true);

        // Delivery requires authentication
        if ($isDelivery && ! $request->user()) {
            $request->session()->put('redirect_after_login', route('customer.checkout.customer'));

            return redirect()->route('customer.checkout.login-prompt');
        }

        // Note: phone is required in form validation below — no OTP gate for authenticated users

        $existingLocation = $request->session()->get('checkout.location', []);
        $hasExistingLocation = $isDelivery
            && is_array($existingLocation)
            && isset($existingLocation['latitude'], $existingLocation['longitude']);

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'min:3', 'max:255'],
            'phone_number' => ['required', 'string', 'max:20'],
            'recipient_name' => ['nullable', 'string', 'min:3', 'max:255'],
            'recipient_phone' => ['nullable', 'string', 'max:20'],
            'save_recipient' => ['nullable', 'boolean'],
            'address_id' => ['nullable', 'integer', Rule::exists('customer_addresses', 'id')],
            'latitude' => [$isDelivery && ! $hasExistingLocation ? 'required' : 'nullable', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => [$isDelivery && ! $hasExistingLocation ? 'required' : 'nullable', 'nullable', 'numeric', 'between:-180,180'],
            'address_line' => [$isDelivery ? 'required' : 'nullable', 'nullable', 'string', 'max:1000'],
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

        // Auto-save phone to Customer record if changed (so next checkout pre-fills)
        $customer = $request->user()?->customer;
        if ($customer && $customer->phone !== $phone) {
            $customer->update(['phone' => $phone]);
        }

        $existingCustomer = Customer::query()
            ->where('phone', $phone)
            ->with(['addresses' => fn ($query) => $query->latest()->limit(1)])
            ->first();

        // Block guest from using phone that belongs to registered account
        if ($existingCustomer && $existingCustomer->user_id !== null && ! $request->user()) {
            return back()->withErrors([
                'phone_number' => 'Nomor ini sudah terdaftar. Silakan masuk dengan akun yang terdaftar.',
            ])->withInput();
        }

        // Block authenticated user from using phone that belongs to different registered account
        if ($existingCustomer
            && $existingCustomer->user_id !== null
            && $request->user()
            && $existingCustomer->user_id !== $request->user()->id
        ) {
            return back()->withErrors([
                'phone_number' => 'Nomor ini milik akun lain. Gunakan nomor kamu sendiri.',
            ])->withInput();
        }

        $request->session()->put('checkout.customer', [
            'customer_name' => $validated['customer_name'],
            'phone_number' => $phone,
            'existing_customer_id' => $existingCustomer?->id,
            'recipient_name' => $validated['recipient_name'] ?? null,
            'recipient_phone' => isset($validated['recipient_phone']) ? $this->normalizeIndonesianPhone($validated['recipient_phone']) : null,
            'save_recipient' => ! empty($validated['save_recipient']),
        ]);

        // Opt-in: save recipient to profile if requested
        if (! empty($validated['save_recipient']) && $isDelivery && $request->user()?->customer) {
            $recipientCustomer = $request->user()->customer;
            $recipientName = $validated['recipient_name'] ?? $validated['customer_name'];
            $recipientPhone = isset($validated['recipient_phone']) ? $this->normalizeIndonesianPhone($validated['recipient_phone']) : $phone;

            $recipientCustomer->recipients()->create([
                'name' => $recipientName,
                'phone' => $recipientPhone,
                'address_line' => $validated['address_line'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
                'is_default' => $recipientCustomer->recipients()->count() === 0,
            ]);
        }

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
                'address_id' => $validated['address_id'] ?? ($existingLocation['address_id'] ?? null),
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

    public function payment(Request $request, RecommendOutletService $recommendOutletService, DeliveryPricingService $deliveryPricingService): Response|RedirectResponse
    {
        $cart = collect($request->session()->get('checkout.cart', []));

        // Load variants with family info
        $variantIds = $cart->pluck('product_variant_id')->filter()->map(fn ($id) => (int) $id)->all();
        $variants = $this->loadCartVariants($variantIds);

        $items = $this->mapVariantItems($cart, $variants);
        $subtotal = (float) collect($items)->sum('subtotal');
        $fulfillmentType = $request->session()->get('checkout.fulfillment.fulfillment_type', 'pickup');
        $location = $request->session()->get('checkout.location');

        $isDelivery = in_array($fulfillmentType, ['delivery_dombi', 'delivery_ojol'], true);
        $pickupOutlet = $fulfillmentType === 'pickup'
            ? Outlet::query()->find($request->session()->get('checkout.fulfillment.selected_outlet_id'), ['id', 'name', 'address', 'kelurahan', 'kecamatan'])
            : null;
        $deliveryQuote = $fulfillmentType === 'delivery_dombi'
            ? $this->resolveDeliveryQuote($cart->all(), $location, $recommendOutletService, $deliveryPricingService)
            : null;

        // Payment via DOKU — 4 metode, threshold subtotal only, full absorb <500k except CC
        $methods = config('doku.methods', []);
        $enabled = config('doku.enabled_methods', ['qris', 'transfer', 'ewallet', 'credit_card']);
        $calculator = app(\App\Services\PaymentFeeCalculator::class);

        $paymentOptions = collect($enabled)
            ->map(fn ($key) => isset($methods[$key]) ? array_merge($methods[$key], ['value' => $key]) : null)
            ->filter()
            ->map(function ($m) use ($subtotal, $calculator) {
                $methodEnum = \App\Enums\PaymentMethod::tryFrom($m['value']) ?? \App\Enums\PaymentMethod::Qris;
                $feeResult = $calculator->calculate($methodEnum, (float) $subtotal);
                return [
                    'value' => $m['value'],
                    'label' => $m['label'],
                    'fee_rate' => $m['fee_rate'],
                    'customer_fee' => $feeResult['customer_fee'],
                    'dombi_fee' => $feeResult['dombi_fee'],
                    'gateway_fee' => $feeResult['gateway_fee'],
                    'is_absorbed' => $feeResult['customer_fee'] === 0.0 && $feeResult['gateway_fee'] > 0,
                    'description' => $feeResult['customer_fee'] === 0.0 && $feeResult['gateway_fee'] > 0
                        ? 'Biaya Layanan Rp 0'
                        : 'Biaya layanan ditanggung pembeli',
                ];
            })
            ->values()
            ->all();

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
                'payment_options' => $paymentOptions,
            ],
            'deliveryTiers' => config('delivery.tiers', []),
        ]);
    }

    public function submit(Request $request, OrderService $orderService, RecommendOutletService $recommendOutletService, DeliveryPricingService $deliveryPricingService): RedirectResponse|JsonResponse
    {
        $fulfillmentType = $request->session()->get('checkout.fulfillment.fulfillment_type');
        $customer = $request->session()->get('checkout.customer');
        $location = $request->session()->get('checkout.location');
        $cart = $request->session()->get('checkout.cart');

        if (! in_array($fulfillmentType, self::FULFILLMENT_TYPES, true)) {
            return redirect()->route('customer.checkout.index')->withErrors(['fulfillment_type' => 'Pilih metode pengambilan terlebih dahulu.']);
        }

        if (! $customer) {
            return redirect()->route('customer.checkout.customer')->withErrors(['phone_number' => 'Isi informasi pemesan terlebih dahulu.']);
        }

        if (in_array($fulfillmentType, ['delivery_dombi', 'delivery_ojol'], true) && ! $location) {
            return redirect()->route('customer.checkout.customer')->withErrors(['latitude' => 'Lengkapi alamat pengiriman terlebih dahulu.']);
        }

        if (! is_array($cart) || count($cart) === 0) {
            return redirect()->route('customer.checkout.index')->withErrors(['items' => 'Pilih produk terlebih dahulu.']);
        }

        $validated = $request->validate([
            'payment_method' => ['required', Rule::in(self::PAYMENT_METHODS)],
        ]);

        // Idempotency: prevent duplicate order from double-tap/refresh
        $fingerprint = md5(json_encode([
            'user' => $request->user()?->id ?: $request->session()->getId(),
            'cart' => $cart,
            'payment' => $validated['payment_method'],
            'outlet' => $request->session()->get('checkout.fulfillment.selected_outlet_id'),
        ], JSON_THROW_ON_ERROR));
        $idempotencyKey = 'checkout_submit:'.$fingerprint;
        $cachedOrderId = Cache::get($idempotencyKey);

        if ($cachedOrderId) {
            $order = Order::find($cachedOrderId);
            if ($order) {
                return redirect()->route('customer.orders.confirmation', [
                    'order' => $order->id,
                    'token' => $order->recovery_token,
                ]);
            }
        }

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
        $gatewayFee = $this->calculateGatewayFee($validated['payment_method'], $subtotal);
        $absorbedFee = $this->calculateAbsorbedFee($validated['payment_method'], $subtotal);

        try {
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
                'gateway_fee' => $gatewayFee,
                'absorbed_fee' => $absorbedFee,
                'notes' => $location['delivery_notes'] ?? null,
            ]);

            // Cache order ID for idempotency (60s TTL)
            Cache::put($idempotencyKey, $order->id, 60);
        } catch (StockAdjustedException $e) {
            // Batch load variants to avoid N+1
            $variantIds = collect($e->adjustments)->pluck('variant_id')->unique()->toArray();
            $variants = ProductVariant::whereIn('id', $variantIds)
                ->with('family')
                ->get()
                ->keyBy('id');

            $warnings = collect($e->adjustments)->map(function ($adj) use ($variants) {
                $variant = $variants->get($adj['variant_id']);
                $name = $variant?->family?->name ?? $variant?->name ?? 'Produk';

                if ($adj['adjusted_qty'] <= 0) {
                    return "{$name}: stok habis, item dihapus dari pesanan";
                }

                return "{$name}: jumlah dikurangi dari {$adj['original_qty']} ke {$adj['adjusted_qty']} (stok tersisa {$adj['available_stock']})";
            })->toArray();

            $allRemoved = collect($e->adjustments)->every(fn ($adj) => $adj['adjusted_qty'] <= 0);

            return response()->json([
                'adjusted' => true,
                'all_removed' => $allRemoved,
                'adjustments' => $e->adjustments,
                'warnings' => $warnings,
            ], 422);
        } catch (ValidationException $e) {
            return back()->withErrors($e->validator->errors())->withInput();
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.'])->withInput();
        }

        // If fully paid by credit, skip DOKU and go straight to confirmation
        if ($order->payment_status === 'paid') {
            $request->session()->forget([
                'checkout.cart',
                'checkout.fulfillment',
                'checkout.customer',
                'checkout.location',
            ]);

            return redirect()->route('customer.orders.confirmation', [
                'order' => $order->id,
                'token' => $order->recovery_token,
            ]);
        }

        // Create DOKU payment immediately — customer pays before outlet confirms.
        // If outlet rejects after payment, refund handled via DOKU.
        try {
            $paymentUrl = app(DokuService::class)->createPayment($order);

            // Clear cart session ONLY after payment URL is successfully created
            $request->session()->forget([
                'checkout.cart',
                'checkout.fulfillment',
                'checkout.customer',
                'checkout.location',
            ]);

            // Inertia/XHR requests can't follow cross-origin redirects (CORS).
            // Return JSON and let the frontend do a full-page navigation.
            if ($request->expectsJson()) {
                return response()->json(['payment_url' => $paymentUrl]);
            }

            return redirect()->away($paymentUrl);
        } catch (DokuPaymentException $e) {
            Log::error('Failed to create DOKU payment', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
                'response_code' => $e->responseCode,
                'doku_errors' => $e->getErrors(),
            ]);

            // Reset confirmation_expires_at so customer gets fresh retry window
            $order->update([
                'confirmation_expires_at' => now()->addMinutes(
                    $order->outlet->confirmation_timeout_minutes ?? config('order.confirmation_timeout_minutes', 15)
                ),
            ]);

            return redirect()->route('customer.orders.confirm', [
                'orderCode' => $order->order_code,
            ])->with('error', 'Gagal membuat pembayaran. Silakan coba lagi.');
        } catch (\Exception $e) {
            Log::error('Failed to create DOKU payment', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            // Reset confirmation_expires_at so customer gets fresh retry window
            $order->update([
                'confirmation_expires_at' => now()->addMinutes(
                    $order->outlet->confirmation_timeout_minutes ?? config('order.confirmation_timeout_minutes', 15)
                ),
            ]);

            return redirect()->route('customer.orders.confirm', [
                'orderCode' => $order->order_code,
            ])->with('error', 'Gagal membuat pembayaran. Silakan coba lagi.');
        }
    }

    public function lookupCustomer(Request $request): JsonResponse
    {
        $phone = $this->normalizeIndonesianPhone((string) $request->query('phone_number'));

        if (! preg_match('/^62[0-9]{9,13}$/', $phone)) {
            return response()->json(['found' => false]);
        }

        $customer = Customer::query()
            ->where('phone', $phone)
            ->with(['addresses' => fn ($query) => $query->latest()->limit(1)])
            ->first();

        // Don't expose registered user's name to guest
        $isGuest = ! $request->user();
        $isRegistered = $customer && $customer->user_id !== null;

        return response()->json([
            'found' => (bool) $customer,
            'customer' => $customer ? [
                'name' => ($isGuest && $isRegistered) ? null : $customer->name,
                'phone_number' => $phone,
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

    public function validateStock(Request $request): JsonResponse
    {
        $cart = $request->session()->get('checkout.cart', []);

        if (empty($cart)) {
            return response()->json([
                'valid' => true,
                'items' => [],
                'warnings' => [],
            ]);
        }

        $variantIds = collect($cart)->pluck('product_variant_id')->filter()->map(fn ($id) => (int) $id)->all();
        $variants = ProductVariant::whereIn('id', $variantIds)
            ->where('is_active', true)
            ->with('family')
            ->get()
            ->keyBy('id');

        // Batch load inventories to avoid N+1
        $inventories = OutletInventory::whereIn('product_variant_id', $variantIds)
            ->where('is_active', true)
            ->get()
            ->keyBy('product_variant_id');

        $items = [];
        $warnings = [];
        $valid = true;

        foreach ($cart as $cartItem) {
            $variantId = (int) $cartItem['product_variant_id'];
            $requestedQty = (int) $cartItem['quantity'];
            $variant = $variants->get($variantId);

            if (! $variant) {
                continue;
            }

            $inventory = $inventories->get($variantId);

            $availableStock = $inventory
                ? max(0, (int) $inventory->current_stock - (int) $inventory->reserved_stock)
                : 0;

            $adjusted = false;
            $adjustedQty = $requestedQty;
            $removed = false;

            if ($availableStock <= 0) {
                $adjusted = true;
                $adjustedQty = 0;
                $removed = true;
                $valid = false;
                $warnings[] = "{$variant->family->name} {$variant->name}: stok habis, item dihapus dari pesanan";
            } elseif ($availableStock < $requestedQty) {
                $adjusted = true;
                $adjustedQty = $availableStock;
                $valid = false;
                $warnings[] = "{$variant->family->name} {$variant->name}: jumlah dikurangi dari {$requestedQty} ke {$availableStock} (stok tersisa {$availableStock})";
            }

            $items[] = [
                'product_variant_id' => $variantId,
                'name' => $variant->family->name ?? $variant->name,
                'variant_name' => $variant->name,
                'requested_qty' => $requestedQty,
                'available_stock' => $availableStock,
                'adjusted' => $adjusted,
                'adjusted_qty' => $adjustedQty,
                'removed' => $removed,
            ];
        }

        return response()->json([
            'valid' => $valid,
            'items' => $items,
            'warnings' => $warnings,
        ]);
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

    /**
     * Load cart variants with eager-loaded family. Cached per request to avoid
     * re-querying the same variants across checkout steps.
     */
    private function loadCartVariants(array $variantIds): Collection
    {
        static $cache = [];

        $key = implode(',', $variantIds);
        if (isset($cache[$key])) {
            return $cache[$key];
        }

        $cache[$key] = ProductVariant::query()
            ->whereIn('id', $variantIds)
            ->where('is_active', true)
            ->with('family')
            ->get();

        return $cache[$key];
    }

    private function mapVariantItems($rawItems, $variants)
    {
        $variantMap = $variants->keyBy('id');

        // Load legacy products for fallback
        $productIds = collect($rawItems)->pluck('product_id')->filter()->map(fn ($id) => (int) $id)->all();
        $products = Product::query()
            ->whereIn('id', $productIds)
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        return collect($rawItems)->map(function (array $item) use ($variantMap, $products): array {
            $variantId = (int) ($item['product_variant_id'] ?? 0);
            $variant = $variantMap->get($variantId);
            $quantity = (int) $item['quantity'];

            // If variant found, use variant data
            if ($variant) {
                return [
                    'product_variant_id' => $variantId,
                    'quantity' => $quantity,
                    'name' => $variant->family?->name ?? $variant->name ?? 'Produk',
                    'variant_name' => $variant->name ?? '',
                    'price' => (float) $variant->selling_price,
                    'subtotal' => (float) $variant->selling_price * $quantity,
                ];
            }

            // Legacy fallback: use product data
            $productId = (int) ($item['product_id'] ?? 0);
            $product = $products->get($productId);
            $price = $product && $product->selling_price > 0 ? (float) $product->selling_price : (float) ($product?->price ?? 0);

            return [
                'product_variant_id' => $variantId,
                'quantity' => $quantity,
                'name' => $product?->name ?? 'Produk',
                'variant_name' => '',
                'price' => $price,
                'subtotal' => $price * $quantity,
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
        $variantIds = collect($cart)->pluck('product_variant_id')->filter()->map(fn ($id) => (int) $id)->all();
        $variants = $this->loadCartVariants($variantIds)->keyBy('id');

        $productIds = collect($cart)->pluck('product_id')->filter()->map(fn ($id) => (int) $id)->all();
        $products = Product::query()
            ->whereIn('id', $productIds)
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        return (float) collect($cart)->sum(function (array $item) use ($variants, $products): float {
            // Prefer variant
            $variantId = (int) ($item['product_variant_id'] ?? 0);
            if ($variantId) {
                $variant = $variants->get($variantId);

                return $variant ? (float) $variant->selling_price * (int) $item['quantity'] : 0;
            }

            // Legacy: product fallback
            $productId = (int) ($item['product_id'] ?? 0);
            if ($productId) {
                $product = $products->get($productId);
                $price = $product?->selling_price > 0 ? $product->selling_price : ($product?->price ?? 0);

                return (float) $price * (int) $item['quantity'];
            }

            return 0;
        });
    }

    private function calculatePaymentFee(string $paymentMethod, float $subtotal): float
    {
        $method = \App\Enums\PaymentMethod::tryFrom($paymentMethod) ?? \App\Enums\PaymentMethod::Qris;
        return app(\App\Services\PaymentFeeCalculator::class)->calculate($method, $subtotal)['customer_fee'];
    }

    private function calculateGatewayFee(string $paymentMethod, float $subtotal): float
    {
        $method = \App\Enums\PaymentMethod::tryFrom($paymentMethod) ?? \App\Enums\PaymentMethod::Qris;
        return app(\App\Services\PaymentFeeCalculator::class)->calculate($method, $subtotal)['gateway_fee'];
    }

    private function calculateAbsorbedFee(string $paymentMethod, float $subtotal): float
    {
        $method = \App\Enums\PaymentMethod::tryFrom($paymentMethod) ?? \App\Enums\PaymentMethod::Qris;
        return app(\App\Services\PaymentFeeCalculator::class)->calculate($method, $subtotal)['dombi_fee'];
    }

    private function normalizeIndonesianPhone(string $phone): string
    {
        return PhoneNormalizer::normalize($phone);
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

    private function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6_371_000; // meters
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
