import { Head, router, useForm, usePage } from '@inertiajs/react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import OrderStatusBadge from '../../../components/order-status-badge';
import OutletLayout from '../../../layouts/outlet-layout';

const actions: Record<string, Array<[string, string, string]>> = {
    pending: [['confirmed', 'Accept Order', 'bg-emerald-700 text-white'], ['cancelled', 'Cancel Order', 'border border-red-200 text-red-700']],
    confirmed: [['preparing', 'Start Preparing', 'bg-orange-600 text-white']],
    preparing: [['ready_for_pickup', 'Mark Ready for Pickup', 'bg-purple-700 text-white']],
};

export default function OutletOrderShow({ order, couriers }: any) {
    const { errors } = usePage<any>().props;
    const assignForm = useForm({ courier_id: couriers[0]?.id ?? '' });
    const updateStatus = (status: string) => {
        router.post(`/outlet/orders/${order.id}/status`, { status });
    };

    return (
        <OutletLayout>
            <Head title={order.order_code} />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{order.order_code}</h1>
                    <p className="mt-1 text-sm text-zinc-500">{order.customer_name}</p>
                </div>
                <OrderStatusBadge status={order.status} />
            </div>
            {errors?.status && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.status}</div>}
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Items</h2>
                    <div className="mt-3 space-y-3">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                <div><div className="font-medium">{item.product_name}</div><div className="text-zinc-500">Qty {item.quantity} x Rp {Number(item.price).toLocaleString('id-ID')}</div></div>
                                <div className="font-medium">Rp {Number(item.subtotal).toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 border-t pt-4 text-right">
                        <div className="text-xl font-semibold">Rp {Number(order.total).toLocaleString('id-ID')}</div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                        {(actions[order.status] ?? []).map(([status, label, className]) => (
                            <button key={status} onClick={() => updateStatus(status)} className={`rounded-md px-4 py-2 text-sm font-medium ${className}`}>
                                {label}
                            </button>
                        ))}
                        {order.status === 'ready_for_pickup' && !order.delivery && <span className="rounded-md bg-purple-50 px-4 py-2 text-sm font-medium text-purple-800">Waiting Courier Assignment</span>}
                    </div>
                </section>
                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Delivery</h2>
                        {order.delivery ? (
                            <div className="mt-3 space-y-2">
                                <DeliveryStatusBadge status={order.delivery.status} />
                                <div>Courier: {order.delivery.courier?.name ?? '-'}</div>
                                <div>Pickup: {order.delivery.pickup_time ? new Date(order.delivery.pickup_time).toLocaleString('id-ID') : '-'}</div>
                                <div>Delivered: {order.delivery.delivered_time ? new Date(order.delivery.delivered_time).toLocaleString('id-ID') : '-'}</div>
                            </div>
                        ) : order.status === 'ready_for_pickup' ? (
                            <form onSubmit={(e) => { e.preventDefault(); assignForm.post(`/outlet/orders/${order.id}/assign-courier`); }} className="mt-3 space-y-3">
                                <select value={assignForm.data.courier_id} onChange={(e) => assignForm.setData('courier_id', e.target.value)} className="w-full rounded-md border px-3 py-2">
                                    {couriers.map((courier: any) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                                </select>
                                {assignForm.errors.courier_id && <div className="text-red-600">{assignForm.errors.courier_id}</div>}
                                <button className="w-full rounded-md bg-emerald-700 px-4 py-2 font-medium text-white">Assign Courier</button>
                            </form>
                        ) : (
                            <div className="mt-3 text-zinc-500">Delivery tersedia setelah ready for pickup.</div>
                        )}
                    </section>
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Customer Info</h2>
                        <div className="mt-3 font-medium">{order.customer_name}</div>
                        <div>{order.customer_phone}</div>
                        <div className="text-zinc-600">{order.customer_address}</div>
                        {order.notes && <div className="mt-3 rounded-md bg-zinc-50 p-3">{order.notes}</div>}
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
        </OutletLayout>
    );
}
