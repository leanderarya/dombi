<?php

namespace App\Http\Controllers\Owner;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\CompleteManualRefundRequest;
use App\Http\Requests\Owner\ManualRefundRequest;
use App\Models\Order;
use App\Services\NotificationService;
use App\Services\PaymentStatusService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RefundController extends Controller
{
    public function index(): Response
    {
        $orders = Order::refundable()
            ->with(['outlet', 'customer'])
            ->orderByDesc('refund_requested_at')
            ->paginate(20);

        return Inertia::render('owner/finance/refund-tab', [
            'refunds' => $orders,
        ]);
    }

    public function markRefunded(Order $order, ManualRefundRequest $request, PaymentStatusService $payment): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundPending) {
            return redirect()->back()->with('error', 'Order ini tidak dalam antrean refund.');
        }

        $path = $request->file('proof')->store('refunds', 'public');

        $payment->transition($order, PaymentStatus::Refunded, [
            'refund_amount' => $request->input('refund_amount'),
            'refund_reason' => $request->input('refund_reason'),
            'refund_proof_image' => $path,
            'refunded_by' => auth()->id(),
            'refunded_at' => now(),
        ]);

        app(NotificationService::class)->notifyRefundProcessed($order, (float) $request->input('refund_amount'));

        return redirect()->back()->with('success', 'Refund ditandai selesai.');
    }

    public function complete(Order $order, CompleteManualRefundRequest $request, PaymentStatusService $payment): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundInProgress) {
            return redirect()->back()->with('error', 'Refund tidak dalam proses.');
        }

        $path = $request->file('proof')->store('refunds', 'public');

        $payment->transition($order, PaymentStatus::Refunded, [
            'refund_proof_image' => $path,
            'refunded_by' => auth()->id(),
            'refunded_at' => now(),
            'refund_transfer_reference' => $request->input('reference'),
            'refund_transfer_note' => $request->input('note'),
        ]);

        app(NotificationService::class)->notifyRefundProcessed($order, (float) $order->refund_amount);

        return redirect()->back()->with('success', 'Refund selesai.');
    }

    public function reject(Order $order): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundPending) {
            return redirect()->back()->with('error', 'Order ini tidak dalam antrean refund.');
        }

        app(PaymentStatusService::class)->transition($order, PaymentStatus::RefundRejected, [
            'refund_rejected_reason' => request('reason', 'Ditolak owner'),
        ]);

        return redirect()->back()->with('success', 'Refund ditolak.');
    }
}
