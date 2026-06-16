<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Order;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TrackController extends Controller
{
    public function __invoke(string $token, Request $request)
    {
        $order = Order::query()
            ->where('recovery_token', strtoupper($token))
            ->with(['outlet:id,name', 'items', 'statusHistories', 'delivery.courier:id,name'])
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
                'tracking_url' => $order->tracking_url,
                'status' => $order->status,
                'fulfillment_type' => $order->fulfillment_type,
                'total' => (float) $order->total,
                'ordered_at' => $order->ordered_at?->toISOString(),
                'outlet' => $order->outlet ? ['name' => $order->outlet->name] : null,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
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
                'customer_address' => self::maskAddress($order->customer_address, $order->customer_address_detail, $order->customer_landmark),
                'rejection_reason' => $order->rejection_reason,
                'rejection_note' => $order->rejection_note,
                'cancellation_reason' => $order->cancellation_reason,
                'cancellation_note' => $order->cancellation_note,
            ],
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
}
