import { usePage } from '@inertiajs/react';
import { Store, MapPin } from 'lucide-react';
import { useState } from 'react';
import LocationSheet from '@/components/customer/location-sheet';
import OutletSheet from '@/components/customer/outlet-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useOutlet } from '@/contexts/outlet-context';
import { useCustomerLocation } from '@/lib/customer-location';

export default function StoreLocationCard() {
    const { auth } = usePage<any>().props;
    const isLoggedIn = !!auth?.user;
    const { selectedOutlet, outlets, loading, error, retry } = useOutlet();
    const { summary: locationSummary } = useCustomerLocation();
    const [outletSheetOpen, setOutletSheetOpen] = useState(false);
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);

    // Loading skeleton
    if (loading && !selectedOutlet) {
        return (
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-elevated">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-4" />
            </div>
        );
    }

    // Error state
    if (error && !selectedOutlet) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-elevated">
                <span className="text-xs text-text-muted">{error}</span>
                <button
                    type="button"
                    onClick={retry}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white active:opacity-80"
                >
                    Coba Lagi
                </button>
            </div>
        );
    }

    // No outlet available
    if (!selectedOutlet) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-elevated">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>Tidak ada outlet tersedia</span>
                </div>
            </div>
        );
    }

    const distanceText =
        selectedOutlet.distance_km !== null &&
        selectedOutlet.distance_km !== undefined
            ? `${selectedOutlet.distance_km.toFixed(1)} km`
            : null;

    const outletLocation =
        [selectedOutlet.kecamatan, selectedOutlet.kelurahan]
            .filter(Boolean)
            .join(', ') ||
        selectedOutlet.address ||
        null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOutletSheetOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-elevated transition-colors active:bg-surface-muted"
            >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
                    <Store className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-text">
                        {selectedOutlet.name}
                    </div>
                    <div className="text-[11px] text-text-muted">
                        {distanceText ? (
                            <>
                                {distanceText}
                                {selectedOutlet.id === outlets[0]?.id && (
                                    <>
                                        {' '}
                                        ·{' '}
                                        <span className="font-semibold text-primary">
                                            Terdekat
                                        </span>
                                    </>
                                )}
                            </>
                        ) : locationSummary ? (
                            <span>{locationSummary}</span>
                        ) : outletLocation ? (
                            <span className="truncate">{outletLocation}</span>
                        ) : (
                            <span className="text-text-subtle">
                                Pilih outlet terdekat
                            </span>
                        )}
                    </div>
                </div>
                <svg
                    className="h-4 w-4 shrink-0 text-text-subtle"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </button>

            <OutletSheet
                open={outletSheetOpen}
                onClose={() => setOutletSheetOpen(false)}
            />
            <LocationSheet
                open={locationSheetOpen}
                onClose={() => setLocationSheetOpen(false)}
                isLoggedIn={isLoggedIn}
            />
        </>
    );
}
