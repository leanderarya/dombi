import { Head, Link, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import OrderStatusChip from '@/components/owner/order-status-chip';
import OwnerBottomNav from '@/components/owner/owner-bottom-nav';
import OwnerMobileHeader from '@/components/owner/owner-mobile-header';
import ResolveDeliverySheet from '@/components/owner/resolve-delivery-sheet';
import OfflineBanner from '@/components/offline-banner';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency } from '@/lib/format';

export default function OwnerOrderShow({ order, reservedStocks, couriers }: any) {
    return (
        <>
            <div className="hidden lg:block">
                <OwnerLayout><DesktopView order={order} reservedStocks={reservedStocks} couriers={couriers} /></OwnerLayout>
            </div>
            <div className="lg:hidden">
                <MobileView order={order} reservedStocks={reservedStocks} couriers={couriers} />
            </div>
        </>
    );
}

function MobileView({ order, reservedStocks, couriers }: any) {
    const form = useForm({ courier_id: couriers[0]?.id ?? '' });
    const canAssign = order.status === 'ready_for_pickup' && !order.delivery;
    const isFailed = order.status === 'failed';
    const canResolve = ['failed', 'retry_delivery', 'returned_to_outlet'].includes(order.delivery?.status ?? '');
    const [resolveOpen, setResolveOpen] = useState(false);

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <Head title={order.order_code} />
            <OfflineBanner />

            {/* Header — unified */}
            <OwnerMobileHeader title={order.order_code} backHref="/owner/orders" />

            {/* Content */}
            <main className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">

                {/* Status Dispatch Card — flat, compact */}
                <section className="mt-3 rounded-lg border border-slate-200 bg-slate-800 p-3">
                    <div className="flex items-center justify-between">
                        <OrderStatusChip status={order.status} />
                        {order.delivery?.delivered_time && (
                            <span className="text-[10px] tabular-nums text-slate-400">
                                {new Date(order.delivery.delivered_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">
                        {statusHeadline(order.status)}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
                        {order.outlet?.name ?? '-'}
                    </div>
                </section>

                {/* Customer Card */}
                <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {order.customer_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">{order.customer_name}</div>
                            <div className="text-xs tabular-nums text-slate-500">{order.customer_phone}</div>
                        </div>
                        <a href={`tel:${order.customer_phone}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-emerald-700 active:bg-emerald-50">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </a>
                    </div>
                    <div className="mt-2 flex items-start gap-2 border-t border-slate-100 pt-2">
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs leading-relaxed text-slate-600">{order.customer_address}</span>
                            {order.customer_address_detail && (
                                <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Detail: </span>{order.customer_address_detail}</div>
                            )}
                            {order.customer_landmark && (
                                <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Patokan: </span>{order.customer_landmark}</div>
                            )}
                            {order.latitude && order.longitude && (
                                <a
                                    href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 active:bg-emerald-100"
                                >
                                    <MapPin className="h-3.5 w-3.5" />
                                    Buka di Maps
                                </a>
                            )}
                        </div>
                    </div>
                </section>

                {/* Courier Card */}
                {order.delivery?.courier && (
                    <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Courier Assigned</div>
                        <div className="mt-1.5 flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                                {order.delivery.courier.name?.charAt(0)}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{order.delivery.courier.name}</div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Failed reason */}
                {order.delivery?.failed_reason && (
                    <section className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">Failure Reason</div>
                        <div className="mt-1 text-xs text-red-800">{order.delivery.failed_reason}</div>
                    </section>
                )}

                {/* Order Lifecycle — dense timeline */}
                <section className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order Lifecycle</div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                        {order.status_histories.slice().reverse().slice(0, 4).map((h: any, i: number) => (
                            <div key={h.id} className={`flex items-start gap-2.5 ${i > 0 ? 'mt-2.5 border-t border-slate-50 pt-2.5' : ''}`}>
                                <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${i === 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <div className="min-w-0 flex-1">
                                    <div className={`text-xs font-semibold ${i === 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                                        {h.to_status.replaceAll('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                    </div>
                                    {h.notes && i === 0 && <div className="mt-0.5 text-[11px] text-slate-500">{h.notes}</div>}
                                </div>
                                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                                    {new Date(h.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Order Manifest */}
                <section className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order Manifest</div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                        {order.items.map((item: any) => {
                            const stockImpact = reservedStocks.find((s: any) => s.product_id === item.product_id);
                            return (
                                <div key={item.id} className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-b-0 last:pb-0 first:pt-0">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-50 text-xs">🥛</div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-semibold text-slate-900">{item.product_name}</div>
                                        {stockImpact && (
                                            <div className="text-[10px] text-amber-600">Stock Impact: -{item.quantity}</div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400">x{item.quantity}</div>
                                        <div className="text-xs font-semibold tabular-nums text-slate-900">{formatCurrency(item.subtotal)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Payment Summary */}
                <section className="mt-3 space-y-1.5 px-1">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Subtotal</span><span className="tabular-nums text-slate-700">{formatCurrency(order.subtotal)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Delivery Fee</span><span className="tabular-nums text-slate-700">{formatCurrency(order.delivery_fee)}</span></div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Amount</div>
                            <div className="text-lg font-bold tabular-nums text-slate-900">{formatCurrency(order.total)}</div>
                        </div>
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">PAID</span>
                    </div>
                </section>

                {/* Assign Courier Form */}
                {canAssign && (
                    <section className="mt-4">
                        <form onSubmit={(e) => { e.preventDefault(); form.post(`/owner/orders/${order.id}/assign-courier`); }}>
                            <select value={form.data.courier_id} onChange={(e) => form.setData('courier_id', e.target.value)} className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200">
                                {couriers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {form.errors.courier_id && <p className="mt-1 text-xs text-red-600">{form.errors.courier_id}</p>}
                            <button type="submit" disabled={form.processing} className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.98] active:bg-emerald-800 disabled:bg-slate-300">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                {form.processing ? 'Assigning...' : 'Assign Courier'}
                            </button>
                        </form>
                    </section>
                )}

                {/* Action Dock */}
                {(canResolve || isFailed || order.delivery) && (
                    <section className="mt-4 flex gap-2">
                        {(isFailed || canResolve) && (
                            <button onClick={() => setResolveOpen(true)} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98]">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" /></svg>
                                Resolve Issue
                            </button>
                        )}
                        <a href={`tel:${order.customer_phone}`} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98]">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            Contact
                        </a>
                    </section>
                )}
            </main>

            {/* Resolution Bottom Sheet */}
            {order.delivery && <ResolveDeliverySheet delivery={order.delivery} open={resolveOpen} onClose={() => setResolveOpen(false)} />}

            <OwnerBottomNav />
        </div>
    );
}

function DesktopView({ order, reservedStocks, couriers }: any) {
    const form = useForm({ courier_id: couriers[0]?.id ?? '' });

    return (
        <>
            <Head title={order.order_code} />
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{order.order_code}</h1>
                <OrderStatusChip status={order.status} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Items</div>
                        {order.items.map((item: any) => (
                            <div key={item.id} className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm">
                                <div><span className="font-medium">{item.product_name}</span> <span className="text-slate-400">x{item.quantity}</span></div>
                                <span className="tabular-nums">{formatCurrency(item.subtotal)}</span>
                            </div>
                        ))}
                        <div className="mt-3 border-t border-slate-200 pt-3 text-right text-lg font-bold">{formatCurrency(order.total)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Timeline</div>
                        {order.status_histories.map((h: any) => (
                            <div key={h.id} className="mt-2 border-l-2 border-emerald-200 pl-3 text-sm">
                                <div className="font-medium">{h.to_status.replaceAll('_', ' ')}</div>
                                <div className="text-xs text-slate-400">{new Date(h.created_at).toLocaleString('id-ID')}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                        <div className="font-semibold">{order.customer_name}</div>
                        <div className="text-slate-500">{order.customer_phone}</div>
                        <div className="mt-1 text-xs text-slate-600">{order.customer_address}</div>
                        {order.customer_address_detail && (
                            <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Detail: </span>{order.customer_address_detail}</div>
                        )}
                        {order.customer_landmark && (
                            <div className="mt-1 text-xs text-slate-600"><span className="font-medium text-slate-500">Patokan: </span>{order.customer_landmark}</div>
                        )}
                        {order.latitude && order.longitude && (
                            <a
                                href={`https://www.google.com/maps?q=${order.latitude},${order.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 active:bg-emerald-100"
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                Buka di Maps
                            </a>
                        )}
                    </div>
                    {order.status === 'ready_for_pickup' && !order.delivery && (
                        <form onSubmit={(e) => { e.preventDefault(); form.post(`/owner/orders/${order.id}/assign-courier`); }} className="rounded-lg border border-slate-200 bg-white p-4">
                            <select value={form.data.courier_id} onChange={(e) => form.setData('courier_id', e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm">
                                {couriers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button className="mt-2 w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Assign Courier</button>
                        </form>
                    )}
                </div>
            </div>
        </>
    );
}

function statusHeadline(status: string): string {
    const headlines: Record<string, string> = {
        pending: 'Waiting for confirmation',
        confirmed: 'Order confirmed by outlet',
        preparing: 'Being prepared at outlet',
        ready_for_pickup: 'Ready for courier pickup',
        picked_up: 'Picked up by courier',
        delivering: 'En route to customer',
        completed: 'Successfully delivered',
        cancelled: 'Order cancelled',
        failed: 'Delivery failed — action required',
    };
    return headlines[status] ?? 'Processing';
}
