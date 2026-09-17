import { Link, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Clock,
    Package,
    RefreshCw,
    RotateCcw,
    Shield,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';
import OrderItemRow from '@/components/ui/order-item-row';
import OrderMetaRow from '@/components/ui/order-meta-row';
import OrderTotalRow from '@/components/ui/order-total-row';
import StatusBadge from '@/components/ui/status-badge';
import { getActiveRefundPresentation } from '@/lib/active-order-card-state';
import type { RefundBadge } from '@/lib/active-order-card-state';
import { formatCurrency, formatDate } from '@/lib/format';
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
/*  Hook: cancel order                                                 */
/* ------------------------------------------------------------------ */

function useCancelOrder() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requiresLogin, setRequiresLogin] = useState(false);

    const cancel = useCallback(
        async (orderId: number, reason: string, note?: string) => {
            setLoading(true);
            setError(null);
            setRequiresLogin(false);

            try {
                const csrf =
                    document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute('content') ?? '';

                const res = await fetch(`/customer/orders/${orderId}/cancel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': csrf,
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ reason, note: note ?? '' }),
                });

                if (res.status === 401) {
                    setRequiresLogin(true);
                    setLoading(false);

                    return;
                }

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    const fieldErrors = data?.errors
                        ? Object.values(data.errors).flat()
                        : [];

                    throw new Error(
                        fieldErrors[0] ??
                            data?.message ??
                            `Gagal membatalkan pesanan (${res.status})`,
                    );
                }

                window.location.reload();
            } catch (err: any) {
                setError(err?.message ?? 'Terjadi kesalahan');
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    return {
        cancel,
        loading,
        error,
        requiresLogin,
        clearError: () => {
            setError(null);
            setRequiresLogin(false);
        },
    };
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
        cancellation_reasons?: string[];
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
    const isPickup = order.fulfillment_type === 'pickup';
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

    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelNote, setCancelNote] = useState('');

    const cancellationReasons = order.cancellation_reasons ?? [];

    const {
        cancel,
        loading: cancelLoading,
        error: cancelError,
        requiresLogin,
        clearError,
    } = useCancelOrder();

    const handleCancelClick = () => {
        clearError();
        setCancelReason('');
        setCancelNote('');
        setCancelDialogOpen(true);
    };

    const handleCancelConfirm = () => {
        if (!cancelReason) {
            return;
        }

        cancel(
            order.id,
            cancelReason,
            cancelReason === 'Lainnya' ? cancelNote : undefined,
        );
        setCancelDialogOpen(false);
    };

    const statusCfg = getOrderStatusConfig(order.status);

    const href = isLoggedIn
        ? `/customer/orders/${order.id}`
        : `/track/${order.recovery_token}`;

    const firstItem = order.items?.[0];
    const itemCount = order.items?.length ?? 0;
    const dateStr = order.created_at ? formatDate(order.created_at) : '';

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
        <>
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
                            <span className="truncate font-heading text-[15px] font-extrabold text-text">
                                {isPickup ? 'Pick Up' : 'Delivery'}
                            </span>
                            <StatusBadge
                                variant={displayStatus.variant}
                                size="sm"
                                className="shrink-0"
                            >
                                {displayStatus.label}
                            </StatusBadge>
                        </div>
                        <div className="text-[11px] text-text-muted">
                            {dateStr}
                        </div>
                        {refundPresentation.active && (
                            <div
                                className={`flex items-center gap-1.5 text-[11px] font-semibold ${refundPresentation.detailClassName}`}
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
                                    className={`flex items-center gap-1.5 text-[11px] ${canRetryPayment ? 'text-danger' : 'text-warning-text'}`}
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
                        {canRetryPayment &&
                            !refundPresentation.suppressActions && (
                                <div className="text-[11px] text-danger-text">
                                    {isPaymentFailed
                                        ? 'Silakan coba bayar lagi'
                                        : 'Batas waktu pembayaran habis'}
                                </div>
                            )}
                        {/* Waiting for payment message */}
                        {isWaitingForPayment &&
                            !hasPaymentIssue &&
                            !refundPresentation.suppressActions && (
                                <div className="text-[11px] text-warning-text">
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
                    secondary={isPickup ? 'via Store' : 'via Aplikasi'}
                />

                {/* Total + actions */}
                {cancelError && (
                    <p className="flex items-center gap-1 text-caption text-danger-text">
                        <AlertCircle className="h-3 w-3" />
                        {cancelError}
                    </p>
                )}
                <OrderTotalRow
                    label={`${itemCount} item · ${formatCurrency(order.total)}`}
                >
                    {!refundPresentation.suppressActions && (
                        <div className="flex items-center gap-2">
                            {/* Payment failed but order still active — retry payment */}
                            {canRetryPayment && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={cancelLoading}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleCancelClick();
                                        }}
                                    >
                                        {cancelLoading
                                            ? 'Membatalkan...'
                                            : 'Batalkan'}
                                    </Button>
                                    <Button asChild variant="primary" size="sm">
                                        <Link
                                            href={`/customer/orders/confirm/${order.order_code}`}
                                        >
                                            Bayar Ulang
                                        </Link>
                                    </Button>
                                </>
                            )}
                            {/* Payment issue but order is terminal (expired status) — restore cart */}
                            {hasPaymentIssue && !canRetryPayment && (
                                <Button asChild variant="primary" size="sm">
                                    <Link
                                        href={`/customer/orders/${order.id}/restore-cart`}
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Coba Lagi
                                    </Link>
                                </Button>
                            )}
                            {/* Waiting for payment — show pay + cancel buttons (logged-in only) */}
                            {isWaitingForPayment && !hasPaymentIssue && (
                                <>
                                    {isLoggedIn && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={cancelLoading}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleCancelClick();
                                            }}
                                        >
                                            {cancelLoading
                                                ? 'Membatalkan...'
                                                : 'Batalkan'}
                                        </Button>
                                    )}
                                    <Button asChild variant="primary" size="sm">
                                        <Link
                                            href={`/customer/orders/confirm/${order.order_code}`}
                                        >
                                            Bayar Sekarang
                                        </Link>
                                    </Button>
                                </>
                            )}
                            {/* Pending (paid, waiting outlet) — show cancel + continue buttons (logged-in only) */}
                            {isPending &&
                                !isExpired &&
                                !hasPaymentIssue &&
                                !isWaitingForPayment && (
                                    <>
                                        {isLoggedIn && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={cancelLoading}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleCancelClick();
                                                }}
                                            >
                                                {cancelLoading
                                                    ? 'Membatalkan...'
                                                    : 'Batalkan'}
                                            </Button>
                                        )}
                                        <Button
                                            asChild
                                            variant="primary"
                                            size="sm"
                                        >
                                            <Link href={href}>
                                                Detail Pesanan
                                            </Link>
                                        </Button>
                                    </>
                                )}
                            {/* Other statuses — show track button */}
                            {!isPending && !hasPaymentIssue && (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={href}>Lacak Pesanan</Link>
                                </Button>
                            )}
                        </div>
                    )}
                </OrderTotalRow>
            </OrderCardShell>

            {/* Cancel Reason Dialog */}
            <Dialog
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                title="Batalkan Pesanan"
            >
                <p className="text-sm text-text-muted">
                    Pilih alasan pembatalan.
                </p>

                <div className="mt-4 space-y-2">
                    {cancellationReasons.map((reason: string) => (
                        <button
                            key={reason}
                            type="button"
                            onClick={() => setCancelReason(reason)}
                            className={`flex min-h-11 w-full items-center rounded-control border px-4 text-left text-sm font-medium transition-all ${
                                cancelReason === reason
                                    ? 'border-primary bg-primary-light text-primary'
                                    : 'border-border text-text active:opacity-80'
                            }`}
                        >
                            {reason}
                        </button>
                    ))}
                </div>

                {cancelReason === 'Lainnya' && (
                    <div className="mt-3">
                        <textarea
                            value={cancelNote}
                            onChange={(e) => setCancelNote(e.target.value)}
                            placeholder="Jelaskan alasan pembatalan..."
                            rows={2}
                            className="w-full rounded-control border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                )}

                {cancelError && (
                    <p className="mt-2 text-xs text-danger-text">
                        {cancelError}
                    </p>
                )}

                <Button
                    type="button"
                    variant="danger"
                    className="mt-4 w-full"
                    onClick={handleCancelConfirm}
                    disabled={
                        !cancelReason ||
                        cancelLoading ||
                        (cancelReason === 'Lainnya' && cancelNote.trim() === '')
                    }
                >
                    {cancelLoading ? 'Membatalkan...' : 'Batalkan Pesanan'}
                </Button>
            </Dialog>

            {/* Login prompt for guests trying to cancel */}
            <Dialog
                open={requiresLogin}
                onClose={clearError}
                title="Login Diperlukan"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-card bg-primary-light">
                        <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-xs text-text-muted">
                        Anda perlu login untuk membatalkan pesanan.
                    </p>
                </div>

                <Button asChild variant="primary" className="mt-6 w-full">
                    <a href="/oauth/google">
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Masuk dengan Google
                    </a>
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 w-full"
                    onClick={clearError}
                >
                    Batal
                </Button>
            </Dialog>
        </>
    );
}
