import { Head, router } from '@inertiajs/react';
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

interface Props {
    kpis: {
        total_revenue: number;
        total_orders: number;
        active_outlets: number;
    };
    outletRevenue: OutletRevenue[];
    topProducts: TopProduct[];
    period: string;
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OwnerAnalytics({ kpis, outletRevenue, topProducts, period }: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get('/owner/analytics', { period: newPeriod }, { preserveState: true });
    };

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
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 active:bg-zinc-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

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
