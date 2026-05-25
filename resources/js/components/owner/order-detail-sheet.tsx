import { useEffect, useState } from 'react';
import OrderStatusChip from './order-status-chip';
import ResolveDeliverySheet from './resolve-delivery-sheet';
import { formatCurrency, formatDate } from '@/lib/format';

interface Props {
    order: any;
    open: boolean;
    onClose: () => void;
}

export default function OrderDetailSheet({ order, open, onClose }: Props) {
    const [resolveOpen, setResolveOpen] = useState(false);

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            setResolveOpen(false);
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open || !order) return null;

    const isFailed = order.status === 'failed';
    const canResolve = order.delivery && ['failed', 'retry_delivery', 'returned_to_outlet'].includes(order.delivery.status ?? '');
    const itemCount = order.items?.length ?? 0;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/40" onClick={onClose} />

                {/* Sheet */}
                <div className="relative w-full max-w-lg animate-[slideUp_200ms_ease-out] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                    {/* Drag handle */}
                    <div className="sticky top-0 z-10 flex justify-center bg-white pt-3 pb-2 rounded-t-2xl">
                        <div className="h-1 w-12 rounded-full bg-slate-300" />
                    </div>

                    <div className="px-4 pb-4">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-bold tabular-nums text-slate-900">{order.order_code}</div>
                                <div className="mt-0.5 text-xs text-slate-500">{formatDate(order.created_at)}</div>
                            </div>
                            <OrderStatusChip status={order.status} />
                        </div>

                        {/* Status Hero */}
                        {isFailed && order.delivery?.failed_reason && (
                            <div className="mt-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">Failure Reason</div>
                                <div className="mt-1 text-xs font-medium text-red-800">{order.delivery.failed_reason}</div>
                            </div>
                        )}

                        {/* Customer */}
                        <div className="mt-3 rounded-lg border border-slate-200 p-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                    {order.customer_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{order.customer_name}</div>
                                    <div className="text-xs text-slate-500">{order.customer_phone}</div>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">{order.customer_address}</div>
                        </div>

                        {/* Courier */}
                        {order.delivery?.courier && (
                            <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                                    {order.delivery.courier.name?.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Courier</div>
                                    <div className="text-sm font-semibold text-slate-900">{order.delivery.courier.name}</div>
                                </div>
                            </div>
                        )}

                        {/* Outlet + Items */}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg border border-slate-200 p-2.5">
                                <div className="text-slate-400">Outlet</div>
                                <div className="mt-0.5 font-medium text-slate-900">{order.outlet?.name ?? '-'}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 p-2.5">
                                <div className="text-slate-400">Items</div>
                                <div className="mt-0.5 font-medium text-slate-900">{itemCount} items · {formatCurrency(order.total)}</div>
                            </div>
                        </div>

                        {/* Manifest */}
                        {order.items && order.items.length > 0 && (
                            <div className="mt-3 rounded-lg border border-slate-200 p-3">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Manifest</div>
                                <div className="mt-2 space-y-1.5">
                                    {order.items.slice(0, 4).map((item: any) => (
                                        <div key={item.id} className="flex items-center justify-between text-xs">
                                            <span className="text-slate-700">{item.product_name} <span className="text-slate-400">x{item.quantity}</span></span>
                                            <span className="tabular-nums text-slate-900">{formatCurrency(item.subtotal)}</span>
                                        </div>
                                    ))}
                                    {order.items.length > 4 && <div className="text-[10px] text-slate-400">+{order.items.length - 4} more items</div>}
                                </div>
                            </div>
                        )}

                        {/* Inventory State */}
                        {isFailed && (
                            <div className="mt-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                                📦 Reserved stock masih aktif — menunggu resolusi
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-4 space-y-2">
                            {canResolve && (
                                <button
                                    onClick={() => setResolveOpen(true)}
                                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 text-sm font-bold text-white transition-all duration-150 active:scale-[0.98] active:bg-emerald-800"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Resolve Issue
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 transition-all duration-150 active:scale-[0.98] active:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nested Resolve Sheet */}
            {order.delivery && (
                <ResolveDeliverySheet
                    delivery={{ ...order.delivery, order }}
                    open={resolveOpen}
                    onClose={() => setResolveOpen(false)}
                />
            )}
        </>
    );
}
