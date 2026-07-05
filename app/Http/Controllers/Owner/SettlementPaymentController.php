<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\SettlementPayment;
use App\Services\SettlementPaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettlementPaymentController extends Controller
{
    public function __construct(
        private readonly SettlementPaymentService $paymentService,
    ) {}

    public function index(Request $request): Response
    {
        $status = $request->string('status', 'all')->toString();

        $query = SettlementPayment::query()->with(['outlet', 'verifier', 'settlement']);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $payments = $query->latest('payment_date')->paginate(20);

        // KPIs
        $pendingCount = SettlementPayment::where('status', SettlementPayment::STATUS_PENDING)->count();
        $verifiedToday = SettlementPayment::where('status', SettlementPayment::STATUS_VERIFIED)
            ->whereDate('verified_at', now())
            ->sum('amount');
        $verifiedMonth = SettlementPayment::where('status', SettlementPayment::STATUS_VERIFIED)
            ->whereMonth('verified_at', now()->month)
            ->whereYear('verified_at', now()->year)
            ->sum('amount');

        return Inertia::render('owner/finance/settlement-payments', [
            'payments' => $payments,
            'statusFilter' => $status,
            'kpis' => [
                'pending_count' => $pendingCount,
                'verified_today' => (float) $verifiedToday,
                'verified_month' => (float) $verifiedMonth,
            ],
        ]);
    }

    public function verify(SettlementPayment $payment, Request $request): RedirectResponse
    {
        $this->paymentService->verifyPayment($payment, $request->user());

        return redirect()->back()->with('success', "Pembayaran {$payment->reference_number} berhasil diverifikasi.");
    }

    public function reject(SettlementPayment $payment, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $this->paymentService->rejectPayment($payment, $validated['rejection_reason']);

        return redirect()->back()->with('success', "Pembayaran {$payment->reference_number} ditolak.");
    }

    /**
     * Bulk verify payments in a single transaction.
     * If payment_ids provided, verify those specific payments.
     * If no payment_ids, verify ALL pending payments.
     */
    public function bulkVerify(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'payment_ids' => ['nullable', 'array', 'min:1'],
            'payment_ids.*' => ['integer'],
        ]);

        // If no specific IDs provided, get all pending payment IDs
        $paymentIds = $validated['payment_ids'] ?? SettlementPayment::where('status', SettlementPayment::STATUS_PENDING)
            ->pluck('id')
            ->toArray();

        if (empty($paymentIds)) {
            return redirect()->back()->with('success', 'Tidak ada pembayaran yang perlu diverifikasi.');
        }

        $count = $this->paymentService->bulkVerifyPayments(
            $paymentIds,
            $request->user(),
        );

        return redirect()->back()->with('success', "{$count} pembayaran berhasil diverifikasi.");
    }
}
