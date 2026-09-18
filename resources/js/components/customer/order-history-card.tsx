import { Link } from '@inertiajs/react';
import { Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrderItemRow from '@/components/ui/order-item-row';
import OrderMetaRow from '@/components/ui/order-meta-row';
import OrderTotalRow from '@/components/ui/order-total-row';
import StatusBadge from '@/components/ui/status-badge';
import { formatCurrency, formatDate } from '@/lib/format';
import {
    fulfillmentLabel,
    fulfillmentVia,
    isPickupOrder,
} from '@/lib/order-fulfillment';
import { getOrderStatusConfig } from '@/lib/order-status-config';
import OrderCardShell from './order-card-shell';

interface OrderItem {
    product_name: string;
    quantity: number;
    variant_name?: string;
}

interface RefundBadge {
    payment_status: string;
    status_label: string;
    queue_state: string;
}

interface Props {
    order: {
        id: number;
        order_code: string;
        status: string;
        payment_status?: string;
        fulfillment_type?: string;
        total: number | string;
        ordered_at?: string;
        created_at?: string;
        outlet?: { id: number; name: string } | null;
        items?: OrderItem[];
        customer_address?: string;
        recovery_token?: string;
        refund_badge?: RefundBadge | null;
        refund?: RefundBadge | null;
    };
}

const REFUND_BADGE_VARIANT: Record<
    string,
    'warning' | 'info' | 'danger' | 'success'
> = {
    awaiting_customer: 'warning',
    awaiting_guest: 'warning',
    ready: 'info',
    in_progress: 'info',
    action_required: 'danger',
    completed: 'success',
    rejected: 'danger',
};

export default function OrderHistoryCard({ order }: Props) {
    const isPickup = isPickupOrder(order.fulfillment_type);
    const itemCount = order.items?.length ?? 0;
    const firstItem = order.items?.[0];
    const statusCfg = getOrderStatusConfig(order.status);
    const refundBadge = order.refund_badge ?? order.refund ?? null;

    const dateStr = order.ordered_at
        ? formatDate(order.ordered_at)
        : order.created_at
          ? formatDate(order.created_at)
          : '';

    return (
        <OrderCardShell
            orderId={order.id}
            recoveryToken={order.recovery_token}
            status={order.status}
            clickable={true}
        >
            {/* Refund badge row */}
            {refundBadge && (
                <div className="flex">
                    <StatusBadge
                        variant={
                            REFUND_BADGE_VARIANT[refundBadge.queue_state] ??
                            'warning'
                        }
                        size="sm"
                    >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        {refundBadge.status_label}
                    </StatusBadge>
                </div>
            )}

            {/* Header: Mark + Fulfillment + Status badge + Date. The kanvas
                draws the mark and title at full strength in every frame,
                including `Kadaluarsa` and `Dibatalkan Customer`, so terminal
                cards carry no dimming. */}
            <div className="flex items-start gap-3">
                <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-primary-light">
                    <span className="font-heading text-lg font-extrabold text-primary">
                        D
                    </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-heading text-[15px] font-extrabold text-text">
                            {fulfillmentLabel(order.fulfillment_type)}
                        </span>
                        <StatusBadge
                            variant={statusCfg.variant}
                            size="md"
                            className="shrink-0"
                        >
                            {statusCfg.label}
                        </StatusBadge>
                    </div>
                    <div className="text-caption text-text-muted">
                        {dateStr}
                    </div>
                    {statusCfg.reason && (
                        <div className="text-caption text-text-muted">
                            {statusCfg.reason}
                        </div>
                    )}
                </div>
            </div>

            {/* Divider — the kanvas separates the header from the item row */}
            <div className="h-px bg-border" />

            {/* Product info */}
            {firstItem && (
                <OrderItemRow
                    icon={Package}
                    title={firstItem.product_name}
                    subtitle={
                        itemCount > 1
                            ? `+${itemCount - 1} produk lainnya`
                            : null
                    }
                />
            )}

            {/* Location + Via */}
            <OrderMetaRow
                primary={order.outlet?.name ?? 'Outlet'}
                secondary={fulfillmentVia(order.fulfillment_type)}
            />

            {/* Delivery address */}
            {!isPickup && order.customer_address && (
                <div className="mt-2 flex items-start gap-2 text-xs text-text-muted">
                    <div className="mt-0.5 h-4 w-px bg-border" />
                    <span className="line-clamp-1">
                        {order.customer_address}
                    </span>
                </div>
            )}

            {/* Total + action. The kanvas draws one action per card and no
                icon inside it: `completed` gets the brand-outlined `Beli Lagi`,
                every other terminal status — `Kadaluarsa` and
                `Dibatalkan Customer` included — the solid `Pesan Ulang`.
                Deliberately not `TERMINAL_STATUSES`: that set omits
                `failed_delivery`, which is also reorderable history. */}
            <OrderTotalRow
                label={`${itemCount} item · ${formatCurrency(order.total)}`}
            >
                {order.status === 'completed' ? (
                    <Button asChild variant="secondary-brand" size="sm">
                        <Link
                            href={`/customer/orders/${order.id}/restore-cart`}
                        >
                            Beli Lagi
                        </Link>
                    </Button>
                ) : (
                    <Button asChild variant="primary" size="sm">
                        <Link
                            href={`/customer/orders/${order.id}/restore-cart`}
                        >
                            Pesan Ulang
                        </Link>
                    </Button>
                )}
            </OrderTotalRow>
        </OrderCardShell>
    );
}
