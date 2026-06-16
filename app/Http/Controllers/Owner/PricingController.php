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
    public function index(): Response
    {
        $outlets = Outlet::where('status', 'active')
            ->withCount(['variantPrices'])
            ->orderBy('name')
            ->get(['id', 'name']);

        $totalVariants = ProductVariant::where('is_active', true)->count();
        $totalOutlets = $outlets->count();
        $totalOverrides = OutletVariantPrice::count();

        // Calculate lowest margin across all outlet-variant combinations
        $lowestMargin = OutletVariantPrice::query()
            ->join('product_variants', 'outlet_variant_prices.product_variant_id', '=', 'product_variants.id')
            ->selectRaw('MIN(outlet_variant_prices.selling_price - product_variants.center_price) as min_margin')
            ->value('min_margin');

        // If no overrides, calculate from global prices
        if ($lowestMargin === null) {
            $lowestMargin = ProductVariant::where('is_active', true)
                ->selectRaw('MIN(selling_price - center_price) as min_margin')
                ->value('min_margin');
        }

        return Inertia::render('owner/pricing/index', [
            'outlets' => $outlets,
            'kpis' => [
                'total_variants' => $totalVariants,
                'total_outlets' => $totalOutlets,
                'total_overrides' => (int) $totalOverrides,
                'lowest_margin' => (float) ($lowestMargin ?? 0),
            ],
        ]);
    }

    public function show(Outlet $outlet, PricingService $pricingService): Response
    {
        $prices = $pricingService->getOutletPrices($outlet->id);

        $outlets = Outlet::where('status', 'active')
            ->where('id', '!=', $outlet->id)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('owner/pricing/outlet', [
            'outlet' => $outlet->only(['id', 'name']),
            'prices' => $prices,
            'otherOutlets' => $outlets,
        ]);
    }

    public function update(Request $request, Outlet $outlet, ProductVariant $variant, PricingService $pricingService): RedirectResponse
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

    public function bulkUpdate(Request $request, Outlet $outlet, PricingService $pricingService): RedirectResponse
    {
        $validated = $request->validate([
            'adjustment' => ['required', 'numeric'],
        ]);

        $count = $pricingService->bulkAdjust($outlet->id, (float) $validated['adjustment'], $request->user());

        return back()->with('success', "{$count} harga berhasil diperbarui.");
    }

    public function copy(Request $request, Outlet $targetOutlet, PricingService $pricingService): RedirectResponse
    {
        $validated = $request->validate([
            'source_outlet_id' => ['required', 'exists:outlets,id'],
        ]);

        $count = $pricingService->copyPrices((int) $validated['source_outlet_id'], $targetOutlet->id, $request->user());

        return back()->with('success', "{$count} harga berhasil disalin.");
    }

    public function master(): Response
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
            ]);

        return Inertia::render('owner/pricing/master', [
            'variants' => $variants,
        ]);
    }

    public function getImpact(ProductVariant $variant, PricingService $pricingService): JsonResponse
    {
        $newCenterPrice = (float) request('center_price', $variant->center_price);
        $impact = $pricingService->getCenterPriceImpact($variant->id, $newCenterPrice);

        return response()->json($impact);
    }

    public function updateCenterPrice(Request $request, ProductVariant $variant, PricingService $pricingService): RedirectResponse
    {
        $validated = $request->validate([
            'center_price' => ['required', 'numeric', 'min:0'],
        ]);

        $oldCenter = (float) $variant->center_price;
        $newCenter = (float) $validated['center_price'];

        $variant->update([
            'center_price' => $newCenter,
        ]);

        try {
            PricingAuditLog::create([
                'outlet_id' => null,
                'product_variant_id' => $variant->id,
                'old_price' => $oldCenter,
                'new_price' => $newCenter,
                'action' => 'master_update',
                'changed_by' => $request->user()?->id,
            ]);
        } catch (\Exception $e) {
            logger()->warning('Pricing audit log failed', [
                'variant_id' => $variant->id,
                'error' => $e->getMessage(),
            ]);
        }

        return back()->with('success', 'Harga pusat berhasil diperbarui.');
    }

    public function history(): Response
    {
        $logs = PricingAuditLog::query()
            ->with(['outlet:id,name', 'productVariant:id,name,product_family_id', 'productVariant.family:id,name', 'changedBy:id,name'])
            ->latest()
            ->paginate(50)
            ->through(fn (PricingAuditLog $log) => [
                'id' => $log->id,
                'outlet' => $log->outlet_id === null ? 'Global' : ($log->outlet?->name ?? '-'),
                'product' => $log->productVariant?->full_name ?? '-',
                'old_price' => (float) $log->old_price,
                'new_price' => (float) $log->new_price,
                'action' => $log->action,
                'changed_by' => $log->changedBy?->name ?? '-',
                'created_at' => $log->created_at?->toISOString(),
            ]);

        return Inertia::render('owner/pricing/history', [
            'logs' => $logs,
        ]);
    }
}
