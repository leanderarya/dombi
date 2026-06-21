<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class TrackController extends Controller
{
    public function __invoke(string $token, Request $request)
    {
        $order = Order::query()
            ->where('recovery_token', strtoupper($token))
            ->with(['outlet:id,name,address,phone,latitude,longitude', 'items', 'statusHistories', 'delivery.courier:id,name'])
            ->first();

        if (! $order) {
            return Inertia::render('track', [
                'order' => null,
                'found' => false,
            ]);
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
                ] : null,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_address' => $order->customer_address,
                'customer_address_detail' => $order->customer_address_detail,
                'customer_landmark' => $order->customer_landmark,
                'rejection_reason' => $order->rejection_reason,
                'rejection_note' => $order->rejection_note,
                'cancellation_reason' => $order->cancellation_reason,
                'cancellation_note' => $order->cancellation_note,
            ],
            'cancellationReasons' => \App\Services\OrderStatusService::cancellationReasons(),
            'notifications' => $notifications,
            'found' => true,
            'canCreateAccount' => $request->session()->get('canCreateAccount', false),
            'accountPhone' => $request->session()->get('accountPhone'),
            'accountName' => $request->session()->get('accountName'),
        ]);
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

    public function cancel(string $token, Request $request, OrderStatusService $orderStatusService): JsonResponse|RedirectResponse
    {
        $order = Order::query()
            ->where('recovery_token', strtoupper($token))
            ->first();

        if (! $order) {
            return response()->json(['success' => false, 'error' => 'Pesanan tidak ditemukan.'], 404);
        }

        $allowedStatuses = [
            Order::STATUS_PENDING_CONFIRMATION,
            Order::STATUS_CONFIRMED,
            Order::STATUS_PREPARING,
        ];

        if (! in_array($order->status, $allowedStatuses, true)) {
            return response()->json(['success' => false, 'error' => 'Pesanan tidak dapat dibatalkan pada status ini.'], 422);
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
            return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
        }

        return response()->json(['success' => true, 'message' => 'Pesanan berhasil dibatalkan.']);
    }
}
