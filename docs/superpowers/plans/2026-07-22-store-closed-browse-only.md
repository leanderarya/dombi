# Store-Closed Browse-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When store is closed, users can browse products but cannot add to cart, checkout, or place orders. Middleware is single source of truth with content negotiation (fetch→409 JSON, Inertia→302 withErrors). Frontend reactively disables all UI via outlet context mutation.

**Architecture:** 1 middleware (CheckStoreOpen), 3 backend files modified, 1 new JS lib (api.ts), 4 React files modified. Dual protocol: raw fetch catches 409 JSON via mutationFetch wrapper, Inertia catches 302 errors via usePage().props.errors listener.

**Tech Stack:** Laravel 13, React 19 + Inertia, TypeScript, PHP 8.4+

---

## File Structure Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/Http/Middleware/CheckStoreOpen.php` | Create | Content negotiation: 409 JSON for fetch, 302 redirect for Inertia/full-page |
| `bootstrap/app.php` | Modify | Register `store.open` alias |
| `routes/web.php` | Modify | Group mutation routes under `store.open` middleware |
| `app/Http/Controllers/Customer/CartController.php` | Modify | Remove `isOpen()` guard (lines 29-40) — middleware handles it |
| `app/Http/Controllers/Customer/ProductController.php` | Modify | Pass `is_open` to product-detail view |
| `resources/js/contexts/outlet-context.tsx` | Modify | Add `markCurrentOutletClosed()` + Inertia `errors.outlet_closed` listener |
| `resources/js/lib/api.ts` | Create | `mutationFetch` wrapper + `registerOutletClosedHandler` registry |
| `resources/js/pages/customer/product-detail.tsx` | Modify | `isOutletClosed` guard in handleAdd, disabled button state, `mutationFetch` |
| `resources/js/components/customer/variant-list-item.tsx` | Modify | `isOutletClosed` guard in handleQuickAdd, `mutationFetch` |
| `resources/js/components/customer/size-selector-sheet.tsx` | Modify | `isOutletClosed` guard in handleAdd, `mutationFetch` |

---

### Task 1: Create CheckStoreOpen middleware

**Files:**
- Create: `app/Http/Middleware/CheckStoreOpen.php`

- [ ] **Step 1: Create the middleware file**

```php
<?php

namespace App\Http\Middleware;

use App\Models\Outlet;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckStoreOpen
{
    public function handle(Request $request, Closure $next): Response
    {
        $outletId = session('checkout.fulfillment.selected_outlet_id')
            ?? session('checkout.selected_outlet_id')
            ?? $request->input('outlet_id');

        if (! $outletId) {
            return $this->reject($request, 'Pilih outlet terlebih dahulu.');
        }

        $outlet = Outlet::find($outletId);

        if (! $outlet || ! $outlet->isOpen()) {
            return $this->reject($request, 'Toko sedang tutup. Silakan kembali saat jam operasional.');
        }

        return $next($request);
    }

    private function reject(Request $request, string $message): Response
    {
        // Raw fetch/AJAX (cart API) → 409 JSON
        if ($request->expectsJson()) {
            return response()->json([
                'error' => 'outlet_closed',
                'message' => $message,
            ], 409);
        }

        // Inertia XHR & full page nav → 302 redirect with errors bag
        return redirect()->back()->withErrors(['outlet_closed' => $message]);
    }
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la app/Http/Middleware/CheckStoreOpen.php
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Middleware/CheckStoreOpen.php
git commit -m "feat: add CheckStoreOpen middleware with content negotiation"
```

---

### Task 2: Register middleware alias

**Files:**
- Modify: `bootstrap/app.php:38-47`

- [ ] **Step 1: Add `store.open` alias**

In `bootstrap/app.php`, add to the `$middleware->alias([])` array:

```php
use App\Http\Middleware\CheckStoreOpen;

// Inside ->withMiddleware callback, add to alias array:
$middleware->alias([
    'customer.inertia' => CustomerInertiaRoot::class,
    'internal.inertia' => InternalInertiaRoot::class,
    'guest.or.customer' => AllowGuestOrCustomer::class,
    'customer.or.recovered' => AllowCustomerOrRecoveredGuest::class,
    'role' => RoleMiddleware::class,
    'password.changed' => EnsurePasswordIsChanged::class,
    'enforce.session' => EnforceSessionPolicy::class,
    'dev' => DevOnly::class,
    'store.open' => CheckStoreOpen::class,  // NEW
]);
```

- [ ] **Step 2: Verify the import**

Check that `use App\Http\Middleware\CheckStoreOpen;` is at the top of `bootstrap/app.php` with other imports.

- [ ] **Step 3: Commit**

```bash
git add bootstrap/app.php
git commit -m "feat: register store.open middleware alias"
```

---

### Task 3: Group mutation routes under store.open

**Files:**
- Modify: `routes/web.php:101-132`

- [ ] **Step 1: Extract mutation routes into store.open subgroup**

In `routes/web.php`, inside the `guest.or.customer` group (line 101), wrap mutation routes with `store.open` middleware:

```php
Route::middleware('guest.or.customer')->prefix('customer')->name('customer.')->group(function (): void {
    // --- Read routes — no store-open check ---
    Route::get('/home', CustomerHomeController::class)->name('home');
    Route::post('/fulfillment-draft', [CustomerHomeController::class, 'setFulfillmentDraft'])->name('fulfillment-draft');
    Route::post('/location', [CustomerCheckoutController::class, 'storeLocationDraft'])->name('location.store');
    Route::get('/help', fn () => Inertia::render('customer/help'))->name('help');
    Route::get('/about', fn () => Inertia::render('customer/about'))->name('about');
    Route::get('/outlets', [CustomerOutletController::class, 'index'])->name('outlets.index');
    Route::get('/products', [CustomerProductController::class, 'index'])->name('products.index');
    Route::get('/products/api', [CustomerProductApiController::class, 'index'])->name('products.api');
    Route::get('/products/{family}', [CustomerProductController::class, 'show'])->name('products.show');
    Route::get('/orders', [CustomerOrderController::class, 'index'])->name('orders.index');
    Route::get('/profile', [ProfileController::class, 'index'])->name('profile');

    // --- Mutation routes — store-open checked ---
    Route::middleware('store.open')->group(function (): void {
        Route::post('/cart/add', [CartController::class, 'addItem'])->name('cart.add');
        Route::post('/cart/remove', [CartController::class, 'removeItem'])->name('cart.remove');
        Route::post('/cart/quantity', [CartController::class, 'setQuantity'])->name('cart.quantity');
        Route::post('/select-outlet', [CartController::class, 'selectOutlet'])->name('select-outlet');
        Route::get('/checkout', [CustomerCheckoutController::class, 'index'])->name('checkout.index');
        Route::post('/checkout', [CustomerCheckoutController::class, 'storeIndex'])->name('checkout.store');
        Route::get('/checkout/customer', [CustomerCheckoutController::class, 'customer'])->name('checkout.customer');
        Route::post('/checkout/customer', [CustomerCheckoutController::class, 'storeCustomer'])->name('checkout.customer.store');
        Route::get('/checkout/customer-lookup', [CustomerCheckoutController::class, 'lookupCustomer'])->middleware('throttle:lookup')->name('checkout.customer.lookup');
        Route::get('/checkout/login-prompt', fn () => Inertia::render('customer/checkout/login-prompt'))->name('checkout.login-prompt');
        Route::get('/checkout/payment', [CustomerCheckoutController::class, 'payment'])->name('checkout.payment');
        Route::post('/checkout/payment', [CustomerCheckoutController::class, 'submit'])->middleware('throttle:payment-submit')->name('checkout.process-payment');
        Route::get('/checkout/validate-stock', [CustomerCheckoutController::class, 'validateStock'])->name('checkout.validate-stock');
        Route::get('/checkout/pickup-outlets', [CustomerCheckoutController::class, 'pickupOutlets'])->name('checkout.pickup-outlets');
        Route::post('/orders', [CustomerOrderController::class, 'store'])->name('orders.store');
        Route::get('/orders/{order}/confirmation/{token}', [CustomerOrderController::class, 'confirmation'])->name('orders.confirmation');
        Route::get('/orders/confirm/{orderCode}', [CustomerOrderController::class, 'confirm'])->name('orders.confirm');
        Route::post('/orders/recovery', GuestOrderRecoveryController::class)->middleware('throttle:recovery')->name('orders.recovery');
        Route::post('/register', [AccountPromotionController::class, 'register'])->middleware('throttle:3,1')->name('register');
    });
});
```

- [ ] **Step 2: Verify route structure with `php artisan route:list`**

```bash
php artisan route:list --path=customer | grep -E 'cart|checkout|orders'
```

Expected: cart/add, cart/remove, cart/quantity, checkout/*, orders/store all show `store.open` in middleware column.

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat: group mutation routes under store.open middleware"
```

---

### Task 4: Remove isOpen() guard from CartController

**Files:**
- Modify: `app/Http/Controllers/Customer/CartController.php:29-40`

- [ ] **Step 1: Delete the isOpen() guard block**

In `CartController::addItem()`, remove lines 29-40 (the `if ($outletId)` wrapper that checks `isOpen()`). Keep the `$outletId` variable assignment since it's used for stock lookup on lines 42-46.

**Before (lines 28-40):**
```php
        // Get outlet from session
        $outletId = session('checkout.fulfillment.selected_outlet_id');

        // Validate outlet is open
        if ($outletId) {
            $outlet = Outlet::find($outletId);
            if (! $outlet || ! $outlet->isOpen()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Outlet sedang tutup. Silakan pilih outlet lain.',
                ], 422);
            }
        }
```

**After:**
```php
        // Get outlet from session
        $outletId = session('checkout.fulfillment.selected_outlet_id');
```

The `$outletId` variable is still needed for:
- Line 45: `->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))`
- Line 75: `$cart = $request->session()->get('checkout.cart', []);`

- [ ] **Step 2: Remove unused `use App\Models\Outlet;` import if no longer needed**

Check if `Outlet` is used elsewhere in CartController. If the import was only for the removed guard, delete it.

```bash
grep -n "Outlet" app/Http/Controllers/Customer/CartController.php
```

If only found in the removed block and the import line, remove both.

- [ ] **Step 3: Run cart-related tests**

```bash
php artisan test --filter=Cart
```

Expected: all pass. Middleware guards the route now; controller no longer duplicates.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/CartController.php
git commit -m "refactor: remove isOpen() guard from CartController — middleware handles it"
```

---

### Task 5: Pass is_open from ProductController

**Files:**
- Modify: `app/Http/Controllers/Customer/ProductController.php:78-83`

- [ ] **Step 1: Add is_open to Inertia props**

In `ProductController::show()`, after line 77 (the `otherFamilies` query), add `is_open` computation:

```php
use App\Models\Outlet;

// After line 77 ($otherFamilies = ...):
$isOpen = true;
if ($outletId) {
    $outlet = Outlet::find($outletId);
    $isOpen = $outlet?->isOpen() ?? true;
}

return Inertia::render('customer/product-detail', [
    'family' => $family,
    'otherFamilies' => $otherFamilies,
    'outletId' => $outletId,
    'is_open' => $isOpen,  // NEW
]);
```

- [ ] **Step 2: Verify the import**

Add `use App\Models\Outlet;` at the top of the file if not already present.

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Customer/ProductController.php
git commit -m "feat: pass is_open to product-detail view"
```

---

### Task 6: Add markCurrentOutletClosed + Inertia error listener to outlet context

**Files:**
- Modify: `resources/js/contexts/outlet-context.tsx`

- [ ] **Step 1: Add `markCurrentOutletClosed` to the context type**

Add to `OutletContextValue` interface (after `retry`):

```tsx
type OutletContextValue = {
    selectedOutlet: OutletOption | null;
    selectManual: (outlet: OutletOption) => void;
    outlets: OutletOption[];
    loading: boolean;
    error: string | null;
    retry: () => void;
    markCurrentOutletClosed: () => void;  // NEW
};
```

- [ ] **Step 2: Add `markCurrentOutletClosed` implementation inside OutletProvider**

Add after the `retry` useCallback (around line 195):

```tsx
const markCurrentOutletClosed = useCallback(() => {
    setOutlets(prev =>
        prev.map(o =>
            o.id === selectedOutlet?.id ? { ...o, is_open: false } : o
        )
    );
}, [selectedOutlet?.id]);
```

- [ ] **Step 3: Add Inertia error listener inside OutletProvider**

Add import at top:
```tsx
import { usePage } from '@inertiajs/react';
```

Add after `markCurrentOutletClosed` definition:

```tsx
// Watch for Inertia session errors (checkout/order routes redirect with outlet_closed)
const { errors } = usePage().props;

useEffect(() => {
    if (errors?.outlet_closed) {
        markCurrentOutletClosed();
    }
}, [errors?.outlet_closed, markCurrentOutletClosed]);
```

- [ ] **Step 4: Include `markCurrentOutletClosed` in context value**

Add to the `useMemo` value object (around line 199):

```tsx
const value = useMemo<OutletContextValue>(
    () => ({
        selectedOutlet,
        selectManual,
        outlets,
        loading,
        error,
        retry,
        markCurrentOutletClosed,  // NEW
    }),
    [selectedOutlet, selectManual, outlets, loading, error, retry, markCurrentOutletClosed],
);
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors related to outlet-context.tsx.

- [ ] **Step 6: Commit**

```bash
git add resources/js/contexts/outlet-context.tsx
git commit -m "feat: add markCurrentOutletClosed + Inertia error listener to outlet context"
```

---

### Task 7: Create mutationFetch API wrapper

**Files:**
- Create: `resources/js/lib/api.ts`

- [ ] **Step 1: Create the API wrapper**

```ts
// lib/api.ts

let outletClosedHandler: (() => void) | null = null;

export function registerOutletClosedHandler(fn: () => void): void {
    outletClosedHandler = fn;
}

export async function mutationFetch(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
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
        } catch {
            // Non-JSON response — ignore
        }
    }

    return res;
}
```

- [ ] **Step 2: Register handler in OutletProvider**

In `resources/js/contexts/outlet-context.tsx`, after the `markCurrentOutletClosed` definition, add:

```tsx
import { registerOutletClosedHandler } from '@/lib/api';

// Inside OutletProvider, after markCurrentOutletClosed:
useEffect(() => {
    registerOutletClosedHandler(markCurrentOutletClosed);
}, [markCurrentOutletClosed]);
```

- [ ] **Step 3: Verify file exists**

```bash
ls -la resources/js/lib/api.ts
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/lib/api.ts resources/js/contexts/outlet-context.tsx
git commit -m "feat: add mutationFetch wrapper with outlet_closed handler registration"
```

---

### Task 8: Update product-detail.tsx

**Files:**
- Modify: `resources/js/pages/customer/product-detail.tsx`

- [ ] **Step 1: Add imports**

Add to imports at top (after existing `useCart` import):

```tsx
import { useOutlet } from '@/contexts/outlet-context';
import { mutationFetch } from '@/lib/api';
```

- [ ] **Step 2: Add isOutletClosed guard in useAddToCart hook**

In the `useAddToCart` function (line 59), add `useOutlet` and `isOutletClosed`:

```tsx
function useAddToCart() {
    const cart = useCart();
    const { totalItems } = cart;
    const { selectedOutlet } = useOutlet();
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    const [toast, setToast] = useState<{ name: string; qty: number } | null>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    const isOutletClosed = selectedOutlet?.is_open === false;

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const addToCart = useCallback(
        async (variant: Variant, qty: number, familyName: string) => {
            if (adding || added || isOutletClosed) {
                return;
            }

            setAdding(true);
            cart.addItem(variant.id, qty, variant.selling_price);

            try {
                const res = await mutationFetch('/customer/cart/add', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-TOKEN': getCsrfToken(),
                    },
                    body: JSON.stringify({
                        product_variant_id: variant.id,
                        quantity: qty,
                    }),
                });
                await res.json();
            } catch {
                /* frontend cart already updated */
            }

            setAdding(false);
            setAdded(true);
            setToast({ name: variant.name ?? familyName, qty });

            timers.current.push(setTimeout(() => setAdded(false), 1500));
            timers.current.push(setTimeout(() => setToast(null), 2500));
        },
        [cart, adding, added, isOutletClosed],
    );

    return { addToCart, adding, added, toast, totalItems };
}
```

- [ ] **Step 3: Update the AddToCartBar component to disable when outlet closed**

Find the `AddToCartBar` component (around line 677). It receives `isOutOfStock` prop. Add `isOutletClosed`:

```tsx
// Props interface (around line 683):
interface AddToCartBarProps {
    // ... existing props
    isOutOfStock: boolean;
    isOutletClosed: boolean;  // NEW
    onAdd: () => void;
    // ...
}

// In the component, update the button:
<button
    onClick={onAdd}
    disabled={adding || isOutOfStock || isOutletClosed || added}
    className={...}
>
    {isOutletClosed ? (
        <>
            <ClockIcon className="h-5 w-5" />
            Toko Tutup
        </>
    ) : isOutOfStock ? (
        // ... existing out-of-stock UI
    ) : (
        // ... existing add-to-cart UI
    )}
</button>
```

- [ ] **Step 4: Pass isOutletClosed to AddToCartBar**

In the `ProductDetailInner` component (line 133), where `AddToCartBar` is rendered (around line 407):

```tsx
const { selectedOutlet } = useOutlet();
const isOutletClosed = selectedOutlet?.is_open === false;

// Pass to AddToCartBar:
<AddToCartBar
    // ... existing props
    isOutOfStock={isOutOfStock}
    isOutletClosed={isOutletClosed}  // NEW
    onAdd={handleAdd}
    // ...
/>
```

- [ ] **Step 5: Update handleAdd guard**

In `ProductDetailInner` (line 223):

```tsx
const handleAdd = () => {
    if (!selectedVariant || isOutOfStock || isOutletClosed) {
        return;
    }

    addToCart(selectedVariant, quantity, family.name);
    setQuantity(1);
};
```

- [ ] **Step 6: Verify TypeScript compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i product-detail | head -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/customer/product-detail.tsx
git commit -m "feat: add outlet-closed guard + mutationFetch to product-detail"
```

---

### Task 9: Update variant-list-item.tsx

**Files:**
- Modify: `resources/js/components/customer/variant-list-item.tsx`

- [ ] **Step 1: Add isOutletClosed to handleQuickAdd guard**

In `handleQuickAdd` (line 79), add `isOutletClosed` to the early return:

```tsx
const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (adding || isOutOfStock || isOutletClosed) {
        return;
    }

    // ... rest of function
```

Note: `isOutletClosed` is already defined at line 54. Just add it to the guard.

- [ ] **Step 2: Replace raw fetch with mutationFetch**

Add import at top:
```tsx
import { mutationFetch } from '@/lib/api';
```

Replace the `fetch` call (lines 100-112):

```tsx
// Before:
await fetch('/customer/cart/add', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
    },
    body: JSON.stringify({
        product_variant_id: variant.id,
        quantity: 1,
    }),
    credentials: 'same-origin',
});

// After:
await mutationFetch('/customer/cart/add', {
    method: 'POST',
    headers: {
        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
    },
    body: JSON.stringify({
        product_variant_id: variant.id,
        quantity: 1,
    }),
});
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i variant-list-item | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/customer/variant-list-item.tsx
git commit -m "feat: add outlet-closed guard + mutationFetch to variant-list-item"
```

---

### Task 10: Update size-selector-sheet.tsx

**Files:**
- Modify: `resources/js/components/customer/size-selector-sheet.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useOutlet } from '@/contexts/outlet-context';
import { mutationFetch } from '@/lib/api';
```

- [ ] **Step 2: Add isOutletClosed guard**

In the component function, add:

```tsx
const { selectedOutlet } = useOutlet();
const isOutletClosed = selectedOutlet?.is_open === false;
```

In `handleAdd` (line 66), add to the guard:

```tsx
const handleAdd = async () => {
    if (!selectedVariant || adding || isOutOfStock || isOutletClosed) {
        return;
    }
    // ...
```

- [ ] **Step 3: Replace raw fetch with mutationFetch**

Replace the fetch call (lines 78-90):

```tsx
// Before:
const response = await fetch('/customer/cart/add', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
    },
    body: JSON.stringify({
        product_variant_id: selectedVariant.id,
        quantity,
    }),
    credentials: 'same-origin',
});

// After:
const response = await mutationFetch('/customer/cart/add', {
    method: 'POST',
    headers: {
        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
    },
    body: JSON.stringify({
        product_variant_id: selectedVariant.id,
        quantity,
    }),
});
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -i size-selector | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/customer/size-selector-sheet.tsx
git commit -m "feat: add outlet-closed guard + mutationFetch to size-selector-sheet"
```

---

### Task 11: Run full test suite

**Files:**
- None (verification only)

- [ ] **Step 1: Run PHP tests**

```bash
php artisan test
```

Expected: all 791 tests pass. If any fail, investigate — likely tests that call cart routes directly without the session key set.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build frontend**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "test: verify full suite passes after store-closed changes"
```

---

## Post-Implementation Verification

- [ ] Open `/customer/products` — pick a closed outlet (or set `is_closed = true` in DB). Quick-add button should show clock icon, be disabled, label "Outlet Tutup"
- [ ] Navigate to `/customer/products/{family}` — Add to Cart button should show "Toko Tutup", be disabled
- [ ] Try `fetch POST /customer/cart/add` directly via browser console — should get 409 `{ "error": "outlet_closed" }`
- [ ] Navigate to `/customer/checkout` — should redirect back with message "Toko sedang tutup"
- [ ] After 409 response, all outlet-selector cards should show "Tutup" label (reactive context mutation)