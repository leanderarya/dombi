<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ExchangeRequest;
use App\Models\ProductVariant;
use App\Models\RestockRequest;
use App\Models\ReturnRequest;
use App\Models\SettlementPayment;
use App\Services\SettlementReconciliationService;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(SettlementReconciliationService $reconciliationService): Response
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
}
