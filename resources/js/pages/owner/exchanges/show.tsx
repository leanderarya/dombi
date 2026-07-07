import { useForm, router } from '@inertiajs/react';
import { ArrowLeftRight, CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { getExchangeStatus, getReturnStatus } from '@/lib/status-labels';

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
    submitted: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
    preparing: Package,
    shipped: Truck,
    received: ArrowLeftRight,
    completed: CheckCircle2,
};

export default function OwnerExchangesShow({ exchange }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [showComplete, setShowComplete] = useState(false);

    const approveForm = useForm({ notes: '' });
    const rejectForm = useForm({ reason: '' });

    const status = getExchangeStatus(exchange.status);
    const StatusIcon = STATUS_ICONS[exchange.status] ?? Clock;

    const handleApprove = () => {
        approveForm.post(`/owner/exchanges/${exchange.id}/approve`, {
            onSuccess: () => {
                setShowApprove(false);
                approveForm.reset();
            },
        });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/exchanges/${exchange.id}/reject`, {
            onSuccess: () => {
                setShowReject(false);
                rejectForm.reset();
            },
        });
    };

    return (
        <OwnerPageShell title={`Exchange #${exchange.id}`} subtitle={exchange.outlet?.name} backHref="/owner/exchanges">
            <div className="grid gap-3 lg:grid-cols-2">
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
                        <span className="text-text-muted">Nilai Tukar</span>
                        <span className="font-bold text-primary">{formatCurrency(exchange.exchange_value)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Item</span>
                        <span className="text-text">{exchange.items?.length ?? 0} item</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                        <span className="text-text-muted">Tanggal</span>
                        <span className="text-text">{formatDate(exchange.created_at)}</span>
                    </div>

                    {/* Actions */}
                    {exchange.status === 'submitted' && (
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

                    {(exchange.status === 'approved' || exchange.status === 'preparing') && (
                        <button
                            onClick={() => router.post(`/owner/exchanges/${exchange.id}/mark-shipped`)}
                            className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white transition-all active:opacity-90"
                        >
                            <Truck className="h-3.5 w-3.5" />
                            Tandai Dikirim
                        </button>
                    )}

                    {exchange.status === 'received' && (
                        <button
                            onClick={() => setShowComplete(true)}
                            className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition-all active:opacity-90"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Selesaikan Tukar Produk
                        </button>
                    )}

                    {exchange.status === 'completed' && (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                            <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
                            <div className="mt-1 text-xs font-semibold text-emerald-800">Tukar Produk Selesai</div>
                        </div>
                    )}
                </div>

                {/* Linked Return */}
                {exchange.return_request && (
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Return Terkait</div>
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">Return</span>
                            <span className="text-text">#{exchange.return_request.id}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">Item</span>
                            <span className="text-text">{exchange.return_request.items?.length ?? 0} item</span>
                        </div>
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">Status</span>
                            <StatusBadge variant={getReturnStatus(exchange.return_request.status).variant} size="sm">
                                {getReturnStatus(exchange.return_request.status).label}
                            </StatusBadge>
                        </div>
                    </div>
                )}

                {/* Exchange Items */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Item Pengganti</div>
                    {exchange.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-xs last:border-b-0">
                            <span className="text-text-muted">{item.variant?.full_name ?? item.variant?.name} x{item.quantity}</span>
                            <span className="font-bold text-text">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs">
                        <span className="text-text-muted">Nilai Tukar</span>
                        <span className="font-bold text-primary">{formatCurrency(exchange.exchange_value)}</span>
                    </div>
                </div>

                {/* Notes */}
                {exchange.notes && (
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Catatan</div>
                        <p className="text-xs text-text-muted">{exchange.notes}</p>
                    </div>
                )}

                {/* Status History */}
                {exchange.status_histories?.length > 0 && (
                    <div className="rounded-lg border border-border p-4 lg:col-span-2">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-subtle">Riwayat Status</div>
                        <div className="space-y-2">
                            {exchange.status_histories.map((h: any, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                    <div>
                                        <div className="text-xs font-medium text-text">{getExchangeStatus(h.to_status).label}</div>
                                        <div className="text-[11px] text-text-muted">{h.actor?.name} &middot; {formatDate(h.created_at)}</div>
                                        {h.notes && <div className="mt-0.5 text-[11px] text-text-muted">{h.notes}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showApprove && createPortal(
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Setujui Tukar Produk</h3>
                        <textarea value={approveForm.data.notes} onChange={(e) => approveForm.setData('notes', e.target.value)} placeholder="Catatan (opsional)" className="mt-4 w-full rounded-lg border border-border p-3 text-sm" rows={3} />
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowApprove(false)} className="flex-1 rounded-lg border border-border py-3 text-sm font-medium">Batal</button>
                            <button onClick={handleApprove} disabled={approveForm.processing} className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-white">{approveForm.processing ? 'Memproses...' : 'Setujui'}</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {showReject && createPortal(
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Tolak Tukar Produk</h3>
                        <textarea value={rejectForm.data.reason} onChange={(e) => rejectForm.setData('reason', e.target.value)} placeholder="Alasan penolakan" className="mt-4 w-full rounded-lg border border-border p-3 text-sm" rows={3} />
                        {rejectForm.errors.reason && <div className="mt-1 text-xs text-red-600">{rejectForm.errors.reason}</div>}
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowReject(false)} className="flex-1 rounded-lg border border-border py-3 text-sm font-medium">Batal</button>
                            <button onClick={handleReject} disabled={rejectForm.processing} className="flex-1 rounded-lg bg-red-600 py-3 text-sm font-bold text-white">{rejectForm.processing ? 'Memproses...' : 'Tolak'}</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {showComplete && createPortal(
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Selesaikan Tukar Produk</h3>
                        <p className="mt-2 text-sm text-text-muted">
                            Tandai exchange ini selesai setelah outlet mengonfirmasi produk pengganti diterima.
                        </p>
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowComplete(false)} className="flex-1 rounded-lg border border-border py-3 text-sm font-medium">Batal</button>
                            <button
                                onClick={() => router.post(`/owner/exchanges/${exchange.id}/complete`, {}, { onSuccess: () => setShowComplete(false) })}
                                className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-white"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </OwnerPageShell>
    );
}
