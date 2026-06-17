# Phase 8: UI/UX Polish - Detailed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all HIGH and MEDIUM UI/UX issues for consistency across all roles

**Architecture:** Refactor existing components, add shared utilities, standardize patterns

**Tech Stack:** Laravel 13, PHP 8.3, React 19, Inertia.js, Tailwind CSS

---

## Issues to Fix

### HIGH Priority
1. No skeleton/loading component → poor perceived performance
2. `outlet/settlement-payments.tsx` missing layout wrapper → broken UX
3. Owner layout has no mobile responsiveness → unusable on mobile

### MEDIUM Priority
4. 4 pages use raw `<table>` instead of DataTable → inconsistent
5. 7 domain-specific badge components with inconsistent styling
6. Inline StatusBadge in `track.tsx` → code duplication
7. `owner/deliveries/show.tsx` not using OwnerPageShell → missing Head tag

---

## Task 1: Create Skeleton Loading Component

**Files:**
- Create: `resources/js/components/ui/skeleton.tsx`

- [ ] **Step 1: Create Skeleton component**

```tsx
interface SkeletonProps {
    className?: string;
    count?: number;
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className={`animate-pulse rounded-lg bg-zinc-200 ${className}`}
                />
            ))}
        </>
    );
}

export function SkeletonCard() {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
        </div>
    );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export function SkeletonKpi() {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <Skeleton className="h-3 w-1/4 mb-2" />
            <Skeleton className="h-6 w-1/2" />
        </div>
    );
}

export function SkeletonKpiGrid({ count = 3 }: { count?: number }) {
    return (
        <div className={`grid gap-3 ${count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonKpi key={i} />
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/skeleton.tsx
git commit -m "feat: add skeleton loading components (Skeleton, SkeletonCard, SkeletonList, SkeletonKpi)"
```

---

## Task 2: Fix outlet/settlement-payments.tsx Missing Layout

**Files:**
- Modify: `resources/js/pages/outlet/settlement-payments.tsx`

- [ ] **Step 1: Add OutletLayout wrapper**

Current file uses `<>...</>` fragment. Wrap with `OutletLayout`:

```tsx
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

// ... component code ...

return (
    <OutletLayout title="Riwayat Pembayaran" subtitle="Daftar pembayaran yang sudah dikirim">
        <Head title="Riwayat Pembayaran" />
        
        {/* Rest of the content */}
    </OutletLayout>
);
```

- [ ] **Step 2: Replace inline status badges with StatusBadge component**

Replace:
```tsx
<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[payment.status]}`}>
    {statusLabels[payment.status]}
</span>
```

With:
```tsx
<StatusBadge variant={statusVariants[payment.status]}>
    {statusLabels[payment.status]}
</StatusBadge>
```

Add variant mapping:
```tsx
const statusVariants: Record<string, 'success' | 'warning' | 'danger'> = {
    pending_verification: 'warning',
    verified: 'success',
    rejected: 'danger',
};
```

- [ ] **Step 3: Replace inline empty state with EmptyState component**

Replace:
```tsx
<div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
    <p className="text-sm text-zinc-500">Belum ada pembayaran</p>
</div>
```

With:
```tsx
<EmptyState
    icon={<Receipt className="h-8 w-8 text-slate-400" />}
    title="Belum ada pembayaran"
    description="Riwayat pembayaran Anda akan muncul di sini"
/>
```

- [ ] **Step 4: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/outlet/settlement-payments.tsx
git commit -m "fix: wrap outlet settlement-payments with OutletLayout and use shared components"
```

---

## Task 3: Add Mobile Responsiveness to Owner Layout

**Files:**
- Modify: `resources/js/layouts/owner-layout.tsx`
- Create: `resources/js/components/owner-mobile-nav.tsx`

- [ ] **Step 1: Create OwnerMobileNav component**

```tsx
import { Link, usePage } from '@inertiajs/react';
import { Home, Package, Truck, DollarSign, MoreHorizontal } from 'lucide-react';

const navItems = [
    { href: '/owner/dashboard', label: 'Dashboard', icon: Home },
    { href: '/owner/orders', label: 'Pesanan', icon: Package },
    { href: '/owner/deliveries', label: 'Pengiriman', icon: Truck },
    { href: '/owner/finance', label: 'Keuangan', icon: DollarSign },
    { href: '/owner/more', label: 'Lainnya', icon: MoreHorizontal },
];

export default function OwnerMobileNav() {
    const { url } = usePage();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white lg:hidden">
            <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
                {navItems.map((item) => {
                    const isActive = url === item.href || url.startsWith(item.href + '/');
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                                isActive
                                    ? 'text-emerald-600'
                                    : 'text-zinc-500 active:text-emerald-600'
                            }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
```

- [ ] **Step 2: Update OwnerLayout for responsive design**

Add mobile detection and responsive classes:

```tsx
// Add state for mobile sidebar
const [sidebarOpen, setSidebarOpen] = useState(false);

// Update sidebar classes
<aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-zinc-200 bg-white transform transition-transform lg:translate-x-0 lg:w-56 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

// Add mobile hamburger button
<button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-zinc-200">
    <Menu className="h-5 w-5" />
</button>

// Add overlay for mobile
{sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

// Update main content padding
<main className="pl-0 lg:pl-56 pb-20 lg:pb-0">
```

- [ ] **Step 3: Add OwnerMobileNav to layout**

```tsx
import OwnerMobileNav from '@/components/owner-mobile-nav';

// In return statement, add before closing div:
<OwnerMobileNav />
```

- [ ] **Step 4: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 5: Commit**

```bash
git add resources/js/layouts/owner-layout.tsx resources/js/components/owner-mobile-nav.tsx
git commit -m "feat: add mobile responsiveness to owner layout with bottom nav"
```

---

## Task 4: Fix owner/deliveries/show.tsx to Use OwnerPageShell

**Files:**
- Modify: `resources/js/pages/owner/deliveries/show.tsx`

- [ ] **Step 1: Add OwnerPageShell wrapper**

Replace direct `OwnerLayout` usage with `OwnerPageShell`:

```tsx
import OwnerPageShell from '@/components/owner/owner-page-shell';

// Replace:
// <OwnerLayout>
//     <Head title="..." />
//     ...content...
// </OwnerLayout>

// With:
<OwnerPageShell
    title={`Pengiriman #${delivery.id}`}
    subtitle={delivery.order?.order_code}
    backHref="/owner/deliveries"
>
    ...content...
</OwnerPageShell>
```

- [ ] **Step 2: Remove duplicate Head and header HTML**

Remove manual `<Head>` tag and header div since `OwnerPageShell` handles these.

- [ ] **Step 3: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/deliveries/show.tsx
git commit -m "fix: use OwnerPageShell in owner deliveries show page"
```

---

## Task 5: Standardize Status Badge Components

**Files:**
- Modify: `resources/js/components/order-status-badge.tsx`
- Modify: `resources/js/components/restock-status-badge.tsx`
- Modify: `resources/js/components/distribution-status-badge.tsx`
- Modify: `resources/js/components/stock-level-badge.tsx`
- Modify: `resources/js/components/owner/outlet-status-badge.tsx`

- [ ] **Step 1: Create shared badge base styles**

Add to `resources/js/components/ui/status-badge.tsx` if needed, or create a helper:

```tsx
// Standard badge styles
export const badgeStyles = {
    base: 'inline-flex items-center rounded-full font-bold',
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-[11px]',
    lg: 'px-3 py-1 text-xs',
};
```

- [ ] **Step 2: Update OrderStatusBadge**

Standardize padding and font weight to match shared `StatusBadge`:

```tsx
// Change from: px-3 py-1 text-xs font-medium
// Change to: px-2.5 py-0.5 text-[11px] font-bold
```

- [ ] **Step 3: Update RestockStatusBadge**

Fix color palette from `green` to `emerald`:

```tsx
// Change from: bg-green-100 text-green-800
// Change to: bg-emerald-50 text-emerald-700
```

- [ ] **Step 4: Update DistributionStatusBadge**

Same color fix as RestockStatusBadge.

- [ ] **Step 5: Update StockLevelBadge**

Fix color palette:

```tsx
// Change from: bg-green-100 text-green-800
// Change to: bg-emerald-50 text-emerald-700
```

- [ ] **Step 6: Update OutletStatusBadge**

Add ring borders for consistency:

```tsx
className="ring-1 ring-inset ring-current/10"
```

- [ ] **Step 7: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/order-status-badge.tsx resources/js/components/restock-status-badge.tsx resources/js/components/distribution-status-badge.tsx resources/js/components/stock-level-badge.tsx resources/js/components/owner/outlet-status-badge.tsx
git commit -m "refactor: standardize status badge styling across all domain badges"
```

---

## Task 6: Fix Inline StatusBadge in track.tsx

**Files:**
- Modify: `resources/js/pages/track.tsx`

- [ ] **Step 1: Import OrderStatusBadge**

```tsx
import OrderStatusBadge from '@/components/order-status-badge';
```

- [ ] **Step 2: Replace inline StatusBadge function**

Remove the inline `StatusBadge` function (lines 365-399) and use `OrderStatusBadge` instead:

```tsx
// Replace:
// <StatusBadge status={item.status} />

// With:
<OrderStatusBadge status={item.status} />
```

- [ ] **Step 3: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/track.tsx
git commit -m "refactor: use OrderStatusBadge instead of inline StatusBadge in track page"
```

---

## Task 7: Convert Raw Tables to DataTable (Optional - if time permits)

**Files:**
- Modify: `resources/js/pages/owner/pricing/history.tsx`
- Modify: `resources/js/pages/owner/finance/outlet-detail.tsx`

**Note:** `pricing/master.tsx` and `pricing/outlet.tsx` have complex custom tables with bulk operations - keep as-is.

- [ ] **Step 1: Convert pricing/history.tsx**

Replace raw `<table>` with `DataTable` component:

```tsx
import DataTable from '@/components/ui/data-table';

// Define columns
const columns = [
    { key: 'created_at', label: 'Tanggal', render: (row) => formatDate(row.created_at) },
    { key: 'outlet_name', label: 'Outlet' },
    { key: 'product_name', label: 'Produk' },
    { key: 'old_price', label: 'Harga Lama', render: (row) => formatCurrency(row.old_price) },
    { key: 'new_price', label: 'Harga Baru', render: (row) => formatCurrency(row.new_price) },
    { key: 'changed_by', label: 'Diubah Oleh' },
];

// Use DataTable
<DataTable columns={columns} data={history} emptyMessage="Belum ada riwayat" />
```

- [ ] **Step 2: Convert finance/outlet-detail.tsx**

Replace raw `<table>` with `DataTable` for settlement list.

- [ ] **Step 3: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/pricing/history.tsx resources/js/pages/owner/finance/outlet-detail.tsx
git commit -m "refactor: convert raw tables to DataTable component"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Run linter: `./vendor/bin/pint --test`
3. Build frontend: `npm run build`
4. Test all UI changes manually on mobile and desktop
5. Verify all pages render correctly

## Summary

| Task | Description | Priority | Est. |
|------|-------------|----------|------|
| 1. Skeleton Component | Loading states for all pages | HIGH | 0.5d |
| 2. Fix settlement-payments | Add layout + shared components | HIGH | 0.5d |
| 3. Owner Mobile Responsiveness | Hamburger menu + bottom nav | HIGH | 1.5d |
| 4. Fix deliveries/show | Use OwnerPageShell | MEDIUM | 0.5d |
| 5. Standardize Badges | Consistent styling | MEDIUM | 1d |
| 6. Fix track.tsx | Remove inline badge | MEDIUM | 0.5d |
| 7. Convert Tables | Use DataTable component | MEDIUM | 1d |
| **Total** | | | **5.5d** |

---

## Files Changed Summary

| File | Action |
|------|--------|
| `resources/js/components/ui/skeleton.tsx` | Create |
| `resources/js/components/owner-mobile-nav.tsx` | Create |
| `resources/js/layouts/owner-layout.tsx` | Modify |
| `resources/js/pages/outlet/settlement-payments.tsx` | Modify |
| `resources/js/pages/owner/deliveries/show.tsx` | Modify |
| `resources/js/pages/track.tsx` | Modify |
| `resources/js/components/order-status-badge.tsx` | Modify |
| `resources/js/components/restock-status-badge.tsx` | Modify |
| `resources/js/components/distribution-status-badge.tsx` | Modify |
| `resources/js/components/stock-level-badge.tsx` | Modify |
| `resources/js/components/owner/outlet-status-badge.tsx` | Modify |
| `resources/js/pages/owner/pricing/history.tsx` | Modify |
| `resources/js/pages/owner/finance/outlet-detail.tsx` | Modify |
