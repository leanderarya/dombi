# Task 9 Report: Form Requests

**Status:** ✅ Complete
**Date:** 2026-07-28

## Summary
Implemented ProductCategory and Product FormRequests with validation per new product domain (product_categories / products / product_id), plus fixed legacy inventory/restock requests that still referenced product_variant_id.

## Files Created

### 1. `app/Http/Requests/Owner/StoreProductCategoryRequest.php`
- `authorize`: `isOwner()`
- Rules:
  - `name`: required, string, max:255, unique:product_categories,name
  - `brand`: nullable, string, max:255
  - `description`: nullable, string, max:1000
  - `image`: nullable, image, mimes:jpg,jpeg,png,webp, max:4096
  - `is_active`: sometimes, boolean

### 2. `app/Http/Requests/Owner/UpdateProductCategoryRequest.php`
- Same as Store but:
  - `name`: sometimes|required + `Rule::unique()->ignore($categoryId)` handling route model binding (`product_category`, `productCategory`, `category`, `id`)
  - `is_active`: sometimes boolean

### 3. `app/Http/Requests/Owner/StoreProductRequest.php` (overwrite legacy)
Old had `unit`, `price`, nullable category. New:
  - `product_category_id`: required, exists:product_categories,id
  - `name`: required, string, max:255
  - `description`: nullable, string, max:1000
  - `flavor`: nullable, string, max:100
  - `size`: nullable, string, max:50
  - `sku`: nullable, string, max:50, unique:products,sku
  - `center_price`: required, numeric, min:0
  - `selling_price`: required, numeric, gte:center_price
  - `image`: nullable, image, mimes jpg/jpeg/png/webp, max 4096
  - `is_active`: sometimes boolean

### 4. `app/Http/Requests/Owner/UpdateProductRequest.php` (overwrite stub)
- Previously extended StoreProductRequest empty class. Now standalone with `Rule::unique()->ignore(productId)`
- `product_category_id`: sometimes|required|exists
- `name`: sometimes|required
- `sku`: nullable + unique ignore
- `center_price`: sometimes|required numeric min0
- `selling_price`: sometimes|required numeric gte:center_price
- Other fields same nullable.

### 5. `app/Http/Requests/Owner/BulkStoreProductsRequest.php`
- `product_category_id`: required exists
- `size`: nullable string max50
- `center_price`: required numeric min0
- `selling_price`: required numeric gte:center_price
- `flavors`: required array min1 max20
- `flavors.*`: required string max100
- `description`: nullable string max1000

## Files Modified

### 6. `app/Http/Requests/Owner/StoreInventoryRequest.php`
- Before: `product_variant_id` => required exists:product_variants,id
- After: `product_id` => required exists:products,id
- Keeps `outlet_id`, `current_stock`, `minimum_stock`, `notes`

### 7. `app/Http/Requests/Owner/UpdateInventoryRequest.php`
- Checked: no product_variant_id present. Contains only stock fields. No change needed (intentionally keeps stock-only update).
- Verification: grep for product_variant_id in Requests returns 0 results.

### 8. `app/Http/Requests/Outlet/StoreRestockRequest.php`
- Before: `items.*.product_variant_id` required exists:product_variants,id
- After: `items.*.product_id` required exists:products,id

## Verification
- `grep -rn product_variant_id|product_family_id app/Http/Requests` => 0 results (clean)
- Manual rule dump via `php -r` booted Laravel, instantiated each Request, printed rules – all match brief + extra prompt spec.
- Authorize checks consistent: Owner requests `isOwner()`, Outlet request `outlet` check.
- Image validation matches spec: nullable image mimes jpg,jpeg,png,webp max4096.

## Test Scenario (from brief)
```php
public function test_store_product_request_requires_category(): void {
    $this->post('/owner/product-categories/1/products',['name'=>''])->assertSessionHasErrors('name');
}
```
- New StoreProductRequest will fail validation on `name` required and `product_category_id` required if hitting correct route. Ready for controller using FormRequest.

## Notes
- Update requests use `sometimes` + required to allow PATCH semantics, and handle route model binding robustly for both id and model instance.
- `is_active` uses `sometimes|boolean` instead of just `boolean` to avoid requiring field when not present, while still validating boolean when provided (compatible with brief's intent and existing StoreOutlet/UpdateOutlet patterns).
- No breaking changes beyond intended refactor; legacy ProductFamily/Variant controllers still use inline validation and are out of scope.

## Commit Command (per brief)
```bash
git add app/Http/Requests/Owner/StoreProductCategoryRequest.php app/Http/Requests/Owner/UpdateProductCategoryRequest.php app/Http/Requests/Owner/StoreProductRequest.php app/Http/Requests/Owner/UpdateProductRequest.php app/Http/Requests/Owner/BulkStoreProductsRequest.php app/Http/Requests/Owner/StoreInventoryRequest.php app/Http/Requests/Outlet/StoreRestockRequest.php
git commit -m "feat: add ProductCategory/Product FormRequests with validation"
```
