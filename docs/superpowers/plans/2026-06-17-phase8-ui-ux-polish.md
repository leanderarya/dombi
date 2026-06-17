# Phase 8: UI/UX Polish - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konsistensi UI/UX di semua role

**Architecture:** Refactor layouts dan components untuk mobile-first experience

**Tech Stack:** Laravel 13, PHP 8.3, React 19, Inertia.js, Tailwind CSS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `resources/js/layouts/outlet-layout.tsx` | Modify | Add bottom navigation |
| `resources/js/layouts/courier-layout.tsx` | Modify | Add bottom navigation |
| `resources/js/components/ui/skeleton.tsx` | Create | Loading skeleton component |
| `resources/js/components/ui/empty-state.tsx` | Modify | Standardize empty states |
| Various outlet pages | Modify | Replace tables with cards |
| Various courier pages | Modify | Add timeline, sticky actions |
| Various owner pages | Modify | Desktop table views |

---

### Task 1: Outlet Bottom Navigation

**Files:**
- Modify: `resources/js/layouts/outlet-layout.tsx`
- Create: `resources/js/components/outlet-bottom-nav.tsx`

- [ ] **Step 1: Create OutletBottomNav component**

```tsx
import { Link, usePage } from '@inertiajs/react';
import { Home, Package, Truck, DollarSign, BarChart3 } from 'lucide-react';

const navItems = [
    { href: '/outlet/dashboard', label: 'Dashboard', icon: Home },
    { href: '/outlet/orders', label: 'Pesanan', icon: Package },
    { href: '/outlet/deliveries', label: 'Pengiriman', icon: Truck },
    { href: '/outlet/settlement', label: 'Setoran', icon: DollarSign },
    { href: '/outlet/analytics', label: 'Analitik', icon: BarChart3 },
];

export default function OutletBottomNav() {
    const { url } = usePage();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white">
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

- [ ] **Step 2: Update OutletLayout**

Add bottom navigation to the layout:

```tsx
import OutletBottomNav from '@/components/outlet-bottom-nav';

// In the return statement, add OutletBottomNav
```

- [ ] **Step 3: Test**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 4: Commit**

```bash
git add resources/js/layouts/outlet-layout.tsx resources/js/components/outlet-bottom-nav.tsx
git commit -m "feat: add outlet bottom navigation for mobile"
```

---

### Task 2: Loading Skeleton Component

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
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/ui/skeleton.tsx
git commit -m "feat: add skeleton loading components"
```

---

### Task 3: Standardize Empty States

**Files:**
- Modify: `resources/js/components/ui/empty-state.tsx`

- [ ] **Step 1: Update EmptyState component**

```tsx
import { ReactNode } from 'react';

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="mb-4 text-zinc-400">{icon}</div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
            {description && (
                <p className="text-xs text-zinc-500 mb-4 max-w-xs">{description}</p>
            )}
            {action && <div>{action}</div>}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/components/ui/empty-state.tsx
git commit -m "refactor: standardize empty state component"
```

---

### Task 4: Outlet Inventory Cards

**Files:**
- Modify: `resources/js/pages/outlet/inventory.tsx`

- [ ] **Step 1: Replace table with cards**

Update the inventory page to use card-based layout instead of table:

```tsx
// Replace table rows with cards like:
<div className="rounded-xl border border-zinc-200 bg-white p-4">
    <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-900">{item.product_name}</div>
        <StockLevelBadge level={item.stock_level} />
    </div>
    <div className="text-xs text-zinc-500">{item.variant_name}</div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
            <div className="text-[11px] text-zinc-500">Stok</div>
            <div className="text-sm font-semibold text-slate-900">{item.current_stock}</div>
        </div>
        <div>
            <div className="text-[11px] text-zinc-500">Reserved</div>
            <div className="text-sm font-semibold text-slate-900">{item.reserved_stock}</div>
        </div>
        <div>
            <div className="text-[11px] text-zinc-500">Available</div>
            <div className="text-sm font-semibold text-slate-900">{item.available}</div>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/outlet/inventory.tsx
git commit -m "refactor: replace inventory table with card-based layout"
```

---

### Task 5: Courier Delivery Timeline

**Files:**
- Modify: `resources/js/pages/courier/deliveries/show.tsx`

- [ ] **Step 1: Add delivery timeline**

Add timeline component similar to customer order timeline:

```tsx
// Add status history timeline
{delivery.status_histories && delivery.status_histories.length > 0 && (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Timeline</div>
        <div className="space-y-3">
            {delivery.status_histories.map((history, index) => (
                <div key={history.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                        <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                            index === 0 ? 'bg-emerald-500' : 'bg-zinc-300'
                        }`} />
                        {index < delivery.status_histories.length - 1 && (
                            <div className="w-px flex-1 bg-zinc-200" />
                        )}
                    </div>
                    <div className="flex-1 pb-3">
                        <div className="text-sm font-medium text-slate-900">{history.to_status}</div>
                        {history.notes && (
                            <div className="text-[11px] text-zinc-500">{history.notes}</div>
                        )}
                        <div className="text-[11px] text-zinc-400">{history.created_at}</div>
                    </div>
                </div>
            ))}
        </div>
    </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/courier/deliveries/show.tsx
git commit -m "feat: add delivery timeline to courier delivery detail"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Run linter: `./vendor/bin/pint --test`
3. Build frontend: `npm run build`
4. Test all UI changes manually
5. Verify mobile responsiveness

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1. Outlet Bottom Navigation | Mobile navigation bar | 1d |
| 2. Loading Skeleton | Reusable skeleton component | 0.5d |
| 3. Standardize Empty States | Consistent empty state component | 0.5d |
| 4. Outlet Inventory Cards | Replace tables with cards | 1d |
| 5. Courier Delivery Timeline | Status history timeline | 1d |
| **Total** | | **4d** |

**Note:** Full UI/UX polish membutuhkan ~16 hari. Plan ini mencakup task utama saja. Task lain bisa ditambahkan sesuai kebutuhan.
