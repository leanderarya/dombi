# Owner Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Owner dashboard from 15+ element layout to minimal 4-section decision-focused dashboard

**Architecture:** Rewrite dashboard.tsx with new ExpandableSection component, simplify backend controller to remove dead data, fix polling

**Tech Stack:** React 19, TypeScript, Inertia.js, Tailwind CSS 4, semantic design tokens

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `resources/js/components/ui/expandable-section.tsx` | Create | New expandable section component |
| `resources/js/pages/owner/dashboard.tsx` | Rewrite | New minimal dashboard layout |
| `app/Http/Controllers/Owner/DashboardController.php` | Modify | Simplify data, remove dead code |
| `resources/js/lib/use-polling.ts` | Modify | Fix polling to use correct prop keys |

---

### Task 1: Create ExpandableSection Component

**Files:**
- Create: `resources/js/components/ui/expandable-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { type ReactNode, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableSectionProps {
    title: string;
    count: number;
    countColor?: 'blue' | 'red' | 'amber';
    children: ReactNode;
    defaultExpanded?: boolean;
    action?: {
        label: string;
        href: string;
    };
    className?: string;
}

const countColorStyles = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
};

export function ExpandableSection({
    title,
    count,
    countColor = 'blue',
    children,
    defaultExpanded = false,
    action,
    className,
}: ExpandableSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const toggle = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <div className={cn('overflow-hidden rounded-xl border border-border bg-surface', className)}>
            <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center justify-between bg-surface-muted px-4 py-3 transition-colors hover:bg-surface-muted/80"
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{title}</span>
                    {count > 0 && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold text-white', countColorStyles[countColor])}>
                            {count}
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={cn('h-4 w-4 text-text-subtle transition-transform duration-200', isExpanded && 'rotate-180')}
                />
            </button>
            {isExpanded && (
                <div className="border-t border-border px-4 py-3">
                    {children}
                    {action && count > 0 && (
                        <a
                            href={action.href}
                            className="mt-3 inline-block text-xs font-semibold text-primary hover:text-primary-hover"
                        >
                            {action.label} →
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

interface ExpandableItemProps {
    icon?: ReactNode;
    children: ReactNode;
    action?: {
        label: string;
        href: string;
    };
}

export function ExpandableItem({ icon, children, action }: ExpandableItemProps) {
    return (
        <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
            <div className="flex items-center gap-3">
                {icon && <span className="text-sm">{icon}</span>}
                <span className="text-sm text-text">{children}</span>
            </div>
            {action && (
                <a
                    href={action.href}
                    className="text-xs font-semibold text-primary hover:text-primary-hover"
                >
                    {action.label}
                </a>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/expandable-section.tsx
git commit -m "feat: add ExpandableSection component for dashboard"
```

---

### Task 2: Simplify DashboardController

**Files:**
- Modify: `app/Http/Controllers/Owner/DashboardController.php`

- [ ] **Step 1: Read current controller**

```bash
cat app/Http/Controllers/Owner/DashboardController.php
```

- [ ] **Step 2: Simplify the controller**

Remove:
- `agingKpis` computation (dead code)
- Second KPI strip data (`monthlyBilling`, `monthlyPayments`, `activeReturns`, `activeExchanges`)
- `outletAttention` data (removed from dashboard)

Keep:
- `hero` data (outstanding amount)
- `actionRequired` data (pending restocks, returns, exchanges, payments)
- `settlementAlerts` data (for expandable section)
- `inventoryRisks` data (for expandable section)

Update the `kpis` array to include:
```php
'kpis' => [
    'outstandingAmount' => $collection['hero']['total_outstanding'],
    'pendingActions' => $actionRequired['restocks'] + $actionRequired['returns'] + $actionRequired['exchanges'] + $actionRequired['pendingSettlementVerifications'],
    'criticalStock' => $inventoryRisks->count(),
],
```

- [ ] **Step 3: Run tests**

Run: `php artisan test --filter=Dashboard`
Expected: All dashboard tests pass

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Owner/DashboardController.php
git commit -m "refactor: simplify DashboardController, remove dead data"
```

---

### Task 3: Rewrite Dashboard Page

**Files:**
- Modify: `resources/js/pages/owner/dashboard.tsx`

- [ ] **Step 1: Read current dashboard**

```bash
cat resources/js/pages/owner/dashboard.tsx
```

- [ ] **Step 2: Rewrite the dashboard**

Replace the entire file with:

```tsx
import { Head, Link } from '@inertiajs/react';
import { Wallet, ClipboardList, AlertTriangle, Package, RotateCcw, ArrowLeftRight, CreditCard } from 'lucide-react';
import { OwnerPageShell } from '@/components/owner/owner-page-shell';
import { OwnerKpiCard } from '@/components/owner/owner-kpi-card';
import { ExpandableSection, ExpandableItem } from '@/components/ui/expandable-section';
import { usePolling } from '@/lib/use-polling';
import { formatCurrency } from '@/lib/format';

interface DashboardProps {
    hero: {
        total_outstanding: number;
        subtitle: string;
    };
    kpis: {
        outstandingAmount: number;
        pendingActions: number;
        criticalStock: number;
    };
    actionRequired: {
        restocks: number;
        returns: number;
        exchangers: number;
        pendingSettlementVerifications: number;
    };
    settlementAlerts: Array<{
        id: number;
        outlet_name: string;
        days_overdue: number;
        outstanding: number;
    }>;
    inventoryRisks: Array<{
        id: number;
        variant_name: string;
        current_stock: number;
        threshold: number;
    }>;
}

export default function Dashboard({
    hero,
    kpis,
    actionRequired,
    settlementAlerts,
    inventoryRisks,
}: DashboardProps) {
    usePolling(30000);

    const totalPendingActions = actionRequired.restocks + actionRequired.returns + actionRequired.exchanges + actionRequired.pendingSettlementVerifications;

    return (
        <>
            <Head title="Dasbor" />
            <OwnerPageShell
                title="Dasbor"
                subtitle="Ringkasan operasional hari ini"
            >
                {/* Hero Bar */}
                <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-hover px-6 py-5 text-white">
                    <div className="text-xs font-medium uppercase tracking-wider opacity-70">
                        Tagihan Tertunggak
                    </div>
                    <div className="mt-1 text-3xl font-bold tabular-nums">
                        {formatCurrency(hero.total_outstanding)}
                    </div>
                    <div className="mt-1 text-sm opacity-80">
                        {hero.subtitle}
                    </div>
                    <Link
                        href="/owner/finance"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/25"
                    >
                        Lihat Penagihan →
                    </Link>
                </div>

                {/* KPI Cards */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Link href="/owner/finance">
                        <OwnerKpiCard
                            icon={Wallet}
                            label="Tagihan"
                            value={formatCurrency(kpis.outstandingAmount)}
                            subtitle={`${settlementAlerts.length} outlet belum bayar`}
                        />
                    </Link>
                    <Link href="#actions">
                        <OwnerKpiCard
                            icon={ClipboardList}
                            label="Butuh Tindakan"
                            value={totalPendingActions}
                            subtitle={`${actionRequired.restocks} restock · ${actionRequired.returns} return · ${actionRequired.pendingSettlementVerifications} pembayaran`}
                        />
                    </Link>
                    <Link href="/owner/inventories?filter=critical">
                        <OwnerKpiCard
                            icon={AlertTriangle}
                            label="Stok Kritis"
                            value={kpis.criticalStock}
                            color={kpis.criticalStock > 0 ? 'danger' : 'success'}
                            subtitle="SKU perlu restock segera"
                        />
                    </Link>
                </div>

                {/* Expandable Sections */}
                <div className="mt-4 space-y-3">
                    <ExpandableSection
                        title="Butuh Tindakan"
                        count={totalPendingActions}
                        countColor="blue"
                        action={{
                            label: 'Lihat Semua',
                            href: '/owner/restocks?status=requested',
                        }}
                    >
                        {actionRequired.restocks > 0 && (
                            <ExpandableItem
                                icon={<Package className="h-4 w-4" />}
                                action={{ label: 'Tinjau', href: '/owner/restocks?status=requested' }}
                            >
                                {actionRequired.restocks} restock menunggu persetujuan
                            </ExpandableItem>
                        )}
                        {actionRequired.returns > 0 && (
                            <ExpandableItem
                                icon={<RotateCcw className="h-4 w-4" />}
                                action={{ label: 'Tinjau', href: '/owner/returns?status=submitted' }}
                            >
                                {actionRequired.returns} return menunggu persetujuan
                            </ExpandableItem>
                        )}
                        {actionRequired.exchanges > 0 && (
                            <ExpandableItem
                                icon={<ArrowLeftRight className="h-4 w-4" />}
                                action={{ label: 'Tinjau', href: '/owner/exchanges?status=submitted' }}
                            >
                                {actionRequired.exchanges} tukar produk menunggu persetujuan
                            </ExpandableItem>
                        )}
                        {actionRequired.pendingSettlementVerifications > 0 && (
                            <ExpandableItem
                                icon={<CreditCard className="h-4 w-4" />}
                                action={{ label: 'Verifikasi', href: '/owner/settlement-payments' }}
                            >
                                {actionRequired.pendingSettlementVerifications} pembayaran menunggu verifikasi
                            </ExpandableItem>
                        )}
                        {totalPendingActions === 0 && (
                            <div className="py-4 text-center text-sm text-text-muted">
                                Tidak ada tindakan yang diperlukan
                            </div>
                        )}
                    </ExpandableSection>

                    <ExpandableSection
                        title="Stok Kritis"
                        count={inventoryRisks.length}
                        countColor="red"
                        action={{
                            label: 'Lihat Semua',
                            href: '/owner/inventories?filter=critical',
                        }}
                    >
                        {inventoryRisks.map((risk) => (
                            <ExpandableItem
                                key={risk.id}
                                action={{ label: 'Restock', href: `/owner/restocks/create?variant=${risk.id}` }}
                            >
                                {risk.variant_name} — Stok: {risk.current_stock} (min: {risk.threshold})
                            </ExpandableItem>
                        ))}
                        {inventoryRisks.length === 0 && (
                            <div className="py-4 text-center text-sm text-text-muted">
                                Stok pusat masih aman
                            </div>
                        )}
                    </ExpandableSection>
                </div>
            </OwnerPageShell>
        </>
    );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/dashboard.tsx
git commit -m "feat: redesign dashboard with hero + 3 KPI + expandable sections"
```

---

### Task 4: Fix Polling Hook

**Files:**
- Modify: `resources/js/lib/use-polling.ts`

- [ ] **Step 1: Read current polling hook**

```bash
cat resources/js/lib/use-polling.ts
```

- [ ] **Step 2: Update to accept custom prop keys**

Update the hook to accept an optional array of Inertia prop keys to reload:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { router } from '@inertiajs/react';

export function usePolling(intervalMs: number = 30000, only: string[] = []) {
    const isOnline = useRef(true);
    const isVisible = useRef(true);

    const handleOnline = useCallback(() => {
        isOnline.current = true;
    }, []);

    const handleOffline = useCallback(() => {
        isOnline.current = false;
    }, []);

    const handleVisibilityChange = useCallback(() => {
        isVisible.current = !document.hidden;
    }, []);

    useEffect(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleOnline, handleOffline, handleVisibilityChange]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (isOnline.current && isVisible.current) {
                router.reload({ only: only.length > 0 ? only : undefined });
            }
        }, intervalMs);

        return () => clearInterval(interval);
    }, [intervalMs, only]);
}
```

- [ ] **Step 3: Update dashboard to use correct prop keys**

In `dashboard.tsx`, update the usePolling call:

```typescript
usePolling(30000, ['hero', 'kpis', 'actionRequired', 'settlementAlerts', 'inventoryRisks']);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add resources/js/lib/use-polling.ts resources/js/pages/owner/dashboard.tsx
git commit -m "fix: update usePolling to accept custom Inertia prop keys"
```

---

### Task 5: Run Tests & Verify

- [ ] **Step 1: Run full test suite**

Run: `php artisan test`
Expected: All tests pass

- [ ] **Step 2: Build frontend**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Verify no regressions**

Check that:
- Dashboard loads without errors
- Hero bar shows outstanding amount
- 3 KPI cards display correctly
- Expandable sections expand/collapse
- Links navigate to correct pages
- Polling works (check network tab for 30s reload)

---

## Verification Checklist

- [ ] Dashboard shows exactly 4 sections: header, hero, 3 KPI, 2 expandable
- [ ] All KPI cards are clickable and navigate to correct pages
- [ ] Expandable sections expand/collapse on click
- [ ] Hero shows outstanding amount with outlet count
- [ ] "Butuh Tindakan" shows pending items with action links
- [ ] "Stok Kritis" shows critical SKUs with restock links
- [ ] Polling works correctly (auto-refresh every 30s)
- [ ] No dead data (all displayed data is populated)
- [ ] Responsive: 3-column KPI on desktop, 1-column on mobile
- [ ] All colors use semantic tokens
- [ ] All tests pass
- [ ] Build succeeds
