<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRequest;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
use App\Models\ReturnRequest;
use App\Models\SettlementPayment;
use App\Services\SettlementReconciliationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, SettlementReconciliationService $reconciliationService): Response
    {
        $collection = $reconciliationService->getCollectionCenter();

        // Cache pending counts for 10 seconds
        $pendingCounts = Cache::remember('owner:pending_counts', 10, function () {
            return [
                'restocks' => (int) RestockRequest::query()->where('status', 'requested')->count(),
                'returns' => (int) ReturnRequest::query()->where('status', ReturnRequest::STATUS_SUBMITTED)->count(),
                'exchanges' => (int) ExchangeRequest::query()->where('status', ExchangeRequest::STATUS_SUBMITTED)->count(),
                'settlements' => (int) SettlementPayment::query()->where('status', SettlementPayment::STATUS_PENDING)->count(),
            ];
        });

        $pendingRestocks = $pendingCounts['restocks'];
        $pendingReturns = $pendingCounts['returns'];
        $pendingExchanges = $pendingCounts['exchanges'];
        $pendingSettlementVerifications = $pendingCounts['settlements'];

        // Don't cache Eloquent collections — serialization issues
        $criticalCenterStock = $this->criticalCenterStock();

        return Inertia::render('owner/dashboard', [
            'hero' => [
                'outstandingAmount' => (float) ($collection['hero']['total_outstanding'] ?? 0),
                'subtitle' => 'Kewajiban outlet yang belum diselesaikan.',
                'ctaLabel' => 'Lihat Penagihan',
                'ctaHref' => '/owner/finance',
            ],
            'kpis' => [
                'outstandingAmount' => (float) ($collection['hero']['total_outstanding'] ?? 0),
                'pendingActions' => $pendingRestocks + $pendingReturns + $pendingExchanges + $pendingSettlementVerifications,
                'criticalStock' => $criticalCenterStock->count(),
            ],
            'actionRequired' => [
                'restocks' => $pendingRestocks,
                'returns' => $pendingReturns,
                'exchanges' => $pendingExchanges,
                'pendingSettlementVerifications' => $pendingSettlementVerifications,
            ],
            'settlementAlerts' => collect($collection['priority_list'] ?? [])
                ->take(5)
                ->map(fn (array $item) => [
                    'outlet' => $item['outlet'],
                    'outstandingAmount' => (float) $item['outstanding'],
                    'daysOverdue' => (int) ($item['days_overdue'] ?? 0),
                    'detailHref' => '/owner/finance/settlements/'.$item['outlet']['id'],
                ])
                ->values()
                ->all(),
            'inventoryRisks' => $criticalCenterStock
                ->take(5)
                ->values()
                ->all(),
            'revenueTrend' => $this->revenueTrend((int) $request->input('days', 7)),
        ]);
    }

    /**
     * @return Collection<int, array{
     *     variant: array{id:int,name:string,full_name:string,family_name:?string},
     *     centerStock:int,
     *     threshold:int,
     *     shortage:int,
     *     detailHref:string
     * }>
     */
    private function criticalCenterStock(): Collection
    {
        return ProductVariant::query()
            ->with('family:id,name')
            ->where('is_active', true)
            ->get()
            ->map(function (ProductVariant $variant): array {
                $threshold = $this->centerStockThreshold($variant);

                return [
                    'variant' => [
                        'id' => $variant->id,
                        'name' => $variant->name,
                        'full_name' => $variant->full_name,
                        'family_name' => $variant->family?->name,
                    ],
                    'centerStock' => (int) $variant->center_stock,
                    'threshold' => $threshold,
                    'shortage' => max(0, $threshold - (int) $variant->center_stock),
                    'detailHref' => '/owner/product-families/'.$variant->product_family_id,
                ];
            })
            ->filter(fn (array $item) => $item['centerStock'] < $item['threshold'])
            ->sortByDesc('shortage')
            ->values();
    }

    private function centerStockThreshold(ProductVariant $variant): int
    {
        $size = strtolower((string) $variant->size);

        if (str_contains($size, '1l')) {
            return 20;
        }

        if (str_contains($size, '500')) {
            return 15;
        }

        if (str_contains($size, '250')) {
            return 10;
        }

        return 15;
    }

    /**
     * Get daily revenue for the last 7 days from completed orders.
     *
     * @return array{labels: string[], values: int[], total: int}
     */
    private function revenueTrend(int $days = 7): array
    {
        $days = max(7, min(30, $days));
        $today = Carbon::today();
        $startDate = $today->copy()->subDays($days - 1);

        $rows = Order::query()
            ->where('status', Order::STATUS_COMPLETED)
            ->whereBetween('completed_at', [$startDate->startOfDay(), $today->endOfDay()])
            ->select(
                DB::raw('DATE(completed_at) as date'),
                DB::raw('SUM(total) as revenue'),
            )
            ->groupBy('date')
            ->pluck('revenue', 'date')
            ->map(fn ($val) => (int) $val);

        $dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        $labels = [];
        $values = [];
        $total = 0;

        for ($date = $startDate->copy(); $date->lte($today); $date->addDay()) {
            $key = $date->format('Y-m-d');
            // For 30 days: show date number. For 7 days: show day name
            $labels[] = $days <= 7
                ? $dayNames[(int) $date->format('w')]
                : $date->format('j');
            $amount = (int) ($rows[$key] ?? 0);
            $values[] = $amount;
            $total += $amount;
        }

        return [
            'labels' => $labels,
            'values' => $values,
            'total' => $total,
        ];
    }
}
