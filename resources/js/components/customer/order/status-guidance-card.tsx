import { Link } from '@inertiajs/react';
import { Clock, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/status-badge';
import type { BadgeVariant } from '@/components/ui/status-badge';
import { useCountdown } from '@/hooks/use-countdown';
import { getBadgeProps } from '@/lib/order-status';
import { whatsAppDefaultMessage, waLinkWithText } from '@/lib/whatsapp-message';

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
    badgeVariant?: string;
    badgeLabel?: string;
    badgeFallbackStatus?: string;
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
    badgeVariant,
    badgeLabel,
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
    const guidance =
        STATUS_GUIDANCE[guidanceKey] ?? STATUS_GUIDANCE[paymentStatus ?? ''];
    const badge: {
        badgeVariant?: BadgeVariant;
        badgeLabel?: string;
        badgeFallbackStatus?: string;
    } =
        badgeVariant && badgeLabel
            ? { badgeVariant: badgeVariant as BadgeVariant, badgeLabel }
            : getBadgeProps({ status, paymentStatus, isPickup });

    if (!guidance) {
        return null;
    }

    const isPickupReady =
        status === 'ready_for_pickup' && outletLatitude && outletLongitude;
    const showCountdown =
        status === 'pending_confirmation' &&
        !isPendingUnpaid &&
        !countdown.expired &&
        countdown.totalSeconds > 0;

    return (
        <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4">
            {badge.badgeVariant && badge.badgeLabel ? (
                <div className="flex">
                    <StatusBadge variant={badge.badgeVariant}>
                        {badge.badgeLabel}
                    </StatusBadge>
                </div>
            ) : badge.badgeFallbackStatus ? (
                <div className="flex">
                    <StatusBadge status={badge.badgeFallbackStatus} />
                </div>
            ) : null}
            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-semibold text-text">
                        {guidance.description}
                    </div>
                    {showCountdown && (
                        <div className="mt-1 flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-warning" />
                            <span className="text-xs font-bold text-warning-text tabular-nums">
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
                            <Button asChild size="sm" variant="primary">
                                <a
                                    href={`${MAPS_LINK}${outletLatitude},${outletLongitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <MapPin className="h-3.5 w-3.5" />
                                    {guidance.cta.label}
                                </a>
                            </Button>
                        ) : guidance.cta.action === 'wa_outlet' &&
                          outletPhone ? (
                            <Button
                                asChild
                                size="sm"
                                variant="primary"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.open(
                                        waLinkWithText(
                                            outletPhone,
                                            whatsAppDefaultMessage({
                                                order_code: orderCode ?? '',
                                                status,
                                                fulfillment_type: isPickup
                                                    ? 'pickup'
                                                    : 'delivery',
                                                customer_name: customerName,
                                                outlet_name: outletName,
                                            }),
                                        ),
                                        '_blank',
                                        'noopener,noreferrer',
                                    );
                                }}
                            >
                                <a
                                    href={waLinkWithText(
                                        outletPhone,
                                        whatsAppDefaultMessage({
                                            order_code: orderCode ?? '',
                                            status,
                                            fulfillment_type: isPickup
                                                ? 'pickup'
                                                : 'delivery',
                                            customer_name: customerName,
                                            outlet_name: outletName,
                                        }),
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Phone className="h-3.5 w-3.5" />
                                    {guidance.cta.label}
                                </a>
                            </Button>
                        ) : guidance.cta.href ? (
                            <Button asChild size="sm" variant="primary">
                                <Link href={guidance.cta.href}>
                                    {guidance.cta.label}
                                </Link>
                            </Button>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}
