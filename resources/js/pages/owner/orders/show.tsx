import { useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useState } from 'react';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';
import { isDifferentRecipient } from '@/lib/recipient';

export default function OwnerOrderShow({ order, reservedStocks, couriers }: any) {
    const form = useForm({ courier_id: couriers[0]?.id ?? '' });
    const [resolveOpen, setResolveOpen] = useState(false);
    const [showFullTimeline, setShowFullTimeline] = useState(false);

    const lastHistory = order.status_histories?.[order.status_histories.length - 1];
    const olderHistories = order.status_histories?.slice(0, -1) ?? [];

    return (
        <OwnerPageShell title={order.order_code} subtitle="Detail pesanan" backHref="/owner/orders" headerRight={<OrderStatusChip status={order.status} />}>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Item</div>
                        {order.items.map((item: any) => (
                            <div key={item.id} className="mt-2 flex justify-between border-t border-border pt-2 text-sm">
                                <div><span className="font-medium">{item.product_name}</span> <span className="text-text-subtle">x{item.quantity}</span></div>
                                <span className="tabular-nums">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                        <div className="mt-3 border-t border-border pt-3 text-right text-lg font-bold">{formatCurrency(order.total)}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-muted p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Linimasa</div>
                        {/* Last status as prominent badge */}
                        {lastHistory && (
                            <div className="mt-2 flex items-center gap-2">
                                <StatusBadge variant={getOrderStatus(lastHistory.to_status).variant} size="md">
                                    {getOrderStatus(lastHistory.to_status).label}
                                </StatusBadge>
                                <span className="text-xs text-text-subtle">
                                    {new Date(lastHistory.created_at).toLocaleString('id-ID')}
                                </span>
                            </div>
                        )}
                        {/* Expandable full timeline */}
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
                                                <div className="text-xs text-text-subtle">{new Date(h.created_at).toLocaleString('id-ID')}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                            {isDifferentRecipient(order) ? 'Pemesan' : 'Customer'}
                        </div>
                        <div className="mt-2 font-semibold">{order.customer_name}</div>
                        <div className="text-text-muted">{order.customer_phone}</div>
                        <div className="mt-1 text-xs text-text-muted">{order.customer_address}</div>
                        {order.customer_address_detail && (
                            <div className="mt-1 text-xs text-text-muted"><span className="font-medium text-text-muted">Detail: </span>{order.customer_address_detail}</div>
                        )}
                        {order.customer_landmark && (
                            <div className="mt-1 text-xs text-text-muted"><span className="font-medium text-text-muted">Patokan: </span>{order.customer_landmark}</div>
                        )}

                        {/* Recipient — only when different */}
                        {isDifferentRecipient(order) && (
                            <div className="mt-3 border-t border-border pt-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Penerima</div>
                                <div className="mt-2 font-semibold">{order.recipient_name}</div>
                                <div className="text-text-muted">{order.recipient_phone ?? '-'}</div>
                            </div>
                        )}
                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary-light px-2.5 py-1 text-[11px] font-semibold text-primary active:bg-primary-light"
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Buka di Maps
                            </a>
                        )}
                    </div>
                    {order.status === 'ready_for_pickup' && !order.delivery && (
                        <form onSubmit={(e) => {
 e.preventDefault(); form.post(`/owner/orders/${order.id}/assign-courier`);
}} className="rounded-lg border border-border bg-surface-muted p-4">
                            <Select
                                value={String(form.data.courier_id)}
                                onChange={(e) => form.setData('courier_id', e.target.value)}
                                options={couriers.map((c: any) => ({ value: String(c.id), label: c.name }))}
                            />
                            <button className="mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Tugaskan Kurir</button>
                        </form>
                    )}
                    {order.delivery && (
                        <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Kurir</div>
                            <div className="mt-2 font-semibold">{order.delivery.courier?.name ?? '-'}</div>
                        </div>
                    )}
                    {(order.delivery?.status === 'failed' || ['failed', 'retry_delivery', 'returned_to_outlet'].includes(order.delivery?.status ?? '')) && (
                        <button onClick={() => setResolveOpen(true)} className="w-full rounded-lg border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
                            Selesaikan Masalah
                        </button>
                    )}
                </div>
            </div>
            {order.delivery && <ResolveDeliverySheet delivery={order.delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />}
        </OwnerPageShell>
    );
}
