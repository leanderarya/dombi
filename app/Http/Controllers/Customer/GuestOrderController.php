<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\GuestCancelOrderRequest;
use App\Models\Order;
use App\Services\OrderStatusService;
use Inertia\Inertia;

class GuestOrderController extends Controller
{
    public function showCancelPage(string $orderId, string $token)
    {
        $order = Order::with(['items.product', 'outlet'])
            ->where('guest_token', $token)
            ->findOrFail($orderId);

        return Inertia::render('guest/cancel', [
            'order' => [
                'id' => $order->id,
                'order_code' => $order->order_code,
                'status' => $order->status,
                'total' => (float) $order->total,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                    'price' => (float) $item->price,
                    'subtotal' => (float) $item->subtotal,
                ]),
                'outlet_name' => $order->outlet?->name,
                'fulfillment_type' => $order->fulfillment_type,
            ],
            'token' => $token,
        ]);
    }

    public function cancel(GuestCancelOrderRequest $request, Order $order, string $token)
    {
        $validated = $request->validated();

        try {
            app(OrderStatusService::class)->cancelByCustomer($order, $validated['reason'], $validated['note'] ?? null);
        } catch (\App\Exceptions\InvalidOrderTransitionException $e) {
            return back()->withErrors(['status' => 'Pesanan tidak dapat dibatalkan pada status ini.']);
        }

        return redirect()->route('track', ['token' => $order->recovery_token])
            ->with('success', 'Pesanan berhasil dibatalkan.');
    }
}
