<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\DokuService;
use App\Services\NotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RefundController extends Controller
{
    public function index(): Response
    {
        $orders = Order::where('payment_status', 'refund_failed')
            ->with(['outlet', 'customer'])
            ->orderByDesc('updated_at')
            ->paginate(20);

        return Inertia::render('owner/finance/refund-tab', [
            'refunds' => $orders,
        ]);
    }

    public function retry(Order $order): RedirectResponse
    {
        if ($order->payment_status !== 'refund_failed') {
            return redirect()->back()->with('error', 'Order ini tidak dalam status refund_failed.');
        }

        $result = app(DokuService::class)->refund($order, $order->refund_reason ?? 'Manual retry');

        if ($result['status'] === 'success') {
            app(NotificationService::class)->notifyRefundProcessed($order, (float) $order->total);
            return redirect()->back()->with('success', 'Refund berhasil diproses.');
        }

        return redirect()->back()->with('error', 'Refund gagal: ' . ($result['error'] ?? 'Unknown error'));
    }

    public function resolve(Order $order): RedirectResponse
    {
        if ($order->payment_status !== 'refund_failed') {
            return redirect()->back()->with('error', 'Order ini tidak dalam status refund_failed.');
        }

        $order->update([
            'refund_reason' => '[Manual] ' . ($order->refund_reason ?? 'Resolved by owner'),
        ]);

        return redirect()->back()->with('success', 'Refund ditandai selesai.');
    }
}
