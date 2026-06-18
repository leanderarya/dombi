<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ProductFamily;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductFamilyController extends Controller
{
    public function index(): Response
    {
        $families = ProductFamily::query()
            ->withCount('variants')
            ->with(['variants' => fn ($q) => $q->withCount('orderItems')])
            ->orderBy('name')
            ->get();

        return Inertia::render('owner/product-families/index', [
            'families' => $families,
        ]);
    }

    public function show(ProductFamily $family): Response
    {
        $family->load(['variants' => fn ($q) => $q->withCount('orderItems')->orderBy('name')]);

        return Inertia::render('owner/product-families/show', [
            'family' => $family,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        ProductFamily::create($validated);

        return redirect()->route('owner.product-families.index')->with('success', 'Product family created.');
    }

    public function update(Request $request, ProductFamily $family): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ]);

        $family->update($validated);

        return redirect()->back()->with('success', 'Product family updated.');
    }

    public function destroy(ProductFamily $family): RedirectResponse
    {
        $family->delete();

        return redirect()->route('owner.product-families.index')
            ->with('success', 'Product family berhasil dihapus.');
    }
}
