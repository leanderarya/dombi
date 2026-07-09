import { Link, router } from '@inertiajs/react';
import { TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import OwnerKpiStrip from '@/components/owner/owner-kpi-strip';
import { Button } from '@/components/ui/button';
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

export function DashboardTab({ kpis, outletRevenue = [], topProducts = [], period = 'today', insight }: Props) {
    const [insightDismissed, setInsightDismissed] = useState(false);

    const handlePeriodChange = (newPeriod: string) => {
        router.get('/owner/analytics', { period: newPeriod, tab: 'dashboard' }, { preserveState: true });
    };

    const periodLabel = period === 'today' ? 'hari ini' : period === 'week' ? 'minggu lalu' : 'bulan lalu';

    if (!kpis) {
        return <SkeletonPage />;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-none" role="group" aria-label="Filter periode">
                {periods.map((p) => (
                    <button
                        key={p.key}
                        type="button"
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
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary-light p-3" role="alert">
                    <TrendingUp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="flex-1 text-xs font-medium text-primary">{insight}</p>
                    <Button variant="ghost" size="icon" onClick={() => setInsightDismissed(true)} className="h-10 w-10 shrink-0 text-primary/60 hover:text-primary" aria-label="Tutup insight">
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}

            <OwnerKpiStrip
                cols={3}
                items={[
                    {
                        label: 'Total Revenue',
                        value: formatCurrency(kpis.total_revenue),
                        sublabel: kpis.total_revenue_trend
                            ? `${kpis.total_revenue_trend.positive ? '+' : ''}${kpis.total_revenue_trend.value}% vs ${periodLabel}`
                            : undefined,
                        sublabelColor: kpis.total_revenue_trend?.positive ? 'text-emerald-600' : 'text-red-500',
                    },
                    {
                        label: 'Total Orders',
                        value: kpis.total_orders,
                        sublabel: kpis.total_orders_trend
                            ? `${kpis.total_orders_trend.positive ? '+' : ''}${kpis.total_orders_trend.value}% vs ${periodLabel}`
                            : undefined,
                        sublabelColor: kpis.total_orders_trend?.positive ? 'text-emerald-600' : 'text-red-500',
                    },
                    {
                        label: 'Active Outlets',
                        value: kpis.active_outlets,
                        sublabel: kpis.active_outlets_trend
                            ? `${kpis.active_outlets_trend.positive ? '+' : ''}${kpis.active_outlets_trend.value}% vs ${periodLabel}`
                            : undefined,
                        sublabelColor: kpis.active_outlets_trend?.positive ? 'text-emerald-600' : 'text-red-500',
                    },
                ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-white p-4" aria-label="Perbandingan Outlet">
                    <div className="mb-3 text-xs font-medium text-text-muted">Perbandingan Outlet</div>
                    {outletRevenue.length === 0 ? (
                        <EmptyState title="Belum ada data" />
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
                                        <div className="text-xs text-text-muted">{item.orders} orders</div>
                                    </div>
                                    <div className="text-sm font-semibold tabular-nums text-text">{formatCurrency(item.revenue)}</div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-border bg-white p-4" aria-label="Produk Terlaris">
                    <div className="mb-3 text-xs font-medium text-text-muted">Produk Terlaris</div>
                    {topProducts.length === 0 ? (
                        <EmptyState title="Belum ada data" />
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((product, index) => (
                                <Link
                                    key={product.product_name}
                                    href={`/owner/inventories?product=${encodeURIComponent(product.product_name)}`}
                                    className="-m-1.5 flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-surface-muted"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-muted">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <div className="text-sm font-medium text-text">{product.product_name}</div>
                                            <div className="text-xs text-text-muted">{product.total_qty} unit</div>
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold tabular-nums text-text">{formatCurrency(product.total_revenue)}</div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
