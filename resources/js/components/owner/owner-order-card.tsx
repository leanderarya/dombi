import { formatCurrency } from '@/lib/format';
import OrderStatusChip from './order-status-chip';

interface Props {
    order: {
        id: number;
        order_code: string;
        status: string;
        customer_name: string;
        total: number | string;
        created_at?: string;
        outlet?: { name: string } | null;
        items?: { id: number }[];
        delivery?: { courier?: { name: string } | null; status?: string; failed_reason?: string } | null;
    };
    onSelect?: () => void;
    onAssign?: () => void;
}

export default function OwnerOrderCard({ order, onSelect, onAssign }: Props) {
    const isFailed = order.status === 'failed_delivery';
    const isReadyForPickup = order.status === 'ready_for_pickup';
    const canAssign = isReadyForPickup && !order.delivery;
    const isDelivering = order.status === 'delivering' || order.status === 'picked_up';
    const hasCourier = !!order.delivery?.courier;
    const itemCount = order.items?.length ?? 0;

    return (
        <div className={`rounded-lg border bg-white p-4 ${isFailed ? 'border-l-[3px] border-l-red-500 border-t-slate-200 border-r-slate-200 border-b-slate-200' : 'border-slate-200'}`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold tabular-nums text-slate-900">{order.order_code}</span>
                <OrderStatusChip status={order.status} />
            </div>

            {/* Customer + Outlet */}
            <div className="mt-2">
                <div className="text-base font-semibold text-slate-900">{order.customer_name}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    {order.outlet?.name ?? '-'}
                </div>
            </div>

            {/* Metadata */}
            <div className="mt-3 grid grid-cols-2 gap-y-1 border-t border-slate-100 pt-3 text-xs">
                {hasCourier && (isDelivering || isFailed) ? (
                    <>
                        <div><span className="text-slate-400">Courier</span><br /><span className="font-medium text-slate-700">{order.delivery?.courier?.name}</span></div>
                        <div className="text-right"><span className="text-slate-400">Payment</span><br /><span className="font-semibold tabular-nums text-slate-900">{formatCurrency(order.total)}</span></div>
                    </>
                ) : (
                    <>
                        <div><span className="text-slate-400">Items</span><br /><span className="font-medium text-slate-700">{itemCount} Items</span></div>
                        <div className="text-right"><span className="text-slate-400">Total</span><br /><span className="font-semibold tabular-nums text-slate-900">{formatCurrency(order.total)}</span></div>
                    </>
                )}
            </div>

            {/* Courier waiting state */}
            {canAssign && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    No courier assigned
                </div>
            )}

            {/* Failed alert */}
            {isFailed && (
                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    Perlu tindakan segera
                </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex gap-2">
                <button onClick={onSelect} className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-slate-200 text-xs font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98] active:bg-slate-50">
                    Detail
                </button>
                {canAssign && onAssign && (
                    <button onClick={onAssign} className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-700 text-xs font-semibold text-white transition-all duration-150 active:scale-[0.98] active:bg-emerald-800">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Assign Courier
                    </button>
                )}
                {isFailed && (
                    <button onClick={onSelect} className="flex min-h-[44px] flex-1 items-center justify-center rounded-md border border-red-200 text-xs font-semibold text-red-700 transition-all duration-150 active:scale-[0.98] active:bg-red-50">
                        Resolve Case
                    </button>
                )}
            </div>
        </div>
    );
}
