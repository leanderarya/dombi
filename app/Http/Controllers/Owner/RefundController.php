<?php

namespace App\Http\Controllers\Owner;

use App\Enums\PaymentStatus;
use App\Enums\RefundRejectionReason;
use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\CompleteManualRefundRequest;
use App\Http\Requests\Owner\RejectRefundRequest;
use App\Models\Order;
use App\Services\NotificationService;
use App\Services\PaymentStatusService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
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

    public function start(Order $order, PaymentStatusService $payment, NotificationService $notifications): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundPending) {
            return redirect()->back()->with('error', 'Order ini tidak dalam antrean refund.');
        }

        if (blank($order->refund_destination_type) || blank($order->refund_destination_submitted_at)) {
            return redirect()->back()->with('error', 'Customer belum mengisi tujuan refund.');
        }

        $transitioned = $payment->transition($order, PaymentStatus::RefundInProgress, [
            'refund_started_at' => now(),
            'refund_started_by' => auth()->id(),
        ]);

        if (! $transitioned) {
            return redirect()->back()->with('error', 'Gagal memproses refund. Coba lagi.');
        }

        $notifications->notifyRefundProcessingStarted($order);

        return redirect()->back()->with('success', 'Proses refund dimulai.');
    }

    public function complete(Order $order, CompleteManualRefundRequest $request, PaymentStatusService $payment, NotificationService $notifications): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundInProgress) {
            return redirect()->back()->with('error', 'Refund tidak dalam proses.');
        }

        $path = $request->file('proof')->store('refunds', 'public');

        $transitioned = $payment->transition($order, PaymentStatus::Refunded, [
            'refund_amount' => $order->total,
            'refund_proof_image' => $path,
            'refund_transfer_reference' => $request->input('transfer_reference'),
            'refund_transfer_note' => $request->input('transfer_note'),
            'refunded_by' => auth()->id(),
            'refunded_at' => now(),
        ]);

        if (! $transitioned) {
            Storage::disk('public')->delete($path);

            return redirect()->back()->with('error', 'Refund sudah diproses sebelumnya.');
        }

        $notifications->notifyRefundProcessed($order, (float) $order->total);

        return redirect()->back()->with('success', 'Refund ditandai selesai.');
    }

    public function reject(Order $order, RejectRefundRequest $request, PaymentStatusService $payment, NotificationService $notifications): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundPending) {
            return redirect()->back()->with('error', 'Order ini tidak dalam antrean refund.');
        }

        $reason = RefundRejectionReason::from($request->input('reason'));

        $transitioned = $payment->transition($order, PaymentStatus::RefundRejected, [
            'refund_rejected_reason' => $reason->value,
            'refund_rejection_note' => $request->input('note'),
            'refund_rejected_by' => auth()->id(),
            'refund_rejected_at' => now(),
        ]);

        if (! $transitioned) {
            return redirect()->back()->with('error', 'Gagal menolak refund. Coba lagi.');
        }

        $notifications->notifyRefundRejected($order, $reason);

        return redirect()->back()->with('success', 'Refund ditolak.');
    }
}
