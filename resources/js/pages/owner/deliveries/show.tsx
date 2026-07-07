import { MapPin } from 'lucide-react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import OrderStatusBadge from '@/components/ui/order-status-badge';
import { formatDate } from '@/lib/format';

export default function OwnerDeliveryShow({ delivery }: any) {
    const order = delivery.order;
    const canResolve = ['failed', 'retry_delivery', 'returned_to_outlet'].includes(delivery.status);
    const isActive = ['delivering', 'picked_up'].includes(delivery.status);
    const [resolveOpen, setResolveOpen] = useState(false);

    return (
        <OwnerPageShell
            title={`Pengiriman #${delivery.id}`}
            subtitle={order.order_code}
            backHref="/owner/deliveries"
        >
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Status */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-sm font-bold uppercase tracking-wide text-text-subtle">Status</div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Pesanan</span>
                        <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Pengiriman</span>
                        <DeliveryStatusBadge status={delivery.status} />
                    </div>
                    {isActive && (
                        <div className="mt-3 flex h-8 items-center justify-center gap-2 rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700">
                            <MapPin className="h-3.5 w-3.5" />
                            Sedang Dalam Pengiriman
                        </div>
                    )}
                </div>

                {/* Delivery Info */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-sm font-bold uppercase tracking-wide text-text-subtle">Info Pengiriman</div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Outlet</span>
                        <span className="text-text">{order.outlet?.name ?? '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Pelanggan</span>
                        <span className="text-text">{order.customer_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Alamat</span>
                        <span className="text-right text-text">{order.customer_address}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Pengambilan</span>
                        <span className="text-text">{formatDate(delivery.pickup_time)}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Terkirim</span>
                        <span className="text-text">{formatDate(delivery.delivered_time)}</span>
                    </div>
                    {delivery.failed_reason && (
                        <div className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
                            <strong>Alasan gagal:</strong> {delivery.failed_reason}
                        </div>
                    )}
                    {delivery.resolution_status && (
                        <div className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">
                            <strong>Resolusi:</strong> {delivery.resolution_status.replaceAll('_', ' ')}
                            {delivery.resolution_notes && <div className="mt-1">{delivery.resolution_notes}</div>}
                            {delivery.resolved_by && (
                                <div className="mt-1 text-amber-600">
                                    oleh {delivery.resolved_by.name} - {formatDate(delivery.resolved_at)}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Courier */}
                {delivery.courier && (
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-sm font-bold uppercase tracking-wide text-text-subtle">Kurir</div>
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                            <span className="text-text-muted">Nama</span>
                            <span className="text-text">{delivery.courier.name}</span>
                        </div>
                    </div>
                )}

                {/* Items */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="mb-3 text-sm font-bold uppercase tracking-wide text-text-subtle">Item Pesanan</div>
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                            <span className="text-text-muted">{item.product_name} x{item.quantity}</span>
                            <span className="font-semibold tabular-nums text-text">Rp {Number(item.subtotal).toLocaleString('id-ID')}</span>
                        </div>
                    ))}
                </div>

                {/* Timeline */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
                    <div className="mb-3 text-sm font-bold uppercase tracking-wide text-text-subtle">Linimasa</div>
                    <div className="space-y-2">
                        {order.status_histories.map((history: any) => (
                            <div key={history.id} className="border-l-2 border-primary/20 pl-3">
                                <div className="text-sm font-medium text-text">{history.to_status.replaceAll('_', ' ')}</div>
                                {history.notes && <div className="text-sm text-text-muted">{history.notes}</div>}
                                <div className="text-sm text-text-subtle">
                                    {formatDate(history.created_at)} {history.actor ? `oleh ${history.actor.name}` : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Resolve */}
                {canResolve && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 lg:col-span-2">
                        <div className="mb-1 text-sm font-bold text-amber-900">Insiden Belum Diselesaikan</div>
                        <p className="text-sm text-amber-700">
                            Delivery ini gagal dan membutuhkan tindakan operasional.
                        </p>
                        <button
                            onClick={() => setResolveOpen(true)}
                            className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 text-sm font-semibold text-white transition-colors hover:bg-amber-700 active:bg-amber-800"
                        >
                            Selesaikan Insiden
                        </button>
                    </div>
                )}
            </div>

            <ResolveDeliverySheet delivery={delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />
        </OwnerPageShell>
    );
}
