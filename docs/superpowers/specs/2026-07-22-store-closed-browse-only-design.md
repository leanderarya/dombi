# Store-Closed Browse-Only Design

**Date:** 2026-07-22
**Status:** Approved

## Goal

When store is closed (operating hours outside range, holiday, or `is_closed`), users can browse products but cannot add to cart, checkout, or place orders.

## Current Gaps

| # | Path | Issue |
|---|------|-------|
| 1 | Product detail page | No `is_open` check at all — user can add to cart |
| 2 | `variant-list-item.tsx` fast-add | Button disabled but handler guard missing `isOutletClosed` |
| 3 | `CartController::addItem()` | Only checks `isOpen()` if `selected_outlet_id` in session |
| 4 | Checkout page | No guard |
| 5 | No centralized middleware | Store-open check scattered in controllers/services |

## Design

### 1. Middleware `CheckStoreOpen`

**File:** `app/Http/Middleware/CheckStoreOpen.php`

```php
class CheckStoreOpen
{
    public function handle(Request $request, Closure $next)
    {
        $outletId = session('selected_outlet_id') ?? $request->input('outlet_id');

        if (!$outletId) {
            return redirect()->back()->with('error', 'Pilih outlet terlebih dahulu.');
        }

        $outlet = Outlet::find($outletId);

        if (!$outlet || !$outlet->isOpen()) {
            return redirect()->back()->with('error', 'Toko sedang tutup. Silakan kembali saat jam operasional.');
        }

        return $next($request);
    }
}
```

**Register:** `bootstrap/app.php` — alias `store.open`

### 2. Route changes

**File:** `routes/web.php`

Extract mutation routes into `store.open` middleware group:

```php
Route::middleware(['guest.or.customer'])->group(function () {
    // Read routes — no store-open check
    Route::get('/customer', ...);
    Route::get('/customer/products', ...);
    Route::get('/customer/products/{family}', ...);

    // Mutation routes — store-open checked
    Route::middleware(['store.open'])->group(function () {
        Route::post('/customer/cart/add', ...);
        Route::post('/customer/cart/remove', ...);
        Route::post('/customer/cart/quantity', ...);
        Route::get('/customer/checkout', ...);
        Route::post('/customer/checkout', ...);
        Route::post('/customer/checkout/payment', ...);
        Route::post('/customer/orders', ...);
    });
});
```

### 3. ProductController — pass `is_open`

**File:** `app/Http/Controllers/Customer/ProductController.php`

Add `is_open` to Inertia props:

```php
$isOpen = true;
if ($outletId) {
    $outlet = Outlet::find($outletId);
    $isOpen = $outlet?->isOpen() ?? true;
}

return Inertia::render('customer/product-detail', [
    // ... existing props
    'is_open' => $isOpen,
]);
```

### 4. React: product-detail.tsx

**File:** `resources/js/pages/customer/product-detail.tsx`

- Read `is_open` from `useOutlet()` context
- Add `isOutletClosed` guard to `handleAdd()`
- Disable "Add to Cart" button, show "Toko Tutup" label

```tsx
const { selectedOutlet } = useOutlet();
const isOutletClosed = selectedOutlet?.is_open === false;

const handleAdd = () => {
    if (!selectedVariant || isOutOfStock || isOutletClosed) return;
    addToCart(selectedVariant, quantity, family.name);
};
```

### 5. React: variant-list-item.tsx fix

**File:** `resources/js/components/customer/variant-list-item.tsx`

Add `isOutletClosed` to `handleQuickAdd` guard (button already disabled, just missing handler guard):

```tsx
if (adding || isOutOfStock || isOutletClosed) {
    return;
}
```

### 6. CartController hardening

**File:** `app/Http/Controllers/Customer/CartController.php`

Remove `if ($outletId)` wrapper at line 32. Make `isOpen()` check unconditional:

```php
// Before (line 29-40):
$outletId = session('checkout.fulfillment.selected_outlet_id');
if ($outletId) {
    $outlet = Outlet::find($outletId);
    if (! $outlet || ! $outlet->isOpen()) {
        return response()->json([...], 422);
    }
}

// After:
$outletId = session('checkout.fulfillment.selected_outlet_id');
if (!$outletId) {
    return response()->json(['error' => 'Pilih outlet terlebih dahulu.'], 422);
}
$outlet = Outlet::find($outletId);
if (! $outlet || ! $outlet->isOpen()) {
    return response()->json(['error' => 'Outlet sedang tutup.'], 422);
}
```

## File Changes Summary

| File | Action |
|------|--------|
| `app/Http/Middleware/CheckStoreOpen.php` | Create |
| `bootstrap/app.php` | Register alias `store.open` |
| `routes/web.php` | Group mutation routes under `store.open` |
| `app/Http/Controllers/Customer/ProductController.php` | Pass `is_open` to view |
| `resources/js/pages/customer/product-detail.tsx` | `isOutletClosed` guard + button state |
| `resources/js/components/customer/variant-list-item.tsx` | Guard in `handleQuickAdd` |
| `app/Http/Controllers/Customer/CartController.php` | Always validate outlet open |

## Not Covered (by design)

- **Cart view/modify** — middleware already guards `setQuantity`/`removeItem`. No frontend changes needed.
- **Checkout page** — middleware guards. No extra controller check needed.
- **Beli Lagi (reorder)** — feature does not exist yet.
- **Direct API calls bypassing frontend** — middleware covers all mutation routes.