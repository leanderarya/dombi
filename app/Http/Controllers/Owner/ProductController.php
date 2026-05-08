<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreProductRequest;
use App\Http\Requests\Owner\UpdateProductRequest;
use App\Models\Product;
use App\Models\ProductCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('owner/products/index', [
            'products' => Product::with('category')->latest()->paginate(15),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('owner/products/create', [
            'categories' => ProductCategory::where('is_active', true)->get(['id', 'name']),
        ]);
    }

    public function store(StoreProductRequest $request): RedirectResponse
    {
        Product::create([...$request->validated(), 'slug' => $this->uniqueSlug($request->string('name')->toString())]);

        return redirect()->route('owner.products.index')->with('success', 'Produk berhasil dibuat.');
    }

    public function edit(Product $product): Response
    {
        return Inertia::render('owner/products/edit', [
            'product' => $product,
            'categories' => ProductCategory::where('is_active', true)->get(['id', 'name']),
        ]);
    }

    public function update(UpdateProductRequest $request, Product $product): RedirectResponse
    {
        $product->update([...$request->validated(), 'slug' => $this->uniqueSlug($request->string('name')->toString(), $product->id)]);

        return redirect()->route('owner.products.index')->with('success', 'Produk berhasil diperbarui.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();

        return redirect()->route('owner.products.index')->with('success', 'Produk berhasil dihapus.');
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $counter = 2;

        while (Product::where('slug', $slug)->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base.'-'.$counter++;
        }

        return $slug;
    }
}
