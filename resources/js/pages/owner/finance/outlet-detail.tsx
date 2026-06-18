import { Send, DollarSign } from 'lucide-react';
import { useState } from 'react';
import InvoiceModal from '@/components/owner/invoice-modal';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import PaymentModal from '@/components/owner/settlement-payment-modal';
import DataTable from '@/components/ui/data-table';
import { formatCurrency } from '@/lib/format';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    generated: { label: 'Belum Bayar', className: 'bg-slate-100 text-slate-600' },
    pending: { label: 'Belum Bayar', className: 'bg-slate-100 text-slate-600' },
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

const settlementColumns = [
    { key: 'period_date', label: 'Periode', className: 'text-slate-600' },
    {
        key: 'amount_due',
        label: 'Tagihan',
        className: 'text-right tabular-nums font-semibold',
        render: (row: any) => formatCurrency(row.amount_due),
    },
    {
        key: 'paid_amount',
        label: 'Dibayar',
        className: 'text-right tabular-nums text-emerald-600',
        render: (row: any) => formatCurrency(row.paid_amount),
    },
    {
        key: 'outstanding',
        label: 'Sisa',
        className: 'text-right tabular-nums font-semibold text-red-600',
        render: (row: any) => formatCurrency(Math.max(0, row.outstanding)),
    },
    { key: 'due_date', label: 'Jatuh Tempo', className: 'text-slate-600' },
    {
        key: 'status',
        label: 'Status',
        render: (row: any) => {
            const badge = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.generated;
            const overdueLabel = getOverdueLabel(row.due_date);

            return (
                <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
                    {overdueLabel && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">{overdueLabel}</span>
                    )}
                </div>
            );
        },
    },
];

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
            <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>{statusLabel}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-400">Total Tagihan</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(summary.total_due)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-400">Sudah Dibayar</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(summary.paid_total)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-400">Sisa Tagihan</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-red-600">{formatCurrency(summary.outstanding)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-400">Keterlambatan</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                            {summary.days_overdue > 0 ? `${summary.days_overdue} Hari` : '-'}
                        </div>
                    </div>
                </div>
                {summary.oldest_due_date && (
                    <div className="mt-3 text-xs text-slate-500">
                        Tagihan terlama: {summary.oldest_due_date}
                    </div>
                )}
            </section>

            {/* Sticky Action Bar */}
            <div className="sticky top-0 z-20 mb-4 flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
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
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                >
                    <DollarSign className="h-4 w-4" />
                    Catat Pembayaran
                </button>
            </div>

            {/* Settlement List */}
            <section className="rounded-xl border border-slate-200 bg-white">
                <div className="px-4 py-3">
                    <h2 className="text-base font-semibold text-slate-900">Daftar Tagihan</h2>
                </div>
                <DataTable columns={settlementColumns} data={settlements} rowKey="id" emptyMessage="Tidak ada tagihan." />
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
