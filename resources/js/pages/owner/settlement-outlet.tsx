import { router } from '@inertiajs/react';
import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/format';
import SectionCard from '@/components/ui/section-card';
import OwnerPageShell from '@/components/owner/owner-page-shell';

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
    adjustments: number;
    outstanding: number;
    last_payment: {
        date: string;
        amount: number;
        reference: string;
    } | null;
}

interface TimelineEntry {
    id: number;
    type: string;
    amount: number;
    center_share: number;
    outlet_margin: number;
    notes: string | null;
    created_at: string;
}

interface Props {
    summary: SettlementSummary;
    reconciliation: Reconciliation;
    timeline: TimelineEntry[];
    outletId: number;
    outletName: string;
    period: string;
    periodRange: { from: string; to: string };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

const timelineTypeLabels: Record<string, string> = {
    sale: 'Penjualan',
    settlement: 'Pembayaran',
    adjustment: 'Penyesuaian',
};

const timelineTypeColors: Record<string, string> = {
    sale: 'text-emerald-600',
    settlement: 'text-blue-600',
    adjustment: 'text-amber-600',
};

export default function OwnerSettlementOutlet({ summary, reconciliation, timeline, outletId, outletName, period }: Props) {
    const [copied, setCopied] = useState(false);

    const handlePeriodChange = (newPeriod: string) => {
        router.get(`/owner/settlement/outlet/${outletId}`, { period: newPeriod }, { preserveState: true });
    };

    const handleCopySummary = () => {
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const text = [
            `Halo Outlet ${outletName},`,
            '',
            `Per tanggal ${today}:`,
            '',
            `Kewajiban Awal : ${formatCurrency(reconciliation.center_share)}`,
            `Sudah Disetor  : ${formatCurrency(reconciliation.verified_payments)}`,
            `Belum Disetor  : ${formatCurrency(reconciliation.outstanding)}`,
            '',
            'Mohon dilakukan penyetoran.',
            '',
            'Terima kasih.',
        ].join('\n');

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <OwnerPageShell title={outletName} subtitle="Detail settlement outlet" backHref="/owner/settlement/collection">
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

            {/* Outstanding Hero */}
            <SectionCard>
                <div className="text-center">
                    <div className="text-sm text-zinc-500">Belum Disetor</div>
                    <div className={`mt-1 text-3xl font-bold tabular-nums ${reconciliation.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCurrency(reconciliation.outstanding)}
                    </div>
                </div>
            </SectionCard>

            {/* KPI Grid */}
            <div className="mt-4 grid grid-cols-2 gap-3">
                <SectionCard>
                    <div className="text-xs text-zinc-500">Omset</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(summary.gross_revenue)}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">{summary.orders_count} pesanan</div>
                </SectionCard>

                <SectionCard>
                    <div className="text-xs text-zinc-500">Kewajiban Awal</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-blue-600">{formatCurrency(reconciliation.center_share)}</div>
                </SectionCard>

                <SectionCard>
                    <div className="text-xs text-zinc-500">Sudah Disetor</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(reconciliation.verified_payments)}</div>
                    {reconciliation.pending_payments > 0 && (
                        <div className="mt-0.5 text-xs text-amber-500">{formatCurrency(reconciliation.pending_payments)} menunggu</div>
                    )}
                </SectionCard>

                <SectionCard>
                    <div className="text-xs text-zinc-500">Margin Outlet</div>
                    <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(summary.outlet_margin)}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">{summary.units_sold} unit</div>
                </SectionCard>
            </div>

            {/* Reconciliation Breakdown */}
            <div className="mt-4">
                <SectionCard label="Rincian Kewajiban">
                    <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500">Kewajiban Awal</span>
                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(reconciliation.center_share)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500">Sudah Diverifikasi</span>
                            <span className="text-sm font-semibold tabular-nums text-emerald-600">-{formatCurrency(reconciliation.verified_payments)}</span>
                        </div>
                        {reconciliation.adjustments !== 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-500">Penyesuaian</span>
                                <span className="text-sm font-semibold tabular-nums text-amber-600">
                                    {reconciliation.adjustments > 0 ? '+' : ''}{formatCurrency(reconciliation.adjustments)}
                                </span>
                            </div>
                        )}
                        <div className="border-t border-zinc-200 pt-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-900">Belum Disetor</span>
                                <span className={`text-sm font-bold tabular-nums ${reconciliation.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(reconciliation.outstanding)}
                                </span>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* Copy Summary Action */}
            <div className="mt-4">
                <button
                    onClick={handleCopySummary}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 active:bg-emerald-100"
                >
                    {copied ? (
                        <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Tersalin!
                        </>
                    ) : (
                        <>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Salin Ringkasan Tagihan
                        </>
                    )}
                </button>
            </div>

            {/* Top Products */}
            {summary.top_products.length > 0 && (
                <div className="mt-4">
                    <SectionCard label="Produk Terlaris">
                        <div className="mt-2 space-y-2">
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
                </div>
            )}

            {/* Settlement Timeline */}
            {timeline.length > 0 && (
                <div className="mt-4">
                    <SectionCard label="Aktivitas Settlement">
                        <div className="mt-2 space-y-0">
                            {timeline.map((entry, idx) => {
                                const isLast = idx === timeline.length - 1;
                                const label = timelineTypeLabels[entry.type] ?? entry.type;
                                const colorClass = timelineTypeColors[entry.type] ?? 'text-slate-600';
                                const isCredit = entry.type === 'sale';

                                return (
                                    <div key={entry.id} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isCredit ? 'bg-emerald-500' : entry.type === 'adjustment' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                            {!isLast && <div className="w-px flex-1 bg-zinc-200" />}
                                        </div>
                                        <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{label}</div>
                                                    {entry.notes && <div className="text-[11px] text-zinc-500">{entry.notes}</div>}
                                                </div>
                                                <div className={`text-sm font-bold tabular-nums ${colorClass}`}>
                                                    {isCredit ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                                                </div>
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-zinc-400">{formatDate(entry.created_at)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                </div>
            )}
        </OwnerPageShell>
    );
}
