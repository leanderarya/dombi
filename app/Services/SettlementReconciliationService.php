<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\OutletPayable;
use App\Models\SettlementPayment;
use App\Models\SettlementPeriod;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class SettlementReconciliationService
{
    /**
     * Get reconciliation summary for an outlet.
     */
    public function getOutletReconciliation(int $outletId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = $from ?? now()->startOfMonth();
        $to = $to ?? now()->endOfDay();

        // Center share from sales only (matching SettlementService::getOutletSummary logic)
        $centerShare = OutletPayable::query()
            ->where('outlet_id', $outletId)
            ->where('type', 'sale')
            ->whereBetween('created_at', [$from, $to])
            ->sum('center_share');

        // Verified payments
        $verifiedPayments = SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->whereBetween('payment_date', [$from->toDateString(), $to->copy()->endOfDay()->toDateTimeString()])
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
            ->whereBetween('payment_date', [$from->toDateString(), $to->copy()->endOfDay()->toDateTimeString()])
            ->sum('amount');

        // Adjustments (returns + exchanges) for this period
        $adjustments = (float) OutletPayable::query()
            ->where('outlet_id', $outletId)
            ->where('type', 'adjustment')
            ->whereBetween('created_at', [$from, $to])
            ->sum('amount');

        $outstanding = (float) $centerShare - (float) $verifiedPayments + $adjustments;

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
            'adjustments' => $adjustments,
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

    /**
     * Get collection center data for the owner.
     * Aggregates: hero totals, verification queue, priority list, aging buckets, rankings.
     */
    public function getCollectionCenter(): array
    {
        $outlets = Outlet::where('status', 'active')->get();

        // Use all-time range for collection center
        $allTimeFrom = Carbon::parse('2020-01-01');
        $allTimeTo = Carbon::now()->endOfDay();

        // ── Per-outlet reconciliation (all-time) ──
        $outletRows = [];
        foreach ($outlets as $outlet) {
            $rec = $this->getOutletReconciliation($outlet->id, $allTimeFrom, $allTimeTo);
            $outletRows[] = [
                'outlet' => ['id' => $outlet->id, 'name' => $outlet->name],
                ...$rec,
            ];
        }

        // Sort by outstanding descending
        usort($outletRows, fn ($a, $b) => $b['outstanding'] <=> $a['outstanding']);

        // ── Hero totals ──
        $totalOutstanding = array_sum(array_column($outletRows, 'outstanding'));
        $totalCollected = array_sum(array_column($outletRows, 'verified_payments'));
        $totalPending = array_sum(array_column($outletRows, 'pending_payments'));

        // ── Overdue outlets (outstanding > 0) ──
        $outletsOverdue = count(array_filter($outletRows, fn ($r) => $r['outstanding'] > 0));

        // ── Payment verification queue ──
        $pendingVerifications = SettlementPayment::query()
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->with('outlet')
            ->latest()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'outlet' => ['id' => $p->outlet_id, 'name' => $p->outlet->name],
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
                'payment_date' => $p->payment_date->toDateString(),
                'notes' => $p->notes,
                'created_at' => $p->created_at->toISOString(),
            ])
            ->toArray();

        // ── Collection priority list (outlets with outstanding > 0) ──
        $priorityList = [];
        foreach ($outletRows as $row) {
            if ($row['outstanding'] <= 0) {
                continue;
            }

            // Calculate days overdue: find oldest unpaid sale
            $oldestUnpaid = OutletPayable::query()
                ->where('outlet_id', $row['outlet']['id'])
                ->where('type', 'sale')
                ->where('center_share', '>', 0)
                ->oldest()
                ->first();

            $daysOverdue = 0;
            if ($oldestUnpaid) {
                $daysOverdue = (int) $oldestUnpaid->created_at->diffInDays(now());
            }

            $priorityList[] = [
                'outlet' => $row['outlet'],
                'outstanding' => $row['outstanding'],
                'center_share' => $row['center_share'],
                'verified_payments' => $row['verified_payments'],
                'pending_payments' => $row['pending_payments'],
                'days_overdue' => $daysOverdue,
            ];
        }

        // ── Settlement aging buckets ──
        $buckets = [
            ['label' => '0–7 Hari', 'min' => 0, 'max' => 7, 'count' => 0, 'amount' => 0.0],
            ['label' => '8–14 Hari', 'min' => 8, 'max' => 14, 'count' => 0, 'amount' => 0.0],
            ['label' => '15–30 Hari', 'min' => 15, 'max' => 30, 'count' => 0, 'amount' => 0.0],
            ['label' => '>30 Hari', 'min' => 31, 'max' => 9999, 'count' => 0, 'amount' => 0.0],
        ];

        foreach ($priorityList as $item) {
            $days = $item['days_overdue'];
            foreach ($buckets as &$bucket) {
                if ($days >= $bucket['min'] && $days <= $bucket['max']) {
                    $bucket['count']++;
                    $bucket['amount'] += $item['outstanding'];
                    break;
                }
            }
        }
        unset($bucket);

        // ── Rankings ──
        $rankByRevenue = collect($outletRows)
            ->sortByDesc('center_share')
            ->take(5)
            ->values()
            ->toArray();

        $rankByOutstanding = collect($outletRows)
            ->filter(fn ($r) => $r['outstanding'] > 0)
            ->sortByDesc('outstanding')
            ->take(5)
            ->values()
            ->toArray();

        // Margin ranking
        $settlementService = app(SettlementService::class);
        $rankByMargin = [];
        foreach ($outlets as $outlet) {
            $summary = $settlementService->getOutletSummary($outlet->id);
            $rankByMargin[] = [
                'outlet' => ['id' => $outlet->id, 'name' => $outlet->name],
                'outlet_margin' => $summary['outlet_margin'],
                'gross_revenue' => $summary['gross_revenue'],
            ];
        }
        usort($rankByMargin, fn ($a, $b) => $b['outlet_margin'] <=> $a['outlet_margin']);
        $rankByMargin = array_slice($rankByMargin, 0, 5);

        return [
            'hero' => [
                'total_outstanding' => (float) $totalOutstanding,
                'total_collected' => (float) $totalCollected,
                'total_pending' => (float) $totalPending,
                'outlets_overdue' => (int) $outletsOverdue,
            ],
            'verification_queue' => $pendingVerifications,
            'priority_list' => $priorityList,
            'aging' => $buckets,
            'rankings' => [
                'by_revenue' => $rankByRevenue,
                'by_outstanding' => $rankByOutstanding,
                'by_margin' => $rankByMargin,
            ],
        ];
    }
}
