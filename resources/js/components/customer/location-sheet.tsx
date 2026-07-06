import { CheckCircle2, ChevronDown, LocateFixed, MapPin, Plus, Search, Star, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LocationSearchPanel from '@/components/customer/location-search-panel';
import { syncCustomerLocationDraft, useCustomerLocation } from '@/lib/customer-location';
import type { CustomerLocation } from '@/lib/customer-location';
import { reverseGeocode } from '@/lib/geocoding';

type Props = {
    open: boolean;
    onClose: () => void;
    onLocationSaved?: (location: CustomerLocation) => void;
    isLoggedIn?: boolean;
};

type SheetMode = 'options' | 'manual' | 'save';

type SavedAddress = {
    id: number;
    label: string;
    address_line: string;
    address_detail: string;
    village: string;
    district: string;
    city: string;
    province: string;
    postal_code: string;
    latitude: number;
    longitude: number;
    landmark: string;
    delivery_notes: string;
    is_default: boolean;
};

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

export default function LocationSheet({ open, onClose, onLocationSaved, isLoggedIn = true }: Props) {
    const { location, saveLocation } = useCustomerLocation();
    const [mode, setMode] = useState<SheetMode>('options');
    const [loadingCurrent, setLoadingCurrent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState<LocationDraft | null>(toDraft(location));
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);
    const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
    const [saveLabel, setSaveLabel] = useState('');
    const [saving, setSaving] = useState(false);
    const [canAdd, setCanAdd] = useState(true);

    // Fetch saved addresses from server
    const fetchAddresses = useCallback(async () => {
        if (!isLoggedIn) return;

        setLoadingAddresses(true);
        try {
            const res = await fetch('/customer/addresses/api', {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            if (res.ok) {
                const data = await res.json();
                setSavedAddresses(data.addresses ?? []);
                setCanAdd(data.can_add ?? true);
            }
        } catch {
            // Silent fail
        } finally {
            setLoadingAddresses(false);
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (open) {
            setMode('options');
            setError(null);
            setDraft(toDraft(location));
            setGpsAccuracy(null);
            fetchAddresses();
        }
    }, [open, location, fetchAddresses]);

    async function handleUseCurrentLocation() {
        if (!navigator.geolocation) {
            setError('Geolocation tidak didukung browser ini.');
            return;
        }

        setLoadingCurrent(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                setGpsAccuracy(position.coords.accuracy);
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
                    setDraft(toDraft(nextLocation));
                    // Always go to manual mode so user verifies pin on map
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

    function handleSelectSavedAddress(addr: SavedAddress) {
        const nextLocation: CustomerLocation = {
            address_line: addr.address_line,
            address_detail: addr.address_detail,
            province: addr.province,
            city: addr.city,
            district: addr.district,
            village: addr.village,
            postal_code: addr.postal_code,
            latitude: addr.latitude,
            longitude: addr.longitude,
            timestamp: Date.now(),
            landmark: addr.landmark,
            delivery_notes: addr.delivery_notes,
        };

        saveLocation(nextLocation);
        syncCustomerLocationDraft(nextLocation);
        onLocationSaved?.(nextLocation);
        onClose();
    }

    async function confirmManualLocation() {
        if (!draft || draft.latitude === null || draft.longitude === null) return;

        const finalized = toCustomerLocation(draft);
        saveLocation(finalized);
        await syncCustomerLocationDraft(finalized);
        onLocationSaved?.(finalized);

        if (isLoggedIn && canAdd) {
            setMode('save');
        } else {
            onClose();
        }
    }

    async function handleSaveAddress() {
        if (!draft || draft.latitude === null || draft.longitude === null) return;
        setSaving(true);

        try {
            const res = await fetch('/customer/addresses/from-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    ...toCustomerLocation(draft),
                    label: saveLabel || undefined,
                }),
            });

            if (res.ok) {
                onClose();
            } else {
                const data = await res.json().catch(() => null);
                setError(data?.error ?? 'Gagal menyimpan alamat.');
            }
        } catch {
            setError('Gagal menyimpan alamat.');
        } finally {
            setSaving(false);
        }
    }

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-[0_-16px_40px_rgba(15,23,42,0.16)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="shrink-0 px-5 pt-4 pb-2">
                    <div className="mx-auto h-1.5 w-10 rounded-full bg-border" />
                    <div className="mt-3 flex items-center justify-between">
                        <h2 className="text-[15px] font-semibold text-text">
                            {mode === 'save' ? 'Simpan Alamat?' : 'Tentukan Lokasi Anda'}
                        </h2>
                        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle active:bg-zinc-100">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">

                    {/* MODE: OPTIONS */}
                    {mode === 'options' && (
                        <div className="mt-2 space-y-2">
                            {/* GPS */}
                            <button
                                type="button"
                                onClick={handleUseCurrentLocation}
                                disabled={loadingCurrent}
                                className="flex h-14 w-full items-center gap-3.5 rounded-xl border border-border bg-white px-4 transition-all active:opacity-80 active:bg-zinc-50 disabled:opacity-60"
                            >
                                <LocateFixed className="h-5 w-5 shrink-0 text-primary" />
                                <div className="flex-1 text-left">
                                    <span className="text-sm font-semibold text-text">
                                        {loadingCurrent ? 'Mengambil lokasi...' : 'Gunakan Lokasi Saya'}
                                    </span>
                                    {gpsAccuracy !== null && !loadingCurrent && (
                                        <AccuracyBadge accuracy={gpsAccuracy} />
                                    )}
                                </div>
                            </button>

                            {/* Saved Addresses */}
                            {isLoggedIn && savedAddresses.length > 0 && (
                                <>
                                    <div className="h-px bg-border" />
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle px-1">
                                        Alamat Tersimpan
                                    </div>
                                    {savedAddresses.map((addr) => (
                                        <button
                                            key={addr.id}
                                            type="button"
                                            onClick={() => handleSelectSavedAddress(addr)}
                                            className="flex h-14 w-full items-center gap-3 rounded-xl border border-border bg-white px-4 transition-all active:opacity-80 active:bg-zinc-50"
                                        >
                                            <MapPin className="h-4 w-4 shrink-0 text-text-subtle" />
                                            <div className="min-w-0 flex-1 text-left">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-semibold text-text">{addr.label}</span>
                                                    {addr.is_default && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                                                </div>
                                                <div className="text-[11px] text-text-muted truncate">
                                                    {[addr.village, addr.district, addr.city].filter(Boolean).join(', ') || addr.address_line}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}

                            {/* Manual Search */}
                            <div className="h-px bg-border" />
                            <button
                                type="button"
                                onClick={() => setMode('manual')}
                                className="flex h-14 w-full items-center gap-3.5 rounded-xl border border-border bg-white px-4 transition-all active:opacity-80 active:bg-zinc-50"
                            >
                                <Search className="h-5 w-5 shrink-0 text-text-muted" />
                                <span className="text-sm font-semibold text-text">Cari Alamat Manual</span>
                            </button>

                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>
                            )}

                            {loadingAddresses && (
                                <div className="text-center text-xs text-text-muted py-2">Memuat alamat tersimpan...</div>
                            )}
                        </div>
                    )}

                    {/* MODE: MANUAL */}
                    {mode === 'manual' && (
                        <div className="mt-2 space-y-4">
                            <button type="button" onClick={() => setMode('options')} className="flex items-center gap-1.5 text-xs font-semibold text-text-muted active:text-text">
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
                                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white transition-all active:opacity-80 active:bg-primary-hover disabled:bg-border"
                            >
                                Simpan Lokasi
                            </button>
                        </div>
                    )}

                    {/* MODE: SAVE AS ADDRESS */}
                    {mode === 'save' && (
                        <div className="mt-2 space-y-4">
                            <button type="button" onClick={() => { onClose(); }} className="flex items-center gap-1.5 text-xs font-semibold text-text-muted active:text-text">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                Lewati
                            </button>

                            {/* Preview */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm font-semibold text-emerald-800">Lokasi Terdeteksi</span>
                                    {gpsAccuracy !== null && <AccuracyBadge accuracy={gpsAccuracy} />}
                                </div>
                                <div className="text-sm text-emerald-900 font-medium">
                                    {draft?.address_line || [draft?.village, draft?.district].filter(Boolean).join(', ')}
                                </div>
                                <div className="text-[11px] text-emerald-700 mt-0.5">
                                    {[draft?.village, draft?.district, draft?.city].filter(Boolean).join(', ')}
                                </div>
                            </div>

                            {/* Label input */}
                            {canAdd ? (
                                <>
                                    <div>
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Label Alamat (opsional)</label>
                                        <div className="mt-2 flex gap-2">
                                            {['Rumah', 'Kantor', 'Kos'].map((label) => (
                                                <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => setSaveLabel(saveLabel === label ? '' : label)}
                                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                                        saveLabel === label
                                                            ? 'bg-primary text-white'
                                                            : 'border border-border text-text-muted active:bg-zinc-50'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                        <input
                                            type="text"
                                            value={saveLabel}
                                            onChange={(e) => setSaveLabel(e.target.value)}
                                            placeholder="Atau ketik label sendiri..."
                                            className="mt-2 w-full rounded-lg border border-border px-3 py-2.5 text-sm text-text placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                                            maxLength={20}
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSaveAddress}
                                            disabled={saving}
                                            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80 disabled:opacity-50"
                                        >
                                            {saving ? 'Menyimpan...' : 'Simpan Alamat'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex h-12 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-text-muted active:bg-zinc-50"
                                        >
                                            Nanti Saja
                                        </button>
                                    </div>

                                    <p className="text-[11px] text-text-subtle text-center">
                                        {savedAddresses.length}/5 alamat tersimpan
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                        Alamat tersimpan penuh (5/5). Hapus alamat lama untuk menambah baru.
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white active:opacity-80"
                                    >
                                        Selesai
                                    </button>
                                </>
                            )}

                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function AccuracyBadge({ accuracy }: { accuracy: number }) {
    const level = accuracy <= 10 ? 'high' : accuracy <= 30 ? 'medium' : 'low';
    const colors = {
        high: 'bg-emerald-100 text-emerald-700',
        medium: 'bg-amber-100 text-amber-700',
        low: 'bg-red-100 text-red-700',
    };
    const labels = {
        high: 'Sangat Akurat',
        medium: 'Cukup Akurat',
        low: 'Kurang Akurat',
    };

    return (
        <span className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${colors[level]}`}>
            {labels[level]} ({Math.round(accuracy)}m)
        </span>
    );
}

function toDraft(location: CustomerLocation | null): LocationDraft | null {
    if (!location) return null;
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
