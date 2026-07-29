# Variant Size vs Flavor Distinction – Design Spec v2 (Persistent FlavorGroup)

## Context
Customer listing groups by flavor (buildSections Map flavor → variants). Size variants collapse under one flavor card, chosen via size-selector-sheet. Flavor variants appear as distinct cards with different images. Size must ALWAYS share one image and appear once, flavor must have different image and multiple choices. User confirmed: flavor = card/image beda, size = 1 card + sheet gambar sama, bulk size sekaligus 1 foto shared, detail page ganti ukuran harga berubah gambar tetap, ganti rasa gambar berubah, harga beda per ukuran.

Previous spec v1 used LOWER(TRIM) accessor for image fallback – has N+1, file lifecycle risks, unclear ownership.

## Architecture Decision
Keep business hierarchy `ProductCategory → Product` where Product = single sellable SKU. Introduce internal persistent `ProductFlavorGroup` that owns shared flavor image. Not a third sellable level.

```
ProductCategory
├── ProductFlavorGroup: Coffee (image: coffee.webp)
│   ├── Product: Coffee 200ml (size_value 200, size_unit ml, sku DOM-COF-200-001, price, stock)
│   └── Product: Coffee 500ml
├── ProductFlavorGroup: Chocolate
│   ├── Chocolate 200ml
│   └── Chocolate 500ml
├── ProductFlavorGroup: Original (for no-flavor case, label Flavor / Product Type)
│   ├── Starter Package 200ml
```

Business-facing remains two-level. Technical:
- ProductCategory – category info
- ProductFlavorGroup – grouping key, shared image, flavor label
- Product – SKU, size, prices, stock

## Data Model

### product_flavor_groups (new)
```
id
product_category_id FK product_categories cascade
flavor string – display name e.g. Coffee, Original, Regular
normalized_flavor string – LOWER(TRIM) + unicode NFC, e.g. coffee
description nullable text – optional flavor description
image nullable string – shared flavor image path (public disk products/)
is_active bool default true
created_at, updated_at, deleted_at (SoftDeletes)
UNIQUE(product_category_id, normalized_flavor)
INDEX(product_category_id, is_active)
```

Normalization: application-level before save in model boot/observer:
- normalized_flavor = mb_strtolower(trim(flavor), UTF-8) + remove extra spaces `preg_replace('/\s+/',' ', ...)`, NFC normalization if extension exists.
- Same for `normalized_size` concept below.

### products (existing, adjust)
```
id
product_category_id FK product_categories cascade (already, make nullable=false after cleanup)
product_flavor_group_id FK product_flavor_groups cascade (new, nullable initially for migration, then required)
name – e.g. Coffee 200ml = flavor + size (no category duplication)
description nullable – specific SKU description, no inheritance
flavor nullable – kept for backward compat during migration, deprecated after – use flavorGroup.flavor
size nullable – display size e.g. 200ml, 1L (kept, but add parsed fields)
size_value nullable integer – e.g. 200
size_unit nullable string – e.g. ml, L, g
normalized_size nullable string – e.g. 200ml lowercase no space for uniqueness
sku nullable unique max50 deterministic
center_price, selling_price, center_stock, image (deprecated: products should NOT own image when flavor_group_id exists – keep nullable for transition but ignore if flavor_group_id present), is_active, deleted_at
UNIQUE(product_flavor_group_id, normalized_size)
UNIQUE(sku)
```

If size_value/unit too large change for phase, at least normalized_size.

### Migration Steps
1. Create product_flavor_groups table with unique constraint.
2. Backfill: for each existing ProductCategory, group existing Products by normalized_flavor (from products.flavor). For each group:
   - Create FlavorGroup with product_category_id = products' category, flavor = first products.flavor display (or 'Original'/'Regular'/'Standard' if flavor null), normalized_flavor.
   - Pick first product.image in group as group image if any.
   - Update all products in group set product_flavor_group_id = new group id.
3. For products where flavor IS NULL: create individual flavor groups? Recommendation: Every product must belong to flavor group, even if not called flavor. So if flavor null, create group flavor = name or 'Regular' per product? To avoid collapsing unrelated null flavor products into one card, create group per product if flavor null (flavor = Original/Regular/Classic derived from product.name or fallback). Alternative: create one group per null product where flavor label = product.name without size? Simpler for Phase1: if flavor null, create group flavor = product.name (or first word). But spec says group empty flavors under __none__ incorrectly collapses Gift Packages. So must NOT group all null together. Implement: if flavor null, treat product.name (without size suffix?) as flavor? Or create group named 'Regular' only if category has one product? For minimal: create group flavor = 'Standard' per category if multiple null products, but that still collapses. Better: create group per product when flavor null (flavor = product.name).
   Decision: Migration script detects flavor null → create group flavor = product.name (trim size suffix if detectable via regex `/\d+\s*(ml|L|g)$/i`). Example "Starter Package 200ml" → flavor "Starter Package". This prevents collapse.
4. Add column product_flavor_group_id nullable, then after backfill make required? Keep nullable for rollback safety, but application requires.
5. Add unique indexes.

## Image Resolution

### Final Rule
Customer-facing flavor card:
```
flavorGroup.image → placeholder (null)
```
Do NOT fallback to category.image as distinct flavor image. Category.image may be shown only as temporary preview in owner forms, not as flavor image. This enforces every flavor has distinct image per business rule.

Owner-facing forms may show category.image as preview before flavor image exists, but validation shows warning "Flavor image is missing".

API:
```json
{
  "id": 1,
  "name": "Coffee 200ml",
  "flavor": "Coffee",
  "size": "200ml",
  "display_image": "/storage/products/coffee.webp" | null,
  "has_flavor_image": true|false,
  "category_image": "/storage/products/domilk.webp" | null (for preview only)
}
```
Placeholder emoji 🥛 is frontend only, not returned as image URL.

Owner warning:
```
Flavor image is missing – upload image for Coffee group
```

Products should NOT own image when flavor_group_id exists. If products.image present and group image exists, group image wins. Deprecate products.image in future phase. For transition, ignore products.image if product_flavor_group_id set, unless explicit override flag? Spec says products should not independently own images when they belong to flavor group – enforce.

File lifecycle: ProductFlavorGroup owns physical file. Replacing image on group deletes old file. Deleting group deletes file only if no other group references same path (unique per group, so safe). Products never delete file.

## SKU Generation Hardening

Old: existing count + index → 004,005 collides when deletions/gaps/concurrent.

New: max sequence +1 inside transaction with locking.

Parsing existing SKUs to extract sequence: SKUs format `BIO-ORI-1L-001` → suffix `-001` numeric. Query `products WHERE product_category_id = ? ORDER BY sku DESC`? But SKU format varies. Better: query max `id` or dedicated sequence table? Simplest robust: SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(sku,'-',-1) AS UNSIGNED)),0) WHERE product_category_id=? AND sku LIKE 'BIO-ORI-%' then +1.

Even simpler: use `SELECT MAX(id)`? Not deterministic.

Implement `ProductFlavorGroup`-scoped sequence: `product_flavor_groups` could have `sku_sequence` integer incremented atomically via `lockForUpdate()`.

Procedure inside DB::transaction:
1. Lock flavor group row `ProductFlavorGroup::lockForUpdate()->find(groupId)`
2. Get max sequence from products in group: `Product::where(product_flavor_group_id=groupId)->max(CAST(...))` or use group's sku_sequence column.
3. New seq = max+1, generate SKU via existing generator `generate(category, name, flavor, size, newSeq)`
4. While exists retry up to 5 times.
5. Increment group sku_sequence.

Unique constraint final protection.

## Backend Requests

### BulkStoreSizeProductsRequest
Frontend submits FormData with image file + sizes as JSON string. Laravel won't auto decode array.

Add `prepareForValidation()`:
```php
protected function prepareForValidation(): void {
    if(is_string($this->sizes)){
        $decoded = json_decode($this->sizes, true);
        $this->merge(['sizes' => is_array($decoded) ? $decoded : null]);
    }
    if(is_string($this->flavors)){
        $decoded = json_decode($this->flavors, true);
        $this->merge(['flavors' => is_array($decoded) ? $decoded : null]);
    }
}
```
Malformed JSON must produce validation error, not exception.

Rules for bulkSize:
```
product_category_id required exists product_categories,id
flavor required string max100
description nullable max1000
image nullable image mimes jpg,jpeg,png,webp max4096
sizes required array min1 max10
sizes.*.size required string max50 distinct (check normalized)
sizes.*.center_price required numeric min0
sizes.*.selling_price required numeric gte: sizes.*.center_price (custom per row validation)
sizes.*.sku nullable string max50 unique:products,sku
```

Need custom validation for selling_price gte center_price per row: use closure or after validation.

### BulkStoreProductsRequest (flavor bulk)
Existing needs same prepareForValidation for flavors JSON.

### StoreProductRequest / UpdateProductRequest
- product_category_id required exists (or optional for update)
- name required max255
- description nullable
- flavor required? Recommendation: flavor required for new design (every product must belong to flavor group). For backward compat, nullable but we auto assign to group named after product name if null.
- size nullable but required for commerce? Recommend nullable but bulkSize requires.
- sku nullable unique
- center_price required numeric min0
- selling_price required numeric gte:center_price
- image nullable – but should be handled at flavor group level, not product level. For single creation, image upload should create/update flavor group image. So request may still accept image, but controller maps to flavor group.
- is_active boolean

## Controllers

### ProductController@store (single)
1. Normalize flavor: `normalized = strtolower(trim(flavor))`
2. Find or create FlavorGroup for category+normalized inside transaction, lock category row? Use firstOrCreate with normalized key
3. If image uploaded → store via ProductImageService, update FlavorGroup image (replace old)
4. If no image and flavor group has no image → allow but mark missing
5. For each size? Single mode: 1 product
6. Generate size_value/unit/normalized_size from size string: parse `/(\d+)\s*(ml|L|g|kg)/i`
7. Generate SKU via SkuGenerator uniqueForCategory or group
8. Create Product with product_flavor_group_id, product_category_id, name = flavor + size (or provided name), description, size, size_value, size_unit, normalized_size, sku, prices, center_stock=0, is_active, NO image (or null)
9. Commit → flash new_product_ids → SetupStockModal

### bulkSize (new)
Atomic transaction:
1. Validate all rows (sizes array distinct normalized_size, selling>=center per row)
2. Resolve or create FlavorGroup for flavor
3. Store shared image once (if provided) → update FlavorGroup image
4. For each size row:
   - normalized_size = strtolower(trim(no spaces))
   - Check UNIQUE(product_flavor_group_id, normalized_size) – fail validation if duplicate size in same flavor group exists
   - Generate SKU
   - Create Product with group_id, category_id, name = flavor+size, size_value/unit, normalized_size, pricing, center_stock=0
5. Generate SKUs with max sequence locking per group
6. Commit, if fail → delete newly uploaded image (if it was new group image and transaction failed, cleanup)
7. Return new_product_ids

Existing flavor existence behavior:
- Existing flavor + no uploaded image → retain existing group image
- Existing flavor + uploaded image → replace group image for all sizes (update group)
- New flavor + uploaded image → create group with image
- New flavor + no image → allow draft creation but mark missing image warning

### Single Product creation also resolves same group
Same as bulkSize single row logic.

### Duplicate
When duplicating Product:
- Copy category, description, flavor group, size, pricing, group image (same group)
- Reset SKU, center_stock
- But duplicating same flavor+size combination should be prevented.
Recommended behavior: create inactive draft requiring owner to change Size or Flavor before activation. Or disable duplication when same normalized_size already exists in group. For Phase1: duplicate → always create inactive draft with name "Original Copy" requiring size change. After duplication, launch Initial Stock workflow.

### InventoryService
Already product_id + initial_stock. No direct center_stock update. All via service.

## Frontend Listing

`products.tsx` buildSections:
- Already grouping by flavor. Change source from `v.flavor` to `v.flavor_group.flavor` or `flavorGroup.name` if new relation. For backward compat, use `product.flavorGroup?.flavor ?? product.flavor`
- Representative selection: first with has_flavor_image true, then lowest price
- displayImage = flavorGroup.image (or null)
- displayLabel = category.name + ' - ' + flavorGroup.flavor
- lowestPrice = min selling_price in group
- has_flavor_image boolean for warning
- Quick add: if group.products.length >1 → open size selector

## Size Selector Sheet
- Props: flavorGroupProducts: Product[] (all sizes of one flavor), flavorName, flavorGroupImage
- UI: no image per size, only size label, price, stock_status, SKU, qty stepper. Header shows flavor group image + flavor name + category name
- Sorted by size_value numeric (sizeToMl existing lib) – use size_value if available else parse size string
- On select size → add product_id of that size

## Product Detail Page
- Effective flavor via URL or sole flavor, effective size via URL or smallest
- selectedProduct = find by flavor+size for price/stock/product_id
- displayImage = flavorGroup.image of effectiveFlavor (not selectedVariant.image)
  - Size switch → price/stock changes, image stays same
  - Flavor switch → image changes
- Flavor selector: shows all flavor groups in category, hasVariant checks if ANY product in that flavor group exists (is_active true, stock maybe)
- Size selector: shows sizes for effectiveFlavorGroup, per size price diff
- Selection resolution function single source: `resolveSelection(flavor, size, availableProducts)` returns {product, effectiveFlavor, effectiveSize}
  - If requested flavor+size combo missing → if flavor has requested size? No → pick smallest size in flavor
  - If switching flavor and current size unavailable in new flavor → pick smallest size in new flavor
  - Update product_id, price, stock, SKU, URL together, do not retain stale product_id
- Placeholder frontend only, no emoji API value

## Owner Pages

`product-categories/show.tsx`:
- Table grouping by flavorGroup – expand/collapse sections per flavor group
- Per group header: flavor name, group image (ProductImage), count of sizes, warning if missing image, edit group image button
- Columns per product row: Size, SKU, HPP, Harga Jual, Margin% + Amount live, Stok Pusat + badge No Center Stock, Status, Actions
- Duplicate action: POST `/owner/products/{id}/duplicate` → new inactive draft + SetupStockModal
- Edit group image → PATCH `/owner/product-flavor-groups/{id}/image`

`product-categories/product-form.tsx`:
- Mode toggle Single | Bulk Flavor | Bulk Size
- Single: category readonly if from category page, name auto from flavor+size if empty, description, flavor/type field labeled "Flavor / Product Type", size, SKU, HPP, Harga Jual, image labeled "Foto Rasa (shared untuk semua ukuran rasa ini)" with info "This image is shared by all Coffee sizes. Replacing it will update the image shown for every Coffee size.", is_active
- Bulk Flavor: existing 1 size + N flavors, shared pricing, no image (set later per flavor)
- Bulk Size (new): 1 flavor + N sizes + 1 shared image + per-size pricing rows Size|HPP|Harga Jual|SKU|Margin|Remove, Tambah Ukuran, preview list
- Submit endpoints:
  - Single → FormData POST `/owner/product-categories/{id}/products`
  - Bulk Flavor → JSON POST `/owner/product-categories/{id}/products/bulk` {size, center_price, selling_price, flavors, description}
  - Bulk Size → FormData POST `/owner/product-categories/{id}/products/bulk-size` with image file + flavors + sizes JSON
- After success → SetupCenterStockModal batch

## Search & Soft Delete
- product-search-filters.tsx already with chips Active/Inactive/OutOfStock/LowStock/HasImage/NoImage
- Search haystack: name, category_name, brand, flavor, size, sku, normalized_flavor, normalized_size
- Soft delete guard via ProductPolicy + ProductFlavorGroupPolicy
- ProductFlavorGroupPolicy::delete cannot if any product in group has business history
- ProductPolicy::delete cannot if product has business history
- Deactivation path: allow deactivate product even with history

## Routes
```
product-categories resource (existing)
POST product-categories/{category}/products → store single
POST product-categories/{category}/products/bulk → bulkStore flavor
POST product-categories/{category}/products/bulk-size → bulkSize (new)
PUT products/{product} → update
DELETE products/{product} → destroy (policy)
PATCH products/{product}/toggle → toggle
POST products/{product}/duplicate → duplicate (inactive draft)
PATCH product-flavor-groups/{flavorGroup}/image → updateGroupImage (new)
GET/POST inventories/central-stock/{product} already for initial stock via InventoryService
```

## SKU Generation
- Deterministic no random, max 50 chars
- Format: `{CAT3}-{FLA3}-{SIZE}-{SEQ3}` e.g. DOM-COF-200-001, BIO-ORI-1L-004
- Hardened: max existing sequence +1 inside transaction locking flavor group sku_sequence column, retry up to 5
- Unique constraint final protection

## Initial Stock Workflow
- Products always created center_stock=0 via controller (no direct write)
- Immediately after creation success, launch SetupCenterStockModal (single or batch)
- Actions Save (PATCH central-stock with reason Stok awal) → InventoryService type initial_stock → StockMovement
- Skip → remains 0 + badge No Center Stock

## Tests Alignment
With persistent group:
- Product.display_image returns Flavor Group image
- Products in same Flavor Group return same display_image
- Replacing Flavor Group image affects every size
- Changing one Product size does not alter its image
- Different Flavor Groups can have different images
- Missing Flavor Group image returns null/has_flavor_image false
- Category image is not silently treated as distinct flavor image (customer card placeholder, owner preview only)
- Bulk size atomic: transaction rollback removes products + image cleanup if fails
- Uniqueness: normalized flavor + normalized size enforced via DB + validation
- SKU collision retry

## Rollback
- New migration for product_flavor_groups can rollback (drop table)
- Image inheritance fallback can revert to product.image ?? category.image
- Bulk size route can be disabled
