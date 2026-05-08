import { Head, useForm } from '@inertiajs/react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import OrderStatusBadge from '../../../components/order-status-badge';
import OwnerLayout from '../../../layouts/owner-layout';

export default function OwnerOrderShow({ order, reservedStocks, couriers }: any) {
    const form = useForm({ courier_id: couriers[0]?.id ?? '' });

    return (
        <OwnerLayout>
            <Head title={order.order_code} />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{order.order_code}</h1>
                    <div className="mt-1 text-sm text-zinc-500">Outlet: {order.outlet?.name ?? '-'}</div>
                </div>
                <OrderStatusBadge status={order.status} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Order Items</h2>
                    <div className="mt-3 space-y-3">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                <div><div className="font-medium">{item.product_name}</div><div className="text-zinc-500">Qty {item.quantity} x Rp {Number(item.price).toLocaleString('id-ID')}</div></div>
                                <div className="font-medium">Rp {Number(item.subtotal).toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 border-t pt-4 text-right">
                        <div className="text-sm text-zinc-500">Subtotal Rp {Number(order.subtotal).toLocaleString('id-ID')}</div>
                        <div className="text-xl font-semibold">Total Rp {Number(order.total).toLocaleString('id-ID')}</div>
                    </div>
                </section>
                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Customer</h2>
                        <div className="mt-3 font-medium">{order.customer_name}</div>
                        <div>{order.customer_phone}</div>
                        <div className="text-zinc-600">{order.customer_address}</div>
                        {order.notes && <div className="mt-3 rounded-md bg-zinc-50 p-3">{order.notes}</div>}
                    </section>
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Reserved Stock</h2>
                        <div className="mt-3 space-y-2">
                            {reservedStocks.map((stock: any) => <div key={stock.id} className="flex justify-between"><span>{stock.product.name}</span><span>{stock.reserved_stock} reserved</span></div>)}
                        </div>
                    </section>
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Delivery</h2>
                        {order.delivery ? (
                            <div className="mt-3 space-y-2">
                                <DeliveryStatusBadge status={order.delivery.status} />
                                <div>Courier: {order.delivery.courier?.name ?? '-'}</div>
                                <div>Pickup: {order.delivery.pickup_time ? new Date(order.delivery.pickup_time).toLocaleString('id-ID') : '-'}</div>
                                <div>Delivered: {order.delivery.delivered_time ? new Date(order.delivery.delivered_time).toLocaleString('id-ID') : '-'}</div>
                                {order.delivery.failed_reason && <div className="rounded-md bg-red-50 p-3 text-red-700">{order.delivery.failed_reason}</div>}
                            </div>
                        ) : order.status === 'ready_for_pickup' ? (
                            <form onSubmit={(e) => { e.preventDefault(); form.post(`/owner/orders/${order.id}/assign-courier`); }} className="mt-3 space-y-3">
                                <select value={form.data.courier_id} onChange={(e) => form.setData('courier_id', e.target.value)} className="w-full rounded-md border px-3 py-2">
                                    {couriers.map((courier: any) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                                </select>
                                {form.errors.courier_id && <div className="text-red-600">{form.errors.courier_id}</div>}
                                <button className="w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Assign Courier</button>
                            </form>
                        ) : (
                            <div className="mt-3 text-zinc-500">Delivery bisa dibuat setelah order ready for pickup.</div>
                        )}
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
