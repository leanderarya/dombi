<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Services\NotificationService;
use App\Services\SettlementPaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

    public function store(Request $request, NotificationService $notificationService, SettlementPaymentService $paymentService): RedirectResponse
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'reference_number' => ['required', 'string', 'max:100', 'unique:settlement_payments,reference_number'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:500'],
            'proof_image' => ['nullable', 'image', 'max:2048'],
        ]);

        $proofPath = null;
        if ($request->hasFile('proof_image')) {
            $proofPath = $request->file('proof_image')->store('payment-proofs', 'public');
        }

        $blockedByOpenIssue = false;
        $payment = DB::transaction(function () use ($outlet, $validated, $proofPath, $paymentService, &$blockedByOpenIssue) {
            Outlet::lockForSettlement($outlet->id);

            $settlements = Settlement::query()
                ->where('outlet_id', $outlet->id)
                ->where('period_type', 'weekly')
                ->where('direction', Settlement::DIRECTION_OUTLET_PAYS)
                ->orderBy('period_start')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $unpaidSettlements = $settlements->where('status', '!=', Settlement::STATUS_PAID)->values();
            $outstandingBySettlement = $unpaidSettlements
                ->mapWithKeys(fn (Settlement $candidate) => [(int) $candidate->id => max(0, abs((float) $candidate->net_amount) - (float) $candidate->paid_amount - (float) $candidate->adjustment_amount)])
                ->all();
            $totalOutstanding = (float) array_sum($outstandingBySettlement);
            $hasPending = SettlementPayment::query()
                ->where('outlet_id', $outlet->id)
                ->where('direction', Settlement::DIRECTION_OUTLET_PAYS)
                ->where('status', SettlementPayment::STATUS_PENDING)
                ->exists();
            $settlement = $unpaidSettlements->first();
            $hasOpenIssue = $paymentService->settlementsHaveOpenIssue($settlements);
            $pathHasOpenIssue = $paymentService->allocationPathHasOpenIssue(
                $unpaidSettlements,
                (float) $validated['amount'],
                $settlement ? [(int) $settlement->id] : [],
            );
            $blockedByOpenIssue = $pathHasOpenIssue || ($totalOutstanding <= 0 && $hasOpenIssue);
            if (! $blockedByOpenIssue && (float) $validated['amount'] > $totalOutstanding) {
                return null;
            }

            if ($hasPending) {
                return null;
            }
            if (! $blockedByOpenIssue && ($totalOutstanding <= 0 || (float) $validated['amount'] > $totalOutstanding)) {
                return null;
            }
            if ($blockedByOpenIssue && ($totalOutstanding <= 0 || ! $settlement) && ! $hasOpenIssue) {
                return null;
            }

            return SettlementPayment::create([
                'outlet_id' => $outlet->id,
                'settlement_id' => $blockedByOpenIssue ? null : $settlement?->id,
                'reference_number' => $validated['reference_number'],
                'payment_date' => $validated['payment_date'],
                'amount' => $validated['amount'],
                'proof_image' => $proofPath,
                'notes' => $validated['notes'] ?? null,
                'status' => SettlementPayment::STATUS_PENDING,
            ]);
        });

        if (! $payment) {
            if ($proofPath) {
                Storage::disk('public')->delete($proofPath);
            }

            return back()->with('error', 'Tidak ada tagihan outlet yang belum dibayar, jumlah pembayaran melebihi tagihan, atau pembayaran lain menunggu verifikasi.');
        }

        $payment->load('outlet');
        $notificationService->notifyPaymentSubmitted($payment);
        if ($blockedByOpenIssue) {
            return back()->with('error', 'Bukti transfer tersimpan sebagai pembayaran menunggu verifikasi tanpa alokasi. Verifikasi diblokir sampai rekonsiliasi settlement diselesaikan.');
        }

        return back()->with('success', 'Berhasil dikirim. Terimakasih sudah melakukan pembayaran.');

    }
}
