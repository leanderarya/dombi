import { ChevronDown, MapPin, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import LocationSheet from '@/components/customer/location-sheet';
import { useCustomerLocation } from '@/lib/customer-location';

type CheckoutItem = {
    product_id: number;
    quantity: number;
};

type OutletOption = {
    id: number;
    name: string;
    address: string;
    kelurahan?: string | null;
    kecamatan?: string | null;
    phone?: string | null;
    distance_km?: number | null;
    stock_available: boolean;
};

type Props = {
    items: CheckoutItem[];
    initialRecommendations?: {
        recommended?: OutletOption | null;
        alternatives?: OutletOption[];
    };
    selectedOutletId?: number | null;
    onSelect: (outletId: number) => void;
    error?: string;
};

export default function PickupOutletSelector({ items, initialRecommendations, selectedOutletId, onSelect, error }: Props) {
    const { location, summary } = useCustomerLocation();
    const [sheetOpen, setSheetOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [recommendations, setRecommendations] = useState(initialRecommendations ?? { recommended: null, alternatives: [] });

    const alternatives = recommendations.alternatives ?? [];

    useEffect(() => {
        let active = true;
        const params = new URLSearchParams();

        if (location?.latitude !== undefined) {
            params.set('latitude', String(location.latitude));
        }

        if (location?.longitude !== undefined) {
            params.set('longitude', String(location.longitude));
        }

        setLoading(true);

        fetch(`/customer/checkout/pickup-outlets?${params.toString()}`, {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Failed to load pickup outlets');
                }

                return response.json();
            })
            .then((payload) => {
                if (!active) {
                    return;
                }

                setRecommendations(payload);
            })
            .catch(() => {
                if (active) {
                    setRecommendations(initialRecommendations ?? { recommended: null, alternatives: [] });
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });

        return () => {
            active = false;
        };
    }, [initialRecommendations, location?.latitude, location?.longitude, items]);

    useEffect(() => {
        if (!selectedOutletId && recommendations.recommended?.id) {
            onSelect(recommendations.recommended.id);

            return;
        }

        if (selectedOutletId && alternatives.length > 0 && !alternatives.some((outlet) => outlet.id === selectedOutletId) && recommendations.recommended?.id) {
            onSelect(recommendations.recommended.id);
        }
    }, [alternatives, onSelect, recommendations.recommended?.id, selectedOutletId]);

    const selectedOutlet = useMemo(
        () => alternatives.find((outlet) => outlet.id === selectedOutletId) ?? recommendations.recommended ?? null,
        [alternatives, recommendations.recommended, selectedOutletId],
    );

    const hasRecommendations = recommendations.recommended && alternatives.length > 0;
    const otherOutlets = alternatives.filter((o) => o.id !== recommendations.recommended?.id);

    return (
        <>
            {/* Loading state */}
            {loading && !hasRecommendations && (
                <div className="mt-4 rounded-xl border border-border bg-white p-3">
                    <div className="flex items-center gap-3">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                        <div className="text-xs text-text-muted">Mencari outlet terdekat...</div>
                    </div>
                </div>
            )}

            {/* No location yet */}
            {!loading && !hasRecommendations && !summary && (
                <div className="mt-4 rounded-xl border border-border bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>Izinkan lokasi untuk rekomendasi outlet</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSheetOpen(true)}
                            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white active:opacity-80"
                        >
                            Atur
                        </button>
                    </div>
                </div>
            )}

            {/* Recommended outlet card */}
            {selectedOutlet && (
                <div className="mt-4 rounded-xl border border-border bg-white">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Ambil di Outlet</span>
                        {summary && (
                            <button
                                type="button"
                                onClick={() => setSheetOpen(true)}
                                className="text-[11px] font-semibold text-primary active:opacity-80"
                            >
                                Ubah Lokasi
                            </button>
                        )}
                    </div>

                    {/* Selected outlet */}
                    <div className="border-t border-border px-3.5 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-text truncate">{selectedOutlet.name}</span>
                                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                                </div>
                                <div className="mt-0.5 text-[11px] leading-relaxed text-text-muted line-clamp-1">{selectedOutlet.address}</div>
                            </div>
                            <div className="shrink-0 text-right">
                                {selectedOutlet.distance_km !== null && selectedOutlet.distance_km !== undefined && (
                                    <div className="text-xs font-semibold tabular-nums text-text">{selectedOutlet.distance_km.toFixed(1)} km</div>
                                )}
                                <div className={`mt-0.5 text-[10px] font-semibold ${selectedOutlet.stock_available ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {selectedOutlet.stock_available ? 'Stok tersedia' : 'Stok terbatas'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Other outlets — collapsible */}
                    {otherOutlets.length > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setExpanded(!expanded)}
                                className="flex w-full items-center justify-between border-t border-border px-3.5 py-2 text-[11px] font-semibold text-text-muted active:bg-surface-muted"
                            >
                                <span>{otherOutlets.length} outlet lainnya</span>
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </button>

                            {expanded && (
                                <div className="border-t border-border">
                                    {otherOutlets.map((outlet) => (
                                        <button
                                            key={outlet.id}
                                            type="button"
                                            onClick={() => {
                                                onSelect(outlet.id);
                                                setExpanded(false);
                                            }}
                                            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left active:bg-surface-muted border-b border-border last:border-b-0"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-medium text-text truncate">{outlet.name}</div>
                                                <div className="text-[10px] text-text-muted truncate">{outlet.address}</div>
                                            </div>
                                            <div className="shrink-0 ml-3 text-right">
                                                {outlet.distance_km !== null && outlet.distance_km !== undefined && (
                                                    <div className="text-[11px] font-medium tabular-nums text-text-muted">{outlet.distance_km.toFixed(1)} km</div>
                                                )}
                                                <div className={`text-[10px] font-semibold ${outlet.stock_available ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {outlet.stock_available ? 'Tersedia' : 'Terbatas'}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <LocationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
        </>
    );
}
