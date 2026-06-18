<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductVariantController extends Controller
{
    public function create(ProductFamily $family): Response
    {
        return Inertia::render('owner/product-families/variant-create', [
            'family' => $family,
        ]);
    }

    public function store(Request $request, ProductFamily $family): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'flavor' => ['nullable', 'string', 'max:100'],
            'size' => ['nullable', 'string', 'max:50'],
            'sku' => ['nullable', 'string', 'max:50', 'unique:product_variants,sku'],
            'center_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0', 'gte:center_price'],
            'center_stock' => ['required', 'integer', 'min:0'],
        ]);

        $family->variants()->create($validated);

        return redirect()->route('owner.product-families.show', $family)
            ->with('success', 'Variant created.');
    }

    public function update(Request $request, ProductVariant $variant): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'flavor' => ['nullable', 'string', 'max:100'],
            'size' => ['nullable', 'string', 'max:50'],
            'sku' => ['nullable', 'string', 'max:50', 'unique:product_variants,sku,'.$variant->id],
            'center_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0', 'gte:center_price'],
            'center_stock' => ['required', 'integer', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        $variant->update($validated);

        return redirect()->back()->with('success', 'Variant updated.');
    }

    public function destroy(ProductVariant $variant): RedirectResponse
    {
        $familyId = $variant->product_family_id;
        $variant->delete();

        return redirect()->route('owner.product-families.show', $familyId)
            ->with('success', 'Variant berhasil dihapus.');
    }

    public function toggle(ProductVariant $variant): RedirectResponse
    {
        $variant->update(['is_active' => ! $variant->is_active]);
        $status = $variant->is_active ? 'diaktifkan' : 'dinonaktifkan';

        return redirect()->back()
            ->with('success', "Variant berhasil {$status}.");
    }
}
