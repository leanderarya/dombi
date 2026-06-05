import { Head, router } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format';
import PageHeader from '@/components/ui/page-header';
import SectionCard from '@/components/ui/section-card';

interface TopProduct {
    product_name: string;
    total_qty: number;
    total_revenue: number;
}

interface SettlementSummary {
    gross_revenue: number;
    center_share: number;
    outlet_margin: number;
    settled_amount: number;
    outstanding_amount: number;
    units_sold: number;
    orders_count: number;
    top_products: TopProduct[];
}

interface Props {
    summary: SettlementSummary;
    outstanding: number;
    outletId: number;
    period: string;
    periodRange: { from: string; to: string };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OwnerSettlementOutlet({ summary, outstanding, outletId, period }: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get(`/owner/settlement/outlet/${outletId}`, { period: newPeriod }, { preserveState: true });
    };

    return (
        <>
            <Head title="Detail Settlement Outlet" />

            <PageHeader title="Detail Settlement Outlet" subtitle="Laporan keuangan per outlet" />

            <div className="space-y-4 p-4">
                {/* Period Selector */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {periods.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => handlePeriodChange(p.key)}
                            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                period === p.key
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Outstanding Payable */}
                <SectionCard>
                    <div className="text-center">
                        <div className="text-sm text-zinc-500">Outstanding Payable</div>
                        <div className="mt-1 text-3xl font-bold text-red-600">{formatCurrency(outstanding)}</div>
                    </div>
                </SectionCard>

                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-3">
                    <SectionCard>
                        <div className="text-xs text-zinc-500">Pendapatan Kotor</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(summary.gross_revenue)}</div>
                        <div className="mt-0.5 text-xs text-zinc-400">{summary.orders_count} pesanan</div>
                    </SectionCard>

                    <SectionCard>
                        <div className="text-xs text-zinc-500">Unit Terjual</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{summary.units_sold}</div>
                    </SectionCard>

                    <SectionCard>
                        <div className="text-xs text-zinc-500">Bagian Center</div>
                        <div className="mt-1 text-lg font-bold text-blue-600">{formatCurrency(summary.center_share)}</div>
                    </SectionCard>

                    <SectionCard>
                        <div className="text-xs text-zinc-500">Margin Outlet</div>
                        <div className="mt-1 text-lg font-bold text-emerald-600">{formatCurrency(summary.outlet_margin)}</div>
                    </SectionCard>
                </div>

                {/* Top Products */}
                {summary.top_products.length > 0 && (
                    <SectionCard>
                        <div className="mb-3 text-sm font-semibold text-slate-900">Produk Terlaris</div>
                        <div className="space-y-2">
                            {summary.top_products.map((product, index) => (
                                <div key={product.product_name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm text-slate-900">{product.product_name}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-slate-900">{formatCurrency(product.total_revenue)}</div>
                                        <div className="text-xs text-zinc-400">{product.total_qty} unit</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}
            </div>
        </>
    );
}
