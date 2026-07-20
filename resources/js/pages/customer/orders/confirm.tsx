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
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import Dialog from '@/components/ui/dialog';
import PushBanner from '@/components/shared/push-banner';
import { formatCurrency } from '@/lib/format';
import { copyToClipboard } from '@/lib/clipboard';
import { useNavigation } from '@/providers/navigation-provider';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max polling

export default function ConfirmPage({ order, isLoggedIn }: any) {
    const nav = useNavigation();
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(() => {
        const s = order.payment_status;
        if (s === 'paid' || s === 'failed' || s === 'expired') return s;
        return 'pending';
    });
    const [countdown, setCountdown] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [payLoading, setPayLoading] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);
    const [needsRefund, setNeedsRefund] = useState(false);
    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStart = useRef(Date.now());
    const submitLock = useRef(false);

    // Prune navigation stack after successful payment
    // so back from confirm goes to orders, not back through checkout
    useEffect(() => {
        nav.pruneToRoot();
    }, [nav]);

    // Poll payment status as webhook fallback (max 5 min)
    useEffect(() => {
        if (paymentStatus !== 'pending') return;

        pollStart.current = Date.now();

        pollInterval.current = setInterval(async () => {
            // Stop polling after timeout
            if (Date.now() - pollStart.current > POLL_TIMEOUT_MS) {
                if (pollInterval.current) clearInterval(pollInterval.current);
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
                        if (pollInterval.current)
                            clearInterval(pollInterval.current);
                        router.reload();
                    } else if (
                        ['failed', 'expired', 'cancelled'].includes(
                            data.payment_status,
                        )
                    ) {
                        setPaymentStatus(data.payment_status as PaymentStatus);
                        if (pollInterval.current)
                            clearInterval(pollInterval.current);
                    }
                }
            } catch {
                // Silent fail — will retry next interval
            }
        }, 5000);

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [paymentStatus]);

    // Countdown timer — auto-expire when reaching 0
    useEffect(() => {
        if (!order.confirmation_expires_at || paymentStatus !== 'pending')
            return;

        const target = new Date(order.confirmation_expires_at).getTime();

        const tick = () => {
            const remaining = Math.max(
                0,
                Math.floor((target - Date.now()) / 1000),
            );
            setCountdown(remaining);

            if (remaining === 0) {
                setPaymentStatus('expired');
                if (pollInterval.current) clearInterval(pollInterval.current);
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
            alert(`Kode pesanan: ${order.order_code}\n\nSalin kode ini secara manual.`);
        }
    }, [order.order_code]);

    const CANCEL_REASONS = [
        'Salah Pesan',
        'Ingin Mengubah Pesanan',
        'Alamat Salah',
        'Tidak Jadi Membeli',
        'Lainnya',
    ];

    const handleCancel = useCallback(() => {
        if (!cancelReason) return;
        setCancelLoading(true);

        router.post(
            `/customer/orders/${order.id}/cancel`,
            { reason: cancelReason },
            {
                onFinish: () => setCancelLoading(false),
                onSuccess: () => {
                    setCancelDialogOpen(false);
                    if (paymentStatus === 'paid') {
                        setNeedsRefund(true);
                    }
                    setPaymentStatus('cancelled');
                },
            },
        );
    }, [order.id, cancelReason]);

    const handlePay = useCallback(() => {
        if (submitLock.current || payLoading) return;
        submitLock.current = true;
        setPayLoading(true);
        setPayError(null);

        try {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `/customer/orders/${order.id}/pay`;

            const csrf =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_token';
            csrfInput.value = csrf;
            form.appendChild(csrfInput);

            document.body.appendChild(form);
            form.submit();
        } catch {
            setPayError(
                'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.',
            );
            setPayLoading(false);
            submitLock.current = false;
        }
    }, [order.id, payLoading]);

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
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            title: 'Pembayaran Berhasil',
            message: 'Pesanan Anda sedang diproses oleh outlet.',
        },
        pending: {
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            title: 'Menunggu Pembayaran',
            message: 'Selesaikan pembayaran dalam waktu yang ditentukan.',
        },
        failed: {
            icon: XCircle,
            color: 'text-red-600',
            bg: 'bg-red-50',
            border: 'border-red-200',
            title: 'Pembayaran Gagal',
            message:
                'Pembayaran tidak berhasil diproses. Anda bisa mencoba lagi.',
        },
        expired: {
            icon: XCircle,
            color: 'text-gray-600',
            bg: 'bg-gray-50',
            border: 'border-gray-200',
            title: 'Waktu Habis',
            message:
                'Batas waktu pembayaran telah berakhir. Silakan buat pesanan baru.',
        },
        cancelled: {
            icon: XCircle,
            color: 'text-red-600',
            bg: 'bg-red-50',
            border: 'border-red-200',
            title: 'Dibatalkan',
            message: needsRefund
                ? 'Pesanan dibatalkan. Refund sedang diproses.'
                : 'Pembayaran dibatalkan.',
        },
    };

    const status = statusConfig[paymentStatus] ?? statusConfig.pending;
    const StatusIcon = status.icon;

    return (
        <CustomerMobileLayout hideTopBar hideCartBar hideBottomNav>
            <div className="flex min-h-[80dvh] flex-col">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-white/95 pt-safe backdrop-blur">
                    <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                        <button
                            onClick={() =>
                                router.visit(
                                    isLoggedIn
                                        ? '/customer/orders'
                                        : '/customer/home',
                                )
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
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
                        className={`rounded-2xl border ${status.border} ${status.bg} p-6 text-center`}
                    >
                        <StatusIcon
                            className={`mx-auto mb-3 h-12 w-12 ${status.color}`}
                        />
                        <h2 className={`text-lg font-bold ${status.color}`}>
                            {status.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            {status.message}
                        </p>

                        {/* Countdown for pending */}
                        {paymentStatus === 'pending' &&
                            countdown !== null &&
                            countdown > 0 && (
                                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600">
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
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {payError}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 space-y-3">
                        {paymentStatus === 'pending' && (
                            <>
                                <button
                                    onClick={handlePay}
                                    disabled={payLoading}
                                    className="min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm active:opacity-80 disabled:opacity-50"
                                >
                                    {payLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Memproses...
                                        </span>
                                    ) : (
                                        'Lanjutkan Pembayaran'
                                    )}
                                </button>
                                {isLoggedIn &&
                                    order.status === 'pending_confirmation' && (
                                        <button
                                            onClick={() =>
                                                setCancelDialogOpen(true)
                                            }
                                            className="min-h-11 w-full text-xs font-medium text-slate-400 active:text-red-500"
                                        >
                                            Batalkan Pesanan
                                        </button>
                                    )}
                            </>
                        )}

                        {paymentStatus === 'paid' &&
                            isLoggedIn &&
                            order.status === 'pending_confirmation' && (
                                <button
                                    onClick={() => setCancelDialogOpen(true)}
                                    className="min-h-11 w-full text-xs font-medium text-slate-400 active:text-red-500"
                                >
                                    Batalkan Pesanan
                                </button>
                            )}

                        {paymentStatus === 'paid' && (
                            <button
                                onClick={() =>
                                    isLoggedIn
                                        ? router.visit(
                                              `/customer/orders/${order.id}`,
                                          )
                                        : router.visit(
                                              `/track/${order.recovery_token}`,
                                          )
                                }
                                className="min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm active:opacity-80"
                            >
                                Lihat Pesanan
                            </button>
                        )}

                        {(paymentStatus === 'failed' ||
                            paymentStatus === 'expired') && (
                            <>
                                {paymentStatus === 'failed' && (
                                    <button
                                        onClick={handlePay}
                                        disabled={payLoading}
                                        className="min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm active:opacity-80 disabled:opacity-50"
                                    >
                                        {payLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Memproses...
                                            </span>
                                        ) : (
                                            'Bayar Sekarang'
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() =>
                                        router.visit(
                                            isLoggedIn
                                                ? '/customer/orders'
                                                : '/customer/home',
                                        )
                                    }
                                    className="min-h-12 w-full rounded-xl bg-white text-sm font-bold text-slate-600 shadow-sm active:opacity-80"
                                >
                                    {paymentStatus === 'expired'
                                        ? 'Pesan Ulang'
                                        : 'Kembali'}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Order Summary */}
                    <div className="mt-auto pt-6">
                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-500">
                                    Kode Pesanan
                                </span>
                                <button
                                    onClick={handleCopy}
                                    className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-medium text-emerald-600 active:opacity-80"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    {copied ? 'Disalin!' : 'Salin'}
                                </button>
                            </div>
                            <p className="mb-4 text-center font-mono text-lg font-bold tracking-widest text-slate-900">
                                {order.order_code}
                            </p>
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                                {order.items?.map((item: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="flex justify-between text-sm"
                                    >
                                        <span className="text-slate-600">
                                            {item.product_name}
                                            {item.variant_name
                                                ? ` - ${item.variant_name}`
                                                : ''}{' '}
                                            x{item.quantity}
                                        </span>
                                        <span className="font-medium text-slate-900">
                                            {formatCurrency(item.subtotal)}
                                        </span>
                                    </div>
                                ))}
                                <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold">
                                    <span className="text-slate-900">
                                        Total
                                    </span>
                                    <span className="text-emerald-600">
                                        {formatCurrency(order.total)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Trust badge — single, meaningful */}
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                            <Shield className="h-4 w-4 text-emerald-600" />
                            <span>
                                Pembayaran diproses oleh DOKU, payment gateway
                                terpercaya di Indonesia
                            </span>
                        </div>

                        {/* Guest recovery — more prominent */}
                        {!isLoggedIn && (
                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
                                <p className="text-sm font-medium text-blue-800">
                                    Simpan kode pesanan Anda
                                </p>
                                <p className="mt-1 text-xs text-blue-600">
                                    Gunakan kode ini untuk melacak pesanan di
                                    halaman Lacak Pesanan.
                                </p>
                            </div>
                        )}

                        {/* Help link */}
                        <div className="mt-4 text-center">
                            <a
                                href="/customer/help"
                                className="text-xs text-slate-400 underline underline-offset-2 active:text-slate-600"
                            >
                                Butuh bantuan?
                            </a>
                        </div>
                    </div>
                </div>

                {/* Cancel Dialog */}
                <Dialog
                    open={cancelDialogOpen}
                    onClose={() => setCancelDialogOpen(false)}
                    title="Batalkan Pesanan"
                >
                    <p className="text-sm text-slate-600">
                        Pesanan yang dibatalkan tidak dapat dipulihkan.
                    </p>
                    <div className="mt-4 space-y-2">
                        {CANCEL_REASONS.map((reason) => (
                            <button
                                key={reason}
                                type="button"
                                onClick={() => setCancelReason(reason)}
                                className={`flex min-h-11 w-full items-center rounded-lg border px-4 text-left text-sm font-medium transition-all ${
                                    cancelReason === reason
                                        ? 'border-red-300 bg-red-50 text-red-700'
                                        : 'border-slate-200 text-slate-700 active:bg-slate-50'
                                }`}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setCancelDialogOpen(false)}
                            className="min-h-12 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 active:bg-slate-50"
                        >
                            Kembali
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={!cancelReason || cancelLoading}
                            className="min-h-12 flex-1 rounded-lg bg-red-600 text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                        >
                            {cancelLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
                        </button>
                    </div>
                </Dialog>
            </div>
        </CustomerMobileLayout>
    );
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
