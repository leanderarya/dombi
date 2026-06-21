import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { searchPlaces  } from '@/lib/geocoding';
import type {PlaceSuggestion} from '@/lib/geocoding';

type LatLng = { lat: number; lng: number };

type ExistingOutlet = {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
};

interface Props {
    value?: LatLng | null;
    onChange: (value: LatLng) => void;
    readOnly?: boolean;
    existingOutlets?: ExistingOutlet[];
}

const SEMARANG_CENTER: LatLng = { lat: -7.0051, lng: 110.4381 };
const DEFAULT_ZOOM = 12;
const MARKER_ZOOM = 15;

// Gray circle icon for existing outlets
const existingOutletIcon = L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#94a3b8;border:3px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:white"></div></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
});

function haversineDistance(a: LatLng, b: LatLng): number {
    const R = 6371; // km
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;

    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function OutletLocationMap({ value, onChange, readOnly = false, existingOutlets = [] }: Props) {
    const marker = value?.lat && value?.lng ? value : null;
    const center = marker ?? SEMARANG_CENTER;
    const selectedIcon = useMemo(() => L.icon({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    }), []);

    // Find nearest outlet to selected marker
    const nearest = useMemo(() => {
        if (!marker || existingOutlets.length === 0) {
return null;
}

        let minDist = Infinity;
        let closest: ExistingOutlet | null = null;

        for (const o of existingOutlets) {
            const d = haversineDistance(marker, { lat: Number(o.latitude), lng: Number(o.longitude) });

            if (d < minDist) {
                minDist = d;
                closest = o;
            }
        }

        return closest ? { outlet: closest, distance: minDist } : null;
    }, [marker, existingOutlets]);

    return (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-100">
            {!readOnly && <MapSearchBox onSelect={(lat, lng) => onChange({ lat, lng })} />}
            <div className="h-[200px] w-full lg:h-[400px]">
                <MapContainer
                    center={[center.lat, center.lng]}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom={false}
                    zoomControl={true}
                    touchZoom={true}
                    doubleClickZoom={true}
                    className="h-full w-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapFitBounds existingOutlets={existingOutlets} position={marker} />
                    <MapCenter position={marker} />
                    {!readOnly && <MapClickHandler onChange={onChange} />}

                    {/* Existing outlet markers */}
                    {existingOutlets.map((o) => (
                        <Marker
                            key={o.id}
                            position={[Number(o.latitude), Number(o.longitude)]}
                            icon={existingOutletIcon}
                        >
                            <Popup>
                                <div className="text-xs">
                                    <div className="font-bold text-slate-900">{o.name}</div>
                                    {o.address && <div className="mt-0.5 text-slate-500">{o.address}</div>}
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Selected marker */}
                    {marker && (
                        <Marker
                            position={marker}
                            icon={selectedIcon}
                            draggable={!readOnly}
                            eventHandlers={{
                                dragend: (event) => {
                                    const point = event.target.getLatLng();
                                    onChange({ lat: point.lat, lng: point.lng });
                                },
                            }}
                        />
                    )}
                </MapContainer>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2 text-[11px]">
                <span className="font-semibold text-slate-500">
                    {readOnly ? 'Outlet coordinates' : nearest ? `Outlet terdekat: ${nearest.outlet.name} (${nearest.distance.toFixed(1)} km)` : 'Tap map atau drag marker'}
                </span>
                <span className="rounded-md bg-[#F8FAFC] px-2 py-1 font-semibold text-slate-700 tabular-nums">
                    Lat: {marker ? marker.lat.toFixed(5) : SEMARANG_CENTER.lat.toFixed(2)} · Lng: {marker ? marker.lng.toFixed(5) : SEMARANG_CENTER.lng.toFixed(2)}
                </span>
            </div>
        </div>
    );
}

function MapSearchBox({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = useCallback((value: string) => {
        setQuery(value);

        if (debounceRef.current) {
clearTimeout(debounceRef.current);
}

        if (abortRef.current) {
abortRef.current.abort();
}

        if (value.trim().length < 3) {
            setSuggestions([]);
            setOpen(false);

            return;
        }

        debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            setLoading(true);

            try {
                const results = await searchPlaces(value, controller.signal);
                setSuggestions(results);
                setOpen(results.length > 0);
            } catch {
                // Aborted or failed — ignore
            } finally {
                setLoading(false);
            }
        }, 350);
    }, []);

    const handleSelect = useCallback((suggestion: PlaceSuggestion) => {
        onSelect(suggestion.latitude, suggestion.longitude);
        setQuery(suggestion.title);
        setSuggestions([]);
        setOpen(false);
    }, [onSelect]);

    const handleClear = useCallback(() => {
        setQuery('');
        setSuggestions([]);
        setOpen(false);

        if (abortRef.current) {
abortRef.current.abort();
}
    }, []);

    return (
        <div className="relative border-b border-slate-200 bg-white">
            <div className="flex items-center gap-2 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setOpen(true)}
                    placeholder="Cari lokasi outlet..."
                    className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                {query && (
                    <button type="button" onClick={handleClear} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                    </button>
                )}
                {loading && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                )}
            </div>

            {open && suggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-[1000] max-h-48 overflow-y-auto border-b border-slate-200 bg-white shadow-lg">
                    {suggestions.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelect(s)}
                            className="flex w-full flex-col px-3 py-2 text-left hover:bg-emerald-50 active:bg-emerald-100"
                        >
                            <span className="text-sm font-medium text-slate-900">{s.title}</span>
                            <span className="text-[11px] text-slate-500">{s.subtitle}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function MapClickHandler({ onChange }: { onChange: (value: LatLng) => void }) {
    useMapEvents({
        click(event) {
            onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
        },
    });

    return null;
}

function MapCenter({ position }: { position: LatLng | null }) {
    const map = useMap();
    const isInitialMount = useRef(true);

    useEffect(() => {
        // Skip the first render to let MapFitBounds handle initial positioning
        if (isInitialMount.current) {
            isInitialMount.current = false;

            return;
        }

        if (position) {
            map.setView([position.lat, position.lng], MARKER_ZOOM, { animate: true });
        }
    }, [map, position]);

    return null;
}

function MapFitBounds({ existingOutlets, position }: { existingOutlets: ExistingOutlet[]; position: LatLng | null }) {
    const map = useMap();
    const hasFitted = useRef(false);

    useEffect(() => {
        if (hasFitted.current) {
return;
}

        // If we have a position (editing), zoom to it
        if (position) {
            map.setView([position.lat, position.lng], MARKER_ZOOM, { animate: false });
            hasFitted.current = true;

            return;
        }

        // If we have existing outlets, fit bounds to show them all
        if (existingOutlets.length >= 2) {
            const bounds = L.latLngBounds(
                existingOutlets.map(o => [parseFloat(o.latitude), parseFloat(o.longitude)])
            );
            map.fitBounds(bounds, { maxZoom: MARKER_ZOOM, padding: [40, 40] });
            hasFitted.current = true;
        } else if (existingOutlets.length === 1) {
            map.setView(
                [parseFloat(existingOutlets[0].latitude), parseFloat(existingOutlets[0].longitude)],
                MARKER_ZOOM,
                { animate: false }
            );
            hasFitted.current = true;
        }
    }, [map, existingOutlets, position]);

    return null;
}
