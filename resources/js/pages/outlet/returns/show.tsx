import { Head, Link } from '@inertiajs/react';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';
import { getReturnStatus } from '@/lib/status-labels';
// StatusBadge status prop handles label/variant mapping

export default function OutletReturnsShow({ return: ret }: any) {
    const status = getReturnStatus(ret.status);

    return (
        <OutletLayout
            title={`Return #${ret.id}`}
            subtitle={status.label}
            backHref="/outlet/returns"
        >
            <Head title={`Return #${ret.id}`} />

            <div className="mt-4 pb-24">
                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-bold text-text">
                                Return #{ret.id}
                            </div>
                            <div className="mt-1 text-xs text-text-muted">
                                {formatDate(ret.created_at)}
                            </div>
                        </div>
                        <StatusBadge status={ret.status} />
                    </div>
                </div>

                <SectionCard label="Informasi">
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-text-muted">Alasan</dt>
                            <dd className="font-medium text-text">
                                {ret.reason_label ?? ret.reason}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-text-muted">Total Nilai</dt>
                            <dd className="font-bold text-text tabular-nums">
                                {formatCurrency(ret.total_value)}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-text-muted">Tanggal</dt>
                            <dd className="text-text">
                                {formatDate(ret.created_at)}
                            </dd>
                        </div>
                        {ret.notes && (
                            <div className="flex justify-between">
                                <dt className="text-text-muted">Catatan</dt>
                                <dd className="text-text">{ret.notes}</dd>
                            </div>
                        )}
                        {ret.review_notes && (
                            <div className="flex justify-between">
                                <dt className="text-text-muted">
                                    Catatan Owner
                                </dt>
                                <dd className="text-text">
                                    {ret.review_notes}
                                </dd>
                            </div>
                        )}
                    </dl>
                </SectionCard>

                <SectionCard label="Item">
                    <div className="space-y-3">
                        {ret.items?.map((item: any) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between rounded-lg border border-border p-3"
                            >
                                <div>
                                    <div className="text-sm font-medium text-text">
                                        {item.variant?.full_name ??
                                            item.variant?.name}
                                    </div>
                                    <div className="text-xs text-text-muted">
                                        {item.quantity} x{' '}
                                        {formatCurrency(item.unit_price)}
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-text">
                                    {formatCurrency(item.subtotal)}
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                {/* Status History */}
                {ret.status_histories?.length > 0 && (
                    <SectionCard label="Riwayat">
                        <div className="space-y-3">
                            {ret.status_histories.map((h: any, i: number) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-text-subtle" />
                                    <div>
                                        <div className="text-sm font-medium text-text">
                                            {getReturnStatus(h.to_status).label}
                                        </div>
                                        <div className="text-xs text-text-muted">
                                            {h.actor?.name} &middot;{' '}
                                            {formatDate(h.created_at)}
                                        </div>
                                        {h.notes && (
                                            <div className="mt-0.5 text-xs text-text-muted">
                                                {h.notes}
                                            </div>
                                        )}
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
                        className="mt-4 block rounded-xl border border-border bg-white p-4 active:opacity-80"
                    >
                        <div className="text-sm font-semibold text-text">
                            Lihat Tukar Produk
                        </div>
                        <div className="text-xs text-text-muted">
                            #{ret.exchange_request.id}
                        </div>
                    </Link>
                )}
            </div>
        </OutletLayout>
    );
}
