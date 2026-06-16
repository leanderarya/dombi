import { Link } from '@inertiajs/react';
import DeliveryStatusBadge from '@/components/delivery-status-badge';
import { formatCurrency, formatDeliveryAge, formatDistance } from '@/lib/format';
import DeliverySlaBadge from './delivery-sla-badge';

interface DeliveryCardItem {
    id: number;
    order_code: string;
    customer_name: string;
    outlet?: { id: number; name: string } | null;
    courier?: { id: number; name: string } | null;
    total?: number;
    distance_km?: number | null;
    status: string;
    assigned_at?: string | null;
    delivery_age?: number | null;
    sla_health?: string;
    failed_reason?: string | null;
    type: 'order' | 'delivery';
}

interface Props {
    item: DeliveryCardItem;
    onAssignCourier?: (orderId: number) => void;
    onResolve?: (deliveryId: number) => void;
}

export default function DeliveryCard({ item, onAssignCourier, onResolve }: Props) {
    const href = item.type === 'delivery' ? `/owner/deliveries/${item.id}` : `/owner/orders/${item.id}`;
    const isFailed = ['failed', 'retry_delivery', 'returned_to_outlet'].includes(item.status);
    const needsAssignment = item.status === 'waiting_assignment';

    return (
        <div className={`rounded-lg border bg-white p-3 transition-all duration-150 active:scale-[0.98] ${isFailed ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
            <Link href={href} className="block">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tabular-nums text-slate-900">{item.order_code}</span>
                            {item.sla_health && <DeliverySlaBadge health={item.sla_health} />}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{item.customer_name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">{item.outlet?.name ?? '-'}</div>
                    </div>
                    <DeliveryStatusBadge status={item.status} />
                </div>

                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                    {item.distance_km != null && (
                        <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            {formatDistance(item.distance_km)}
                        </span>
                    )}
                    {item.total != null && (
                        <span>{formatCurrency(item.total)}</span>
                    )}
                    {item.delivery_age != null && (
                        <span className={`font-medium ${item.delivery_age > 60 ? 'text-red-600' : 'text-slate-500'}`}>
                            {formatDeliveryAge(item.delivery_age)}
                        </span>
                    )}
                </div>

                {item.courier && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">
                            {item.courier.name.charAt(0)}
                        </div>
                        <span className="text-slate-600">{item.courier.name}</span>
                    </div>
                )}

                {item.failed_reason && (
                    <div className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                        {item.failed_reason}
                    </div>
                )}
            </Link>

            {/* Actions */}
            <div className="mt-2 flex gap-2">
                {needsAssignment && onAssignCourier && (
                    <button
                        onClick={(e) => {
 e.preventDefault(); onAssignCourier(item.id); 
}}
                        className="flex min-h-[36px] flex-1 items-center justify-center rounded-md bg-emerald-700 text-xs font-semibold text-white active:bg-emerald-800"
                    >
                        Assign Kurir
                    </button>
                )}
                {isFailed && onResolve && (
                    <button
                        onClick={(e) => {
 e.preventDefault(); onResolve(item.id); 
}}
                        className="flex min-h-[36px] flex-1 items-center justify-center rounded-md bg-amber-600 text-xs font-semibold text-white active:bg-amber-700"
                    >
                        Resolve
                    </button>
                )}
            </div>
        </div>
    );
}
