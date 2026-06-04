import { Head, Link } from '@inertiajs/react';
import DeliverySlaBadge from '@/components/owner/delivery-sla-badge';
import DeliveryTimeline from '@/components/owner/delivery-timeline';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDeliveryAge } from '@/lib/format';

export default function OutletDeliveryShow({ delivery }: any) {
    const order = delivery.order;

    return (
        <OutletLayout>
            <Head title={delivery.order_code} />

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">{delivery.order_code}</h1>
                    <p className="mt-1 text-sm text-zinc-500">Courier: {delivery.courier?.name ?? '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <DeliveryStatusBadge status={delivery.status} />
                    {delivery.sla_health && <DeliverySlaBadge health={delivery.sla_health} />}
                </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <div className="space-y-5">
                    {/* Items */}
                    <section className="rounded-lg border bg-white p-5">
                        <h2 className="font-semibold">Items</h2>
                        <div className="mt-3 space-y-3">
                            {order.items.map((item: any) => (
                                <div key={item.id} className="flex justify-between border-t pt-3 text-sm">
                                    <div>
                                        <div className="font-medium">{item.product_name}</div>
                                        <div className="text-zinc-500">Qty {item.quantity}</div>
                                    </div>
                                    <div className="font-medium">{formatCurrency(item.subtotal)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex justify-between border-t pt-3 text-sm font-bold">
                            <span>Total</span>
                            <span>{formatCurrency(order.total)}</span>
                        </div>
                    </section>

                    {/* Failed Reason */}
                    {delivery.failed_reason && (
                        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
                            <h2 className="font-semibold text-red-900">Alasan Gagal</h2>
                            <p className="mt-1 text-sm text-red-700">{delivery.failed_reason}</p>
                        </section>
                    )}

                    {/* Resolution */}
                    {delivery.resolution_status && (
                        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                            <h2 className="font-semibold text-amber-900">Resolusi</h2>
                            <p className="mt-1 text-sm text-amber-700">
                                {delivery.resolution_status.replaceAll('_', ' ')}
                            </p>
                            {delivery.resolution_notes && (
                                <p className="mt-1 text-xs text-amber-600">{delivery.resolution_notes}</p>
                            )}
                        </section>
                    )}
                </div>

                <aside className="space-y-5">
                    {/* Delivery Info */}
                    <section className="rounded-lg border bg-white p-5 text-sm">
                        <h2 className="font-semibold">Delivery Info</h2>
                        <div className="mt-3 space-y-2">
                            <div><span className="text-zinc-500">Customer:</span> {delivery.customer_name}</div>
                            <div><span className="text-zinc-500">Alamat:</span> {delivery.customer_address}</div>
                            {delivery.customer_phone && (
                                <div><span className="text-zinc-500">Telepon:</span> {delivery.customer_phone}</div>
                            )}
                            {delivery.delivery_age != null && (
                                <div>
                                    <span className="text-zinc-500">Usia Delivery:</span>{' '}
                                    <span className={delivery.delivery_age > 60 ? 'font-medium text-red-600' : ''}>
                                        {formatDeliveryAge(delivery.delivery_age)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Timeline */}
                    <section className="rounded-lg border bg-white p-5">
                        <h2 className="font-semibold">Timeline</h2>
                        <div className="mt-3">
                            <DeliveryTimeline histories={delivery.status_histories ?? []} />
                        </div>
                    </section>
                </aside>
            </div>
        </OutletLayout>
    );
}
