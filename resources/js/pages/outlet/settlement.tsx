import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChartColumn, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import OutletPageShell from '@/components/outlet/outlet-page-shell';
import BottomSheet from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/empty-state';
import FilterChips from '@/components/ui/filter-chips';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import StickyActionBar from '@/components/ui/sticky-action-bar';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

interface SettlementSummary {
    gross_revenue: number;
    sales_amount: number;
    delivery_fee_amount: number;
    center_share: number;
    outlet_margin: number;
    settled_amount: number;
    outstanding_amount: number;
    units_sold: number;
    orders_count: number;
    top_products: unknown[];
}

interface Reconciliation {
    center_share: number;
    verified_payments: number;
    pending_payments: number;
    rejected_payments: number;
    outstanding: number;
    adjustments: number;
    last_payment: { date: string; amount: number; reference: string } | null;
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
    period_label: string;
    period_start: string;
    period_end: string;
    due_date: string;
    status: string;
    outstanding: number;
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
    periodRange: { from: string; to: string } | null;
}

const periods = [
    { key: 'all', label: 'Semua' },
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
    const [detailOpen, setDetailOpen] = useState(false);

    const handlePeriodChange = (newPeriod: string) => {
        router.get('/outlet/settlement', { period: newPeriod }, { preserveState: true });
    };

    const hasPayments = payments.length > 0;
    const hasTimeline = timeline.length > 0;
    const hasSales = summary.orders_count > 0;
    const isSettled = reconciliation.outstanding <= 0;
    const visiblePayments = payments.slice(0, 3);
    const hasMorePayments = payments.length > 3;

    return (
        <OutletLayout
            title="Settlement"
            subtitle="Setoran ke pusat"
            headerBelow={<FilterChips options={periods} active={period} onChange={handlePeriodChange} />}
            actionBarSlot={hasSales && !isSettled && !hasPendingPayment ? (
                <StickyActionBar
                    actions={[
                        {
                            label: 'Ajukan Pembayaran',
                            onClick: () => setPaymentSheetOpen(true),
                        },
                    ]}
                />
            ) : undefined}
        >
            <Head title="Settlement" />
            <OutletPageShell>
            {/* ── 1. Hero: Outstanding + Rekening + Action ── */}
            {isSettled ? (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-text">Semua settlement sudah lunas</span>
                    </div>
                </div>
            ) : (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Total Belum Disetor</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums text-red-600">
                        {formatCurrency(reconciliation.outstanding)}
                    </div>

                    {/* Compact unpaid breakdown */}
                    {timeline.filter(t => t.outstanding > 0).length > 0 && (
                        <div className="mt-3 space-y-1">
                            {timeline.filter(t => t.outstanding > 0).map(t => (
                                <div key={t.id} className="flex items-center justify-between text-xs">
                                    <span className="text-text-muted">{t.period_label}</span>
                                    <span className="font-semibold tabular-nums text-red-600">{formatCurrency(t.outstanding)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {paymentAccounts.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                            {paymentAccounts.map((account) => (
                                <div key={account.id} className="flex items-center gap-2 rounded-lg bg-red-100/50 px-3 py-2">
                                    <span className="text-[11px] font-bold text-red-800">{account.bank_name}</span>
                                    <span className="text-[11px] text-red-700">{account.account_number}</span>
                                    <span className="text-[10px] text-red-600">a.n. {account.account_holder}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {hasPendingPayment ? (
                        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                            <div className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-medium text-amber-800">Pembayaran sedang menunggu verifikasi</span>
                            </div>
                        </div>
                    ) : (
                        <Button size="lg" onClick={() => setPaymentSheetOpen(true)} className="mt-3 w-full">
                            Ajukan Pembayaran
                        </Button>
                    )}
                </div>
            )}

            {/* No Sales Empty State */}
            {!hasSales && (
                <EmptyState
                    icon={<ChartColumn className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada penjualan"
                    description="Belum ada penjualan pada periode ini."
                />
            )}

            {/* Persistent Rekening Info */}
            {paymentAccounts.length > 0 && isSettled && (
                <SectionCard label="Rekening Setoran">
                    <div className="mt-2 space-y-1.5">
                        {paymentAccounts.map((account) => (
                            <div key={account.id} className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
                                <span className="text-[11px] font-bold text-text">{account.bank_name}</span>
                                <span className="text-[11px] text-text-muted">{account.account_number}</span>
                                <span className="text-[10px] text-text-subtle">a.n. {account.account_holder}</span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* ── 2. Settlement Mingguan ── */}
            {hasTimeline && (
                <SectionCard label="Settlement Mingguan">
                    <div className="mt-2 space-y-0">
                        {timeline.map((entry, idx) => (
                            <TimelineItem key={entry.id} entry={entry} isLast={idx === timeline.length - 1} />
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* ── 3. Riwayat Pembayaran (max 3) ── */}
            {hasPayments && (
                <SectionCard label="Riwayat Pembayaran">
                    <div className="mt-2 space-y-2">
                        {visiblePayments.map((payment) => (
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
                        {hasMorePayments && (
                            <Link href="/outlet/settlement-payments" className="flex min-h-11 items-center justify-center text-xs font-semibold text-primary">
                                Lihat Semua Pembayaran →
                            </Link>
                        )}
                    </div>
                </SectionCard>
            )}

            {!hasPayments && hasSales && (
                <SectionCard label="Riwayat Pembayaran">
                    <EmptyState title="Belum ada riwayat pembayaran" />
                </SectionCard>
            )}

            {/* ── 4. Detail Rincian (expandable) ── */}
            {hasSales && (
                <SectionCard label="Detail Rincian" className="mb-24">
                    <button
                        type="button"
                        onClick={() => setDetailOpen(!detailOpen)}
                        className="flex w-full items-center justify-between py-1 text-xs font-semibold text-text-muted"
                    >
                        <span>{detailOpen ? 'Sembunyikan rincian' : 'Lihat rincian periode'}</span>
                        {detailOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {detailOpen && (
                        <div className="mt-3 space-y-2">
                            <BreakdownRow label="Total Pesanan" value={summary.orders_count} isCurrency={false} />
                            <BreakdownRow label="Omset Produk" value={summary.sales_amount} />
                            <BreakdownRow label="Ongkos Kirim" value={summary.delivery_fee_amount} />
                            <div className="border-t border-border pt-2">
                                <BreakdownRow label="Total Pendapatan" value={summary.gross_revenue} />
                            </div>
                            <BreakdownRow label="Kewajiban (Harga Pusat)" value={summary.center_share} />
                            <BreakdownRow label="Keuntungan Outlet" value={summary.outlet_margin} accent />
                            {reconciliation.adjustments !== 0 && (
                                <BreakdownRow label="Penyesuaian Return/Exchange" value={reconciliation.adjustments} negative={reconciliation.adjustments < 0} />
                            )}
                            <div className="border-t border-border pt-2">
                                <BreakdownRow label="Sudah Disetor" value={reconciliation.verified_payments} />
                                {reconciliation.pending_payments > 0 && (
                                    <BreakdownRow label="Menunggu Verifikasi" value={reconciliation.pending_payments} muted />
                                )}
                                <div className="mt-1">
                                    <BreakdownRow label="Belum Disetor" value={reconciliation.outstanding} negative={false} accent />
                                </div>
                            </div>
                        </div>
                    )}
                </SectionCard>
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

/* ── Breakdown Row ── */
function BreakdownRow({ label, value, negative, muted, accent, isCurrency = true }: { label: string; value: number; negative?: boolean; muted?: boolean; accent?: boolean; isCurrency?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className={`text-sm ${muted ? 'text-text-subtle' : 'text-text-muted'}`}>{label}</span>
            <span className={`text-sm font-semibold tabular-nums ${negative ? 'text-emerald-600' : accent ? 'text-emerald-700' : muted ? 'text-text-subtle' : 'text-text'}`}>
                {negative && value > 0 ? '- ' : ''}{isCurrency ? formatCurrency(Math.abs(value)) : value}
            </span>
        </div>
    );
}

/* ── Timeline Item ── */
function TimelineItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
    const isPaid = entry.status === 'paid';
    const isPartial = entry.status === 'partial';
    const isOverdue = entry.status === 'overdue';

    const statusColor = isPaid
        ? 'bg-emerald-500'
        : isOverdue
            ? 'bg-red-500'
            : isPartial
                ? 'bg-amber-500'
                : 'bg-text-subtle';

    const statusLabel = isPaid
        ? 'Lunas'
        : isOverdue
            ? 'Terlambat'
            : isPartial
                ? 'Sebagian'
                : 'Belum Bayar';

    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`} />
                {!isLast && <div className="w-px flex-1 bg-surface-muted" />}
            </div>

            <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-sm font-medium text-text">{entry.period_label}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isPaid ? 'bg-emerald-50 text-emerald-700' : isOverdue ? 'bg-red-50 text-red-700' : isPartial ? 'bg-amber-50 text-amber-700' : 'bg-surface-muted text-text-muted'
                            }`}>{statusLabel}</span>
                            <span className="text-[11px] text-text-subtle">Jatuh tempo: {formatDate(entry.due_date)}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold tabular-nums text-text">{formatCurrency(entry.amount)}</div>
                        {entry.outstanding > 0 && (
                            <div className="text-[11px] font-medium tabular-nums text-red-600">Sisa: {formatCurrency(entry.outstanding)}</div>
                        )}
                    </div>
                </div>
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
