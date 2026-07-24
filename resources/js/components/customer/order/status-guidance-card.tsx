import { Link } from '@inertiajs/react';
import { Clock, MapPin, Phone } from 'lucide-react';
import { useCountdown } from '@/hooks/use-countdown';
import { waLinkWithMessage } from '@/lib/wa';

const MAPS_LINK = 'https://www.google.com/maps/dir/?api=1&destination=';

const STATUS_GUIDANCE: Record<
    string,
    {
        description: string;
        nextStep?: string;
        cta?: { label: string; href?: string; action?: string };
    }
> = {
    pending_confirmation: {
        description: 'Menunggu outlet mengkonfirmasi pesanan Anda',
        nextStep: 'Biasanya dikonfirmasi dalam beberapa menit',
    },
    pending_confirmation_unpaid: {
        description: 'Menunggu Pembayaran',
        nextStep: 'Selesaikan pembayaran untuk melanjutkan pesanan',
    },
    pending_confirmation_payment_failed: {
        description: 'Pembayaran Gagal',
        nextStep:
            'Pembayaran sebelumnya gagal. Anda masih bisa coba bayar ulang sebelum waktu habis.',
    },
    confirmed: {
        description: 'Pesanan sudah dikonfirmasi oleh outlet',
        nextStep: 'Outlet sedang menyiapkan pesanan Anda',
    },
    preparing: {
        description: 'Pesanan sedang disiapkan',
        nextStep: 'Pesanan akan segera siap',
    },
    ready_for_pickup: {
        description: 'Pesanan sudah siap diambil!',
        nextStep: 'Silakan ambil di outlet sebelum jam tutup',
        cta: { label: 'Navigasi ke Outlet', action: 'navigate' },
    },
    ready_for_pickup_delivery: {
        description: 'Pesanan sudah siap, menunggu kurir',
        nextStep: 'Kurir akan segera menjemput dan mengantar ke alamat Anda',
    },
    completed: {
        description: 'Pesanan telah selesai',
        nextStep: 'Terima kasih sudah pesan di Dombi!',
    },
    rejected_by_outlet: {
        description: 'Outlet tidak dapat memproses pesanan',
        nextStep: 'Silakan coba pesan dari outlet lain',
    },
    cancelled_by_customer: { description: 'Pesanan telah Anda batalkan' },
    cancelled_by_outlet: {
        description: 'Pesanan dibatalkan oleh outlet',
        nextStep: 'Silakan coba pesan lagi',
    },
    failed_delivery: {
        description: 'Pengiriman gagal',
        nextStep: 'Silakan hubungi kami untuk bantuan',
        cta: { label: 'Hubungi WhatsApp', action: 'wa_outlet' },
    },
    expired: {
        description: 'Pesanan kadaluarsa',
        nextStep: 'Outlet tidak konfirmasi dalam batas waktu',
    },
    refund_pending: {
        description: 'Refund sedang diproses',
        nextStep: 'Lengkapi data tujuan transfer untuk melanjutkan',
    },
    refund_in_progress: {
        description: 'Owner sedang memproses refund',
        nextStep: 'Dana akan ditransfer setelah selesai diverifikasi',
    },
    refunded: {
        description: 'Refund telah selesai diproses',
        nextStep: 'Cek bukti transfer di panel refund',
    },
    refund_rejected: {
        description: 'Refund tidak dapat diproses',
        nextStep: 'Lihat alasan penolakan di panel refund',
    },
};

interface Props {
    status: string;
    paymentStatus?: string | null;
    isPickup: boolean;
    confirmationExpiresAt?: string | null;
    outletPhone?: string | null;
    outletLatitude?: number | null;
    outletLongitude?: number | null;
    outletName?: string;
    customerName?: string;
    orderCode?: string;
}

export default function StatusGuidanceCard({
    status,
    paymentStatus,
    isPickup,
    confirmationExpiresAt,
    outletPhone,
    outletLatitude,
    outletLongitude,
    outletName,
    customerName,
    orderCode,
}: Props) {
    const countdown = useCountdown(confirmationExpiresAt);
    const isPendingUnpaid =
        status === 'pending_confirmation' && paymentStatus !== 'paid';
    const isPaymentFailed =
        paymentStatus === 'failed' || paymentStatus === 'expired';
    const isDelivery = !isPickup;
    const guidanceKey = isPendingUnpaid
        ? isPaymentFailed
            ? 'pending_confirmation_payment_failed'
            : 'pending_confirmation_unpaid'
        : status === 'ready_for_pickup' && isDelivery
          ? 'ready_for_pickup_delivery'
          : status;
    const guidance = STATUS_GUIDANCE[guidanceKey] ?? STATUS_GUIDANCE[paymentStatus ?? ''];

    if (!guidance) return null;

    const isPickupReady =
        status === 'ready_for_pickup' && outletLatitude && outletLongitude;
    const showCountdown =
        status === 'pending_confirmation' &&
        !isPendingUnpaid &&
        !countdown.expired &&
        countdown.totalSeconds > 0;

    return (
        <div className="mt-3 rounded-xl border border-border bg-white p-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-semibold text-text">
                        {guidance.description}
                    </div>
                    {showCountdown && (
                        <div className="mt-1 flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span className="text-xs font-bold text-amber-700 tabular-nums">
                                {String(countdown.minutes).padStart(2, '0')}:
                                {String(countdown.seconds).padStart(2, '0')}
                            </span>
                        </div>
                    )}
                    {guidance.nextStep && (
                        <div className="mt-0.5 text-[11px] text-text-muted">
                            {guidance.nextStep}
                        </div>
                    )}
                </div>
                {guidance.cta && (
                    <div className="shrink-0">
                        {isPickupReady && guidance.cta.action === 'navigate' ? (
                            <a
                                href={`${MAPS_LINK}${outletLatitude},${outletLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80"
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                {guidance.cta.label}
                            </a>
                        ) : guidance.cta.action === 'wa_outlet' &&
                          outletPhone ? (
                            <a
                                href={waLinkWithMessage(outletPhone, {
                                    order_code: orderCode ?? '',
                                    customer_name: customerName,
                                    outlet_name: outletName,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(
                                        waLinkWithMessage(outletPhone, {
                                            order_code: orderCode ?? '',
                                            customer_name: customerName,
                                            outlet_name: outletName,
                                        }),
                                        '_blank',
                                        'noopener,noreferrer',
                                    );
                                }}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80"
                            >
                                <Phone className="h-3.5 w-3.5" />
                                {guidance.cta.label}
                            </a>
                        ) : guidance.cta.href ? (
                            <Link
                                href={guidance.cta.href}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white active:opacity-80"
                            >
                                {guidance.cta.label}
                            </Link>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}
