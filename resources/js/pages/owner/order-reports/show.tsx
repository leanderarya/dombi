import { Head, Link, router, useForm } from '@inertiajs/react';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import StatusBadge from '@/components/ui/status-badge';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency, formatDate } from '@/lib/format';

const typeLabels: Record<string, string> = {
    not_received: 'Barang tidak diterima',
    wrong_items: 'Barang salah',
    damaged: 'Barang rusak',
    other: 'Lainnya',
};

const statusTransitions: Record<string, string[]> = {
    pending: ['investigating', 'resolved', 'rejected'],
    investigating: ['resolved', 'rejected'],
};

const statusLabels: Record<string, string> = {
    investigating: 'Sedang Ditinjau',
    resolved: 'Selesai',
    rejected: 'Ditolak',
};

export default function OwnerOrderReportShow({ report }: any) {
    const [editMode, setEditMode] = useState(false);
    const form = useForm({
        status: '',
        resolution_notes: '',
    });

    const handleSubmit = () => {
        if (!form.data.status) return;

        router.put(`/owner/order-reports/${report.id}`, form.data, {
            onSuccess: () => setEditMode(false),
        });
    };

    const allowedTransitions = statusTransitions[report.status] ?? [];
    const isFinal = report.status === 'resolved' || report.status === 'rejected';

    return (
        <OwnerLayout title={`Laporan #${report.id}`} backHref="/owner/order-reports" hideNav>
            <Head title={`Laporan #${report.id}`} />

            {/* Status */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-white p-4">
                <div>
                    <div className="text-sm font-semibold text-text">{report.order?.order_code ?? `Order #${report.order_id}`}</div>
                    <div className="mt-0.5 text-xs text-text-muted">{formatDate(report.created_at)}</div>
                </div>
                <StatusBadge status={report.status === 'pending' ? 'pending_confirmation' : report.status === 'investigating' ? 'preparing' : report.status} />
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
                            <span className="text-text-muted">Outlet</span>
                            <span className="font-medium text-text">{report.order.outlet?.name ?? '-'}</span>
                        </div>
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

            {/* Action */}
            {!isFinal && !editMode && (
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => setEditMode(true)}
                        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80"
                    >
                        Tanggapi Laporan
                    </button>
                </div>
            )}

            {/* Edit Form */}
            {editMode && (
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <div className="text-[13px] text-text-subtle">Ubah Status</div>
                    <div className="mt-3 space-y-2">
                        {allowedTransitions.map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => form.setData('status', status)}
                                className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
                                    form.data.status === status
                                        ? 'border-primary bg-primary-light text-primary'
                                        : 'border-border text-text active:opacity-80'
                                }`}
                            >
                                {statusLabels[status]}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3">
                        <label className="text-[13px] text-text-subtle">Catatan Resolusi</label>
                        <textarea
                            value={form.data.resolution_notes}
                            onChange={(e) => form.setData('resolution_notes', e.target.value)}
                            placeholder="Jelaskan tindakan yang diambil..."
                            className="mt-1 min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>

                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setEditMode(false); form.reset(); }}
                            className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!form.data.status || form.processing}
                            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                        >
                            {form.processing ? 'Menyimpan...' : 'Simpan'}
                        </button>
                    </div>
                </div>
            )}
        </OwnerLayout>
    );
}
