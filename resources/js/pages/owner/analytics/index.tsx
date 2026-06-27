import { Head, Link, router } from '@inertiajs/react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { formatCurrency } from '@/lib/format';

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

interface TrendData {
    value: number;
    positive: boolean;
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
    kpis: KpiData;
    outletRevenue: OutletRevenue[];
    topProducts: TopProduct[];
    period: string;
    insight?: string;
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OwnerAnalytics({ kpis, outletRevenue, topProducts, period, insight }: Props) {
    const [insightDismissed, setInsightDismissed] = useState(false);
    const handlePeriodChange = (newPeriod: string) => {
        router.get('/owner/analytics', { period: newPeriod }, { preserveState: true });
    };

    const periodLabel = period === 'today' ? 'hari ini' : period === 'week' ? 'minggu lalu' : 'bulan lalu';

    return (
        <OwnerPageShell title="Dashboard Analitik" subtitle="Analitik performa bisnis">
            <Head title="Dashboard Analitik" />

            <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => handlePeriodChange(p.key)}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                                period === p.key
                                    ? 'bg-primary text-white'
                                    : 'bg-surface-muted text-text-muted active:bg-surface-muted'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {insight && !insightDismissed && (
                    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-light p-3">
                        <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
                        <p className="flex-1 text-xs font-medium text-primary">{insight}</p>
                        <button onClick={() => setInsightDismissed(true)} className="shrink-0 text-primary/60 hover:text-primary">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                {/* Mobile KPI grid */}
                <div className="grid grid-cols-3 gap-3 lg:hidden">
                    <KpiCard label="Total Revenue" value={formatCurrency(kpis.total_revenue)} trend={kpis.total_revenue_trend} periodLabel={periodLabel} />
                    <KpiCard label="Total Orders" value={String(kpis.total_orders)} trend={kpis.total_orders_trend} periodLabel={periodLabel} />
                    <KpiCard label="Active Outlets" value={String(kpis.active_outlets)} trend={kpis.active_outlets_trend} periodLabel={periodLabel} />
                </div>

                {/* Desktop 2-column layout */}
                <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-5">
                    {/* Left: outlet comparison + top products */}
                    <div className="space-y-4">
                        <div className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">Perbandingan Outlet</div>
                            {outletRevenue.length === 0 ? (
                                <p className="text-sm text-text-muted text-center py-4">Belum ada data</p>
                            ) : (
                                <div className="space-y-3">
                                    {outletRevenue.map((item) => (
                                        <Link
                                            key={item.outlet_id}
                                            href={`/owner/outlets/${item.outlet_id}`}
                                            className="flex items-center justify-between rounded-lg p-1.5 -m-1.5 transition-colors hover:bg-surface-muted"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-text">{item.outlet.name}</div>
                                                <div className="text-[11px] text-text-muted">{item.orders} orders</div>
                                            </div>
                                            <div className="text-sm font-semibold tabular-nums text-text">{formatCurrency(item.revenue)}</div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3">Produk Terlaris</div>
                            {topProducts.length === 0 ? (
                                <p className="text-sm text-text-muted text-center py-4">Belum ada data</p>
                            ) : (
                                <div className="space-y-3">
                                    {topProducts.map((product, index) => (
                                        <Link
                                            key={product.product_name}
                                            href={`/owner/inventories?product=${encodeURIComponent(product.product_name)}`}
                                            className="flex items-center justify-between rounded-lg p-1.5 -m-1.5 transition-colors hover:bg-surface-muted"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-text-muted">
                                                    {index + 1}
                                                </span>
                                                <div>
                                                    <div className="text-sm font-medium text-text">{product.product_name}</div>
                                                    <div className="text-[11px] text-text-muted">{product.total_qty} unit</div>
                                                </div>
                                            </div>
                                            <div className="text-sm font-semibold tabular-nums text-text">{formatCurrency(product.total_revenue)}</div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: KPI cards stacked (desktop only, sticky) */}
                    <div className="hidden lg:block">
                        <div className="sticky top-4 space-y-3">
                            <KpiCard label="Total Revenue" value={formatCurrency(kpis.total_revenue)} trend={kpis.total_revenue_trend} periodLabel={periodLabel} />
                            <KpiCard label="Total Orders" value={String(kpis.total_orders)} trend={kpis.total_orders_trend} periodLabel={periodLabel} />
                            <KpiCard label="Active Outlets" value={String(kpis.active_outlets)} trend={kpis.active_outlets_trend} periodLabel={periodLabel} />
                        </div>
                    </div>
                </div>
            </div>
        </OwnerPageShell>
    );
}

function KpiCard({ label, value, trend, periodLabel }: { label: string; value: string; trend?: { value: number; positive: boolean }; periodLabel: string }) {
    return (
        <div className="rounded-xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm hover:border-border/60">
            <div className="text-[11px] font-medium text-text-muted">{label}</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-text">{value}</div>
            {trend && (
                <div className="mt-1.5 flex items-center gap-1">
                    {trend.positive ? (
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                    ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-[10px] font-semibold ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {trend.positive ? '+' : ''}{trend.value}%
                    </span>
                    <span className="text-[10px] text-text-muted">vs {periodLabel}</span>
                </div>
            )}
        </div>
    );
}
