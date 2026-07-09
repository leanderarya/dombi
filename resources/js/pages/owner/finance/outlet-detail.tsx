import { Send, DollarSign } from 'lucide-react';
import { useState } from 'react';
import InvoiceModal from '@/components/owner/invoice-modal';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import PaymentModal from '@/components/owner/settlement-payment-modal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
    if (diff <= 0) return null;
    return `${diff} Hari`;
}

function getSettlementBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'paid') return 'success';
    if (status === 'partial') return 'warning';
    if (status === 'overdue' || status === 'due_today') return 'danger';
    return 'neutral';
}

export default function OutletAccountStatement({ outlet, settlements, summary, unpaidBreakdown }: any) {
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [invoiceOpen, setInvoiceOpen] = useState(false);

    if (!outlet || !summary) {
        return (
            <OwnerPageShell title="Memuat..." subtitle="Detail tagihan outlet" backHref="/owner/finance">
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const statusLabel = summary.display_status === 'paid' ? 'Lunas' : summary.display_status === 'partial' ? 'Sebagian' : 'Belum Bayar';
    const statusVariant = summary.display_status === 'paid' ? 'success' : summary.display_status === 'partial' ? 'warning' : 'danger';

    return (
        <OwnerPageShell
            title={outlet.name}
            subtitle="Ringkasan tagihan outlet"
            backHref="/owner/finance"
        >
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    {summary.outstanding > 0 && (
                        <div className="sticky top-0 z-20 flex gap-3 rounded-lg border border-border bg-white p-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setInvoiceOpen(true)}
                            >
                                <Send className="h-4 w-4" />
                                Kirim Tagihan
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={() => setPaymentOpen(true)}
                            >
                                <DollarSign className="h-4 w-4" />
                                Catat Pembayaran
                            </Button>
                        </div>
                    )}

                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Ringkasan</div>
                        <OwnerDetailRow label="Omset Produk" value={formatCurrency(summary.total_sales)} bold />
                        <OwnerDetailRow label="Ongkos Kirim" value={<span className="text-blue-600">{formatCurrency(summary.total_delivery_fee)}</span>} />
                        <OwnerDetailRow label="Sisa Tagihan" value={<span className="font-semibold text-red-600">{formatCurrency(summary.outstanding)}</span>} bold />
                        {summary.overpaid > 0 ? (
                            <OwnerDetailRow label="Kelebihan Bayar" value={<span className="text-blue-600">{formatCurrency(summary.overpaid)}</span>} />
                        ) : (
                            <OwnerDetailRow label="Keterlambatan" value={summary.days_overdue > 0 ? `${summary.days_overdue} Hari` : '-'} />
                        )}
                        {summary.oldest_due_date && (
                            <div className="mt-2 text-xs text-text-muted">
                                Tagihan terlama: {summary.oldest_due_date}
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Daftar Tagihan</div>
                        {settlements.length === 0 ? (
                            <p className="py-6 text-center text-sm text-text-muted">Tidak ada tagihan.</p>
                        ) : (
                            <div className="space-y-3">
                                {settlements.map((s: any) => {
                                    const badge = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.generated;
                                    const overdueLabel = getOverdueLabel(s.due_date);

                                    return (
                                        <div key={s.id} className="rounded-lg border border-border bg-white p-4 transition-all duration-200">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="text-base font-bold tabular-nums text-text">{s.period_label}</div>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <StatusBadge variant={getSettlementBadgeVariant(s.status)} size="sm">
                                                            {badge.label}
                                                        </StatusBadge>
                                                        {overdueLabel && (
                                                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{overdueLabel}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(s.amount_due)}</span>
                                            </div>
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
                                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                                        Kelebihan {formatCurrency(s.overpaid_amount)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Status</div>
                        <div className="flex items-center gap-2">
                            <StatusBadge variant={statusVariant} size="md">{statusLabel}</StatusBadge>
                        </div>
                        <div className="mt-4 space-y-2">
                            <OwnerDetailRow label="Omset" value={formatCurrency(summary.total_sales)} />
                            <OwnerDetailRow label="Sisa" value={<span className="font-semibold text-red-600">{formatCurrency(summary.outstanding)}</span>} bold />
                            {summary.overpaid > 0 && (
                                <OwnerDetailRow label="Kelebihan" value={<span className="text-blue-600">{formatCurrency(summary.overpaid)}</span>} />
                            )}
                            <OwnerDetailRow label="Keterlambatan" value={summary.days_overdue > 0 ? `${summary.days_overdue} Hari` : '-'} />
                        </div>
                        {summary.oldest_due_date && (
                            <div className="mt-3 text-xs text-text-muted">
                                Tagihan terlama: {summary.oldest_due_date}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {paymentOpen && (
                <PaymentModal
                    open={paymentOpen}
                    onClose={() => setPaymentOpen(false)}
                    outletId={outlet.id}
                    outletName={outlet.name}
                    outstanding={summary.outstanding}
                />
            )}

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
