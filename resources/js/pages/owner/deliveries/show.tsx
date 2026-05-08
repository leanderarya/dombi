import { Head } from '@inertiajs/react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import OrderStatusBadge from '../../../components/order-status-badge';
import OwnerLayout from '../../../layouts/owner-layout';

export default function OwnerDeliveryShow({ delivery }: any) {
    const order = delivery.order;

    return (
        <OwnerLayout>
            <Head title={order.order_code} />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{order.order_code}</h1>
                    <p className="mt-1 text-sm text-zinc-500">Courier: {delivery.courier?.name ?? '-'}</p>
                </div>
                <div className="flex gap-2"><OrderStatusBadge status={order.status} /><DeliveryStatusBadge status={delivery.status} /></div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Items</h2>
                    <div className="mt-3 space-y-3">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                <div><div className="font-medium">{item.product_name}</div><div className="text-zinc-500">Qty {item.quantity}</div></div>
                                <div className="font-medium">Rp {Number(item.subtotal).toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                </section>
                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Delivery Info</h2>
                        <div className="mt-3">Outlet: {order.outlet?.name ?? '-'}</div>
                        <div>Customer: {order.customer_name}</div>
                        <div className="text-zinc-600">{order.customer_address}</div>
                        <div className="mt-3">Pickup: {delivery.pickup_time ? new Date(delivery.pickup_time).toLocaleString('id-ID') : '-'}</div>
                        <div>Delivered: {delivery.delivered_time ? new Date(delivery.delivered_time).toLocaleString('id-ID') : '-'}</div>
                        {delivery.failed_reason && <div className="mt-3 rounded-md bg-red-50 p-3 text-red-700">{delivery.failed_reason}</div>}
                    </section>
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Timeline</h2>
                        <div className="mt-3 space-y-3">
                            {order.status_histories.map((history: any) => (
                                <div key={history.id} className="border-l-2 border-emerald-200 pl-3">
                                    <div className="font-medium">{history.to_status.replaceAll('_', ' ')}</div>
                                    <div className="text-zinc-500">{history.notes}</div>
                                    <div className="text-xs text-zinc-400">{new Date(history.created_at).toLocaleString('id-ID')} {history.actor ? `oleh ${history.actor.name}` : ''}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
        </OwnerLayout>
    );
}
