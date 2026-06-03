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

    return (
        <>
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lokasi Rekomendasi Pickup</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{summary || 'Lokasi belum dipilih'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                            {summary ? 'Rekomendasi outlet pickup akan menyesuaikan stok dan jarak dari lokasi ini.' : 'Tentukan lokasi untuk melihat outlet pickup terdekat.'}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSheetOpen(true)}
                        className="min-h-11 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                    >
                        {summary ? 'Ubah Lokasi' : 'Pilih Lokasi'}
                    </button>
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recommended Outlet</div>
                        <div className="mt-1 text-sm text-slate-500">
                            {loading ? 'Mencari outlet pickup terbaik...' : 'Stok tersedia diprioritaskan lebih dulu, lalu jarak terdekat.'}
                        </div>
                    </div>
                    {recommendations.recommended && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Direkomendasikan</span>}
                </div>

                {selectedOutlet ? (
                    <div className="mt-4 space-y-3">
                        {alternatives.map((outlet) => {
                            const active = selectedOutletId === outlet.id;
                            const recommended = recommendations.recommended?.id === outlet.id;

                            return (
                                <button
                                    key={outlet.id}
                                    type="button"
                                    onClick={() => onSelect(outlet.id)}
                                    className={`w-full rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                                        active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm font-semibold text-slate-900">{outlet.name}</div>
                                                {recommended && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Direkomendasikan</span>}
                                            </div>
                                            <div className="mt-1 text-xs leading-relaxed text-slate-500">{outlet.address}</div>
                                            <div className="mt-1 text-xs text-slate-500">{[outlet.kelurahan, outlet.kecamatan].filter(Boolean).join(' · ')}</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="text-sm font-semibold tabular-nums text-slate-900">
                                                {outlet.distance_km !== null && outlet.distance_km !== undefined ? `${outlet.distance_km.toFixed(1)} km` : 'Jarak belum tersedia'}
                                            </div>
                                            <div className="mt-1 text-[11px] font-semibold text-emerald-700">Stock Available</div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        Belum ada outlet pickup yang bisa direkomendasikan untuk pesanan ini.
                    </div>
                )}

                {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
            </section>

            <LocationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
        </>
    );
}
