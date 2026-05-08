import { Head, router, useForm, usePage } from '@inertiajs/react';
import DeliveryStatusBadge from '../../../components/delivery-status-badge';
import OrderStatusBadge from '../../../components/order-status-badge';
import CourierLayout from '../../../layouts/courier-layout';

export default function CourierDeliveryShow({ delivery }: any) {
    const order = delivery.order;
    const { errors } = usePage<any>().props;
    const failForm = useForm({ failed_reason: '' });

    return (
        <CourierLayout>
            <Head title={order.order_code} />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{order.order_code}</h1>
                    <p className="mt-1 text-sm text-zinc-500">Pickup: {order.outlet?.name ?? '-'}</p>
                </div>
                <div className="flex gap-2"><OrderStatusBadge status={order.status} /><DeliveryStatusBadge status={delivery.status} /></div>
            </div>
            {errors?.status && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.status}</div>}
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
                <section className="rounded-lg border bg-white p-5">
                    <h2 className="font-semibold">Items</h2>
                    <div className="mt-3 space-y-3">
                        {order.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                <div><div className="font-medium">{item.product_name}</div><div className="text-zinc-500">Qty {item.quantity}</div></div>
                                <div>Rp {Number(item.subtotal).toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
                        {delivery.status === 'waiting_pickup' && <button onClick={() => router.post(`/courier/deliveries/${delivery.id}/confirm-pickup`)} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Confirm Pickup</button>}
                        {delivery.status === 'picked_up' && <button onClick={() => router.post(`/courier/deliveries/${delivery.id}/start-delivery`)} className="rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white">Start Delivery</button>}
                        {delivery.status === 'delivering' && <button onClick={() => router.post(`/courier/deliveries/${delivery.id}/complete`)} className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white">Mark Completed</button>}
                    </div>
                    {delivery.status === 'delivering' && (
                        <form onSubmit={(e) => { e.preventDefault(); failForm.post(`/courier/deliveries/${delivery.id}/fail`); }} className="mt-4 rounded-md border border-red-100 bg-red-50 p-4">
                            <label className="block text-sm font-medium text-red-900">Failed reason</label>
                            <textarea value={failForm.data.failed_reason} onChange={(e) => failForm.setData('failed_reason', e.target.value)} className="mt-2 w-full rounded-md border px-3 py-2 text-sm" />
                            {failForm.errors.failed_reason && <div className="mt-1 text-sm text-red-700">{failForm.errors.failed_reason}</div>}
                            <button className="mt-3 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700">Mark Failed</button>
                        </form>
                    )}
                </section>
                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Route Info</h2>
                        <div className="mt-3 font-medium">Pickup</div>
                        <div>{order.outlet?.name ?? '-'}</div>
                        <div className="text-zinc-600">{order.outlet?.address ?? '-'}</div>
                        <div className="mt-3 font-medium">Customer</div>
                        <div>{order.customer_name}</div>
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
                                    <div className="text-xs text-zinc-400">{new Date(history.created_at).toLocaleString('id-ID')}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
        </CourierLayout>
    );
}
