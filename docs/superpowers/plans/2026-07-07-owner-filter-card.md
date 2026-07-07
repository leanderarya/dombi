# OwnerFilterCard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize filter card (search, tambah, outlet, alasan, kurir, date) across all owner pages using a reusable component.

**Architecture:** Create a single `OwnerFilterCard` component with conditional rendering for all 6 filter types. Each owner page passes only the props it needs — unused filters auto-hide. Status pills remain per-page.

**Tech Stack:** React, TypeScript, Inertia.js, Tailwind CSS, Lucide icons

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| CREATE | `resources/js/components/owner/owner-filter-card.tsx` | Reusable filter card component |
| MODIFY | `resources/js/pages/owner/orders/index.tsx` | Replace inline filters |
| MODIFY | `resources/js/pages/owner/deliveries/index.tsx` | Replace inline filters |
| MODIFY | `resources/js/pages/owner/exchanges/index.tsx` | Replace inline filters |
| MODIFY | `resources/js/pages/owner/restocks/index.tsx` | Add missing filters |
| MODIFY | `resources/js/pages/owner/distributions/index.tsx` | Add missing filters |
| MODIFY | `resources/js/pages/owner/returns/index.tsx` | Replace inline filters |
| MODIFY | `resources/js/pages/owner/inventories/index.tsx` | Refactor to use component |

---

## Task 1: Create OwnerFilterCard Component

**Files:**
- Create: `resources/js/components/owner/owner-filter-card.tsx`

- [ ] **Step 1: Create OwnerFilterCard component**

```tsx
import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface FilterOption {
    value: string;
    label: string;
}

interface OwnerFilterCardProps {
    searchPlaceholder?: string;
    searchValue?: string;
    onSearch?: (value: string) => void;

    tambahHref?: string;
    tambahLabel?: string;

    outletOptions?: FilterOption[];
    outletValue?: string;
    onOutletChange?: (value: string) => void;

    reasonOptions?: FilterOption[];
    reasonValue?: string;
    onReasonChange?: (value: string) => void;

    courierOptions?: FilterOption[];
    courierValue?: string;
    onCourierChange?: (value: string) => void;

    dateValue?: string;
    onDateChange?: (value: string) => void;
}

export default function OwnerFilterCard({
    searchPlaceholder,
    searchValue,
    onSearch,
    tambahHref,
    tambahLabel = 'Tambah',
    outletOptions,
    outletValue,
    onOutletChange,
    reasonOptions,
    reasonValue,
    onReasonChange,
    courierOptions,
    courierValue,
    onCourierChange,
    dateValue,
    onDateChange,
}: OwnerFilterCardProps) {
    return (
        <div className="mb-4 flex flex-wrap items-center gap-2">
            {searchPlaceholder && (
                <div className="flex items-center rounded-lg border border-border bg-surface px-2.5 py-1.5">
                    <input
                        type="text"
                        value={searchValue ?? ''}
                        onChange={(e) => onSearch?.(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="min-w-[120px] bg-transparent text-xs text-text placeholder:text-text-subtle outline-none"
                    />
                </div>
            )}

            {outletOptions && (
                <Select
                    value={outletValue ?? ''}
                    onChange={(e) => onOutletChange?.(e.target.value)}
                    className="py-1.5 text-xs"
                    options={[{ value: '', label: 'Semua Outlet' }, ...outletOptions]}
                    aria-label="Filter outlet"
                />
            )}

            {reasonOptions && (
                <Select
                    value={reasonValue ?? ''}
                    onChange={(e) => onReasonChange?.(e.target.value)}
                    className="py-1.5 text-xs"
                    options={[{ value: '', label: 'Semua Alasan' }, ...reasonOptions]}
                    aria-label="Filter alasan"
                />
            )}

            {courierOptions && (
                <Select
                    value={courierValue ?? ''}
                    onChange={(e) => onCourierChange?.(e.target.value)}
                    className="py-1.5 text-xs"
                    options={[{ value: '', label: 'Semua Kurir' }, ...courierOptions]}
                    aria-label="Filter kurir"
                />
            )}

            {dateValue !== undefined && (
                <Input
                    type="date"
                    value={dateValue}
                    onChange={(e) => onDateChange?.(e.target.value)}
                    aria-label="Filter tanggal"
                    className="py-1.5 text-xs"
                />
            )}

            <span className="flex-1" />

            {tambahHref && (
                <Link
                    href={tambahHref}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" />
                    {tambahLabel}
                </Link>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Task 2: Update Orders Page

**Files:**
- Modify: `resources/js/pages/owner/orders/index.tsx`

- [ ] **Step 1: Import OwnerFilterCard, remove unused Input import**

Add import:
```tsx
import OwnerFilterCard from '@/components/owner/owner-filter-card';
```

Remove `Input` import (line 5).

- [ ] **Step 2: Replace filter controls block (lines 53-84)**

Replace the `{/* Filter controls */}` div with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari kode..."
    searchValue={filters.search ?? ''}
    onSearch={(val) => setFilter('search', val)}
    outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
    outletValue={filters.outlet_id ?? ''}
    onOutletChange={(val) => setFilter('outlet_id', val)}
    courierOptions={couriers?.map((c: any) => ({ value: String(c.id), label: c.name }))}
    courierValue={filters.courier_id ?? ''}
    onCourierChange={(val) => setFilter('courier_id', val)}
    dateValue={filters.date ?? ''}
    onDateChange={(val) => setFilter('date', val)}
/>
```

- [ ] **Step 3: Verify page renders**

Run: Check `/owner/orders` in browser
Expected: Search, outlet, kurir, date filters visible; status pills unchanged

---

## Task 3: Update Deliveries Page

**Files:**
- Modify: `resources/js/pages/owner/deliveries/index.tsx`

- [ ] **Step 1: Import OwnerFilterCard, remove unused Select import**

Add import:
```tsx
import OwnerFilterCard from '@/components/owner/owner-filter-card';
```

Remove `Select` import (line 5).

- [ ] **Step 2: Replace filter controls block (lines 47-77)**

Replace with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari kode..."
    searchValue={filters.search ?? ''}
    onSearch={(val) => setFilter('search', val)}
    outletOptions={outlets?.map((o: any) => ({ value: String(o.id), label: o.name }))}
    outletValue={filters.outlet_id ?? ''}
    onOutletChange={(val) => setFilter('outlet_id', val)}
    courierOptions={couriers.map((c: any) => ({ value: String(c.id), label: c.name }))}
    courierValue={filters.courier_id ?? ''}
    onCourierChange={(val) => setFilter('courier_id', val)}
    dateValue={filters.date ?? ''}
    onDateChange={(val) => setFilter('date', val)}
/>
```

- [ ] **Step 3: Verify page renders**

Run: Check `/owner/deliveries` in browser
Expected: Filters render correctly

---

## Task 4: Update Exchanges Page

**Files:**
- Modify: `resources/js/pages/owner/exchanges/index.tsx`

- [ ] **Step 1: Import OwnerFilterCard, remove unused Select import**

Add import:
```tsx
import OwnerFilterCard from '@/components/owner/owner-filter-card';
```

Remove `Select` import (line 4).

- [ ] **Step 2: Replace filter controls block (lines 38-66)**

Replace with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari kode..."
    searchValue={filters.search ?? ''}
    onSearch={(val) => setFilter('search', val)}
    outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
    outletValue={filters.outlet_id ?? ''}
    onOutletChange={(val) => setFilter('outlet_id', val)}
    reasonOptions={Object.entries(reasons).map(([v, l]) => ({ value: v, label: String(l) }))}
    reasonValue={filters.reason ?? ''}
    onReasonChange={(val) => setFilter('reason', val)}
    dateValue={filters.date ?? ''}
    onDateChange={(val) => setFilter('date', val)}
/>
```

- [ ] **Step 3: Verify page renders**

Run: Check `/owner/exchanges` in browser
Expected: Search, outlet, alasan, date filters visible

---

## Task 5: Update Restocks Page

**Files:**
- Modify: `resources/js/pages/owner/restocks/index.tsx`

- [ ] **Step 1: Import OwnerFilterCard**

Add import:
```tsx
import OwnerFilterCard from '@/components/owner/owner-filter-card';
```

- [ ] **Step 2: Replace filter controls block (lines 45-57)**

Replace with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari kode..."
    searchValue={filters.search ?? ''}
    onSearch={(val) => {
        router.get('/owner/restocks', { ...filters, search: val || undefined }, { preserveState: true, replace: true });
    }}
    outletOptions={outlets?.map((o: any) => ({ value: String(o.id), label: o.name }))}
    outletValue={filters.outlet_id ?? ''}
    onOutletChange={(val) => {
        router.get('/owner/restocks', { ...filters, outlet_id: val || undefined }, { preserveState: true, replace: true });
    }}
    dateValue={filters.date ?? ''}
    onDateChange={(val) => {
        router.get('/owner/restocks', { ...filters, date: val || undefined }, { preserveState: true, replace: true });
    }}
/>
```

Note: Restocks page needs `outlets` prop added from backend. Check controller.

- [ ] **Step 3: Verify page renders**

Run: Check `/owner/restocks` in browser
Expected: Search, outlet, date filters visible alongside status tabs

---

## Task 6: Update Distributions Page

**Files:**
- Modify: `resources/js/pages/owner/distributions/index.tsx`

- [ ] **Step 1: Import OwnerFilterCard**

Add import:
```tsx
import OwnerFilterCard from '@/components/owner/owner-filter-card';
```

- [ ] **Step 2: Replace filter controls block (lines 41-53)**

Replace with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari kode..."
    searchValue={filters.search ?? ''}
    onSearch={(val) => {
        router.get('/owner/distributions', { ...filters, search: val || undefined }, { preserveState: true, replace: true });
    }}
    outletOptions={outlets?.map((o: any) => ({ value: String(o.id), label: o.name }))}
    outletValue={filters.outlet_id ?? ''}
    onOutletChange={(val) => {
        router.get('/owner/distributions', { ...filters, outlet_id: val || undefined }, { preserveState: true, replace: true });
    }}
    dateValue={filters.date ?? ''}
    onDateChange={(val) => {
        router.get('/owner/distributions', { ...filters, date: val || undefined }, { preserveState: true, replace: true });
    }}
/>
```

Note: Distributions page needs `outlets` prop added from backend. Check controller.

- [ ] **Step 3: Verify page renders**

Run: Check `/owner/distributions` in browser
Expected: Search, outlet, date filters visible alongside status tabs

---

## Task 7: Update Returns Page

**Files:**
- Modify: `resources/js/pages/owner/returns/index.tsx`

- [ ] **Step 1: Import OwnerFilterCard**

Add import:
```tsx
import OwnerFilterCard from '@/components/owner/owner-filter-card';
```

- [ ] **Step 2: Update PengembalianTab (lines 116-144)**

Replace the filter controls div with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari kode..."
    searchValue={filters.search ?? ''}
    onSearch={(val) => navigate({ search: val || undefined })}
    outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
    outletValue={filters.outlet_id ?? ''}
    onOutletChange={(val) => navigate({ outlet_id: val || undefined })}
    reasonOptions={Object.entries(reasons).map(([v, l]) => ({ value: v, label: String(l) }))}
    reasonValue={filters.reason ?? ''}
    onReasonChange={(val) => navigate({ reason: val || undefined })}
    dateValue={filters.date ?? ''}
    onDateChange={(val) => navigate({ date: val || undefined })}
/>
```

- [ ] **Step 3: Update PenukaranTab (lines 241-262)**

Replace the filter controls div with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari kode..."
    searchValue={filters.search ?? ''}
    onSearch={(val) => navigate({ search: val || undefined })}
    outletOptions={outlets.map((o: any) => ({ value: String(o.id), label: o.name }))}
    outletValue={filters.outlet_id ?? ''}
    onOutletChange={(val) => navigate({ outlet_id: val || undefined })}
    dateValue={filters.date ?? ''}
    onDateChange={(val) => navigate({ date: val || undefined })}
/>
```

- [ ] **Step 4: Remove unused Select import**

Remove `Select` from imports (line 6).

- [ ] **Step 5: Verify page renders**

Run: Check `/owner/returns` in browser
Expected: Both tabs have consistent filter cards

---

## Task 8: Update Inventories Page

**Files:**
- Modify: `resources/js/pages/owner/inventories/index.tsx`

- [ ] **Step 1: Import OwnerFilterCard**

Add import:
```tsx
import OwnerFilterCard from '@/components/owner/owner-filter-card';
```

- [ ] **Step 2: Update Outlet tab filter controls (lines 160-192)**

Replace the filter controls div with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari outlet atau produk..."
    searchValue={search}
    onSearch={(val) => { setSearch(val); setCurrentPage(1); }}
    outletOptions={outlets.map((outlet: string) => ({ value: outlet, label: outlet }))}
    outletValue={outletFilter}
    onOutletChange={(val) => { setOutletFilter(val); setCurrentPage(1); }}
    tambahHref="/owner/inventories/create"
    tambahLabel="Tambah Stok"
/>
```

- [ ] **Step 3: Update CentralStockTab filter controls (lines 356-376)**

Replace the filter controls div with:

```tsx
<OwnerFilterCard
    searchPlaceholder="Cari produk atau SKU..."
    searchValue={search}
    onSearch={(val) => setSearch(val)}
/>
```

- [ ] **Step 4: Remove unused imports**

Remove `Select`, `Input` imports if no longer used elsewhere.

- [ ] **Step 5: Verify page renders**

Run: Check `/owner/inventories` in browser
Expected: Both tabs have consistent filter cards; "Tambah Stok" button works

---

## Task 9: Update Backend Controllers (if needed)

**Files:**
- Check: `app/Http/Controllers/Owner/RestockController.php`
- Check: `app/Http/Controllers/Owner/DistributionController.php`

- [ ] **Step 1: Check if restocks controller passes outlets prop**

Run: `grep -n "outlets" app/Http/Controllers/Owner/RestockController.php`
Expected: If missing, add outlets to Inertia render

- [ ] **Step 2: Check if distributions controller passes outlets prop**

Run: `grep -n "outlets" app/Http/Controllers/Owner/DistributionController.php`
Expected: If missing, add outlets to Inertia render

- [ ] **Step 3: Add missing props if needed**

Add `outlets` to Inertia::render() in each controller that's missing it.

- [ ] **Step 4: Verify no errors**

Run: `php artisan route:list --path=owner`
Expected: All routes resolve correctly

---

## Task 10: Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Test all pages in browser**

Check each page:
- `/owner/orders` — search, outlet, kurir, date
- `/owner/deliveries` — search, outlet, kurir, date
- `/owner/exchanges` — search, outlet, alasan, date
- `/owner/restocks` — search, outlet, date
- `/owner/distributions` — search, outlet, date
- `/owner/returns` — search, outlet, alasan, date (both tabs)
- `/owner/inventories` — search, outlet, tambah (both tabs)

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/owner/owner-filter-card.tsx resources/js/pages/owner/
git commit -m "feat: standardize OwnerFilterCard across all owner pages"
```
