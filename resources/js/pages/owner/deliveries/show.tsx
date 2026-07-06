import { router } from '@inertiajs/react';
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
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                {/* Left: Main Content */}
                <div className="space-y-5">
                    <section className="rounded-xl border border-border bg-white p-5">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-text-subtle">Item Pesanan</h2>
                        <div className="mt-3 space-y-3">
                            {order.items.map((item: any) => (
                                <div key={item.id} className="flex justify-between border-t border-border pt-3 text-sm">
                                    <div>
                                        <div className="font-medium text-text">{item.product_name}</div>
                                        <div className="text-xs text-text-muted">Jml {item.quantity}</div>
                                    </div>
                                    <div className="font-semibold tabular-nums text-text">
                                        Rp {Number(item.subtotal).toLocaleString('id-ID')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-xl border border-border bg-white p-5">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-text-subtle">Linimasa</h2>
                        <div className="mt-3 space-y-3">
                            {order.status_histories.map((history: any) => (
                                <div key={history.id} className="border-l-2 border-primary/20 pl-3">
                                    <div className="text-sm font-medium text-text">{history.to_status.replaceAll('_', ' ')}</div>
                                    {history.notes && <div className="text-xs text-text-muted">{history.notes}</div>}
                                    <div className="text-[11px] text-text-subtle">
                                        {formatDate(history.created_at)} {history.actor ? `oleh ${history.actor.name}` : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {canResolve && (
                        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                            <h2 className="text-sm font-bold text-amber-900">Insiden Belum Diselesaikan</h2>
                            <p className="mt-1 text-sm text-amber-700">
                                Delivery ini gagal dan membutuhkan tindakan operasional.
                            </p>
                            <button
                                onClick={() => setResolveOpen(true)}
                                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 text-sm font-semibold text-white transition-colors hover:bg-amber-700 active:bg-amber-800"
                            >
                                Selesaikan Insiden
                            </button>
                        </section>
                    )}
                </div>

                {/* Right: Sidebar */}
                <aside className="hidden lg:block">
                    <div className="sticky top-4 space-y-4">
                        {/* Status Card */}
                        <section className="rounded-xl border border-border bg-white p-5">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-text-subtle">Status</h2>
                            <div className="mt-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-text-muted">Pesanan</span>
                                    <OrderStatusBadge status={order.status} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-text-muted">Pengiriman</span>
                                    <DeliveryStatusBadge status={delivery.status} />
                                </div>
                            </div>
                            {isActive && (
                                <div className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700">
                                    <MapPin className="h-4 w-4" />
                                    Sedang Dalam Pengiriman
                                </div>
                            )}
                        </section>

                        {/* Delivery Info */}
                        <section className="rounded-xl border border-border bg-white p-5 text-sm">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-text-subtle">Info Pengiriman</h2>
                            <div className="mt-3 space-y-2 text-text">
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Outlet</span>
                                    <span className="font-medium">{order.outlet?.name ?? '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Pelanggan</span>
                                    <span className="font-medium">{order.customer_name}</span>
                                </div>
                                <div className="text-xs text-text-muted">{order.customer_address}</div>
                                <div className="border-t border-border pt-2">
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Pengambilan</span>
                                        <span>{formatDate(delivery.pickup_time)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Terkirim</span>
                                        <span>{formatDate(delivery.delivered_time)}</span>
                                    </div>
                                </div>
                            </div>
                            {delivery.failed_reason && (
                                <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700">
                                    <strong>Alasan gagal:</strong> {delivery.failed_reason}
                                </div>
                            )}
                            {delivery.resolution_status && (
                                <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                                    <strong>Resolusi:</strong> {delivery.resolution_status.replaceAll('_', ' ')}
                                    {delivery.resolution_notes && <div className="mt-1">{delivery.resolution_notes}</div>}
                                    {delivery.resolved_by && (
                                        <div className="mt-1 text-amber-600">
                                            oleh {delivery.resolved_by.name} - {formatDate(delivery.resolved_at)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Courier Info */}
                        {delivery.courier && (
                            <section className="rounded-xl border border-border bg-white p-5">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-text-subtle">Kurir</h2>
                                <div className="mt-3 flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-sm font-bold text-text">
                                        {delivery.courier.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-text">{delivery.courier.name}</div>
                                        <div className="text-xs text-text-muted">Kurir</div>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </aside>
            </div>

            {/* Mobile: Status + Info (visible only on small screens) */}
            <div className="mt-5 space-y-4 lg:hidden">
                <section className="rounded-xl border border-border bg-white p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Pesanan</span>
                        <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-text-muted">Pengiriman</span>
                        <DeliveryStatusBadge status={delivery.status} />
                    </div>
                </section>
                {canResolve && (
                    <button
                        onClick={() => setResolveOpen(true)}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 text-sm font-semibold text-white"
                    >
                        Selesaikan Insiden
                    </button>
                )}
            </div>

            <ResolveDeliverySheet delivery={delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />
        </OwnerPageShell>
    );
}
