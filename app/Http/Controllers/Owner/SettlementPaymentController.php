<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\SettlementPayment;
use App\Services\SettlementReconciliationService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettlementPaymentController extends Controller
{
    public function __construct(private readonly SettlementReconciliationService $reconciliationService) {}

    public function index(Request $request): Response
    {
        $status = $request->string('status', 'all')->toString();

        $query = SettlementPayment::query()->with(['outlet', 'verifier']);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $payments = $query->latest('payment_date')->paginate(20);

        return Inertia::render('owner/settlement-payments', [
            'payments' => $payments,
            'statusFilter' => $status,
        ]);
    }

    public function verify(SettlementPayment $payment, Request $request): RedirectResponse
    {
        $payment->update([
            'status' => SettlementPayment::STATUS_VERIFIED,
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
        ]);

        return redirect()->back()->with('success', "Pembayaran {$payment->reference_number} berhasil diverifikasi.");
    }

    public function reject(SettlementPayment $payment, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $payment->update([
            'status' => SettlementPayment::STATUS_REJECTED,
            'rejection_reason' => $validated['rejection_reason'],
        ]);

        return redirect()->back()->with('success', "Pembayaran {$payment->reference_number} ditolak.");
    }
}
