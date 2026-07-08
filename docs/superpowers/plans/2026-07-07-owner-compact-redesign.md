# Owner Compact Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform owner UI from card-heavy to card-light compact design — tighter spacing, table rows for lists, soft backgrounds, reduced visual noise.

**Architecture:** Top-down approach — sidebar + shell first (foundational), then dashboard, then list/detail pages. Shared component changes cascade automatically. All changes are owner-scoped — no global CSS token changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Inertia.js, Lucide icons, Poppins font

**Spec:** `docs/superpowers/specs/2026-07-07-owner-compact-redesign-design.md`

---

## File Map

| File | Change Type | Purpose |
|------|-------------|---------|
| `resources/js/layouts/owner-layout.tsx` | Modify | Sidebar regroup, container spacing, max-w |
| `resources/js/components/owner/owner-sidebar-nav.tsx` | Modify | Nav item padding/font reduction |
| `resources/js/components/owner/owner-page-shell.tsx` | Modify | Page header spacing |
| `resources/js/pages/owner/dashboard.tsx` | Modify | Full card-light restructure |
| `resources/js/pages/owner/orders/index.tsx` | Modify | Table row conversion (template) |
| `resources/js/pages/owner/deliveries/index.tsx` | Modify | Table row conversion |
| `resources/js/pages/owner/restocks/index.tsx` | Modify | Table row conversion |
| `resources/js/pages/owner/returns/index.tsx` | Modify | Table row conversion |
| `resources/js/pages/owner/exchanges/index.tsx` | Modify | Table row conversion |
| `resources/js/pages/owner/inventories/index.tsx` | Modify | Table row conversion |
| `resources/js/pages/owner/distributions/index.tsx` | Modify | Table row conversion |
| `resources/js/pages/owner/orders/show.tsx` | Modify | Compact sections |
| `resources/js/pages/owner/deliveries/show.tsx` | Modify | Compact sections |
| `resources/js/pages/owner/restocks/show.tsx` | Modify | Compact sections |
| `resources/js/pages/owner/returns/show.tsx` | Modify | Compact sections |
| `resources/js/pages/owner/exchanges/show.tsx` | Modify | Compact sections |
| `resources/js/pages/owner/outlets/show.tsx` | Modify | Compact sections |
| `resources/js/pages/owner/distributions/show.tsx` | Modify | Compact sections |
| `resources/js/components/ui/status-badge.tsx` | Modify | Compact size |
| `resources/js/components/owner/owner-kpi-card.tsx` | Modify | Slim down (keep, used by analytics) |
| `resources/js/components/ui/expandable-section.tsx` | Modify | Tighter padding |
| `resources/js/components/ui/pagination.tsx` | Modify | Compact buttons |

---

### Task 1: Sidebar Regroup + Spacing

**Files:**
- Modify: `resources/js/layouts/owner-layout.tsx`
- Modify: `resources/js/components/owner/owner-sidebar-nav.tsx`

**Dependencies:** None — foundational change

- [ ] **Step 1: Remove "Pengiriman" group and merge into "Operasional"**

In `resources/js/layouts/owner-layout.tsx`, find the `navGroups` array. Remove the "Pengiriman" group (lines 49-55) and add its item to the "Operasional" group's `items` array:

```tsx
// Remove this entire group:
{
    label: 'Pengiriman',
    icon: <DeliveryIcon />,
    items: [
        { href: '/owner/delivery-tiers', label: 'Tier Ongkir' },
    ],
},

// And add this item to the Operasional group's items array:
{ href: '/owner/delivery-tiers', label: 'Tier Ongkir' },
```

The Operasional group should now have 4 items: Pesanan, Pengiriman, Return & Tukar, Tier Ongkir.

- [ ] **Step 2: Reduce sidebar spacing in `owner-sidebar-nav.tsx`**

In `resources/js/components/owner/owner-sidebar-nav.tsx`:

Line 81 — single-item link: change `px-3 py-2` → `px-2.5 py-1.5` and `text-[13px]` → `text-xs`:
```tsx
// Before:
className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all ...`}
// After:
className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-all ...`}
```

Line 95 — group heading button: change `px-3 py-2` → `px-2.5 py-1.5` and `text-[13px]` → `text-[11px]`:
```tsx
// Before:
className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all ...`}
// After:
className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-all ...`}
```

Line 77 — group margin: change `mt-1` → `mt-0.5`:
```tsx
// Before:
<div key={group.label} className={groupIndex > 0 ? 'mt-1' : ''}>
// After:
<div key={group.label} className={groupIndex > 0 ? 'mt-0.5' : ''}>
```

Line 115 — child item: change `px-3 py-1.5` → `px-2.5 py-1` and `text-[13px]` → `text-xs`:
```tsx
// Before:
className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] transition-all ...`}
// After:
className={`flex items-center justify-between rounded-lg px-2.5 py-1 text-xs transition-all ...`}
```

- [ ] **Step 3: Visual verification**

Start dev server (`npm run dev`), open `/owner/dashboard`, confirm:
- "Pengiriman" group gone
- "Tier Ongkir" appears under "Operasional"
- Nav items visually tighter

- [ ] **Step 4: Commit**

```bash
git add resources/js/layouts/owner-layout.tsx resources/js/components/owner/owner-sidebar-nav.tsx
git commit -m "feat(owner): sidebar regroup and compact spacing"
```

---

### Task 2: Page Shell + Layout Container

**Files:**
- Modify: `resources/js/components/owner/owner-page-shell.tsx`
- Modify: `resources/js/layouts/owner-layout.tsx`

**Dependencies:** None — can parallel with Task 1

- [ ] **Step 1: Tighten page shell header**

In `resources/js/components/owner/owner-page-shell.tsx`, line 24:

```tsx
// Before:
<div className="border-b border-border pb-4 mb-6 flex items-center justify-between gap-4">
// After:
<div className="border-b border-border pb-3 mb-4 flex items-center justify-between gap-4">
```

Line 32 — title font:
```tsx
// Before:
<h1 className="text-xl font-semibold tracking-tight text-text lg:text-2xl">{title}</h1>
// After:
<h1 className="text-lg font-semibold tracking-tight text-text lg:text-xl">{title}</h1>
```

- [ ] **Step 2: Tighten layout container**

In `resources/js/layouts/owner-layout.tsx`, line 127:

```tsx
// Before:
<div className="mx-auto max-w-300 px-6 py-8">
// After:
<div className="mx-auto max-w-7xl px-6 py-6">
```

- [ ] **Step 3: Visual verification**

Open any owner page, confirm:
- Title text smaller
- Less gap between header and content
- Content area slightly wider

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/owner/owner-page-shell.tsx resources/js/layouts/owner-layout.tsx
git commit -m "feat(owner): tighten page shell and layout container"
```

---

### Task 3: Dashboard Card-Light Restructure

**Files:**
- Modify: `resources/js/pages/owner/dashboard.tsx`
- Modify: `resources/js/components/owner/owner-kpi-card.tsx`

**Dependencies:** Task 2 (uses tighter page shell)

- [ ] **Step 1: Replace KPI card grid with horizontal strip**

In `resources/js/pages/owner/dashboard.tsx`, replace the entire right column's KPI grid section (the `<div className="grid grid-cols-2 gap-2">` block with Link + OwnerKpiCard components, lines ~203-232) with a 4-wide horizontal strip:

```tsx
{/* KPI Strip */}
<div className="grid grid-cols-4 gap-2">
    <Link href="/owner/finance" className="block rounded-lg bg-[#f7f7f7] p-2.5 transition-colors hover:bg-surface-muted">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Tagihan</div>
        <div className="mt-1 text-base font-bold tabular-nums text-text">{formatCurrency(kpis.outstandingAmount)}</div>
        <div className="text-[10px] font-medium text-blue-600">{settlementAlerts.length} outlet</div>
    </Link>
    <Link href="#actions" className="block rounded-lg bg-[#f7f7f7] p-2.5 transition-colors hover:bg-surface-muted">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Tindakan</div>
        <div className="mt-1 text-base font-bold tabular-nums text-text">{totalPendingActions}</div>
        <div className="text-[10px] font-medium text-amber-600">{actionRequired.restocks} restock</div>
    </Link>
    <Link href="/owner/inventories?filter=critical" className="block rounded-lg bg-[#f7f7f7] p-2.5 transition-colors hover:bg-surface-muted">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Stok Kritis</div>
        <div className={`mt-1 text-base font-bold tabular-nums ${kpis.criticalStock > 0 ? 'text-red-600' : 'text-text'}`}>{kpis.criticalStock}</div>
        <div className={`text-[10px] font-medium ${kpis.criticalStock > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{kpis.criticalStock > 0 ? 'SKU perlu restock' : 'Semua aman'}</div>
    </Link>
    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Pendapatan</div>
        <div className="mt-1 text-base font-bold tabular-nums text-text">—</div>
        <div className="text-[10px] font-medium text-emerald-600">hari ini</div>
    </div>
</div>
```

- [ ] **Step 2: Replace "Butuh Tindakan" section**

Remove `ExpandableSection` wrapper and card-border items. Replace with:

```tsx
{/* Butuh Tindakan */}
<div>
    <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Butuh Tindakan</span>
        {totalPendingActions > 0 && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-text-muted">{totalPendingActions}</span>
        )}
    </div>
    <div className="space-y-1.5">
        {actionRequired.restocks > 0 && (
            <Link href="/owner/restocks?status=requested" className="group flex items-center justify-between rounded-md bg-[#fafafa] px-3 py-2 transition-colors hover:bg-surface-muted">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-600"><Package className="h-3.5 w-3.5" /></div>
                    <div>
                        <div className="text-xs font-medium text-text">Restock</div>
                        <div className="text-[10px] text-text-muted">{actionRequired.restocks} menunggu</div>
                    </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-text-subtle" />
            </Link>
        )}
        {/* Repeat same pattern for returns (RotateCcw icon, bg-amber-100) */}
        {/* Repeat same pattern for exchanges (ArrowLeftRight icon, bg-amber-100) */}
        {/* Repeat same pattern for pendingSettlementVerifications (CreditCard icon, bg-blue-100) */}
        {totalPendingActions === 0 && (
            <div className="flex flex-col items-center justify-center py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
                <div className="mt-2 text-xs font-medium text-text">Semua sudah ditangani</div>
            </div>
        )}
    </div>
</div>
```

- [ ] **Step 3: Replace "Stok Kritis" section**

Same pattern — remove `ExpandableSection`, use bg-list:

```tsx
<div>
    <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Stok Kritis</span>
        {inventoryRisks.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{inventoryRisks.length}</span>
        )}
    </div>
    <div className="space-y-1.5">
        {inventoryRisks.map((risk) => (
            <div key={risk.variant.id} className="group flex items-center justify-between rounded-md bg-red-50 px-3 py-2">
                <Link href={risk.detailHref} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-red-100 text-red-500"><AlertTriangle className="h-3.5 w-3.5" /></div>
                    <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-text">{risk.variant.full_name}</div>
                        <div className="text-[10px] text-text-muted">Stok: <span className="font-semibold text-red-600">{risk.centerStock}</span> · Min {risk.threshold} · Kurang {risk.shortage}</div>
                    </div>
                </Link>
                <Link href="/owner/restocks/create" className="ml-2 shrink-0 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-text transition-colors hover:bg-primary hover:text-white">Restock</Link>
            </div>
        ))}
        {inventoryRisks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
                <div className="mt-2 text-xs font-medium text-text">Stok pusat aman</div>
            </div>
        )}
    </div>
</div>
```

- [ ] **Step 4: Shrink hero bar**

In the hero bar `<Link>` (line ~176):

```tsx
// Before:
className="group relative block overflow-hidden rounded-xl bg-linear-to-br from-primary to-primary-hover px-5 py-4 text-white ... lg:px-6 lg:py-5"
// After:
className="group relative block overflow-hidden rounded-lg bg-linear-to-br from-primary to-primary-hover px-4 py-3 text-white ..."
```

Amount font:
```tsx
// Before:
<div className="mt-2 text-2xl font-bold tabular-nums tracking-tight lg:text-3xl">
// After:
<div className="mt-1 text-xl font-bold tabular-nums tracking-tight">
```

- [ ] **Step 5: Slim `owner-kpi-card.tsx`**

In `resources/js/components/owner/owner-kpi-card.tsx`, update the main div (line 24):

```tsx
// Before:
'group rounded-xl border border-border bg-surface p-4 lg:p-5 transition-all duration-200',
'lg:shadow-sm hover:border-border-strong hover:shadow-md hover:-translate-y-0.5',
'active:translate-y-0 active:shadow-none',
// After:
'group rounded-md p-2.5 transition-colors duration-150 hover:bg-surface-muted',
```

Value font (line 38):
```tsx
// Before:
<div className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ...`}>
// After:
<div className={`mt-1 text-base font-bold tabular-nums tracking-tight ...`}>
```

Label font (line 36):
```tsx
// Before:
<div className="text-xs font-medium text-text-muted">{label}</div>
// After:
<div className="text-[10px] font-medium text-text-muted">{label}</div>
```

- [ ] **Step 6: Remove unused import**

Remove `ExpandableSection` import from `dashboard.tsx` (line 6).

- [ ] **Step 7: Visual verification**

Open `/owner/dashboard`, confirm:
- 4 KPI cards in horizontal strip, no borders
- Action items are soft bg-list, not bordered cards
- Stock items have red tinted bg
- Hero bar is smaller but still prominent

- [ ] **Step 8: Commit**

```bash
git add resources/js/pages/owner/dashboard.tsx resources/js/components/owner/owner-kpi-card.tsx
git commit -m "feat(owner): dashboard card-light restructure"
```

---

### Task 4: Orders List — Table Row Template

**Files:**
- Modify: `resources/js/pages/owner/orders/index.tsx`

**Dependencies:** Task 1 (sidebar), Task 2 (page shell)

- [ ] **Step 1: Convert filter controls to single row**

In `resources/js/pages/owner/orders/index.tsx`, replace the filter section (lines 63-117) with a single-row layout:

```tsx
{/* Filters — single row */}
<div className="mb-4 flex flex-wrap items-center gap-2">
    {statusFilters.map((sf) => {
        const isActive = currentStatus === sf.key;
        const colorMap: Record<string, string> = {
            needs_action: 'text-amber-600 bg-amber-50 ring-amber-200',
            active: 'text-blue-600 bg-blue-50 ring-blue-200',
            completed: 'text-emerald-600 bg-emerald-50 ring-emerald-200',
            cancelled: 'text-text-muted bg-surface-muted ring-border',
            failed: 'text-red-600 bg-red-50 ring-red-200',
        };
        return (
            <button key={sf.key} type="button" onClick={() => setFilter('status', sf.key)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-all ${
                    isActive ? colorMap[sf.key] ?? 'bg-primary/10 text-primary ring-primary/20' : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
                }`}>
                {sf.label}
            </button>
        );
    })}
    <span className="flex-1" />
    <Input icon={Search} defaultValue={filters.search ?? ''} onBlur={(e) => setFilter('search', e.target.value)}
        placeholder="Cari kode..." aria-label="Cari pesanan" className="h-8 w-40" />
    <Select value={filters.outlet_id ?? ''} onChange={(e) => setFilter('outlet_id', e.target.value)}
        aria-label="Filter outlet" className="h-8"
        options={[{ value: '', label: 'Semua outlet' }, ...outlets.map((o: any) => ({ value: String(o.id), label: o.name }))]} />
    <Input type="date" value={filters.date ?? ''} onChange={(e) => setFilter('date', e.target.value)}
        aria-label="Filter tanggal" className="h-8" />
</div>
```

- [ ] **Step 2: Replace sidebar stats with KPI strip**

Replace the entire `<div className="grid grid-cols-[1fr_320px] gap-6">` grid (line 120) with a KPI strip + full-width table:

```tsx
{/* KPI Strip */}
<div className="mb-4 grid grid-cols-4 gap-2">
    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Total</div>
        <div className="mt-1 text-base font-bold tabular-nums">{stats?.total_today ?? 0}</div>
        {(stats?.total_today ?? 0) > 0 && <div className="text-[10px] font-medium text-blue-600">Hari ini</div>}
    </div>
    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Tindakan</div>
        <div className="mt-1 text-base font-bold tabular-nums">{stats?.pending ?? 0}</div>
        {(stats?.pending ?? 0) > 0 && <div className="text-[10px] font-medium text-amber-600">Perlu assign kurir</div>}
    </div>
    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Selesai</div>
        <div className="mt-1 text-base font-bold tabular-nums">{stats?.completed_today ?? 0}</div>
    </div>
    <div className="rounded-lg bg-[#f7f7f7] p-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Revenue</div>
        <div className="mt-1 text-base font-bold tabular-nums">{formatCurrency(stats?.revenue_today ?? 0)}</div>
    </div>
</div>
```

- [ ] **Step 3: Convert card list to table rows**

Replace the card list (lines 123-198) with a table container:

```tsx
{orders.data.length === 0 ? (
    <div className="rounded-lg border border-border bg-white py-10 text-center text-xs text-text-muted">
        Tidak ada pesanan
    </div>
) : (
    <div className="overflow-hidden rounded-lg border border-border">
        {/* Header */}
        <div className="grid grid-cols-[90px_1fr_100px_80px_70px] items-center gap-3 bg-[#fafafa] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            <span>Kode</span><span>Customer / Outlet</span><span>Status</span><span className="text-right">Total</span><span />
        </div>
        {/* Rows */}
        {orders.data.map((order: any) => {
            const s = getOrderStatus(order.status);
            return (
                <div key={order.id}
                    className="grid grid-cols-[90px_1fr_100px_80px_70px] items-center gap-3 border-t border-[#f0f0f0] px-3 py-2 text-xs transition-colors last:border-t-0 hover:bg-surface-muted">
                    <span className="font-bold tabular-nums text-text">{order.order_code}</span>
                    <span className="truncate text-text-muted">{order.customer_name ?? '—'} · {order.outlet?.name ?? '—'}</span>
                    <span><StatusBadge variant={s.variant} size="sm">{s.label}</StatusBadge></span>
                    <span className="text-right font-semibold tabular-nums text-primary">{formatCurrency(order.total)}</span>
                    <div className="flex items-center gap-1 justify-end">
                        {order.status === 'ready_for_pickup' && !order.delivery && (
                            <button type="button" onClick={() => setAssignOrder(order)}
                                className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-hover">
                                Assign
                            </button>
                        )}
                        <button type="button" onClick={() => router.visit(`/owner/orders/${order.id}`)}
                            className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary-light">
                            Detail →
                        </button>
                    </div>
                </div>
            );
        })}
    </div>
)}
```

- [ ] **Step 4: Remove sidebar-related code**

Remove the entire right sidebar section (lines 203-281 — the sticky `<div>` with stat cards and quick actions). The KPI strip now handles this. Also remove the outer grid wrapper `grid grid-cols-[1fr_320px] gap-6`.

- [ ] **Step 5: Visual verification**

Open `/owner/orders`, confirm:
- Filters are one row, pills left, inputs right
- KPI strip above table (4 metrics)
- Table rows instead of cards
- Hover highlights row, no shadow lift

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/owner/orders/index.tsx
git commit -m "feat(owner): orders page table rows and compact filters"
```

---

### Task 5: Remaining List Pages (Batch)

**Files:**
- Modify: `resources/js/pages/owner/deliveries/index.tsx`
- Modify: `resources/js/pages/owner/restocks/index.tsx`
- Modify: `resources/js/pages/owner/returns/index.tsx`
- Modify: `resources/js/pages/owner/exchanges/index.tsx`
- Modify: `resources/js/pages/owner/inventories/index.tsx`
- Modify: `resources/js/pages/owner/distributions/index.tsx`

**Dependencies:** Task 4 (use orders as reference pattern)

Apply the same pattern from Task 4 to each page:

- [ ] **Step 1: Deliveries — `resources/js/pages/owner/deliveries/index.tsx`**

Columns: Kode, Outlet/Kurir, Status, Tanggal, Aksi. Replace `<div className="grid gap-6 lg:grid-cols-[1fr_320px]">` with KPI strip + table. Remove right sidebar. Status options become compact pill row.

- [ ] **Step 2: Restocks — `resources/js/pages/owner/restocks/index.tsx`**

Columns: Kode, Outlet, Status, Items, Aksi. Same pattern.

- [ ] **Step 3: Returns — `resources/js/pages/owner/returns/index.tsx`**

Columns: Kode, Customer, Outlet, Status, Aksi. Same pattern.

- [ ] **Step 4: Exchanges — `resources/js/pages/owner/exchanges/index.tsx`**

Columns: Kode, Customer, Outlet, Status, Aksi. Same pattern.

- [ ] **Step 5: Inventories — `resources/js/pages/owner/inventories/index.tsx`**

Columns: SKU, Nama Produk, Stok Pusat, Threshold, Status, Aksi. Same pattern.

- [ ] **Step 6: Distributions — `resources/js/pages/owner/distributions/index.tsx`**

Columns: Kode, Outlet, Status, Items, Tanggal, Aksi. Same pattern.

- [ ] **Step 7: Visual verification for all**

Open each page, confirm table rows, compact filters, no card wrappers.

- [ ] **Step 8: Commit**

```bash
git add resources/js/pages/owner/deliveries/index.tsx resources/js/pages/owner/restocks/index.tsx resources/js/pages/owner/returns/index.tsx resources/js/pages/owner/exchanges/index.tsx resources/js/pages/owner/inventories/index.tsx resources/js/pages/owner/distributions/index.tsx
git commit -m "feat(owner): convert remaining list pages to table rows"
```

---

### Task 6: Detail/Show Pages (Batch)

**Files:**
- Modify: `resources/js/pages/owner/orders/show.tsx`
- Modify: `resources/js/pages/owner/deliveries/show.tsx`
- Modify: `resources/js/pages/owner/restocks/show.tsx`
- Modify: `resources/js/pages/owner/returns/show.tsx`
- Modify: `resources/js/pages/owner/exchanges/show.tsx`
- Modify: `resources/js/pages/owner/outlets/show.tsx`
- Modify: `resources/js/pages/owner/distributions/show.tsx`

**Dependencies:** Task 7 (shared components need to be compacted first for badges)

Apply the same pattern to each show page:

**Pattern — 2-column compact sections:**

```tsx
// Remove: <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
// Replace with:
<div className="grid gap-3 lg:grid-cols-2">

// Remove: <div className="rounded-xl border border-border bg-white p-6">
// Replace with:
<div className="rounded-lg border border-border p-4">

// Remove: <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Title</div>
// Replace with:
<div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Title</div>

// Remove: <div className="mt-3">...</div>
// Replace with key-value rows:
<div className="flex justify-between py-1 border-b border-[#f5f5f5] last:border-b-0 text-xs">
    <span className="text-text-muted">Label</span>
    <span className="text-text">Value</span>
</div>
```

- [ ] **Step 1: Orders show — `resources/js/pages/owner/orders/show.tsx`**

Convert: Items card → compact section, Timeline card → compact section, Status card → removed (badge inline in header), Customer card → compact key-value, Assign kurir card → compact.

Back button (in OwnerPageShell via backHref) — `h-7 w-7 p-1.5` if customizable via prop, otherwise leave as-is (shell handles it).

- [ ] **Step 2: Deliveries show**

Same pattern.

- [ ] **Step 3: Restocks show**

Same pattern.

- [ ] **Step 4: Returns show**

Same pattern.

- [ ] **Step 5: Exchanges show**

Same pattern.

- [ ] **Step 6: Outlets show**

Same pattern — has more sections (operating hours, holidays, products). All become compact sections in 2-col grid.

- [ ] **Step 7: Distributions show**

Same pattern.

- [ ] **Step 8: Visual verification**

Open each show page, confirm 2-col grid, compact sections, smaller padding, key-value rows.

- [ ] **Step 9: Commit**

```bash
git add resources/js/pages/owner/orders/show.tsx resources/js/pages/owner/deliveries/show.tsx resources/js/pages/owner/restocks/show.tsx resources/js/pages/owner/returns/show.tsx resources/js/pages/owner/exchanges/show.tsx resources/js/pages/owner/outlets/show.tsx resources/js/pages/owner/distributions/show.tsx
git commit -m "feat(owner): convert detail pages to compact sections"
```

---

### Task 7: Shared Components

**Files:**
- Modify: `resources/js/components/ui/status-badge.tsx`
- Modify: `resources/js/components/ui/expandable-section.tsx`
- Modify: `resources/js/components/ui/pagination.tsx`

**Dependencies:** None — but affects all owner pages. Execute before detail pages (Task 6) for clean diffs.

- [ ] **Step 1: Status badge — `status-badge.tsx`**

Line 30 — size styles:
```tsx
// Before:
const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-0.5 text-[11px]',
};
// After:
const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-[10px]',
};
```

Line 54 — radius:
```tsx
// Before:
<span className={`inline-flex items-center rounded-full font-bold ...`}>
// After:
<span className={`inline-flex items-center rounded-lg font-bold ...`}>
```

- [ ] **Step 2: Expandable section — `expandable-section.tsx`**

Line 37 — container:
```tsx
// Before:
<div className={cn('overflow-hidden rounded-xl border border-border bg-surface transition-shadow duration-200 hover:shadow-sm', className)}>
// After:
<div className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
```

Line 41 — button padding:
```tsx
// Before:
className="flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-surface-muted"
// After:
className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-surface-muted"
```

Line 50 — title font:
```tsx
// Before:
<span className="text-sm font-semibold text-text">{title}</span>
// After:
<span className="text-xs font-semibold text-text">{title}</span>
```

Line 66 — content padding:
```tsx
// Before:
<div className="border-t border-border px-4 py-3">
// After:
<div className="border-t border-border px-3 py-2">
```

- [ ] **Step 3: Pagination — `pagination.tsx`**

Line 19 — gap:
```tsx
// Before:
<nav className="mt-4 flex flex-wrap items-center justify-center gap-1" ...>
// After:
<nav className="mt-3 flex flex-wrap items-center justify-center gap-1" ...>
```

Line 25 — disabled button padding:
```tsx
// Before:
className="inline-flex items-center rounded-md px-3 py-1.5 text-xs text-slate-400"
// After:
className="inline-flex items-center rounded-md px-2 py-1 text-[11px] text-slate-400"
```

Line 35 — active button padding:
```tsx
// Before:
className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ...`}
// After:
className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium transition-colors ...`}
```

- [ ] **Step 4: Visual verification**

Open any list page, confirm badges are smaller, pagination is tighter.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/ui/status-badge.tsx resources/js/components/ui/expandable-section.tsx resources/js/components/ui/pagination.tsx
git commit -m "feat(owner): compact shared components (badge, pagination, expandable)"
```

---

### Task 8: Final Polish + Shadow Cleanup

**Files:**
- Review all modified files for remaining `shadow-sm`, `shadow-md`, `rounded-2xl`, `rounded-xl` on owner components

**Dependencies:** All previous tasks complete

- [ ] **Step 1: Audit remaining shadows**

Search owner pages/components for `shadow-sm`, `shadow-md`, `shadow-lg`, `hover:shadow`. Remove from all owner-specific components. Separation via borders only.

- [ ] **Step 2: Audit remaining large radii**

Search for `rounded-2xl` and `rounded-xl` in owner files. Replace with `rounded-lg`.

- [ ] **Step 3: Visual regression check**

Open `/owner/dashboard`, `/owner/orders`, `/owner/orders/1` — confirm no stale shadows or oversized radii.

- [ ] **Step 4: Commit**

```bash
git add -A resources/js/pages/owner/ resources/js/components/owner/
git commit -m "chore(owner): remove stale shadows and oversized radii"
```

---

## Parallel Execution Map

```
Task 1 (sidebar) ──┐
                    ├──→ Task 3 (dashboard) ──→ Task 8 (polish)
Task 2 (shell)   ──┘         │
                              ↓
                     Task 4 (orders template) ──→ Task 5 (list pages)
                              │
Task 7 (shared components) ──┼──→ Task 6 (detail pages)
                              │
                              └──→ Task 8 (polish)
```

**Independent tracks:**
- Track A: Tasks 1+2 → Task 3
- Track B: Tasks 4 → Task 5
- Track C: Task 7 → Task 6

Tasks 1, 2, 4, 7 can start in parallel. Task 3 needs 1+2. Task 5 needs 4. Task 6 needs 7. Task 8 needs everything.
