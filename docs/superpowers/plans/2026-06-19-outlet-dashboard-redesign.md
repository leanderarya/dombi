# Outlet Dashboard Redesign V2 - Operational Workspace First

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign outlet dashboard as operational workspace - help outlet know what to do NOW, not display analytics

**Architecture:** Priority: Operational > Analytics. Dashboard = task center, not mini analytics dashboard.

**Tech Stack:** Laravel 13, React 19, Inertia.js, Tailwind CSS

**Design Reference:** Grab Merchant, GoBiz, Shopify POS, Toast POS

---

## Primary Principle

Outlet membuka aplikasi untuk:
1. Melihat pesanan baru
2. Menyiapkan pesanan
3. Mengatur pengiriman
4. Mengecek stok
5. Meminta restock

**Bukan** untuk melihat revenue.

---

## Dashboard Structure

```
Hero (Greeting + Today Stats)
    ↓
Perlu Tindakan (Priority Actions)
    ↓
Antrian Kerja Hari Ini (Order Queue)
    ↓
Aksi Cepat (Quick Actions)
    ↓
Pengiriman Hari Ini (Delivery Summary)
    ↓
Stok Rendah (Low Stock Alert)
    ↓
Empty State (if nothing to do)
```

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `resources/js/pages/outlet/dashboard.tsx` | Modify | Redesign dashboard layout |
| `app/Http/Controllers/Outlet/DashboardController.php` | Modify | Add greeting, pending tasks count, queue summary |

---

### Task 1: Update Controller - Add Greeting & Queue Summary

**Files:**
- Modify: `app/Http/Controllers/Outlet/DashboardController.php`

- [ ] **Step 1: Read current controller**

```bash
cat app/Http/Controllers/Outlet/DashboardController.php
```

- [ ] **Step 2: Add greeting and pending tasks count**

```php
// Add to index() method:

// Greeting based on time
$hour = now()->hour;
$greeting = match(true) {
    $hour < 12 => 'Selamat Pagi',
    $hour < 17 => 'Selamat Siang',
    default => 'Selamat Malam',
};

// Pending tasks count (for hero section)
$pendingTasks = Order::where('outlet_id', $outlet->id)
    ->where('status', 'pending_confirmation')
    ->count()
    + Delivery::whereHas('order', fn($q) => $q->where('outlet_id', $outlet->id))
        ->where('status', 'failed')
        ->count()
    + OutletInventory::where('outlet_id', $outlet->id)
        ->whereRaw('(current_stock - reserved_stock) <= minimum_stock')
        ->count();

// Order queue summary
$orderQueue = [
    'new' => Order::where('outlet_id', $outlet->id)->where('status', 'pending_confirmation')->count(),
    'preparing' => Order::where('outlet_id', $outlet->id)->where('status', 'preparing')->count(),
    'ready' => Order::where('outlet_id', $outlet->id)->where('status', 'ready_for_pickup')->count(),
    'waiting_courier' => Order::where('outlet_id', $outlet->id)
        ->where('status', 'ready_for_pickup')
        ->whereHas('delivery', fn($q) => $q->where('status', 'waiting_pickup'))
        ->count(),
];

return Inertia::render('outlet/dashboard', [
    // ... existing props ...
    'greeting' => $greeting,
    'pendingTasks' => $pendingTasks,
    'orderQueue' => $orderQueue,
]);
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Outlet/DashboardController.php
git commit -m "feat: add greeting, pending tasks count, and order queue to outlet dashboard"
```

---

### Task 2: Redesign Dashboard Layout

**Files:**
- Modify: `resources/js/pages/outlet/dashboard.tsx`

- [ ] **Step 1: Read current dashboard**

```bash
cat resources/js/pages/outlet/dashboard.tsx
```

- [ ] **Step 2: Redesign with operational workspace layout**

```tsx
import { Head, Link, router } from '@inertiajs/react';
import { Package, Truck, AlertTriangle, ArrowRight, ClipboardList, BarChart3, Warehouse, RefreshCw } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import SectionCard from '@/components/ui/section-card';
import OutletLayout from '@/layouts/outlet-layout';
import { usePolling } from '@/lib/use-polling';

interface Props {
    outlet: any;
    stats: any;
    lowStockItems: any[];
    deliveryStats: any;
    recentOrders: any[];
    greeting: string;
    pendingTasks: number;
    orderQueue: {
        new: number;
        preparing: number;
        ready: number;
        waiting_courier: number;
    };
}

export default function OutletDashboard({
    outlet,
    stats,
    lowStockItems,
    deliveryStats,
    recentOrders,
    greeting,
    pendingTasks,
    orderQueue,
}: Props) {
    usePolling(20000);

    const hasPendingOrders = stats.pendingOrders > 0;
    const hasFailedDeliveries = deliveryStats.failed > 0;
    const hasLowStock = lowStockItems.length > 0;

    return (
        <OutletLayout title="Dashboard" hideNav>
            <Head title="Dashboard Outlet" />

            <div className="space-y-4">
                {/* Hero Section - Greeting + Today Stats */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white">
                    <div className="text-sm font-medium text-emerald-100">{greeting}</div>
                    <div className="mt-1 text-xl font-bold">{outlet.name}</div>
                    <div className="mt-3 flex gap-4">
                        <div>
                            <div className="text-[11px] text-emerald-200">Pesanan Hari Ini</div>
                            <div className="text-lg font-bold">{stats.todayOrders}</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-emerald-200">Tugas Menunggu</div>
                            <div className="text-lg font-bold">{pendingTasks}</div>
                        </div>
                    </div>
                </div>

                {/* Priority Actions */}
                {(hasPendingOrders || hasFailedDeliveries || hasLowStock) && (
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
                                            <div className="text-xs text-zinc-500">{stats.pendingOrders} pesanan menunggu konfirmasi</div>
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
                        </div>
                    </SectionCard>
                )}

                {/* Antrian Kerja Hari Ini */}
                <SectionCard label="Antrian Kerja Hari Ini">
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <Link
                            href="/outlet/orders?status=pending_confirmation"
                            className="rounded-lg bg-zinc-50 p-3 active:bg-zinc-100"
                        >
                            <div className="text-lg font-bold text-amber-600">{orderQueue.new}</div>
                            <div className="text-[10px] text-zinc-500">Baru</div>
                        </Link>
                        <Link
                            href="/outlet/orders?status=preparing"
                            className="rounded-lg bg-zinc-50 p-3 active:bg-zinc-100"
                        >
                            <div className="text-lg font-bold text-blue-600">{orderQueue.preparing}</div>
                            <div className="text-[10px] text-zinc-500">Diproses</div>
                        </Link>
                        <Link
                            href="/outlet/orders?status=ready_for_pickup"
                            className="rounded-lg bg-zinc-50 p-3 active:bg-zinc-100"
                        >
                            <div className="text-lg font-bold text-emerald-600">{orderQueue.ready}</div>
                            <div className="text-[10px] text-zinc-500">Siap Pickup</div>
                        </Link>
                        <Link
                            href="/outlet/deliveries?status=waiting_pickup"
                            className="rounded-lg bg-zinc-50 p-3 active:bg-zinc-100"
                        >
                            <div className="text-lg font-bold text-purple-600">{orderQueue.waiting_courier}</div>
                            <div className="text-[10px] text-zinc-500">Menunggu Kurir</div>
                        </Link>
                    </div>
                </SectionCard>

                {/* Quick Actions */}
                <SectionCard label="Aksi Cepat">
                    <div className="grid grid-cols-2 gap-2">
                        <Link
                            href="/outlet/orders"
                            className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 active:bg-emerald-100"
                        >
                            <ClipboardList className="h-5 w-5 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-800">Kelola Pesanan</span>
                        </Link>
                        <Link
                            href="/outlet/inventory"
                            className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 active:bg-blue-100"
                        >
                            <Warehouse className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Inventaris</span>
                        </Link>
                        <Link
                            href="/outlet/restocks/create"
                            className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 active:bg-amber-100"
                        >
                            <RefreshCw className="h-5 w-5 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">Minta Restock</span>
                        </Link>
                        <Link
                            href="/outlet/deliveries"
                            className="flex items-center gap-3 rounded-lg bg-purple-50 p-3 active:bg-purple-100"
                        >
                            <Truck className="h-5 w-5 text-purple-600" />
                            <span className="text-sm font-medium text-purple-800">Pengiriman</span>
                        </Link>
                    </div>
                </SectionCard>

                {/* Pengiriman Hari Ini */}
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

                {/* Stok Rendah */}
                {hasLowStock && (
                    <SectionCard label="Stok Rendah" className="border-orange-200 bg-orange-50">
                        <div className="space-y-2">
                            {lowStockItems.slice(0, 3).map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between rounded-lg bg-white p-2">
                                    <div className="text-sm text-slate-900">{item.product?.name ?? 'Produk'}</div>
                                    <div className="text-xs text-orange-600">
                                        {item.current_stock - item.reserved_stock}/{item.minimum_stock}
                                    </div>
                                </div>
                            ))}
                            {lowStockItems.length > 3 && (
                                <Link
                                    href="/outlet/inventory"
                                    className="block text-center text-xs font-medium text-orange-600 active:text-orange-800"
                                >
                                    +{lowStockItems.length - 3} produk lainnya
                                </Link>
                            )}
                            <Link
                                href="/outlet/restocks/create"
                                className="block w-full rounded-lg bg-orange-600 py-2 text-center text-sm font-medium text-white active:bg-orange-700"
                            >
                                Lihat Inventaris
                            </Link>
                        </div>
                    </SectionCard>
                )}

                {/* Empty State */}
                {!hasPendingOrders && !hasFailedDeliveries && !hasLowStock && recentOrders.length === 0 && (
                    <EmptyState
                        icon={<Package className="h-8 w-8 text-slate-400" />}
                        title="Tidak ada aktivitas"
                        description="Pesanan baru akan muncul otomatis di sini."
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
git commit -m "feat: redesign outlet dashboard - operational workspace first

- Hero: greeting + today orders + pending tasks (no revenue)
- Perlu Tindakan: priority actions (orders, deliveries, stock - no settlement)
- Antrian Kerja: order queue summary (new, preparing, ready, waiting courier)
- Aksi Cepat: quick action buttons (orders, inventory, restock, delivery)
- Pengiriman Hari Ini: compact delivery stats
- Stok Rendah: max 3 items with +X lainnya link
- Remove settlement section from dashboard
- Empty state: 'Tidak ada aktivitas' (more realistic)"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Test dashboard loads correctly
4. Verify greeting and today stats show
5. Verify priority actions are clickable (no settlement)
6. Verify order queue shows correct counts
7. Verify quick actions work
8. Verify empty state shows correct message

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Update controller: greeting, pending tasks, queue summary | 0.5d |
| 2 | Redesign dashboard layout | 1d |
| **Total** | | **1.5d** |

---

## Design Principles Applied

| Principle | Implementation |
|-----------|----------------|
| Operational > Analytics | Revenue removed from hero, settlement removed from dashboard |
| Task Center | "Perlu Tindakan" section at top with inline actions |
| Daily Operations Hub | "Antrian Kerja" shows order queue status |
| Quick Access | "Aksi Cepat" grid for frequent actions |
| No Scroll Overload | Compact sections, max 3 items in low stock |
| Mobile-First | All sections fit mobile viewport |
