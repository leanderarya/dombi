import { Link } from '@inertiajs/react';
import { Smartphone, Store } from 'lucide-react';
import { isTerminalOrder } from '@/lib/customer-status';
import { formatCurrency, formatDate } from '@/lib/format';

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
    };
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    completed: { label: 'Selesai', className: 'fore-badge-success' },
    cancelled_by_customer: { label: 'Dibatalkan', className: 'rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700' },
    cancelled_by_outlet: { label: 'Dibatalkan', className: 'rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700' },
    rejected_by_outlet: { label: 'Ditolak', className: 'rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700' },
    failed_delivery: { label: 'Gagal', className: 'rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700' },
    expired: { label: 'Kadaluarsa', className: 'rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600' },
};

export default function OrderHistoryCard({ order }: Props) {
    const isTerminal = isTerminalOrder(order.status);
    const isPickup = order.fulfillment_type !== 'delivery_dombi';
    const itemCount = order.items?.length ?? 0;
    const firstItem = order.items?.[0];
    const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, className: 'fore-badge-success' };
    const dateStr = order.ordered_at
        ? formatDate(order.ordered_at)
        : order.created_at
            ? formatDate(order.created_at)
            : '';

    return (
        <Link
            href={`/customer/orders/${order.id}`}
            className="block rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] active:opacity-80"
        >
            {/* Header: Logo + Order Type + Date + Status Badge */}
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                    <span className="text-sm font-bold text-primary">D</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text">{isPickup ? 'Pick Up' : 'Delivery'}</span>
                    </div>
                    <div className="text-[11px] text-text-muted">{dateStr}</div>
                </div>
                <span className={statusInfo.className}>{statusInfo.label}</span>
            </div>

            {/* Product info */}
            {firstItem && (
                <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                        <span className="text-lg">&#129371;</span>
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text">{firstItem.product_name}</div>
                        {itemCount > 1 && (
                            <div className="text-[11px] text-text-muted">+{itemCount - 1} produk lainnya</div>
                        )}
                    </div>
                </div>
            )}

            {/* Dotted divider */}
            <div className="fore-divider-dotted my-3" />

            {/* Location + Via */}
            <div className="flex items-center justify-between">
                <div className="text-xs text-text-muted">
                    {order.outlet?.name ?? 'Outlet'}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-text-subtle">
                    {isPickup ? <Store className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                    <span>{isPickup ? 'via Store' : 'via Aplikasi'}</span>
                </div>
            </div>

            {/* Delivery address — shown only for delivery */}
            {!isPickup && order.customer_address && (
                <div className="mt-2 flex items-start gap-2 text-xs text-text-muted">
                    <div className="mt-0.5 h-4 w-px bg-border" />
                    <span className="line-clamp-1">{order.customer_address}</span>
                </div>
            )}

            {/* Solid divider */}
            <div className="my-3 h-px bg-border" />

            {/* Total + Beli Lagi */}
            <div className="flex items-center justify-between">
                <div className="text-sm font-bold tabular-nums text-text">
                    {itemCount} item · {formatCurrency(order.total)}
                </div>
                {isTerminal && order.status === 'completed' && (
                    <span className="rounded-full border-2 border-primary px-4 py-1.5 text-xs font-bold text-primary">
                        Beli Lagi
                    </span>
                )}
            </div>
        </Link>
    );
}
