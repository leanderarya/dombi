import { CheckCircle2, ChevronLeft, Share2 } from 'lucide-react';
import { useShareTracking } from '@/hooks/use-order-actions';
import { getStatusLabel } from '@/lib/order-status';

interface Props {
    orderCode: string;
    orderedAt?: string | null;
    trackingUrl?: string | null;
    isConfirmation?: boolean;
    fallbackHref?: string;
    status?: string;
    bannerText?: string;
    title?: string;
}

const BANNER_DANGER = [
    'cancelled_by_customer',
    'cancelled_by_outlet',
    'rejected_by_outlet',
    'failed_delivery',
    'expired',
];

export default function OrderHeader({
    trackingUrl,
    isConfirmation = false,
    fallbackHref = '/customer/orders',
    status,
    bannerText,
    title = 'Detail Pesanan',
}: Props) {
    const handleShare = useShareTracking(trackingUrl ?? null);
    const label = bannerText ?? (status ? getStatusLabel(status) : '');
    const isDanger = status ? BANNER_DANGER.includes(status) : false;

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 pt-safe backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                <button
                    type="button"
                    onClick={() => {
                        if (isConfirmation) {
                            window.location.href = fallbackHref;
                        } else if (window.history.length > 1) {
                            window.history.back();
                        } else {
                            window.location.href = fallbackHref;
                        }
                    }}
                    aria-label="Kembali"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-sm font-semibold text-text">{title}</h1>
                {trackingUrl ? (
                    <button
                        type="button"
                        onClick={handleShare}
                        aria-label="Bagikan lacak pesanan"
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-emerald-600 active:opacity-80"
                    >
                        <Share2 className="h-5 w-5" />
                    </button>
                ) : (
                    <div className="h-11 w-11" />
                )}
            </div>

            {label && (
                <div
                    className={`border-t px-4 py-3 text-center ${
                        isDanger
                            ? 'border-red-100 bg-red-50 text-red-600'
                            : 'border-emerald-100 bg-[#EAF5ED] text-[#006241]'
                    }`}
                >
                    <p className="flex items-center justify-center gap-2 text-sm font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{label}</span>
                    </p>
                </div>
            )}
        </header>
    );
}
