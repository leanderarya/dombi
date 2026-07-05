import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const typeLabels: Record<string, string> = {
    not_received: 'Barang tidak diterima',
    wrong_items: 'Barang salah',
    damaged: 'Barang rusak',
    other: 'Lainnya',
};

const statusLabels: Record<string, { label: string; variant: string }> = {
    pending: { label: 'Menunggu Tinjauan', variant: 'warning' },
    investigating: { label: 'Sedang Ditinjau', variant: 'info' },
    resolved: { label: 'Telah Diselesaikan', variant: 'success' },
    rejected: { label: 'Tidak Dapat Diproses', variant: 'danger' },
};

export default function OutletOrderReportShow({ report }: any) {
    const [respondMode, setRespondMode] = useState(false);
    const form = useForm({ resolution_notes: '' });
    const isPending = report.status === 'pending';
    const isFinal = report.status === 'resolved' || report.status === 'rejected';
    const reportStatus = statusLabels[report.status] ?? { label: report.status, variant: 'neutral' };

    const handleRespond = () => {
        router.put(`/outlet/order-reports/${report.id}`, form.data, {
            onSuccess: () => setRespondMode(false),
        });
    };

    return (
        <OutletLayout title={`Laporan #${report.id}`} backHref="/outlet/order-reports">
            <Head title={`Laporan #${report.id}`} />

            {/* Status */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-white p-4">
                <div>
                    <div className="text-sm font-semibold text-text">{report.order?.order_code ?? `Order #${report.order_id}`}</div>
                    <div className="mt-0.5 text-xs text-text-muted">{formatDate(report.created_at)}</div>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    reportStatus.variant === 'success' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                    reportStatus.variant === 'danger' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' :
                    reportStatus.variant === 'info' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' :
                    'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                }`}>
                    {reportStatus.label}
                </span>
            </div>

            {/* Report Info */}
            <div className="mt-4 rounded-xl border border-border bg-white p-4">
                <div className="text-[13px] text-text-subtle">Laporan</div>
                <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-text-muted">Jenis</span>
                        <span className="font-medium text-text">{typeLabels[report.type] ?? report.type}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-text-muted">Customer</span>
                        <span className="font-medium text-text">{report.customer?.name}</span>
                    </div>
                    {report.notes && (
                        <div className="mt-2">
                            <span className="text-text-muted">Catatan:</span>
                            <p className="mt-1 text-text">{report.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Order Info */}
            {report.order && (
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="text-[13px] text-text-subtle">Pesanan</div>
                    <div className="mt-2 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Total</span>
                            <span className="font-medium text-text">{formatCurrency(report.order.total)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Status</span>
                            <StatusBadge status={report.order.status} />
                        </div>
                    </div>
                </div>
            )}

            {/* Resolution */}
            {isFinal && (
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="text-[13px] text-text-subtle">Resolusi</div>
                    <div className="mt-2 text-sm text-text">{report.resolution_notes ?? '-'}</div>
                    {report.resolver && (
                        <div className="mt-2 text-xs text-text-muted">Oleh: {report.resolver.name}</div>
                    )}
                </div>
            )}

            {/* Respond Button (pending only) */}
            {isPending && !respondMode && (
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => setRespondMode(true)}
                        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80"
                    >
                        Tanggapi Laporan
                    </button>
                </div>
            )}

            {/* Respond Form */}
            {respondMode && (
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="text-[13px] text-text-subtle">Tanggapi Laporan</div>
                    <div className="mt-3">
                        <textarea
                            value={form.data.resolution_notes}
                            onChange={(e) => form.setData('resolution_notes', e.target.value)}
                            placeholder="Jelaskan tindakan yang akan diambil..."
                            className="min-h-24 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
 setRespondMode(false); form.reset(); 
}}
                            className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleRespond}
                            disabled={form.processing}
                            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                        >
                            {form.processing ? 'Mengirim...' : 'Kirim Tanggapan'}
                        </button>
                    </div>
                </div>
            )}

            {/* Info for already investigating */}
            {!isPending && !isFinal && (
                <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-center">
                    <div className="text-sm text-text-muted">Laporan sedang ditinjau. Owner akan menentukan resolusi akhir.</div>
                </div>
            )}
        </OutletLayout>
    );
}
