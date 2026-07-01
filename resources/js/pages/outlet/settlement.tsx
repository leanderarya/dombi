import { Head, router, useForm } from '@inertiajs/react';
import { ChartColumn } from 'lucide-react';
import { useState } from 'react';
import BottomSheet from '@/components/ui/bottom-sheet';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import { Button } from '@/components/ui/button';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

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
    adjustments: number;
    last_payment: {
        date: string;
        amount: number;
        reference: string;
    } | null;
}

interface Payment {
    id: number;
    amount: number;
    reference_number: string;
    payment_date: string;
    status: string;
    notes: string | null;
    rejection_reason: string | null;
    verifier: string | null;
    verified_at: string | null;
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

interface PaymentAccount {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
}

interface Props {
    summary: SettlementSummary;
    reconciliation: Reconciliation;
    payments: Payment[];
    timeline: TimelineEntry[];
    paymentAccounts: PaymentAccount[];
    hasPendingPayment: boolean;
    period: string;
    periodRange: { from: string; to: string };
}

const periods = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
];

const statusLabels: Record<string, string> = {
    pending_verification: 'Menunggu Verifikasi',
    verified: 'Terverifikasi',
    rejected: 'Ditolak',
};

const statusVariants: Record<string, 'success' | 'warning' | 'danger'> = {
    pending_verification: 'warning',
    verified: 'success',
    rejected: 'danger',
};

export default function OutletSettlement({ summary, reconciliation, payments, timeline, paymentAccounts, hasPendingPayment, period }: Props) {
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

    const handlePeriodChange = (newPeriod: string) => {
        router.get('/outlet/settlement', { period: newPeriod }, { preserveState: true });
    };

    const hasPayments = payments.length > 0;
    const hasTimeline = timeline.length > 0;
    const hasSales = summary.orders_count > 0;
    const isSettled = reconciliation.outstanding <= 0;

    return (
        <OutletLayout
            title="Settlement"
            subtitle="Setoran ke pusat"
            headerBelow={<FilterChips options={periods} active={period} onChange={handlePeriodChange} />}
        >
            <Head title="Settlement" />
            <OutletPageShell hasStickyBar>
            {/* Hero Card */}
            {isSettled ? (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-text">Tidak ada kewajiban setoran saat ini</span>
                    </div>
                </div>
            ) : (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Belum Disetor</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums text-red-600">
                        {formatCurrency(reconciliation.outstanding)}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                        Jumlah yang masih perlu disetor ke pusat.
                    </div>
                    {hasPendingPayment ? (
                        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                            <div className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-medium text-amber-800">Pembayaran sedang menunggu verifikasi</span>
                            </div>
                        </div>
                    ) : (
                        <Button size="lg" onClick={() => setPaymentSheetOpen(true)} className="mt-4 w-full">
                            Ajukan Pembayaran
                        </Button>
                    )}
                </div>
            )}

            {/* Info Rekening */}
            {paymentAccounts.length > 0 && (
                <SectionCard label="Info Rekening Tujuan">
                    <div className="space-y-2">
                        {paymentAccounts.map((account) => (
                            <div key={account.id} className="rounded-xl bg-surface-muted p-3">
                                <div className="text-sm font-medium text-text">{account.bank_name}</div>
                                <div className="text-xs text-text-muted">{account.account_number}</div>
                                <div className="text-xs text-text-muted">a.n. {account.account_holder}</div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Outstanding Breakdown Card */}
            {hasSales && (
                <div className="mb-4 rounded-xl border border-border bg-white p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle mb-3">Rincian Kewajiban</div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-text-muted">Kewajiban Awal</span>
                            <span className="text-sm font-semibold tabular-nums text-text">{formatCurrency(reconciliation.center_share)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-text-muted">Sudah Disetor</span>
                            <span className="text-sm font-semibold tabular-nums text-text">{formatCurrency(reconciliation.verified_payments)}</span>
                        </div>
                        {reconciliation.adjustments !== 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-text-muted">Penyesuaian</span>
                                <span className={`text-sm font-semibold tabular-nums ${reconciliation.adjustments < 0 ? 'text-emerald-600' : 'text-text'}`}>
                                    {reconciliation.adjustments < 0 ? '- ' : ''}{formatCurrency(Math.abs(reconciliation.adjustments))}
                                </span>
                            </div>
                        )}
                        <div className="border-t border-border pt-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-text">Belum Disetor</span>
                                <span className={`text-sm font-bold tabular-nums ${reconciliation.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(reconciliation.outstanding)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Grid */}
            <div className="mb-4 grid grid-cols-2 gap-2">
                <KpiCard label="Omset" value={summary.gross_revenue} />
                <KpiCard label="Keuntungan Outlet" value={summary.outlet_margin} accent />
                <KpiCard label="Sudah Disetor" value={reconciliation.verified_payments} />
                <KpiCard
                    label="Penyesuaian"
                    value={Math.abs(reconciliation.adjustments)}
                    highlight={reconciliation.adjustments < 0}
                    negative={reconciliation.adjustments < 0}
                />
            </div>

            {/* No Sales Empty State */}
            {!hasSales && (
                <div>
                    <EmptyState
                        icon={<ChartColumn className="h-8 w-8 text-text-subtle" />}
                        title="Belum ada penjualan"
                        description="Belum ada penjualan pada periode ini."
                    />
                </div>
            )}

            {/* Payment History (above timeline) */}
            {hasPayments && (
                <SectionCard label="Riwayat Pembayaran">
                    <div className="mt-2 space-y-2">
                        {payments.map((payment) => (
                            <div key={payment.id} className="rounded-xl border border-border bg-surface-muted p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-text">{formatCurrency(payment.amount)}</div>
                                        <div className="text-[11px] text-text-subtle">{formatDate(payment.payment_date)}</div>
                                        <div className="mt-0.5 text-xs text-text-muted">{payment.reference_number}</div>
                                    </div>
                                    <StatusBadge variant={statusVariants[payment.status]}>
                                        {statusLabels[payment.status]}
                                    </StatusBadge>
                                </div>
                                {payment.rejection_reason && (
                                    <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                                        Ditolak: {payment.rejection_reason}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {!hasPayments && hasSales && (
                <SectionCard label="Riwayat Pembayaran">
                    <EmptyState
                        title="Belum ada riwayat pembayaran"
                    />
                </SectionCard>
            )}

            {/* Aktivitas Settlement */}
            {hasTimeline && (
                <SectionCard label="Aktivitas Settlement">
                    <div className="mt-2 space-y-0">
                        {timeline.map((entry, idx) => (
                            <TimelineItem key={entry.id} entry={entry} isLast={idx === timeline.length - 1} />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* Periode Saat Ini */}
            {hasSales && (
                <SectionCard label="Periode Saat Ini">
                    <div className="mt-2 space-y-2">
                        <BreakdownRow label="Total Pesanan" value={summary.orders_count} isCurrency={false} />
                        <BreakdownRow label="Unit Terjual" value={summary.units_sold} isCurrency={false} />
                        <BreakdownRow label="Omset" value={summary.gross_revenue} />
                        <BreakdownRow label="Kewajiban Awal" value={summary.center_share} />
                        <BreakdownRow label="Keuntungan Outlet" value={summary.outlet_margin} />
                        {reconciliation.adjustments !== 0 && (
                            <BreakdownRow label="Penyesuaian Return/Exchange" value={reconciliation.adjustments} negative={reconciliation.adjustments < 0} />
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Top Products */}
            {summary.top_products.length > 0 && (
                <SectionCard label="Produk Terlaris" className="mb-24">
                    <div className="mt-2 space-y-2">
                        {summary.top_products.map((product, index) => (
                            <div key={product.product_name} className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2.5">
                                <div className="flex items-center gap-2.5">
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
                </SectionCard>
            )}

            {/* Sticky Payment CTA */}
            {hasSales && !isSettled && !hasPendingPayment && (
                <StickyActionBar
                    actions={[
                        {
                            label: 'Ajukan Pembayaran',
                            onClick: () => setPaymentSheetOpen(true),
                        },
                    ]}
                />
            )}
            </OutletPageShell>

            {/* Payment Bottom Sheet */}
            <PaymentSheet
                open={paymentSheetOpen}
                onClose={() => setPaymentSheetOpen(false)}
                outstanding={reconciliation.outstanding}
            />
        </OutletLayout>
    );
}

/* ── KPI Card ── */
function KpiCard({ label, value, accent, highlight, negative }: { label: string; value: number; accent?: boolean; highlight?: boolean; negative?: boolean }) {
    return (
        <div className={`rounded-xl border p-3.5 ${
            highlight && value > 0
                ? 'border-emerald-200 bg-emerald-50'
                : accent
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-border bg-white'
        }`}>
            <div className="text-[11px] font-medium text-text-muted">{label}</div>
            <div className={`mt-1 text-base font-bold tabular-nums ${
                highlight && value > 0
                    ? 'text-text'
                    : accent
                        ? 'text-text'
                        : 'text-text'
            }`}>
                {negative ? '- ' : ''}{formatCurrency(value)}
            </div>
        </div>
    );
}

/* ── Breakdown Row ── */
function BreakdownRow({ label, value, negative, muted, isCurrency = true }: { label: string; value: number; negative?: boolean; muted?: boolean; isCurrency?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className={`text-sm ${muted ? 'text-text-subtle' : 'text-text-muted'}`}>{label}</span>
            <span className={`text-sm font-semibold tabular-nums ${negative ? 'text-emerald-600' : muted ? 'text-text-subtle' : 'text-text'}`}>
                {negative && value > 0 ? '- ' : ''}{isCurrency ? formatCurrency(Math.abs(value)) : value}
            </span>
        </div>
    );
}

/* ── Timeline Item ── */
function TimelineItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
    const isCredit = entry.type === 'sale';
    const isAdjustment = entry.type === 'adjustment';

    const typeLabels: Record<string, string> = {
        sale: 'Penjualan',
        settlement: 'Pembayaran',
        adjustment: 'Penyesuaian Return/Exchange',
    };

    return (
        <div className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
                <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isCredit ? 'bg-text-subtle' : isAdjustment ? 'bg-amber-500' : 'bg-blue-500'}`} />
                {!isLast && <div className="w-px flex-1 bg-surface-muted" />}
            </div>

            <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-sm font-medium text-text">{typeLabels[entry.type] ?? entry.type}</div>
                        {entry.notes && <div className="text-[11px] text-text-muted">{entry.notes}</div>}
                    </div>
                    <div className={`text-sm font-bold tabular-nums ${isCredit ? 'text-text' : 'text-emerald-600'}`}>
                        {isCredit ? '+ ' : '- '}{formatCurrency(Math.abs(entry.amount))}
                    </div>
                </div>
                <div className="mt-0.5 text-[11px] text-text-subtle">{formatDate(entry.created_at)}</div>
            </div>
        </div>
    );
}

/* ── Payment Bottom Sheet ── */
function PaymentSheet({ open, onClose, outstanding }: { open: boolean; onClose: () => void; outstanding: number }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        amount: '',
        reference_number: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/outlet/settlement-payments', {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <BottomSheet open={open} onClose={onClose} title="Ajukan Pembayaran">
            <form onSubmit={handleSubmit} className="space-y-4">
                {outstanding > 0 && (
                    <div className="rounded-xl bg-surface-muted p-3 text-center">
                        <div className="text-[11px] font-medium text-text-muted">Belum Disetor</div>
                        <div className="mt-0.5 text-lg font-bold text-text">{formatCurrency(outstanding)}</div>
                    </div>
                )}

                <div>
                    <label className="mb-1.5 block text-xs font-semibold text-text">Nominal (Rp)</label>
                    <input
                        type="number"
                        value={data.amount}
                        onChange={(e) => setData('amount', e.target.value)}
                        min="1"
                        required
                        className="w-full rounded-lg border border-border px-3 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                        placeholder="Masukkan nominal"
                    />
                    {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold text-text">Referensi Transfer</label>
                    <input
                        type="text"
                        value={data.reference_number}
                        onChange={(e) => setData('reference_number', e.target.value)}
                        required
                        maxLength={100}
                        className="w-full rounded-lg border border-border px-3 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                        placeholder="No. referensi transfer"
                    />
                    {errors.reference_number && <p className="mt-1 text-xs text-red-600">{errors.reference_number}</p>}
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold text-text">Tanggal Transfer</label>
                    <input
                        type="date"
                        value={data.payment_date}
                        onChange={(e) => setData('payment_date', e.target.value)}
                        required
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-lg border border-border px-3 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    {errors.payment_date && <p className="mt-1 text-xs text-red-600">{errors.payment_date}</p>}
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-semibold text-text">Catatan (opsional)</label>
                    <textarea
                        value={data.notes}
                        onChange={(e) => setData('notes', e.target.value)}
                        maxLength={500}
                        rows={2}
                        className="w-full rounded-lg border border-border px-3 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20"
                        placeholder="Transfer via BCA..."
                    />
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="flex min-h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                >
                    {processing ? 'Mengirim...' : 'Kirim Bukti Pembayaran'}
                </button>
            </form>
        </BottomSheet>
    );
}
