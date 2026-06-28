import { Link, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import SectionCard from '@/components/ui/section-card';
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
            <div className="space-y-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:space-y-0">
                {/* Left: Main Content */}
                <div className="space-y-4">
                    {/* Linked Return */}
                    {exchange.return_request && (
                        <SectionCard label="Return Terkait">
                            <Link href={`/owner/returns/${exchange.return_request.id}`} className="block rounded-lg border border-border p-3 active:bg-zinc-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-text">Return #{exchange.return_request.id}</div>
                                        <div className="text-xs text-text-muted">{exchange.return_request.items?.length ?? 0} item</div>
                                    </div>
                                    <StatusBadge variant={getReturnStatus(exchange.return_request.status).variant}>{getReturnStatus(exchange.return_request.status).label}</StatusBadge>
                                </div>
                            </Link>
                        </SectionCard>
                    )}

                    {/* Exchange Items */}
                    <SectionCard label="Item Pengganti">
                        <div className="space-y-3">
                            {exchange.items?.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                                    <div>
                                        <div className="text-sm font-medium text-text">{item.variant?.full_name ?? item.variant?.name}</div>
                                        <div className="text-xs text-text-muted">{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                    </div>
                                    <div className="text-sm font-bold text-text">{formatCurrency(item.subtotal)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
                            <span className="text-text-muted">Nilai Tukar</span>
                            <span className="font-bold text-primary">{formatCurrency(exchange.exchange_value)}</span>
                        </div>
                    </SectionCard>

                    {/* Notes */}
                    {exchange.notes && (
                        <SectionCard label="Catatan">
                            <p className="text-sm text-text-muted">{exchange.notes}</p>
                        </SectionCard>
                    )}

                    {/* Status History */}
                    {exchange.status_histories?.length > 0 && (
                        <SectionCard label="Riwayat Status">
                            <div className="space-y-3">
                                {exchange.status_histories.map((h: any, i: number) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                        <div>
                                            <div className="text-sm font-medium text-text">{getExchangeStatus(h.to_status).label}</div>
                                            <div className="text-xs text-text-muted">{h.actor?.name} &middot; {formatDate(h.created_at)}</div>
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
                        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <StatusIcon className="h-5 w-5 text-text-muted" />
                                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Status</span>
                            </div>
                            <div className="mt-2">
                                <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                            </div>
                            <div className="mt-3 text-2xl font-bold text-primary">{formatCurrency(exchange.exchange_value)}</div>
                            <div className="mt-1 text-xs text-text-muted">{exchange.items?.length ?? 0} item &middot; {formatDate(exchange.created_at)}</div>
                        </div>

                        {/* Actions */}
                        {exchange.status === 'submitted' && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => setShowApprove(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:opacity-90"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Setujui Tukar Produk
                                </button>
                                <button
                                    onClick={() => setShowReject(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3.5 text-sm font-bold text-red-600 transition-all hover:bg-red-50 hover:shadow-sm active:bg-red-100"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Tolak Tukar Produk
                                </button>
                            </div>
                        )}

                        {(exchange.status === 'approved' || exchange.status === 'preparing') && (
                            <button
                                onClick={() => router.post(`/owner/exchanges/${exchange.id}/mark-shipped`)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:opacity-90"
                            >
                                <Truck className="h-4 w-4" />
                                Tandai Dikirim
                            </button>
                        )}

                        {exchange.status === 'received' && (
                            <button
                                onClick={() => setShowComplete(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:opacity-90"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Selesaikan Tukar Produk
                            </button>
                        )}

                        {exchange.status === 'completed' && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                                <div className="mt-2 text-sm font-semibold text-emerald-800">Tukar Produk Selesai</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Actions */}
                <div className="space-y-3 lg:hidden">
                    <div className="rounded-xl border border-border bg-white p-4">
                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>

                    {exchange.status === 'submitted' && (
                        <div className="flex gap-3">
                            <button onClick={() => setShowApprove(true)} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white active:bg-primary-dark">
                                Setujui
                            </button>
                            <button onClick={() => setShowReject(true)} className="flex-1 rounded-xl border border-red-200 bg-white py-3 text-sm font-bold text-red-600 active:bg-red-50">
                                Tolak
                            </button>
                        </div>
                    )}

                    {(exchange.status === 'approved' || exchange.status === 'preparing') && (
                        <button
                            onClick={() => router.post(`/owner/exchanges/${exchange.id}/mark-shipped`)}
                            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white active:bg-primary-dark"
                        >
                            Tandai Dikirim
                        </button>
                    )}

                    {exchange.status === 'received' && (
                        <button
                            onClick={() => setShowComplete(true)}
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:opacity-90"
                        >
                            Selesaikan Tukar Produk
                        </button>
                    )}
                </div>
            </div>

            {showApprove && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Setujui Tukar Produk</h3>
                        <textarea value={approveForm.data.notes} onChange={(e) => approveForm.setData('notes', e.target.value)} placeholder="Catatan (opsional)" className="mt-4 w-full rounded-xl border border-border p-3 text-sm" rows={3} />
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowApprove(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium">Batal</button>
                            <button onClick={handleApprove} disabled={approveForm.processing} className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white">{approveForm.processing ? 'Memproses...' : 'Setujui'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showReject && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Tolak Tukar Produk</h3>
                        <textarea value={rejectForm.data.reason} onChange={(e) => rejectForm.setData('reason', e.target.value)} placeholder="Alasan penolakan" className="mt-4 w-full rounded-xl border border-border p-3 text-sm" rows={3} />
                        {rejectForm.errors.reason && <div className="mt-1 text-xs text-red-600">{rejectForm.errors.reason}</div>}
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowReject(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium">Batal</button>
                            <button onClick={handleReject} disabled={rejectForm.processing} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white">{rejectForm.processing ? 'Memproses...' : 'Tolak'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showComplete && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 lg:items-center">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-text">Selesaikan Tukar Produk</h3>
                        <p className="mt-2 text-sm text-text-muted">
                            Tandai exchange ini selesai setelah outlet mengonfirmasi produk pengganti diterima.
                        </p>
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowComplete(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium">Batal</button>
                            <button
                                onClick={() => router.post(`/owner/exchanges/${exchange.id}/complete`, {}, { onSuccess: () => setShowComplete(false) })}
                                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </OwnerPageShell>
    );
}
