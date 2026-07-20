import { Link } from '@inertiajs/react';
import { RotateCcw, Smartphone, Store } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import {
    getOrderStatusConfig,
    isTerminalStatus,
} from '@/lib/order-status-config';
import OrderCardShell from './order-card-shell';

interface OrderItem {
    product_name: string;
    quantity: number;
    variant_name?: string;
}

interface Props {
    order: {
        id: number;
        order_code: string;
        status: string;
        fulfillment_type?: string;
        total: number | string;
        ordered_at?: string;
        created_at?: string;
        outlet?: { id: number; name: string } | null;
        items?: OrderItem[];
        customer_address?: string;
        recovery_token?: string;
    };
}

export default function OrderHistoryCard({ order }: Props) {
    const isPickup = order.fulfillment_type !== 'delivery_dombi';
    const itemCount = order.items?.length ?? 0;
    const firstItem = order.items?.[0];
    const statusCfg = getOrderStatusConfig(order.status);
    const isDead = isTerminalStatus(order.status);

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
        >
            {/* Header: Logo + Order Type + Date + Status Badge */}
            <div className="flex items-start gap-3">
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isDead ? 'bg-gray-100' : 'bg-primary-light'}`}
                >
                    <span
                        className={`text-sm font-bold ${isDead ? 'text-gray-400' : 'text-primary'}`}
                    >
                        D
                    </span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className={`truncate text-sm font-bold ${isDead ? 'text-text-muted' : 'text-text'}`}
                        >
                            {isPickup ? 'Pick Up' : 'Delivery'}
                        </span>
                        <span className={`shrink-0 ${statusCfg.className}`}>
                            {statusCfg.label}
                        </span>
                    </div>
                    <div className="text-[11px] text-text-muted">{dateStr}</div>
                    {statusCfg.reason && (
                        <div className="mt-0.5 text-[11px] text-text-subtle">
                            {statusCfg.reason}
                        </div>
                    )}
                </div>
            </div>

            {/* Product info */}
            {firstItem && (
                <div className="mt-3 flex items-center gap-3">
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isDead ? 'bg-gray-50' : 'bg-surface-muted'}`}
                    >
                        <span
                            className={`text-lg ${isDead ? 'opacity-50' : ''}`}
                        >
                            &#129371;
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div
                            className={`truncate text-sm font-medium ${isDead ? 'text-text-muted' : 'text-text'}`}
                        >
                            {firstItem.product_name}
                        </div>
                        {itemCount > 1 && (
                            <div className="text-[11px] text-text-muted">
                                +{itemCount - 1} produk lainnya
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Dotted divider */}
            <div className="fore-divider-dotted my-3" />

            {/* Location + Via */}
            <div className="flex items-center justify-between">
                <div
                    className={`text-xs ${isDead ? 'text-text-subtle' : 'text-text-muted'}`}
                >
                    {order.outlet?.name ?? 'Outlet'}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-text-subtle">
                    {isPickup ? (
                        <Store className="h-3 w-3" />
                    ) : (
                        <Smartphone className="h-3 w-3" />
                    )}
                    <span>{isPickup ? 'via Store' : 'via Aplikasi'}</span>
                </div>
            </div>

            {/* Delivery address */}
            {!isPickup && order.customer_address && (
                <div className="mt-2 flex items-start gap-2 text-xs text-text-muted">
                    <div className="mt-0.5 h-4 w-px bg-border" />
                    <span className="line-clamp-1">
                        {order.customer_address}
                    </span>
                </div>
            )}

            {/* Solid divider */}
            <div className="my-3 h-px bg-border" />

            {/* Total + action */}
            <div className="flex items-center justify-between">
                <div
                    className={`text-sm font-bold tabular-nums ${isDead ? 'text-text-muted' : 'text-text'}`}
                >
                    {itemCount} item · {formatCurrency(order.total)}
                </div>
                {order.status === 'completed' && (
                    <Link
                        href={`/customer/orders/${order.id}/restore-cart`}
                        className="flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-1.5 text-xs font-bold text-primary active:opacity-80"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Beli Lagi
                    </Link>
                )}
                {order.status === 'expired' && (
                    <Link
                        href={`/customer/orders/${order.id}/restore-cart`}
                        className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-text-muted active:opacity-80"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Pesan Ulang
                    </Link>
                )}
            </div>
        </OrderCardShell>
    );
}
