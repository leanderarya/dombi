<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\Order;
use App\Services\GuestOrderMerger;
use App\Services\OrderStatusService;
use App\Services\RefundPayloadService;
use App\Support\PhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class TrackController extends Controller
{
    public function __invoke(string $token, Request $request, RefundPayloadService $payloads)
    {
        $order = Order::query()
            ->where('recovery_token', strtoupper($token))
            ->with(['outlet:id,name,address,phone,latitude,longitude', 'items', 'statusHistories', 'delivery.courier:id,name', 'customer', 'refundStatusHistories'])
            ->first();

        if (! $order) {
            return Inertia::render('track', [
                'order' => null,
                'found' => false,
            ]);
        }

        // Auto-merge: if user is authenticated and order belongs to an unlinked guest Customer
        // with matching phone, reassign the order to the user's registered Customer.
        $user = $request->user();
        if ($user && $order->customer && ! $order->customer->user_id) {
            $userCustomer = $user->customer;
            $orderPhone = PhoneNormalizer::normalize($order->customer->phone ?? '');
            $userPhone = PhoneNormalizer::normalize($userCustomer?->phone ?? '');

            if ($userPhone && $orderPhone && $userPhone === $orderPhone && $userCustomer) {
                // Reassign order to the user's registered Customer
                $order->update(['customer_id' => $userCustomer->id]);

                // Merge any remaining guest orders with the same phone
                app(GuestOrderMerger::class)->merge($user);
            }
        }

        // Scope notifications to this specific order only
        $notifications = collect();
        if ($order->customer_id) {
            $notifications = Notification::query()
                ->where('customer_id', $order->customer_id)
                ->whereJsonContains('data->order_id', $order->id)
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn (Notification $n) => [
                    'id' => $n->id,
                    'title' => $n->title,
                    'message' => $n->message,
                    'time_ago' => $n->created_at->diffForHumans(),
                ]);
        }

        $refund = $payloads->forGuest($order);
        $canCancel = auth()->check() && $order->customer && $order->customer->user_id === auth()->id();

        return Inertia::render('track', [
            'order' => [
                'id' => $order->id,
                'order_code' => $order->order_code,
                'recovery_token' => $order->recovery_token,
                'tracking_url' => $order->tracking_url,
                'status' => $order->status,
                'fulfillment_type' => $order->fulfillment_type,
                'total' => (float) $order->total,
                'subtotal' => (float) $order->subtotal,
                'delivery_fee' => (float) $order->delivery_fee,
                'payment_method' => $order->payment_method,
                'confirmation_expires_at' => $order->confirmation_expires_at?->toISOString(),
                'payment_status' => $order->payment_status,
                'ordered_at' => $order->ordered_at?->toISOString(),
                'outlet' => $order->outlet ? [
                    'name' => $order->outlet->name,
                    'address' => $order->outlet->address,
                    'phone' => $order->outlet->phone,
                    'operating_hours' => $order->outlet->operating_hours,
                    'latitude' => $order->outlet->latitude ? (float) $order->outlet->latitude : null,
                    'longitude' => $order->outlet->longitude ? (float) $order->outlet->longitude : null,
                ] : null,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                    'price' => (float) $item->price,
                    'subtotal' => (float) $item->subtotal,
                ]),
                'status_histories' => $order->statusHistories->map(fn ($h) => [
                    'to_status' => $h->to_status,
                    'notes' => $h->notes,
                    'created_at' => $h->created_at?->toISOString(),
                ]),
                'delivery' => $order->delivery ? [
                    'courier' => $order->delivery->courier
                        ? ['name' => self::maskName($order->delivery->courier->name)]
                        : null,
                    'failed_reason' => $order->delivery->failed_reason,
                ] : null,
                'customer_name' => self::maskName($order->customer_name),
                'customer_phone' => self::maskPhone($order->customer_phone),
                'customer_address' => self::maskAddress($order->customer_address, $order->customer_address_detail, $order->customer_landmark),
                'customer_address_detail' => $order->customer_address_detail,
                'customer_landmark' => $order->customer_landmark,
                'rejection_reason' => $order->rejection_reason,
                'rejection_note' => $order->rejection_note,
                'cancellation_reason' => $order->cancellation_reason,
                'cancellation_note' => $order->cancellation_note,
            ],
            'cancellationReasons' => [],
            'notifications' => $notifications,
            'found' => true,
            'canCancel' => $canCancel,
            'canCreateAccount' => $request->session()->get('canCreateAccount', false),
            'accountPhone' => $request->session()->get('accountPhone'),
            'accountName' => $request->session()->get('accountName'),
        ]);

        if ($refund !== null) {
            $inertiaResponse->additional(['refund' => $refund]);
        }

        return $inertiaResponse;
    }

    /**
     * Mask address to street name + area only.
     * "Jl. Melati No. 123, RT 01/RW 02, Kel. Tembalang" → "Jl. Melati, Tembalang"
     */
    private static function maskAddress(?string $address, ?string $detail, ?string $landmark): ?string
    {
        if (! $address) {
            return null;
        }

        // Split by comma and take first segment (street) + last segment (kelurahan/kecamatan)
        $parts = array_map('trim', explode(',', $address));

        if (count($parts) >= 2) {
            $street = preg_replace('/\s*No\.?\s*\d+[A-Za-z]?/i', '', $parts[0]);
            $area = end($parts);

            return trim($street).', '.trim($area);
        }

        // Single segment — strip house number
        return preg_replace('/\s*No\.?\s*\d+[A-Za-z]?/i', '', $address);
    }

    /**
     * Mask name to first name + initial.
     * "Budi Santoso" → "Budi S."
     */
    private static function maskName(?string $name): ?string
    {
        if (! $name) {
            return null;
        }

        $parts = explode(' ', trim($name));
        if (count($parts) <= 1) {
            return $parts[0];
        }

        return $parts[0].' '.strtoupper($parts[1][0]).'.';
    }

    /**
     * Mask phone number to show only first 2 and last 4 digits.
     * "081234567890" → "08•••••67890"
     */
    private static function maskPhone(?string $phone): ?string
    {
        if (! $phone) {
            return null;
        }

        $clean = preg_replace('/[^0-9]/', '', $phone);
        $len = strlen($clean);

        if ($len <= 6) {
            return $phone;
        }

        $visibleStart = substr($clean, 0, 2);
        $visibleEnd = substr($clean, -4);
        $maskedMiddle = str_repeat('•', $len - 6);

        return $visibleStart.$maskedMiddle.$visibleEnd;
    }

    public function cancel(string $token, Request $request, OrderStatusService $orderStatusService): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Guest tidak dapat membatalkan pesanan.');
        }

        $order = Order::query()
            ->where('recovery_token', strtoupper($token))
            ->first();

        if (! $order) {
            return response()->json(['success' => false, 'error' => 'Tidak dapat membatalkan pesanan ini.'], 422);
        }

        // Ownership check: pastikan caller adalah pemilik pesanan
        $customer = $order->customer;
        if (! $customer || $customer->user_id !== $user->id) {
            return response()->json(['success' => false, 'error' => 'Anda tidak memiliki akses ke pesanan ini.'], 403);
        }

        $allowedStatuses = [
            Order::STATUS_PENDING_CONFIRMATION,
            Order::STATUS_CONFIRMED,
            Order::STATUS_PREPARING,
        ];

        if (! in_array($order->status, $allowedStatuses, true)) {
            return response()->json(['success' => false, 'error' => 'Tidak dapat membatalkan pesanan ini.'], 422);
        }

        // Step-up verification for pickup orders: require last4 HP
        if ($order->fulfillment_type === Order::FULFILLMENT_PICKUP) {
            $last4Validator = Validator::make($request->all(), [
                'last4_hp' => 'required|string|size:4|regex:/^\d{4}$/',
            ]);

            if ($last4Validator->fails()) {
                return response()->json(['success' => false, 'error' => 'Tidak dapat membatalkan pesanan ini.'], 422);
            }

            $storedDigits = preg_replace('/[^0-9]/', '', $order->customer_phone);
            $expectedLast4 = substr($storedDigits, -4);

            if ($request->input('last4_hp') !== $expectedLast4) {
                return response()->json(['success' => false, 'error' => 'Tidak dapat membatalkan pesanan ini.'], 422);
            }
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string',
            'note' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $orderStatusService->cancelByCustomer($order, $request->input('reason'), $request->input('note'));
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'error' => 'Terjadi kesalahan saat membatalkan pesanan.'], 422);
        }

        return response()->json(['success' => true, 'message' => 'Pesanan berhasil dibatalkan.']);
    }
}
