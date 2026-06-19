# Outlet Dashboard Redesign - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign outlet dashboard to be "operational first" - focused on today's tasks, not passive information display

**Architecture:** Redesign dashboard layout to show actionable items first, compact sections, inline actions

**Tech Stack:** Laravel 13, React 19, Inertia.js, Tailwind CSS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `resources/js/pages/outlet/dashboard.tsx` | Modify | Redesign dashboard layout |
| `app/Http/Controllers/Outlet/DashboardController.php` | Modify | Add today stats, greeting |

---

### Task 1: Add Today Stats and Greeting to Controller

**Files:**
- Modify: `app/Http/Controllers/Outlet/DashboardController.php`

- [ ] **Step 1: Read current controller**

```bash
cat app/Http/Controllers/Outlet/DashboardController.php
```

- [ ] **Step 2: Add today stats and greeting**

```php
// Add to index() method:

// Today stats
$todayOrders = Order::where('outlet_id', $outlet->id)
    ->whereDate('created_at', today())
    ->count();

$todayRevenue = Order::where('outlet_id', $outlet->id)
    ->where('status', 'completed')
    ->whereDate('created_at', today())
    ->sum('total');

// Greeting based on time
$hour = now()->hour;
$greeting = match(true) {
    $hour < 12 => 'Selamat Pagi',
    $hour < 17 => 'Selamat Siang',
    default => 'Selamat Malam',
};

return Inertia::render('outlet/dashboard', [
    // ... existing props ...
    'greeting' => $greeting,
    'todayStats' => [
        'orders' => $todayOrders,
        'revenue' => (float) $todayRevenue,
    ],
]);
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Outlet/DashboardController.php
git commit -m "feat: add today stats and greeting to outlet dashboard"
```

---

### Task 2: Redesign Dashboard Layout

**Files:**
- Modify: `resources/js/pages/outlet/dashboard.tsx`

- [ ] **Step 1: Read current dashboard**

```bash
cat resources/js/pages/outlet/dashboard.tsx
```

- [ ] **Step 2: Redesign with new structure**

Replace the current layout with:

```tsx
import { Head, Link, router } from '@inertiajs/react';
import { Package, Truck, AlertTriangle, ArrowRight, Clock, MapPin } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import { SkeletonList } from '@/components/ui/skeleton';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';

interface Props {
    outlet: any;
    stats: any;
    lowStockItems: any[];
    deliveryStats: any;
    recentOrders: any[];
    settlementStats: any;
    greeting: string;
    todayStats: {
        orders: number;
        revenue: number;
    };
}

export default function OutletDashboard({
    outlet,
    stats,
    lowStockItems,
    deliveryStats,
    recentOrders,
    settlementStats,
    greeting,
    todayStats,
}: Props) {
    usePolling(20000);

    const hasPendingOrders = stats.pending > 0;
    const hasFailedDeliveries = deliveryStats.failed > 0;
    const hasLowStock = lowStockItems.length > 0;
    const hasOutstanding = settlementStats.outstanding > 0;

    return (
        <OutletLayout title="Dashboard" hideNav>
            <Head title="Dashboard Outlet" />

            <div className="space-y-4">
                {/* Greeting + Today Summary */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white">
                    <div className="text-sm font-medium text-emerald-100">{greeting}</div>
                    <div className="mt-1 text-xl font-bold">{outlet.name}</div>
                    <div className="mt-3 flex gap-4">
                        <div>
                            <div className="text-[11px] text-emerald-200">Pesanan Hari Ini</div>
                            <div className="text-lg font-bold">{todayStats.orders}</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-emerald-200">Revenue Hari Ini</div>
                            <div className="text-lg font-bold">{formatCurrency(todayStats.revenue)}</div>
                        </div>
                    </div>
                </div>

                {/* Priority Actions */}
                {(hasPendingOrders || hasFailedDeliveries || hasLowStock || hasOutstanding) && (
                    <SectionCard label="Perlu Tindakan" className="border-amber-200 bg-amber-50">
                        <div className="space-y-2">
                            {hasPendingOrders && (
                                <Link
                                    href="/outlet/orders?status=pending_confirmation"
                                    className="flex items-center justify-between rounded-lg bg-white p-3 active:bg-zinc-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                                            <Package className="h-4 w-4 text-amber-600" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">Pesanan Baru</div>
                                            <div className="text-xs text-zinc-500">{stats.pending} pesanan menunggu konfirmasi</div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                                </Link>
                            )}

                            {hasFailedDeliveries && (
                                <Link
                                    href="/outlet/deliveries?status=failed"
                                    className="flex items-center justify-between rounded-lg bg-white p-3 active:bg-zinc-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                                            <Truck className="h-4 w-4 text-red-600" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">Pengiriman Gagal</div>
                                            <div className="text-xs text-zinc-500">{deliveryStats.failed} pengiriman perlu ditangani</div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                                </Link>
                            )}

                            {hasLowStock && (
                                <Link
                                    href="/outlet/inventory"
                                    className="flex items-center justify-between rounded-lg bg-white p-3 active:bg-zinc-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">Stok Rendah</div>
                                            <div className="text-xs text-zinc-500">{lowStockItems.length} produk perlu restock</div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                                </Link>
                            )}

                            {hasOutstanding && (
                                <Link
                                    href="/outlet/settlement"
                                    className="flex items-center justify-between rounded-lg bg-white p-3 active:bg-zinc-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                                            <span className="text-sm">💰</span>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">Settlement</div>
                                            <div className="text-xs text-zinc-500">Outstanding: {formatCurrency(settlementStats.outstanding)}</div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                                </Link>
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* Active Orders */}
                {recentOrders.length > 0 && (
                    <SectionCard label="Pesanan Aktif">
                        <div className="space-y-2">
                            {recentOrders.map((order: any) => (
                                <Link
                                    key={order.id}
                                    href={`/outlet/orders/${order.id}`}
                                    className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 active:bg-zinc-100"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">{order.order_code}</div>
                                        <div className="text-xs text-zinc-500">
                                            {order.customer_name} • {order.fulfillment_type === 'pickup' ? 'Pickup' : 'Delivery'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge variant={order.status === 'pending_confirmation' ? 'warning' : 'info'} size="sm">
                                            {order.status === 'pending_confirmation' ? 'Baru' : 'Diproses'}
                                        </StatusBadge>
                                        <ArrowRight className="h-4 w-4 text-zinc-400" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </SectionCard>
                )}

                {/* Delivery Summary */}
                <SectionCard label="Pengiriman Hari Ini">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                            <div className="text-lg font-bold text-emerald-600">{deliveryStats.completedToday}</div>
                            <div className="text-[11px] text-zinc-500">Selesai</div>
                        </div>
                        <div>
                            <div className="text-lg font-bold text-blue-600">{deliveryStats.inTransit}</div>
                            <div className="text-[11px] text-zinc-500">Dalam Perjalanan</div>
                        </div>
                        <div>
                            <div className="text-lg font-bold text-amber-600">{deliveryStats.waitingPickup}</div>
                            <div className="text-[11px] text-zinc-500">Menunggu</div>
                        </div>
                    </div>
                </SectionCard>

                {/* Low Stock Alert (compact) */}
                {hasLowStock && (
                    <SectionCard label="Stok Rendah" className="border-orange-200 bg-orange-50">
                        <div className="space-y-2">
                            {lowStockItems.slice(0, 3).map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between rounded-lg bg-white p-2">
                                    <div className="text-sm text-slate-900">{item.product_name}</div>
                                    <div className="text-xs text-orange-600">{item.available}/{item.minimum}</div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}

                {/* Settlement Summary (compact) */}
                {hasOutstanding && (
                    <SectionCard label="Settlement">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-[11px] text-zinc-500">Outstanding</div>
                                <div className="text-lg font-bold text-red-600">{formatCurrency(settlementStats.outstanding)}</div>
                            </div>
                            <Link
                                href="/outlet/settlement"
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                            >
                                Lihat Detail
                            </Link>
                        </div>
                    </SectionCard>
                )}

                {/* Empty State */}
                {!hasPendingOrders && !hasFailedDeliveries && !hasLowStock && !hasOutstanding && recentOrders.length === 0 && (
                    <EmptyState
                        icon={<Package className="h-8 w-8 text-slate-400" />}
                        title="Semua beres!"
                        description="Tidak ada yang perlu ditangani saat ini."
                    />
                )}
            </div>
        </OutletLayout>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/outlet/dashboard.tsx
git commit -m "feat: redesign outlet dashboard - operational first layout"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Test dashboard loads correctly
4. Verify greeting and today stats show
5. Verify priority actions are clickable
6. Verify active orders list works

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Add today stats and greeting to controller | 0.5d |
| 2 | Redesign dashboard layout | 1d |
| **Total** | | **1.5d** |
