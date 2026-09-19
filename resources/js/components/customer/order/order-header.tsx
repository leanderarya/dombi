import { CheckCircle2, ChevronLeft, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

/**
 * The status banner is full-bleed under the app bar, so it keeps its own
 * frame instead of using `Notice` — every Notice shape is a rounded panel,
 * and rounding this edge-to-edge strip would read as a floating card.
 * Only the hardcoded #EAF5ED / #006241 (a brand shade that predates the
 * token set) is replaced; the geometry is unchanged.
 */
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
        <header className="sticky top-0 z-30 bg-surface/95 pt-safe-header backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
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
                    className="h-11 w-11 rounded-control text-text hover:bg-transparent hover:text-text active:opacity-80 [&_svg]:size-5"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-sm font-semibold text-text">{title}</h1>
                {trackingUrl ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleShare}
                        aria-label="Bagikan lacak pesanan"
                        className="h-11 w-11 rounded-control text-primary hover:bg-transparent hover:text-primary active:opacity-80 [&_svg]:size-5"
                    >
                        <Share2 className="h-5 w-5" />
                    </Button>
                ) : (
                    <div className="h-11 w-11" />
                )}
            </div>

            {label && (
                <div
                    className={`border-t px-4 py-3 text-center ${
                        isDanger
                            ? 'border-danger-border bg-danger-bg text-danger'
                            : 'border-success-border bg-success-bg text-success-text'
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
