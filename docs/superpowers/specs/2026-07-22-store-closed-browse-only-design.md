# Store-Closed Browse-Only Design

**Date:** 2026-07-22
**Status:** Revised (v2 — content negotiation, single source of truth, reactive frontend)

## Goal

When store is closed (operating hours outside range, holiday, or `is_closed`), users can browse products but cannot add to cart, checkout, or place orders.

## Architecture Principles

1. **Middleware is single source of truth** — controller/services do NOT duplicate `isOpen()` checks
2. **Content negotiation** — middleware returns JSON for API calls, redirect for full page nav
3. **Reactive frontend** — 409 response updates outlet context, instantly disabling all UI

## Design

### 1. Middleware `CheckStoreOpen` — content negotiation

**File:** `app/Http/Middleware/CheckStoreOpen.php`

```php
class CheckStoreOpen
{
    public function handle(Request $request, Closure $next): Response
    {
        $outletId = session('checkout.fulfillment.selected_outlet_id')
            ?? session('checkout.selected_outlet_id')
            ?? $request->input('outlet_id');

        if (!$outletId) {
            return $this->reject($request, 'Pilih outlet terlebih dahulu.');
        }

        $outlet = Outlet::find($outletId);

        if (!$outlet || !$outlet->isOpen()) {
            return $this->reject($request, 'Toko sedang tutup. Silakan kembali saat jam operasional.');
        }

        return $next($request);
    }

    private function reject(Request $request, string $message): Response
    {
        // API calls (fetch/AJAX/Inertia XHR) → JSON error
        if ($request->expectsJson() || $request->header('X-Inertia')) {
            return response()->json([
                'error' => 'outlet_closed',
                'message' => $message,
            ], 409);
        }

        // Full page navigation → redirect with flash
        return redirect()->back()->with('error', $message);
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
        Route::post('/customer/cart/add', [CartController::class, 'addItem']);
        Route::post('/customer/cart/remove', [CartController::class, 'removeItem']);
        Route::post('/customer/cart/quantity', [CartController::class, 'setQuantity']);
        Route::get('/customer/checkout', [CheckoutController::class, 'index']);
        Route::post('/customer/checkout', [CheckoutController::class, 'storeIndex']);
        Route::post('/customer/checkout/payment', [CheckoutController::class, 'submit']);
        Route::post('/customer/orders', [CustomerOrderController::class, 'store']);
    });
});
```

### 3. Remove duplication — CartController

**File:** `app/Http/Controllers/Customer/CartController.php`

Remove `isOpen()` check (lines 29-40). Middleware already handles it.

```php
// Delete lines 29-40:
// $outletId = session('checkout.fulfillment.selected_outlet_id');
// if ($outletId) {
//     $outlet = Outlet::find($outletId);
//     if (! $outlet || ! $outlet->isOpen()) {
//         return response()->json([...], 422);
//     }
// }

// Keep: $outletId is still used below for stock lookup (line 42-46)
$outletId = session('checkout.fulfillment.selected_outlet_id');
```

The `$outletId` variable is still needed for stock lookup (line 42-46), just the guard is removed.

### 4. ProductController — pass `is_open`

**File:** `app/Http/Controllers/Customer/ProductController.php`

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

### 5. React: outlet context — `markClosed()`

**File:** `resources/js/contexts/outlet-context.tsx`

Add `markCurrentOutletClosed` to context value. This function updates the `outlets` array, setting `is_open: false` on the currently selected outlet, which triggers re-render of all components:

```tsx
type OutletContextValue = {
    // ... existing
    markCurrentOutletClosed: () => void;  // NEW
};

// Inside OutletProvider:
const markCurrentOutletClosed = useCallback(() => {
    setOutlets(prev =>
        prev.map(o =>
            o.id === selectedOutlet?.id ? { ...o, is_open: false } : o
        )
    );
}, [selectedOutlet?.id]);
```

### 6. React: API error interceptor

**File:** `resources/js/lib/api.ts` (create)

Centralized fetch wrapper for mutation API calls. Catches 409 `outlet_closed` and dispatches to outlet context:

```ts
// lib/api.ts
let outletClosedHandler: (() => void) | null = null;

export function registerOutletClosedHandler(fn: () => void) {
    outletClosedHandler = fn;
}

export async function mutationFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.headers ?? {}),
        },
        credentials: 'same-origin',
    });

    if (res.status === 409) {
        try {
            const body = await res.clone().json();
            if (body?.error === 'outlet_closed') {
                outletClosedHandler?.();
            }
        } catch {}
    }

    return res;
}
```

**File:** `resources/js/providers/outlet-provider.tsx` (or inline in context)

Register handler on mount:

```tsx
useEffect(() => {
    registerOutletClosedHandler(markCurrentOutletClosed);
}, [markCurrentOutletClosed]);
```

### 7. React: use `mutationFetch` in add-to-cart paths

**Files:**
- `resources/js/components/customer/variant-list-item.tsx`
- `resources/js/pages/customer/product-detail.tsx`
- `resources/js/components/customer/size-selector-sheet.tsx`

Replace raw `fetch('/customer/cart/add', ...)` with `mutationFetch('/customer/cart/add', ...)`.

### 8. React: product-detail.tsx

- Read `isOutletClosed` from `useOutlet()` context (already reactive via step 5)
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

### 9. React: variant-list-item.tsx fix

Add `isOutletClosed` to `handleQuickAdd` guard:

```tsx
if (adding || isOutOfStock || isOutletClosed) {
    return;
}
```

Button already has disabled state + clock icon + "Outlet Tutup" aria-label. Just missing handler guard.

---

## Data Flow

```
User clicks "Add to Cart" on closed store
  → React: guard blocks (isOutletClosed === true, button disabled)
  → If bypassed (devtools): fetch hits middleware
  → Middleware: returns 409 { error: "outlet_closed", message: "..." }
  → mutationFetch: catches 409, calls outletClosedHandler
  → OutletContext: markCurrentOutletClosed() → sets is_open: false
  → React: ALL components re-render, buttons disabled, labels change
```

## File Changes Summary

| # | File | Action |
|---|------|--------|
| 1 | `app/Http/Middleware/CheckStoreOpen.php` | Create — content negotiation |
| 2 | `bootstrap/app.php` | Register alias `store.open` |
| 3 | `routes/web.php` | Group mutation routes under `store.open` |
| 4 | `app/Http/Controllers/Customer/CartController.php` | Remove `isOpen()` guard (lines 29-40) |
| 5 | `app/Http/Controllers/Customer/ProductController.php` | Pass `is_open` to view |
| 6 | `resources/js/contexts/outlet-context.tsx` | Add `markCurrentOutletClosed()` |
| 7 | `resources/js/lib/api.ts` | Create — `mutationFetch` + handler registry |
| 8 | `resources/js/pages/customer/product-detail.tsx` | Guard + button state + `mutationFetch` |
| 9 | `resources/js/components/customer/variant-list-item.tsx` | Guard + `mutationFetch` |
| 10 | `resources/js/components/customer/size-selector-sheet.tsx` | `mutationFetch` |

## Not Covered (by design)

- **Cart view/modify** — middleware already guards `setQuantity`/`removeItem`. No frontend changes needed.
- **Checkout page** — middleware guards. No extra controller check needed.
- **Beli Lagi (reorder)** — feature does not exist yet.
- **Direct API calls bypassing frontend** — middleware covers all mutation routes.
- **Axios** — not added. Project uses raw `fetch`. `mutationFetch` wrapper is the interceptor.