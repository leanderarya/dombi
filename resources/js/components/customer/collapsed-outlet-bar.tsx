import { Link } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OutletOption } from '@/contexts/outlet-context';

interface Props {
    show: boolean;
    outlet: OutletOption | null;
    fulfillmentType: 'pickup' | 'delivery';
    onOpenSheet: () => void;
    backHref?: string;
}

export default function CollapsedOutletBar({
    show,
    outlet,
    fulfillmentType,
    onOpenSheet,
    backHref = '/customer/home',
}: Props) {
    if (!outlet) {
        return null;
    }

    const distanceText =
        outlet.distance_km !== null && outlet.distance_km !== undefined
            ? `${outlet.distance_km.toFixed(1)} km`
            : null;

    return (
        <div
            className={`fixed top-0 right-0 left-0 z-50 bg-surface/90 shadow-elevated backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                show
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none -translate-y-full opacity-0'
            }`}
            style={{
                paddingTop: 'env(safe-area-inset-top, 0px)',
                willChange: 'transform, opacity',
            }}
        >
            <div className="flex items-center gap-2.5 px-3 py-1">
                {/* Back button */}
                <Link
                    href={backHref}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text active:bg-surface-muted"
                    aria-label="Kembali"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Link>

                {/* Outlet info — tap to open sheet */}
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onOpenSheet}
                    className="h-auto min-w-0 flex-1 items-center gap-2 px-0 text-left hover:bg-transparent"
                >
                    <Store className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-sm font-bold text-text">
                        {outlet.name}
                    </span>
                    {distanceText && (
                        <span className="shrink-0 text-[11px] text-text-muted tabular-nums">
                            {distanceText}
                        </span>
                    )}
                    {/* Fulfillment badge */}
                    <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {fulfillmentType === 'pickup' ? 'P' : 'D'}
                    </span>
                    {outlet.is_open === false && (
                        <span className="shrink-0 rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-bold text-danger-text">
                            Tutup
                        </span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 text-text-subtle" />
                </Button>
            </div>
        </div>
    );
}
