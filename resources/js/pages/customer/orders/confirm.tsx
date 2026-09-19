import { router } from '@inertiajs/react';
import {
    ChevronLeft,
    CheckCircle2,
    Clock,
    Copy,
    Loader2,
    Shield,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import PushBanner from '@/components/shared/push-banner';
import { Button } from '@/components/ui/button';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { copyToClipboard } from '@/lib/clipboard';
import { openDokuCheckout, closeDokuCheckout } from '@/lib/doku-checkout';
import { formatCurrency } from '@/lib/format';
import { useNavigation } from '@/providers/navigation-provider';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max polling

export default function ConfirmPage({ order, isLoggedIn }: any) {
    const nav = useNavigation();
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => {
        const s = order.payment_status;

        if (s === 'paid' || s === 'failed' || s === 'expired') {
            return s;
        }

        return 'pending';
    });
    const [countdown, setCountdown] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [payLoading, setPayLoading] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);
    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStart = useRef<number | null>(null);
    const submitLock = useRef(false);

    // Prune navigation stack after successful payment
    // so back from confirm goes to orders, not back through checkout
    useEffect(() => {
        nav.pruneToRoot();
    }, [nav]);

    // The overlay lives outside the Inertia page tree, so tear it down on
    // unmount instead of leaking it into the next page.
    useEffect(() => closeDokuCheckout, []);

    // Poll payment status as webhook fallback (max 5 min)
    useEffect(() => {
        if (paymentStatus !== 'pending') {
            return;
        }

        pollStart.current = Date.now();

        pollInterval.current = setInterval(async () => {
            // Stop polling after timeout
            if (
                pollStart.current !== null &&
                Date.now() - pollStart.current > POLL_TIMEOUT_MS
            ) {
                if (pollInterval.current) {
                    clearInterval(pollInterval.current);
                }

                return;
            }

            try {
                const response = await fetch(
                    `/customer/orders/${order.id}/payment-status`,
                    {
                        headers: { Accept: 'application/json' },
                    },
                );

                if (response.ok) {
                    const data = await response.json();

                    if (data.payment_status === 'paid') {
                        setPaymentStatus('paid');
                        closeDokuCheckout();

                        if (pollInterval.current) {
                            clearInterval(pollInterval.current);
                        }

                        router.reload();
                    } else if (
                        ['failed', 'expired', 'cancelled'].includes(
                            data.payment_status,
                        )
                    ) {
                        setPaymentStatus(data.payment_status as PaymentStatus);
                        // Dismiss the overlay so the retry affordance behind it
                        // is reachable.
                        closeDokuCheckout();

                        if (pollInterval.current) {
                            clearInterval(pollInterval.current);
                        }
                    }
                }
            } catch {
                // Silent fail — will retry next interval
            }
        }, 5000);

        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [order.id, paymentStatus]);

    // Countdown timer — auto-expire when reaching 0
    useEffect(() => {
        if (!order.confirmation_expires_at || paymentStatus !== 'pending') {
            return;
        }

        const target = new Date(order.confirmation_expires_at).getTime();

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.floor((target - Date.now()) / 1000),
            );
            setCountdown(remaining);

            if (remaining === 0) {
                setPaymentStatus('expired');
                // Same reason as the poll path: never leave the overlay pinned
                // over the expired panel.
                closeDokuCheckout();

                if (pollInterval.current) {
                    clearInterval(pollInterval.current);
                }
            }
        };

        tick();
        const timer = setInterval(tick, 1000);

        return () => clearInterval(timer);
    }, [order.confirmation_expires_at, paymentStatus]);

    const handleCopy = useCallback(async () => {
        try {
            await copyToClipboard(order.order_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Last resort: show the code for manual copy
            alert(
                `Kode pesanan: ${order.order_code}\n\nSalin kode ini secara manual.`,
            );
        }
    }, [order.order_code]);

    const handlePay = useCallback(
        async (method?: string) => {
            if (submitLock.current || payLoading) {
                return;
            }

            submitLock.current = true;
            setPayLoading(true);
            setPayError(null);

            try {
                const csrf =
                    document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute('content') ?? '';

                const response = await fetch(
                    `/customer/orders/${order.id}/pay`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-TOKEN': csrf,
                        },
                        body: JSON.stringify({
                            payment_method: method ?? order.payment_method,
                        }),
                    },
                );

                if (!response.ok) {
                    // Guard rejection (JSON { message } from the backend):
                    // surface the real reason instead of a generic error.
                    let message =
                        'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.';

                    try {
                        const errData = await response.json();

                        if (errData?.message) {
                            message = errData.message;
                        }
                    } catch {
                        // fall through to generic
                    }

                    setPayError(message);

                    return;
                }

                const data = await response.json();

                if (data.paid) {
                    // Order is already paid (reconciled server-side) — go to the
                    // paid confirmation state for this order.
                    closeDokuCheckout();
                    router.visit(`/customer/orders/confirm/${data.order_code}`);

                    return;
                }

                if (!data.payment_url) {
                    setPayError(
                        'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.',
                    );

                    return;
                }

                // Fresh attempt created — reset to pending so the poll effect
                // re-runs ([order.id, paymentStatus]) and re-arms the interval,
                // even when retrying from a terminal failed/expired status.
                setPaymentStatus('pending');

                const ok = openDokuCheckout(data.payment_url);

                if (!ok) {
                    window.open(
                        data.payment_url,
                        '_blank',
                        'noopener,noreferrer',
                    );
                    setPayError(
                        'Kami belum dapat menampilkan pembayaran di dalam aplikasi. Pembayaran dibuka di tab baru.',
                    );
                } else {
                    // Keep the existing poll running; it converges to DB status.
                }
            } catch {
                setPayError(
                    'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.',
                );
            } finally {
                setPayLoading(false);
                submitLock.current = false;
            }
        },
        [order.id, order.payment_method, payLoading],
    );

    const statusConfig: Record<
        PaymentStatus,
        {
            icon: typeof CheckCircle2;
            color: string;
            bg: string;
            border: string;
            title: string;
            message: string;
        }
    > = {
        paid: {
            icon: CheckCircle2,
            color: 'text-success-text',
            bg: 'bg-success-bg',
            border: 'border-success-border',
            title: 'Pembayaran Berhasil',
            message: 'Pesanan Anda sedang diproses oleh outlet.',
        },
        pending: {
            icon: Clock,
            color: 'text-warning-text',
            bg: 'bg-warning-bg',
            border: 'border-warning-border',
            title: 'Menunggu Pembayaran',
            message: 'Selesaikan pembayaran dalam waktu yang ditentukan.',
        },
        failed: {
            icon: XCircle,
            color: 'text-danger-text',
            bg: 'bg-danger-bg',
            border: 'border-danger-border',
            title: 'Pembayaran Gagal',
            message:
                'Pembayaran tidak berhasil diproses. Anda bisa mencoba lagi.',
        },
        expired: {
            icon: XCircle,
            color: 'text-text-muted',
            bg: 'bg-surface-muted',
            border: 'border-border',
            title: 'Waktu Habis',
            message:
                'Batas waktu pembayaran telah berakhir. Silakan buat pesanan baru.',
        },
        cancelled: {
            icon: XCircle,
            color: 'text-danger-text',
            bg: 'bg-danger-bg',
            border: 'border-danger-border',
            title: 'Dibatalkan',
            message: 'Pembayaran dibatalkan.',
        },
    };

    const status = statusConfig[paymentStatus] ?? statusConfig.pending;
    const StatusIcon = status.icon;

    return (
        <CustomerMobileLayout hideTopBar hideCartBar hideBottomNav>
            <div className="flex min-h-[80dvh] flex-col">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-surface/95 pt-safe-header backdrop-blur">
                    <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Kembali"
                            className="h-11 w-11"
                            onClick={() =>
                                router.visit(
                                    isLoggedIn
                                        ? '/customer/orders'
                                        : '/customer/home',
                                )
                            }
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-base font-bold text-text">
                            Konfirmasi Pesanan
                        </h1>
                        <div className="h-11 w-11" />
                    </div>
                </header>

                {/* Content */}
                <div className="px-4">
                    {/* Status Card */}
                    <div
                        className={`rounded-card border ${status.border} ${status.bg} p-6 text-center`}
                    >
                        <StatusIcon
                            className={`mx-auto mb-3 h-12 w-12 ${status.color}`}
                        />
                        <h2 className={`text-lg font-bold ${status.color}`}>
                            {status.title}
                        </h2>
                        <p className="mt-1 text-sm text-text-muted">
                            {status.message}
                        </p>

                        {/* Countdown for pending */}
                        {paymentStatus === 'pending' &&
                            countdown !== null &&
                            countdown > 0 && (
                                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1.5 text-xs font-medium text-text-muted">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                        Sisa waktu: {formatTime(countdown)}
                                    </span>
                                </div>
                            )}
                    </div>

                    {paymentStatus === 'paid' && isLoggedIn && (
                        <div className="mt-4">
                            <PushBanner variant="confirm" />
                        </div>
                    )}

                    {/* Error Message */}
                    {payError && (
                        <div className="mt-3 rounded-control border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">
                            {payError}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 space-y-3">
                        {paymentStatus === 'pending' && (
                            <Button
                                variant="primary"
                                size="cta"
                                className="w-full"
                                onClick={() => handlePay()}
                                disabled={payLoading}
                            >
                                {payLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    'Lanjutkan Pembayaran'
                                )}
                            </Button>
                        )}

                        {paymentStatus === 'paid' && (
                            <Button
                                variant="primary"
                                size="cta"
                                className="w-full"
                                onClick={() =>
                                    isLoggedIn
                                        ? router.visit(
                                              `/customer/orders/${order.id}`,
                                          )
                                        : router.visit(
                                              `/track/${order.recovery_token}`,
                                          )
                                }
                            >
                                Lihat Pesanan
                            </Button>
                        )}

                        {(paymentStatus === 'failed' ||
                            paymentStatus === 'expired') && (
                            <>
                                {paymentStatus === 'failed' && (
                                    <Button
                                        variant="primary"
                                        size="cta"
                                        className="w-full"
                                        onClick={() => handlePay()}
                                        disabled={payLoading}
                                    >
                                        {payLoading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Memproses...
                                            </>
                                        ) : (
                                            'Bayar Sekarang'
                                        )}
                                    </Button>
                                )}
                                {(paymentStatus === 'failed' ||
                                    paymentStatus === 'expired') && (
                                    <div className="space-y-2">
                                        <p className="text-center text-xs font-medium text-text-muted">
                                            Atau pilih metode pembayaran lain
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { key: 'qris', label: 'QRIS' },
                                                {
                                                    key: 'transfer',
                                                    label: 'Transfer Bank',
                                                },
                                                {
                                                    key: 'ewallet',
                                                    label: 'E-Wallet',
                                                },
                                                {
                                                    key: 'credit_card',
                                                    label: 'Kartu Kredit',
                                                },
                                            ].map((m) => (
                                                <Button
                                                    key={m.key}
                                                    variant="secondary-brand"
                                                    size="lg"
                                                    className="w-full text-xs font-bold"
                                                    onClick={() =>
                                                        handlePay(m.key)
                                                    }
                                                    disabled={payLoading}
                                                >
                                                    {m.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="cta"
                                    className="w-full"
                                    onClick={() =>
                                        router.visit(
                                            isLoggedIn
                                                ? '/customer/orders'
                                                : '/customer/home',
                                        )
                                    }
                                >
                                    {paymentStatus === 'expired'
                                        ? 'Pesan Ulang'
                                        : 'Kembali'}
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Order Summary */}
                    <div className="mt-auto pt-6">
                        <div className="rounded-card border border-border bg-surface p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-medium text-text-muted">
                                    Kode Pesanan
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-primary"
                                    onClick={handleCopy}
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    {copied ? 'Disalin!' : 'Salin'}
                                </Button>
                            </div>
                            <p className="mb-4 text-center font-mono text-lg font-bold tracking-widest text-text">
                                {order.order_code}
                            </p>
                            <div className="space-y-2 border-t border-border pt-3">
                                {order.items?.map((item: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="flex justify-between text-sm"
                                    >
                                        <span className="text-text-muted">
                                            {item.product_name}
                                            {item.variant_name
                                                ? ` - ${item.variant_name}`
                                                : ''}{' '}
                                            x{item.quantity}
                                        </span>
                                        <span className="font-medium text-text">
                                            {formatCurrency(item.subtotal)}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                                    <span className="text-text">Total</span>
                                    <span className="text-primary">
                                        {formatCurrency(order.total)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Trust badge — single, meaningful */}
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-text-muted">
                            <Shield className="h-4 w-4 text-primary" />
                            <span>
                                Pembayaran diproses oleh DOKU, payment gateway
                                terpercaya di Indonesia
                            </span>
                        </div>

                        {/* Guest recovery — more prominent */}
                        {!isLoggedIn && (
                            <div className="mt-4 rounded-card border border-info-border bg-info-bg p-4 text-center">
                                <p className="text-sm font-medium text-info-text">
                                    Simpan kode pesanan Anda
                                </p>
                                <p className="mt-1 text-xs text-info-text">
                                    Gunakan kode ini untuk melacak pesanan di
                                    halaman Lacak Pesanan.
                                </p>
                            </div>
                        )}

                        {/* Help link */}
                        <div className="mt-4 text-center">
                            <a
                                href="/customer/help"
                                className="text-xs text-text-subtle underline underline-offset-2 active:text-text-muted"
                            >
                                Butuh bantuan?
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </CustomerMobileLayout>
    );
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    return `${m}:${s.toString().padStart(2, '0')}`;
}
