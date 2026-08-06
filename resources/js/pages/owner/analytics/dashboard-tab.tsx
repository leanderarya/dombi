import { Link, router } from '@inertiajs/react';
import {
    BarChart3,
    DollarSign,
    ShoppingCart,
    TrendingUp,
    Users,
} from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

interface TrendData {
    value: number;
    positive: boolean;
}

interface OutletRevenue {
    outlet_id: number;
    outlet: { id: number; name: string };
    revenue: number;
    orders: number;
}

interface TopProduct {
    product_name: string;
    total_qty: number;
    total_revenue: number;
}

interface KpiData {
    total_revenue: number;
    total_orders: number;
    active_outlets: number;
    total_revenue_trend?: TrendData;
    total_orders_trend?: TrendData;
    active_outlets_trend?: TrendData;
}

interface Props {
    kpis?: KpiData;
    outletRevenue?: OutletRevenue[];
    topProducts?: TopProduct[];
    period?: string;
    insight?: string;
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export function DashboardTab({
    kpis,
    outletRevenue = [],
    topProducts = [],
    period = 'today',
    insight,
}: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get(
            '/owner/analytics',
            { period: newPeriod, tab: 'dashboard' },
            { preserveState: true },
        );
    };

    const periodLabel =
        period === 'today'
            ? 'hari ini'
            : period === 'week'
              ? 'minggu lalu'
              : 'bulan lalu';

    if (!kpis) {
        return <SkeletonPage />;
    }

    const maxRevenue = Math.max(...outletRevenue.map((o) => o.revenue), 1);

    return (
        <div className="space-y-6">
            {/* Period Filter */}
            <div
                className="scrollbar-none flex flex-wrap gap-2 overflow-x-auto"
                role="group"
                aria-label="Filter periode"
            >
                {periods.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => handlePeriodChange(p.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            period === p.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'hover:bg-mint-wash bg-surface text-text-muted ring-border'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Insight Banner */}
            {insight && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-light p-3">
                    <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
                    <p className="flex-1 text-xs font-medium text-primary">
                        {insight}
                    </p>
                </div>
            )}

            {/* KPI Strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Total Pesanan
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                            <ShoppingCart className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {kpis.total_orders.toLocaleString('id-ID')}
                    </div>
                    {kpis.total_orders_trend && (
                        <p
                            className={`text-[11px] font-semibold ${
                                kpis.total_orders_trend.positive
                                    ? 'text-emerald-600'
                                    : 'text-red-500'
                            }`}
                        >
                            {kpis.total_orders_trend.positive ? '+' : ''}
                            {kpis.total_orders_trend.value}% dari {periodLabel}
                        </p>
                    )}
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Pendapatan
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                            <DollarSign className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {formatCurrency(kpis.total_revenue)}
                    </div>
                    {kpis.total_revenue_trend && (
                        <p
                            className={`text-[11px] font-semibold ${
                                kpis.total_revenue_trend.positive
                                    ? 'text-emerald-600'
                                    : 'text-red-500'
                            }`}
                        >
                            {kpis.total_revenue_trend.positive ? '+' : ''}
                            {kpis.total_revenue_trend.value}% dari {periodLabel}
                        </p>
                    )}
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Rata-rata
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                            <TrendingUp className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {kpis.total_orders > 0
                            ? formatCurrency(
                                  Math.round(
                                      kpis.total_revenue / kpis.total_orders,
                                  ),
                              )
                            : 'Rp 0'}
                    </div>
                    <p className="text-[11px] text-text-muted">
                        Per pesanan
                    </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                            Outlet Aktif
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10 text-[#7C3AED]">
                            <Users className="h-5 w-5" />
                        </span>
                    </div>
                    <div className="font-heading text-xl font-bold tabular-nums text-text sm:text-2xl">
                        {kpis.active_outlets}
                    </div>
                    {kpis.active_outlets_trend && (
                        <p
                            className={`text-[11px] font-semibold ${
                                kpis.active_outlets_trend.positive
                                    ? 'text-emerald-600'
                                    : 'text-red-500'
                            }`}
                        >
                            {kpis.active_outlets_trend.positive ? '+' : ''}
                            {kpis.active_outlets_trend.value}% dari {periodLabel}
                        </p>
                    )}
                </div>
            </div>

            {/* 2-Column Grid: Outlet Revenue + Top Products */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Outlet Revenue */}
                <div className="rounded-2xl border border-border bg-surface p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="font-heading text-base font-bold text-text">
                                Pendapatan per Outlet
                            </h3>
                            <p className="text-xs text-text-muted">
                                Perbandingan antar outlet
                            </p>
                        </div>
                        <BarChart3 className="h-4 w-4 text-text-muted" />
                    </div>

                    {outletRevenue.length === 0 ? (
                        <EmptyState title="Belum ada data" />
                    ) : (
                        <div className="space-y-3">
                            {outletRevenue.map((item) => (
                                <Link
                                    key={item.outlet_id}
                                    href={`/owner/outlets/${item.outlet_id}`}
                                    className="group -m-1.5 flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-emerald-50/40"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex items-center justify-between text-xs font-medium">
                                            <span className="truncate text-text">
                                                {item.outlet.name}
                                            </span>
                                            <span className="ml-2 font-semibold tabular-nums text-text">
                                                {formatCurrency(item.revenue)}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                                            <div
                                                className="bar-grow h-2 rounded-full bg-primary"
                                                style={{
                                                    width: `${(item.revenue / maxRevenue) * 100}%`,
                                                    '--delay': '200ms',
                                                } as React.CSSProperties}
                                            />
                                        </div>
                                        <div className="mt-1 text-[10px] text-text-muted">
                                            {item.orders} pesanan
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Products */}
                <div className="rounded-2xl border border-border bg-surface p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h3 className="font-heading text-base font-bold text-text">
                                Produk Terlaris
                            </h3>
                            <p className="text-xs text-text-muted">
                                Produk dengan penjualan tertinggi
                            </p>
                        </div>
                    </div>

                    {topProducts.length === 0 ? (
                        <EmptyState title="Belum ada data" />
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((product, index) => (
                                <Link
                                    key={product.product_name}
                                    href={`/owner/inventories?product=${encodeURIComponent(product.product_name)}`}
                                    className="group -m-1.5 flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-emerald-50/40"
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                                index === 0
                                                    ? 'bg-primary text-white'
                                                    : 'bg-surface-muted text-text-muted'
                                            }`}
                                        >
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div className="text-sm font-medium text-text">
                                                {product.product_name}
                                            </div>
                                            <div className="text-xs text-text-muted">
                                                {product.total_qty} unit
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold tabular-nums text-text">
                                        {formatCurrency(product.total_revenue)}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
