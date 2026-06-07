import { Head, Link, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StatusBadge from '@/components/ui/status-badge';
import SectionCard from '@/components/ui/section-card';
import { getExchangeStatus, getReturnStatus } from '@/lib/status-labels';
import { formatCurrency, formatDate } from '@/lib/format';

export default function OwnerExchangesShow({ exchange }: any) {
    const [showApprove, setShowApprove] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const [showComplete, setShowComplete] = useState(false);

    const approveForm = useForm({ notes: '' });
    const rejectForm = useForm({ reason: '' });

    const status = getExchangeStatus(exchange.status);

    const handleApprove = () => {
        approveForm.post(`/owner/exchanges/${exchange.id}/approve`, {
            onSuccess: () => { setShowApprove(false); approveForm.reset(); },
        });
    };

    const handleReject = () => {
        rejectForm.post(`/owner/exchanges/${exchange.id}/reject`, {
            onSuccess: () => { setShowReject(false); rejectForm.reset(); },
        });
    };

    return (
        <OwnerPageShell title={`Exchange #${exchange.id}`}>
            <Head title={`Exchange #${exchange.id}`} />

            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <Link href="/owner/exchanges" className="text-xs text-zinc-500 hover:text-zinc-700">
                            &larr; Kembali
                        </Link>
                        <h1 className="mt-1 text-xl font-bold text-slate-900">Exchange #{exchange.id}</h1>
                        <div className="mt-0.5 text-sm text-zinc-500">{exchange.outlet?.name}</div>
                    </div>
                    <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                </div>

                {/* Linked Return */}
                {exchange.return_request && (
                    <SectionCard label="Return Terkait">
                        <Link href={`/owner/returns/${exchange.return_request.id}`} className="block rounded-lg border border-zinc-100 p-3 active:bg-zinc-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">Return #{exchange.return_request.id}</div>
                                    <div className="text-xs text-zinc-500">{exchange.return_request.items?.length ?? 0} item</div>
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
                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">{item.variant?.full_name ?? item.variant?.name}</div>
                                    <div className="text-xs text-zinc-500">{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                </div>
                                <div className="text-sm font-bold text-slate-900">{formatCurrency(item.subtotal)}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex justify-between border-t border-zinc-100 pt-3 text-sm">
                        <span className="text-zinc-500">Nilai Tukar</span>
                        <span className="font-bold text-emerald-700">{formatCurrency(exchange.exchange_value)}</span>
                    </div>
                </SectionCard>

                {/* Notes */}
                {exchange.notes && (
                    <SectionCard label="Catatan">
                        <p className="text-sm text-zinc-600">{exchange.notes}</p>
                    </SectionCard>
                )}

                {/* Status History */}
                {exchange.status_histories?.length > 0 && (
                    <SectionCard label="Riwayat Status">
                        <div className="space-y-3">
                            {exchange.status_histories.map((h: any, i: number) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">{getExchangeStatus(h.to_status).label}</div>
                                        <div className="text-xs text-zinc-500">{h.actor?.name} &middot; {formatDate(h.created_at)}</div>
                                        {h.notes && <div className="mt-0.5 text-xs text-zinc-600">{h.notes}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    {exchange.status === 'submitted' && (
                        <div className="flex gap-3">
                            <button onClick={() => setShowApprove(true)} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700">
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
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700"
                        >
                            Tandai Dikirim
                        </button>
                    )}

                    {exchange.status === 'received' && (
                        <button
                            onClick={() => setShowComplete(true)}
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700"
                        >
                            Complete Exchange
                        </button>
                    )}
                </div>
            </div>

            {showApprove && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-slate-900">Setujui Exchange</h3>
                        <textarea value={approveForm.data.notes} onChange={(e) => approveForm.setData('notes', e.target.value)} placeholder="Catatan (opsional)" className="mt-4 w-full rounded-xl border border-zinc-200 p-3 text-sm" rows={3} />
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowApprove(false)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium">Batal</button>
                            <button onClick={handleApprove} disabled={approveForm.processing} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white">{approveForm.processing ? 'Memproses...' : 'Setujui'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showReject && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-slate-900">Tolak Exchange</h3>
                        <textarea value={rejectForm.data.reason} onChange={(e) => rejectForm.setData('reason', e.target.value)} placeholder="Alasan penolakan" className="mt-4 w-full rounded-xl border border-zinc-200 p-3 text-sm" rows={3} />
                        {rejectForm.errors.reason && <div className="mt-1 text-xs text-red-600">{rejectForm.errors.reason}</div>}
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowReject(false)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium">Batal</button>
                            <button onClick={handleReject} disabled={rejectForm.processing} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white">{rejectForm.processing ? 'Memproses...' : 'Tolak'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showComplete && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6">
                        <h3 className="text-lg font-bold text-slate-900">Complete Exchange</h3>
                        <p className="mt-2 text-sm text-zinc-600">
                            Tandai exchange ini selesai setelah outlet mengonfirmasi produk pengganti diterima.
                        </p>
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setShowComplete(false)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-medium">Batal</button>
                            <button
                                onClick={() => router.post(`/owner/exchanges/${exchange.id}/complete`, {}, { onSuccess: () => setShowComplete(false) })}
                                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
                            >
                                Complete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </OwnerPageShell>
    );
}
