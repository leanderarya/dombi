import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import RevenueTrendChart from '@/components/outlet/revenue-trend-chart';
import TopProductsChart from '@/components/outlet/top-products-chart';
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

export default function OutletAnalytics({
    outlet,
    kpis,
    topProducts,
    dailyRevenue,
    period,
    dateFrom,
    dateTo,
}: Props) {
    const [from, setFrom] = useState(dateFrom);
    const [to, setTo] = useState(dateTo);

    const handlePeriodChange = (newPeriod: string) => {
        if (newPeriod === 'custom') {
            router.get(
                '/outlet/analytics',
                { period: 'custom', date_from: from, date_to: to },
                { preserveState: true },
            );
        } else {
            router.get(
                '/outlet/analytics',
                { period: newPeriod },
                { preserveState: true },
            );
        }
    };

    const handleCustomApply = () => {
        router.get(
            '/outlet/analytics',
            { period: 'custom', date_from: from, date_to: to },
            { preserveState: true },
        );
    };

    return (
        <OutletLayout
            title="Analitik Performa"
            subtitle={`Analitik untuk ${outlet.name}`}
        >
            <Head title="Analitik Performa" />

            <OutletPageShell>
                <FilterChips
                    options={periods}
                    active={period}
                    onChange={handlePeriodChange}
                    size="sm"
                    variant="ring"
                />

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
                        <div className="text-[11px] font-medium text-text-muted">
                            Total Pendapatan
                        </div>
                        <div className="mt-1 text-lg font-bold text-text tabular-nums">
                            {formatCurrency(kpis.total_revenue)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-medium text-text-muted">
                            Total Pesanan
                        </div>
                        <div className="mt-1 text-lg font-bold text-text tabular-nums">
                            {kpis.total_orders}
                        </div>
                    </div>
                    <div className="col-span-2 rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-medium text-text-muted">
                            Rata-rata per Pesanan
                        </div>
                        <div className="mt-1 text-lg font-bold text-text tabular-nums">
                            {formatCurrency(kpis.avg_order_value)}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="mb-3 text-[11px] font-bold tracking-wider text-text-subtle uppercase">
                        Produk Terlaris
                    </div>
                    <div
                        className="w-full [&_*:focus]:outline-none"
                        style={{ height: 220 }}
                    >
                        <TopProductsChart data={topProducts} />
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="mb-3 text-[11px] font-bold tracking-wider text-text-subtle uppercase">
                        Trend Revenue
                    </div>
                    <div
                        className="w-full [&_*:focus]:outline-none"
                        style={{ height: 220 }}
                    >
                        <RevenueTrendChart data={dailyRevenue} />
                    </div>
                </div>
            </OutletPageShell>
        </OutletLayout>
    );
}
