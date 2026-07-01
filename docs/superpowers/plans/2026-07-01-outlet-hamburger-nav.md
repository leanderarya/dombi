# Outlet Hamburger Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace outlet bottom navigation with a hamburger menu that opens a grouped side sheet, making all outlet features discoverable from any page.

**Architecture:** New `SideSheet` component (slide from left) wraps a grouped navigation list (`OutletNavigationSheet`). Badge counts fetched via polling hook `useOutletBadges`. `PageHeader` gains hamburger icon support. Bottom nav and old more-sheet removed.

**Tech Stack:** React, Inertia.js, Tailwind CSS v4, lucide-react, Laravel PHP

## Global Constraints

- All touch targets minimum 44px (h-11 w-11)
- Use `createPortal` for modal/sheet rendering
- Use `usePage().url` for active page detection
- Follow existing polling pattern from `useOrderAlert`
- Text in Indonesian (Bahasa)
- Emerald color scheme for active states

---

### Task 1: Backend — Badge Counts Endpoint

**Files:**
- Modify: `app/Http/Controllers/Outlet/DashboardController.php`
- Modify: `routes/web.php:264-295`

**Interfaces:**
- Produces: `GET /outlet/badge-counts` → `{ returns: number, exchanges: number, restocks: number, deliveries: number, payments: number, reports: number }`

- [ ] **Step 1: Add `badgeCounts()` method to DashboardController**

```php
// app/Http/Controllers/Outlet/DashboardController.php
// Add after the more() method:

public function badgeCounts(): array
{
    $outlet = auth()->user()->outlet;
    abort_unless($outlet, 403);

    return [
        'returns' => ReturnRequest::where('outlet_id', $outlet->id)
            ->whereIn('status', ['submitted', 'approved'])
            ->count(),
        'exchanges' => ExchangeRequest::where('outlet_id', $outlet->id)
            ->whereIn('status', ['submitted', 'approved', 'preparing', 'shipped'])
            ->count(),
        'restocks' => RestockRequest::where('outlet_id', $outlet->id)
            ->whereIn('status', ['requested', 'preparing', 'shipped'])
            ->count(),
        'deliveries' => Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
            ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
            ->count(),
        'payments' => SettlementPayment::where('outlet_id', $outlet->id)
            ->where('status', SettlementPayment::STATUS_PENDING)
            ->count(),
        'reports' => OrderReport::whereHas('order', fn ($q) => $q->where('outlet_id', $outlet->id))
            ->active()
            ->count(),
    ];
}
```

- [ ] **Step 2: Add route**

```php
// routes/web.php — inside the outlet middleware group (after line 266):
Route::get('/badge-counts', [DashboardController::class, 'badgeCounts'])->name('badge-counts');
```

- [ ] **Step 3: Verify endpoint works**

```bash
# Start dev server if not running
php artisan serve &
# Test endpoint (will return 401 without auth, but should not 500)
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/outlet/badge-counts
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Outlet/DashboardController.php routes/web.php
git commit -m "feat: add outlet badge-counts endpoint"
```

---

### Task 2: Hook — useOutletBadges

**Files:**
- Create: `resources/js/hooks/use-outlet-badges.ts`

**Interfaces:**
- Produces: `useOutletBadges(): { badgeCounts: OutletBadgeCounts, isLoading: boolean }`
- Type: `OutletBadgeCounts = { returns: number, exchanges: number, restocks: number, deliveries: number, payments: number, reports: number }`

- [ ] **Step 1: Create the hook**

```typescript
// resources/js/hooks/use-outlet-badges.ts
import { useEffect, useRef, useState } from 'react';

export interface OutletBadgeCounts {
    returns: number;
    exchanges: number;
    restocks: number;
    deliveries: number;
    payments: number;
    reports: number;
}

const EMPTY_COUNTS: OutletBadgeCounts = {
    returns: 0,
    exchanges: 0,
    restocks: 0,
    deliveries: 0,
    payments: 0,
    reports: 0,
};

export function useOutletBadges() {
    const [badgeCounts, setBadgeCounts] = useState<OutletBadgeCounts>(EMPTY_COUNTS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const res = await fetch('/outlet/badge-counts');
                if (!res.ok) return;
                const data = await res.json();
                setBadgeCounts({
                    returns: data.returns ?? 0,
                    exchanges: data.exchanges ?? 0,
                    restocks: data.restocks ?? 0,
                    deliveries: data.deliveries ?? 0,
                    payments: data.payments ?? 0,
                    reports: data.reports ?? 0,
                });
            } catch {
                // Silently fail
            } finally {
                setIsLoading(false);
            }
        };

        fetchCounts();
        const interval = setInterval(fetchCounts, 30_000);

        return () => clearInterval(interval);
    }, []);

    return { badgeCounts, isLoading };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "use-outlet-badges"
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/hooks/use-outlet-badges.ts
git commit -m "feat: add useOutletBadges polling hook"
```

---

### Task 3: UI Component — SideSheet

**Files:**
- Create: `resources/js/components/ui/side-sheet.tsx`

**Interfaces:**
- Produces: `SideSheet({ open, onClose, side, width, children })`
- Props: `open: boolean`, `onClose: () => void`, `side?: 'left' | 'right'`, `width?: string`, `children: ReactNode`

- [ ] **Step 1: Create SideSheet component**

```tsx
// resources/js/components/ui/side-sheet.tsx
import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
    open: boolean;
    onClose: () => void;
    /** Slide from left or right (default: 'left') */
    side?: 'left' | 'right';
    /** Width as CSS value (default: '80%') */
    width?: string;
    children: ReactNode;
}

export default function SideSheet({ open, onClose, side = 'left', width = '80%', children }: Props) {
    const touchStartRef = useRef<{ x: number; time: number } | null>(null);
    const [translateX, setTranslateX] = React.useState(0);

    // Scroll lock
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            setTranslateX(0);
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Escape key
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    // Swipe to close
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            time: Date.now(),
        };
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        // Only allow dragging in close direction
        if (side === 'left' && deltaX < 0) {
            setTranslateX(deltaX);
        } else if (side === 'right' && deltaX > 0) {
            setTranslateX(deltaX);
        }
    }, [side]);

    const handleTouchEnd = useCallback(() => {
        if (!touchStartRef.current) return;
        const velocity = Math.abs(translateX) / (Date.now() - touchStartRef.current.time);
        const threshold = 80;
        const velocityThreshold = 0.5;

        if (Math.abs(translateX) > threshold || velocity > velocityThreshold) {
            onClose();
        }

        setTranslateX(0);
        touchStartRef.current = null;
    }, [translateX, onClose]);

    if (!open) return null;

    const isDragging = translateX !== 0;
    const maxWidth = '320px';

    return createPortal(
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-slate-950/50"
                onClick={onClose}
                style={{ opacity: isDragging ? Math.max(0, 1 - Math.abs(translateX) / 300) : 1 }}
            />

            {/* Sheet */}
            <div
                className={`absolute top-0 bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} flex flex-col bg-white shadow-xl`}
                style={{
                    width,
                    maxWidth,
                    transform: `translateX(${translateX}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "side-sheet"
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/side-sheet.tsx
git commit -m "feat: add SideSheet component"
```

---

### Task 4: UI Component — OutletNavigationSheet

**Files:**
- Create: `resources/js/components/outlet-navigation-sheet.tsx`

**Interfaces:**
- Consumes: `SideSheet` (Task 3), `OutletBadgeCounts` (Task 2), `usePage().url`, `router.post('/logout')`
- Produces: `OutletNavigationSheet({ open, onClose, pendingCount, badgeCounts, outletName, userName })`

- [ ] **Step 1: Create OutletNavigationSheet component**

```tsx
// resources/js/components/outlet-navigation-sheet.tsx
import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard, Package, QrCode, Box, Truck, PackagePlus, ShoppingBag,
    BarChart3, FileText, AlertTriangle, RotateCcw, Repeat2, Receipt, LogOut,
} from 'lucide-react';
import SideSheet from '@/components/ui/side-sheet';
import type { OutletBadgeCounts } from '@/hooks/use-outlet-badges';
import type { ReactNode } from 'react';

interface NavItem {
    href: string;
    label: string;
    icon: ReactNode;
    badgeKey?: keyof OutletBadgeCounts | 'orders';
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const navGroups: NavGroup[] = [
    {
        label: 'Utama',
        items: [
            { href: '/outlet/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
            { href: '/outlet/orders', label: 'Pesanan', icon: <Package className="h-5 w-5" />, badgeKey: 'orders' },
            { href: '/outlet/scan', label: 'Scan QR', icon: <QrCode className="h-5 w-5" /> },
        ],
    },
    {
        label: 'Operasional',
        items: [
            { href: '/outlet/inventory', label: 'Inventaris', icon: <Box className="h-5 w-5" /> },
            { href: '/outlet/deliveries', label: 'Pengiriman', icon: <Truck className="h-5 w-5" />, badgeKey: 'deliveries' },
            { href: '/outlet/restocks', label: 'Restock', icon: <PackagePlus className="h-5 w-5" />, badgeKey: 'restocks' },
            { href: '/outlet/offline-sales', label: 'Penjualan Offline', icon: <ShoppingBag className="h-5 w-5" /> },
        ],
    },
    {
        label: 'Pelaporan',
        items: [
            { href: '/outlet/analytics', label: 'Analitik', icon: <BarChart3 className="h-5 w-5" /> },
            { href: '/outlet/reports', label: 'Laporan Penjualan', icon: <FileText className="h-5 w-5" /> },
            { href: '/outlet/order-reports', label: 'Laporan Masalah', icon: <AlertTriangle className="h-5 w-5" />, badgeKey: 'reports' },
        ],
    },
    {
        label: 'Pengembalian',
        items: [
            { href: '/outlet/returns', label: 'Return Produk', icon: <RotateCcw className="h-5 w-5" />, badgeKey: 'returns' },
            { href: '/outlet/exchanges', label: 'Tukar Produk', icon: <Repeat2 className="h-5 w-5" />, badgeKey: 'exchanges' },
        ],
    },
    {
        label: 'Keuangan',
        items: [
            { href: '/outlet/settlement-payments', label: 'Riwayat Pembayaran', icon: <Receipt className="h-5 w-5" />, badgeKey: 'payments' },
        ],
    },
];

interface Props {
    open: boolean;
    onClose: () => void;
    pendingCount: number;
    badgeCounts: OutletBadgeCounts;
    outletName?: string;
    userName?: string;
}

export default function OutletNavigationSheet({ open, onClose, pendingCount, badgeCounts, outletName, userName }: Props) {
    const { url } = usePage();

    const isItemActive = (item: NavItem): boolean => {
        const pathname = url.split('?')[0];
        return pathname === item.href || pathname.startsWith(item.href + '/');
    };

    const getBadgeCount = (item: NavItem): number => {
        if (!item.badgeKey) return 0;
        if (item.badgeKey === 'orders') return pendingCount;
        return badgeCounts[item.badgeKey as keyof OutletBadgeCounts] ?? 0;
    };

    return (
        <SideSheet open={open} onClose={onClose}>
            {/* Header */}
            <div className="border-b border-border px-5 pt-5 pb-4">
                <div className="rounded-lg bg-primary px-3 py-2 text-lg font-semibold text-white">Dombi</div>
                {outletName && <div className="mt-3 text-sm font-medium text-text">{outletName}</div>}
                {userName && <div className="text-[11px] text-text-subtle">Selamat datang, {userName}</div>}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-3">
                {navGroups.map((group, groupIndex) => (
                    <div key={group.label} className={groupIndex > 0 ? 'mt-3' : ''}>
                        <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                            {group.label}
                        </div>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = isItemActive(item);
                                const badgeCount = getBadgeCount(item);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onClose}
                                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-all duration-150 ${
                                            active
                                                ? 'bg-emerald-50 font-semibold text-emerald-700'
                                                : 'font-medium text-text-muted active:bg-surface-muted'
                                        }`}
                                    >
                                        <span className={`h-5 w-5 shrink-0 ${active ? 'text-emerald-600' : 'text-text-subtle'}`}>
                                            {item.icon}
                                        </span>
                                        <span className="flex-1">{item.label}</span>
                                        {badgeCount > 0 && (
                                            <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                                                {badgeCount > 99 ? '99+' : badgeCount}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="border-t border-border px-3 py-3">
                <button
                    type="button"
                    onClick={() => { onClose(); router.post('/logout'); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-red-600 active:bg-red-50"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Keluar</span>
                </button>
            </div>
        </SideSheet>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "outlet-navigation-sheet"
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/outlet-navigation-sheet.tsx
git commit -m "feat: add OutletNavigationSheet component"
```

---

### Task 5: Update PageHeader — Add Hamburger Support

**Files:**
- Modify: `resources/js/components/ui/page-header.tsx`

**Interfaces:**
- Consumes: existing props + new `onMenuClick?: () => void`
- Produces: hamburger icon rendered when `onMenuClick` provided, back button still works alongside it

- [ ] **Step 1: Add `onMenuClick` prop and hamburger rendering**

```tsx
// resources/js/components/ui/page-header.tsx
import { Link } from '@inertiajs/react';
import { ChevronLeft, Menu } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
    title?: string;
    subtitle?: string;
    backHref?: string;
    /** Rendered on the right side of the header */
    right?: ReactNode;
    /** Rendered below the title row (e.g. filter chips) */
    below?: ReactNode;
    /** Make header transparent (no background/border) */
    transparent?: boolean;
    /** Show hamburger menu icon */
    onMenuClick?: () => void;
}

export default function PageHeader({ title, subtitle, backHref, right, below, transparent, onMenuClick }: Props) {
    return (
        <header className={`sticky top-0 z-30 ${transparent ? '' : 'border-b border-border bg-surface/95 backdrop-blur'}`}>
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                {/* Left side: back button, hamburger, or spacer */}
                <div className="flex items-center gap-1">
                    {backHref && (
                        <Link href={backHref} className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted">
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                    )}
                    {onMenuClick && (
                        <button
                            type="button"
                            onClick={onMenuClick}
                            aria-label="Menu"
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-text-muted active:bg-surface-muted"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    )}
                    {!backHref && !onMenuClick && <div className="w-11" />}
                </div>

                {title ? (
                    <div className="text-center">
                        <div className="text-sm font-semibold text-text">{title}</div>
                        {subtitle && <div className="text-[11px] text-text-muted">{subtitle}</div>}
                    </div>
                ) : (
                    <div />
                )}

                {right ?? <div className="w-11" />}
            </div>
            {below && (
                <div className="mx-auto max-w-lg px-4 pb-3">
                    {below}
                </div>
            )}
        </header>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "page-header"
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/page-header.tsx
git commit -m "feat: add hamburger icon support to PageHeader"
```

---

### Task 6: Update OutletLayout — Replace Bottom Nav with Side Sheet

**Files:**
- Modify: `resources/js/layouts/outlet-layout.tsx`

**Interfaces:**
- Consumes: `useOrderAlert` (existing), `useOutletBadges` (Task 2), `OutletNavigationSheet` (Task 4), `PageHeader` with `onMenuClick` (Task 5)
- Produces: same layout API (`title`, `subtitle`, `backHref`, `hideNav`, `headerBelow`, `headerRight`)

- [ ] **Step 1: Rewrite OutletLayout**

```tsx
// resources/js/layouts/outlet-layout.tsx
import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PropsWithChildren } from 'react';
import NotificationBell from '@/components/notification-bell';
import NotificationSheet from '@/components/notification-sheet';
import OutletNavigationSheet from '@/components/outlet-navigation-sheet';
import MobileRoleLayout from '@/components/ui/mobile-role-layout';
import PageHeader from '@/components/ui/page-header';
import { useOrderAlert } from '@/hooks/use-order-alert';
import { useOutletBadges } from '@/hooks/use-outlet-badges';
import { usePushNotification } from '@/hooks/use-push-notification';

interface Props extends PropsWithChildren {
    title?: string;
    subtitle?: string;
    backHref?: string;
    /** @deprecated No longer used — hamburger nav is always visible. Kept for backward compatibility. */
    hideNav?: boolean;
    /** Extra content below the header (e.g. filter chips) */
    headerBelow?: ReactNode;
    /** Right-side header actions */
    headerRight?: ReactNode;
}

export default function OutletLayout({ children, title, subtitle, backHref, headerBelow, headerRight }: Props) {
    const page = usePage<any>();
    const { auth } = page.props;
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [navOpen, setNavOpen] = useState(false);
    const { pendingCount } = useOrderAlert();
    const { badgeCounts } = useOutletBadges();
    usePushNotification();

    const rightSlot = headerRight ?? (
        <NotificationBell onClick={() => setNotificationOpen(true)} />
    );

    return (
        <MobileRoleLayout>
            <PageHeader
                title={title}
                subtitle={subtitle}
                backHref={backHref}
                onMenuClick={() => setNavOpen(true)}
                right={rightSlot}
                below={headerBelow}
            />
            {children}
            <NotificationSheet open={notificationOpen} onClose={() => setNotificationOpen(false)} />
            <OutletNavigationSheet
                open={navOpen}
                onClose={() => setNavOpen(false)}
                pendingCount={pendingCount}
                badgeCounts={badgeCounts}
                outletName={auth?.outlet?.name}
                userName={auth?.user?.name}
            />
        </MobileRoleLayout>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "outlet-layout"
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add resources/js/layouts/outlet-layout.tsx
git commit -m "feat: replace bottom nav with side sheet in OutletLayout"
```

---

### Task 7: Update MobileRoleLayout — Remove Bottom Nav Support

**Files:**
- Modify: `resources/js/components/ui/mobile-role-layout.tsx`

**Interfaces:**
- Produces: simplified `MobileRoleLayout({ children, footerSlot })` — no more `bottomNav`/`hideBottomNav` props

- [ ] **Step 1: Simplify MobileRoleLayout**

```tsx
// resources/js/components/ui/mobile-role-layout.tsx
import type { PropsWithChildren, ReactNode } from 'react';
import OfflineBanner from '@/components/offline-banner';
import { useFlashToast } from '@/hooks/use-flash-toast';

interface Props extends PropsWithChildren {
    /** Optional floating footer slot (e.g. active order bar) */
    footerSlot?: ReactNode;
}

export default function MobileRoleLayout({ children, footerSlot }: Props) {
    useFlashToast();

    const bottomPad = footerSlot
        ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]'
        : 'pb-8';

    return (
        <div className="min-h-dvh bg-surface text-text">
            <OfflineBanner />

            <main className={`mx-auto max-w-lg px-4 ${bottomPad}`}>
                {children}
            </main>

            {footerSlot}
        </div>
    );
}
```

- [ ] **Step 2: Check for other consumers of removed props**

```bash
grep -rn "bottomNav\|hideBottomNav" resources/js/ --include="*.tsx" --include="*.ts"
```

Expected: no results (all consumers should have been updated in Task 6)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "mobile-role-layout"
```

Expected: no output (no errors)

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/ui/mobile-role-layout.tsx
git commit -m "refactor: remove bottom nav support from MobileRoleLayout"
```

---

### Task 8: Cleanup — Remove Old Files

**Files:**
- Delete: `resources/js/components/outlet-bottom-nav.tsx`
- Delete: `resources/js/components/outlet/outlet-more-sheet.tsx`
- Delete: `resources/js/pages/outlet/more.tsx`
- Delete: `resources/js/components/ui/bottom-sheet.tsx` (only if no other consumers)

**Interfaces:**
- None (cleanup only)

- [ ] **Step 1: Check BottomSheet consumers before deleting**

```bash
grep -rn "bottom-sheet\|BottomSheet" resources/js/ --include="*.tsx" --include="*.ts" | grep -v "outlet-more-sheet\|outlet-bottom-nav"
```

If there are other consumers, keep `bottom-sheet.tsx`. Only delete if no other imports exist.

- [ ] **Step 2: Delete old files**

```bash
rm resources/js/components/outlet-bottom-nav.tsx
rm resources/js/components/outlet/outlet-more-sheet.tsx
rm resources/js/pages/outlet/more.tsx
# Only if no other consumers:
# rm resources/js/components/ui/bottom-sheet.tsx
```

- [ ] **Step 3: Remove unused route**

```php
// routes/web.php — remove the /more route (line 266):
// Route::get('/more', [DashboardController::class, 'more'])->name('more');
```

- [ ] **Step 4: Remove unused method from DashboardController**

```php
// app/Http/Controllers/Outlet/DashboardController.php
// Remove the more() method (lines 124-150)
```

- [ ] **Step 5: Remove `hideNav` from consumer pages**

`hideNav` is passed by 10+ detail/create pages. Since the prop is now deprecated (kept for backward compat), optionally clean up the consumers:

```bash
# List all pages using hideNav
grep -rn "hideNav" resources/js/pages/outlet/ --include="*.tsx"
```

For each file, remove the `hideNav` prop from the `<OutletLayout>` call. Example:

```tsx
// Before:
<OutletLayout title={order.order_code} backHref="/outlet/orders" hideNav>
// After:
<OutletLayout title={order.order_code} backHref="/outlet/orders">
```

Files to update:
- `resources/js/pages/outlet/deliveries/show.tsx`
- `resources/js/pages/outlet/exchanges/create.tsx`
- `resources/js/pages/outlet/exchanges/show.tsx`
- `resources/js/pages/outlet/order-reports/show.tsx`
- `resources/js/pages/outlet/orders/show.tsx`
- `resources/js/pages/outlet/restocks/create.tsx`
- `resources/js/pages/outlet/restocks/show.tsx`
- `resources/js/pages/outlet/returns/create.tsx`
- `resources/js/pages/outlet/returns/show.tsx`

- [ ] **Step 6: Check for remaining references to deleted files**

```bash
grep -rn "OutletBottomNav\|OutletMoreSheet\|outlet/more\|outlet-bottom-nav\|outlet-more-sheet" resources/js/ --include="*.tsx" --include="*.ts"
```

Expected: no results

- [ ] **Step 7: Verify full TypeScript compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | grep -c "error"
```

Expected: same error count as before (pre-existing errors only)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove old outlet bottom nav and more sheet"
```

---

### Task 9: Verification

- [ ] **Step 1: Start dev server and test manually**

```bash
npm run dev
```

- [ ] **Step 2: Verify in responsive mode (iPhone 14 Pro Max)**

1. Open `/outlet/dashboard` in responsive mode
2. Hamburger icon visible in header ✓
3. Tap hamburger → side sheet slides from left ✓
4. All 5 groups visible with correct items ✓
5. Badge counts show on Pesanan, Pengiriman, etc. ✓
6. Active page highlighted in emerald ✓
7. Tap item → navigate + close sheet ✓
8. Tap overlay → close sheet ✓
9. No bottom nav visible ✓
10. Content area uses full height ✓

- [ ] **Step 3: Test all navigation paths**

- Dashboard → Pesanan → detail → back (backHref + hamburger)
- Dashboard → Scan QR
- Dashboard → Inventaris → Restock
- Dashboard → Lainnya (should not exist anymore)
- Logout from side sheet

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: outlet hamburger nav verification fixes"
```
