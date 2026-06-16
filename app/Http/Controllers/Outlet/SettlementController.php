<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\PaymentAccount;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettlementController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        // Use settlements table as single source of truth (same as owner page)
        $settlements = Settlement::where('outlet_id', $outlet->id)->get();

        // Calculate totals from settlements (all-time, same as owner)
        $totalDue = (float) $settlements->sum('amount_due');
        $totalPaid = (float) $settlements->sum('paid_amount');
        $totalAdjustment = (float) $settlements->sum('adjustment_amount');
        $totalOutstanding = (float) $settlements->sum(fn ($s) => $s->outstanding_amount);

        // Verified payments from settlement_payments table
        $verifiedPayments = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->sum('amount');

        // Pending payments
        $pendingPayments = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->sum('amount');

        // Rejected payments
        $rejectedPayments = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_REJECTED)
            ->sum('amount');

        // Recent payments (last 10, all statuses)
        $payments = SettlementPayment::query()
            ->where('outlet_id', $outlet->id)
            ->with('verifier')
            ->latest('payment_date')
            ->limit(10)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
                'payment_date' => $p->payment_date->toDateString(),
                'status' => $p->status,
                'notes' => $p->notes,
                'rejection_reason' => $p->rejection_reason,
                'verifier' => $p->verifier?->name,
                'verified_at' => $p->verified_at?->toISOString(),
            ]);

        // Check if outlet has pending payment (to block new submissions)
        $hasPendingPayment = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->exists();

        // Last payment info
        $lastPayment = SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->latest('payment_date')
            ->first();

        // Build summary matching frontend interface
        $summary = [
            'gross_revenue' => $totalDue, // amount_due represents the obligation
            'center_share' => $totalDue,
            'outlet_margin' => 0,
            'settled_amount' => $totalPaid,
            'outstanding_amount' => $totalOutstanding,
            'units_sold' => 0,
            'orders_count' => $settlements->count(),
            'top_products' => [],
        ];

        // Build reconciliation matching frontend interface
        $reconciliation = [
            'center_share' => $totalDue,
            'verified_payments' => (float) $verifiedPayments,
            'pending_payments' => (float) $pendingPayments,
            'rejected_payments' => (float) $rejectedPayments,
            'outstanding' => $totalOutstanding,
            'adjustments' => $totalAdjustment,
            'last_payment' => $lastPayment ? [
                'date' => $lastPayment->payment_date->toDateString(),
                'amount' => (float) $lastPayment->amount,
                'reference' => $lastPayment->reference_number,
            ] : null,
        ];

        // Timeline from settlements (instead of outlet_payables)
        $timeline = $settlements->sortByDesc('period_date')->take(20)->map(fn ($s) => [
            'id' => $s->id,
            'type' => 'settlement',
            'amount' => (float) $s->amount_due,
            'center_share' => (float) $s->amount_due,
            'outlet_margin' => 0,
            'notes' => "Settlement periode {$s->period_date->format('d/m/Y')}",
            'created_at' => $s->created_at->toISOString(),
        ]);

        return Inertia::render('outlet/settlement', [
            'summary' => $summary,
            'reconciliation' => $reconciliation,
            'payments' => $payments,
            'timeline' => $timeline,
            'paymentAccounts' => PaymentAccount::active()->orderBy('bank_name')->get(),
            'hasPendingPayment' => $hasPendingPayment,
            'period' => 'all',
            'periodRange' => [
                'from' => $settlements->min('period_date')?->toDateString() ?? now()->toDateString(),
                'to' => $settlements->max('period_date')?->toDateString() ?? now()->toDateString(),
            ],
        ]);
    }

}
