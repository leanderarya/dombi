import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import FilterChips from '@/components/ui/filter-chips';
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
    dateFrom: string;
    dateTo: string;
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
    { key: 'custom', label: 'Pilih Tanggal' },
];

export default function OutletAnalytics({ outlet, kpis, topProducts, dailyRevenue, period, dateFrom, dateTo }: Props) {
    const [from, setFrom] = useState(dateFrom);
    const [to, setTo] = useState(dateTo);

    const handlePeriodChange = (newPeriod: string) => {
        if (newPeriod === 'custom') {
            router.get('/outlet/analytics', { period: 'custom', date_from: from, date_to: to }, { preserveState: true });
        } else {
            router.get('/outlet/analytics', { period: newPeriod }, { preserveState: true });
        }
    };

    const handleCustomApply = () => {
        router.get('/outlet/analytics', { period: 'custom', date_from: from, date_to: to }, { preserveState: true });
    };

    return (
        <OutletLayout title="Analitik Performa" subtitle={`Analitik untuk ${outlet.name}`}>
            <Head title="Analitik Performa" />

            <OutletPageShell>
                <FilterChips options={periods} active={period} onChange={handlePeriodChange} size="sm" variant="ring" />

                {period === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="min-h-11 flex-1 rounded-lg border border-border px-3 text-sm"
                        />
                        <span className="text-xs text-text-muted">sampai</span>
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="min-h-11 flex-1 rounded-lg border border-border px-3 text-sm"
                        />
                        <button
                            type="button"
                            onClick={handleCustomApply}
                            className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-white active:opacity-80"
                        >
                            Terapkan
                        </button>
                    </div>
                )}

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
            </OutletPageShell>
        </OutletLayout>
    );
}
