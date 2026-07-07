import { router, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, MapPin, Truck } from 'lucide-react';
import { useState } from 'react';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
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
            <div className="grid gap-3 lg:grid-cols-2">
                {/* Items */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Item</div>
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                            <span className="text-text-muted">{item.product_name} x{item.quantity}</span>
                            <span className="font-semibold tabular-nums text-text">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                    <div className="mt-2 rounded-lg bg-surface-muted p-3 text-right text-lg font-bold tabular-nums">{formatCurrency(order.total)}</div>
                </div>

                {/* Timeline */}
                <div className="rounded-lg border border-border p-4 lg:col-span-2">
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
                                            <div className="font-medium">{h.to_status.replaceAll('_', ' ')}</div>
                                            <div className="text-sm text-text-subtle">{new Date(h.created_at).toLocaleString('id-ID')}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Customer */}
                <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">
                        {isDifferentRecipient(order) ? 'Pemesan' : 'Customer'}
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Nama</span>
                        <span className="text-text">{order.customer_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Telepon</span>
                        <span className="text-text">{order.customer_phone}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                        <span className="text-text-muted">Alamat</span>
                        <span className="text-right text-text">{order.customer_address}</span>
                    </div>
                    {order.customer_address_detail && (
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                            <span className="text-text-muted">Detail</span>
                            <span className="text-text">{order.customer_address_detail}</span>
                        </div>
                    )}
                    {order.customer_landmark && (
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                            <span className="text-text-muted">Patokan</span>
                            <span className="text-text">{order.customer_landmark}</span>
                        </div>
                    )}

                    {isDifferentRecipient(order) && (
                        <>
                            <div className="mb-3 mt-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Penerima</div>
                            <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                                <span className="text-text-muted">Nama</span>
                                <span className="text-text">{order.recipient_name}</span>
                            </div>
                            <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                                <span className="text-text-muted">Telepon</span>
                                <span className="text-text">{order.recipient_phone ?? '-'}</span>
                            </div>
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
                        <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">
                            <Truck className="h-4 w-4" />
                            Tugaskan Kurir
                        </button>
                    </form>
                )}

                {/* Courier */}
                {order.delivery && (
                    <div className="rounded-lg border border-border p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-text-subtle">Kurir</div>
                        <div className="flex justify-between border-b border-[#f5f5f5] py-1 text-sm last:border-b-0">
                            <span className="text-text-muted">Nama</span>
                            <span className="text-text">{order.delivery.courier?.name ?? '-'}</span>
                        </div>
                    </div>
                )}

                {/* Resolve */}
                {(order.delivery?.status === 'failed' || ['failed', 'retry_delivery', 'returned_to_outlet'].includes(order.delivery?.status ?? '')) && (
                    <button onClick={() => setResolveOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100">
                        Selesaikan Masalah
                    </button>
                )}
            </div>
            {order.delivery && <ResolveDeliverySheet delivery={order.delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />}
        </OwnerPageShell>
    );
}
