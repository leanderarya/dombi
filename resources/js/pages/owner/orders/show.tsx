import { router, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import OwnerDetailRow from '@/components/owner/owner-detail-row';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { isDifferentRecipient } from '@/lib/recipient';
import { getOrderStatus } from '@/lib/status-labels';

export default function OwnerOrderShow({ order, couriers }: any) {
    const form = useForm({ courier_id: couriers[0]?.id ?? '' });
    const [resolveOpen, setResolveOpen] = useState(false);
    const [showFullTimeline, setShowFullTimeline] = useState(false);

    const lastHistory = order.status_histories?.[order.status_histories.length - 1];
    const olderHistories = order.status_histories?.slice(0, -1) ?? [];

    return (
        <OwnerPageShell title={order.order_code} subtitle="Detail pesanan" backHref="/owner/orders" headerRight={<OrderStatusChip status={order.status} />}>
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Main Content - 2 columns */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Items */}
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Item</div>
                        {order.items.map((item: any) => (
                            <OwnerDetailRow key={item.id} label={`${item.product_name} x${item.quantity}`} value={formatCurrency(item.subtotal)} bold />
                        ))}
                        <div className="mt-2 rounded-lg bg-surface-muted p-3 text-right text-lg font-bold tabular-nums">{formatCurrency(order.total)}</div>
                    </div>

                    {/* Customer */}
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">
                            {isDifferentRecipient(order) ? 'Pemesan' : 'Customer'}
                        </div>
                        <OwnerDetailRow label="Nama" value={order.customer_name} />
                        <OwnerDetailRow label="Telepon" value={order.customer_phone} />
                        <OwnerDetailRow label="Alamat" value={order.customer_address} align="right" />
                        {order.customer_address_detail && (
                            <OwnerDetailRow label="Detail" value={order.customer_address_detail} />
                        )}
                        {order.customer_landmark && (
                            <OwnerDetailRow label="Patokan" value={order.customer_landmark} />
                        )}

                        {isDifferentRecipient(order) && (
                            <>
                                <div className="mb-3 mt-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Penerima</div>
                                <OwnerDetailRow label="Nama" value={order.recipient_name} />
                                <OwnerDetailRow label="Telepon" value={order.recipient_phone ?? '-'} />
                            </>
                        )}

                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary-light px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Buka di Maps
                            </a>
                        )}
                    </div>
                </div>

                {/* Sidebar - 1 column */}
                <div className="space-y-4">
                    {/* Timeline */}
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Linimasa</div>
                        {lastHistory && (
                            <div className="flex items-center gap-2">
                                <StatusBadge variant={getOrderStatus(lastHistory.to_status).variant} size="md">
                                    {getOrderStatus(lastHistory.to_status).label}
                                </StatusBadge>
                                <span className="text-xs text-text-subtle">
                                    {new Date(lastHistory.created_at).toLocaleString('id-ID')}
                                </span>
                            </div>
                        )}
                        {olderHistories.length > 0 && (
                            <>
                                <button
                                    onClick={() => setShowFullTimeline(!showFullTimeline)}
                                    className="mt-2 flex items-center gap-1 text-xs font-medium text-primary"
                                >
                                    {showFullTimeline ? (
                                        <>Sembunyikan <ChevronUp className="h-3 w-3" /></>
                                    ) : (
                                        <>Lihat Semua ({olderHistories.length}) <ChevronDown className="h-3 w-3" /></>
                                    )}
                                </button>
                                {showFullTimeline && (
                                    <div className="mt-2 space-y-2">
                                        {olderHistories.map((h: any) => (
                                            <div key={h.id} className="border-l-2 border-primary/20 pl-3 text-sm">
                                                <div className="font-medium">
                                                    <StatusBadge variant={getOrderStatus(h.to_status).variant} size="sm">
                                                        {getOrderStatus(h.to_status).label}
                                                    </StatusBadge>
                                                </div>
                                                <div className="text-xs text-text-subtle">{new Date(h.created_at).toLocaleString('id-ID')}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Assign Kurir */}
                    {order.status === 'ready_for_pickup' && !order.delivery && (
                        <form onSubmit={(e) => {
                            e.preventDefault(); form.post(`/owner/orders/${order.id}/assign-courier`);
                        }} className="rounded-lg border border-border p-4">
                            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Assign Kurir</div>
                            <Select
                                value={String(form.data.courier_id)}
                                onChange={(e) => form.setData('courier_id', e.target.value)}
                                options={couriers.map((c: any) => ({ value: String(c.id), label: c.name }))}
                            />
                            <Button className="mt-3 w-full" loading={form.processing}>
                                <Truck className="h-4 w-4" />
                                Tugaskan Kurir
                            </Button>
                        </form>
                    )}

                    {/* Courier */}
                    {order.delivery && (
                        <div className="rounded-lg border border-border p-4">
                            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Kurir</div>
                            <OwnerDetailRow label="Nama" value={order.delivery.courier?.name ?? '-'} />
                        </div>
                    )}

                    {/* Resolve */}
                    {(order.delivery?.status === 'failed' || ['failed', 'retry_delivery', 'returned_to_outlet'].includes(order.delivery?.status ?? '')) && (
                        <Button variant="destructive" className="w-full" onClick={() => setResolveOpen(true)}>
                            Selesaikan Masalah
                        </Button>
                    )}
                </div>
            </div>
            {order.delivery && <ResolveDeliverySheet delivery={order.delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />}
        </OwnerPageShell>
    );
}
