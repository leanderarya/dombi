import { useEffect, useMemo, useRef, useState } from 'react';
import LeafletPicker from '@/components/customer/leaflet-picker';
import type { CustomerLocation } from '@/lib/customer-location';
import { type PlaceSuggestion, reverseGeocode, searchPlaces } from '@/lib/geocoding';

type LocationDraft = {
    address_line: string;
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
    compactSavedCard?: boolean;
};

export default function LocationSearchPanel({
    value,
    onChange,
    savedLocation,
    onUseSavedLocation,
    showSavedLocation = true,
    compactSavedCard = false,
}: Props) {
    const [query, setQuery] = useState(value.address_line ?? '');
    const [searchState, setSearchState] = useState<'idle' | 'searching' | 'found' | 'empty' | 'error'>('idle');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
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

    useEffect(() => {
        if (value.latitude === null || value.longitude === null) {
            return;
        }

        const key = `${value.latitude.toFixed(5)},${value.longitude.toFixed(5)}`;
        if (lastReverseKey.current === key) {
            return;
        }

        if (reverseTimeoutRef.current) {
            window.clearTimeout(reverseTimeoutRef.current);
        }

        reverseTimeoutRef.current = window.setTimeout(() => {
            lastReverseKey.current = key;
            void reverseGeocode(value.latitude!, value.longitude!)
                .then((result) => {
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
        }, 450);

        return () => {
            if (reverseTimeoutRef.current) {
                window.clearTimeout(reverseTimeoutRef.current);
            }
        };
    }, [onChange, showSuggestions, value.address_line, value.city, value.district, value.latitude, value.longitude, value.postal_code, value.province, value.village]);

    const locationSummary = useMemo(
        () => [value.village, value.district, value.city].filter(Boolean).join(', '),
        [value.city, value.district, value.village],
    );

    const lastUsedSummary = useMemo(
        () => [savedLocation?.village, savedLocation?.district].filter(Boolean).join(', '),
        [savedLocation?.district, savedLocation?.village],
    );

    function selectSuggestion(suggestion: PlaceSuggestion) {
        lastReverseKey.current = `${suggestion.latitude.toFixed(5)},${suggestion.longitude.toFixed(5)}`;
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
    }

    return (
        <div className="space-y-4">
            {showSavedLocation && savedLocation && (
                <div className={`rounded-xl border border-slate-200 bg-slate-50 ${compactSavedCard ? 'p-3' : 'p-4'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lokasi Terakhir Digunakan</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{lastUsedSummary || savedLocation.address_line || 'Lokasi tersimpan'}</div>
                            <div className="mt-1 text-xs text-slate-500">{savedLocation.address_line}</div>
                        </div>
                        {onUseSavedLocation && (
                            <button
                                type="button"
                                onClick={onUseSavedLocation}
                                className="min-h-10 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50"
                            >
                                Gunakan Lagi
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="relative">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cari alamat</label>
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
                    className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-200"
                    placeholder="Contoh: Jl. Ngesrep Timur V"
                />

                {showSuggestions && (searchState !== 'idle' || suggestions.length > 0) && (
                    <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                        {searchState === 'searching' && (
                            <div className="px-4 py-3 text-sm text-slate-500">Mencari alamat...</div>
                        )}

                        {searchState === 'found' && suggestions.map((suggestion) => (
                            <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => selectSuggestion(suggestion)}
                                className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 active:bg-slate-50"
                            >
                                <div className="text-sm font-semibold text-slate-900">{suggestion.title}</div>
                                <div className="mt-1 text-xs text-slate-500">{suggestion.subtitle || suggestion.formatted_address}</div>
                            </button>
                        ))}

                        {searchState === 'empty' && (
                            <div className="px-4 py-3 text-sm text-slate-500">Alamat belum ditemukan. Coba kata kunci lain.</div>
                        )}

                        {searchState === 'error' && (
                            <div className="px-4 py-3 text-sm text-slate-500">Pencarian sedang bermasalah. Anda tetap bisa pilih titik di peta.</div>
                        )}
                    </div>
                )}

                <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    {searchState === 'idle' ? 'Cari alamat, pilih hasil yang paling dekat, lalu geser pin bila lokasi belum tepat.' : 'Pilih hasil pencarian lalu konfirmasi titik pin di peta.'}
                </p>
            </div>

            <LeafletPicker latitude={value.latitude} longitude={value.longitude} onChange={handleMarkerChange} />

            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lokasi Pengiriman</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <div className="text-slate-500">Lat</div>
                        <div className="mt-1 font-semibold tabular-nums text-slate-900">{value.latitude !== null ? value.latitude.toFixed(6) : '-'}</div>
                    </div>
                    <div>
                        <div className="text-slate-500">Lng</div>
                        <div className="mt-1 font-semibold tabular-nums text-slate-900">{value.longitude !== null ? value.longitude.toFixed(6) : '-'}</div>
                    </div>
                </div>

                <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Alamat Terdeteksi</div>
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">{value.address_line || 'Alamat akan muncul setelah titik dipilih.'}</div>
                    <div>{[value.village, value.district, value.city].filter(Boolean).join(', ') || '-'}</div>
                    <div>{value.province || '-'}</div>
                    {value.postal_code && <div>Kode pos {value.postal_code}</div>}
                </div>

                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs leading-relaxed text-emerald-800">
                    <div>Geser pin bila lokasi belum tepat.</div>
                    <div className="mt-1">Lokasi pin digunakan sebagai titik pengiriman.</div>
                </div>
            </div>
        </div>
    );
}
