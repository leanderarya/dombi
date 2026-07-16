import { router } from '@inertiajs/react';
import { ChevronLeft, Share2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useShareTracking } from '@/hooks/use-order-actions';

interface Props {
    orderCode: string;
    orderedAt?: string | null;
    trackingUrl?: string | null;
    isConfirmation?: boolean;
    fallbackHref?: string;
}

export default function OrderHeader({ orderCode, orderedAt, trackingUrl, isConfirmation = false, fallbackHref = '/customer/orders' }: Props) {
    const handleShare = trackingUrl ? useShareTracking(trackingUrl) : undefined;

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur pt-safe">
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
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-text active:opacity-80"
                    aria-label="Kembali"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-center">
                    <div className="text-sm font-semibold text-text">{orderCode}</div>
                    {orderedAt && (
                        <div className="text-[11px] text-text-muted">{formatDate(orderedAt)}</div>
                    )}
                </div>
                {handleShare ? (
                    <button
                        type="button"
                        onClick={handleShare}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-emerald-600 active:bg-emerald-50"
                        aria-label="Bagikan lacak pesanan"
                    >
                        <Share2 className="h-5 w-5" />
                    </button>
                ) : (
                    <div className="h-11 w-11" />
                )}
            </div>
        </header>
    );
}
