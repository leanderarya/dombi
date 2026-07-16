import { Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Clock,
    RotateCcw,
    Shield,
    Store,
    Truck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Dialog from '@/components/ui/dialog';
import { formatCurrency, formatDate } from '@/lib/format';
import { getOrderStatusConfig } from '@/lib/order-status-config';
import OrderCardShell from './order-card-shell';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BADGE_BASE = 'rounded-full px-2.5 py-0.5 text-[11px] font-bold';

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
    const deadline = parseExpiry(expiresAt);
    const [remaining, setRemaining] = useState(() =>
        deadline ? calculateTimeRemaining(deadline.toISOString()) : null,
    );

    useEffect(() => {
        if (!deadline) {
            return;
        }

        const tick = () => {
            const r = calculateTimeRemaining(deadline.toISOString());
            setRemaining(r);

            if (r.total <= 0) {
                clearInterval(id);
            }
        };

        tick();
        const id = window.setInterval(tick, 1000);

        return () => clearInterval(id);
    }, [expiresAt]);

    return remaining;
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

                    throw new Error(
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

    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelNote, setCancelNote] = useState('');

    const cancellationReasons = [
        'Berubah pikiran',
        'Salah pesan',
        'Tidak jadi',
        'Lainnya',
    ];

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
    const displayStatus = canRetryPayment
        ? {
              label: isPaymentFailed
                  ? 'Pembayaran Gagal'
                  : 'Pembayaran Kadaluarsa',
              className: `${BADGE_BASE} bg-red-50 text-red-700`,
          }
        : hasPaymentIssue
          ? {
                label: isPaymentFailed
                    ? 'Pembayaran Gagal'
                    : 'Pembayaran Kadaluarsa',
                className: `${BADGE_BASE} bg-red-50 text-red-700`,
            }
          : isWaitingForPayment
            ? {
                  label: 'Menunggu Pembayaran',
                  className: `${BADGE_BASE} bg-amber-50 text-amber-700`,
              }
            : statusCfg;

    return (
        <>
            <OrderCardShell
                orderId={order.id}
                recoveryToken={order.recovery_token}
                status={order.status}
                clickable={false}
            >
                {/* Header: Logo + Order code + Status badge + Date */}
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                        <span className="text-sm font-bold text-primary">
                            D
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold text-text">
                                {order.order_code}
                            </span>
                            <span
                                className={`shrink-0 ${displayStatus.className}`}
                            >
                                {displayStatus.label}
                            </span>
                        </div>
                        <div className="text-[11px] text-text-muted">
                            {dateStr}
                        </div>
                        {/* Countdown — show for all pending orders with expiry (including failed payment) */}
                        {isPending && !isExpired && countdown && (
                            <div
                                className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${canRetryPayment ? 'text-red-500' : 'text-amber-600'}`}
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
                        {canRetryPayment && (
                            <div className="mt-0.5 text-[11px] text-red-600">
                                {isPaymentFailed
                                    ? 'Silakan coba bayar lagi'
                                    : 'Batas waktu pembayaran habis'}
                            </div>
                        )}
                        {/* Waiting for payment message */}
                        {isWaitingForPayment && !hasPaymentIssue && (
                            <div className="mt-0.5 text-[11px] text-amber-600">
                                Selesaikan pembayaran untuk melanjutkan
                            </div>
                        )}
                    </div>{' '}
                    {/* close flex-1 */}
                </div>{' '}
                {/* close flex items-start */}
                {/* Product — icon + name (matches history card) */}
                {firstItem && (
                    <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                            <span className="text-lg">&#129371;</span>
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-text">
                                {firstItem.product_name}
                            </div>
                            {itemCount > 1 && (
                                <div className="text-[11px] text-text-muted">
                                    +{itemCount - 1} lainnya
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Dotted divider */}
                <div className="fore-divider-dotted my-3" />
                {/* Outlet + via icon */}
                <div className="flex items-center justify-between">
                    <div className="text-xs text-text-muted">
                        {order.outlet.name}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-text-subtle">
                        {isPickup ? (
                            <Store className="h-3 w-3" />
                        ) : (
                            <Truck className="h-3 w-3" />
                        )}
                        <span>{isPickup ? 'Pickup' : 'Delivery'}</span>
                    </div>
                </div>
                {/* Solid divider */}
                <div className="my-3 h-px bg-border" />
                {/* Error + Total + Actions */}
                {cancelError && (
                    <p className="mb-2 flex items-center gap-1 text-[11px] text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {cancelError}
                    </p>
                )}
                <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-text tabular-nums">
                        {itemCount} item · {formatCurrency(order.total)}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Payment failed but order still active — retry payment */}
                        {canRetryPayment && (
                            <>
                                <button
                                    type="button"
                                    disabled={cancelLoading}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleCancelClick();
                                    }}
                                    className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-text-muted active:opacity-80 disabled:opacity-40"
                                >
                                    {cancelLoading
                                        ? 'Membatalkan...'
                                        : 'Batalkan'}
                                </button>
                                <Link
                                    href={`/customer/orders/confirm/${order.order_code}`}
                                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white active:opacity-80"
                                >
                                    Bayar Ulang
                                </Link>
                            </>
                        )}
                        {/* Payment issue but order is terminal (expired status) — restore cart */}
                        {hasPaymentIssue && !canRetryPayment && (
                            <Link
                                href={`/customer/orders/${order.id}/restore-cart`}
                                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white active:opacity-80"
                            >
                                <RotateCcw className="h-3 w-3" />
                                Coba Lagi
                            </Link>
                        )}
                        {/* Waiting for payment — show pay + cancel buttons (logged-in only) */}
                        {isWaitingForPayment && !hasPaymentIssue && (
                            <>
                                {isLoggedIn && (
                                    <button
                                        type="button"
                                        disabled={cancelLoading}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleCancelClick();
                                        }}
                                        className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-text-muted active:opacity-80 disabled:opacity-40"
                                    >
                                        {cancelLoading
                                            ? 'Membatalkan...'
                                            : 'Batalkan'}
                                    </button>
                                )}
                                <Link
                                    href={`/customer/orders/confirm/${order.order_code}`}
                                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white active:opacity-80"
                                >
                                    Bayar Sekarang
                                </Link>
                            </>
                        )}
                        {/* Pending (paid, waiting outlet) — show cancel + continue buttons (logged-in only) */}
                        {isPending &&
                            !isExpired &&
                            !hasPaymentIssue &&
                            !isWaitingForPayment && (
                                <>
                                    {isLoggedIn && (
                                        <button
                                            type="button"
                                            disabled={cancelLoading}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleCancelClick();
                                            }}
                                            className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-text-muted active:opacity-80 disabled:opacity-40"
                                        >
                                            {cancelLoading
                                                ? 'Membatalkan...'
                                                : 'Batalkan'}
                                        </button>
                                    )}
                                    <Link
                                        href={href}
                                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white active:opacity-80"
                                    >
                                        Detail Pesanan
                                    </Link>
                                </>
                            )}
                        {/* Other statuses — show track button */}
                        {!isPending && !hasPaymentIssue && (
                            <Link
                                href={href}
                                className="rounded-full border-2 border-primary px-4 py-1.5 text-xs font-bold text-primary active:opacity-80"
                            >
                                Lacak Pesanan
                            </Link>
                        )}
                    </div>
                </div>
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
                            className={`flex h-11 w-full items-center rounded-xl border px-4 text-left text-sm font-medium transition-all ${
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
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleCancelConfirm}
                    disabled={!cancelReason || cancelLoading}
                    className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                >
                    {cancelLoading ? 'Membatalkan...' : 'Batalkan Pesanan'}
                </button>
            </Dialog>

            {/* Login prompt for guests trying to cancel */}
            <Dialog
                open={requiresLogin}
                onClose={clearError}
                title="Login Diperlukan"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light">
                        <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-xs text-text-muted">
                        Anda perlu login untuk membatalkan pesanan.
                    </p>
                </div>

                <a
                    href="/oauth/google"
                    className="mt-6 flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-primary text-sm font-bold text-white active:bg-primary-hover"
                >
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

                <button
                    type="button"
                    onClick={clearError}
                    className="mt-3 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-text-muted active:text-text"
                >
                    Batal
                </button>
            </Dialog>
        </>
    );
}
