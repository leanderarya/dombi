import { Link, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StatusBadge from '@/components/ui/status-badge';
import SectionCard from '@/components/ui/section-card';
import { getReturnStatus } from '@/lib/status-labels';
import { formatCurrency, formatDate } from '@/lib/format';

export default function OwnerReturnsShow({ return: ret }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);

    const approveForm = useForm({ notes: '' });
    const rejectForm = useForm({ reason: '' });

    const status = getReturnStatus(ret.status);

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
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>
                </div>

                {/* Info */}
                <SectionCard label="Informasi Return">
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Alasan</dt>
                            <dd className="font-medium text-slate-900">{ret.reason_label ?? ret.reason}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Diajukan</dt>
                            <dd className="text-slate-900">{formatDate(ret.created_at)}</dd>
                        </div>
                        {ret.notes && (
                            <div className="flex justify-between">
                                <dt className="text-zinc-500">Catatan</dt>
                                <dd className="text-slate-900">{ret.notes}</dd>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Total Nilai</dt>
                            <dd className="font-bold text-emerald-700">{formatCurrency(ret.total_value)}</dd>
                        </div>
                    </dl>
                </SectionCard>

                {/* Items */}
                <SectionCard label="Item Return">
                    <div className="space-y-3">
                        {ret.items?.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">
                                        {item.variant?.full_name ?? item.variant?.name}
                                    </div>
                                    <div className="text-xs text-zinc-500">{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                </div>
                                <div className="text-sm font-bold text-slate-900">{formatCurrency(item.subtotal)}</div>
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
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">
                                            {getReturnStatus(h.to_status).label}
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {h.actor?.name} &middot; {formatDate(h.created_at)}
                                        </div>
                                        {h.notes && <div className="mt-0.5 text-xs text-zinc-600">{h.notes}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    {ret.status === 'submitted' && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowApprove(true)}
                                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700"
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
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700"
                        >
                            Barang Diterima di Pusat
                        </button>
                    )}

                    {ret.status === 'received_at_center' && (
                        <button
                            onClick={handleComplete}
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700"
                        >
                            Selesai & Sesuaikan Settlement
                        </button>
                    )}
                </div>
            </div>

            {/* Approve Modal */}
            {showApprove && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-slate-900">Setujui Return</h3>
                        <textarea
                            value={approveForm.data.notes}
                            onChange={(e) => approveForm.setData('notes', e.target.value)}
                            placeholder="Catatan (opsional)"
                            className="mt-4 w-full rounded-xl border border-zinc-200 p-3 text-sm"
                            rows={3}
                        />
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowApprove(false)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium">
                                Batal
                            </button>
                            <button onClick={handleApprove} disabled={approveForm.processing} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white">
                                {approveForm.processing ? 'Memproses...' : 'Setujui'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showReject && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-slate-900">Tolak Return</h3>
                        <textarea
                            value={rejectForm.data.reason}
                            onChange={(e) => rejectForm.setData('reason', e.target.value)}
                            placeholder="Alasan penolakan"
                            className="mt-4 w-full rounded-xl border border-zinc-200 p-3 text-sm"
                            rows={3}
                        />
                        {rejectForm.errors.reason && <div className="mt-1 text-xs text-red-600">{rejectForm.errors.reason}</div>}
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowReject(false)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium">
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
