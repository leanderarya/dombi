# CUSTOMER COMMERCE FLOW AUDIT

**Date:** 2026-06-05
**Scope:** End-to-end customer purchasing flow
**Status:** Audit Only — No Fixes Applied

---

## EXECUTIVE SUMMARY

The ProductVariant migration is **partially complete and internally inconsistent**. The catalog layer (Home, Products, Product Detail) correctly uses `ProductVariant`, but the critical payment and inventory layers were never migrated. This creates **data integrity issues** and **incorrect pricing** at checkout.

### Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 6 |
| High | 5 |
| Medium | 6 |
| Low | 2 |

---

## ROOT CAUSE ANALYSIS

### Primary Root Cause
The migration was done in layers (catalog → checkout) but the **payment step** (`CheckoutController::payment()` and `submit()`) and the **entire inventory layer** were never updated.

### Secondary Root Cause
The client-side cart system (`use-cart.ts`, `checkout/index.tsx`) still operates on `product_id` semantics. The product-detail page bypasses this cart by POSTing directly to the server session.

### Tertiary Root Cause
`OrderService::buildOrderItems()` dual-path design masks upstream issues — it produces correct `order_items` but `Order.subtotal` is calculated incorrectly by the controller.

---

## DATA FLOW TRACE

```
product-detail.tsx
  POST /customer/checkout { items: [{ product_variant_id: X, quantity: 1 }] }
    ↓
CheckoutController::storeIndex()  ✅ Saves product_variant_id to session
    ↓
CheckoutController::index()  ✅ Loads variants, calls mapVariantItems()
    ↓
checkout/index.tsx  ⚠️ Sends product_id (undefined) instead of product_variant_id
    ↓
CheckoutController::payment()  ❌ Queries Product:: with product_id → EMPTY
    ↓
mapItems()  ❌ Returns "Produk" at Rp 0
    ↓
CheckoutController::submit()  ❌ calculateSubtotal() returns 0
    ↓
OrderService::buildOrderItems()  ✅ Correctly uses product_variant_id
    ↓
Order.subtotal = 0  ❌ (should be variant price × qty)
OrderItem rows = correct  ✅
```

---

## CRITICAL FINDINGS

### C1. `payment()` Uses Legacy Product Model
- **File:** `CheckoutController.php:253-257`
- **Problem:** Queries `Product::whereIn('id', $cart->pluck('product_id'))` — returns empty for variant-based carts
- **Impact:** Payment page shows Rp 0 for all items
- **Fix:** Migrate to use `ProductVariant` with `mapVariantItems()`

### C2. `mapItems()` Is Entirely Legacy
- **File:** `CheckoutController.php:423-440`
- **Problem:** Reads `$item['product_id']`, uses `$product->price` (not `selling_price`)
- **Impact:** Wrong item names and prices throughout checkout
- **Fix:** Replace with `mapVariantItems()` calls everywhere

### C3. `calculateSubtotal()` Uses Legacy Product
- **File:** `CheckoutController.php:470-483`
- **Problem:** Queries `Product::` and uses `$product->price`
- **Impact:** `Order.subtotal` and `Order.total` are wrong (Rp 0 for variant carts)
- **Fix:** Rewrite to use `ProductVariant` prices from session cart

### C4. Inventory Only Uses `product_id`
- **File:** `InventoryService.php:20,36,75,119`
- **Problem:** All stock queries use `product_id`, not `product_variant_id`
- **Impact:** All variants of a product share the same stock pool — variant-level stock control impossible
- **Fix:** Migrate inventory queries to use `product_variant_id`

### C5. StockMovement Never Writes `product_variant_id`
- **File:** `InventoryService.php:55,99,153`
- **Problem:** `StockMovement::create()` only writes `product_id`
- **Impact:** Stock history cannot distinguish which variant was involved
- **Fix:** Add `product_variant_id` to all `StockMovement::create()` calls

### C6. `repeatOrder()` Method Missing
- **File:** `OrderController.php:62` calls `$orderService->repeatOrder()` but method doesn't exist
- **Impact:** `BadMethodCallException` at runtime
- **Fix:** Implement `repeatOrder()` in `OrderService`

---

## HIGH FINDINGS

### H1. `StockMovement` Model Missing `product_variant_id` in Fillable
- **File:** `StockMovement.php:13-17`
- **Problem:** Column exists but not in `$fillable`
- **Impact:** Mass assignment silently drops variant data

### H2. `OutletAssignmentService` Stock Check Uses `product_id` Only
- **File:** `OutletAssignmentService.php:37,40`
- **Problem:** `outletHasEnoughStock()` keys by `product_id`
- **Impact:** Cannot determine if specific variant has stock

### H3. Frontend Cart Uses `product_id` Key
- **File:** `use-cart.ts:4,30-58`
- **Problem:** `CartItem` interface is `{ product_id, quantity }`
- **Impact:** Client cart incompatible with variant-based server cart

### H4. `checkout/index.tsx` Expects `products` Prop Never Passed
- **File:** `checkout/index.tsx:19`
- **Problem:** Backend sends `draft.items` but frontend expects `products` for lookup
- **Impact:** Client-side cart overlay non-functional

### H5. `checkout/payment.tsx` Uses `product_id` as React Key
- **File:** `checkout/payment.tsx:71`
- **Problem:** `key={item.product_id}` may be undefined for variant items
- **Impact:** React rendering issues

---

## MEDIUM FINDINGS

### M1. `StoreOrderRequest` Validates Only `product_id`
- **File:** `StoreOrderRequest.php:37`
- **Problem:** API order endpoint doesn't accept `product_variant_id`

### M2. `buildOrderItems()` Legacy Fallback Uses Mixed Pricing
- **File:** `OrderService.php:276-296`
- **Problem:** Falls back to `Product.price` if `selling_price` is 0

### M3. `redirect()` Passes `product_id` (Dead Code)
- **File:** `CheckoutController.php:31`
- **Problem:** Legacy redirect helper

### M4. `FloatingCartBar` Expects `product_id`-Keyed Products
- **File:** `floating-cart-bar.tsx:6,19-22`
- **Problem:** Price map keyed on product `id`

### M5. Settlement Reports Group by `product_name` Only
- **File:** `SettlementService.php:65-71`
- **Problem:** Cannot distinguish variants in reports

### M6. `OutletInventory.variant()` Relationship Unused
- **File:** `OutletInventory.php:33-36`
- **Problem:** Schema supports variant but services don't use it

---

## LOW FINDINGS

### L1. `OrderService` Eager-Loads `items.product` Not `items.variant`
- **File:** `OrderService.php:123`

### L2. `storeIndex()` Dual-Path Normalization Fragile
- **File:** `CheckoutController.php:99-112`
- **Problem:** `ProductVariant::where('product_id', ...)->first()` picks arbitrary variant

---

## LEGACY DEPENDENCY MAP

| File | Line(s) | Legacy Reference | Severity |
|------|---------|-----------------|----------|
| `CheckoutController.php` | 253-257 | `Product::query()` in `payment()` | CRITICAL |
| `CheckoutController.php` | 423-440 | `mapItems()` uses `product_id` | CRITICAL |
| `CheckoutController.php` | 470-483 | `calculateSubtotal()` uses `Product::` | CRITICAL |
| `InventoryService.php` | 20,36,75,119 | All queries use `product_id` | CRITICAL |
| `InventoryService.php` | 55,99,153 | StockMovement writes `product_id` only | High |
| `OutletAssignmentService.php` | 37,40 | Stock check by `product_id` | CRITICAL |
| `StockMovement.php` | 13-17 | `product_variant_id` not in fillable | Medium |
| `StoreOrderRequest.php` | 37 | Validates `product_id` only | Medium |
| `use-cart.ts` | 4,30-58 | Cart keyed on `product_id` | High |
| `checkout/index.tsx` | 11,38-59 | Frontend uses `product_id` | High |
| `checkout/payment.tsx` | 71 | React key uses `product_id` | High |
| `floating-cart-bar.tsx` | 6,19-22 | Price map by product `id` | Medium |

---

## PRIORITIZED FIX LIST

### Phase 1: Fix Checkout Payment (Unblocks Ordering)
1. Migrate `payment()` to use `ProductVariant` via `mapVariantItems()`
2. Remove or replace `mapItems()` with `mapVariantItems()`
3. Rewrite `calculateSubtotal()` to use variant prices from session cart
4. Update `submit()` to pass correct subtotal to `OrderService`

### Phase 2: Fix Frontend Cart (Prevents Confusion)
5. Update `use-cart.ts` to use `product_variant_id` key
6. Update `checkout/index.tsx` to send `product_variant_id`
7. Update `checkout/payment.tsx` to use `product_variant_id` as key
8. Update `FloatingCartBar` to work with variant data

### Phase 3: Fix Inventory (Ensures Correct Stock)
9. Add `product_variant_id` to `StockMovement` fillable
10. Migrate `InventoryService` to use `product_variant_id`
11. Migrate `OutletAssignmentService` stock check to use `product_variant_id`

### Phase 4: Fix Edge Cases
12. Implement `OrderService::repeatOrder()`
13. Update `StoreOrderRequest` to accept `product_variant_id`
14. Update settlement reports to include variant info

---

## RECOMMENDED APPROACH

**Phase 1 is the minimum viable fix** — it restores checkout functionality without touching inventory (which requires careful migration of existing stock data).

**Phase 3 (inventory) requires a data migration** — existing `OutletInventory` rows have `product_id` but no `product_variant_id`. A migration must map product-level inventory to variant-level inventory before the service code can switch.

---

*Generated: 2026-06-05 | Audit only — no fixes applied*
