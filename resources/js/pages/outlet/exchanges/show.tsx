import { Head, Link, router } from '@inertiajs/react';
import OutletLayout from '@/layouts/outlet-layout';
import StatusBadge from '@/components/ui/status-badge';
import SectionCard from '@/components/ui/section-card';
import { getExchangeStatus, getReturnStatus } from '@/lib/status-labels';
import { formatCurrency, formatDate } from '@/lib/format';

export default function OutletExchangesShow({ exchange }: any) {
    const status = getExchangeStatus(exchange.status);

    const handleConfirmReceived = () => {
        router.post(`/outlet/exchanges/${exchange.id}/confirm-received`);
    };

    return (
        <OutletLayout title={`Exchange #${exchange.id}`} subtitle={status.label} backHref="/outlet/exchanges">
            <Head title={`Exchange #${exchange.id}`} />

            <div className="pb-24">
                <div className="rounded-xl border border-zinc-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-bold text-slate-900">Exchange #{exchange.id}</div>
                            <div className="mt-1 text-xs text-zinc-500">{formatDate(exchange.created_at)}</div>
                        </div>
                        <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>
                </div>

                {/* Linked Return */}
                {exchange.return_request && (
                    <SectionCard label="Return Terkait" className="mt-4">
                        <Link href={`/outlet/returns/${exchange.return_request.id}`} className="block rounded-lg border border-zinc-100 p-3 active:bg-zinc-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-900">Return #{exchange.return_request.id}</div>
                                <StatusBadge variant={getReturnStatus(exchange.return_request.status).variant}>{getReturnStatus(exchange.return_request.status).label}</StatusBadge>
                            </div>
                        </Link>
                    </SectionCard>
                )}

                {/* Exchange Items */}
                <SectionCard label="Produk Pengganti" className="mt-4">
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

                {exchange.notes && (
                    <SectionCard label="Catatan" className="mt-4">
                        <p className="text-sm text-zinc-600">{exchange.notes}</p>
                    </SectionCard>
                )}

                {/* Status History */}
                {exchange.status_histories?.length > 0 && (
                    <SectionCard label="Riwayat" className="mt-4">
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
                {exchange.status === 'shipped' && (
                    <div className="mt-6">
                        <button
                            onClick={handleConfirmReceived}
                            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white active:bg-emerald-700"
                        >
                            Konfirmasi Barang Diterima
                        </button>
                    </div>
                )}
            </div>
        </OutletLayout>
    );
}
