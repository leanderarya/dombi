import { Head, router, Link } from '@inertiajs/react';
import { formatCurrency } from '@/lib/format';

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

interface Reconciliation {
    center_share: number;
    verified_payments: number;
    pending_payments: number;
    rejected_payments: number;
    outstanding: number;
    last_payment: {
        date: string;
        amount: number;
        reference: string;
    } | null;
}

interface Props {
    summary: SettlementSummary;
    reconciliation: Reconciliation;
    period: string;
    periodRange: { from: string; to: string };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

export default function OutletSettlement({ summary, reconciliation, period }: Props) {
    const handlePeriodChange = (newPeriod: string) => {
        router.get('/outlet/settlement', { period: newPeriod }, { preserveState: true });
    };

    return (
        <>
            <Head title="Settlement" />

            <div className="p-4">
                <h1 className="mb-4 text-lg font-bold text-slate-900">Settlement</h1>

                {/* Period Selector */}
                <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
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

                {/* Outstanding */}
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                    <div className="text-sm text-red-700">Total yang Harus Dibayar ke Center</div>
                    <div className="mt-1 text-3xl font-bold text-red-600">{formatCurrency(reconciliation.outstanding)}</div>
                </div>

                {/* Financial Summary */}
                <div className="mb-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-xs text-zinc-500">Pendapatan Kotor</div>
                        <div className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(summary.gross_revenue)}</div>
                        <div className="mt-0.5 text-xs text-zinc-400">{summary.orders_count} pesanan</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-xs text-zinc-500">Margin Saya</div>
                        <div className="mt-1 text-lg font-bold text-emerald-600">{formatCurrency(summary.outlet_margin)}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-xs text-zinc-500">Sudah Dibayar</div>
                        <div className="mt-1 text-lg font-bold text-emerald-600">{formatCurrency(reconciliation.verified_payments)}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-xs text-zinc-500">Menunggu Verifikasi</div>
                        <div className="mt-1 text-lg font-bold text-amber-600">{formatCurrency(reconciliation.pending_payments)}</div>
                    </div>
                </div>

                {/* Last Payment */}
                {reconciliation.last_payment && (
                    <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="text-xs text-zinc-500">Pembayaran Terakhir</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                            {formatCurrency(reconciliation.last_payment.amount)}
                        </div>
                        <div className="text-xs text-zinc-400">
                            {reconciliation.last_payment.reference} • {reconciliation.last_payment.date}
                        </div>
                    </div>
                )}

                {/* Top Products */}
                {summary.top_products.length > 0 && (
                    <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
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
                    </div>
                )}

                {/* Payment Link */}
                <Link
                    href="/outlet/settlement-payments"
                    className="block w-full rounded-xl bg-emerald-600 py-3 text-center text-sm font-medium text-white hover:bg-emerald-700"
                >
                    Bayar / Lihat Riwayat Pembayaran
                </Link>
            </div>
        </>
    );
}
