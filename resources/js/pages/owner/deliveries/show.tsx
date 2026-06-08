import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import OrderStatusBadge from '@/components/order-status-badge';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import OwnerLayout from '@/layouts/owner-layout';
import { formatDate } from '@/lib/format';

export default function OwnerDeliveryShow({ delivery }: any) {
    const order = delivery.order;
    const canResolve = ['failed', 'retry_delivery', 'returned_to_outlet'].includes(delivery.status);
    const [resolveOpen, setResolveOpen] = useState(false);

    return (
        <OwnerLayout>
            <Head title={order.order_code} />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{order.order_code}</h1>
                    <p className="mt-1 text-sm text-zinc-500">Kurir: {delivery.courier?.name ?? '-'}</p>
                </div>
                <div className="flex gap-2"><OrderStatusBadge status={order.status} /><DeliveryStatusBadge status={delivery.status} /></div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                    <section className="rounded-lg border bg-white p-5">
                        <h2 className="font-semibold">Item</h2>
                        <div className="mt-3 space-y-3">
                            {order.items.map((item: any) => (
                                <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                    <div><div className="font-medium">{item.product_name}</div><div className="text-zinc-500">Jml {item.quantity}</div></div>
                                    <div className="font-medium">Rp {Number(item.subtotal).toLocaleString('id-ID')}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {canResolve && (
                        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                            <h2 className="font-semibold text-amber-900">Insiden Belum Diselesaikan</h2>
                            <p className="mt-1 text-sm text-amber-700">Delivery ini gagal dan membutuhkan tindakan operasional.</p>
                            <button onClick={() => setResolveOpen(true)} className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-md bg-amber-600 text-sm font-semibold text-white active:bg-amber-700">
                                Selesaikan Insiden →
                            </button>
                        </section>
                    )}
                </div>

                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Info Pengiriman</h2>
                        <div className="mt-3">Outlet: {order.outlet?.name ?? '-'}</div>
                        <div>Pelanggan: {order.customer_name}</div>
                        <div className="text-zinc-600">{order.customer_address}</div>
                        <div className="mt-3">Pengambilan: {formatDate(delivery.pickup_time)}</div>
                        <div>Terkirim: {formatDate(delivery.delivered_time)}</div>
                        {delivery.failed_reason && <div className="mt-3 rounded-md bg-red-50 p-3 text-red-700"><strong>Alasan gagal:</strong> {delivery.failed_reason}</div>}
                        {delivery.resolution_status && (
                            <div className="mt-3 rounded-md bg-amber-50 p-3 text-amber-800">
                                <strong>Resolusi:</strong> {delivery.resolution_status.replaceAll('_', ' ')}
                                {delivery.resolution_notes && <div className="mt-1 text-xs">{delivery.resolution_notes}</div>}
                                {delivery.resolved_by && <div className="mt-1 text-xs text-amber-600">oleh {delivery.resolved_by.name} - {formatDate(delivery.resolved_at)}</div>}
                            </div>
                        )}
                    </section>
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Linimasa</h2>
                        <div className="mt-3 space-y-3">
                            {order.status_histories.map((history: any) => (
                                <div key={history.id} className="border-l-2 border-emerald-200 pl-3">
                                    <div className="font-medium">{history.to_status.replaceAll('_', ' ')}</div>
                                    <div className="text-zinc-500">{history.notes}</div>
                                    <div className="text-xs text-zinc-400">{formatDate(history.created_at)} {history.actor ? `oleh ${history.actor.name}` : ''}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
            <ResolveDeliverySheet delivery={delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />
        </OwnerLayout>
    );
}
