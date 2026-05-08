import { Head, router } from '@inertiajs/react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import OrderStatusBadge from '../../../components/order-status-badge';
import CustomerLayout from '../../../layouts/customer-layout';

export default function OrderShow({ order }: any) {
    return (
        <CustomerLayout>
            <Head title={order.order_code} />
            <div className="rounded-lg border bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold">{order.order_code}</h1>
                        <div className="mt-1 text-sm text-zinc-500">Outlet: {order.outlet?.name ?? '-'}</div>
                    </div>
                    <OrderStatusBadge status={order.status} />
                </div>
                <div className="mt-5 border-t pt-4 text-sm">
                    <div className="font-medium">{order.customer_name}</div>
                    <div>{order.customer_phone}</div>
                    <div className="text-zinc-600">{order.customer_address}</div>
                </div>
                <div className="mt-5 space-y-3">
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                            <div>
                                <div className="font-medium">{item.product_name}</div>
                                <div className="text-zinc-500">Qty {item.quantity} x Rp {Number(item.price).toLocaleString('id-ID')}</div>
                            </div>
                            <div className="font-medium">Rp {Number(item.subtotal).toLocaleString('id-ID')}</div>
                        </div>
                    ))}
                </div>
                <div className="mt-5 border-t pt-4 text-right">
                    <div className="text-sm text-zinc-500">Total</div>
                    <div className="text-2xl font-semibold">Rp {Number(order.total).toLocaleString('id-ID')}</div>
                </div>
                <section className="mt-5 border-t pt-4 text-sm">
                    <h2 className="font-semibold">Delivery</h2>
                    {order.delivery ? (
                        <div className="mt-3 rounded-md bg-zinc-50 p-3">
                            <DeliveryStatusBadge status={order.delivery.status} />
                            <div className="mt-2">Courier: {order.delivery.courier?.name ?? '-'}</div>
                            <div>Pickup: {order.delivery.pickup_time ? new Date(order.delivery.pickup_time).toLocaleString('id-ID') : '-'}</div>
                            <div>Delivered: {order.delivery.delivered_time ? new Date(order.delivery.delivered_time).toLocaleString('id-ID') : '-'}</div>
                            {order.delivery.failed_reason && <div className="mt-2 text-red-700">{order.delivery.failed_reason}</div>}
                        </div>
                    ) : (
                        <div className="mt-3 text-zinc-500">Delivery belum di-assign.</div>
                    )}
                </section>
                <section className="mt-5 border-t pt-4 text-sm">
                    <h2 className="font-semibold">Timeline Status</h2>
                    <div className="mt-3 space-y-3">
                        {order.status_histories.map((history: any) => (
                            <div key={history.id} className="border-l-2 border-emerald-200 pl-3">
                                <div className="font-medium">{history.to_status.replaceAll('_', ' ')}</div>
                                <div className="text-zinc-500">{history.notes}</div>
                                <div className="text-xs text-zinc-400">{new Date(history.created_at).toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                </section>
                <button onClick={() => router.post(`/customer/orders/${order.id}/repeat`)} className="mt-5 w-full rounded-md border px-4 py-2">Order ulang</button>
            </div>
        </CustomerLayout>
    );
}
