import { router, useForm } from '@inertiajs/react';
import { ChevronDown, ChevronUp, MapPin, Truck, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import { Select } from '@/components/ui/select';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/format';
import { getOrderStatus } from '@/lib/status-labels';
import { isDifferentRecipient } from '@/lib/recipient';

const statusBorderColors: Record<string, string> = {
    pending_confirmation: 'border-l-amber-400',
    confirmed: 'border-l-blue-400',
    preparing: 'border-l-indigo-400',
    ready_for_pickup: 'border-l-emerald-400',
    delivering: 'border-l-violet-400',
    completed: 'border-l-emerald-400',
    cancelled_by_customer: 'border-l-red-400',
    cancelled_by_outlet: 'border-l-red-400',
    rejected_by_outlet: 'border-l-red-400',
    failed_delivery: 'border-l-red-400',
    expired: 'border-l-red-400',
};

export default function OwnerOrderShow({ order, reservedStocks, couriers }: any) {
    const form = useForm({ courier_id: couriers[0]?.id ?? '' });
    const [resolveOpen, setResolveOpen] = useState(false);
    const [showFullTimeline, setShowFullTimeline] = useState(false);

    const lastHistory = order.status_histories?.[order.status_histories.length - 1];
    const olderHistories = order.status_histories?.slice(0, -1) ?? [];
    const borderColor = statusBorderColors[order.status] ?? 'border-l-gray-300';
    const s = getOrderStatus(order.status);

    return (
        <OwnerPageShell title={order.order_code} subtitle="Detail pesanan" backHref="/owner/orders" headerRight={<OrderStatusChip status={order.status} />}>
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                    <div className={`rounded-xl border border-border border-l-4 ${borderColor} bg-white p-5`}>
                        <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Item</div>
                        {order.items.map((item: any) => (
                            <div key={item.id} className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
                                <div><span className="font-medium text-text">{item.product_name}</span> <span className="text-text-subtle">x{item.quantity}</span></div>
                                <span className="font-semibold tabular-nums">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                        <div className="mt-4 border-t border-border pt-4 text-right text-xl font-bold tabular-nums">{formatCurrency(order.total)}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-5">
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
                <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                    {/* Status badge in sidebar */}
                    <div className="rounded-xl border border-border bg-white p-5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Status Pesanan</div>
                        <div className="mt-2">
                            <StatusBadge variant={s.variant} size="md">{s.label}</StatusBadge>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-white p-5 text-sm">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                            {isDifferentRecipient(order) ? 'Pemesan' : 'Customer'}
                        </div>
                        <div className="mt-2 font-semibold text-text">{order.customer_name}</div>
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
                                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Buka di Maps
                            </a>
                        )}
                    </div>

                    {/* Quick actions */}
                    {order.status === 'pending_confirmation' && (
                        <button
                            onClick={() => router.visit(`/owner/orders/${order.id}?action=confirm`)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Konfirmasi Pesanan
                        </button>
                    )}

                    {order.status === 'ready_for_pickup' && !order.delivery && (
                        <form onSubmit={(e) => {
                            e.preventDefault(); form.post(`/owner/orders/${order.id}/assign-courier`);
                        }} className="rounded-xl border border-border bg-white p-5">
                            <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Assign Kurir</div>
                            <Select
                                value={String(form.data.courier_id)}
                                onChange={(e) => form.setData('courier_id', e.target.value)}
                                options={couriers.map((c: any) => ({ value: String(c.id), label: c.name }))}
                                className="mt-2"
                            />
                            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">
                                <Truck className="h-4 w-4" />
                                Tugaskan Kurir
                            </button>
                        </form>
                    )}

                    {order.delivery && (
                        <div className="rounded-xl border border-border bg-white p-5 text-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-text-subtle">Kurir</div>
                            <div className="mt-2 font-semibold text-text">{order.delivery.courier?.name ?? '-'}</div>
                        </div>
                    )}

                    {(order.delivery?.status === 'failed' || ['failed', 'retry_delivery', 'returned_to_outlet'].includes(order.delivery?.status ?? '')) && (
                        <button onClick={() => setResolveOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100">
                            Selesaikan Masalah
                        </button>
                    )}
                </div>
            </div>
            {order.delivery && <ResolveDeliverySheet delivery={order.delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />}
        </OwnerPageShell>
    );
}
