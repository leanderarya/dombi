import { MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import { Button } from '@/components/ui/button';
import DeliveryStatusBadge from '@/components/ui/delivery-status-badge';
import OrderStatusBadge from '@/components/ui/order-status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';

export default function OwnerDeliveryShow({ delivery }: any) {
    const [resolveOpen, setResolveOpen] = useState(false);

    if (!delivery) {
        return (
            <OwnerPageShell title="Memuat..." subtitle="Detail pengiriman" backHref="/owner/deliveries">
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                </div>
            </OwnerPageShell>
        );
    }

    const order = delivery.order;
    const canResolve = ['failed', 'retry_delivery', 'returned_to_outlet'].includes(delivery.status);
    const isActive = ['delivering', 'picked_up'].includes(delivery.status);

    return (
        <OwnerPageShell
            title={`Pengiriman #${delivery.id}`}
            subtitle={order.order_code}
            backHref="/owner/deliveries"
        >
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Main Content - 2 columns */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Status */}
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Status</div>
                        <OwnerDetailRow label="Pesanan" value={<OrderStatusBadge status={order.status} />} />
                        <OwnerDetailRow label="Pengiriman" value={<DeliveryStatusBadge status={delivery.status} />} />
                        {isActive && (
                            <div className="mt-3 flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-700">
                                <MapPin className="h-3.5 w-3.5" />
                                Sedang Dalam Pengiriman
                            </div>
                        )}
                    </div>

                    {/* Delivery Info */}
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Info Pengiriman</div>
                        <OwnerDetailRow label="Outlet" value={order.outlet?.name ?? '-'} />
                        <OwnerDetailRow label="Pelanggan" value={order.customer_name} />
                        <OwnerDetailRow label="Alamat" value={order.customer_address} align="right" />
                        <OwnerDetailRow label="Pengambilan" value={formatDate(delivery.pickup_time)} />
                        <OwnerDetailRow label="Terkirim" value={formatDate(delivery.delivered_time)} />
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

                    {/* Items */}
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Item Pesanan</div>
                        {order.items.map((item: any) => (
                            <OwnerDetailRow key={item.id} label={`${item.product_name} x${item.quantity}`} value={formatCurrency(item.subtotal)} bold />
                        ))}
                    </div>
                </div>

                {/* Sidebar - 1 column */}
                <div className="space-y-4">
                    {/* Courier */}
                    {delivery.courier && (
                        <div className="rounded-lg border border-border p-4">
                            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Kurir</div>
                            <OwnerDetailRow label="Nama" value={delivery.courier.name} />
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Linimasa</div>
                        <div className="space-y-3">
                            {order.status_histories.map((history: any) => {
                                const statusInfo = getOrderStatus(history.to_status);
                                return (
                                    <div key={history.id} className="border-l-2 border-primary/20 pl-3">
                                        <div className="flex items-center gap-2">
                                            <StatusBadge variant={statusInfo.variant} size="sm">
                                                {statusInfo.label}
                                            </StatusBadge>
                                        </div>
                                        {history.notes && <div className="mt-1 text-xs text-text-muted">{history.notes}</div>}
                                        <div className="mt-1 text-xs text-text-subtle">
                                            {formatDate(history.created_at)} {history.actor ? `oleh ${history.actor.name}` : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resolve */}
                    {canResolve && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <div className="mb-1 text-sm font-bold text-amber-900">Insiden Belum Diselesaikan</div>
                            <p className="text-xs text-amber-700">
                                Delivery ini gagal dan membutuhkan tindakan operasional.
                            </p>
                            <Button
                                variant="destructive"
                                className="mt-3 w-full"
                                onClick={() => setResolveOpen(true)}
                            >
                                Selesaikan Insiden
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <ResolveDeliverySheet delivery={delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />
        </OwnerPageShell>
    );
}
