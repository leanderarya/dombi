import { Head, router } from '@inertiajs/react';
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

            <div className="mt-4 space-y-4">
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

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-medium text-text-muted">Total Pendapatan</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{formatCurrency(kpis.total_revenue)}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-medium text-text-muted">Total Pesanan</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{kpis.total_orders}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-4 col-span-2">
                        <div className="text-[11px] font-medium text-text-muted">Rata-rata per Pesanan</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{formatCurrency(kpis.avg_order_value)}</div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle mb-3">Produk Terlaris</div>
                    {topProducts.length === 0 ? (
                        <p className="text-sm text-text-muted text-center py-4">Belum ada data penjualan</p>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((product, index) => (
                                <div key={product.product_name} className="flex items-center justify-between">
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
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle mb-3">Trend Revenue</div>
                    {dailyRevenue.length === 0 ? (
                        <p className="text-sm text-text-muted text-center py-4">Belum ada data</p>
                    ) : (
                        <div className="space-y-2">
                            {dailyRevenue.map((day) => (
                                <div key={day.date} className="flex items-center justify-between">
                                    <span className="text-sm text-text-muted">{day.date}</span>
                                    <span className="text-sm font-semibold tabular-nums text-text">{formatCurrency(day.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </OutletLayout>
    );
}
