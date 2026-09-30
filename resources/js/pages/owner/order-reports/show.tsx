import { useForm } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ShoppingBag, User } from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/format';

interface Props {
    report: any;
}

/**
 * The one question this page answers is "what do we do about this report?".
 *
 * The status chips are the transitions the controller will actually accept —
 * `pending` may go to investigated or straight to a resolution, `investigating`
 * may only be resolved or rejected, and a final report offers nothing. Sending
 * an illegal transition used to be a server-side refusal the owner only saw
 * after choosing; the select no longer offers one.
 */
const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
    pending: [
        { value: 'investigating', label: 'Tandai sedang ditinjau' },
        { value: 'resolved', label: 'Selesaikan laporan' },
        { value: 'rejected', label: 'Tolak laporan' },
    ],
    investigating: [
        { value: 'resolved', label: 'Selesaikan laporan' },
        { value: 'rejected', label: 'Tolak laporan' },
    ],
};

const TYPE_LABELS: Record<string, string> = {
    not_received: 'Barang tidak diterima',
    wrong_items: 'Barang salah',
    damaged: 'Barang rusak',
    other: 'Lainnya',
};

export default function OwnerOrderReportShow({ report }: Props) {
    const options = TRANSITIONS[report.status] ?? [];
    const canResolve = options.some((option) => option.value === 'resolved');
    const isFinal = options.length === 0;

    const [status, setStatus] = useState(options[0]?.value ?? '');
    const form = useForm({
        status: options[0]?.value ?? '',
        resolution_notes: '',
    });

    const needsNotes = status === 'resolved' || status === 'rejected';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(`/owner/order-reports/${report.id}`);
    };

    return (
        <OwnerPageShell
            title={`Laporan #${report.id}`}
            subtitle={report.order?.order_code ?? `Order #${report.order_id}`}
            backHref="/owner/analytics?tab=masalah"
        >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                    <section className="rounded-2xl border border-border bg-surface p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="font-heading text-base font-bold text-text">
                                    {TYPE_LABELS[report.type] ?? report.type}
                                </div>
                                <div className="mt-0.5 text-xs text-text-muted">
                                    Dilaporkan {formatDate(report.created_at)}
                                </div>
                            </div>
                            <StatusBadge status={report.status} />
                        </div>

                        {report.notes && (
                            <div className="mt-4 rounded-control bg-surface-muted p-3 text-sm text-text">
                                {report.notes}
                            </div>
                        )}
                    </section>

                    {report.order && (
                        <section className="rounded-2xl border border-border bg-surface p-5">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                <ShoppingBag
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Pesanan
                            </div>
                            <div className="space-y-2 text-sm">
                                <Row
                                    label="Kode"
                                    value={report.order.order_code}
                                />
                                <Row
                                    label="Outlet"
                                    value={report.order.outlet?.name ?? '-'}
                                />
                                <Row
                                    label="Total"
                                    value={formatCurrency(report.order.total)}
                                />
                                <div className="flex items-center justify-between">
                                    <span className="text-text-muted">
                                        Status
                                    </span>
                                    <StatusBadge
                                        status={report.order.status}
                                        size="sm"
                                    />
                                </div>
                            </div>

                            {report.order.items?.length > 0 && (
                                <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                                    {report.order.items.map((item: any) => (
                                        <li
                                            key={item.id}
                                            className="flex justify-between gap-3"
                                        >
                                            <span className="text-text">
                                                {item.product_name}
                                            </span>
                                            <span className="text-text-muted tabular-nums">
                                                {item.quantity}x
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

                    {(report.resolution_notes || report.resolver) && (
                        <section className="rounded-2xl border border-border bg-surface p-5">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                <CheckCircle2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Resolusi
                            </div>
                            <p className="text-sm text-text">
                                {report.resolution_notes ?? '-'}
                            </p>
                            <div className="mt-2 text-xs text-text-muted">
                                {report.resolver?.name
                                    ? `Oleh ${report.resolver.name}`
                                    : ''}
                                {report.resolved_at
                                    ? ` · ${formatDate(report.resolved_at)}`
                                    : ''}
                            </div>
                        </section>
                    )}
                </div>

                <div className="space-y-4">
                    <section className="rounded-2xl border border-border bg-surface p-5">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                            <User className="h-4 w-4" aria-hidden="true" />
                            Pelanggan
                        </div>
                        <div className="text-sm font-semibold text-text">
                            {report.customer?.name ?? '-'}
                        </div>
                        {report.customer?.phone && (
                            <div className="mt-0.5 text-xs text-text-muted">
                                {report.customer.phone}
                            </div>
                        )}
                    </section>

                    {isFinal ? (
                        <section className="rounded-2xl border border-border bg-surface-muted p-5 text-sm text-text-muted">
                            Laporan ini sudah selesai. Tidak ada tindakan
                            lanjutan yang tersedia.
                        </section>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-4 rounded-2xl border border-border bg-surface p-5"
                        >
                            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
                                <AlertTriangle
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                />
                                Tindakan
                            </div>

                            <Select
                                label="Status"
                                value={status}
                                onChange={(e) => {
                                    setStatus(e.target.value);
                                    form.setData('status', e.target.value);
                                }}
                                options={options}
                            />

                            <Textarea
                                label={
                                    needsNotes
                                        ? 'Catatan resolusi'
                                        : 'Catatan resolusi (opsional)'
                                }
                                value={form.data.resolution_notes}
                                onChange={(e) =>
                                    form.setData(
                                        'resolution_notes',
                                        e.target.value,
                                    )
                                }
                                error={form.errors.resolution_notes}
                                placeholder="Jelaskan tindakan yang diambil..."
                            />

                            {form.errors.status && (
                                <p className="text-xs text-danger-text">
                                    {form.errors.status}
                                </p>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={
                                    form.processing ||
                                    !status ||
                                    (needsNotes &&
                                        !form.data.resolution_notes.trim())
                                }
                                loading={form.processing}
                            >
                                {canResolve && status === 'resolved'
                                    ? 'Selesaikan Laporan'
                                    : 'Simpan Tindakan'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </OwnerPageShell>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-text-muted">{label}</span>
            <span className="font-medium text-text">{value}</span>
        </div>
    );
}
