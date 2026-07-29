<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\BulkStoreProductsRequest;
use App\Http\Requests\Owner\BulkStoreSizeProductsRequest;
use App\Http\Requests\Owner\StoreProductRequest;
use App\Http\Requests\Owner\UpdateProductRequest;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductFlavorGroup;
use App\Services\ProductImageService;
use App\Services\ProductSkuGenerator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(): RedirectResponse
    {
        return redirect()->route('owner.product-categories.index');
    }

    public function create(): RedirectResponse
    {
        return redirect()->route('owner.product-categories.index');
    }

    public function edit(): RedirectResponse
    {
        return redirect()->route('owner.product-categories.index');
    }

    public function show(Product $product): RedirectResponse
    {
        return redirect()->route('owner.product-categories.show', $product->product_category_id);
    }

    public function store(
        StoreProductRequest $req,
        ProductCategory $category,
        ProductImageService $img,
        ProductSkuGenerator $skuGen
    ): RedirectResponse {
        $data = $req->validated();

        $data['product_category_id'] = $category->id;
        $data['center_stock'] = 0;

        if (! empty($data['flavor'])) {
            $normFlavor = mb_strtolower(trim(preg_replace('/\s+/', ' ', $data['flavor'])), 'UTF-8');
            $group = ProductFlavorGroup::firstOrCreate(
                ['product_category_id' => $category->id, 'normalized_flavor' => $normFlavor],
                ['flavor' => $data['flavor']],
            );
            $data['product_flavor_group_id'] = $group->id;

            if ($req->hasFile('image')) {
                $newImage = $img->storeForFlavorGroup($req->file('image'), $group->image, $group->id);
                $group->update(['image' => $newImage]);
            }
            unset($data['image']);
        } else {
            if ($req->hasFile('image')) {
                $data['image'] = $img->store($req->file('image'));
            } else {
                unset($data['image']);
            }
        }

        $data['sku'] = $data['sku'] ?? $skuGen->uniqueForCategory(
            $category->id,
            $data['name'],
            $data['flavor'] ?? null,
            $data['size'] ?? null
        );

        $product = $category->products()->create($data);

        return redirect()
            ->route('owner.product-categories.show', $category)
            ->with('new_product_id', $product->id)
            ->with('success', 'Produk berhasil dibuat.');
    }

    public function bulkStore(
        BulkStoreProductsRequest $req,
        ProductCategory $category,
        ProductSkuGenerator $skuGen
    ): RedirectResponse {
        $data = $req->validated();
        $newIds = [];

        foreach ($data['flavors'] as $flavor) {
            $name = trim($flavor.' '.($data['size'] ?? ''));
            $sku = $skuGen->uniqueForCategory($category->id, $name, $flavor, $data['size'] ?? null);

            $prod = $category->products()->create([
                'name' => $name,
                'description' => $data['description'] ?? null,
                'flavor' => $flavor,
                'size' => $data['size'] ?? null,
                'center_price' => $data['center_price'],
                'selling_price' => $data['selling_price'],
                'center_stock' => 0,
                'sku' => $sku,
                'is_active' => true,
            ]);

            $newIds[] = $prod->id;
        }

        return redirect()
            ->route('owner.product-categories.show', $category)
            ->with('new_product_ids', $newIds)
            ->with('success', count($newIds).' produk berhasil dibuat.');
    }

    public function update(
        UpdateProductRequest $req,
        Product $product,
        ProductImageService $img
    ): RedirectResponse {
        $data = $req->validated();

        if ($req->hasFile('image')) {
            $data['image'] = $img->store($req->file('image'), $product->image);
        } else {
            if (array_key_exists('image', $data) && $data['image'] === null) {
                unset($data['image']);
            }
        }

        $product->update($data);

        return back()->with('success', 'Produk berhasil diperbarui.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        if (Gate::denies('delete', $product)) {
            throw ValidationException::withMessages([
                'business_history' => 'Produk tidak dapat dihapus karena memiliki riwayat transaksi atau stok.',
            ]);
        }

        $product->delete();

        if ($product->product_category_id) {
            return redirect()
                ->route('owner.product-categories.show', $product->product_category_id)
                ->with('success', 'Produk berhasil dihapus.');
        }

        return redirect()
            ->route('owner.product-categories.index')
            ->with('success', 'Produk berhasil dihapus.');
    }

    public function toggle(Product $product): RedirectResponse
    {
        $product->update(['is_active' => ! $product->is_active]);
        $status = $product->is_active ? 'diaktifkan' : 'dinonaktifkan';

        return back()->with('success', "Produk berhasil {$status}.");
    }

    public function duplicate(Product $product, ProductSkuGenerator $skuGen): RedirectResponse
    {
        $newSku = $skuGen->uniqueForCategory(
            $product->product_category_id,
            $product->name.' Copy',
            $product->flavor,
            $product->size
        );

        $copy = $product->replicate();
        $copy->sku = $newSku;
        $copy->center_stock = 0;
        $copy->name = $product->name.' Copy';
        $copy->save();

        return redirect()->back()->with('new_product_id', $copy->id)
            ->with('success', 'Produk berhasil diduplikasi.');
    }

    public function bulkSize(
        BulkStoreSizeProductsRequest $req,
        ProductCategory $category,
        ProductImageService $imgService,
        ProductSkuGenerator $skuGen
    ): RedirectResponse {
        $data = $req->validated();
        $newIds = [];
        $newImagePath = null;
        $oldGroupImage = null;
        $isNewGroup = false;

        DB::beginTransaction();
        try {
            $normFlavor = mb_strtolower(trim(preg_replace('/\s+/', ' ', $data['flavor'])), 'UTF-8');
            $group = ProductFlavorGroup::where('product_category_id', $category->id)
                ->where('normalized_flavor', $normFlavor)
                ->first();

            if (! $group) {
                $group = ProductFlavorGroup::create([
                    'product_category_id' => $category->id,
                    'flavor' => $data['flavor'],
                    'normalized_flavor' => $normFlavor,
                    'description' => $data['description'] ?? null,
                ]);
                $isNewGroup = true;
            }
            $oldGroupImage = $group->image;

            if ($req->hasFile('image')) {
                $newImagePath = $imgService->storeForFlavorGroup($req->file('image'), $oldGroupImage, $group->id);
                $group->update(['image' => $newImagePath]);
            }

            foreach ($data['sizes'] as $row) {
                $sizeNorm = strtolower(str_replace(' ', '', trim($row['size'])));
                if (Product::where('product_flavor_group_id', $group->id)
                    ->where('normalized_size', $sizeNorm)
                    ->exists()
                ) {
                    throw ValidationException::withMessages([
                        'sizes' => "Ukuran {$row['size']} sudah ada di rasa {$data['flavor']}",
                    ]);
                }

                $name = trim($data['flavor'].' '.$row['size']);
                $sku = $row['sku'] ?? $skuGen->uniqueForGroup($group->id, $name, $data['flavor'], $row['size']);

                $prod = Product::create([
                    'product_category_id' => $category->id,
                    'product_flavor_group_id' => $group->id,
                    'name' => $name,
                    'description' => $data['description'] ?? null,
                    'flavor' => $data['flavor'],
                    'size' => $row['size'],
                    'normalized_size' => $sizeNorm,
                    'sku' => $sku,
                    'center_price' => $row['center_price'],
                    'selling_price' => $row['selling_price'],
                    'center_stock' => 0,
                    'is_active' => true,
                ]);
                $newIds[] = $prod->id;
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();

            if ($newImagePath && $isNewGroup) {
                $imgService->delete($newImagePath);
            } elseif ($newImagePath && $newImagePath !== $oldGroupImage) {
                $imgService->delete($newImagePath);
                if ($oldGroupImage) {
                    $group?->update(['image' => $oldGroupImage]);
                }
            }

            throw $e;
        }

        return redirect()
            ->route('owner.product-categories.show', $category)
            ->with('new_product_ids', $newIds);
    }

    public function bulkUpdate(Request $request, ProductCategory $category): RedirectResponse
    {
        $validated = $request->validate([
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'center_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'center_stock' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $ids = $validated['product_ids'];

        $updates = array_filter([
            'center_price' => $validated['center_price'] ?? null,
            'selling_price' => $validated['selling_price'] ?? null,
            'center_stock' => $validated['center_stock'] ?? null,
            'is_active' => array_key_exists('is_active', $validated) ? $validated['is_active'] : null,
        ], fn ($v) => $v !== null);

        if (empty($updates)) {
            return back()->with('error', 'Tidak ada perubahan.');
        }

        Product::whereIn('id', $ids)
            ->where('product_category_id', $category->id)
            ->update($updates);

        $count = count($ids);

        return back()->with('success', "{$count} produk berhasil diperbarui.");
    }
}
