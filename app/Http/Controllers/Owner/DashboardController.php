<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRequest;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
use App\Models\ReturnRequest;
use App\Models\SettlementPayment;
use App\Services\SettlementAgingService;
use App\Services\SettlementReconciliationService;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(SettlementReconciliationService $reconciliationService, SettlementAgingService $agingService): Response
    {
        $collection = $reconciliationService->getCollectionCenter();

        $pendingRestocks = (int) RestockRequest::query()
            ->where('status', 'requested')
            ->count();
        $pendingReturns = (int) ReturnRequest::query()
            ->where('status', ReturnRequest::STATUS_SUBMITTED)
            ->count();
        $pendingExchanges = (int) ExchangeRequest::query()
            ->where('status', ExchangeRequest::STATUS_SUBMITTED)
            ->count();
        $pendingSettlementVerifications = (int) SettlementPayment::query()
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->count();

        $criticalCenterStock = $this->criticalCenterStock();
        $outletAttention = $this->outletAttention($collection['priority_list'], $agingService);
        $agingKpis = $agingService->getDashboardAgingKpis();

        return Inertia::render('owner/dashboard', [
            'hero' => [
                'outstandingAmount' => (float) ($collection['hero']['total_outstanding'] ?? 0),
                'subtitle' => 'Kewajiban outlet yang belum diselesaikan.',
                'ctaLabel' => 'Lihat Penagihan',
                'ctaHref' => '/owner/finance',
            ],
            'kpis' => [
                'outstandingAmount' => (float) ($collection['hero']['total_outstanding'] ?? 0),
                'approvalsNeeded' => $pendingRestocks + $pendingReturns + $pendingExchanges,
                'outletsNeedingAttention' => count($outletAttention),
                'criticalCenterSkus' => $criticalCenterStock->count(),
            ],
            'agingKpis' => $agingKpis,
            'actionRequired' => [
                'restocks' => $pendingRestocks,
                'returns' => $pendingReturns,
                'exchanges' => $pendingExchanges,
                'pendingSettlementVerifications' => $pendingSettlementVerifications,
            ],
            'outletAttention' => $outletAttention,
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
            ->filter(fn (array $item) => $item['centerStock'] <= $item['threshold'])
            ->sortByDesc('shortage')
            ->values();
    }

    /**
     * @param  array<int, array<string, mixed>>  $priorityList
     * @return array<int, array{
     *     outlet: array{id:int,name:string},
     *     outstandingAmount: float,
     *     pendingRestocks: int,
     *     pendingReturns: int,
     *     pendingExchanges: int,
     *     pendingIssues: int,
     *     criticalStocks: int,
     *     daysOverdue: int,
     *     severityScore: int,
     *     detailHref: string
     * }>
     */
    private function outletAttention(array $priorityList, SettlementAgingService $agingService): array
    {
        $restockCounts = RestockRequest::query()
            ->selectRaw('outlet_id, COUNT(*) as aggregate')
            ->where('status', 'requested')
            ->groupBy('outlet_id')
            ->pluck('aggregate', 'outlet_id');

        $returnCounts = ReturnRequest::query()
            ->selectRaw('outlet_id, COUNT(*) as aggregate')
            ->where('status', ReturnRequest::STATUS_SUBMITTED)
            ->groupBy('outlet_id')
            ->pluck('aggregate', 'outlet_id');

        $exchangeCounts = ExchangeRequest::query()
            ->selectRaw('outlet_id, COUNT(*) as aggregate')
            ->where('status', ExchangeRequest::STATUS_SUBMITTED)
            ->groupBy('outlet_id')
            ->pluck('aggregate', 'outlet_id');

        $criticalStockCounts = OutletInventory::query()
            ->selectRaw('outlet_id, COUNT(*) as aggregate')
            ->whereRaw('(current_stock - reserved_stock) <= 0')
            ->groupBy('outlet_id')
            ->pluck('aggregate', 'outlet_id');

        $priorityByOutlet = collect($priorityList)
            ->mapWithKeys(fn (array $item) => [
                (int) $item['outlet']['id'] => [
                    'outstanding' => (float) $item['outstanding'],
                    'days_overdue' => (int) ($item['days_overdue'] ?? 0),
                ],
            ]);

        $items = Outlet::query()
            ->where('status', 'active')
            ->get(['id', 'name'])
            ->map(function (Outlet $outlet) use ($restockCounts, $returnCounts, $exchangeCounts, $criticalStockCounts, $priorityByOutlet, $agingService): ?array {
                $pendingRestocks = (int) ($restockCounts[$outlet->id] ?? 0);
                $pendingReturns = (int) ($returnCounts[$outlet->id] ?? 0);
                $pendingExchanges = (int) ($exchangeCounts[$outlet->id] ?? 0);
                $criticalStocks = (int) ($criticalStockCounts[$outlet->id] ?? 0);
                $outstandingAmount = (float) ($priorityByOutlet[$outlet->id]['outstanding'] ?? 0);
                $daysOverdue = (int) ($priorityByOutlet[$outlet->id]['days_overdue'] ?? 0);
                $pendingIssues = $pendingRestocks + $pendingReturns + $pendingExchanges;

                $outstandingThreshold = 100_000;
                $criticalSkuThreshold = 1;
                $overdueThreshold = 7;

                $meetsOutstanding = $outstandingAmount >= $outstandingThreshold;
                $meetsCritical = $criticalStocks >= $criticalSkuThreshold;
                $meetsPending = $pendingIssues > 0;
                $meetsOverdue = $daysOverdue > $overdueThreshold;

                if (! $meetsOutstanding && ! $meetsCritical && ! $meetsPending && ! $meetsOverdue) {
                    return null;
                }

                $score = $agingService->calculateSeverity($outstandingAmount, $daysOverdue, $criticalStocks, $pendingIssues);

                return [
                    'outlet' => [
                        'id' => $outlet->id,
                        'name' => $outlet->name,
                    ],
                    'outstandingAmount' => $outstandingAmount,
                    'pendingRestocks' => $pendingRestocks,
                    'pendingReturns' => $pendingReturns,
                    'pendingExchanges' => $pendingExchanges,
                    'pendingIssues' => $pendingIssues,
                    'criticalStocks' => $criticalStocks,
                    'daysOverdue' => $daysOverdue,
                    'severityScore' => $score,
                    'detailHref' => '/owner/outlets/'.$outlet->id,
                ];
            })
            ->filter()
            ->values()
            ->all();

        usort($items, function (array $left, array $right): int {
            return [$right['severityScore'], $right['outstandingAmount'], $left['outlet']['name']]
                <=> [$left['severityScore'], $left['outstandingAmount'], $right['outlet']['name']];
        });

        return array_slice($items, 0, 5);
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
}
