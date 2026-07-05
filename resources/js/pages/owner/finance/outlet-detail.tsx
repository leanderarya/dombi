import { Send, DollarSign } from 'lucide-react';
import { useState } from 'react';
import InvoiceModal from '@/components/owner/invoice-modal';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import PaymentModal from '@/components/owner/settlement-payment-modal';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    generated: { label: 'Belum Bayar', className: 'bg-slate-100 text-text-muted' },
    pending: { label: 'Belum Bayar', className: 'bg-slate-100 text-text-muted' },
    due_today: { label: 'Jatuh Tempo', className: 'bg-amber-50 text-amber-700' },
    overdue: { label: 'Terlambat', className: 'bg-red-50 text-red-700' },
    partial: { label: 'Sebagian', className: 'bg-blue-50 text-blue-700' },
    paid: { label: 'Lunas', className: 'bg-emerald-50 text-emerald-700' },
};

function getOverdueLabel(dueDate: string): string | null {
    const due = new Date(dueDate);
    const now = new Date();
    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    if (diff <= 0) {
        return null;
    }

    return `${diff} Hari`;
}

function getSettlementBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'paid') {
return 'success';
}

    if (status === 'partial') {
return 'warning';
}

    if (status === 'overdue' || status === 'due_today') {
return 'danger';
}

    return 'neutral';
}

export default function OutletAccountStatement({ outlet, settlements, summary, unpaidBreakdown }: any) {
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [invoiceOpen, setInvoiceOpen] = useState(false);

    const statusLabel = summary.display_status === 'paid' ? 'Lunas' : summary.display_status === 'partial' ? 'Sebagian' : 'Belum Bayar';
    const statusClass = summary.display_status === 'paid'
        ? 'bg-emerald-50 text-emerald-700'
        : summary.display_status === 'partial'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-red-50 text-red-700';

    return (
        <OwnerPageShell
            title={outlet.name}
            subtitle="Ringkasan tagihan outlet"
            backHref="/owner/finance"
        >
            {/* Summary Card */}
            <section className="mb-5 rounded-xl border border-border bg-white p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Status</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>{statusLabel}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                        <div className="text-[11px] font-semibold uppercase text-text-subtle">Omset Produk</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-text">{formatCurrency(summary.total_sales)}</div>
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold uppercase text-text-subtle">Ongkos Kirim</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-blue-600">{formatCurrency(summary.total_delivery_fee)}</div>
                    </div>
                    <div>
                        <div className="text-[11px] font-semibold uppercase text-text-subtle">Sisa Tagihan</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-red-600">{formatCurrency(summary.outstanding)}</div>
                    </div>
                    {summary.overpaid > 0 ? (
                        <div>
                            <div className="text-[11px] font-semibold uppercase text-text-subtle">Kelebihan Bayar</div>
                            <div className="mt-1 text-lg font-bold tabular-nums text-blue-600">{formatCurrency(summary.overpaid)}</div>
                        </div>
                    ) : (
                        <div>
                            <div className="text-[11px] font-semibold uppercase text-text-subtle">Keterlambatan</div>
                            <div className="mt-1 text-lg font-bold tabular-nums text-text">
                                {summary.days_overdue > 0 ? `${summary.days_overdue} Hari` : '-'}
                            </div>
                        </div>
                    )}
                </div>
                {summary.oldest_due_date && (
                    <div className="mt-3 text-xs text-text-muted">
                        Tagihan terlama: {summary.oldest_due_date}
                    </div>
                )}
            </section>

            {/* Sticky Action Bar — only when there is outstanding */}
            {summary.outstanding > 0 && (
                <div className="sticky top-0 z-20 mb-4 flex gap-3 rounded-xl border border-border bg-white p-3 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setInvoiceOpen(true)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100"
                    >
                        <Send className="h-4 w-4" />
                        Kirim Tagihan
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaymentOpen(true)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark"
                    >
                        <DollarSign className="h-4 w-4" />
                        Catat Pembayaran
                    </button>
                </div>
            )}

            {/* Settlement List */}
            <section>
                <h2 className="mb-3 text-base font-semibold text-text">Daftar Tagihan</h2>
                {settlements.length === 0 && (
                    <div className="rounded-xl border border-border bg-white p-10 text-center">
                        <p className="text-sm text-text-muted">Tidak ada tagihan.</p>
                    </div>
                )}
                <div className="space-y-3">
                    {settlements.map((s: any) => {
                        const badge = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.generated;
                        const overdueLabel = getOverdueLabel(s.due_date);

                        return (
                            <div key={s.id} className="rounded-xl border border-border bg-white p-5 transition-all duration-200 hover:shadow-md">
                                {/* Top row: period + status + amount due */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-lg font-bold tabular-nums text-text">{s.period_label}</div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <StatusBadge variant={getSettlementBadgeVariant(s.status)} size="sm">
                                                {badge.label}
                                            </StatusBadge>
                                            {overdueLabel && (
                                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">{overdueLabel}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(s.amount_due)}</span>
                                </div>

                                {/* Middle row: metadata */}
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
                                    <span>Produk: {formatCurrency(s.sales_amount)}</span>
                                    {s.delivery_fee_amount > 0 && (
                                        <>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span className="text-blue-600">Ongkir: {formatCurrency(s.delivery_fee_amount)}</span>
                                        </>
                                    )}
                                    <span className="text-text-subtle">&middot;</span>
                                    <span className="text-emerald-600">Dibayar: {formatCurrency(s.paid_amount)}</span>
                                    {s.outstanding > 0 && (
                                        <>
                                            <span className="text-text-subtle">&middot;</span>
                                            <span className="font-semibold text-red-600">Sisa: {formatCurrency(s.outstanding)}</span>
                                        </>
                                    )}
                                </div>
                                {s.overpaid_amount > 0 && (
                                    <div className="mt-2">
                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                            Kelebihan {formatCurrency(s.overpaid_amount)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Payment Modal — sends to outlet-level endpoint with FIFO */}
            {paymentOpen && (
                <PaymentModal
                    open={paymentOpen}
                    onClose={() => setPaymentOpen(false)}
                    outletId={outlet.id}
                    outletName={outlet.name}
                    outstanding={summary.outstanding}
                />
            )}

            {/* Invoice Modal — shows all unpaid breakdown */}
            {invoiceOpen && (
                <InvoiceModal
                    open={invoiceOpen}
                    onClose={() => setInvoiceOpen(false)}
                    outletId={outlet.id}
                    outletName={outlet.name}
                    totalOutstanding={summary.outstanding}
                    unpaidBreakdown={unpaidBreakdown}
                />
            )}
        </OwnerPageShell>
    );
}
