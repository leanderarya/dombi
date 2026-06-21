<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ScanController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('outlet/scan');
    }

    public function lookup(Request $request, string $order_code): JsonResponse
    {
        $outlet = $request->user()->outlet ?? Outlet::find($request->user()->outlet_id);

        if (! $outlet) {
            return response()->json(['found' => false, 'error' => 'Outlet tidak ditemukan.']);
        }

        $order = Order::query()
            ->where('outlet_id', $outlet->id)
            ->where('fulfillment_type', 'pickup')
            ->where('order_code', strtoupper($order_code))
            ->with('items')
            ->first();

        if (! $order) {
            return response()->json(['found' => false]);
        }

        if (in_array($order->status, [
            Order::STATUS_CANCELLED_BY_CUSTOMER,
            Order::STATUS_CANCELLED_BY_OUTLET,
            Order::STATUS_REJECTED_BY_OUTLET,
        ], true)) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan sudah dibatalkan.',
            ]);
        }

        if (in_array($order->status, [
            Order::STATUS_PENDING_CONFIRMATION,
            Order::STATUS_CONFIRMED,
            Order::STATUS_PREPARING,
        ], true)) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan belum siap diambil.',
            ]);
        }

        if ($order->status === Order::STATUS_COMPLETED) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan sudah selesai.',
            ]);
        }

        if ($order->status === Order::STATUS_EXPIRED) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan sudah kadaluarsa.',
            ]);
        }

        if ($order->status !== Order::STATUS_READY_FOR_PICKUP) {
            return response()->json([
                'found' => false,
                'error' => 'Status pesanan tidak valid untuk pengambilan.',
            ]);
        }

        return response()->json([
            'found' => true,
            'order' => [
                'id' => $order->id,
                'order_code' => $order->order_code,
                'status' => $order->status,
                'customer_name' => $order->customer_name,
                'total' => (float) $order->total,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                ]),
            ],
        ]);
    }
}
