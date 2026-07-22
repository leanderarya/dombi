<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use Carbon\Carbon;

class SettlementReconciliationService
{
    /**
     * Get reconciliation summary for an outlet.
     * Uses weekly settlements as single source of truth.
     */
    public function getOutletReconciliation(int $outletId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        // All-time: get ALL weekly settlements for this outlet (no date filter for outstanding)
        $settlementsQuery = Settlement::query()
            ->where('outlet_id', $outletId)
            ->where('period_type', 'weekly');

        // Center share = total amount_due across all weekly settlements
        $centerShare = (float) (clone $settlementsQuery)
            ->where('status', '!=', Settlement::STATUS_PAID)
            ->sum('amount_due');

        // Sales amount (products only, excluding delivery fee)
        $salesAmount = (float) (clone $settlementsQuery)->sum('sales_amount');

        // Delivery fees
        $deliveryFees = (float) (clone $settlementsQuery)->sum('delivery_fee_amount');

        // Adjustments = total adjustment_amount (returns + exchanges)
        $adjustments = (float) (clone $settlementsQuery)->sum('adjustment_amount');

        // Verified payments (all-time for this outlet)
        $verifiedPayments = (float) SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->sum('amount');

        // Pending payments
        $pendingPayments = (float) SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->sum('amount');

        // Rejected payments
        $rejectedPayments = (float) SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_REJECTED)
            ->sum('amount');

        // Outstanding = center_share - verified_payments + adjustments (adjustments can be negative for returns)
        $outstanding = max(0, $centerShare - $verifiedPayments - $adjustments);

        // Last payment
        $lastPayment = SettlementPayment::query()
            ->where('outlet_id', $outletId)
            ->where('status', SettlementPayment::STATUS_VERIFIED)
            ->latest('payment_date')
            ->first();

        // Courier cost aggregation
        $totalDeliveryFee = (float) Order::where('outlet_id', $outletId)
            ->where('status', Order::STATUS_COMPLETED)
            ->sum('delivery_fee');

        $eksternalCost = (float) Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outletId))
            ->where('courier_type', 'eksternal')
            ->sum('courier_cost');

        $eksternalCount = (int) Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outletId))
            ->where('courier_type', 'eksternal')
            ->count();

        return [
            'center_share' => $centerShare,
            'sales_amount' => $salesAmount,
            'delivery_fees' => $deliveryFees,
            'gross_revenue' => $salesAmount + $deliveryFees,
            'verified_payments' => $verifiedPayments,
            'pending_payments' => $pendingPayments,
            'rejected_payments' => $rejectedPayments,
            'adjustments' => $adjustments,
            'outstanding' => $outstanding,
            'last_payment' => $lastPayment ? [
                'date' => $lastPayment->payment_date->toDateString(),
                'amount' => (float) $lastPayment->amount,
                'reference' => $lastPayment->reference_number,
            ] : null,
            'total_delivery_fee' => $totalDeliveryFee,
            'eksternal_courier_cost' => $eksternalCost,
            'eksternal_delivery_count' => $eksternalCount,
            'net_delivery_income' => $totalDeliveryFee - $eksternalCost,
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
        $overdueSettlements = Settlement::query()
            ->where('status', Settlement::STATUS_OVERDUE)
            ->with('outlet')
            ->get()
            ->groupBy('outlet_id');

        $overdue = [];
        foreach ($overdueSettlements as $outletId => $settlements) {
            $outstanding = $settlements->sum(fn ($s) => (float) $s->outstanding_amount);
            $oldestDue = $settlements->min('due_date');
            $daysOverdue = Carbon::parse($oldestDue)->diffInDays(now());

            $outlet = $settlements->first()->outlet;
            $overdue[] = [
                'outlet' => ['id' => (int) $outletId, 'name' => $outlet->name],
                'outstanding' => (float) $outstanding,
                'oldest_due_date' => $oldestDue instanceof Carbon ? $oldestDue->toDateString() : $oldestDue,
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

            // Calculate days overdue: find oldest unpaid settlement
            $oldestUnpaid = Settlement::query()
                ->where('outlet_id', $row['outlet']['id'])
                ->where('status', '!=', Settlement::STATUS_PAID)
                ->where('amount_due', '>', 0)
                ->orderBy('due_date', 'asc')
                ->first();

            $daysOverdue = 0;
            if ($oldestUnpaid) {
                $daysOverdue = $oldestUnpaid->due_date
                    ? (int) $oldestUnpaid->due_date->diffInDays(now(), false)
                    : 0;
                $daysOverdue = max(0, $daysOverdue);
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

        // Margin ranking (from settlements table)
        $rankByMargin = [];
        foreach ($outlets as $outlet) {
            $outletSettlements = Settlement::where('outlet_id', $outlet->id)->get();
            $grossRevenue = (float) $outletSettlements->sum('sales_amount');
            $outletMargin = $grossRevenue - (float) $outletSettlements->sum('amount_due');
            $rankByMargin[] = [
                'outlet' => ['id' => $outlet->id, 'name' => $outlet->name],
                'outlet_margin' => $outletMargin,
                'gross_revenue' => $grossRevenue,
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
