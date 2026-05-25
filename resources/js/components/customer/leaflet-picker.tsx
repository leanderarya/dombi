import { useEffect, useRef, useState } from 'react';

// Default center: Semarang, Indonesia
const DEFAULT_LAT = -7.0051;
const DEFAULT_LNG = 110.4381;
const DEFAULT_ZOOM = 15;

interface Props {
    latitude?: number | string | null;
    longitude?: number | string | null;
    onChange: (lat: number, lng: number) => void;
}

/**
 * Leaflet map picker with draggable marker.
 * Lazy-loads Leaflet to avoid SSR issues.
 */
export default function LeafletPicker({ latitude, longitude, onChange }: Props) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const [loaded, setLoaded] = useState(false);

    const lat = latitude ? Number(latitude) : null;
    const lng = longitude ? Number(longitude) : null;
    const hasCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);

    useEffect(() => {
        let cancelled = false;

        async function initMap() {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');

            if (cancelled || !mapRef.current || mapInstanceRef.current) return;

            // Fix default marker icon path
            delete (L.Icon.Default.prototype as any)._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            const center: [number, number] = hasCoords ? [lat!, lng!] : [DEFAULT_LAT, DEFAULT_LNG];

            const map = L.map(mapRef.current, {
                center,
                zoom: DEFAULT_ZOOM,
                zoomControl: false,
                attributionControl: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(map);

            L.control.zoom({ position: 'topright' }).addTo(map);

            const marker = L.marker(center, { draggable: true }).addTo(map);

            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                onChange(pos.lat, pos.lng);
            });

            map.on('click', (e: any) => {
                marker.setLatLng(e.latlng);
                onChange(e.latlng.lat, e.latlng.lng);
            });

            mapInstanceRef.current = map;
            markerRef.current = marker;
            setLoaded(true);

            // If no initial coords, emit the default center
            if (!hasCoords) {
                onChange(DEFAULT_LAT, DEFAULT_LNG);
            }
        }

        initMap();

        return () => {
            cancelled = true;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markerRef.current = null;
            }
        };
    }, []);

    // Update marker when coords change externally (e.g. geolocation)
    useEffect(() => {
        if (mapInstanceRef.current && markerRef.current && hasCoords) {
            const pos = markerRef.current.getLatLng();
            if (Math.abs(pos.lat - lat!) > 0.0001 || Math.abs(pos.lng - lng!) > 0.0001) {
                markerRef.current.setLatLng([lat!, lng!]);
                mapInstanceRef.current.setView([lat!, lng!], DEFAULT_ZOOM);
            }
        }
    }, [lat, lng]);

    return (
        <div className="relative overflow-hidden rounded-lg border border-zinc-200">
            <div ref={mapRef} className="h-48 w-full bg-zinc-100" />
            {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-50">
                    <span className="text-xs text-slate-400">Memuat peta...</span>
                </div>
            )}
        </div>
    );
}
