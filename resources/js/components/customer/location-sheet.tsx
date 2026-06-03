import { useEffect, useState } from 'react';
import LocationSearchPanel from '@/components/customer/location-search-panel';
import { type CustomerLocation, syncCustomerLocationDraft, useCustomerLocation } from '@/lib/customer-location';
import { reverseGeocode } from '@/lib/geocoding';

type Props = {
    open: boolean;
    onClose: () => void;
    onLocationSaved?: (location: CustomerLocation) => void;
};

type SheetMode = 'options' | 'manual';
type LocationDraft = {
    address_line: string;
    province: string;
    city: string;
    district: string;
    village: string;
    postal_code: string;
    latitude: number | null;
    longitude: number | null;
    accuracy?: number | null;
    timestamp: number;
    landmark?: string;
    delivery_notes?: string;
};

export default function LocationSheet({ open, onClose, onLocationSaved }: Props) {
    const { location, saveLocation } = useCustomerLocation();
    const [mode, setMode] = useState<SheetMode>('options');
    const [loadingCurrent, setLoadingCurrent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<LocationDraft | null>(toDraft(location));

    useEffect(() => {
        if (open) {
            setMode('options');
            setError(null);
            setDraft(toDraft(location));
        }
    }, [open, location]);

    async function handleUseCurrentLocation() {
        if (!navigator.geolocation) {
            setError('Geolocation tidak didukung browser ini.');
            return;
        }

        setLoadingCurrent(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const result = await reverseGeocode(position.coords.latitude, position.coords.longitude);
                    const nextLocation: CustomerLocation = {
                        address_line: result.formatted_address,
                        province: result.province,
                        city: result.city,
                        district: result.kecamatan,
                        village: result.kelurahan,
                        postal_code: result.postal_code,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: Date.now(),
                    };

                    saveLocation(nextLocation);
                    await syncCustomerLocationDraft(nextLocation);
                    onLocationSaved?.(nextLocation);
                    setDraft(toDraft(nextLocation));
                    setMode('manual');
                } catch {
                    const nextLocation: LocationDraft = {
                        address_line: '',
                        province: '',
                        city: '',
                        district: '',
                        village: '',
                        postal_code: '',
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: Date.now(),
                    };

                    setDraft(nextLocation);
                    setMode('manual');
                } finally {
                    setLoadingCurrent(false);
                }
            },
            (geoError) => {
                setLoadingCurrent(false);
                switch (geoError.code) {
                    case geoError.PERMISSION_DENIED:
                        setError('Izin lokasi ditolak. Silakan pilih lokasi manual di peta.');
                        break;
                    case geoError.POSITION_UNAVAILABLE:
                        setError('Lokasi tidak tersedia. Coba lagi atau pilih manual.');
                        break;
                    case geoError.TIMEOUT:
                        setError('Waktu pencarian lokasi habis. Coba lagi.');
                        break;
                    default:
                        setError('Gagal mendapatkan lokasi saat ini.');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
    }

    async function confirmManualLocation() {
        if (!draft || draft.latitude === null || draft.longitude === null) {
            return;
        }

        const finalized = toCustomerLocation(draft);

        saveLocation(finalized);
        await syncCustomerLocationDraft(finalized);
        onLocationSaved?.(finalized);
        onClose();
    }

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/40">
            <button type="button" aria-label="Tutup" className="absolute inset-0 h-full w-full" onClick={onClose} />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-3xl bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_40px_rgba(15,23,42,0.16)]">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
                <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Tentukan Lokasi Anda</h2>
                        <p className="mt-1 text-sm text-slate-500">Lokasi membantu kami merekomendasikan outlet pickup terbaik dan mempermudah pengantaran.</p>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 active:bg-slate-100">
                        ✕
                    </button>
                </div>

                {mode === 'options' && (
                    <div className="mt-5 space-y-3">
                        <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={loadingCurrent}
                            className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left transition-all active:scale-[0.98]"
                        >
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Gunakan Lokasi Saya</div>
                                <div className="mt-1 text-xs text-slate-500">Izin lokasi hanya diminta setelah Anda menekan tombol ini.</div>
                            </div>
                            <span className="text-slate-400">{loadingCurrent ? '...' : '›'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setMode('manual')}
                            className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left transition-all active:scale-[0.98]"
                        >
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Cari Alamat Manual</div>
                                <div className="mt-1 text-xs text-slate-500">Cari alamat, pilih hasilnya, lalu sesuaikan pin bila perlu.</div>
                            </div>
                            <span className="text-slate-400">›</span>
                        </button>

                        {location && (
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                                <div className="font-semibold">
                                    {[location.village, location.district].filter(Boolean).join(', ') || location.address_line || 'Lokasi tersimpan'}
                                </div>
                                <div className="mt-1 text-xs text-emerald-700">{location.address_line || 'Gunakan lagi untuk rekomendasi outlet pickup.'}</div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDraft(toDraft(location));
                                        setMode('manual');
                                    }}
                                    className="mt-3 min-h-10 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 active:bg-emerald-50"
                                >
                                    Gunakan Lagi
                                </button>
                            </div>
                        )}

                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                )}

                {mode === 'manual' && (
                    <div className="mt-5 space-y-4">
                        <button type="button" onClick={() => setMode('options')} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            ← Kembali
                        </button>

                        <LocationSearchPanel
                            value={draft ?? {
                                address_line: '',
                                province: '',
                                city: '',
                                district: '',
                                village: '',
                                postal_code: '',
                                latitude: null,
                                longitude: null,
                                accuracy: null,
                                timestamp: Date.now(),
                            }}
                            onChange={(next) => setDraft((current) => ({
                                address_line: next.address_line ?? current?.address_line ?? '',
                                province: next.province ?? current?.province ?? '',
                                city: next.city ?? current?.city ?? '',
                                district: next.district ?? current?.district ?? '',
                                village: next.village ?? current?.village ?? '',
                                postal_code: next.postal_code ?? current?.postal_code ?? '',
                                latitude: next.latitude ?? current?.latitude ?? null,
                                longitude: next.longitude ?? current?.longitude ?? null,
                                accuracy: next.accuracy ?? current?.accuracy ?? null,
                                timestamp: next.timestamp ?? current?.timestamp ?? Date.now(),
                                landmark: next.landmark ?? current?.landmark,
                                delivery_notes: next.delivery_notes ?? current?.delivery_notes,
                            }))}
                            savedLocation={location}
                            showSavedLocation={false}
                        />

                        <button
                            type="button"
                            onClick={confirmManualLocation}
                            disabled={!draft || draft.latitude === null || draft.longitude === null}
                            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:active:scale-100"
                        >
                            Simpan Lokasi
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function toDraft(location: CustomerLocation | null): LocationDraft | null {
    if (!location) {
        return null;
    }

    return {
        address_line: location.address_line ?? '',
        province: location.province ?? '',
        city: location.city ?? '',
        district: location.district ?? '',
        village: location.village ?? '',
        postal_code: location.postal_code ?? '',
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy ?? null,
        timestamp: location.timestamp,
        landmark: location.landmark,
        delivery_notes: location.delivery_notes,
    };
}

function toCustomerLocation(draft: LocationDraft): CustomerLocation {
    return {
        address_line: draft.address_line,
        province: draft.province,
        city: draft.city,
        district: draft.district,
        village: draft.village,
        postal_code: draft.postal_code,
        latitude: draft.latitude ?? 0,
        longitude: draft.longitude ?? 0,
        accuracy: draft.accuracy ?? null,
        timestamp: draft.timestamp,
        landmark: draft.landmark,
        delivery_notes: draft.delivery_notes,
    };
}
