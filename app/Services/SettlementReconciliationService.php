<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\OutletPayable;
use App\Models\SettlementPayment;
use App\Models\SettlementPeriod;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SettlementReconciliationService
{
    /**
     * Get reconciliation summary for an outlet.
     */
    public function getOutletReconciliation(int $outletId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = $from ?? now()->startOfMonth();
        $to = $to ?? now()->endOfDay();

        // Center share from sales
        $centerShare = OutletPayable::query()
            ->where('outlet_id', $outletId)
            ->where('type', 'sale')
            ->whereBetween('created_at', [$from, $to])
            ->sum('center_share');

        // Verified payments
        $verifiedPayments = SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->whereBetween('payment_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        // Pending payments
        $pendingPayments = SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->sum('amount');

        // Rejected payments
        $rejectedPayments = SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_REJECTED)
            ->whereBetween('payment_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $outstanding = (float) $centerShare - (float) $verifiedPayments;

        // Last payment
        $lastPayment = SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->latest('payment_date')
            ->first();

        return [
            'center_share' => (float) $centerShare,
            'verified_payments' => (float) $verifiedPayments,
            'pending_payments' => (float) $pendingPayments,
            'rejected_payments' => (float) $rejectedPayments,
            'outstanding' => max(0, $outstanding),
            'last_payment' => $lastPayment ? [
                'date' => $lastPayment->payment_date->toDateString(),
                'amount' => (float) $lastPayment->amount,
                'reference' => $lastPayment->reference_number,
            ] : null,
        ];
    }

    /**
     * Get owner dashboard reconciliation data.
     */
    public function getOwnerReconciliation(?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = $from ?? now()->startOfMonth();
        $to = $to ?? now()->endOfDay();

        $outlets = Outlet::where('status', 'active')->get();
        $outletReconciliations = [];

        foreach ($outlets as $outlet) {
            $reconciliation = $this->getOutletReconciliation($outlet->id, $from, $to);
            $outletReconciliations[] = [
                'outlet' => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                ],
                ...$reconciliation,
            ];
        }

        // Sort by outstanding descending
        usort($outletReconciliations, fn ($a, $b) => $b['outstanding'] <=> $a['outstanding']);

        // Pending verifications
        $pendingVerifications = SettlementPayment::query()
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->with('outlet')
            ->latest()
            ->get();

        // Recent payments
        $recentPayments = SettlementPayment::query()
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->with(['outlet', 'verifier'])
            ->latest('payment_date')
            ->limit(10)
            ->get();

        $totalCenterShare = array_sum(array_column($outletReconciliations, 'center_share'));
        $totalCollected = array_sum(array_column($outletReconciliations, 'verified_payments'));
        $totalOutstanding = array_sum(array_column($outletReconciliations, 'outstanding'));
        $totalPending = array_sum(array_column($outletReconciliations, 'pending_payments'));

        return [
            'outlets' => $outletReconciliations,
            'totals' => [
                'center_share' => $totalCenterShare,
                'collected' => $totalCollected,
                'outstanding' => $totalOutstanding,
                'pending_verification' => $totalPending,
            ],
            'pending_verifications' => $pendingVerifications->map(fn ($p) => [
                'id' => $p->id,
                'outlet' => ['id' => $p->outlet_id, 'name' => $p->outlet->name],
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
                'payment_date' => $p->payment_date->toDateString(),
                'notes' => $p->notes,
                'created_at' => $p->created_at->toISOString(),
            ]),
            'recent_payments' => $recentPayments->map(fn ($p) => [
                'id' => $p->id,
                'outlet' => ['id' => $p->outlet_id, 'name' => $p->outlet->name],
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
                'payment_date' => $p->payment_date->toDateString(),
                'verifier' => $p->verifier?->name,
                'verified_at' => $p->verified_at?->toISOString(),
            ]),
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ];
    }

    /**
     * Get overdue outlets (outstanding > 0 with due_date passed).
     */
    public function getOverdueOutlets(): array
    {
        $overduePeriods = SettlementPeriod::query()
            ->where('outstanding_amount', '>', 0)
            ->where('due_date', '<', now()->toDateString())
            ->with('outlet')
            ->get()
            ->groupBy('outlet_id');

        $overdue = [];
        foreach ($overduePeriods as $outletId => $periods) {
            $outstanding = $periods->sum('outstanding_amount');
            $oldestDue = $periods->min('due_date');
            $daysOverdue = Carbon::parse($oldestDue)->diffInDays(now());

            $outlet = $periods->first()->outlet;
            $overdue[] = [
                'outlet' => ['id' => $outletId, 'name' => $outlet->name],
                'outstanding' => (float) $outstanding,
                'oldest_due_date' => $oldestDue,
                'days_overdue' => $daysOverdue,
            ];
        }

        usort($overdue, fn ($a, $b) => $b['outstanding'] <=> $a['outstanding']);

        return $overdue;
    }
}
