# Phase 6: Owner Analytics - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dashboard analytics and report export for owner

**Architecture:** Enhance existing dashboard + new export controllers

**Tech Stack:** Laravel 13, PHP 8.3, React 19, Inertia.js, Recharts (for charts)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `app/Http/Controllers/Owner/AnalyticsController.php` | Create | Dashboard analytics |
| `app/Http/Controllers/Owner/ReportController.php` | Create | Report export |
| `resources/js/pages/owner/analytics/index.tsx` | Create | Analytics dashboard |
| `resources/js/pages/owner/reports/index.tsx` | Create | Report export UI |
| `routes/web.php` | Modify | Add routes |

---

### Task 1: Dashboard Analytics

**Files:**
- Create: `app/Http/Controllers/Owner/AnalyticsController.php`
- Create: `resources/js/pages/owner/analytics/index.tsx`
- Modify: `routes/web.php`

- [ ] **Step 1: Create AnalyticsController**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Settlement;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function index(Request $request): Response
    {
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        // Total KPIs
        $totalRevenue = Order::where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->sum('total');

        $totalOrders = Order::where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->count();

        $activeOutlets = Outlet::where('status', 'active')->count();

        // Revenue per outlet
        $outletRevenue = Order::where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->select('outlet_id', \DB::raw('SUM(total) as revenue'), \DB::raw('COUNT(*) as orders'))
            ->groupBy('outlet_id')
            ->with('outlet:id,name')
            ->orderByDesc('revenue')
            ->get();

        // Daily revenue trend
        $dailyRevenue = Order::where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->select(\DB::raw('DATE(created_at) as date'), \DB::raw('SUM(total) as revenue'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Top products
        $topProducts = \App\Models\OrderItem::whereHas('order', function ($query) use ($from, $to) {
            $query->where('status', 'completed')
                ->whereBetween('created_at', [$from, $to]);
        })
        ->select('product_name', \DB::raw('SUM(quantity) as total_qty'), \DB::raw('SUM(subtotal) as total_revenue'))
        ->groupBy('product_name')
        ->orderByDesc('total_revenue')
        ->limit(10)
        ->get();

        return Inertia::render('owner/analytics/index', [
            'kpis' => [
                'total_revenue' => (float) $totalRevenue,
                'total_orders' => (int) $totalOrders,
                'active_outlets' => (int) $activeOutlets,
            ],
            'outletRevenue' => $outletRevenue,
            'dailyRevenue' => $dailyRevenue,
            'topProducts' => $topProducts,
            'period' => $period,
        ]);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }
}
```

- [ ] **Step 2: Create frontend page**

```tsx
import { Head, router } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

interface OutletRevenue {
    outlet_id: number;
    outlet: { id: number; name: string };
    revenue: number;
    orders: number;
}

interface DailyRevenue {
    date: string;
    revenue: number;
}

interface TopProduct {
    product_name: string;
    total_qty: number;
    total_revenue: number;
}

interface Props {
    kpis: {
        total_revenue: number;
        total_orders: number;
        active_outlets: number;
    };
    outletRevenue: OutletRevenue[];
    dailyRevenue: DailyRevenue[];
    topProducts: TopProduct[];
    period: string;
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OwnerAnalytics({ kpis, outletRevenue, dailyRevenue, topProducts, period }: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get('/owner/analytics', { period: newPeriod }, { preserveState: true });
    };

    return (
        <OwnerPageShell title="Dashboard Analitik" subtitle="Analitik performa bisnis">
            <Head title="Dashboard Analitik" />

            <div className="space-y-4">
                {/* Period Selector */}
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => handlePeriodChange(p.key)}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                                period === p.key
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-[11px] font-medium text-slate-500">Total Revenue</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(kpis.total_revenue)}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-[11px] font-medium text-slate-500">Total Orders</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{kpis.total_orders}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-[11px] font-medium text-slate-500">Active Outlets</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{kpis.active_outlets}</div>
                    </div>
                </div>

                {/* Outlet Comparison */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Perbandingan Outlet</div>
                    {outletRevenue.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-4">Belum ada data</p>
                    ) : (
                        <div className="space-y-3">
                            {outletRevenue.map((item) => (
                                <div key={item.outlet_id} className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">{item.outlet.name}</div>
                                        <div className="text-[11px] text-zinc-500">{item.orders} orders</div>
                                    </div>
                                    <div className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(item.revenue)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Products */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Produk Terlaris</div>
                    {topProducts.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-4">Belum ada data</p>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((product, index) => (
                                <div key={product.product_name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-600">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div className="text-sm font-medium text-slate-900">{product.product_name}</div>
                                            <div className="text-[11px] text-zinc-500">{product.total_qty} unit</div>
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(product.total_revenue)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </OwnerPageShell>
    );
}
```

- [ ] **Step 3: Add routes**

```php
// Owner Analytics
Route::get('/owner/analytics', [OwnerAnalyticsController::class, 'index'])->name('owner.analytics.index');
```

- [ ] **Step 4: Test**

Run: `php artisan test --filter=OwnerAnalytics`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Owner/AnalyticsController.php resources/js/pages/owner/analytics/index.tsx routes/web.php
git commit -m "feat: add owner analytics dashboard with revenue trends"
```

---

### Task 2: Report Export

**Files:**
- Create: `app/Http/Controllers/Owner/ReportController.php`
- Create: `resources/js/pages/owner/reports/index.tsx`
- Modify: `routes/web.php`

- [ ] **Step 1: Create ReportController**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('owner/reports/index');
    }

    public function exportOrders(Request $request): StreamedResponse
    {
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $orders = Order::where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->with(['outlet:id,name', 'items'])
            ->get();

        $filename = "orders-{$from->format('Y-m-d')}-{$to->format('Y-m-d')}.csv";

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($orders) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Tanggal', 'Order Code', 'Outlet', 'Customer', 'Total', 'Items']);

            foreach ($orders as $order) {
                fputcsv($file, [
                    $order->created_at->format('d/m/Y'),
                    $order->order_code,
                    $order->outlet->name,
                    $order->customer_name,
                    $order->total,
                    $order->items->count(),
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function exportSettlements(Request $request): StreamedResponse
    {
        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $settlements = Settlement::whereBetween('period_date', [$from, $to])
            ->with('outlet:id,name')
            ->get();

        $filename = "settlements-{$from->format('Y-m-d')}-{$to->format('Y-m-d')}.csv";

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($settlements) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Outlet', 'Periode', 'Jatuh Tempo', 'Tagihan', 'Dibayar', 'Sisa', 'Status']);

            foreach ($settlements as $s) {
                fputcsv($file, [
                    $s->outlet->name,
                    $s->period_date->format('d/m/Y'),
                    $s->due_date->format('d/m/Y'),
                    $s->amount_due,
                    $s->paid_amount,
                    $s->outstanding_amount,
                    $s->status,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function resolvePeriod(string $period, Request $request): array
    {
        return match ($period) {
            'today' => [now()->startOfDay(), now()->endOfDay()],
            'week' => [now()->startOfWeek(), now()->endOfWeek()],
            'month' => [now()->startOfMonth(), now()->endOfMonth()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }
}
```

- [ ] **Step 2: Create frontend page**

```tsx
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OwnerReports() {
    const [period, setPeriod] = useState('month');
    const [exporting, setExporting] = useState<string | null>(null);

    const handleExport = (type: string) => {
        setExporting(type);
        router.get(`/owner/reports/${type}/export?period=${period}`, {}, {
            onFinish: () => setExporting(null),
        });
    };

    return (
        <OwnerPageShell title="Laporan" subtitle="Export laporan bisnis">
            <Head title="Laporan" />

            <div className="space-y-4">
                {/* Period Selector */}
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                                period === p.key
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Export Cards */}
                <div className="space-y-3">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900 mb-1">Laporan Orders</div>
                        <p className="text-xs text-zinc-500 mb-3">Download data order completed</p>
                        <button
                            onClick={() => handleExport('orders')}
                            disabled={exporting === 'orders'}
                            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                        >
                            {exporting === 'orders' ? 'Mengexport...' : 'Download CSV'}
                        </button>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-900 mb-1">Laporan Settlements</div>
                        <p className="text-xs text-zinc-500 mb-3">Download data settlement outlet</p>
                        <button
                            onClick={() => handleExport('settlements')}
                            disabled={exporting === 'settlements'}
                            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                        >
                            {exporting === 'settlements' ? 'Mengexport...' : 'Download CSV'}
                        </button>
                    </div>
                </div>
            </div>
        </OwnerPageShell>
    );
}
```

- [ ] **Step 3: Add routes**

```php
// Owner Reports
Route::get('/owner/reports', [OwnerReportController::class, 'index'])->name('owner.reports.index');
Route::get('/owner/reports/orders/export', [OwnerReportController::class, 'exportOrders'])->name('owner.reports.orders.export');
Route::get('/owner/reports/settlements/export', [OwnerReportController::class, 'exportSettlements'])->name('owner.reports.settlements.export');
```

- [ ] **Step 4: Test**

Run: `php artisan test --filter=OwnerReport`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Owner/ReportController.php resources/js/pages/owner/reports/index.tsx routes/web.php
git commit -m "feat: add owner report export for orders and settlements"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Run linter: `./vendor/bin/pint --test`
3. Build frontend: `npm run build`
4. Test analytics dashboard manually
5. Test CSV exports manually

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1. Dashboard Analytics | Revenue trends, outlet comparison, top products | 3d |
| 2. Report Export | CSV export untuk orders dan settlements | 2d |
| **Total** | | **5d** |
