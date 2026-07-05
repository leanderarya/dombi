<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Services\NotificationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SettlementPaymentController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $payments = SettlementPayment::query()
            ->where('outlet_id', $outlet->id)
            ->with('verifier')
            ->latest('payment_date')
            ->paginate(15);

        return Inertia::render('outlet/settlement-payments', [
            'payments' => $payments,
        ]);
    }

    public function store(Request $request, NotificationService $notificationService): RedirectResponse
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        // Block if there's already a pending payment
        $hasPending = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->exists();

        if ($hasPending) {
            return back()->with('error', 'Anda sudah memiliki pembayaran yang menunggu verifikasi. Silakan tunggu hingga pembayaran sebelumnya diverifikasi.');
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'reference_number' => ['required', 'string', 'max:100', 'unique:settlement_payments,reference_number'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:500'],
            'proof_image' => ['nullable', 'image', 'max:2048'],
        ]);

        // Guard: outlet must have outstanding > 0
        $totalOutstanding = (float) Settlement::where('outlet_id', $outlet->id)
            ->where('period_type', 'weekly')
            ->sum(DB::raw('amount_due - paid_amount - adjustment_amount'));

        if ($totalOutstanding <= 0) {
            return back()->with('error', 'Tidak ada tagihan yang belum dibayar.');
        }

        // Guard: amount must not exceed total outstanding
        if ((float) $validated['amount'] > $totalOutstanding) {
            return back()->with('error', "Jumlah pembayaran (Rp " . number_format($validated['amount'], 0, ',', '.') . ") melebihi total tagihan (Rp " . number_format($totalOutstanding, 0, ',', '.') . ").");
        }

        $proofPath = null;
        if ($request->hasFile('proof_image')) {
            $proofPath = $request->file('proof_image')->store('payment-proofs', 'public');
        }

        $settlement = Settlement::where('outlet_id', $outlet->id)
            ->where('status', '!=', Settlement::STATUS_PAID)
            ->orderBy('due_date', 'asc')
            ->first();

        $payment = SettlementPayment::create([
            'outlet_id' => $outlet->id,
            'settlement_id' => $settlement?->id,
            'reference_number' => $validated['reference_number'],
            'payment_date' => $validated['payment_date'],
            'amount' => $validated['amount'],
            'proof_image' => $proofPath,
            'notes' => $validated['notes'] ?? null,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);

        $payment->load('outlet');
        $notificationService->notifyPaymentSubmitted($payment);

        return back()
            ->with('success', 'Berhasil dikirim. Terimakasih sudah melakukan pembayaran.');
    }
}
