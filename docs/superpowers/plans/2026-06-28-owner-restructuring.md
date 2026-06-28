# Owner Dashboard Restructuring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify owner role from 20+ sidebar items to 13 items by merging similar pages into tabbed interfaces.

**Architecture:** Merge 3 page groups (Keuangan, Harga, Analitik) into single pages with tab navigation. Tab state persisted via URL params. KPI sidebar shown on relevant tabs.

**Tech Stack:** React + TypeScript + Tailwind CSS + Inertia.js

## Global Constraints

- Use design tokens: `text-text`, `text-text-muted`, `text-text-subtle`, `border-border`, `bg-surface`, `bg-surface-muted`, `bg-primary`
- Tab pills: `rounded-full px-3.5 py-1.5 text-xs font-medium`
- Active tab: `bg-primary text-white shadow-sm shadow-primary/20`
- Inactive tab: `bg-surface-muted text-text-muted hover:bg-zinc-200`
- Card style: `rounded-xl border border-border bg-white p-5`
- KPI card: `rounded-xl border border-border bg-white p-5 shadow-sm`
- Spacing: `space-y-4` for sections, `space-y-2` for lists
- Responsive: `lg:grid-cols-[1fr_320px]` for 2-column layout
- Sidebar: `hidden lg:block` for desktop

---

## File Structure

### New Files
- `resources/js/pages/owner/finance/index.tsx` — Merged finance page (Tagihan + Pembayaran + Rekening)
- `resources/js/pages/owner/pricing/index.tsx` — Merged pricing page (Pusat + Outlet + Riwayat)
- `resources/js/pages/owner/analytics/index.tsx` — Merged analytics page (Dashboard + Audit + Laporan + Masalah)

### Delete Files
- `resources/js/pages/owner/finance/settlement-payments.tsx`
- `resources/js/pages/owner/finance/payment-accounts.tsx`
- `resources/js/pages/owner/pricing/master.tsx`
- `resources/js/pages/owner/pricing/outlet.tsx`
- `resources/js/pages/owner/pricing/history.tsx`
- `resources/js/pages/owner/stock-movements/index.tsx`
- `resources/js/pages/owner/reports/index.tsx`
- `resources/js/pages/owner/order-reports/index.tsx`
- `resources/js/pages/owner/order-reports/show.tsx`

### Update Files
- `resources/js/layouts/owner-layout.tsx` — Update sidebar navigation
- `routes/web.php` — Update routes

---

## Task 1: Create Merged Finance Page

**Files:**
- Create: `resources/js/pages/owner/finance/index.tsx`

**Interfaces:**
- Consumes: `FinanceKpiCard`, `FinanceFilterTabs`, `FinanceOutletCard`, `PaymentHistoryCard`, `PaymentProofModal`
- Produces: Single finance page with 3 tabs

- [ ] **Step 1: Create new finance/index.tsx with tab structure**

```tsx
import { router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

const TABS = [
    { key: 'tagihan', label: 'Tagihan' },
    { key: 'pembayaran', label: 'Pembayaran' },
    { key: 'rekening', label: 'Rekening' },
];

export default function FinanceIndex({ ...props }: any) {
    const [activeTab, setActiveTab] = useState('tagihan');
    
    // Sync tab with URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && TABS.some(t => t.key === tab)) {
            setActiveTab(tab);
        }
    }, []);
    
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        router.get('/owner/finance', { tab }, { preserveState: true, replace: true });
    };
    
    return (
        <OwnerPageShell title="Keuangan" subtitle="Pantau kewajiban seluruh outlet">
            {/* Tab Pills */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                            activeTab === tab.key
                                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Tab Content */}
            {activeTab === 'tagihan' && <TagihanTab {...props} />}
            {activeTab === 'pembayaran' && <PembayaranTab {...props} />}
            {activeTab === 'rekening' && <RekeningTab {...props} />}
        </OwnerPageShell>
    );
}
```

- [ ] **Step 2: Implement TagihanTab component**

```tsx
function TagihanTab({ kpis, outlets }: any) {
    // Move content from current finance/index.tsx
    // Include: filter tabs, outlet list, KPI sidebar
    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Filters + Outlet List */}
            <div>
                {/* Filter tabs + search + outlet list */}
            </div>
            
            {/* Right: KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    {/* KPI cards */}
                </div>
            </aside>
        </div>
    );
}
```

- [ ] **Step 3: Implement PembayaranTab component**

```tsx
function PembayaranTab({ payments, statusFilter, kpis }: any) {
    // Move content from current finance/settlement-payments.tsx
    // Include: filter tabs, payment cards, KPI sidebar
    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Filters + Payment Cards */}
            <div>
                {/* Filter tabs + payment list */}
            </div>
            
            {/* Right: KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    {/* KPI cards */}
                </div>
            </aside>
        </div>
    );
}
```

- [ ] **Step 4: Implement RekeningTab component**

```tsx
function RekeningTab({ accounts }: any) {
    // Move content from current finance/payment-accounts.tsx
    // Include: form + account list
    return (
        <div>
            {/* Form + account list */}
        </div>
    );
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

Expected: Build passes

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/owner/finance/index.tsx
git commit -m "feat(owner): create merged finance page with 3 tabs"
```

---

## Task 2: Create Merged Pricing Page

**Files:**
- Create: `resources/js/pages/owner/pricing/index.tsx`

**Interfaces:**
- Consumes: `OwnerKpiCard`
- Produces: Single pricing page with 3 tabs

- [ ] **Step 1: Create new pricing/index.tsx with tab structure**

```tsx
import { router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

const TABS = [
    { key: 'pusat', label: 'Pusat' },
    { key: 'outlet', label: 'Outlet' },
    { key: 'riwayat', label: 'Riwayat' },
];

export default function PricingIndex({ ...props }: any) {
    const [activeTab, setActiveTab] = useState('pusat');
    
    // Sync tab with URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && TABS.some(t => t.key === tab)) {
            setActiveTab(tab);
        }
    }, []);
    
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        router.get('/owner/pricing', { tab }, { preserveState: true, replace: true });
    };
    
    return (
        <OwnerPageShell title="Harga" subtitle="Kelola harga jual produk">
            {/* Tab Pills */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                            activeTab === tab.key
                                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Tab Content */}
            {activeTab === 'pusat' && <PusatTab {...props} />}
            {activeTab === 'outlet' && <OutletTab {...props} />}
            {activeTab === 'riwayat' && <RiwayatTab {...props} />}
        </OwnerPageShell>
    );
}
```

- [ ] **Step 2: Implement PusatTab component**

```tsx
function PusatTab({ kpis, outlets }: any) {
    // Move content from current pricing/index.tsx
    // Include: KPI cards + outlet card grid
    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Outlet card grid */}
            <div>
                {/* Outlet cards */}
            </div>
            
            {/* Right: KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    {/* KPI cards */}
                </div>
            </aside>
        </div>
    );
}
```

- [ ] **Step 3: Implement OutletTab component**

```tsx
function OutletTab({ outlet, variants, outletVariants }: any) {
    // Move content from current pricing/outlet.tsx
    // Include: outlet selector + price grid
    return (
        <div>
            {/* Outlet selector + price grid */}
        </div>
    );
}
```

- [ ] **Step 4: Implement RiwayatTab component**

```tsx
function RiwayatTab({ history }: any) {
    // Move content from current pricing/history.tsx
    // Include: date filter + change list
    return (
        <div>
            {/* Date filter + change list */}
        </div>
    );
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

Expected: Build passes

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/owner/pricing/index.tsx
git commit -m "feat(owner): create merged pricing page with 3 tabs"
```

---

## Task 3: Create Merged Analytics Page

**Files:**
- Create: `resources/js/pages/owner/analytics/index.tsx`

**Interfaces:**
- Consumes: `OwnerKpiCard`
- Produces: Single analytics page with 4 tabs

- [ ] **Step 1: Create new analytics/index.tsx with tab structure**

```tsx
import { router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'laporan', label: 'Laporan' },
    { key: 'masalah', label: 'Masalah' },
];

export default function AnalyticsIndex({ ...props }: any) {
    const [activeTab, setActiveTab] = useState('dashboard');
    
    // Sync tab with URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && TABS.some(t => t.key === tab)) {
            setActiveTab(tab);
        }
    }, []);
    
    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        router.get('/owner/analytics', { tab }, { preserveState: true, replace: true });
    };
    
    return (
        <OwnerPageShell title="Analitik" subtitle="Analitik performa bisnis">
            {/* Tab Pills */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabChange(tab.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                            activeTab === tab.key
                                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                : 'bg-surface-muted text-text-muted hover:bg-zinc-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Tab Content */}
            {activeTab === 'dashboard' && <DashboardTab {...props} />}
            {activeTab === 'audit' && <AuditTrailTab {...props} />}
            {activeTab === 'laporan' && <LaporanTab {...props} />}
            {activeTab === 'masalah' && <MasalahTab {...props} />}
        </OwnerPageShell>
    );
}
```

- [ ] **Step 2: Implement DashboardTab component**

```tsx
function DashboardTab({ kpis, outletRevenue, topProducts, period }: any) {
    // Move content from current analytics/index.tsx
    // Include: period selector, outlet comparison, top products
    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Period selector + outlet comparison + top products */}
            <div>
                {/* Content */}
            </div>
            
            {/* Right: KPI Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    {/* KPI cards */}
                </div>
            </aside>
        </div>
    );
}
```

- [ ] **Step 3: Implement AuditTrailTab component**

```tsx
function AuditTrailTab({ movements, outlets, products, filters }: any) {
    // Move content from current stock-movements/index.tsx
    // Include: filter pills, movement list, stats sidebar
    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Filter pills + movement list */}
            <div>
                {/* Content */}
            </div>
            
            {/* Right: Stats Sidebar */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    {/* Stats cards */}
                </div>
            </aside>
        </div>
    );
}
```

- [ ] **Step 4: Implement LaporanTab component**

```tsx
function LaporanTab({ summary, ordersByStatus, deliveriesByStatus, outlets, filters }: any) {
    // Move content from current reports/index.tsx
    // Include: date filter, export cards, breakdown cards
    return (
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* Left: Breakdown cards */}
            <div>
                {/* Content */}
            </div>
            
            {/* Right: Export + KPI */}
            <aside className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                    {/* Export cards + KPI grid */}
                </div>
            </aside>
        </div>
    );
}
```

- [ ] **Step 5: Implement MasalahTab component**

```tsx
function MasalahTab({ reports, filters }: any) {
    // Move content from current order-reports/index.tsx
    // Include: filter pills, report list
    return (
        <div>
            {/* Filter pills + report list */}
        </div>
    );
}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

Expected: Build passes

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/owner/analytics/index.tsx
git commit -m "feat(owner): create merged analytics page with 4 tabs"
```

---

## Task 4: Update Sidebar Navigation

**Files:**
- Modify: `resources/js/layouts/owner-layout.tsx`

**Interfaces:**
- Consumes: Current navGroups structure
- Produces: Updated navGroups with 13 items

- [ ] **Step 1: Update navGroups**

```tsx
const navGroups: NavGroup[] = [
    {
        label: 'Dasbor',
        icon: <DashboardIcon />,
        items: [{ href: '/owner/dashboard', label: 'Dasbor' }],
    },
    {
        label: 'Operasional',
        icon: <OperationalIcon />,
        items: [
            { href: '/owner/orders', label: 'Pesanan' },
            { href: '/owner/deliveries', label: 'Pengiriman' },
            { href: '/owner/returns', label: 'Pengembalian', badgeKey: 'pendingReturns' },
            { href: '/owner/exchanges', label: 'Penukaran', badgeKey: 'pendingExchanges' },
        ],
    },
    {
        label: 'Keuangan',
        icon: <FinanceIcon />,
        items: [
            { href: '/owner/finance', label: 'Keuangan', isActive: (url: string) => url.split('?')[0] === '/owner/finance' },
        ],
    },
    {
        label: 'Master Data',
        icon: <MasterDataIcon />,
        items: [
            { href: '/owner/outlets', label: 'Outlet' },
            { href: '/owner/products', label: 'Produk', isActive: (url: string) => url.startsWith('/owner/products') || url.startsWith('/owner/product-families') },
            { href: '/owner/pricing', label: 'Harga', isActive: (url: string) => url.split('?')[0] === '/owner/pricing' },
        ],
    },
    {
        label: 'Persediaan',
        icon: <InventoryIcon />,
        items: [
            { href: '/owner/inventories', label: 'Inventaris' },
            { href: '/owner/restocks', label: 'Restock' },
            { href: '/owner/distributions', label: 'Distribusi' },
        ],
    },
    {
        label: 'Analitik',
        icon: <AnalyticsIcon />,
        items: [
            { href: '/owner/analytics', label: 'Analitik', isActive: (url: string) => url.split('?')[0] === '/owner/analytics' },
        ],
    },
];
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add resources/js/layouts/owner-layout.tsx
git commit -m "refactor(owner): update sidebar to 13 items"
```

---

## Task 5: Update Routes

**Files:**
- Modify: `routes/web.php`

**Interfaces:**
- Consumes: Current route structure
- Produces: Updated routes with merged pages

- [ ] **Step 1: Update finance routes**

```php
// Keep: /owner/finance (default tab)
// Delete: /owner/finance/settlement-payments
// Delete: /owner/finance/payment-accounts
```

- [ ] **Step 2: Update pricing routes**

```php
// Keep: /owner/pricing (default tab)
// Delete: /owner/pricing/master
// Delete: /owner/pricing/outlet
// Delete: /owner/pricing/history
```

- [ ] **Step 3: Update analytics routes**

```php
// Keep: /owner/analytics (default tab)
// Delete: /owner/stock-movements
// Delete: /owner/reports
// Delete: /owner/order-reports
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

Expected: Build passes

- [ ] **Step 5: Commit**

```bash
git add routes/web.php
git commit -m "refactor(owner): update routes for merged pages"
```

---

## Task 6: Delete Old Files

**Files:**
- Delete: `resources/js/pages/owner/finance/settlement-payments.tsx`
- Delete: `resources/js/pages/owner/finance/payment-accounts.tsx`
- Delete: `resources/js/pages/owner/pricing/master.tsx`
- Delete: `resources/js/pages/owner/pricing/outlet.tsx`
- Delete: `resources/js/pages/owner/pricing/history.tsx`
- Delete: `resources/js/pages/owner/stock-movements/index.tsx`
- Delete: `resources/js/pages/owner/reports/index.tsx`
- Delete: `resources/js/pages/owner/order-reports/index.tsx`
- Delete: `resources/js/pages/owner/order-reports/show.tsx`

- [ ] **Step 1: Delete old finance files**

```bash
rm resources/js/pages/owner/finance/settlement-payments.tsx
rm resources/js/pages/owner/finance/payment-accounts.tsx
```

- [ ] **Step 2: Delete old pricing files**

```bash
rm resources/js/pages/owner/pricing/master.tsx
rm resources/js/pages/owner/pricing/outlet.tsx
rm resources/js/pages/owner/pricing/history.tsx
```

- [ ] **Step 3: Delete old analytics files**

```bash
rm resources/js/pages/owner/stock-movements/index.tsx
rm resources/js/pages/owner/reports/index.tsx
rm resources/js/pages/owner/order-reports/index.tsx
rm resources/js/pages/owner/order-reports/show.tsx
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/aryaajisadda/Herd/dombi && npm run build 2>&1 | tail -5
```

Expected: Build passes

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(owner): delete old page files"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Verify sidebar shows 13 items**

Check that sidebar has 6 groups with 13 items total.

- [ ] **Step 2: Verify tab navigation works**

Test each merged page:
- `/owner/finance` — tabs: Tagihan, Pembayaran, Rekening
- `/owner/pricing` — tabs: Pusat, Outlet, Riwayat
- `/owner/analytics` — tabs: Dashboard, Audit Trail, Laporan, Masalah

- [ ] **Step 3: Verify URL params persist**

Test that tab state persists when navigating away and back.

- [ ] **Step 4: Verify responsive layout**

Test on mobile and desktop that 2-column layout works correctly.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "refactor(owner): complete dashboard restructuring"
```
