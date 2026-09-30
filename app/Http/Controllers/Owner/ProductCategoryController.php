<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreProductCategoryRequest;
use App\Http\Requests\Owner\UpdateProductCategoryRequest;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ProductCategoryController extends Controller
{
    public function index(): Response
    {
        $cats = ProductCategory::withCount('products')
            ->with(['products' => fn ($q) => $q->withCount('orderItems')])
            ->orderBy('name')
            ->get();

        // A trashed category is unreachable from every other page, so the index is
        // the only door back to it. Nothing blocks the restore: destroy() refuses a
        // category that still has a live product, and product_categories has no
        // UNIQUE index — the name is only held by the store/update rules, which
        // count trashed rows, so no live category could have taken it meanwhile.
        $trashed = ProductCategory::onlyTrashed()
            ->withCount(['products' => fn ($q) => $q->withTrashed()])
            ->orderBy('name')
            ->get();

        return Inertia::render('owner/product-categories/index', [
            'categories' => $cats,
            'trashedCategories' => $trashed,
        ]);
    }

    public function show(ProductCategory $category): Response
    {
        $category->load([
            'products' => fn ($q) => $q->with('flavorGroup')->withCount('orderItems')->orderBy('name'),
            'flavorGroups',
        ]);

        // The dialogs offer a destructive button per policy, so both policies have
        // to travel with the page. Without them the UI drew every button enabled
        // and let the server refuse after the fact; the category's two rules also
        // differ (soft delete also refuses active products), so one boolean cannot
        // stand in for both.
        //
        // trashedProducts is a separate list rather than rows merged into the
        // main one: the page groups by flavor group and counts "varian" per
        // group, and letting deleted rows back into that math would misreport a
        // live catalogue.
        $trashedProducts = $category->products()
            ->onlyTrashed()
            ->with('flavorGroup')
            ->orderBy('name')
            ->get();

        return Inertia::render('owner/product-categories/show', [
            'category' => $category,
            'canDelete' => Gate::allows('delete', $category),
            'canForceDelete' => Gate::allows('forceDelete', $category),
            'deletableProductIds' => $category->products
                ->filter(fn (Product $product) => Gate::allows('delete', $product))
                ->pluck('id')
                ->values(),
            'trashedProducts' => $trashedProducts,
        ]);
    }

    public function store(StoreProductCategoryRequest $req): RedirectResponse
    {
        $data = $req->validated();
        ProductCategory::create($data);

        return redirect()->route('owner.product-categories.index')->with('success', 'Kategori berhasil dibuat.');
    }

    public function update(UpdateProductCategoryRequest $req, ProductCategory $category): RedirectResponse
    {
        $data = $req->validated();
        $category->update($data);

        return back()->with('success', 'Kategori berhasil diperbarui.');
    }

    public function destroy(ProductCategory $category): RedirectResponse
    {
        if ($category->products()->exists()) {
            return back()->with('error', 'Kategori masih memiliki produk');
        }

        $category->delete();

        return redirect()->route('owner.product-categories.index')->with('success', 'Kategori berhasil dihapus.');
    }

    /**
     * Remove a category for good, including one that was already soft deleted.
     */
    public function forceDestroy(ProductCategory $category): RedirectResponse
    {
        if (Gate::denies('forceDelete', $category)) {
            return back()->with('error', 'Kategori masih memiliki produk, jadi belum bisa dihapus permanen. Hapus atau pindahkan produknya dulu.');
        }

        $category->forceDelete();

        return redirect()->route('owner.product-categories.index')->with('success', 'Kategori berhasil dihapus permanen.');
    }

    /**
     * Undo a soft delete, including one made before this action existed.
     *
     * The category's own products that were trashed while it was down stay
     * trashed; they keep their sku slots and come back one by one from the
     * category page, where a collision can be reported per row.
     */
    public function restore(ProductCategory $category): RedirectResponse
    {
        $category->restore();

        return redirect()->route('owner.product-categories.show', $category)->with('success', 'Kategori berhasil dikembalikan.');
    }
}
