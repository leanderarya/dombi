import { router } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, Clock, Copy, Package, Shield, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { formatCurrency } from '@/lib/format';

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export default function ConfirmPage({ order, isLoggedIn }: any) {
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
        order.payment_status === 'paid' ? 'paid' : 'pending'
    );
    const [countdown, setCountdown] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Poll payment status as webhook fallback
    useEffect(() => {
        if (paymentStatus !== 'pending') {
return;
}

        pollInterval.current = setInterval(async () => {
            try {
                const response = await fetch(`/customer/orders/${order.id}/payment-status`, {
                    headers: { 'Accept': 'application/json' },
                });

                if (response.ok) {
                    const data = await response.json();

                    if (data.payment_status === 'paid') {
                        setPaymentStatus('paid');

                        if (pollInterval.current) {
clearInterval(pollInterval.current);
}

                        router.reload();
                    } else if (['failed', 'expired', 'cancelled'].includes(data.payment_status)) {
                        setPaymentStatus(data.payment_status as PaymentStatus);

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
    }, [paymentStatus]);

    // Countdown timer
    useEffect(() => {
        if (!order.confirmation_expires_at) {
return;
}

        const target = new Date(order.confirmation_expires_at).getTime();

        const tick = () => {
            const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
            setCountdown(remaining);

            if (remaining <= 0) {
                setPaymentStatus('expired');
            }
        };

        tick();
        const timer = setInterval(tick, 1000);

        return () => clearInterval(timer);
    }, [order.confirmation_expires_at]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(order.order_code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [order.order_code]);

    const statusConfig: Record<PaymentStatus, { icon: typeof CheckCircle2; color: string; bg: string; border: string; title: string; message: string }> = {
        paid: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'Pembayaran Berhasil', message: 'Pesanan Anda sedang diproses oleh outlet.' },
        pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', title: 'Menunggu Pembayaran', message: 'Selesaikan pembayaran Anda.' },
        failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', title: 'Pembayaran Gagal', message: 'Pembayaran tidak berhasil diproses.' },
        expired: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', title: 'Waktu Habis', message: 'Batas waktu pembayaran telah berakhir.' },
    };

    const status = statusConfig[paymentStatus];
    const StatusIcon = status.icon;

    return (
        <CustomerMobileLayout hideTopBar hideCartBar hideBottomNav>
            <div className="flex min-h-[80dvh] flex-col">
                {/* Header */}
                <div className="mb-6 flex items-center gap-3">
                    <button
                        onClick={() => router.visit(isLoggedIn ? '/customer/orders' : '/')}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Konfirmasi Pesanan</h1>
                        <p className="text-xs text-slate-500">#{order.order_code}</p>
                    </div>
                </div>

                {/* Status Card */}
                <div className={`rounded-2xl border ${status.border} ${status.bg} p-6 text-center`}>
                    <StatusIcon className={`mx-auto mb-3 h-12 w-12 ${status.color}`} />
                    <h2 className={`text-lg font-bold ${status.color}`}>{status.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{status.message}</p>

                    {/* Countdown for pending */}
                    {paymentStatus === 'pending' && countdown !== null && countdown > 0 && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(countdown)}</span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="mt-4 space-y-3">
                    {/* Pending: continue to payment */}
                    {paymentStatus === 'pending' && (
                        <button
                            onClick={() => router.visit(`/customer/orders/${order.id}/pay`)}
                            className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
                        >
                            Lanjutkan Pembayaran
                        </button>
                    )}

                    {/* Paid: go to order */}
                    {paymentStatus === 'paid' && (
                        <button
                            onClick={() => isLoggedIn ? router.visit(`/customer/orders/${order.id}`) : router.visit(`/track/${order.recovery_token}`)}
                            className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
                        >
                            Lihat Pesanan
                        </button>
                    )}

                    {/* Failed/Expired: retry or go home */}
                    {(paymentStatus === 'failed' || paymentStatus === 'expired') && (
                        <>
                            <button
                                onClick={() => router.visit('/customer/checkout')}
                                className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
                            >
                                Coba Lagi
                            </button>
                            <button
                                onClick={() => router.visit(isLoggedIn ? '/customer/orders' : '/')}
                                className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-slate-600 shadow-sm active:scale-[0.98]"
                            >
                                Kembali
                            </button>
                        </>
                    )}
                </div>

                {/* Order Summary */}
                <div className="mt-auto pt-6">
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">Kode Pesanan</span>
                            <button onClick={handleCopy} className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                <Copy className="h-3 w-3" />
                                {copied ? 'Disalin!' : 'Salin'}
                            </button>
                        </div>
                        <p className="mb-4 text-center font-mono text-lg font-bold tracking-widest text-slate-900">{order.order_code}</p>
                        <div className="space-y-2 border-t border-slate-100 pt-3">
                            {order.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-slate-600">{item.product_name}{item.variant_name ? ` - ${item.variant_name}` : ''} x{item.quantity}</span>
                                    <span className="font-medium text-slate-900">{formatCurrency(item.subtotal)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-bold">
                                <span className="text-slate-900">Total</span>
                                <span className="text-emerald-600">{formatCurrency(order.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Trust badges */}
                    <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Pembayaran Aman
                        </span>
                        <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            DOKU
                        </span>
                    </div>

                    {/* Guest recovery */}
                    {!isLoggedIn && (
                        <div className="mt-4 rounded-xl bg-blue-50 p-3 text-center">
                            <p className="text-xs text-blue-700">
                                Simpan kode pesanan untuk melacak pesanan Anda.
                            </p>
                        </div>
                    )}
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
