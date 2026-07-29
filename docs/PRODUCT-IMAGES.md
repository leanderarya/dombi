# Product Images

## Image Ownership

- **Flavored product** (has `product_flavor_group_id`): image belongs to `ProductFlavorGroup`. Shared across all sizes in that flavor group. `products.image` is always null for grouped products.
- **Flavorless product** (no `product_flavor_group_id`): image belongs to `Product` directly.

Categories do **not** carry images.

## Fallback Chain

```
Flavored Product:
  ProductFlavorGroup.image → 🥛 placeholder

Flavorless Product:
  Product.image → 🥛 placeholder
```

No cascading fallback. Placeholder rendering is a frontend concern.

## API Response

Product objects include image ownership metadata:

| Field | Type | Description |
|-------|------|-------------|
| `image` | string\|null | Resolved image URL |
| `image_owner` | `product`\|`flavor_group`\|`none` | Which entity owns the image |
| `image_owner_id` | number\|null | ID of the owning entity |
| `has_image` | boolean | Whether any image is set |

Only flavored products have `image_owner = "flavor_group"`. Only flavorless products can have `image_owner = "product"`.

## Upload

- **Product with flavor**: upload to `PATCH /owner/product-flavor-groups/{id}/image`
- **Product without flavor**: upload via `POST`/`PUT` to product endpoints
- **Flavor group image**: shared, uploaded during product creation or via separate endpoint
- **Bulk-size creation**: image attached to new/existing flavor group

## Delete

An image can be deleted via:

- `DELETE /owner/products/{id}/image` — for flavorless products
- `DELETE /owner/product-flavor-groups/{id}/image` — for flavor groups

Deletion checks references across Products and FlavorGroups. File on disk is only removed when no other record references it.

## File Storage

- Disk: `public` (symlink `public/storage` → `storage/app/public`)
- Path: `storage/app/public/products/{name}.webp`
- URL: `/storage/products/{name}.webp`
- Format: **800×800 WebP** at 80% quality
- Max upload: **4MB**
- Accept: `jpg`, `jpeg`, `png`, `webp`

## File terkait

| File | Fungsi |
|------|--------|
| `app/Models/Product.php` | `display_image` accessor |
| `app/Services/ProductImageService.php` | Upload, resize, deleteIfUnreferenced |
| `app/Http/Controllers/Owner/ProductController.php` | Product CRUD + deleteImage |
| `app/Http/Controllers/Owner/ProductFlavorGroupController.php` | FlavorGroup image upload + delete |
| `app/Http/Controllers/Customer/CustomerProductApiController.php` | API response with image_owner metadata |
| `resources/js/components/owner/image-upload-field.tsx` | Upload field + onRemove delete |
| `resources/js/components/owner/product-image.tsx` | 3-level fallback component |
| `resources/js/pages/owner/product-categories/product-form.tsx` | Product form with image upload |
| `resources/js/components/customer/product-image.tsx` | Customer image display |
