import { Link, usePage } from '@inertiajs/react';
import { Clock, Package, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import OrderItemRow from '@/components/ui/order-item-row';
import OrderMetaRow from '@/components/ui/order-meta-row';
import OrderTotalRow from '@/components/ui/order-total-row';
import StatusBadge from '@/components/ui/status-badge';
import { getActiveRefundPresentation } from '@/lib/active-order-card-state';
import type { RefundBadge } from '@/lib/active-order-card-state';
import { formatCurrency, formatRelativeOrderDate } from '@/lib/format';
import { fulfillmentLabel, fulfillmentVia } from '@/lib/order-fulfillment';
import { getOrderStatusConfig } from '@/lib/order-status-config';
import OrderCardShell from './order-card-shell';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function pad(n: number): string {
    return n.toString().padStart(2, '0');
}

function parseExpiry(raw: string | null | undefined): Date | null {
    if (!raw) {
        return null;
    }

    const d = new Date(raw);

    return Number.isNaN(d.getTime()) ? null : d;
}

function calculateTimeRemaining(expiresAt: string): {
    minutes: number;
    seconds: number;
    total: number;
} {
    const diff = new Date(expiresAt).getTime() - Date.now();

    if (diff <= 0) {
        return { minutes: 0, seconds: 0, total: 0 };
    }

    return {
        minutes: Math.floor(diff / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        total: diff,
    };
}

function formatTimeRemaining(expiresAt: string): string {
    const { minutes, seconds, total } = calculateTimeRemaining(expiresAt);

    if (total <= 0) {
        return 'Kadaluarsa';
    }

    return `${pad(minutes)}:${pad(seconds)}`;
}

/* ------------------------------------------------------------------ */
/*  Hook: countdown                                                    */
/* ------------------------------------------------------------------ */

function useCountdown(expiresAt: string | null | undefined) {
    const deadlineIso = parseExpiry(expiresAt)?.toISOString() ?? null;
    const [remaining, setRemaining] = useState(() =>
        deadlineIso ? calculateTimeRemaining(deadlineIso) : null,
    );

    useEffect(() => {
        if (!deadlineIso) {
            return;
        }

        const tick = () => {
            const r = calculateTimeRemaining(deadlineIso);
            setRemaining(r);

            if (r.total <= 0) {
                clearInterval(id);
            }
        };

        tick();
        const id = window.setInterval(tick, 1000);

        return () => clearInterval(id);
    }, [deadlineIso]);

    return deadlineIso ? remaining : null;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type OrderItem = {
    product_name: string;
    quantity: number;
};

type Props = {
    order: {
        id: number;
        order_code: string;
        status: string;
        payment_status: string;
        fulfillment_type: 'pickup' | 'delivery';
        total: number;
        created_at: string;
        confirmation_expires_at: string | null;
        recovery_token: string;
        outlet: { id: number; name: string };
        items: OrderItem[];
        refund_badge?: RefundBadge | null;
    };
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ActiveOrderCard({ order }: Props) {
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;

    const countdown = useCountdown(order.confirmation_expires_at);
    const isExpired = countdown !== null && countdown.total <= 0;
    const isPending = order.status === 'pending_confirmation';
    const isPaymentFailed = order.payment_status === 'failed';
    const isPaymentExpired = order.payment_status === 'expired';
    const isPaymentPending = order.payment_status === 'pending';
    const isPaymentNotStarted = !order.payment_status && isPending;
    const hasPaymentIssue = isPaymentFailed || isPaymentExpired;
    // Payment failed but order still active — customer can retry
    const canRetryPayment = hasPaymentIssue && isPending;
    // Unpaid non-COD order waiting for payment (not yet paid)
    const isWaitingForPayment =
        isPending &&
        (isPaymentPending || isPaymentNotStarted) &&
        order.payment_status !== 'paid';
    const refundPresentation = getActiveRefundPresentation(
        order.refund_badge ?? null,
    );

    const statusCfg = getOrderStatusConfig(order.status);

    const href = isLoggedIn
        ? `/customer/orders/${order.id}`
        : `/track/${order.recovery_token}`;

    const firstItem = order.items?.[0];
    const itemCount = order.items?.length ?? 0;
    const dateStr = order.created_at
        ? formatRelativeOrderDate(order.created_at)
        : '';

    // Override status config for payment issues and pending payment
    const displayStatus = refundPresentation.active
        ? { label: refundPresentation.primaryLabel, variant: 'info' as const }
        : canRetryPayment
          ? {
                label: isPaymentFailed
                    ? 'Pembayaran Gagal'
                    : 'Pembayaran Kadaluarsa',
                variant: 'danger' as const,
            }
          : hasPaymentIssue
            ? {
                  label: isPaymentFailed
                      ? 'Pembayaran Gagal'
                      : 'Pembayaran Kadaluarsa',
                  variant: 'danger' as const,
              }
            : isWaitingForPayment
              ? { label: 'Menunggu Pembayaran', variant: 'warning' as const }
              : statusCfg;

    return (
        <OrderCardShell
            orderId={order.id}
            recoveryToken={order.recovery_token}
            status={order.status}
            clickable={refundPresentation.forceClickable ? true : undefined}
        >
            {/* Header: Mark + Fulfillment + Status badge + Date */}
            <div className="flex items-start gap-3">
                <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-primary-light">
                    <span className="font-heading text-lg font-extrabold text-primary">
                        D
                    </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-heading text-[15px] font-extrabold text-text">
                            {fulfillmentLabel(order.fulfillment_type)}
                        </span>
                        <StatusBadge
                            variant={displayStatus.variant}
                            size="md"
                            className="shrink-0"
                        >
                            {displayStatus.label}
                        </StatusBadge>
                    </div>
                    <div className="text-caption text-text-muted">
                        {dateStr}
                    </div>
                    {refundPresentation.active && (
                        <div
                            className={`flex items-center gap-1.5 text-caption font-semibold ${refundPresentation.detailClassName}`}
                        >
                            <RefreshCw className="h-3 w-3 shrink-0" />
                            <span>{refundPresentation.detailLabel}</span>
                        </div>
                    )}
                    {/* Countdown — show for all pending orders with expiry (including failed payment) */}
                    {isPending &&
                        !isExpired &&
                        countdown &&
                        !refundPresentation.suppressActions && (
                            <div
                                className={`flex items-center gap-1.5 text-caption ${canRetryPayment ? 'text-danger' : 'text-warning-text'}`}
                            >
                                <Clock className="h-3 w-3 shrink-0" />
                                <span className="font-mono">
                                    {formatTimeRemaining(
                                        order.confirmation_expires_at!,
                                    )}
                                </span>
                                <span className="text-text-subtle">
                                    {canRetryPayment
                                        ? 'waktu tersisa untuk bayar ulang'
                                        : 'menit lagi'}
                                </span>
                            </div>
                        )}
                    {/* Payment issue message */}
                    {canRetryPayment && !refundPresentation.suppressActions && (
                        <div className="text-caption text-danger-text">
                            {isPaymentFailed
                                ? 'Silakan coba bayar lagi'
                                : 'Batas waktu pembayaran habis'}
                        </div>
                    )}
                    {/* Waiting for payment message */}
                    {isWaitingForPayment &&
                        !hasPaymentIssue &&
                        !refundPresentation.suppressActions && (
                            <div className="text-caption text-warning-text">
                                Selesaikan pembayaran untuk melanjutkan
                            </div>
                        )}
                </div>
            </div>

            {/* Divider — the kanvas separates the header from the item row */}
            <div className="h-px bg-border" />
            {/* Product — icon + name (matches history card) */}
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

            {/* Outlet + via */}
            <OrderMetaRow
                primary={order.outlet.name}
                secondary={fulfillmentVia(order.fulfillment_type)}
            />

            {/* Total + action. The kanvas draws exactly one solid action
                    per card and no cancel button — cancelling lives on the
                    order detail screen, where there is room to explain it. */}
            <OrderTotalRow
                label={`${itemCount} item · ${formatCurrency(order.total)}`}
            >
                {!refundPresentation.suppressActions && (
                    <>
                        {/* Payment failed but order still active — retry payment */}
                        {canRetryPayment && (
                            <Button asChild variant="primary" size="sm">
                                <Link
                                    href={`/customer/orders/confirm/${order.order_code}`}
                                >
                                    Bayar Ulang
                                </Link>
                            </Button>
                        )}
                        {/* Payment issue but order is terminal (expired status) — restore cart */}
                        {hasPaymentIssue && !canRetryPayment && (
                            <Button asChild variant="primary" size="sm">
                                <Link
                                    href={`/customer/orders/${order.id}/restore-cart`}
                                >
                                    Coba Lagi
                                </Link>
                            </Button>
                        )}
                        {/* Waiting for payment — pay now */}
                        {isWaitingForPayment && !hasPaymentIssue && (
                            <Button asChild variant="primary" size="sm">
                                <Link
                                    href={`/customer/orders/confirm/${order.order_code}`}
                                >
                                    Bayar Sekarang
                                </Link>
                            </Button>
                        )}
                        {/* Pending (paid, waiting outlet) — open the detail */}
                        {isPending &&
                            !isExpired &&
                            !hasPaymentIssue &&
                            !isWaitingForPayment && (
                                <Button asChild variant="primary" size="sm">
                                    <Link href={href}>Detail Pesanan</Link>
                                </Button>
                            )}
                        {/* Other statuses — track */}
                        {!isPending && !hasPaymentIssue && (
                            <Button asChild variant="primary" size="sm">
                                <Link href={href}>Lihat Detail</Link>
                            </Button>
                        )}
                    </>
                )}
            </OrderTotalRow>
        </OrderCardShell>
    );
}
