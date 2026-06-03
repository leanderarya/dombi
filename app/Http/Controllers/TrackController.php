<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Inertia\Inertia;

class TrackController extends Controller
{
    public function __invoke(string $token)
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

        return Inertia::render('track', [
            'order' => [
                'id' => $order->id,
                'order_code' => $order->order_code,
                'status' => $order->status,
                'fulfillment_type' => $order->fulfillment_type,
                'customer_name' => $order->customer_name,
                'total' => (float) $order->total,
                'ordered_at' => $order->ordered_at?->toISOString(),
                'outlet' => $order->outlet ? ['name' => $order->outlet->name] : null,
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
                    'status' => $order->delivery->status,
                    'courier' => $order->delivery->courier ? ['name' => $order->delivery->courier->name] : null,
                ] : null,
                'customer_address' => $order->customer_address,
                'customer_address_detail' => $order->customer_address_detail,
                'customer_landmark' => $order->customer_landmark,
                'latitude' => $order->latitude,
                'longitude' => $order->longitude,
            ],
            'found' => true,
        ]);
    }
}
