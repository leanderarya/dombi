# StoreLocationCard — Functional Outlet Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the StoreLocationCard on the products page functional — show real outlet data, allow outlet switching via bottom sheet, and filter products by selected outlet's inventory.

**Architecture:** API-first approach. Two new backend endpoints (`/customer/outlets`, `/customer/products?outlet_id=X`). Frontend uses React context (`OutletProvider`) backed by localStorage for persistence. Products page switches from Inertia SSR data to client-side API fetching.

**Tech Stack:** Laravel 12, React 19, TypeScript, Inertia.js, Tailwind CSS v4, lucide-react icons

## Global Constraints

- Follow existing `Dialog` component pattern for bottom sheets (see `size-selector-sheet.tsx`)
- Use `CalculatesDistance` trait for Haversine calculations (already exists in `app/Services/Concerns/CalculatesDistance.php`)
- Outlet model uses `SoftDeletes` — filter with `whereNull('deleted_at')` or `active()` scope
- `OutletInventory` tracks per-outlet stock: `current_stock - reserved_stock = available_stock`
- `OutletVariantPrice` provides per-outlet price overrides, falls back to `ProductVariant.selling_price`
- All API responses use `snake_case` keys
- Use `useCustomerLocation()` from `@/lib/customer-location` for lat/lng
- CSRF token pattern: `document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `resources/js/lib/outlet-store.ts` | localStorage persistence for selected outlet ID |
| `resources/js/contexts/outlet-context.tsx` | React context + OutletProvider (fetches outlets, manages selection) |
| `resources/js/components/customer/outlet-sheet.tsx` | Bottom sheet for picking an outlet |
| `app/Http/Controllers/Customer/CustomerOutletController.php` | `GET /customer/outlets` API endpoint |
| `app/Http/Controllers/Customer/CustomerProductApiController.php` | `GET /customer/products?outlet_id=X` API endpoint |

### Modified files
| File | Change |
|------|--------|
| `routes/web.php` | Add 2 new API routes inside customer group |
| `resources/js/components/customer/store-location-card.tsx` | Read from outlet context, make tappable, show skeleton/error states |
| `resources/js/pages/customer/products.tsx` | Remove Inertia `families` prop, fetch via API, wrap with OutletProvider |
| `app/Http/Controllers/Customer/ProductController.php` | Remove families query from `index()` (shell only) |

---

### Task 1: Outlet localStorage Store

**Files:**
- Create: `resources/js/lib/outlet-store.ts`

**Interfaces:**
- Produces: `useOutletStore()` hook returning `{ getSnapshot(): number | null, save(id: number): void, clear(): void }`
- Used by: Task 2 (OutletProvider)

- [ ] **Step 1: Create outlet-store.ts**

```typescript
// resources/js/lib/outlet-store.ts
import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'dombi_selected_outlet';

type Listener = () => void;

class OutletStore {
    private outletId: number | null = null;
    private listeners: Set<Listener> = new Set();

    constructor() {
        this.load();
    }

    getSnapshot(): number | null {
        return this.outletId;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    save(outletId: number): void {
        this.outletId = outletId;
        this.persist();
        this.notify();
    }

    clear(): void {
        this.outletId = null;
        this.persist();
        this.notify();
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private persist(): void {
        try {
            if (this.outletId === null) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.outletId));
            }
        } catch {
            // Non-critical
        }
    }

    private load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (typeof parsed === 'number') {
                    this.outletId = parsed;
                }
            }
        } catch {
            // Ignore invalid storage
        }
    }
}

const store = new OutletStore();

export function useOutletStore() {
    const outletId = useSyncExternalStore(
        (listener) => store.subscribe(listener),
        () => store.getSnapshot(),
        () => null,
    );

    const save = useCallback((id: number) => {
        store.save(id);
    }, []);

    const clear = useCallback(() => {
        store.clear();
    }, []);

    return { outletId, save, clear };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep outlet-store`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/lib/outlet-store.ts
git commit -m "feat: add outlet localStorage store for selected outlet persistence"
```

---

### Task 2: Outlet Context + Provider

**Files:**
- Create: `resources/js/contexts/outlet-context.tsx`

**Interfaces:**
- Consumes: `useOutletStore()` from Task 1, `useCustomerLocation()` from `@/lib/customer-location`
- Produces: `OutletProvider` component, `useOutlet()` hook returning `{ selectedOutlet, setOutlet, outlets, loading, error, retry }`
- Used by: Task 5 (OutletSheet), Task 6 (StoreLocationCard), Task 7 (Products page)

**Types produced:**
```typescript
type OutletOption = {
    id: number;
    name: string;
    address: string;
    kelurahan?: string | null;
    kecamatan?: string | null;
    phone?: string | null;
    distance_km?: number | null;
    stock_available: boolean;
};

type OutletContextValue = {
    selectedOutlet: OutletOption | null;
    setOutlet: (outlet: OutletOption) => void;
    outlets: OutletOption[];
    loading: boolean;
    error: string | null;
    retry: () => void;
};
```

- [ ] **Step 1: Create outlet-context.tsx**

```typescript
// resources/js/contexts/outlet-context.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useOutletStore } from '@/lib/outlet-store';
import { useCustomerLocation } from '@/lib/customer-location';

export type OutletOption = {
    id: number;
    name: string;
    address: string;
    kelurahan?: string | null;
    kecamatan?: string | null;
    phone?: string | null;
    distance_km?: number | null;
    stock_available: boolean;
};

type OutletContextValue = {
    selectedOutlet: OutletOption | null;
    setOutlet: (outlet: OutletOption) => void;
    outlets: OutletOption[];
    loading: boolean;
    error: string | null;
    retry: () => void;
};

const OutletContext = createContext<OutletContextValue | null>(null);

export function useOutlet(): OutletContextValue {
    const ctx = useContext(OutletContext);
    if (!ctx) {
        throw new Error('useOutlet must be used within OutletProvider');
    }
    return ctx;
}

export default function OutletProvider({ children }: { children: ReactNode }) {
    const { outletId, save, clear } = useOutletStore();
    const { location } = useCustomerLocation();
    const [outlets, setOutlets] = useState<OutletOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);
    const abortRef = useRef<AbortController | null>(null);

    // Fetch outlets when location changes or retry is triggered
    useEffect(() => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (location?.latitude !== undefined) {
            params.set('latitude', String(location.latitude));
        }
        if (location?.longitude !== undefined) {
            params.set('longitude', String(location.longitude));
        }

        fetch(`/customer/outlets?${params.toString()}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to load outlets');
                return res.json();
            })
            .then((data) => {
                if (!controller.signal.aborted) {
                    setOutlets(data.outlets ?? []);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setError('Gagal memuat outlet');
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [location?.latitude, location?.longitude, fetchKey]);

    // Auto-select logic: localStorage → nearest → null
    const selectedOutlet = useMemo(() => {
        if (outlets.length === 0) return null;

        // 1. Try localStorage saved ID
        if (outletId !== null) {
            const saved = outlets.find((o) => o.id === outletId);
            if (saved) return saved;
        }

        // 2. Auto-select first (nearest by distance or first alphabetically)
        return null;
    }, [outlets, outletId]);

    // Persist default selection when none saved
    useEffect(() => {
        if (outlets.length > 0 && outletId === null) {
            save(outlets[0].id);
        } else if (outlets.length > 0 && outletId !== null && !outlets.some((o) => o.id === outletId)) {
            // Saved outlet no longer exists — reset to nearest
            save(outlets[0].id);
        }
    }, [outlets, outletId, save]);

    const setOutlet = useCallback((outlet: OutletOption) => {
        save(outlet.id);
    }, [save]);

    const retry = useCallback(() => {
        setFetchKey((k) => k + 1);
    }, []);

    const value = useMemo<OutletContextValue>(() => ({
        selectedOutlet,
        setOutlet,
        outlets,
        loading,
        error,
        retry,
    }), [selectedOutlet, setOutlet, outlets, loading, error, retry]);

    return (
        <OutletContext.Provider value={value}>
            {children}
        </OutletContext.Provider>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep outlet-context`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/contexts/outlet-context.tsx
git commit -m "feat: add OutletProvider context for outlet selection state"
```

---

### Task 3: Backend API — GET /customer/outlets

**Files:**
- Create: `app/Http/Controllers/Customer/CustomerOutletController.php`
- Modify: `routes/web.php` (add route inside customer group at line ~92)

**Interfaces:**
- Consumes: `Outlet` model, `CalculatesDistance` trait from `OutletAssignmentService`
- Produces: `GET /customer/outlets?latitude=X&longitude=Y` returning `{ outlets: OutletOption[] }`
- Used by: Task 2 (OutletProvider fetches this endpoint)

- [ ] **Step 1: Create CustomerOutletController.php**

```php
<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Services\Concerns\CalculatesDistance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerOutletController extends Controller
{
    use CalculatesDistance;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $latitude = isset($validated['latitude']) ? (float) $validated['latitude'] : null;
        $longitude = isset($validated['longitude']) ? (float) $validated['longitude'] : null;

        $outlets = Outlet::query()
            ->active()
            ->whereNull('deleted_at')
            ->get();

        $result = $outlets->map(function (Outlet $outlet) use ($latitude, $longitude): array {
            $distanceKm = null;

            if ($latitude !== null && $longitude !== null && $outlet->latitude !== null && $outlet->longitude !== null) {
                $distanceKm = round($this->calculateDistance(
                    $latitude,
                    $longitude,
                    (float) $outlet->latitude,
                    (float) $outlet->longitude,
                ), 2);
            }

            $hasStock = $outlet->inventories()
                ->where('is_active', true)
                ->whereRaw('current_stock - reserved_stock > 0')
                ->exists();

            return [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'address' => $outlet->address,
                'kelurahan' => $outlet->kelurahan,
                'kecamatan' => $outlet->kecamatan,
                'phone' => $outlet->phone,
                'distance_km' => $distanceKm,
                'stock_available' => $hasStock,
            ];
        });

        // Sort: by distance if available, otherwise by name
        if ($latitude !== null && $longitude !== null) {
            $result = $result->sortBy('distance_km')->values();
        } else {
            $result = $result->sortBy('name')->values();
        }

        return response()->json(['outlets' => $result]);
    }
}
```

- [ ] **Step 2: Add route to web.php**

Open `routes/web.php` and add after line 94 (after the products routes), inside the `Route::middleware('guest.or.customer')->prefix('customer')` group:

```php
Route::get('/outlets', [CustomerOutletController::class, 'index'])->name('outlets.index');
```

Add the import at the top of the file (near line 16):

```php
use App\Http\Controllers\Customer\CustomerOutletController;
```

- [ ] **Step 3: Verify route is registered**

Run: `php artisan route:list --name=customer.outlets`
Expected: Shows `GET customer/outlets` route

- [ ] **Step 4: Test endpoint manually**

Run: `php artisan tinker --execute="echo json_encode(App\Models\Outlet::active()->count());"`
Expected: Number > 0 (active outlets exist)

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/CustomerOutletController.php routes/web.php
git commit -m "feat: add GET /customer/outlets API endpoint with distance and stock"
```

---

### Task 4: Backend API — GET /customer/products (outlet-scoped)

**Files:**
- Create: `app/Http/Controllers/Customer/CustomerProductApiController.php`
- Modify: `routes/web.php` (add route)

**Interfaces:**
- Consumes: `ProductFamily`, `ProductVariant`, `OutletInventory`, `OutletVariantPrice` models
- Produces: `GET /customer/products?outlet_id=X` returning `{ families: FamilyWithOutletStock[] }`
- Used by: Task 7 (Products page fetches this endpoint)

**Response shape:**
```json
{
  "families": [
    {
      "id": 1,
      "name": "Kopi Susu",
      "brand": "Dombi",
      "description": "...",
      "image_url": "...",
      "variants": [
        { "id": 1, "name": "Regular", "flavor": "Original", "size": "250ml", "price": 25000, "sku": "KS-R", "available_stock": 5, "is_active": true }
      ]
    }
  ]
}
```

- [ ] **Step 1: Create CustomerProductApiController.php**

```php
<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\ProductFamily;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerProductApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'outlet_id' => ['nullable', 'integer', 'exists:outlets,id'],
        ]);

        $outletId = $validated['outlet_id'] ?? null;

        $families = ProductFamily::query()
            ->where('is_active', true)
            ->with(['variants' => function ($query) use ($outletId) {
                $query->where('is_active', true)->orderBy('name');

                if ($outletId) {
                    $query->with(['inventories' => function ($inv) use ($outletId) {
                        $inv->where('outlet_id', $outletId)->where('is_active', true);
                    }]);
                    $query->with(['outletPrices' => function ($price) use ($outletId) {
                        $price->where('outlet_id', $outletId);
                    }]);
                }
            }])
            ->orderBy('name')
            ->get();

        $result = $families->map(function ($family) use ($outletId) {
            $variants = $family->variants->map(function ($variant) use ($outletId) {
                // Calculate outlet-specific stock
                $availableStock = 0;
                if ($outletId && $variant->relationLoaded('inventories')) {
                    $availableStock = (int) $variant->inventories->sum(
                        fn ($inv) => $inv->current_stock - $inv->reserved_stock
                    );
                } elseif (!$outletId && $variant->relationLoaded('inventories')) {
                    // No outlet: sum across all outlets
                    $availableStock = (int) $variant->inventories->sum(
                        fn ($inv) => $inv->current_stock - $inv->reserved_stock
                    );
                }

                // Calculate outlet-specific price
                $price = (float) $variant->selling_price;
                if ($outletId && $variant->relationLoaded('outletPrices')) {
                    $override = $variant->outletPrices->first();
                    if ($override) {
                        $price = (float) $override->selling_price;
                    }
                }

                return [
                    'id' => $variant->id,
                    'name' => $variant->name,
                    'flavor' => $variant->flavor,
                    'size' => $variant->size,
                    'price' => $price,
                    'sku' => $variant->sku,
                    'available_stock' => $availableStock,
                    'is_active' => $variant->is_active,
                ];
            });

            return [
                'id' => $family->id,
                'name' => $family->name,
                'brand' => $family->brand,
                'description' => $family->description,
                'image_url' => $family->image_url,
                'variants' => $variants->values(),
            ];
        });

        return response()->json(['families' => $result]);
    }
}
```

- [ ] **Step 2: Add route to web.php**

Add inside the customer route group (near the products routes):

```php
Route::get('/products/api', [CustomerProductApiController::class, 'index'])->name('products.api');
```

Add the import:

```php
use App\Http\Controllers\Customer\CustomerProductApiController;
```

- [ ] **Step 3: Verify route**

Run: `php artisan route:list --name=customer.products.api`
Expected: Shows `GET customer/products/api` route

- [ ] **Step 4: Verify ProductFamily has `image_url` attribute**

Run: `grep -n "image_url\|getImageUrl" /Users/aryaajisadda/Herd/dombi/app/Models/ProductFamily.php | head -5`

If `image_url` is not a column, check if it's an accessor. Adjust the controller to use `$family->image` or `$family->getImageUrl()` as appropriate.

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/CustomerProductApiController.php routes/web.php
git commit -m "feat: add GET /customer/products API with outlet-scoped stock and pricing"
```

---

### Task 5: OutletSheet Component

**Files:**
- Create: `resources/js/components/customer/outlet-sheet.tsx`

**Interfaces:**
- Consumes: `useOutlet()` from Task 2, `Dialog` from `@/components/ui/dialog`
- Produces: `OutletSheet` component with props `{ open: boolean, onClose: () => void }`
- Used by: Task 6 (StoreLocationCard opens this sheet)

- [ ] **Step 1: Create outlet-sheet.tsx**

```tsx
// resources/js/components/customer/outlet-sheet.tsx
import { Check, MapPin } from 'lucide-react';
import Dialog from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useOutlet, type OutletOption } from '@/contexts/outlet-context';

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function OutletSheet({ open, onClose }: Props) {
    const { selectedOutlet, setOutlet, outlets, loading, error, retry } = useOutlet();

    const handleSelect = (outlet: OutletOption) => {
        setOutlet(outlet);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} title="Pilih Outlet">
            <div className="space-y-1 -mx-5 -mb-4">
                {/* Loading state */}
                {loading && (
                    <div className="space-y-3 px-5 py-2">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-4 w-2/3" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-4 w-12" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Error state */}
                {!loading && error && (
                    <div className="px-5 py-6 text-center">
                        <p className="text-sm text-text-muted mb-3">{error}</p>
                        <button
                            type="button"
                            onClick={retry}
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white active:opacity-80"
                        >
                            Coba Lagi
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && outlets.length === 0 && (
                    <div className="px-5 py-6 text-center">
                        <MapPin className="mx-auto h-8 w-8 text-text-subtle mb-2" />
                        <p className="text-sm text-text-muted">Tidak ada outlet tersedia</p>
                    </div>
                )}

                {/* Outlet list */}
                {!loading && !error && outlets.length > 0 && (
                    <div className="max-h-[60vh] overflow-y-auto">
                        {outlets.map((outlet) => {
                            const isSelected = selectedOutlet?.id === outlet.id;

                            return (
                                <button
                                    key={outlet.id}
                                    type="button"
                                    onClick={() => handleSelect(outlet)}
                                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors active:bg-surface-muted ${
                                        isSelected ? 'bg-emerald-50' : ''
                                    }`}
                                >
                                    {/* Check indicator */}
                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                        isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-border'
                                    }`}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>

                                    {/* Outlet info */}
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold text-text truncate">{outlet.name}</div>
                                        <div className="text-[11px] text-text-muted truncate">{outlet.address}</div>
                                    </div>

                                    {/* Distance + stock */}
                                    <div className="shrink-0 text-right">
                                        {outlet.distance_km !== null && outlet.distance_km !== undefined && (
                                            <div className="text-xs font-medium tabular-nums text-text-muted">
                                                {outlet.distance_km.toFixed(1)} km
                                            </div>
                                        )}
                                        <div className={`text-[10px] font-semibold ${
                                            outlet.stock_available ? 'text-emerald-600' : 'text-amber-600'
                                        }`}>
                                            {outlet.stock_available ? 'Tersedia' : 'Terbatas'}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </Dialog>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep outlet-sheet`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/customer/outlet-sheet.tsx
git commit -m "feat: add OutletSheet bottom sheet for outlet selection"
```

---

### Task 6: StoreLocationCard — Make Functional

**Files:**
- Modify: `resources/js/components/customer/store-location-card.tsx`

**Interfaces:**
- Consumes: `useOutlet()` from Task 2, `OutletSheet` from Task 5
- Produces: Tappable card showing selected outlet, opens OutletSheet
- Used by: Task 7 (Products page renders this)

- [ ] **Step 1: Rewrite store-location-card.tsx**

```tsx
// resources/js/components/customer/store-location-card.tsx
import { Store, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useOutlet } from '@/contexts/outlet-context';
import { useCustomerLocation } from '@/lib/customer-location';
import OutletSheet from '@/components/customer/outlet-sheet';
import LocationSheet from '@/components/customer/location-sheet';

export default function StoreLocationCard() {
    const { selectedOutlet, loading, error, retry } = useOutlet();
    const { summary: locationSummary } = useCustomerLocation();
    const [outletSheetOpen, setOutletSheetOpen] = useState(false);
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);

    // Loading skeleton
    if (loading && !selectedOutlet) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-4" />
            </div>
        );
    }

    // Error state
    if (error && !selectedOutlet) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm">
                <span className="text-xs text-text-muted">{error}</span>
                <button
                    type="button"
                    onClick={retry}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white active:opacity-80"
                >
                    Coba Lagi
                </button>
            </div>
        );
    }

    // No outlet available
    if (!selectedOutlet) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>Tidak ada outlet tersedia</span>
                </div>
            </div>
        );
    }

    const distanceText = selectedOutlet.distance_km !== null && selectedOutlet.distance_km !== undefined
        ? `${selectedOutlet.distance_km.toFixed(1)} km`
        : null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOutletSheetOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-white p-3.5 shadow-sm text-left active:bg-surface-muted transition-colors"
            >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
                    <Store className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-text">{selectedOutlet.name}</div>
                    <div className="text-[11px] text-text-muted">
                        {distanceText ? (
                            <>{distanceText} · <span className="font-semibold text-primary">Terdekat</span></>
                        ) : locationSummary ? (
                            <span>{locationSummary}</span>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLocationSheetOpen(true);
                                }}
                                className="font-semibold text-primary"
                            >
                                Atur lokasi
                            </button>
                        )}
                    </div>
                </div>
                <svg className="h-4 w-4 shrink-0 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </button>

            <OutletSheet open={outletSheetOpen} onClose={() => setOutletSheetOpen(false)} />
            <LocationSheet open={locationSheetOpen} onClose={() => setLocationSheetOpen(false)} />
        </>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep store-location-card`
Expected: No output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/customer/store-location-card.tsx
git commit -m "feat: StoreLocationCard reads from outlet context, tappable with sheet"
```

---

### Task 7: Products Page — API-Driven with Outlet Context

**Files:**
- Modify: `resources/js/pages/customer/products.tsx`
- Modify: `app/Http/Controllers/Customer/ProductController.php`

**Interfaces:**
- Consumes: `OutletProvider` from Task 2, `useOutlet()` hook, `GET /customer/products?outlet_id=X` from Task 4
- Produces: Products page that fetches products based on selected outlet

**Key changes:**
1. Remove `families` from Inertia props interface
2. Add `OutletProvider` wrapper
3. Fetch products via API when `selectedOutlet` changes
4. AbortController for race conditions
5. Client-side product caching per outlet

- [ ] **Step 1: Update ProductController.php to not pass families**

```php
// app/Http/Controllers/Customer/ProductController.php
public function index(): Response
{
    return Inertia::render('customer/products');
}
```

Remove the `$families` query — products are now fetched via the API endpoint.

- [ ] **Step 2: Update products.tsx — replace Inertia props with API fetch**

The key changes to `resources/js/pages/customer/products.tsx`:

1. Remove `interface Props { families: Family[] }` and `families` prop
2. Remove `import { useCustomerLocation }` (no longer needed directly — OutletProvider handles it)
3. Add imports for `useOutlet` and `OutletProvider`
4. Replace static `families` with `useState<Family[]>([])` + API fetch
5. Add `OutletProvider` wrapper in JSX

Replace the top section (lines 1-70 approximately) with:

```tsx
import { Head } from '@inertiajs/react';
import { Search, ThumbsUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CustomerBottomNav from '@/components/customer/bottom-nav';
import CustomerLocationBootstrap from '@/components/customer/customer-location-bootstrap';
import ForeGreenHeader from '@/components/customer/fore-green-header';
import FulfillmentToggle from '@/components/customer/fulfillment-toggle';
import SizeSelectorSheet from '@/components/customer/size-selector-sheet';
import StoreLocationCard from '@/components/customer/store-location-card';
import VariantListItem from '@/components/customer/variant-list-item';
import FilterChips from '@/components/ui/filter-chips';
import { Skeleton } from '@/components/ui/skeleton';
import OutletProvider, { useOutlet } from '@/contexts/outlet-context';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { sizeToMl } from '@/lib/size';
import FavoritesProvider from '@/providers/favorites-provider';

interface Variant {
    id: number;
    name: string;
    flavor: string | null;
    size: string | null;
    price: number;  // was selling_price, now outlet-scoped price
    is_active: boolean;
    available_stock?: number;
    stock_status?: string;
}

interface Family {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    variants: Variant[];
}

// ... (FlavorGroup, FamilySection interfaces remain the same)
```

Replace the component function:

```tsx
function ProductsInner() {
    const { selectedOutlet, loading: outletLoading } = useOutlet();
    const [families, setFamilies] = useState<Family[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetVariants, setSheetVariants] = useState<Variant[]>([]);
    const [sheetFlavorName, setSheetFlavorName] = useState('');
    const [sheetFamilyName, setSheetFamilyName] = useState('');
    const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
    const abortRef = useRef<AbortController | null>(null);
    const cacheRef = useRef<Map<number, Family[]>>(new Map());

    useFlashToast();
    const scrollRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Fetch products when selected outlet changes
    const fetchProducts = useCallback((outletId: number | null) => {
        // Check cache first
        const cacheKey = outletId ?? 0;
        if (cacheRef.current.has(cacheKey)) {
            setFamilies(cacheRef.current.get(cacheKey)!);
            setProductsLoading(false);
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setProductsLoading(true);

        const params = new URLSearchParams();
        if (outletId) {
            params.set('outlet_id', String(outletId));
        }

        fetch(`/customer/products?${params.toString()}`, {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'same-origin',
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to load products');
                return res.json();
            })
            .then((data) => {
                if (!controller.signal.aborted) {
                    const fetched = data.families ?? [];
                    cacheRef.current.set(cacheKey, fetched);
                    setFamilies(fetched);
                    setProductsLoading(false);
                }
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setProductsLoading(false);
                }
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!outletLoading && selectedOutlet) {
            fetchProducts(selectedOutlet.id);
        }
    }, [selectedOutlet, outletLoading, fetchProducts]);

    // ... rest of the component (filterOptions, filteredFamilies, familySections, etc.)

    const loading = outletLoading || productsLoading;

    // ... JSX remains the same structure
}

export default function Products() {
    return (
        <FavoritesProvider>
            <OutletProvider>
                <Head title="Produk" />
                <CustomerLocationBootstrap />
                <ProductsInner />
            </OutletProvider>
        </FavoritesProvider>
    );
}
```

- [ ] **Step 3: Update Variant interface — `selling_price` → `price`**

In the `familySections` useMemo, change all references from `v.selling_price` to `v.price`. This includes:
- `sortedByPrice` sort: `(a, b) => a.price - b.price`
- `lowestPrice`: `sortedByPrice[0]?.price ?? 0`
- `formatCurrency(variant.selling_price)` → `formatCurrency(variant.price)`

- [ ] **Step 4: Update VariantListItem price references**

Check `resources/js/components/customer/variant-list-item.tsx` — if it uses `selling_price`, either:
- Change it to accept `price` prop instead, or
- Map `price` to `selling_price` when passing props

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "products|variant-list-item"`
Expected: No output (no errors)

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/customer/products.tsx app/Http/Controllers/Customer/ProductController.php
git commit -m "feat: products page fetches outlet-scoped data via API"
```

---

### Task 8: Integration Test — Full Flow

- [ ] **Step 1: Start dev server**

Run: `php artisan serve & npm run dev`

- [ ] **Step 2: Visit products page**

Navigate to `/customer/products` in browser.

Verify:
- [ ] Green header extends to Dynamic Island area
- [ ] StoreLocationCard shows a real outlet name (not "Outlet Dombi")
- [ ] StoreLocationCard shows distance if location is set
- [ ] Product list loads with stock badges
- [ ] Products show outlet-specific prices

- [ ] **Step 3: Test outlet switching**

- [ ] Tap StoreLocationCard → OutletSheet opens
- [ ] See list of outlets with distances and stock status
- [ ] Tap a different outlet → sheet closes
- [ ] Product list refreshes with new outlet's data
- [ ] Stock badges update ("Habis" if outlet has no stock for a variant)

- [ ] **Step 4: Test persistence**

- [ ] Refresh the page → same outlet is still selected
- [ ] Close browser tab, reopen → same outlet persists

- [ ] **Step 5: Test edge cases**

- [ ] No location set → outlets show without distance, sorted by name
- [ ] Tap "Atur lokasi" → LocationSheet opens
- [ ] After setting location → outlets re-sort by distance

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: StoreLocationCard functional outlet selection complete"
```
