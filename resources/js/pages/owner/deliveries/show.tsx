import { Head, useForm } from '@inertiajs/react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import OrderStatusBadge from '@/components/order-status-badge';
import OwnerLayout from '@/layouts/owner-layout';
import { formatDate } from '@/lib/format';

const resolutionOptions = [
    { value: 'retry_delivery', label: 'Retry Delivery', description: 'Jadwalkan ulang pengiriman. Reserved stock tetap.' },
    { value: 'returned_to_outlet', label: 'Return to Outlet', description: 'Barang dikembalikan ke outlet. Order bisa diproses ulang.' },
    { value: 'cancelled_and_released', label: 'Cancel & Release Stock', description: 'Batalkan order dan lepas reserved stock.' },
];

export default function OwnerDeliveryShow({ delivery }: any) {
    const order = delivery.order;
    const canResolve = ['failed', 'retry_delivery', 'returned_to_outlet'].includes(delivery.status);

    const form = useForm({
        resolution: '',
        resolution_notes: '',
    });

    function handleResolve(e: React.FormEvent) {
        e.preventDefault();
        form.post(`/owner/deliveries/${delivery.id}/resolve`);
    }

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
                <div className="space-y-5">
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

                    {canResolve && (
                        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                            <h2 className="font-semibold text-amber-900">Resolve Failed Delivery</h2>
                            <p className="mt-1 text-sm text-amber-700">Pilih tindakan untuk delivery yang gagal ini.</p>
                            <form onSubmit={handleResolve} className="mt-4 space-y-4">
                                <div className="space-y-2">
                                    {resolutionOptions.map((opt) => (
                                        <label key={opt.value} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${form.data.resolution === opt.value ? 'border-amber-400 bg-white' : 'border-transparent hover:bg-white/50'}`}>
                                            <input
                                                type="radio"
                                                name="resolution"
                                                value={opt.value}
                                                checked={form.data.resolution === opt.value}
                                                onChange={(e) => form.setData('resolution', e.target.value)}
                                                className="mt-0.5"
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                                                <div className="text-xs text-slate-500">{opt.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                {form.errors.resolution && <p className="text-xs text-red-600">{form.errors.resolution}</p>}

                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Catatan (opsional)</label>
                                    <textarea
                                        className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                                        rows={2}
                                        value={form.data.resolution_notes}
                                        onChange={(e) => form.setData('resolution_notes', e.target.value)}
                                        placeholder="Alasan atau catatan resolusi..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!form.data.resolution || form.processing}
                                    className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                >
                                    {form.processing ? 'Processing...' : 'Resolve Delivery'}
                                </button>
                            </form>
                        </section>
                    )}
                </div>

                <aside className="space-y-5">
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Delivery Info</h2>
                        <div className="mt-3">Outlet: {order.outlet?.name ?? '-'}</div>
                        <div>Customer: {order.customer_name}</div>
                        <div className="text-zinc-600">{order.customer_address}</div>
                        <div className="mt-3">Pickup: {formatDate(delivery.pickup_time)}</div>
                        <div>Delivered: {formatDate(delivery.delivered_time)}</div>
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
                        <h2 className="font-semibold">Timeline</h2>
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
        </OwnerLayout>
    );
}
