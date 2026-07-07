import { useForm, router } from '@inertiajs/react';
import { CheckCircle2, Clock, Package, XCircle } from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
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
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Info */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Informasi Return</div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Alasan</span>
                        <span className="text-text">{ret.reason_label ?? ret.reason}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Diajukan</span>
                        <span className="text-text">{formatDate(ret.created_at)}</span>
                    </div>
                    {ret.notes && (
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">Catatan</span>
                            <span className="text-text">{ret.notes}</span>
                        </div>
                    )}
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Total Nilai</span>
                        <span className="font-bold text-primary">{formatCurrency(ret.total_value)}</span>
                    </div>
                </div>

                {/* Status + Actions */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Status</div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Status</span>
                        <div className="flex items-center gap-1.5">
                            <StatusIcon className="h-3.5 w-3.5 text-text-muted" />
                            <StatusBadge variant={status.variant} size="sm">{status.label}</StatusBadge>
                        </div>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Total</span>
                        <span className="font-bold text-primary">{formatCurrency(ret.total_value)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Item</span>
                        <span className="text-text">{ret.items?.length ?? 0} item</span>
                    </div>

                    {/* Actions */}
                    {ret.status === 'submitted' && (
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={() => setShowApprove(true)}
                                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all active:opacity-90"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Setujui
                            </button>
                            <button
                                onClick={() => setShowReject(true)}
                                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition-all hover:bg-red-50 active:bg-red-100"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                                Tolak
                            </button>
                        </div>
                    )}

                    {ret.status === 'approved' && (
                        <button
                            onClick={handleMarkReceived}
                            className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all active:opacity-90"
                        >
                            <Package className="h-3.5 w-3.5" />
                            Barang Diterima di Pusat
                        </button>
                    )}

                    {ret.status === 'received_at_center' && (
                        <button
                            onClick={handleComplete}
                            className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-all active:opacity-90"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Selesai & Sesuaikan Settlement
                        </button>
                    )}

                    {ret.status === 'completed' && (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                            <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
                            <div className="mt-1 text-xs font-semibold text-emerald-800">Return Selesai</div>
                        </div>
                    )}
                </div>

                {/* Items */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Item Return</div>
                    {ret.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">{item.variant?.full_name ?? item.variant?.name} x{item.quantity}</span>
                            <span className="font-bold text-text">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                </div>

                {/* Status History */}
                {ret.status_histories?.length > 0 && (
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Riwayat Status</div>
                        <div className="space-y-2">
                            {ret.status_histories.map((h: any, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                    <div>
                                        <div className="text-xs font-medium text-text">
                                            {getReturnStatus(h.to_status).label}
                                        </div>
                                        <div className="text-[11px] text-text-muted">
                                            {h.actor?.name} &middot; {formatDate(h.created_at)}
                                        </div>
                                        {h.notes && <div className="mt-0.5 text-[11px] text-text-muted">{h.notes}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Approve Modal */}
            {showApprove && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Setujui Return</h3>
                        <textarea
                            value={approveForm.data.notes}
                            onChange={(e) => approveForm.setData('notes', e.target.value)}
                            placeholder="Catatan (opsional)"
                            className="mt-4 w-full rounded-lg border border-border p-3 text-sm"
                            rows={3}
                        />
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowApprove(false)} className="flex-1 rounded-lg border border-border py-3 text-sm font-medium">
                                Batal
                            </button>
                            <button onClick={handleApprove} disabled={approveForm.processing} className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-white">
                                {approveForm.processing ? 'Memproses...' : 'Setujui'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showReject && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Tolak Return</h3>
                        <textarea
                            value={rejectForm.data.reason}
                            onChange={(e) => rejectForm.setData('reason', e.target.value)}
                            placeholder="Alasan penolakan"
                            className="mt-4 w-full rounded-lg border border-border p-3 text-sm"
                            rows={3}
                        />
                        {rejectForm.errors.reason && <div className="mt-1 text-xs text-red-600">{rejectForm.errors.reason}</div>}
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowReject(false)} className="flex-1 rounded-lg border border-border py-3 text-sm font-medium">
                                Batal
                            </button>
                            <button onClick={handleReject} disabled={rejectForm.processing} className="flex-1 rounded-lg bg-red-600 py-3 text-sm font-bold text-white">
                                {rejectForm.processing ? 'Memproses...' : 'Tolak'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </OwnerPageShell>
    );
}
