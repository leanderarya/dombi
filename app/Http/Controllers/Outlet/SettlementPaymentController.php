<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\SettlementPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'reference_number' => ['required', 'string', 'max:100', 'unique:settlement_payments,reference_number'],
            'payment_date' => ['required', 'date', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        SettlementPayment::create([
            'outlet_id' => $outlet->id,
            'reference_number' => $validated['reference_number'],
            'payment_date' => $validated['payment_date'],
            'amount' => $validated['amount'],
            'notes' => $validated['notes'] ?? null,
            'status' => SettlementPayment::STATUS_PENDING,
        ]);

        return redirect()->route('outlet.settlement-payments.index')
            ->with('success', 'Pembayaran berhasil dikirim. Menunggu verifikasi owner.');
    }
}
