import { Head, Link } from '@inertiajs/react';

import DeliverySlaBadge from '@/components/operations/delivery-sla-badge';
import DeliveryTimeline from '@/components/operations/delivery-timeline';
import SectionCard from '@/components/ui/section-card';
import StatusBadge from '@/components/ui/status-badge';
import OutletLayout from '@/layouts/outlet-layout';
import { formatCurrency, formatDeliveryAge } from '@/lib/format';
import { getDeliveryStatus } from '@/lib/status-labels';

export default function OutletDeliveryShow({ delivery }: any) {
    const order = delivery.order;

    return (
        <OutletLayout title={delivery.order_code} backHref="/outlet/deliveries">
            <Head title={delivery.order_code} />

            {/* Status Strip */}
            <div className="mt-4 mb-4 flex items-center justify-between">
                <div className="text-sm text-text-muted">Kurir: {delivery.courier?.name ?? '-'}</div>
                <div className="flex items-center gap-2">
                    <StatusBadge status={delivery.status} />
                    {delivery.sla_health && <DeliverySlaBadge health={delivery.sla_health} />}
                </div>
            </div>

            {/* Customer Info */}
            <SectionCard label="Customer">
                <div className="mt-2 space-y-1.5 text-sm">
                    <div className="font-medium">{delivery.customer_name}</div>
                    <div className="text-text-muted">{delivery.customer_address}</div>
                    {delivery.customer_phone && <div className="text-text-muted">{delivery.customer_phone}</div>}
                    {delivery.delivery_age != null && (
                        <div>
                            <span className="text-text-muted">Usia:</span>{' '}
                            <span className={delivery.delivery_age > 60 ? 'font-medium text-red-600' : ''}>
                                {formatDeliveryAge(delivery.delivery_age)}
                            </span>
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Items */}
            <SectionCard label="Pesanan">
                <div className="mt-2 space-y-2">
                    {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <div>
                                <span className="font-medium">{item.product_name}</span>
                                <span className="ml-2 text-text-muted">x{item.quantity}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex justify-between border-t pt-3 text-sm font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                </div>
            </SectionCard>

            {/* Failed Reason */}
            {delivery.failed_reason && (
                <SectionCard>
                    <div className="flex items-center gap-2">
                        <StatusBadge variant="danger" size="sm">Gagal</StatusBadge>
                        <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">Alasan Gagal</span>
                    </div>
                    <p className="mt-1 text-sm text-text">{delivery.failed_reason}</p>
                </SectionCard>
            )}

            {/* Resolution */}
            {delivery.resolution_status && (
                <SectionCard>
                    <div className="flex items-center gap-2">
                        <StatusBadge variant="warning" size="sm">Resolusi</StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-text">{getDeliveryStatus(delivery.resolution_status).label}</p>
                    {delivery.resolution_notes && <p className="mt-1 text-xs text-text-muted">{delivery.resolution_notes}</p>}
                </SectionCard>
            )}

            {/* Timeline */}
            <SectionCard label="Timeline">
                <div className="mt-2">
                    <DeliveryTimeline histories={delivery.status_histories ?? []} />
                </div>
            </SectionCard>
        </OutletLayout>
    );
}
