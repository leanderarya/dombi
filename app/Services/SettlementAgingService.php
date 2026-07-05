<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SettlementAgingService
{
    const CURRENT = 'CURRENT';

    const DUE_TODAY = 'DUE_TODAY';

    const OVERDUE_1_7 = 'OVERDUE_1_7';

    const OVERDUE_8_14 = 'OVERDUE_8_14';

    const OVERDUE_15_30 = 'OVERDUE_15_30';

    const OVERDUE_30_PLUS = 'OVERDUE_30_PLUS';

    const ALL_STATUSES = [
        self::CURRENT,
        self::DUE_TODAY,
        self::OVERDUE_1_7,
        self::OVERDUE_8_14,
        self::OVERDUE_15_30,
        self::OVERDUE_30_PLUS,
    ];

    public function calculateDaysOverdue(?string $dueDate): int
    {
        if (! $dueDate) {
            return 0;
        }

        return (int) Carbon::parse($dueDate)->diffInDays(now(), false);
    }

    public function calculateAgingStatus(?string $dueDate, float $remainingAmount): string
    {
        if ($remainingAmount <= 0) {
            return self::CURRENT;
        }

        if (! $dueDate) {
            return self::CURRENT;
        }

        $days = $this->calculateDaysOverdue($dueDate);

        if ($days === 0) {
            return self::DUE_TODAY;
        }

        if ($days < 0) {
            return self::CURRENT;
        }

        if ($days <= 7) {
            return self::OVERDUE_1_7;
        }

        if ($days <= 14) {
            return self::OVERDUE_8_14;
        }

        if ($days <= 30) {
            return self::OVERDUE_15_30;
        }

        return self::OVERDUE_30_PLUS;
    }

    public function calculateDaysOverdueScore(int $days): int
    {
        if ($days <= 0) {
            return 0;
        }

        if ($days <= 7) {
            return 10;
        }

        if ($days <= 14) {
            return 20;
        }

        if ($days <= 30) {
            return 30;
        }

        return 50;
    }

    public function calculateSeverity(float $outstanding, int $daysOverdue, int $criticalStocks, int $pendingIssues): int
    {
        $score = 0;

        if ($outstanding >= 1_000_000) {
            $score += 50;
        } elseif ($outstanding >= 500_000) {
            $score += 40;
        } elseif ($outstanding >= 100_000) {
            $score += 30;
        }

        $score += $this->calculateDaysOverdueScore($daysOverdue);
        $score += $criticalStocks * 10;
        $score += $pendingIssues * 5;

        return $score;
    }

    public function calculateCollectionRate(float $totalAmount, float $paidAmount): float
    {
        if ($totalAmount <= 0) {
            return 0;
        }

        return round(($paidAmount / $totalAmount) * 100, 1);
    }

    /**
     * Get aging summary across all outlets.
     * Returns counts and amounts per aging bucket.
     */
    public function getAgingSummary(): array
    {
        $rows = DB::table('settlements')
            ->where('period_type', 'weekly')
            ->selectRaw("
                outlet_id,
                SUM(amount_due) as total_amount_due,
                SUM(CASE WHEN status != 'paid' THEN (amount_due - paid_amount - adjustment_amount) ELSE 0 END) as total_remaining,
                MIN(CASE WHEN status != 'paid' THEN due_date END) as earliest_due_date
            ")
            ->groupBy('outlet_id')
            ->get();

        $buckets = [
            self::CURRENT => ['count' => 0, 'amount' => 0],
            self::DUE_TODAY => ['count' => 0, 'amount' => 0],
            self::OVERDUE_1_7 => ['count' => 0, 'amount' => 0],
            self::OVERDUE_8_14 => ['count' => 0, 'amount' => 0],
            self::OVERDUE_15_30 => ['count' => 0, 'amount' => 0],
            self::OVERDUE_30_PLUS => ['count' => 0, 'amount' => 0],
        ];

        foreach ($rows as $row) {
            $remaining = (float) $row->total_remaining;

            if ($remaining <= 0) {
                $buckets[self::CURRENT]['count']++;
                $buckets[self::CURRENT]['amount'] += 0; // no outstanding

                continue;
            }

            $dueDate = $row->earliest_due_date;
            $status = $this->calculateAgingStatus($dueDate, $remaining);

            $buckets[$status]['count']++;
            $buckets[$status]['amount'] += $remaining;
        }

        return $buckets;
    }

    /**
     * Get aging KPIs for the owner dashboard.
     */
    public function getDashboardAgingKpis(): array
    {
        $buckets = $this->getAgingSummary();

        $totalOutstanding = 0;
        $totalOverdue = 0;
        $totalPaid = 0;
        $totalAll = 0;

        foreach ($buckets as $status => $bucket) {
            $totalOutstanding += $bucket['amount'];
            if ($status !== self::CURRENT && $status !== self::DUE_TODAY) {
                $totalOverdue += $bucket['amount'];
            }
        }

        // Collection rate
        $totals = DB::table('settlements')
            ->where('period_type', 'weekly')
            ->selectRaw('
                SUM(amount_due) as total_sales,
                SUM(paid_amount) as total_paid
            ')
            ->first();

        $collectionRate = $this->calculateCollectionRate(
            (float) ($totals->total_sales ?? 0),
            (float) ($totals->total_paid ?? 0),
        );

        return [
            'current' => $buckets[self::CURRENT]['count'],
            'due_today' => $buckets[self::DUE_TODAY]['count'],
            'overdue_1_7' => $buckets[self::OVERDUE_1_7]['count'],
            'overdue_8_14' => $buckets[self::OVERDUE_8_14]['count'],
            'overdue_15_plus' => $buckets[self::OVERDUE_15_30]['count'] + $buckets[self::OVERDUE_30_PLUS]['count'],
            'total_outstanding' => $totalOutstanding,
            'total_overdue' => $totalOverdue,
            'collection_rate' => $collectionRate,
        ];
    }

    /**
     * Get aging status for a specific outlet.
     */
    public function getOutletAgingStatus(int $outletId): array
    {
        $row = DB::table('settlements')
            ->where('period_type', 'weekly')
            ->selectRaw("
                SUM(CASE WHEN status != 'paid' THEN (amount_due - paid_amount - adjustment_amount) ELSE 0 END) as total_remaining,
                MIN(CASE WHEN status != 'paid' THEN due_date END) as earliest_due_date
            ")
            ->where('outlet_id', $outletId)
            ->first();

        $remaining = (float) ($row->total_remaining ?? 0);
        $dueDate = $row->earliest_due_date;

        return [
            'remaining' => $remaining,
            'due_date' => $dueDate,
            'days_overdue' => $this->calculateDaysOverdue($dueDate),
            'aging_status' => $this->calculateAgingStatus($dueDate, $remaining),
        ];
    }
}
