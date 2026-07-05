import { Link, router } from '@inertiajs/react';
import { TrendingDown, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
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

export function DashboardTab({ kpis, outletRevenue = [], topProducts = [], period = 'today', insight }: Props) {
    const [insightDismissed, setInsightDismissed] = useState(false);

    const handlePeriodChange = (newPeriod: string) => {
        router.get('/owner/analytics', { period: newPeriod, tab: 'dashboard' }, { preserveState: true });
    };

    const periodLabel = period === 'today' ? 'hari ini' : period === 'week' ? 'minggu lalu' : 'bulan lalu';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-none">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        onClick={() => handlePeriodChange(p.key)}
                        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${
                            period === p.key
                                ? 'bg-primary/10 text-primary ring-primary/20'
                                : 'bg-surface text-text-muted ring-border hover:bg-surface-muted'
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

            {kpis && (
                <div className="grid grid-cols-3 gap-3 lg:hidden">
                    <KpiCard label="Total Revenue" value={formatCurrency(kpis.total_revenue)} trend={kpis.total_revenue_trend} periodLabel={periodLabel} />
                    <KpiCard label="Total Orders" value={String(kpis.total_orders)} trend={kpis.total_orders_trend} periodLabel={periodLabel} />
                    <KpiCard label="Active Outlets" value={String(kpis.active_outlets)} trend={kpis.active_outlets_trend} periodLabel={periodLabel} />
                </div>
            )}

            <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-white p-4 transition-shadow hover:shadow-sm">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Perbandingan Outlet</div>
                        {outletRevenue.length === 0 ? (
                            <p className="py-4 text-center text-sm text-text-muted">Belum ada data</p>
                        ) : (
                            <div className="space-y-3">
                                {outletRevenue.map((item) => (
                                    <Link
                                        key={item.outlet_id}
                                        href={`/owner/outlets/${item.outlet_id}`}
                                        className="-m-1.5 flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-surface-muted"
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
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">Produk Terlaris</div>
                        {topProducts.length === 0 ? (
                            <p className="py-4 text-center text-sm text-text-muted">Belum ada data</p>
                        ) : (
                            <div className="space-y-3">
                                {topProducts.map((product, index) => (
                                    <Link
                                        key={product.product_name}
                                        href={`/owner/inventories?product=${encodeURIComponent(product.product_name)}`}
                                        className="-m-1.5 flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-surface-muted"
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

                {kpis && (
                    <div className="hidden lg:block">
                        <div className="sticky top-4 space-y-3">
                            <KpiCard label="Total Revenue" value={formatCurrency(kpis.total_revenue)} trend={kpis.total_revenue_trend} periodLabel={periodLabel} />
                            <KpiCard label="Total Orders" value={String(kpis.total_orders)} trend={kpis.total_orders_trend} periodLabel={periodLabel} />
                            <KpiCard label="Active Outlets" value={String(kpis.active_outlets)} trend={kpis.active_outlets_trend} periodLabel={periodLabel} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function KpiCard({ label, value, trend, periodLabel }: { label: string; value: string; trend?: TrendData; periodLabel: string }) {
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
