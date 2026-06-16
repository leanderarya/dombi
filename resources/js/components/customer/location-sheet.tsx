import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import LocationSearchPanel from '@/components/customer/location-search-panel';
import {  syncCustomerLocationDraft, useCustomerLocation } from '@/lib/customer-location';
import type {CustomerLocation} from '@/lib/customer-location';
import { reverseGeocode } from '@/lib/geocoding';

type Props = {
    open: boolean;
    onClose: () => void;
    onLocationSaved?: (location: CustomerLocation) => void;
};

type SheetMode = 'options' | 'manual';
type LocationDraft = {
    address_line: string;
    address_detail?: string;
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
    const { location, hasUsedLocation, saveLocation } = useCustomerLocation();
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

    const showSaved = location && hasUsedLocation;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-[0_-16px_40px_rgba(15,23,42,0.16)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="shrink-0 px-5 pt-4 pb-2">
                    <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
                    <div className="mt-3 flex items-center justify-between">
                        <h2 className="text-[15px] font-semibold text-slate-900">Tentukan Lokasi Anda</h2>
                        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 active:bg-slate-100">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
                    {mode === 'options' && (
                        <div className="mt-2 space-y-2">
                            {/* Primary Actions */}
                            <button
                                type="button"
                                onClick={handleUseCurrentLocation}
                                disabled={loadingCurrent}
                                className="flex h-14 w-full items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 transition-all active:scale-[0.98] active:bg-slate-50 disabled:opacity-60"
                            >
                                <LocateFixed className="h-5 w-5 shrink-0 text-emerald-600" />
                                <span className="text-sm font-semibold text-slate-900">
                                    {loadingCurrent ? 'Mengambil lokasi...' : 'Gunakan Lokasi Saya'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMode('manual')}
                                className="flex h-14 w-full items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-4 transition-all active:scale-[0.98] active:bg-slate-50"
                            >
                                <Search className="h-5 w-5 shrink-0 text-slate-500" />
                                <span className="text-sm font-semibold text-slate-900">Cari Alamat Manual</span>
                            </button>

                            {/* Saved Location — returning users only */}
                            {showSaved && (
                                <>
                                    <div className="h-px bg-slate-100" />
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lokasi Terakhir</span>
                                        </div>
                                        <div className="mt-2 text-sm font-semibold text-slate-900">
                                            {[location.village, location.district].filter(Boolean).join(', ') || 'Lokasi tersimpan'}
                                        </div>
                                        {location.city && (
                                            <div className="mt-0.5 text-xs text-slate-500">{location.city}</div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDraft(toDraft(location));
                                                setMode('manual');
                                            }}
                                            className="mt-3 flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                                        >
                                            Gunakan Lagi
                                        </button>
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>
                            )}
                        </div>
                    )}

                    {mode === 'manual' && (
                        <div className="mt-2 space-y-4">
                            <button type="button" onClick={() => setMode('options')} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 active:text-slate-700">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Kembali
                            </button>

                            <LocationSearchPanel
                                value={draft ?? {
                                    address_line: '',
                                    address_detail: '',
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
                                    address_detail: next.address_detail ?? current?.address_detail ?? '',
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
                                className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition-all active:scale-[0.98] active:bg-emerald-700 disabled:bg-slate-300 disabled:active:scale-100"
                            >
                                Simpan Lokasi
                            </button>
                        </div>
                    )}
                </div>
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
        address_detail: location.address_detail ?? '',
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
        address_detail: draft.address_detail,
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
