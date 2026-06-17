# Phase 5: Outlet Features - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sales report export and performance analytics for outlets

**Architecture:** New controllers + Inertia pages, reusing existing data from orders and settlements

**Tech Stack:** Laravel 13, PHP 8.3, React 19, Inertia.js, Recharts (for charts)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `app/Http/Controllers/Outlet/ReportController.php` | Create | Sales report export |
| `app/Http/Controllers/Outlet/AnalyticsController.php` | Create | Performance analytics |
| `resources/js/pages/outlet/reports/index.tsx` | Create | Report UI |
| `resources/js/pages/outlet/analytics/index.tsx` | Create | Analytics dashboard |
| `routes/web.php` | Modify | Add routes |

---

### Task 1: Sales Report Export

**Files:**
- Create: `app/Http/Controllers/Outlet/ReportController.php`
- Create: `resources/js/pages/outlet/reports/index.tsx`
- Modify: `routes/web.php`

- [ ] **Step 1: Create ReportController**

```php
<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\StreamedResponse;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        return Inertia::render('outlet/reports/index', [
            'outlet' => $outlet->only(['id', 'name']),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        $orders = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->with('items')
            ->get();

        $filename = "laporan-penjualan-{$outlet->name}-{$from->format('Y-m-d')}-{$to->format('Y-m-d')}.csv";

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($orders) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Tanggal', 'Order Code', 'Produk', 'Variant', 'Qty', 'Harga', 'Subtotal', 'Margin']);

            foreach ($orders as $order) {
                foreach ($order->items as $item) {
                    $margin = ($item->selling_price_snapshot - $item->center_price_snapshot) * $item->quantity;
                    fputcsv($file, [
                        $order->created_at->format('d/m/Y'),
                        $order->order_code,
                        $item->product_name,
                        $item->variant_name_snapshot,
                        $item->quantity,
                        $item->selling_price_snapshot,
                        $item->subtotal,
                        $margin,
                    ]);
                }
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
            'custom' => [
                Carbon::parse($request->string('from', now()->startOfMonth()->toDateString())),
                Carbon::parse($request->string('to', now()->toDateString()))->endOfDay(),
            ],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }
}
```

- [ ] **Step 2: Create frontend page**

```tsx
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';

interface Props {
    outlet: {
        id: number;
        name: string;
    };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OutletReports({ outlet }: Props) {
    const [period, setPeriod] = useState('month');
    const [exporting, setExporting] = useState(false);

    const handleExport = () => {
        setExporting(true);
        router.get(`/outlet/reports/sales/export?period=${period}`, {}, {
            onFinish: () => setExporting(false),
        });
    };

    return (
        <OutletLayout title="Laporan Penjualan" subtitle={`Laporan untuk ${outlet.name}`}>
            <Head title="Laporan Penjualan" />

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

                {/* Export Card */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Export Laporan</div>
                    <p className="text-sm text-slate-600 mb-4">
                        Download laporan penjualan dalam format CSV untuk periode yang dipilih.
                    </p>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white active:bg-emerald-700 disabled:opacity-50"
                    >
                        {exporting ? 'Mengexport...' : 'Download CSV'}
                    </button>
                </div>

                {/* Info Card */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Konten Laporan</div>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Tanggal dan kode order
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Nama produk dan variant
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Quantity, harga, dan subtotal
                        </li>
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Margin per item
                        </li>
                    </ul>
                </div>
            </div>
        </OutletLayout>
    );
}
```

- [ ] **Step 3: Add routes**

```php
// Outlet Reports
Route::get('/outlet/reports', [OutletReportController::class, 'index'])->name('outlet.reports.index');
Route::get('/outlet/reports/sales/export', [OutletReportController::class, 'export'])->name('outlet.reports.sales.export');
```

- [ ] **Step 4: Test**

Run: `php artisan test --filter=OutletReport`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Outlet/ReportController.php resources/js/pages/outlet/reports/index.tsx routes/web.php
git commit -m "feat: add outlet sales report export with CSV download"
```

---

### Task 2: Performance Analytics

**Files:**
- Create: `app/Http/Controllers/Outlet/AnalyticsController.php`
- Create: `resources/js/pages/outlet/analytics/index.tsx`
- Modify: `routes/web.php`

- [ ] **Step 1: Create AnalyticsController**

```php
<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Settlement;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AnalyticsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $user->outlet;

        abort_unless($outlet, 403);

        $period = $request->string('period', 'month')->toString();
        [$from, $to] = $this->resolvePeriod($period, $request);

        // KPIs
        $totalRevenue = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->sum('total');

        $totalOrders = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->count();

        $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;

        // Top products
        $topProducts = OrderItem::whereHas('order', function ($query) use ($outlet, $from, $to) {
            $query->where('outlet_id', $outlet->id)
                ->where('status', 'completed')
                ->whereBetween('created_at', [$from, $to]);
        })
        ->select('product_name', \DB::raw('SUM(quantity) as total_qty'), \DB::raw('SUM(subtotal) as total_revenue'))
        ->groupBy('product_name')
        ->orderByDesc('total_revenue')
        ->limit(5)
        ->get();

        // Daily revenue trend
        $dailyRevenue = Order::where('outlet_id', $outlet->id)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$from, $to])
            ->select(\DB::raw('DATE(created_at) as date'), \DB::raw('SUM(total) as revenue'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return Inertia::render('outlet/analytics/index', [
            'outlet' => $outlet->only(['id', 'name']),
            'kpis' => [
                'total_revenue' => (float) $totalRevenue,
                'total_orders' => (int) $totalOrders,
                'avg_order_value' => (float) $avgOrderValue,
            ],
            'topProducts' => $topProducts,
            'dailyRevenue' => $dailyRevenue,
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
import { useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency } from '@/lib/format';

interface TopProduct {
    product_name: string;
    total_qty: number;
    total_revenue: number;
}

interface DailyRevenue {
    date: string;
    revenue: number;
}

interface Props {
    outlet: { id: number; name: string };
    kpis: {
        total_revenue: number;
        total_orders: number;
        avg_order_value: number;
    };
    topProducts: TopProduct[];
    dailyRevenue: DailyRevenue[];
    period: string;
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OutletAnalytics({ outlet, kpis, topProducts, dailyRevenue, period }: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get('/outlet/analytics', { period: newPeriod }, { preserveState: true });
    };

    return (
        <OutletLayout title="Analitik Performa" subtitle={`Analitik untuk ${outlet.name}`}>
            <Head title="Analitik Performa" />

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
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-[11px] font-medium text-slate-500">Total Revenue</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(kpis.total_revenue)}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-[11px] font-medium text-slate-500">Total Orders</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{kpis.total_orders}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4 col-span-2">
                        <div className="text-[11px] font-medium text-slate-500">Rata-rata per Order</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(kpis.avg_order_value)}</div>
                    </div>
                </div>

                {/* Top Products */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Produk Terlaris</div>
                    {topProducts.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-4">Belum ada data penjualan</p>
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

                {/* Revenue Trend */}
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Trend Revenue</div>
                    {dailyRevenue.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-4">Belum ada data</p>
                    ) : (
                        <div className="space-y-2">
                            {dailyRevenue.map((day) => (
                                <div key={day.date} className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">{day.date}</span>
                                    <span className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(day.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </OutletLayout>
    );
}
```

- [ ] **Step 3: Add routes**

```php
// Outlet Analytics
Route::get('/outlet/analytics', [OutletAnalyticsController::class, 'index'])->name('outlet.analytics.index');
```

- [ ] **Step 4: Test**

Run: `php artisan test --filter=OutletAnalytics`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Outlet/AnalyticsController.php resources/js/pages/outlet/analytics/index.tsx routes/web.php
git commit -m "feat: add outlet performance analytics dashboard"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Run linter: `./vendor/bin/pint --test`
3. Build frontend: `npm run build`
4. Test CSV export manually
5. Test analytics dashboard manually

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1. Sales Report Export | CSV download dengan filter periode | 2d |
| 2. Performance Analytics | Dashboard dengan KPI dan grafik | 3d |
| **Total** | | **5d** |
