# Variant Size vs Flavor Distinction – Design Spec

## Context
Customer listing currently groups products by flavor (`buildSections` groups by `flavor` field). Size variants collapse under one flavor card, chosen via `size-selector-sheet`. Flavor variants appear as distinct cards with different images. Size variants share same image in practice but no explicit rule enforced. Owner reports confusion and wants hardening: size variant must ALWAYS share same image and appear once, flavor variant must have different image and multiple choices. Bulk size creation with per-size pricing needed.

Source files audited:
- `resources/js/pages/customer/products.tsx` L445-503 – grouping by flavor
- `resources/js/pages/customer/product-detail.tsx` – flavor/size selectors, image swaps
- `resources/js/components/customer/size-selector-sheet.tsx` – no image per size
- `resources/js/pages/owner/product-categories/show.tsx` – table per product, bulk flavor shared pricing
- `app/Models/Product.php` – flavor, size, image fields
- `app/Http/Controllers/Customer/CustomerProductApiController.php` – resolveImage per variant

User confirmed:
- Flavor = different cards + different images ✓
- Size = 1 card + sheet, image always same ✓
- Bulk size creation sekaligus with 1 photo shared ✓
- Detail page: size change → price changes, image stays. Flavor change → image changes ✓
- Bulk size pricing beda per ukuran ✓

## Architecture
Keep two-level hierarchy `ProductCategory → Product` where Product = single SKU (flavor+size). Introduce flavor group abstraction as logical grouping (no new table) with image inheritance. Bulk size endpoint creates N products (1 flavor + N sizes + 1 shared image + per-size pricing). Frontend image resolution uses flavor group fallback chain.

## Data Model
No new tables in Phase 1 (keep minimal). ProductCategory(id, name unique, brand, description, image, is_active, deleted_at). Product(id, product_category_id nullable now, name, description nullable, flavor nullable, size nullable, sku nullable unique max50, center_price decimal, selling_price decimal gte:center_price, center_stock integer, image nullable, is_active boolean, deleted_at).

Flavor group definition: all Products where `product_category_id` same AND `LOWER(TRIM(flavor))` same. Empty flavor treated as '__none__'.

Image resolution fallback (new):
```
product.image
  → first product in same flavor group with image (ordered by id asc)
  → category.image
  → placeholder emoji 🥛
```
Method `Product::getFlavorGroupImageAttribute()` implements this. API `resolveImage()` in `CustomerProductApiController` and `ProductController@show` must use this method when flavor param present.

## Frontend Listing
`products.tsx` buildSections:
- Keep grouping by flavor (existing behavior)
- Representative variant selection change from cheapest to first with image (prioritize visual): sort group by has_image desc, then lowest price.
- displayImage = flavorGroupImage (from new resolution)
- displayLabel = category.name + ' - ' + flavor if flavor, else category.name + ' - ' + size?
- lowestPrice = min selling_price in group, totalSizes = count
- Quick add: if group.products.length >1 → open size selector, else direct add.

## Size Selector Sheet
- Props: flavorGroup: Product[], flavorName
- UI: list per size product: size label, price, stock, sku, no image (since shared). Sorted by sizeToMl.
- On select size → add to cart uses product_id of that size variant.
- No image per row, but header shows flavor group image + flavor name.

## Product Detail Page
- State: effectiveFlavor from URL or sole flavor, effectiveSize from URL or smallest size.
- selectedVariant = find by flavor+size for price/stock
- **displayImage** new state = flavorGroupImage(effectiveFlavor) not selectedVariant.image
  - If user switches size, displayImage stays same (only price changes)
  - If switches flavor, displayImage changes to new flavor group image
- Flavor selector: shows all flavors, hasVariant checks if combo exists with effectiveSize? But should check if ANY size of that flavor exists (since size can change)
- Size selector: shows sizes for effectiveFlavor, per size shows price diff vs current, hasVariant checks if size exists for effectiveFlavor
- No flavor/size: fallback list all products by name

## Owner Pages
`product-categories/show.tsx`:
- Keep table per product row but add flavor grouping toggle: group by flavor expand/collapse for clarity.
- Columns: Product (ProductImage with fallback), Flavor, Size, SKU, HPP, Harga Jual, Margin%, MarginAmount, Stok Pusat + badge No Center Stock if 0, Status, Actions Duplicate/Toggle/Edit/Delete
- Duplicate: POST /owner/products/{id}/duplicate → controller copy except SKU+stock, generate new SKU, trigger SetupStockModal
- ProductSearchFilters already exists with chips Active/Inactive/OutOfStock/LowStock/HasImage/NoImage, search haystack name, category_name, brand, flavor, size, sku – reuse
- Soft delete guard: if 422 hasBusinessHistory → dialog "Tidak bisa hapus, sudah dipakai. Nonaktifkan saja?" with Deactivate button PATCH toggle

`product-categories/index.tsx`:
- Title Kategori Produk, search name/brand, filters All/Active/Inactive/No Image/Has Image, ProductImage, badges
- Dialog tambah kategori with ImageUploadField

## Product Form
File: `product-categories/product-form.tsx` already exists with single + bulk flavor modes. Add bulk size mode.

**Single Mode:**
- Fields: category readonly if from category page else select, name required (auto generate from flavor+size if empty?), description textarea, flavor nullable, size nullable, SKU optional (auto hint), HPP required, Harga Jual required gte HPP, image upload, is_active
- Live margin: margin = selling-center, margin_pct
- If flavor already exists in category, show info "Foto rasa {flavor} akan digunakan sebagai fallback untuk ukuran lain"
- Submit POST FormData to `/owner/product-categories/{id}/products` → flash new_product_id → SetupStockModal

**Bulk Flavor Mode (existing, harden):**
- Inputs: size single, HPP single, Harga Jual single, flavors array (chips comma/newline), description shared
- Preview N products same size different flavors
- Submit JSON POST `/owner/product-categories/{id}/products/bulk` {size, center_price, selling_price, flavors, description}
- No image in this mode (set later per flavor)

**Bulk Size Mode (new):**
- Inputs: flavor single required, description shared optional, image single shared (ImageUploadField), sizes dynamic rows
- Each row: size required unique, center_price required, selling_price required gte:center, sku optional (auto preview), margin% live, remove button
- Button "Tambah Ukuran"
- Shared image upload once, path used for all N products created
- Preview list: Original 200ml - Rp 15k etc with SKU
- Submit: FormData? Need to handle file + JSON array. Use FormData with image file + sizes as JSON string `sizes` field: `[{size, center_price, selling_price, sku}]`
- Endpoint POST `/owner/product-categories/{id}/products/bulk-size`
- Returns new_product_ids → SetupStockModal batch

**Validation:**
- Size unique within bulk request
- SKU unique globally if provided
- selling_price gte center_price per row
- Image nullable image mimes jpg/jpeg/png/webp max 4MB

## Backend

**New Request:** `BulkStoreSizeProductsRequest.php`
```
product_category_id required exists product_categories,id
flavor required string max100
description nullable max1000
image nullable image mimes jpg,jpeg,png,webp max 4096
sizes required array min1 max10
sizes.*.size required string max50
sizes.*.center_price required numeric min0
sizes.*.selling_price required numeric gte: sizes.*.center_price (custom logic)
sizes.*.sku nullable string max50 unique:products,sku
```

Per-size gte needs custom validation loop or use `*` wildcard with closure.

**ProductSkuGenerator:** already deterministic `CAT-FLA-SIZE-SEQ`. For bulk size, sequence increments per size row based on existing count + index. E.g., BIogoat existing 3, new rows 2 → 004, 005.

**ProductImageService:** store shared image once, return path, reuse for all products in bulk size. If existing flavor group has image, and new bulk size image not provided, do not set image (let fallback fetch sibling image). If image provided, set same path to all new products.

**Product model method:**
```php
public function getFlavorGroupImageAttribute(): ?string {
    if($this->image) return $this->image;
    if(!$this->flavor || !$this->product_category_id) return null;
    $sibling = Product::where('product_category_id',$this->product_category_id)
        ->whereRaw('LOWER(TRIM(flavor)) = ?', [strtolower(trim($this->flavor))])
        ->whereNotNull('image')
        ->where('id','!=',$this->id)
        ->orderBy('id')
        ->value('image');
    return $sibling;
}
public function getDisplayImageAttribute(): ?string {
    return $this->flavor_group_image ?? $this->category?->image;
}
```

**InventoryService:** unchanged (already uses product_id + initial_stock). All new products center_stock=0, SetupStockModal uses `updateCenterStock(productId, newStock, reason)`.

**Controllers:**
- `ProductController@store` already forces center_stock=0, sku auto, image via service, returns flash.
- `bulkStore` (flavor bulk) hardening: ensure no image field, sku auto per flavor.
- `bulkSize` new: handle image upload, sizes array, create N products.
- `update` handle image.
- `duplicate` copy image, reset stock+sku, generate sku.

Edge: When updating image of one size variant, should other sizes of same flavor inherit? No auto-overwrite. Only fallback uses sibling. So if user wants to change shared image for all sizes of a flavor, they must edit each? Better add bulk edit flavor image? For Phase 1, manual. Future: bulkUpdate with flavor filter.

**Routes:**
```
POST product-categories/{category}/products/bulk-size → bulkSize
```
Resource already exists for product-categories. Add bulk-size route.

## Acceptance Criteria
- Listing customer shows 1 card per flavor (not per size), size collapsed.
- Card image = flavor group image (different per flavor)
- Size selector sheet shows no image, only size/price/stock, sorted by sizeToMl, header shows flavor group image
- Detail page switching size does NOT change main image, only price/stock; switching flavor changes image
- Owner bulk size creation: 1 flavor + N sizes + 1 shared image + per-size pricing → creates N products SKU auto, center_stock 0, same image path, SetupStockModal batch
- Owner single creation with existing flavor: inherits flavor group image if no image uploaded (fallback)
- Search/filter still works with flavor/size/sku/category/brand
- Soft delete guard UI still works
- All stock via InventoryService initial_stock movement
- npm run build passes, tsc passes, Pint clean

## Test Plan
- Unit: Product::flavor_group_image returns sibling image, falls back to category
- Feature: Bulk size creation creates N products with shared image, per-size pricing, center_stock 0
- Feature: Product listing API returns flavor grouped, image = flavor group
- Feature: Detail page image not changes on size switch (frontend logic, manual QA)
- Feature: Product creation flow with zero stock then initial stock setup (already exists, reuse)
- Manual QA checklist from previous (single, multi flavor, multi size, duplicate, search, pricing, customer view)

## Rollback
- No DB schema change in Phase 1 (only logic). Bulk size route can be disabled. Image inheritance logic can be reverted to product.image ?? category.image.
