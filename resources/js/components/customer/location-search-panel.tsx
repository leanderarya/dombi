import { CheckCircle2, ChevronDown, ChevronUp, MapPin, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LeafletPicker from '@/components/customer/leaflet-picker';
import type { CustomerLocation } from '@/lib/customer-location';
import {  reverseGeocode, searchPlaces } from '@/lib/geocoding';
import type {PlaceSuggestion} from '@/lib/geocoding';

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
    landmark?: string;
    delivery_notes?: string;
    accuracy?: number | null;
    timestamp?: number;
};

type Props = {
    value: LocationDraft;
    onChange: (next: Partial<LocationDraft>) => void;
    savedLocation?: CustomerLocation | null;
    onUseSavedLocation?: () => void;
    showSavedLocation?: boolean;
};

const reverseGeocodeCache = new Map<string, {
    formatted_address: string;
    province: string;
    city: string;
    kecamatan: string;
    kelurahan: string;
    postal_code: string;
}>();

function cacheKey(lat: number, lng: number): string {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export default function LocationSearchPanel({
    value,
    onChange,
    savedLocation,
    onUseSavedLocation,
    showSavedLocation = true,
}: Props) {
    const [query, setQuery] = useState(value.address_line ?? '');
    const [searchState, setSearchState] = useState<'idle' | 'searching' | 'found' | 'empty' | 'error'>('idle');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [pinUpdated, setPinUpdated] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const reverseTimeoutRef = useRef<number | null>(null);
    const lastReverseKey = useRef<string | null>(null);
    const suppressSearchRef = useRef(false);

    useEffect(() => {
        if (!value.address_line) {
            return;
        }

        if (value.address_line !== query && !showSuggestions) {
            setQuery(value.address_line);
        }
    }, [query, showSuggestions, value.address_line]);

    useEffect(() => {
        const normalized = query.trim();

        if (suppressSearchRef.current) {
            suppressSearchRef.current = false;

            return;
        }

        if (normalized.length < 3) {
            setSuggestions([]);
            setSearchState('idle');

            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setSearchState('searching');

            try {
                const results = await searchPlaces(normalized, controller.signal);
                setSuggestions(results);
                setSearchState(results.length > 0 ? 'found' : 'empty');
                setShowSuggestions(true);
            } catch {
                if (!controller.signal.aborted) {
                    setSearchState('error');
                    setSuggestions([]);
                    setShowSuggestions(true);
                }
            }
        }, 500);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [query]);

    const applyReverseGeocode = useCallback((lat: number, lng: number) => {
        const key = cacheKey(lat, lng);
        const cached = reverseGeocodeCache.get(key);

        if (cached) {
            onChange({
                address_line: cached.formatted_address || value.address_line,
                province: cached.province || value.province,
                city: cached.city || value.city,
                district: cached.kecamatan || value.district,
                village: cached.kelurahan || value.village,
                postal_code: cached.postal_code || value.postal_code,
                timestamp: Date.now(),
            });

            if (!showSuggestions) {
                suppressSearchRef.current = true;
                setQuery(cached.formatted_address || value.address_line);
            }

            return;
        }

        void reverseGeocode(lat, lng)
            .then((result) => {
                reverseGeocodeCache.set(key, result);
                onChange({
                    address_line: result.formatted_address || value.address_line,
                    province: result.province || value.province,
                    city: result.city || value.city,
                    district: result.kecamatan || value.district,
                    village: result.kelurahan || value.village,
                    postal_code: result.postal_code || value.postal_code,
                    timestamp: Date.now(),
                });

                if (!showSuggestions) {
                    suppressSearchRef.current = true;
                    setQuery(result.formatted_address || value.address_line);
                }
            })
            .catch(() => null);
    }, [onChange, showSuggestions, value.address_line, value.city, value.district, value.postal_code, value.province, value.village]);

    useEffect(() => {
        if (value.latitude === null || value.longitude === null) {
            return;
        }

        const key = cacheKey(value.latitude, value.longitude);

        if (lastReverseKey.current === key) {
            return;
        }

        if (reverseTimeoutRef.current) {
            window.clearTimeout(reverseTimeoutRef.current);
        }

        reverseTimeoutRef.current = window.setTimeout(() => {
            lastReverseKey.current = key;
            applyReverseGeocode(value.latitude!, value.longitude!);
        }, 400);

        return () => {
            if (reverseTimeoutRef.current) {
                window.clearTimeout(reverseTimeoutRef.current);
            }
        };
    }, [applyReverseGeocode, value.latitude, value.longitude]);

    const lastUsedSummary = useMemo(
        () => [savedLocation?.village, savedLocation?.district].filter(Boolean).join(', '),
        [savedLocation?.district, savedLocation?.village],
    );

    function selectSuggestion(suggestion: PlaceSuggestion) {
        lastReverseKey.current = cacheKey(suggestion.latitude, suggestion.longitude);
        suppressSearchRef.current = true;
        setQuery(suggestion.formatted_address || suggestion.title);
        setShowSuggestions(false);
        setSuggestions([]);
        onChange({
            address_line: suggestion.formatted_address,
            province: suggestion.province,
            city: suggestion.city,
            district: suggestion.kecamatan,
            village: suggestion.kelurahan,
            postal_code: suggestion.postal_code,
            latitude: suggestion.latitude,
            longitude: suggestion.longitude,
            timestamp: Date.now(),
        });
    }

    function handleMarkerChange(latitude: number, longitude: number) {
        lastReverseKey.current = null;
        onChange({
            latitude,
            longitude,
            timestamp: Date.now(),
        });
        setPinUpdated(true);
        setTimeout(() => setPinUpdated(false), 2000);
    }

    const hasPin = value.latitude !== null && value.longitude !== null;

    // Auto-expand if detail fields already have values
    useEffect(() => {
        if ((value.address_detail ?? '').trim() || (value.landmark ?? '').trim()) {
            setShowDetail(true);
        }
    }, []);

    return (
        <div className="space-y-4">
            {showSavedLocation && savedLocation && (
                <div className="rounded-xl border border-border bg-surface-muted p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 shrink-0 text-text-subtle" />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Lokasi Terakhir</span>
                            </div>
                            <div className="mt-2 text-sm font-semibold text-text">{lastUsedSummary || savedLocation.address_line || 'Lokasi tersimpan'}</div>
                        </div>
                        {onUseSavedLocation && (
                            <button
                                type="button"
                                onClick={onUseSavedLocation}
                                className="min-h-10 shrink-0 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-text active:bg-surface-muted"
                            >
                                Gunakan Lagi
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Cari alamat</label>
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-3 mt-2">
                    <Search className="h-4 w-4 shrink-0 text-text-subtle" />
                    <input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => {
                            if (suggestions.length > 0 || searchState === 'error' || searchState === 'empty') {
                                setShowSuggestions(true);
                            }
                        }}
                        className="min-h-11 w-full bg-transparent text-sm text-text placeholder:text-text-subtle focus:outline-none"
                        placeholder="Contoh: Jl. Ngesrep Timur V"
                    />
                </div>

                {showSuggestions && (searchState !== 'idle' || suggestions.length > 0) && (
                    <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-border bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                        {searchState === 'searching' && (
                            <div className="px-4 py-3 text-sm text-text-muted">Mencari alamat...</div>
                        )}

                        {searchState === 'found' && suggestions.map((suggestion) => (
                            <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => selectSuggestion(suggestion)}
                                className="block w-full border-b border-border px-4 py-3 text-left last:border-b-0 active:bg-surface-muted"
                            >
                                <div className="text-sm font-semibold text-text">{suggestion.title}</div>
                                <div className="mt-1 text-xs text-text-muted">{suggestion.subtitle || suggestion.formatted_address}</div>
                            </button>
                        ))}

                        {searchState === 'empty' && (
                            <div className="px-4 py-3 text-sm text-text-muted">Alamat belum ditemukan. Coba kata kunci lain.</div>
                        )}

                        {searchState === 'error' && (
                            <div className="px-4 py-3 text-sm text-text-muted">Pencarian sedang bermasalah. Anda tetap bisa pilih titik di peta.</div>
                        )}
                    </div>
                )}

                <p className="mt-2 text-[11px] font-semibold text-text-muted">
                    Cari alamat, lalu geser pin untuk menyesuaikan lokasi tepat.
                </p>
            </div>

            {/* Section 1: Map Pin */}
            <div className="rounded-xl border border-border bg-white p-4">
                <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-text-subtle" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Lokasi Pin</span>
                </div>
                <div className="mt-3">
                    <LeafletPicker latitude={value.latitude} longitude={value.longitude} onChange={handleMarkerChange} />
                </div>
                {pinUpdated ? (
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Lokasi Pin Diperbarui</span>
                    </div>
                ) : (
                    <p className="mt-3 text-xs text-text-muted">Pastikan pin berada tepat di lokasi tujuan.</p>
                )}
            </div>

            {/* Section 2: Detected Address (editable) */}
            <div className="rounded-xl border border-border bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Alamat Terdeteksi</div>
                <div className="mt-3 space-y-3">
                    <label className="block">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Alamat</span>
                        <input
                            value={value.address_line ?? ''}
                            onChange={(event) => onChange({ address_line: event.target.value })}
                            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                            placeholder={hasPin ? 'Alamat akan terisi otomatis' : 'Pilih lokasi di peta terlebih dahulu'}
                        />
                    </label>
                    <div className="text-xs text-text-muted">
                        {[value.village, value.district, value.city].filter(Boolean).join(', ') || (hasPin ? 'Mendeteksi wilayah...' : '-')}
                    </div>
                </div>
            </div>

            {/* Toggle for detail fields */}
            <button
                type="button"
                onClick={() => setShowDetail(!showDetail)}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-semibold text-text-muted active:opacity-80"
            >
                {showDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showDetail ? 'Sembunyikan Detail' : 'Tambah Detail Alamat'}
                {!showDetail && hasPin && (!(value.address_detail ?? '').trim() || !(value.landmark ?? '').trim()) && (
                    <span className="ml-auto text-[11px] font-medium text-amber-600">Opsional</span>
                )}
            </button>

            {/* Collapsible detail sections */}
            {showDetail && (
                <>
                    {/* Detail Alamat */}
                    <div className="rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Detail Alamat</div>
                        <div className="mt-3">
                            <label className="block">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Detail</span>
                                <input
                                    value={value.address_detail ?? ''}
                                    onChange={(event) => onChange({ address_detail: event.target.value })}
                                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                    placeholder="Blok B3 No 27"
                                />
                            </label>
                            <p className="mt-1.5 text-xs text-text-muted">Nomor rumah, blok, lantai, atau unit.</p>
                        </div>
                    </div>

                    {/* Patokan */}
                    <div className="rounded-xl border border-border bg-white p-4">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Patokan / Ciri Rumah</div>
                        <div className="mt-3">
                            <label className="block">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Patokan</span>
                                <input
                                    value={value.landmark ?? ''}
                                    onChange={(event) => onChange({ landmark: event.target.value })}
                                    className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text placeholder:text-text-subtle focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                                    placeholder="Rumah cat hijau dekat mushola"
                                />
                            </label>
                            <p className="mt-1.5 text-xs text-text-muted">Informasi ini membantu kurir menemukan lokasi dengan lebih cepat.</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
