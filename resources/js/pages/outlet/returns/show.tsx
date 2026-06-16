import { Head, Link } from '@inertiajs/react';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReturnStatus } from '@/lib/status-labels';

export default function OutletReturnsShow({ return: ret }: any) {
    const status = getReturnStatus(ret.status);

    return (
        <OutletLayout title={`Return #${ret.id}`} subtitle={status.label} backHref="/outlet/returns">
            <Head title={`Return #${ret.id}`} />

            <div className="pb-24">
                <div className="rounded-xl border border-zinc-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-bold text-slate-900">Return #{ret.id}</div>
                            <div className="mt-1 text-xs text-zinc-500">{formatDate(ret.created_at)}</div>
                        </div>
                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>
                </div>

                <SectionCard label="Informasi" className="mt-4">
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Alasan</dt>
                            <dd className="font-medium text-slate-900">{ret.reason_label ?? ret.reason}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Total Nilai</dt>
                            <dd className="font-bold text-emerald-700">{formatCurrency(ret.total_value)}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Tanggal</dt>
                            <dd className="text-slate-900">{formatDate(ret.created_at)}</dd>
                        </div>
                        {ret.notes && (
                            <div className="flex justify-between">
                                <dt className="text-zinc-500">Catatan</dt>
                                <dd className="text-slate-900">{ret.notes}</dd>
                            </div>
                        )}
                        {ret.review_notes && (
                            <div className="flex justify-between">
                                <dt className="text-zinc-500">Catatan Owner</dt>
                                <dd className="text-slate-900">{ret.review_notes}</dd>
                            </div>
                        )}
                    </dl>
                </SectionCard>

                <SectionCard label="Item" className="mt-4">
                    <div className="space-y-3">
                        {ret.items?.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-100 p-3">
                                <div>
                                    <div className="text-sm font-medium text-slate-900">{item.variant?.full_name ?? item.variant?.name}</div>
                                    <div className="text-xs text-zinc-500">{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                </div>
                                <div className="text-sm font-bold text-slate-900">{formatCurrency(item.subtotal)}</div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                {/* Status History */}
                {ret.status_histories?.length > 0 && (
                    <SectionCard label="Riwayat" className="mt-4">
                        <div className="space-y-3">
                            {ret.status_histories.map((h: any, i: number) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                                    <div>
                                        <div className="text-sm font-medium text-slate-900">{getReturnStatus(h.to_status).label}</div>
                                        <div className="text-xs text-zinc-500">{h.actor?.name} &middot; {formatDate(h.created_at)}</div>
                                        {h.notes && <div className="mt-0.5 text-xs text-zinc-600">{h.notes}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}

                {/* Link to exchange */}
                {ret.exchange_request && (
                    <Link
                        href={`/outlet/exchanges/${ret.exchange_request.id}`}
                        className="mt-4 block rounded-xl border border-emerald-200 bg-emerald-50 p-4 active:bg-emerald-100"
                    >
                        <div className="text-sm font-semibold text-emerald-800">Lihat Exchange Request</div>
                        <div className="text-xs text-emerald-600">#{ret.exchange_request.id}</div>
                    </Link>
                )}
            </div>
        </OutletLayout>
    );
}
