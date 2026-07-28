<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\ProductCategory;
use App\Http\Requests\Owner\StoreProductCategoryRequest;
use App\Http\Requests\Owner\UpdateProductCategoryRequest;
use App\Services\ProductImageService;
use Illuminate\Http\RedirectResponse;
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

        return Inertia::render('owner/product-categories/index', ['categories' => $cats]);
    }

    public function show(ProductCategory $category): Response
    {
        $category->load(['products' => fn ($q) => $q->withCount('orderItems')->orderBy('name')]);

        return Inertia::render('owner/product-categories/show', ['category' => $category]);
    }

    public function store(StoreProductCategoryRequest $req, ProductImageService $img): RedirectResponse
    {
        $data = $req->validated();

        if ($req->hasFile('image')) {
            $data['image'] = $img->store($req->file('image'));
        }

        ProductCategory::create($data);

        return redirect()->route('owner.product-categories.index')->with('success', 'Kategori berhasil dibuat.');
    }

    public function update(UpdateProductCategoryRequest $req, ProductCategory $category, ProductImageService $img): RedirectResponse
    {
        $data = $req->validated();

        if ($req->hasFile('image')) {
            $data['image'] = $img->store($req->file('image'), $category->image);
        }

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
}
