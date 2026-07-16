import { Head, Link, router } from '@inertiajs/react';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDate } from '@/lib/format';
import { getExchangeStatus, getReturnStatus } from '@/lib/status-labels';

export default function OutletExchangesShow({ exchange }: any) {
    const status = getExchangeStatus(exchange.status);

    const handleConfirmReceived = () => {
        router.post(`/outlet/exchanges/${exchange.id}/confirm-received`);
    };

    return (
        <OutletLayout
            title={`Tukar Produk #${exchange.id}`}
            subtitle={status.label}
            backHref="/outlet/exchanges"
        >
            <Head title={`Tukar Produk #${exchange.id}`} />

            <div className="mt-4 pb-24">
                <div className="rounded-xl border border-border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-bold text-text">
                                Tukar Produk #{exchange.id}
                            </div>
                            <div className="mt-1 text-xs text-text-muted">
                                {formatDate(exchange.created_at)}
                            </div>
                        </div>
                        <StatusBadge status={exchange.status} />
                    </div>
                </div>

                {/* Linked Return */}
                {exchange.return_request && (
                    <SectionCard label="Return Terkait">
                        <Link
                            href={`/outlet/returns/${exchange.return_request.id}`}
                            className="block rounded-lg border border-border p-3 active:bg-surface-muted"
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-text">
                                    Return #{exchange.return_request.id}
                                </div>
                                <StatusBadge
                                    status={exchange.return_request.status}
                                />
                            </div>
                        </Link>
                    </SectionCard>
                )}

                {/* Exchange Items */}
                <SectionCard label="Produk Pengganti">
                    <div className="space-y-3">
                        {exchange.items?.map((item: any) => (
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
                    <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
                        <span className="text-text-muted">Nilai Tukar</span>
                        <span className="font-bold text-text">
                            {formatCurrency(exchange.exchange_value)}
                        </span>
                    </div>
                </SectionCard>

                {exchange.notes && (
                    <SectionCard label="Catatan">
                        <p className="text-sm text-text-muted">
                            {exchange.notes}
                        </p>
                    </SectionCard>
                )}

                {/* Status History */}
                {exchange.status_histories?.length > 0 && (
                    <SectionCard label="Riwayat">
                        <div className="space-y-3">
                            {exchange.status_histories.map(
                                (h: any, i: number) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3"
                                    >
                                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-text-subtle" />
                                        <div>
                                            <div className="text-sm font-medium text-text">
                                                {
                                                    getExchangeStatus(
                                                        h.to_status,
                                                    ).label
                                                }
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
                                ),
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* Actions */}
                {exchange.status === 'shipped' && (
                    <div className="mt-6">
                        <button
                            onClick={handleConfirmReceived}
                            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white active:opacity-80"
                        >
                            Konfirmasi Barang Diterima
                        </button>
                    </div>
                )}
            </div>
        </OutletLayout>
    );
}
