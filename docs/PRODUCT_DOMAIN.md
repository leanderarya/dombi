# Dombi — Product Domain Specification

**Canonical spec** after domain refactor (Task 1–21).
**Status:** Final. Supersedes all legacy "family/variant" terminology.

---

## Domain Hierarchy

```
ProductCategory (was: ProductFamily)
  └── Product (was: ProductVariant)
```

### ProductCategory

| Field | Type | Notes |
|---|---|---|
| id | bigint unsigned, PK | Auto-increment |
| name | varchar(255), required | |
| brand | varchar(255), nullable | |
| description | text, nullable | Not inherited by Products |
| image | varchar(255), nullable | Fallback for Products |
| is_active | boolean, default true | Soft-disable |
| created_at / updated_at / deleted_at | timestamp | Soft deletes |

### Product (was: ProductVariant)

| Field | Type | Notes |
|---|---|---|
| id | bigint unsigned, PK | Auto-increment |
| product_category_id | bigint unsigned, FK → product_categories | Renamed from `product_family_id` |
| name | varchar(255), required | |
| description | text, nullable | Independent; not inherited from category |
| flavor | varchar(255), nullable | E.g. "Original", "Chocolate" |
| size | varchar(255), nullable | E.g. "250ml", "1L" |
| sku | varchar(255), nullable, unique | Auto-generated if empty |
| barcode | varchar(255), nullable | |
| center_price | decimal(12,2), default 0 | ≥ 0 |
| selling_price | decimal(12,2), default 0 | ≥ center_price |
| center_stock | unsigned int, default 0 | Always 0 on creation |
| is_active | boolean, default true | |
| image | varchar(255), nullable | First in fallback chain |
| created_at / updated_at / deleted_at | timestamp | Soft deletes |

---

## Domain Terminology Mapping

| Legacy (OLD) | Current (NEW) | Table / Column |
|---|---|---|
| ProductFamily | ProductCategory | `product_categories` |
| ProductVariant | Product | `products` |
| `product_family_id` | `product_category_id` | Column in `products` |
| `product_variant_id` | `product_id` | Column in all child tables |
| `replacement_variant_id` | `replacement_product_id` | Column in `exchange_request_items` |
| OutletVariantPrice | OutletProductPrice | `outlet_product_prices` |
| `outlet_variant_prices` | `outlet_product_prices` | Table |
| FamilyController | ProductCategoryController | Route `product-categories.*` |
| VariantController | ProductController | Route `products.*` |

**All** child tables (`outlet_inventories`, `order_items`, `stock_movements`, `restock_request_items`,
`return_request_items`, `exchange_request_items`, `favorites`, `offline_sales`,
`pricing_audit_logs`, `outlet_product_prices`) use `product_id` as the FK column.

Backward-compat alias classes (ProductFamily, ProductVariant, OutletVariantPrice) removed.
All code references the canonical models directly.

---

## Image Fallback Chain

```
Product.image ──► ProductCategory.image ──► Placeholder (SVG)
                              ↑
                    First value wins
```

1. **Product.image** — Per-product image (cropped, square, WebP, 400×400px)
2. **ProductCategory.image** — Category-level fallback (same format)
3. **Placeholder** — SVG vector placeholder at `storage/app/public/products/*.svg`

External URLs (`http://`/`https://`) are used as-is (legacy Unsplash).

Resolution logic in `CustomerProductApiController::resolveImage()`.

---

## SKU Generation Rules

- Auto-generated when SKU field is left empty on creation
- **Format:** `{CAT-ABBR}-{FLAVOR-ABBR}-{SIZE-ABBR}-{NNN}`
  - `CAT-ABBR`: First 3 uppercase chars of category name (padded/truncated to 3)
  - `FLAVOR-ABBR`: First 3 uppercase chars of flavor (omit if empty; use `000`)
  - `SIZE-ABBR`: First 3 uppercase chars of size (omit if empty; use `000`)
  - `NNN`: Zero-padded sequence number (001–999)
  - Example: "Original Chocolate 1L" → `ORI-CHO-1L-001`
  - Example: "Original 250ml" → `ORI-000-250-001`
- **Deterministic** — same category/flavor/size always produces same SKU pattern
- **Max length:** 50 characters (truncate category/flavor/size abbreviations if needed)
- **Uniqueness:** Enforced at DB level; if collision, increment sequence number
- **Manual SKUs:** When user provides SKU directly, use as-is (must be unique, ≤ 50 chars)

---

## Initial Center Stock Workflow

- **On product creation:** `center_stock` is always set to **0**
- After product is saved, a **popup** appears: "Add initial center stock?"
  - **Save:** Opens modal to set initial quantity → calls `InventoryService::initial_stock(product_id, quantity)`
  - **Skip:** Dismiss popup, center_stock remains 0
- `InventoryService::initial_stock()` creates an `initial_stock` StockMovement record and updates `center_stock`

---

## Soft Delete Rules

| Scenario | Action |
|---|---|
| Product has order items, inventory, or other business history | Set `is_active = false`, **do not** soft-delete |
| Product created but never used in any transaction | Soft-delete allowed (physical removal OK too) |
| Category has products (active or inactive) | Soft-delete NOT allowed; must deactivate products first |
| Category has no products | Soft-delete allowed |

Soft-delete uses `deleted_at` column (Laravel SoftDeletes trait).
Deactivation uses `is_active = false`.

---

## Multi-Flavor Bulk Creation

Form supports creating multiple Products under one ProductCategory in a single submission:

- Fields: name, flavor, size, sku, center_price, selling_price (per row)
- "Add row" button appends a new product row
- "Remove row" button removes a row (min 1 row)
- SKU auto-generation runs per row if field left empty
- Validation runs on all rows before creation
- All products get the same `product_category_id`

---

## Search & Filter Fields

| Feature | Fields |
|---|---|
| Search (text) | name, sku, barcode, flavor, size |
| Filter by category | product_category_id (dropdown) |
| Filter by active status | is_active (boolean toggle) |
| Filter by stock status | center_stock > 0, center_stock = 0 |
| Sort | name, created_at, selling_price, center_stock |

---

## Pricing Validation

```
center_price  >= 0
selling_price >= center_price
```

- **center_price (harga pusat):** Must be ≥ 0. This is the cost baseline.
- **selling_price (harga jual):** Must be ≥ center_price. This is the customer-facing price.
- Validation enforced at both PHP level (FormRequest/validation) and DB level (no negative values).
- Live margin calculation shown during form entry:
  - `outlet_margin = selling_price - center_price`
  - `margin_percent = (selling_price - center_price) / center_price × 100`
- Outlet-specific price override: `OutletProductPrice.selling_price`, validated same as global.

---

## OutletProductPrice (was: OutletVariantPrice)

| Field | Type | Notes |
|---|---|---|
| id | bigint unsigned, PK | |
| outlet_id | bigint unsigned, FK | |
| product_id | bigint unsigned, FK → products | Renamed from `product_variant_id` |
| selling_price | decimal(12,2) | Outlet-specific override |
| created_at / updated_at | timestamp | |

Unique on `(outlet_id, product_id)`. If no row exists for an outlet, the product's global
`selling_price` is used.
