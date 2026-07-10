<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\OutletVariantPrice;
use App\Models\PricingAuditLog;
use App\Models\ProductVariant;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PricingController extends Controller
{
    /**
     * Main pricing page — tab-aware dispatch.
     */
    public function index(Request $request, PricingService $pricingService): Response
    {
        $tab = $request->string('tab', 'pusat')->toString();

        return match ($tab) {
            'outlet' => $this->outletTab($request, $pricingService),
            'riwayat' => $this->riwayatTab($request),
            default => $this->pusatTab($request),
        };
    }

    /**
     * Tab Pusat — global pricing (center_price + selling_price).
     */
    private function pusatTab(Request $request): Response
    {
        $variants = ProductVariant::query()
            ->where('is_active', true)
            ->with('family:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (ProductVariant $v) => [
                'variant_id' => $v->id,
                'name' => $v->full_name,
                'family_name' => $v->family?->name,
                'flavor' => $v->flavor,
                'size' => $v->size,
                'center_price' => (float) $v->center_price,
                'selling_price' => (float) $v->selling_price,
                'margin' => (float) $v->selling_price - (float) $v->center_price,
                'outlet_override_count' => OutletVariantPrice::where('product_variant_id', $v->id)->count(),
            ]);

        // KPIs
        $totalVariants = $variants->count();
        $avgHpp = $variants->avg('center_price');
        $avgMargin = $variants->avg('margin');
        $negativeMarginCount = $variants->filter(fn ($v) => $v['margin'] < 0)->count();

        return Inertia::render('owner/pricing/index', [
            'tab' => 'pusat',
            'pusatVariants' => $variants,
            'pusatKpis' => [
                'total_variants' => (int) $totalVariants,
                'avg_hpp' => (float) $avgHpp,
                'avg_margin' => (float) $avgMargin,
                'negative_margin_count' => (int) $negativeMarginCount,
            ],
        ]);
    }

    /**
     * Tab Outlet — grid view or detail view.
     */
    private function outletTab(Request $request, PricingService $pricingService): Response
    {
        $outlets = Outlet::where('status', 'active')
            ->withCount(['variantPrices'])
            ->orderBy('name')
            ->get(['id', 'name']);

        $totalVariants = ProductVariant::where('is_active', true)->count();

        $data = [
            'tab' => 'outlet',
            'outlets' => $outlets->map(fn (Outlet $o) => [
                'id' => $o->id,
                'name' => $o->name,
                'override_count' => $o->variant_prices_count,
                'total_variants' => $totalVariants,
                'all_standard' => $o->variant_prices_count === 0,
            ]),
        ];

        // Detail view — selected outlet
        if ($request->filled('outlet_id')) {
            $outletId = $request->integer('outlet_id');
            $outlet = $outlets->firstWhere('id', $outletId);

            if ($outlet) {
                $data['selectedOutlet'] = $outlet->only(['id', 'name']);
                $data['outletPrices'] = $pricingService->getOutletPrices($outlet->id);
                $data['otherOutlets'] = $outlets
                    ->where('id', '!=', $outlet->id)
                    ->values()
                    ->map(fn ($o) => ['id' => $o->id, 'name' => $o->name]);
            }
        }

        return Inertia::render('owner/pricing/index', $data);
    }

    /**
     * Tab Riwayat — audit log.
     */
    private function riwayatTab(Request $request): Response
    {
        $query = PricingAuditLog::with(['outlet:id,name', 'changedBy:id,name'])
            ->orderByDesc('created_at');

        $actionFilter = $request->string('action', '')->toString();
        if ($actionFilter) {
            $query->where('action', $actionFilter);
        }

        $logs = $query->paginate(20)->withQueryString()->through(fn (PricingAuditLog $log) => [
            'id' => $log->id,
            'outlet' => $log->outlet_id === null ? 'Global' : ($log->outlet?->name ?? '-'),
            'product' => $log->productVariant?->full_name ?? '-',
            'old_price' => (float) $log->old_price,
            'new_price' => (float) $log->new_price,
            'action' => $log->action,
            'changed_by' => $log->changedBy?->name ?? '-',
            'created_at' => $log->created_at?->toISOString(),
        ]);

        return Inertia::render('owner/pricing/index', [
            'tab' => 'riwayat',
            'logs' => $logs,
            'actionFilter' => $actionFilter,
        ]);
    }

    /**
     * Redirect from old outlet show route.
     */
    /**
     * Compare prices across outlets (1-3).
     */
    public function compare(Request $request, PricingService $pricingService): JsonResponse
    {
        $outletIds = $request->input('outlet_ids', []);

        if (count($outletIds) < 2 || count($outletIds) > 3) {
            return response()->json(['data' => []], 422);
        }

        $data = collect($outletIds)->map(function ($outletId) use ($pricingService) {
            $outlet = Outlet::find($outletId);
            if (! $outlet) {
                return null;
            }

            return [
                'outlet_id' => $outlet->id,
                'outlet_name' => $outlet->name,
                'prices' => $pricingService->getOutletPrices($outlet->id),
            ];
        })->filter()->values();

        return response()->json(['data' => $data]);
    }

    public function show(Outlet $outlet): RedirectResponse
    {
        return redirect()->route('owner.pricing.index', ['tab' => 'outlet', 'outlet_id' => $outlet->id]);
    }

    /**
     * Update global price (center_price and/or selling_price on ProductVariant).
     */
    public function updateGlobal(Request $request, ProductVariant $variant, PricingService $pricingService): RedirectResponse
    {
        $validated = $request->validate([
            'center_price' => ['sometimes', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'numeric', 'min:0'],
        ]);

        $updates = [];
        $oldCenter = (float) $variant->center_price;
        $oldSelling = (float) $variant->selling_price;

        if (isset($validated['center_price'])) {
            $updates['center_price'] = (float) $validated['center_price'];
        }

        if (isset($validated['selling_price'])) {
            $newSelling = (float) $validated['selling_price'];
            if ($newSelling === 0) {
                return back()->withErrors(['selling_price' => 'Harga jual tidak boleh nol.']);
            }
            $updates['selling_price'] = $newSelling;
        }

        if (empty($updates)) {
            return back()->withErrors(['center_price' => 'Tidak ada perubahan.']);
        }

        $variant->update($updates);

        // Log audit for each changed field
        if (isset($updates['center_price'])) {
            $this->logAudit(null, $variant->id, $oldCenter, $updates['center_price'], 'master_update', $request->user()->id);
        }

        if (isset($updates['selling_price'])) {
            $this->logAudit(null, $variant->id, $oldSelling, $updates['selling_price'], 'master_update', $request->user()->id);
        }

        // Warning if outlet overrides would have negative margin
        $warning = null;
        if (isset($updates['center_price'])) {
            $impact = $pricingService->getCenterPriceImpact($variant->id, $updates['center_price']);
            if ($impact['negative_margin_outlets'] > 0) {
                $warning = "{$impact['negative_margin_outlets']} outlet akan memiliki margin negatif setelah perubahan ini.";
            }
        }

        $response = back()->with('success', 'Harga berhasil diperbarui.');
        if ($warning) {
            $response->with('warning', $warning);
        }

        return $response;
    }

    /**
     * Update outlet-specific price.
     */
    public function updateOutlet(Request $request, Outlet $outlet, ProductVariant $variant, PricingService $pricingService): RedirectResponse
    {
        $validated = $request->validate([
            'selling_price' => ['required', 'numeric', 'min:0'],
        ]);

        $newPrice = (float) $validated['selling_price'];

        if ($newPrice === 0) {
            return back()->withErrors(['selling_price' => 'Harga jual tidak boleh nol.']);
        }

        $pricingService->updatePrice($outlet->id, $variant->id, $newPrice, $request->user());

        $response = back()->with('success', 'Harga berhasil diperbarui.');

        if ($newPrice < (float) $variant->center_price) {
            $response->with('warning', 'Harga jual lebih rendah dari harga pusat. Margin akan negatif.');
        }

        return $response;
    }

    /**
     * Reset outlet price to global (delete override).
     */
    public function resetOutlet(Request $request, Outlet $outlet, ProductVariant $variant, PricingService $pricingService): RedirectResponse
    {
        $pricingService->resetToGlobal($outlet->id, $variant->id, $request->user());

        return back()->with('success', 'Harga berhasil direset ke harga pusat.');
    }

    /**
     * Get impact preview for a center price change.
     */
    public function getImpact(ProductVariant $variant, PricingService $pricingService): JsonResponse
    {
        $newCenterPrice = (float) request('center_price', $variant->center_price);
        $impact = $pricingService->getCenterPriceImpact($variant->id, $newCenterPrice);

        return response()->json($impact);
    }

    /**
     * Bulk adjust all prices for an outlet.
     */
    public function bulkUpdate(Request $request, Outlet $outlet, PricingService $pricingService): RedirectResponse
    {
        $validated = $request->validate([
            'adjustment' => ['required', 'numeric'],
        ]);

        $count = $pricingService->bulkAdjust($outlet->id, (float) $validated['adjustment'], $request->user());

        return back()->with('success', "{$count} harga berhasil diperbarui.");
    }

    /**
     * Copy prices from one outlet to another.
     */
    public function copy(Request $request, Outlet $targetOutlet, PricingService $pricingService): RedirectResponse
    {
        $validated = $request->validate([
            'source_outlet_id' => ['required', 'exists:outlets,id'],
        ]);

        $count = $pricingService->copyPrices((int) $validated['source_outlet_id'], $targetOutlet->id, $request->user());

        return back()->with('success', "{$count} harga berhasil disalin.");
    }

    /**
     * Log a pricing audit entry.
     */
    private function logAudit(?int $outletId, int $variantId, ?float $oldPrice, float $newPrice, string $action, int $userId): void
    {
        try {
            PricingAuditLog::create([
                'outlet_id' => $outletId,
                'product_variant_id' => $variantId,
                'old_price' => $oldPrice,
                'new_price' => $newPrice,
                'action' => $action,
                'changed_by' => $userId,
            ]);
        } catch (\Exception $e) {
            logger()->warning('Pricing audit log failed', [
                'outlet_id' => $outletId,
                'variant_id' => $variantId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
