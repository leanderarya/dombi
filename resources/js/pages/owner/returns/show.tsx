import { Link, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import { CheckCircle2, Clock, Package, XCircle } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_BORDER } from '@/lib/status-border';
import { getReturnStatus } from '@/lib/status-labels';

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
    submitted: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
    received_at_center: Package,
    completed: CheckCircle2,
};

export default function OwnerReturnsShow({ return: ret }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);

    const approveForm = useForm({ notes: '' });
    const rejectForm = useForm({ reason: '' });

    const status = getReturnStatus(ret.status);
    const borderClass = STATUS_BORDER[ret.status] ?? 'border-l-gray-300';
    const StatusIcon = STATUS_ICONS[ret.status] ?? Clock;

    const handleApprove = () => {
        approveForm.post(`/owner/returns/${ret.id}/approve`, {
            onSuccess: () => {
                setShowApprove(false);
                approveForm.reset();
            },
        });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/returns/${ret.id}/reject`, {
            onSuccess: () => {
                setShowReject(false);
                rejectForm.reset();
            },
        });
    };

    const handleMarkReceived = () => {
        router.post(`/owner/returns/${ret.id}/mark-received`);
    };

    const handleComplete = () => {
        router.post(`/owner/returns/${ret.id}/complete`);
    };

    return (
        <OwnerPageShell title={`Return #${ret.id}`} subtitle={ret.outlet?.name} backHref="/owner/returns">
            <div className="space-y-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:space-y-0">
                {/* Left: Main Content */}
                <div className="space-y-4">
                    {/* Info */}
                    <SectionCard label="Informasi Return">
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-text-muted">Alasan</dt>
                                <dd className="font-medium text-text">{ret.reason_label ?? ret.reason}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-text-muted">Diajukan</dt>
                                <dd className="text-text">{formatDate(ret.created_at)}</dd>
                            </div>
                            {ret.notes && (
                                <div className="flex justify-between">
                                    <dt className="text-text-muted">Catatan</dt>
                                    <dd className="text-text">{ret.notes}</dd>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <dt className="text-text-muted">Total Nilai</dt>
                                <dd className="font-bold text-primary">{formatCurrency(ret.total_value)}</dd>
                            </div>
                        </dl>
                    </SectionCard>

                    {/* Items */}
                    <SectionCard label="Item Return">
                        <div className="space-y-3">
                            {ret.items?.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                                    <div>
                                        <div className="text-sm font-medium text-text">
                                            {item.variant?.full_name ?? item.variant?.name}
                                        </div>
                                        <div className="text-xs text-text-muted">{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                    </div>
                                    <div className="text-sm font-bold text-text">{formatCurrency(item.subtotal)}</div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    {/* Status History */}
                    {ret.status_histories?.length > 0 && (
                        <SectionCard label="Riwayat Status">
                            <div className="space-y-3">
                                {ret.status_histories.map((h: any, i: number) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                        <div>
                                            <div className="text-sm font-medium text-text">
                                                {getReturnStatus(h.to_status).label}
                                            </div>
                                            <div className="text-xs text-text-muted">
                                                {h.actor?.name} &middot; {formatDate(h.created_at)}
                                            </div>
                                            {h.notes && <div className="mt-0.5 text-xs text-text-muted">{h.notes}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}
                </div>

                {/* Right: Status + Actions Sidebar */}
                <div className="hidden lg:block">
                    <div className="sticky top-24 space-y-4">
                        {/* Status Card */}
                        <div className={`rounded-xl border border-l-4 border-border bg-white p-5 shadow-sm ${borderClass}`}>
                            <div className="flex items-center gap-2">
                                <StatusIcon className="h-5 w-5 text-text-muted" />
                                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Status</span>
                            </div>
                            <div className="mt-2">
                                <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                            </div>
                            <div className="mt-3 text-2xl font-bold text-primary">{formatCurrency(ret.total_value)}</div>
                            <div className="mt-1 text-xs text-text-muted">{ret.items?.length ?? 0} item &middot; {formatDate(ret.created_at)}</div>
                        </div>

                        {/* Actions */}
                        {ret.status === 'submitted' && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => setShowApprove(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:opacity-90"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Setujui Return
                                </button>
                                <button
                                    onClick={() => setShowReject(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3.5 text-sm font-bold text-red-600 transition-all hover:bg-red-50 hover:shadow-sm active:bg-red-100"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Tolak Return
                                </button>
                            </div>
                        )}

                        {ret.status === 'approved' && (
                            <button
                                onClick={handleMarkReceived}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:opacity-90"
                            >
                                <Package className="h-4 w-4" />
                                Barang Diterima di Pusat
                            </button>
                        )}

                        {ret.status === 'received_at_center' && (
                            <button
                                onClick={handleComplete}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:opacity-90"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Selesai & Sesuaikan Settlement
                            </button>
                        )}

                        {ret.status === 'completed' && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                                <div className="mt-2 text-sm font-semibold text-emerald-800">Return Selesai</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Actions */}
                <div className="space-y-3 lg:hidden">
                    <div className={`rounded-xl border border-l-4 border-border bg-white p-4 ${borderClass}`}>
                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>

                    {ret.status === 'submitted' && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowApprove(true)}
                                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white active:opacity-90"
                            >
                                Setujui
                            </button>
                            <button
                                onClick={() => setShowReject(true)}
                                className="flex-1 rounded-xl border border-red-200 bg-white py-3 text-sm font-bold text-red-600 active:bg-red-50"
                            >
                                Tolak
                            </button>
                        </div>
                    )}

                    {ret.status === 'approved' && (
                        <button
                            onClick={handleMarkReceived}
                            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white active:opacity-90"
                        >
                            Barang Diterima di Pusat
                        </button>
                    )}

                    {ret.status === 'received_at_center' && (
                        <button
                            onClick={handleComplete}
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:opacity-90"
                        >
                            Selesai & Sesuaikan Settlement
                        </button>
                    )}
                </div>
            </div>

            {/* Approve Modal */}
            {showApprove && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Setujui Return</h3>
                        <textarea
                            value={approveForm.data.notes}
                            onChange={(e) => approveForm.setData('notes', e.target.value)}
                            placeholder="Catatan (opsional)"
                            className="mt-4 w-full rounded-xl border border-border p-3 text-sm"
                            rows={3}
                        />
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowApprove(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium">
                                Batal
                            </button>
                            <button onClick={handleApprove} disabled={approveForm.processing} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white">
                                {approveForm.processing ? 'Memproses...' : 'Setujui'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showReject && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Tolak Return</h3>
                        <textarea
                            value={rejectForm.data.reason}
                            onChange={(e) => rejectForm.setData('reason', e.target.value)}
                            placeholder="Alasan penolakan"
                            className="mt-4 w-full rounded-xl border border-border p-3 text-sm"
                            rows={3}
                        />
                        {rejectForm.errors.reason && <div className="mt-1 text-xs text-red-600">{rejectForm.errors.reason}</div>}
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowReject(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium">
                                Batal
                            </button>
                            <button onClick={handleReject} disabled={rejectForm.processing} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white">
                                {rejectForm.processing ? 'Memproses...' : 'Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </OwnerPageShell>
    );
}
