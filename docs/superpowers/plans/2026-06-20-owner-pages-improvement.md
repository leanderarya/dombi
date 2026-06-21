# Owner Pages Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 critical UX issues in Owner pages: map zoom, pricing management, KPI consistency, and inventory scalability

**Architecture:** Incremental improvements to existing components, maintaining current patterns and design system

**Tech Stack:** React 19, TypeScript, Inertia.js, Leaflet, Tailwind CSS

---

## Issue Summary

| # | Issue | Priority | Impact |
|---|-------|----------|--------|
| 1 | Map zoom not working properly when adding outlet | P1 | High - affects outlet creation UX |
| 2 | Pricing management sorting inconsistency | P1 | High - affects daily price management |
| 3 | KPI dashboard inconsistency | P2 | Medium - affects decision making |
| 4 | Inventory scalability issues | P2 | Medium - affects monitoring efficiency |

---

## Task 1: Fix Map Zoom on Outlet Create/Edit

**Problem:** When adding/editing an outlet, the map doesn't zoom to the correct location. `MapFitBounds` and `MapCenter` components fight each other on initial render.

**Files:**
- Modify: `resources/js/components/owner/outlet-location-map.tsx`
- Modify: `resources/js/components/owner/outlet-form-sheet.tsx`

- [ ] **Step 1: Read current map implementation**

Read `resources/js/components/owner/outlet-location-map.tsx` and identify the conflict between `MapFitBounds` (lines 266-288) and `MapCenter` (lines 256-264).

- [ ] **Step 2: Fix MapFitBounds to handle initial position**

Replace the `MapFitBounds` component logic to handle both cases:
- **New outlet (no position):** Fit bounds to show all existing outlets
- **Edit outlet (has position):** Zoom to MARKER_ZOOM on the outlet location

```tsx
// In outlet-location-map.tsx, replace MapFitBounds component (lines 266-288):

function MapFitBounds({ existingOutlets, position }: { existingOutlets: ExistingOutlet[]; position: LatLng | null }) {
    const map = useMap();
    const hasFitted = useRef(false);

    useEffect(() => {
        if (hasFitted.current) return;

        // If we have a position (editing), zoom to it
        if (position) {
            map.setView([position.lat, position.lng], MARKER_ZOOM, { animate: false });
            hasFitted.current = true;
            return;
        }

        // If we have existing outlets, fit bounds to show them all
        if (existingOutlets.length >= 2) {
            const bounds = L.latLngBounds(
                existingOutlets.map(o => [parseFloat(o.latitude), parseFloat(o.longitude)])
            );
            map.fitBounds(bounds, { maxZoom: MARKER_ZOOM, padding: [40, 40] });
            hasFitted.current = true;
        } else if (existingOutlets.length === 1) {
            map.setView(
                [parseFloat(existingOutlets[0].latitude), parseFloat(existingOutlets[0].longitude)],
                MARKER_ZOOM,
                { animate: false }
            );
            hasFitted.current = true;
        }
    }, [map, existingOutlets, position]);

    return null;
}
```

- [ ] **Step 3: Fix MapCenter to not override initial fit**

Update `MapCenter` to only run after user interaction (drag/search/click), not on initial render:

```tsx
// In outlet-location-map.tsx, replace MapCenter component (lines 256-264):

function MapCenter({ position }: { position: LatLng | null }) {
    const map = useMap();
    const isInitialMount = useRef(true);

    useEffect(() => {
        // Skip the first render to let MapFitBounds handle initial positioning
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (position) {
            map.setView([position.lat, position.lng], MARKER_ZOOM, { animate: true });
        }
    }, [map, position]);

    return null;
}
```

- [ ] **Step 4: Add zoom controls**

Enable zoom controls for better UX:

```tsx
// In outlet-location-map.tsx, update MapContainer props (line 92):

<MapContainer
    center={[position?.lat ?? defaultCenter.lat, position?.lng ?? defaultCenter.lng]}
    zoom={DEFAULT_ZOOM}
    scrollWheelZoom={false}
    zoomControl={true}
    touchZoom={true}
    doubleClickZoom={true}
    className="h-full w-full"
>
```

- [ ] **Step 5: Test the fix**

1. Go to `/owner/outlets/create`
2. Verify map shows all existing outlets
3. Click on map to set location
4. Verify map zooms to MARKER_ZOOM (15)
5. Search for an address
6. Verify map zooms to found location
7. Go to `/owner/outlets/{id}/edit`
8. Verify map starts zoomed to outlet location
9. Drag marker to new location
10. Verify map follows marker

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/owner/outlet-location-map.tsx
git commit -m "fix: improve map zoom behavior on outlet create/edit

- Fix MapFitBounds/MapCenter conflict on initial render
- New outlet: fit bounds to show all existing outlets
- Edit outlet: zoom to outlet location
- Add zoom controls for better UX
- Only animate zoom after user interaction"
```

---

## Task 2: Improve Pricing Management UX

**Problem:** Master pricing has no sorting, outlet pricing has sorting but inconsistent with center prices, and overall pricing management is fragmented across multiple pages.

**Files:**
- Modify: `resources/js/pages/owner/pricing/master.tsx`
- Modify: `resources/js/pages/owner/pricing/outlet.tsx`
- Modify: `resources/js/pages/owner/pricing/history.tsx`

- [ ] **Step 1: Add sorting to master pricing**

Read `resources/js/pages/owner/pricing/master.tsx` and add client-side sorting:

```tsx
// In master.tsx, add state and sort logic after line 36:

const [sortField, setSortField] = useState<'name' | 'center_price' | 'default_selling_price' | 'margin'>('name');
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
        setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortField(field);
        setSortDir('asc');
    }
};

const sortedVariants = useMemo(() => {
    const sorted = [...filteredVariants].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
            case 'name':
                cmp = a.name.localeCompare(b.name);
                break;
            case 'center_price':
                cmp = a.center_price - b.center_price;
                break;
            case 'default_selling_price':
                cmp = a.default_selling_price - b.default_selling_price;
                break;
            case 'margin':
                cmp = (a.default_selling_price - a.center_price) - (b.default_selling_price - b.center_price);
                break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
}, [filteredVariants, sortField, sortDir]);
```

- [ ] **Step 2: Add sort indicators to table headers**

Update the table headers in `master.tsx` to be clickable with sort indicators:

```tsx
// Replace the <thead> section (around line 130):

<thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
    <tr>
        <th 
            className="cursor-pointer px-4 py-3 text-left hover:bg-zinc-100"
            onClick={() => toggleSort('name')}
        >
            <span className="inline-flex items-center gap-1">
                Produk
                {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th className="px-4 py-3 text-left">Rasa / Ukuran</th>
        <th 
            className="cursor-pointer px-4 py-3 text-right hover:bg-zinc-100"
            onClick={() => toggleSort('center_price')}
        >
            <span className="inline-flex items-center gap-1 justify-end">
                Harga Pusat
                {sortField === 'center_price' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th 
            className="cursor-pointer px-4 py-3 text-right hover:bg-zinc-100"
            onClick={() => toggleSort('default_selling_price')}
        >
            <span className="inline-flex items-center gap-1 justify-end">
                Harga Jual
                {sortField === 'default_selling_price' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th 
            className="cursor-pointer px-4 py-3 text-right hover:bg-zinc-100"
            onClick={() => toggleSort('margin')}
        >
            <span className="inline-flex items-center gap-1 justify-end">
                Margin
                {sortField === 'margin' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th className="px-4 py-3 text-center">Aksi</th>
    </tr>
</thead>
```

- [ ] **Step 3: Add pagination to master pricing**

Add pagination to `master.tsx`:

```tsx
// Add after the state declarations:

const ITEMS_PER_PAGE = 20;
const [currentPage, setCurrentPage] = useState(1);

const totalPages = Math.ceil(sortedVariants.length / ITEMS_PER_PAGE);
const paginatedVariants = sortedVariants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
);

// Update the table body to use paginatedVariants instead of sortedVariants
```

Add pagination controls after the table:

```tsx
{/* Pagination */}
{totalPages > 1 && (
    <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
        <span className="text-sm text-zinc-500">
            Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, sortedVariants.length)} dari {sortedVariants.length} produk
        </span>
        <div className="flex gap-2">
            <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
                Sebelumnya
            </button>
            <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
                Berikutnya
            </button>
        </div>
    </div>
)}
```

- [ ] **Step 4: Add pagination controls to pricing history**

Read `resources/js/pages/owner/pricing/history.tsx` and add pagination controls:

```tsx
// In history.tsx, add pagination state and controls:

const [currentPage, setCurrentPage] = useState(1);
const ITEMS_PER_PAGE = 20;

// Add pagination controls after the table:
<div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
    <span className="text-sm text-zinc-500">
        Halaman {currentPage} dari {logs.last_page}
    </span>
    <div className="flex gap-2">
        <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
            Sebelumnya
        </button>
        <button
            onClick={() => setCurrentPage(p => Math.min(logs.last_page, p + 1))}
            disabled={currentPage === logs.last_page}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
            Berikutnya
        </button>
    </div>
</div>
```

- [ ] **Step 5: Extract shared marginColor utility**

Create a shared utility to eliminate duplication:

Create `resources/js/lib/pricing-utils.ts`:

```typescript
export function marginColor(margin: number): string {
    if (margin > 20) return 'text-emerald-600';
    if (margin >= 10) return 'text-blue-600';
    if (margin >= 0) return 'text-amber-600';
    return 'text-red-600';
}

export function marginBgColor(margin: number): string {
    if (margin > 20) return 'bg-emerald-50';
    if (margin >= 10) return 'bg-blue-50';
    if (margin >= 0) return 'bg-amber-50';
    return 'bg-red-50';
}
```

Update `master.tsx`, `outlet.tsx`, and `pricing-edit-modal.tsx` to import from this utility.

- [ ] **Step 6: Test the improvements**

1. Go to `/owner/pricing/master`
2. Verify table headers are clickable
3. Click each column header to sort
4. Verify sort direction toggles
5. Verify pagination works
6. Go to `/owner/pricing/outlets/{id}`
7. Verify sorting still works
8. Go to `/owner/pricing/history`
9. Verify pagination controls work

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/owner/pricing/master.tsx resources/js/pages/owner/pricing/outlet.tsx resources/js/pages/owner/pricing/history.tsx resources/js/lib/pricing-utils.ts
git commit -m "feat: improve pricing management UX

- Add client-side sorting to master pricing (name, center price, selling price, margin)
- Add pagination to master pricing (20 items per page)
- Add pagination controls to pricing history
- Extract shared marginColor utility to reduce duplication
- Consistent sort behavior across master and outlet pricing"
```

---

## Task 3: Improve KPI Dashboard Consistency

**Problem:** KPI cards on dashboard don't match operational returns/exchanges KPIs. Missing billing/payment metrics and trends.

**Files:**
- Modify: `resources/js/pages/owner/dashboard.tsx`
- Modify: `resources/js/pages/owner/inventories/index.tsx`

- [ ] **Step 1: Read current dashboard implementation**

Read `resources/js/pages/owner/dashboard.tsx` and understand the current KPI structure.

- [ ] **Step 2: Add billing/payment KPIs to dashboard**

Add new KPI cards for billing and payment metrics:

```tsx
// In dashboard.tsx, add after the existing KPI section (around line 126):

{/* Billing & Payment KPIs */}
<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <OwnerKpiCard
        icon={Wallet}
        label="Tagihan Bulan Ini"
        value={formatCurrency(kpis.monthlyBilling ?? 0)}
        trend={kpis.billingTrend}
    />
    <OwnerKpiCard
        icon={CreditCard}
        label="Pembayaran Diterima"
        value={formatCurrency(kpis.monthlyPayments ?? 0)}
        trend={kpis.paymentsTrend}
    />
    <OwnerKpiCard
        icon={RotateCcw}
        label="Returns Aktif"
        value={kpis.activeReturns ?? 0}
        color={kpis.activeReturns > 0 ? 'warning' : 'success'}
    />
    <OwnerKpiCard
        icon={ArrowLeftRight}
        label="Exchanges Aktif"
        value={kpis.activeExchanges ?? 0}
        color={kpis.activeExchanges > 0 ? 'warning' : 'success'}
    />
</div>
```

- [ ] **Step 3: Update KPI props interface**

Update the props interface to include the new metrics:

```tsx
// In dashboard.tsx, update the kpis interface (around line 30):

kpis: {
    // Existing
    outstandingAmount: number;
    approvalsNeeded: number;
    outletsNeedingAttention: number;
    criticalCenterSkus: number;
    // New - Billing & Payment
    monthlyBilling?: number;
    billingTrend?: number;
    monthlyPayments?: number;
    paymentsTrend?: number;
    activeReturns?: number;
    activeExchanges?: number;
};
```

- [ ] **Step 4: Update backend to provide new KPIs**

Modify the Owner Dashboard controller to include the new metrics:

```php
// In app/Http/Controllers/Owner/DashboardController.php, add to the data array:

// Billing & Payment KPIs
'monthlyBilling' => Settlement::whereMonth('period_start', now()->month)
    ->whereYear('period_start', now()->year)
    ->sum('total_amount'),
'monthlyPayments' => SettlementPayment::whereMonth('payment_date', now()->month)
    ->whereYear('payment_date', now()->year)
    ->where('status', 'verified')
    ->sum('amount'),
'activeReturns' => ReturnRequest::whereIn('status', ['submitted', 'approved', 'received_at_center'])->count(),
'activeExchanges' => ExchangeRequest::whereIn('status', ['submitted', 'approved', 'preparing', 'shipped'])->count(),
```

- [ ] **Step 5: Fix inventory KPI consistency**

Update `resources/js/pages/owner/inventories/index.tsx` to use `OwnerKpiCard` instead of local `KpiMini`:

```tsx
// In inventories/index.tsx, replace the KpiMini section (around line 27):

import { OwnerKpiCard } from '@/components/owner/owner-kpi-card';

// Replace the KPI section:
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <OwnerKpiCard
        icon={Box}
        label="Total SKU"
        value={kpis.totalSkus}
    />
    <OwnerKpiCard
        icon={AlertTriangle}
        label="Stok Rendah"
        value={kpis.lowStock}
        color="warning"
    />
    <OwnerKpiCard
        icon={Lock}
        label="Reserved"
        value={kpis.reserved}
        color="info"
    />
    <OwnerKpiCard
        icon={XCircle}
        label="Kritis"
        value={kpis.critical}
        color="danger"
    />
</div>
```

- [ ] **Step 6: Test the improvements**

1. Go to `/owner/dashboard`
2. Verify new KPI cards show (Billing, Payments, Returns, Exchanges)
3. Verify trends display correctly
4. Go to `/owner/inventories`
5. Verify KPI cards use consistent styling with dashboard

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/owner/dashboard.tsx resources/js/pages/owner/inventories/index.tsx app/Http/Controllers/Owner/DashboardController.php
git commit -m "feat: improve dashboard KPI consistency

- Add billing/payment KPIs (monthly billing, payments received)
- Add operational KPIs (active returns, active exchanges)
- Use OwnerKpiCard in inventory page for consistent styling
- Add trend indicators for financial metrics"
```

---

## Task 4: Improve Inventory Scalability

**Problem:** Inventory page shows all items at once with no search, filter, sort, or pagination. Unmanageable with many outlets and products.

**Files:**
- Modify: `resources/js/pages/owner/inventories/index.tsx`

- [ ] **Step 1: Read current inventory implementation**

Read `resources/js/pages/owner/inventories/index.tsx` and understand the current structure.

- [ ] **Step 2: Add search and filter controls**

Add search, outlet filter, and stock level filter:

```tsx
// In inventories/index.tsx, add after the KPI section:

const [search, setSearch] = useState('');
const [outletFilter, setOutletFilter] = useState<string>('all');
const [stockFilter, setStockFilter] = useState<'all' | 'critical' | 'low' | 'healthy'>('all');
const [sortField, setSortField] = useState<'outlet' | 'product' | 'stock' | 'available'>('outlet');
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
const [currentPage, setCurrentPage] = useState(1);
const ITEMS_PER_PAGE = 20;

// Get unique outlets for filter
const outlets = useMemo(() => {
    const unique = [...new Set(items.map(item => item.outlet_name))];
    return unique.sort();
}, [items]);

// Filter and sort items
const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (search) {
        const searchLower = search.toLowerCase();
        result = result.filter(item => 
            item.outlet_name.toLowerCase().includes(searchLower) ||
            item.name.toLowerCase().includes(searchLower) ||
            item.family_name?.toLowerCase().includes(searchLower)
        );
    }

    // Outlet filter
    if (outletFilter !== 'all') {
        result = result.filter(item => item.outlet_name === outletFilter);
    }

    // Stock level filter
    if (stockFilter !== 'all') {
        result = result.filter(item => {
            const available = item.current_stock - item.reserved;
            switch (stockFilter) {
                case 'critical': return available <= 0;
                case 'low': return available > 0 && available <= item.minimum_stock;
                case 'healthy': return available > item.minimum_stock;
                default: return true;
            }
        });
    }

    // Sort
    result.sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
            case 'outlet':
                cmp = a.outlet_name.localeCompare(b.outlet_name);
                break;
            case 'product':
                cmp = a.name.localeCompare(b.name);
                break;
            case 'stock':
                cmp = a.current_stock - b.current_stock;
                break;
            case 'available':
                cmp = (a.current_stock - a.reserved) - (b.current_stock - b.reserved);
                break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
}, [items, search, outletFilter, stockFilter, sortField, sortDir]);

// Pagination
const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
);
```

- [ ] **Step 3: Add filter UI controls**

Add the filter controls above the table:

```tsx
{/* Filters */}
<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    {/* Search */}
    <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
            type="text"
            placeholder="Cari outlet atau produk..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-zinc-300 pl-10 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
    </div>

    {/* Outlet filter */}
    <select
        value={outletFilter}
        onChange={(e) => { setOutletFilter(e.target.value); setCurrentPage(1); }}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
    >
        <option value="all">Semua Outlet</option>
        {outlets.map(outlet => (
            <option key={outlet} value={outlet}>{outlet}</option>
        ))}
    </select>

    {/* Stock level filter */}
    <select
        value={stockFilter}
        onChange={(e) => { setStockFilter(e.target.value as any); setCurrentPage(1); }}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
    >
        <option value="all">Semua Stok</option>
        <option value="critical">Kritis (0)</option>
        <option value="low">Rendah</option>
        <option value="healthy">Sehat</option>
    </select>
</div>
```

- [ ] **Step 4: Add sort controls to table headers**

Update table headers to be clickable:

```tsx
<thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
    <tr>
        <th 
            className="cursor-pointer px-4 py-3 text-left hover:bg-zinc-100"
            onClick={() => toggleSort('outlet')}
        >
            <span className="inline-flex items-center gap-1">
                Outlet
                {sortField === 'outlet' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th 
            className="cursor-pointer px-4 py-3 text-left hover:bg-zinc-100"
            onClick={() => toggleSort('product')}
        >
            <span className="inline-flex items-center gap-1">
                Produk
                {sortField === 'product' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th 
            className="cursor-pointer px-4 py-3 text-right hover:bg-zinc-100"
            onClick={() => toggleSort('stock')}
        >
            <span className="inline-flex items-center gap-1 justify-end">
                Stok
                {sortField === 'stock' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th className="px-4 py-3 text-right">Reserved</th>
        <th 
            className="cursor-pointer px-4 py-3 text-right hover:bg-zinc-100"
            onClick={() => toggleSort('available')}
        >
            <span className="inline-flex items-center gap-1 justify-end">
                Tersedia
                {sortField === 'available' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
            </span>
        </th>
        <th className="px-4 py-3 text-center">Status</th>
        <th className="px-4 py-3 text-center">Aksi</th>
    </tr>
</thead>
```

- [ ] **Step 5: Add pagination controls**

Add pagination controls after the table:

```tsx
{/* Pagination */}
{totalPages > 1 && (
    <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
        <span className="text-sm text-zinc-500">
            Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} dari {filteredItems.length} item
        </span>
        <div className="flex gap-2">
            <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
                Sebelumnya
            </button>
            <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
                Berikutnya
            </button>
        </div>
    </div>
)}
```

- [ ] **Step 6: Update KPIs to reflect filtered data**

Update KPI cards to show counts based on filtered data:

```tsx
{/* KPIs - use filtered data */}
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <OwnerKpiCard
        icon={Box}
        label="Total SKU"
        value={filteredItems.length}
    />
    <OwnerKpiCard
        icon={AlertTriangle}
        label="Stok Rendah"
        value={filteredItems.filter(i => {
            const avail = i.current_stock - i.reserved;
            return avail > 0 && avail <= i.minimum_stock;
        }).length}
        color="warning"
    />
    <OwnerKpiCard
        icon={Lock}
        label="Reserved"
        value={filteredItems.reduce((sum, i) => sum + i.reserved, 0)}
        color="info"
    />
    <OwnerKpiCard
        icon={XCircle}
        label="Kritis"
        value={filteredItems.filter(i => (i.current_stock - i.reserved) <= 0).length}
        color="danger"
    />
</div>
```

- [ ] **Step 7: Test the improvements**

1. Go to `/owner/inventories`
2. Verify search works (by outlet name, product name)
3. Verify outlet filter dropdown works
4. Verify stock level filter works (all, critical, low, healthy)
5. Verify table headers are clickable for sorting
6. Verify pagination works
7. Verify KPIs update based on filters
8. Test with large dataset (many outlets/products)

- [ ] **Step 8: Commit**

```bash
git add resources/js/pages/owner/inventories/index.tsx
git commit -m "feat: improve inventory page scalability

- Add search by outlet name and product name
- Add outlet filter dropdown
- Add stock level filter (all, critical, low, healthy)
- Add client-side sorting (outlet, product, stock, available)
- Add pagination (20 items per page)
- Update KPIs to reflect filtered data
- Use OwnerKpiCard for consistent styling"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Manual testing checklist:
   - [ ] Map zoom works correctly on outlet create
   - [ ] Map zoom works correctly on outlet edit
   - [ ] Master pricing sorting works
   - [ ] Master pricing pagination works
   - [ ] Pricing history pagination works
   - [ ] Dashboard shows all KPIs consistently
   - [ ] Inventory search/filter/sort works
   - [ ] Inventory pagination works
   - [ ] All KPI cards use consistent styling

## Summary

| Task | Description | Files Changed | Est. |
|------|-------------|---------------|------|
| 1 | Fix map zoom on outlet create/edit | 1 | 1h |
| 2 | Improve pricing management UX | 4 | 2h |
| 3 | Improve KPI dashboard consistency | 3 | 1.5h |
| 4 | Improve inventory scalability | 1 | 2h |
| **Total** | | **9 files** | **~6.5h** |
